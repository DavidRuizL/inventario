import { Prisma } from '@prisma/client';
import { prisma, conUsuario } from '../../db';
import { aplicarEfectos, Efecto } from '../../core/saldo';
import { siguienteConsecutivo } from '../../core/consecutivo';
import { esAdmin, puedeOperarSede, puedeVerMovimiento } from '../../core/permisos';
import { DetalleError, NoEncontradoError, ReglaError, SinPermisoError, ValidacionError, ConflictoError } from '../../shared/errors';
import { UsuarioAuth } from '../../shared/types';
import {
  CrearAjusteInput,
  CrearSalidaInput,
  CrearTrasladoInput,
  LineaAjusteEntrada,
  LineaTrasladoEntrada,
} from './movimientos.schemas';

type LineaResuelta = { loteId: number; cantidad: number; saldoSistema?: number; conteo?: number };

async function resolverOCrearLote(
  tx: Prisma.TransactionClient,
  usuarioId: number,
  entrada: { producto: { id: number } | { codigo: string; descripcion: string; referencia?: string; marca?: string }; nroLote: string; fechaVencimiento?: string },
): Promise<number> {
  let productoId: number;

  if ('id' in entrada.producto) {
    const producto = await tx.producto.findUnique({ where: { id: entrada.producto.id } });
    if (!producto) throw new NoEncontradoError('El producto indicado no existe.');
    productoId = producto.id;
  } else {
    const codigo = entrada.producto.codigo.trim();
    const existente = await tx.producto.findUnique({ where: { codigo } });
    if (existente) {
      productoId = existente.id;
    } else {
      const creado = await tx.producto.create({
        data: {
          codigo,
          descripcion: entrada.producto.descripcion.trim(),
          referencia: entrada.producto.referencia?.trim() || null,
          marca: entrada.producto.marca?.trim() || null,
          origen: 'MANUAL',
          creadoPorId: usuarioId,
          creadoEn: new Date(),
        },
      });
      productoId = creado.id;
    }
  }

  const nroLote = entrada.nroLote.trim();
  const loteExistente = await tx.lote.findUnique({
    where: { productoId_nroLote: { productoId, nroLote } },
  });
  if (loteExistente) return loteExistente.id;

  const loteCreado = await tx.lote.create({
    data: {
      productoId,
      nroLote,
      fechaVencimiento: entrada.fechaVencimiento ? new Date(`${entrada.fechaVencimiento}T00:00:00.000Z`) : null,
      origen: 'MANUAL',
      creadoPorId: usuarioId,
      creadoEn: new Date(),
    },
  });
  return loteCreado.id;
}

function verificarSinLotesRepetidos(lineas: LineaResuelta[]): void {
  const vistos = new Map<number, number>();
  lineas.forEach((l, i) => {
    if (vistos.has(l.loteId)) {
      throw new ValidacionError(`El lote de la línea ${i + 1} ya aparece en otra línea de este movimiento.`);
    }
    vistos.set(l.loteId, i);
  });
}

async function resolverLineasTraslado(
  tx: Prisma.TransactionClient,
  usuarioId: number,
  origenControlaSaldo: boolean,
  lineas: LineaTrasladoEntrada[],
): Promise<LineaResuelta[]> {
  const errores: DetalleError[] = [];
  const resueltas: LineaResuelta[] = [];

  for (const [idx, entrada] of lineas.entries()) {
    if ('loteId' in entrada) {
      resueltas.push({ loteId: entrada.loteId, cantidad: entrada.cantidad });
    } else {
      if (origenControlaSaldo) {
        errores.push({
          campo: `lineas.${idx}`,
          mensaje: 'Esta sede solo puede enviar lotes que ya tiene en su inventario.',
        });
        continue;
      }
      const loteId = await resolverOCrearLote(tx, usuarioId, entrada);
      resueltas.push({ loteId, cantidad: entrada.cantidad });
    }
  }

  if (errores.length > 0) throw new ValidacionError('Hay líneas inválidas.', errores);
  verificarSinLotesRepetidos(resueltas);
  return resueltas;
}

