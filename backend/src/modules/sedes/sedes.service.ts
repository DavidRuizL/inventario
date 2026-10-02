import { conUsuario, prisma } from '../../db';
import { ConflictoError, NoEncontradoError, ReglaError } from '../../shared/errors';
import { UsuarioAuth } from '../../shared/types';
import { esSuperAdmin } from '../../core/permisos';

export async function listar(usuario: UsuarioAuth, incluirInactivas: boolean) {
  const todas = incluirInactivas && esSuperAdmin(usuario);
  return prisma.sede.findMany({
    where: todas ? {} : { activo: true },
    orderBy: { nombre: 'asc' },
  });
}

export async function crear(usuarioId: number, data: { codigo: string; nombre: string; controlaSaldo: boolean }) {
  return conUsuario(usuarioId, null, (tx) =>
    tx.sede.create({ data: { codigo: data.codigo, nombre: data.nombre, controlaSaldo: data.controlaSaldo } }),
  );
}

export async function actualizar(usuarioId: number, id: number, data: { nombre?: string; activo?: boolean }) {
  const sede = await prisma.sede.findUnique({ where: { id } });
  if (!sede) throw new NoEncontradoError('La sede no existe.');

  if (data.activo === false && sede.activo) {
    const [conSaldo, conPendientes] = await Promise.all([
      prisma.saldo.count({ where: { sedeId: id, cantidad: { gt: 0 } } }),
      prisma.movimiento.count({
        where: { estado: 'NO_CONFIRMADO', OR: [{ sedeOrigenId: id }, { sedeDestinoId: id }] },
      }),
    ]);
    if (conSaldo > 0) throw new ReglaError('No se puede desactivar: la sede todavía tiene saldo.');
    if (conPendientes > 0) throw new ReglaError('No se puede desactivar: la sede tiene traslados sin confirmar.');
  }

  return conUsuario(usuarioId, null, async (tx) => {
    const { count } = await tx.sede.updateMany({ where: { id }, data });
    if (count !== 1) throw new ConflictoError('La sede cambió mientras se editaba.');
    return tx.sede.findUniqueOrThrow({ where: { id } });
  });
}
