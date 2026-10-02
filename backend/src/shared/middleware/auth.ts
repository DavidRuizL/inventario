import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db';
import { config } from '../../config';
import { AuthRequest, SesionPayload, Rol } from '../types';
import { NoAutenticadoError, SinPermisoError } from '../errors';

const COOKIE_NAME = 'sesion';

export function firmarToken(usuarioId: number): string {
  return jwt.sign({ sub: usuarioId } satisfies SesionPayload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function ponerCookieSesion(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

export function borrarCookieSesion(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Lee el JWT de la cookie y carga el usuario y sus sedes desde la base en cada
 * petición: si lo desactivan o le quitan una sede, aplica de inmediato.
 */
export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw new NoAutenticadoError();

    let payload: SesionPayload;
    try {
      payload = jwt.verify(token, config.JWT_SECRET) as unknown as SesionPayload;
    } catch {
      throw new NoAutenticadoError('Sesión inválida o vencida.');
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { sedes: { select: { sedeId: true } } },
    });

    if (!usuario || !usuario.activo) {
      throw new NoAutenticadoError('Tu usuario está inactivo.');
    }

    req.usuario = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol as Rol,
      sedeIds: usuario.sedes.map((s) => s.sedeId),
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRol(...roles: Rol[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      next(new NoAutenticadoError());
      return;
    }
    if (!roles.includes(req.usuario.rol)) {
      next(new SinPermisoError());
      return;
    }
    next();
  };
}