async function resolverLineasAjuste(
  tx: Prisma.TransactionClient,
  usuarioId: number,
  sedeId: number,
  lineas: LineaAjusteEntrada[],
): Promise<LineaResuelta[]> {
  const previas: { loteId: number; conteo: number }[] = [];

  for (const entrada of lineas) {
    if ('loteId' in entrada) {
      previas.push({ loteId: entrada.loteId, conteo: entrada.conteo });
    } else {
      const loteId = await resolverOCrearLote(tx, usuarioId, entrada);
      previas.push({ loteId, conteo: entrada.conteo });
    }
  }

  verificarSinLotesRepetidos(previas.map((p) => ({ loteId: p.loteId, cantidad: 1 })));

  const loteIds = previas.map((p) => p.loteId);
  const saldos = await tx.saldo.findMany({ where: { sedeId, loteId: { in: loteIds } } });
  const saldoMap = new Map(saldos.map((s) => [s.loteId, s.cantidad]));

  const conflictos = await tx.movimientoLinea.findMany({
    where: {
      loteId: { in: loteIds },
      movimiento: { tipo: 'AJUSTE', estado: 'PENDIENTE', sedeDestinoId: sedeId },
    },
    select: { loteId: true },
  });
  const loteIdsConflicto = new Set(conflictos.map((c) => c.loteId));

  const errores: DetalleError[] = [];
  const resueltas: LineaResuelta[] = [];

  for (const p of previas) {
    if (loteIdsConflicto.has(p.loteId)) {
      errores.push({ loteId: p.loteId, mensaje: 'Ya hay un ajuste pendiente de aprobación para este lote en esta sede.' });
      continue;
    }
    const saldoSistema = saldoMap.get(p.loteId) ?? 0;
    const cantidad = p.conteo - saldoSistema;
    if (cantidad === 0) continue; // sin diferencia: no se envía
    resueltas.push({ loteId: p.loteId, cantidad, saldoSistema, conteo: p.conteo });
  }

  if (errores.length > 0) throw new ReglaError('No se pudo crear el ajuste.', errores);
  if (resueltas.length === 0) throw new ReglaError('No hay diferencias entre el sistema y el conteo.');

  return resueltas;
}

function efectosDesdeLineas(
  sedeOrigenId: number | null,
  sedeDestinoId: number | null,
  lineas: { loteId: number; cantidad: number }[],
): Efecto[] {
  const efectos: Efecto[] = [];
  if (sedeOrigenId) for (const l of lineas) efectos.push({ sedeId: sedeOrigenId, loteId: l.loteId, cantidad: -l.cantidad });
  if (sedeDestinoId) for (const l of lineas) efectos.push({ sedeId: sedeDestinoId, loteId: l.loteId, cantidad: l.cantidad });
  return efectos;
}

