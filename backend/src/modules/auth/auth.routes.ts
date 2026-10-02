import { Router } from 'express';
import { validar } from '../../shared/validate';
import { requireAuth, firmarToken, ponerCookieSesion, borrarCookieSesion } from '../../shared/middleware/auth';
import { AuthRequest } from '../../shared/types';
import { cambiarClaveSchema, loginSchema } from './auth.schemas';
import * as service from './auth.service';

const router = Router();

router.post('/login', validar(loginSchema), async (req, res, next) => {
  try {
    const { email, clave } = req.body;
    const { id, usuario } = await service.login(email, clave);
    ponerCookieSesion(res, firmarToken(id));
    res.json({ usuario });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  borrarCookieSesion(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ usuario: req.usuario });
});

router.post('/cambiar-clave', requireAuth, validar(cambiarClaveSchema), async (req: AuthRequest, res, next) => {
  try {
    await service.cambiarClave(req.usuario!.id, req.body.actual, req.body.nueva);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
