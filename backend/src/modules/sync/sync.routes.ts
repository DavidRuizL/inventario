import { Router } from 'express';
import { requireAuth, requireRol } from '../../shared/middleware/auth';
import { AuthRequest } from '../../shared/types';
import { config } from '../../config';
import * as service from './sync.service';

const router = Router();
router.use(requireAuth, requireRol('ADMIN', 'SUPERADMIN'));

router.get('/', async (_req, res, next) => {
  try {
    res.json({ habilitada: !!config.ERP_DB, intervaloMin: config.SYNC_INTERVAL_MIN, corridas: await service.ultimasCorridas() });
  } catch (err) {
    next(err);
  }
});

router.post('/ahora', async (req: AuthRequest, res, next) => {
  try {
    res.status(202).json(await service.sincronizar(req.usuario!.id));
  } catch (err) {
    next(err);
  }
});

export default router;