export async function crearTraslado(usuario: UsuarioAuth, input: CrearTrasladoInput) {
  if (!puedeOperarSede(usuario, input.sedeOrigenId)) throw new SinPermisoError('No operas la sede de origen.');
  if (input.sedeOrigenId === input.sedeDestinoId) throw new ValidacionError('El origen y el destino deben ser distintos.');

  return conUsuario(usuario.id, null, async (tx) => {
    const [origen, destino] = await Promise.all([
      tx.sede.findUnique({ where: { id: input.sedeOrigenId } }),
      tx.sede.findUnique({ where: { id: input.sedeDestinoId } }),
    ]);
    if (!origen || !origen.activo) throw new ValidacionError('La sede de origen no existe o está inactiva.');
    if (!destino || !destino.activo) throw new ValidacionError('La sede de destino no existe o está inactiva.');

    if (input.motivo === 'CARGA_INICIAL' && origen.controlaSaldo) {
      throw new ValidacionError('El motivo CARGA_INICIAL solo se usa al enviar desde la Bodega ERP.');
    }

    const lineas = await resolverLineasTraslado(tx, usuario.id, origen.controlaSaldo, input.lineas);
    const consecutivo = await siguienteConsecutivo(tx, 'TRASLADO');
    const ahora = new Date();

    const movimiento = await tx.movimiento.create({
      data: {
        consecutivo,
        tipo: 'TRASLADO',
        motivo: input.motivo ?? null,
        sedeOrigenId: input.sedeOrigenId,
        sedeDestinoId: input.sedeDestinoId,
        estado: 'NO_CONFIRMADO',
        documentoSoporte: input.documentoSoporte ?? null,
        observacion: input.observacion ?? null,
        creadoPorId: usuario.id,
        creadoEn: ahora,
        lineas: { create: lineas.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad })) },
      },
      include: { lineas: true },
    });

    const efectos = efectosDesdeLineas(input.sedeOrigenId, null, lineas);
    await aplicarEfectos(tx, movimiento.id, efectos, 'MOVER');

    return movimiento;
  });
}

export async function crearSalida(usuario: UsuarioAuth, input: CrearSalidaInput) {
  if (!puedeOperarSede(usuario, input.sedeOrigenId)) throw new SinPermisoError('No operas esta sede.');

  return conUsuario(usuario.id, null, async (tx) => {
    const origen = await tx.sede.findUnique({ where: { id: input.sedeOrigenId } });
    if (!origen || !origen.activo) throw new ValidacionError('La sede no existe o está inactiva.');
    if (!origen.controlaSaldo) throw new ReglaError('La Bodega ERP no registra salidas.');

    const lineas: LineaResuelta[] = input.lineas.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad }));
    verificarSinLotesRepetidos(lineas);

    const consecutivo = await siguienteConsecutivo(tx, 'SALIDA');
    const ahora = new Date();

    const movimiento = await tx.movimiento.create({
      data: {
        consecutivo,
        tipo: 'SALIDA',
        motivo: input.motivo,
        sedeOrigenId: input.sedeOrigenId,
        sedeDestinoId: null,
        estado: 'APLICADO',
        documentoSoporte: input.documentoSoporte ?? null,
        observacion: input.observacion ?? null,
        creadoPorId: usuario.id,
        creadoEn: ahora,
        lineas: { create: lineas.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad })) },
      },
      include: { lineas: true },
    });

    const efectos = efectosDesdeLineas(input.sedeOrigenId, null, lineas);
    await aplicarEfectos(tx, movimiento.id, efectos, 'MOVER');

    return movimiento;
  });
}

export async function crearAjuste(usuario: UsuarioAuth, input: CrearAjusteInput) {
  if (!puedeOperarSede(usuario, input.sedeId)) throw new SinPermisoError('No operas esta sede.');

  return conUsuario(usuario.id, null, async (tx) => {
    const sede = await tx.sede.findUnique({ where: { id: input.sedeId } });
    if (!sede || !sede.activo) throw new ValidacionError('La sede no existe o está inactiva.');
    if (!sede.controlaSaldo) throw new ReglaError('La Bodega ERP no admite ajustes de conteo.');

    const lineas = await resolverLineasAjuste(tx, usuario.id, input.sedeId, input.lineas);
    const consecutivo = await siguienteConsecutivo(tx, 'AJUSTE');
    const ahora = new Date();

    const movimiento = await tx.movimiento.create({
      data: {
        consecutivo,
        tipo: 'AJUSTE',
        motivo: 'CONTEO_FISICO',
        sedeOrigenId: null,
        sedeDestinoId: input.sedeId,
        estado: 'PENDIENTE',
        observacion: input.observacion ?? null,
        creadoPorId: usuario.id,
        creadoEn: ahora,
        lineas: {
          create: lineas.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad, saldoSistema: l.saldoSistema, conteo: l.conteo })),
        },
      },
      include: { lineas: true },
    });

    return movimiento;
  });
}

