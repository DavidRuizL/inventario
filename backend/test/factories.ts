import bcrypt from 'bcryptjs';
import { prisma, conUsuario } from '../src/db';
import { aplicarEfectos } from '../src/core/saldo';
import { siguienteConsecutivo } from '../src/core/consecutivo';
import { Rol, UsuarioAuth } from '../src/shared/types';

let contador = 0;
function unico(prefijo: string): string {
  contador += 1;
  return `${prefijo}${Date.now().toString(36)}${contador}`;
}

export const CLAVE_PRUEBA = 'Clave123!';

export async function crearSede(opts: { controlaSaldo?: boolean } = {}) {
  const codigo = unico('S').slice(0, 10).toUpperCase();
  return prisma.sede.create({ data: { codigo, nombre: `Sede ${codigo}`, controlaSaldo: opts.controlaSaldo ?? true } });
}

export async function crearUsuario(rol: Rol, sedeIds: number[] = []) {
  const email = `${unico('u')}@test.local`;
  const claveHash = await bcrypt.hash(CLAVE_PRUEBA, 4);
  return prisma.usuario.create({
    data: {
      email,
      nombre: `Usuario ${email}`,
      claveHash,
      rol,
      creadoEn: new Date(),
      sedes: { create: sedeIds.map((sedeId) => ({ sedeId })) },
    },
  });
}

export function authDe(usuario: { id: number; email: string; nombre: string; rol: string }, sedeIds: number[] = []): UsuarioAuth {
  return { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol as Rol, sedeIds };
}

export async function crearProducto(data: Partial<{ codigo: string; descripcion: string; origen: string }> = {}) {
  const codigo = data.codigo ?? unico('P');
  return prisma.producto.create({
    data: { codigo, descripcion: data.descripcion ?? `Producto ${codigo}`, origen: data.origen ?? 'MANUAL', creadoEn: new Date() },
  });
}

export async function crearLote(productoId?: number) {
  const producto = productoId ? { id: productoId } : await crearProducto();
  const nroLote = unico('L');
  return prisma.lote.create({ data: { productoId: producto.id, nroLote, origen: 'MANUAL', creadoEn: new Date() } });
}

/** Da saldo inicial a una sede mediante un ajuste real (aplicarEfectos), para no romper el invariante saldo = SUM(kardex). */
export async function darSaldoInicial(sedeId: number, loteId: number, cantidad: number, creadoPorId: number) {
  await conUsuario(creadoPorId, 'Saldo inicial de prueba', async (tx) => {
    const consecutivo = await siguienteConsecutivo(tx, 'AJUSTE');
    const movimiento = await tx.movimiento.create({
      data: {
        consecutivo,
        tipo: 'AJUSTE',
        motivo: 'CONTEO_FISICO',
        sedeDestinoId: sedeId,
        estado: 'APROBADO',
        creadoPorId,
        creadoEn: new Date(),
        resueltoPorId: creadoPorId,
        resueltoEn: new Date(),
        lineas: { create: [{ loteId, cantidad, saldoSistema: 0, conteo: cantidad }] },
      },
    });
    await aplicarEfectos(tx, movimiento.id, [{ sedeId, loteId, cantidad }], 'MOVER');
  });
}

/** P19: saldo.cantidad debe ser siempre SUM(kardex.cantidad) por (sede, lote). */
export async function verificarInvariante(sedeId?: number): Promise<void> {
  const saldos = await prisma.saldo.findMany({ where: sedeId ? { sedeId } : {} });
  for (const s of saldos) {
    const agregado = await prisma.kardex.aggregate({
      where: { sedeId: s.sedeId, loteId: s.loteId },
      _sum: { cantidad: true },
    });
    const total = agregado._sum.cantidad ?? 0;
    if (total !== s.cantidad) {
      throw new Error(`Invariante violado: saldo(sede=${s.sedeId}, lote=${s.loteId}) = ${s.cantidad} pero SUM(kardex) = ${total}`);
    }
  }
}
