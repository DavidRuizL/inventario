import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { conUsuario, prisma } from '../../db';
import { ConflictoError, NoEncontradoError, ValidacionError } from '../../shared/errors';
import { Rol } from '../../shared/types';

const SELECT_SEGURO = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  creadoEn: true,
  sedes: { select: { sede: { select: { id: true, codigo: true, nombre: true } } } },
} as const;

export async function listar() {
  const usuarios = await prisma.usuario.findMany({ select: SELECT_SEGURO, orderBy: { nombre: 'asc' } });
  return usuarios.map((u) => ({ ...u, sedes: u.sedes.map((s) => s.sede) }));
}

export async function crear(
  actorId: number,
  data: { email: string; nombre: string; rol: Rol; clave: string; sedeIds: number[] },
) {
  const claveHash = await bcrypt.hash(data.clave, 10);
  return conUsuario(actorId, 'Creación de usuario', async (tx) => {
    const usuario = await tx.usuario.create({
      data: {
        email: data.email,
        nombre: data.nombre,
        rol: data.rol,
        claveHash,
        creadoEn: new Date(),
        sedes: { create: data.sedeIds.map((sedeId) => ({ sedeId })) },
      },
      select: SELECT_SEGURO,
    });
    return { ...usuario, sedes: usuario.sedes.map((s) => s.sede) };
  });
}

export async function actualizar(
  actorId: number,
  id: number,
  data: { nombre?: string; rol?: Rol; activo?: boolean; motivo?: string },
) {
  const existente = await prisma.usuario.findUnique({ where: { id } });
  if (!existente) throw new NoEncontradoError('El usuario no existe.');

  const { motivo, ...cambios } = data;
  if (Object.keys(cambios).length === 0) return existente;

  return conUsuario(actorId, motivo ?? null, async (tx) => {
    const { count } = await tx.usuario.updateMany({ where: { id }, data: cambios });
    if (count !== 1) throw new ConflictoError('El usuario cambió mientras se editaba.');
    const actualizado = await tx.usuario.findUniqueOrThrow({ where: { id }, select: SELECT_SEGURO });
    return { ...actualizado, sedes: actualizado.sedes.map((s) => s.sede) };
  });
}

export async function asignarSedes(actorId: number, id: number, sedeIds: number[]) {
  const existente = await prisma.usuario.findUnique({ where: { id } });
  if (!existente) throw new NoEncontradoError('El usuario no existe.');

  return conUsuario(actorId, 'Asignación de sedes', async (tx) => {
    await tx.usuarioSede.deleteMany({ where: { usuarioId: id } });
    if (sedeIds.length > 0) {
      await tx.usuarioSede.createMany({ data: sedeIds.map((sedeId) => ({ usuarioId: id, sedeId })) });
    }
    const actualizado = await tx.usuario.findUniqueOrThrow({ where: { id }, select: SELECT_SEGURO });
    return { ...actualizado, sedes: actualizado.sedes.map((s) => s.sede) };
  });
}

export async function restablecerClave(actorId: number, id: number): Promise<{ claveTemporal: string }> {
  const existente = await prisma.usuario.findUnique({ where: { id } });
  if (!existente) throw new NoEncontradoError('El usuario no existe.');

  const claveTemporal = crypto.randomBytes(6).toString('base64url');
  const claveHash = await bcrypt.hash(claveTemporal, 10);

  await conUsuario(actorId, 'Restablecer clave', async (tx) => {
    await tx.usuario.update({ where: { id }, data: { claveHash } });
  });

  return { claveTemporal };
}