export async function confirmarTraslado(usuario: UsuarioAuth, movimientoId: number) {
  const movimiento = await prisma.movimiento.findUnique({ where: { id: movimientoId }, include: { lineas: true } });
  if (!movimiento || movimiento.tipo !== 'TRASLADO') throw new NoEncontradoError('El traslado no existe.');
  if (!movimiento.sedeDestinoId || !puedeOperarSede(usuario, movimiento.sedeDestinoId)) {
    throw new SinPermisoError('No operas la sede destino de este traslado.');
  }

  return conUsuario(usuario.id, null, async (tx) => {
    const { count } = await tx.movimiento.updateMany({
      where: { id: movimientoId, tipo: 'TRASLADO', estado: 'NO_CONFIRMADO' },
      data: { estado: 'RECIBIDO', resueltoPorId: usuario.id, resueltoEn: new Date() },
    });
    if (count !== 1) throw new ConflictoError('Este traslado ya fue confirmado o rechazado.');

    const efectos = efectosDesdeLineas(null, movimiento.sedeDestinoId, movimiento.lineas);
    await aplicarEfectos(tx, movimientoId, efectos, 'MOVER');

    return tx.movimiento.findUniqueOrThrow({ where: { id: movimientoId }, include: { lineas: true } });
  });
}

export async function rechazarMovimiento(usuario: UsuarioAuth, movimientoId: number, motivo: string) {
  const movimiento = await prisma.movimiento.findUnique({ where: { id: movimientoId }, include: { lineas: true } });
  if (!movimiento) throw new NoEncontradoError('El movimiento no existe.');

  if (movimiento.tipo === 'TRASLADO') {
    const puedeOperar = movimiento.sedeDestinoId ? puedeOperarSede(usuario, movimiento.sedeDestinoId) : false;
    if (!puedeOperar && !esAdmin(usuario)) throw new SinPermisoError('No puedes rechazar este traslado.');

    return conUsuario(usuario.id, motivo, async (tx) => {
      const { count } = await tx.movimiento.updateMany({
        where: { id: movimientoId, tipo: 'TRASLADO', estado: 'NO_CONFIRMADO' },
        data: { estado: 'RECHAZADO', resueltoPorId: usuario.id, resueltoEn: new Date(), motivoResolucion: motivo },
      });
      if (count !== 1) throw new ConflictoError('Este traslado ya fue confirmado o rechazado.');

      // Rechazar devuelve al origen lo que se le había restado al enviar: el
      // origen recibe (+), no entrega (-), así que va en la posición "destino".
      const efectos = efectosDesdeLineas(null, movimiento.sedeOrigenId, movimiento.lineas);
      await aplicarEfectos(tx, movimientoId, efectos, 'MOVER');

      return tx.movimiento.findUniqueOrThrow({ where: { id: movimientoId }, include: { lineas: true } });
    });
  }

  if (movimiento.tipo === 'AJUSTE') {
    if (!esAdmin(usuario)) throw new SinPermisoError('Solo un administrador puede rechazar ajustes.');

    return conUsuario(usuario.id, motivo, async (tx) => {
      const { count } = await tx.movimiento.updateMany({
        where: { id: movimientoId, tipo: 'AJUSTE', estado: 'PENDIENTE' },
        data: { estado: 'RECHAZADO', resueltoPorId: usuario.id, resueltoEn: new Date(), motivoResolucion: motivo },
      });
      if (count !== 1) throw new ConflictoError('Este ajuste ya fue aprobado o rechazado.');

      return tx.movimiento.findUniqueOrThrow({ where: { id: movimientoId }, include: { lineas: true } });
    });
  }

  throw new ConflictoError('Este movimiento no se puede rechazar.');
}

