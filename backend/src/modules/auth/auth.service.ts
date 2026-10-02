import bcrypt from 'bcryptjs';
import { prisma, conUsuario } from '../../db';
import { ApiError, NoAutenticadoError, ValidacionError } from '../../shared/errors';
import { Rol, UsuarioAuth } from '../../shared/types';

const VENTANA_BLOQUEO_MIN = 15;
const MAX_INTENTOS = 5;

async function demasiadosIntentos(email: string): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_BLOQUEO_MIN * 60 * 1000);
  const intentos = await prisma.auditoria.count({
    where: { accion: 'LOGIN_FALLIDO', registroId: email, fechaHora: { gte: desde } },
  });
  return intentos >= MAX_INTENTOS;
}

export async function login(email: string, clave: string): Promise<{ id: number; usuario: UsuarioAuth }> {
  if (await demasiadosIntentos(email)) {
    throw new ApiError(401, 'DEMASIADOS_INTENTOS', 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.');
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { sedes: { select: { sedeId: true } } },
  });

  const coincide = usuario ? await bcrypt.compare(clave, usuario.claveHash) : false;

  if (!usuario || !usuario.activo || !coincide) {
    await prisma.auditoria.create({
      data: { fechaHora: new Date(), tabla: 'usuario', registroId: email, accion: 'LOGIN_FALLIDO' },
    });
    throw new NoAutenticadoError('Correo o clave incorrectos.');
  }

  await prisma.auditoria.create({
    data: { fechaHora: new Date(), usuarioId: usuario.id, tabla: 'usuario', registroId: email, accion: 'LOGIN' },
  });

  return {
    id: usuario.id,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol as Rol,
      sedeIds: usuario.sedes.map((s) => s.sedeId),
    },
  };
}

export async function cambiarClave(usuarioId: number, actual: string, nueva: string): Promise<void> {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const coincide = await bcrypt.compare(actual, usuario.claveHash);
  if (!coincide) throw new ValidacionError('La clave actual no es correcta.');

  const claveHash = await bcrypt.hash(nueva, 10);
  await conUsuario(usuarioId, 'Cambio de clave por el usuario', async (tx) => {
    await tx.usuario.update({ where: { id: usuarioId }, data: { claveHash } });
  });
}
