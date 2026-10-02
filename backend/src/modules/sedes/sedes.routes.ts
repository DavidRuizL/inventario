import { Router } from 'express';
import { requireAuth, requireRol } from '../../shared/middleware/auth';
import { validar } from '../../shared/validate';
import { AuthRequest } from '../../shared/types';
import { actualizarSedeSchema, crearSedeSchema, listarSedesSchema } from './sedes.schemas';
import * as service from './sedes.service';

const router = Router();
router.use(requireAuth);

router.get('/', validar(listarSedesSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    const { incluirInactivas } = req.query as unknown as { incluirInactivas: boolean };
    res.json(await service.listar(req.usuario!, incluirInactivas));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRol('SUPERADMIN'), validar(crearSedeSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await service.crear(req.usuario!.id, req.body));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireRol('SUPERADMIN'), validar(actualizarSedeSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.actualizar(req.usuario!.id, Number(req.params.id), req.body));
  } catch (err) {
    next(err);
  }
});

export default router;