export async function aprobarAjuste(usuario: UsuarioAuth, movimientoId: number) {
  if (!esAdmin(usuario)) throw new SinPermisoError('Solo un administrador puede aprobar ajustes.');

  const movimiento = await prisma.movimiento.findUnique({ where: { id: movimientoId }, include: { lineas: true } });
  if (!movimiento || movimiento.tipo !== 'AJUSTE') throw new NoEncontradoError('El ajuste no existe.');
  if (movimiento.creadoPorId === usuario.id) throw new SinPermisoError('No puedes aprobar tu propio ajuste.');

  return conUsuario(usuario.id, null, async (tx) => {
    const { count } = await tx.movimiento.updateMany({
      where: { id: movimientoId, tipo: 'AJUSTE', estado: 'PENDIENTE' },
      data: { estado: 'APROBADO', resueltoPorId: usuario.id, resueltoEn: new Date() },
    });
    if (count !== 1) throw new ConflictoError('Este ajuste ya fue aprobado o rechazado.');

    const efectos = efectosDesdeLineas(null, movimiento.sedeDestinoId, movimiento.lineas);
    await aplicarEfectos(tx, movimientoId, efectos, 'MOVER');

    return tx.movimiento.findUniqueOrThrow({ where: { id: movimientoId }, include: { lineas: true } });
  });
}

const ESTADO_ANULABLE: Record<string, string> = {
  TRASLADO: 'RECIBIDO',
  SALIDA: 'APLICADO',
  AJUSTE: 'APROBADO',
};

export async function anularMovimiento(usuario: UsuarioAuth, movimientoId: number, motivo: string) {
  if (!esAdmin(usuario)) throw new SinPermisoError('Solo un administrador puede anular movimientos.');

  const original = await prisma.movimiento.findUnique({ where: { id: movimientoId }, include: { lineas: true } });
  if (!original) throw new NoEncontradoError('El movimiento no existe.');

  const estadoRequerido = ESTADO_ANULABLE[original.tipo];
  if (!estadoRequerido) throw new ConflictoError('Este movimiento no se puede anular.');

  return conUsuario(usuario.id, motivo, async (tx) => {
    const { count } = await tx.movimiento.updateMany({
      where: { id: movimientoId, tipo: original.tipo, estado: estadoRequerido },
      data: { estado: 'ANULADO', resueltoPorId: usuario.id, resueltoEn: new Date(), motivoResolucion: motivo },
    });
    if (count !== 1) throw new ConflictoError('Este movimiento ya no está en un estado que se pueda anular.');

    let sedeOrigenId: number | null = null;
    let sedeDestinoId: number | null = null;
    let lineasAnulacion: { loteId: number; cantidad: number }[] = [];

    if (original.tipo === 'TRASLADO') {
      sedeOrigenId = original.sedeDestinoId;
      sedeDestinoId = original.sedeOrigenId;
      lineasAnulacion = original.lineas.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad }));
    } else if (original.tipo === 'SALIDA') {
      sedeOrigenId = null;
      sedeDestinoId = original.sedeOrigenId;
      lineasAnulacion = original.lineas.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad }));
    } else if (original.tipo === 'AJUSTE') {
      sedeOrigenId = null;
      sedeDestinoId = original.sedeDestinoId;
      lineasAnulacion = original.lineas.map((l) => ({ loteId: l.loteId, cantidad: -l.cantidad }));
    }

    const consecutivo = await siguienteConsecutivo(tx, 'ANULACION');
    const ahora = new Date();

    const anulacion = await tx.movimiento.create({
      data: {
        consecutivo,
        tipo: 'ANULACION',
        sedeOrigenId,
        sedeDestinoId,
        estado: 'APLICADO',
        anulaAId: original.id,
        creadoPorId: usuario.id,
        creadoEn: ahora,
        observacion: `Anula ${original.consecutivo}: ${motivo}`,
        lineas: { create: lineasAnulacion.map((l) => ({ loteId: l.loteId, cantidad: l.cantidad })) },
      },
      include: { lineas: true },
    });

    const efectos = efectosDesdeLineas(sedeOrigenId, sedeDestinoId, lineasAnulacion);
    await aplicarEfectos(tx, anulacion.id, efectos, 'ANULAR');

    return anulacion;
  });
}

