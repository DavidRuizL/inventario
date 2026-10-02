import { Router } from 'express';
import { requireAuth, requireRol } from '../../shared/middleware/auth';
import { validar } from '../../shared/validate';
import { AuthRequest } from '../../shared/types';
import { actualizarUsuarioSchema, asignarSedesSchema, crearUsuarioSchema } from './usuarios.schemas';
import * as service from './usuarios.service';

const router = Router();
router.use(requireAuth, requireRol('SUPERADMIN'));

router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.listar());
  } catch (err) {
    next(err);
  }
});

router.post('/', validar(crearUsuarioSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await service.crear(req.usuario!.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validar(actualizarUsuarioSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.actualizar(req.usuario!.id, Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

router.put('/:id/sedes', validar(asignarSedesSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.asignarSedes(req.usuario!.id, Number(req.params.id), req.body.sedeIds));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/restablecer-clave', async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.restablecerClave(req.usuario!.id, Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

export default router;
