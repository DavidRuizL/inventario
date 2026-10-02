import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidacionError } from './errors';

type Fuente = 'body' | 'query' | 'params';

export function validar(schema: ZodSchema, fuente: Fuente = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const resultado = schema.safeParse(req[fuente]);
    if (!resultado.success) {
      const detalles = resultado.error.issues.map((i) => ({
        campo: i.path.join('.'),
        mensaje: i.message,
      }));
      next(new ValidacionError('Datos inválidos.', detalles));
      return;
    }
    if (fuente === 'query') {
      // Express 5 define `req.query` como getter sin setter (se deriva de req.url),
      // así que una asignación directa lanza TypeError. Hay que reemplazar la
      // propiedad del objeto request en sí.
      Object.defineProperty(req, 'query', { value: resultado.data, writable: true, configurable: true, enumerable: true });
    } else {
      (req as Request & Record<string, unknown>)[fuente] = resultado.data;
    }
    next();
  };
}