export function banderasMovimiento(usuario: UsuarioAuth, m: { tipo: string; estado: string; sedeOrigenId: number | null; sedeDestinoId: number | null; creadoPorId: number }) {
  const admin = esAdmin(usuario);
  const operaDestino = m.sedeDestinoId ? puedeOperarSede(usuario, m.sedeDestinoId) : false;

  return {
    puedeConfirmar: m.tipo === 'TRASLADO' && m.estado === 'NO_CONFIRMADO' && operaDestino,
    puedeRechazar:
      (m.tipo === 'TRASLADO' && m.estado === 'NO_CONFIRMADO' && (operaDestino || admin)) ||
      (m.tipo === 'AJUSTE' && m.estado === 'PENDIENTE' && admin),
    puedeAprobar: m.tipo === 'AJUSTE' && m.estado === 'PENDIENTE' && admin && m.creadoPorId !== usuario.id,
    puedeAnular: admin && ESTADO_ANULABLE[m.tipo] === m.estado,
    puedeCrearDeNuevo: m.tipo === 'TRASLADO' && m.estado === 'RECHAZADO' && m.sedeOrigenId !== null && puedeOperarSede(usuario, m.sedeOrigenId),
  };
}

export function puedeVer(usuario: UsuarioAuth, m: { sedeOrigenId: number | null; sedeDestinoId: number | null }): boolean {
  return puedeVerMovimiento(usuario, m);
}

const incluirDetalle = {
  lineas: { include: { lote: { include: { producto: true } } } },
  sedeOrigen: true,
  sedeDestino: true,
  creadoPor: { select: { id: true, nombre: true } },
  resueltoPor: { select: { id: true, nombre: true } },
  anulaA: { select: { id: true, consecutivo: true } },
  anulaciones: { select: { id: true, consecutivo: true } },
} satisfies Prisma.MovimientoInclude;

/**
 * Auditoría de un movimiento y sus líneas: quién lo cambió, qué cambió y cuándo.
 * Es la única pantalla que lee `auditoria` — no hay un listado general.
 */
async function historialDeAuditoria(movimientoId: number, lineaIds: number[]) {
  const filas = await prisma.auditoria.findMany({
    where: {
      OR: [
        { tabla: 'movimiento', registroId: String(movimientoId) },
        { tabla: 'movimiento_linea', registroId: { in: lineaIds.map(String) } },
      ],
    },
    include: { usuario: { select: { id: true, nombre: true } } },
    orderBy: { fechaHora: 'asc' },
  });

  return filas.map((f) => ({
    id: f.id,
    fechaHora: f.fechaHora,
    usuario: f.usuario,
    tabla: f.tabla,
    registroId: f.registroId,
    accion: f.accion,
    motivo: f.motivo,
    antes: f.antes ? (JSON.parse(f.antes) as Record<string, unknown>) : null,
    despues: f.despues ? (JSON.parse(f.despues) as Record<string, unknown>) : null,
  }));
}

export async function obtenerMovimiento(usuario: UsuarioAuth, id: number) {
  const movimiento = await prisma.movimiento.findUnique({ where: { id }, include: incluirDetalle });
  if (!movimiento) throw new NoEncontradoError('El movimiento no existe.');
  if (!puedeVerMovimiento(usuario, movimiento)) throw new SinPermisoError('No puedes ver este movimiento.');

  const auditoria = await historialDeAuditoria(movimiento.id, movimiento.lineas.map((l) => l.id));

  return { ...movimiento, banderas: banderasMovimiento(usuario, movimiento), auditoria };
}

