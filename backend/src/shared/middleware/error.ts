import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json(err.toJSON());
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con ese valor.' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'No se encontró el registro.' } });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado.' } });
}