export type FiltrosMovimientos = {
  tipo?: string;
  estado?: string;
  sedeId?: number;
  desde?: string;
  hasta?: string;
  q?: string;
  page: number;
  pageSize: number;
};

export async function listarMovimientos(usuario: UsuarioAuth, filtros: FiltrosMovimientos) {
  const where: Prisma.MovimientoWhereInput = {};

  if (filtros.tipo) where.tipo = filtros.tipo;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.sedeId) where.OR = [{ sedeOrigenId: filtros.sedeId }, { sedeDestinoId: filtros.sedeId }];
  if (filtros.desde || filtros.hasta) {
    where.creadoEn = {
      ...(filtros.desde ? { gte: new Date(`${filtros.desde}T00:00:00.000Z`) } : {}),
      ...(filtros.hasta ? { lte: new Date(`${filtros.hasta}T23:59:59.999Z`) } : {}),
    };
  }
  if (filtros.q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ consecutivo: { contains: filtros.q } }, { documentoSoporte: { contains: filtros.q } }] },
    ];
  }

  if (!esAdmin(usuario)) {
    const sedeFiltro: Prisma.MovimientoWhereInput = {
      OR: [{ sedeOrigenId: { in: usuario.sedeIds } }, { sedeDestinoId: { in: usuario.sedeIds } }],
    };
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), sedeFiltro];
  }

  const [items, total] = await Promise.all([
    prisma.movimiento.findMany({
      where,
      include: { sedeOrigen: true, sedeDestino: true, creadoPor: { select: { id: true, nombre: true } } },
      orderBy: { creadoEn: 'desc' },
      skip: (filtros.page - 1) * filtros.pageSize,
      take: filtros.pageSize,
    }),
    prisma.movimiento.count({ where }),
  ]);

  return { items, total, page: filtros.page, pageSize: filtros.pageSize };
}

export async function porRecibir(usuario: UsuarioAuth) {
  const sedeIds = esAdmin(usuario) ? undefined : usuario.sedeIds;
  return prisma.movimiento.findMany({
    where: {
      tipo: 'TRASLADO',
      estado: 'NO_CONFIRMADO',
      ...(sedeIds ? { sedeDestinoId: { in: sedeIds } } : {}),
    },
    include: {
      sedeOrigen: true,
      sedeDestino: true,
      creadoPor: { select: { id: true, nombre: true } },
      lineas: true,
    },
    orderBy: { creadoEn: 'asc' },
  });
}

export async function porAprobar(usuario: UsuarioAuth) {
  if (!esAdmin(usuario)) throw new SinPermisoError('Solo un administrador puede ver las aprobaciones.');

  const movimientos = await prisma.movimiento.findMany({
    where: { tipo: 'AJUSTE', estado: 'PENDIENTE' },
    include: {
      sedeDestino: true,
      creadoPor: { select: { id: true, nombre: true } },
      lineas: { include: { lote: { include: { producto: true } } } },
    },
    orderBy: { creadoEn: 'asc' },
  });

  const loteIds = movimientos.flatMap((m) => m.lineas.map((l) => l.loteId));
  const sedeIds = [...new Set(movimientos.map((m) => m.sedeDestinoId!).filter(Boolean))];
  const saldosActuales = await prisma.saldo.findMany({
    where: { loteId: { in: loteIds }, sedeId: { in: sedeIds } },
  });
  const saldoMap = new Map(saldosActuales.map((s) => [`${s.sedeId}-${s.loteId}`, s.cantidad]));

  return movimientos.map((m) => ({
    ...m,
    puedeAprobar: m.creadoPorId !== usuario.id,
    lineas: m.lineas.map((l) => ({
      ...l,
      saldoActual: saldoMap.get(`${m.sedeDestinoId}-${l.loteId}`) ?? 0,
    })),
  }));
}
