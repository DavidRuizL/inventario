import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { validar } from '../../shared/validate';
import { AuthRequest } from '../../shared/types';
import { kardexSchema } from './kardex.schemas';
import * as service from './kardex.service';

const router = Router();
router.use(requireAuth);

router.get('/export.xlsx', validar(kardexSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    const filtros = req.query as unknown as { loteId?: number; sedeId?: number; productoId?: number };
    const buffer = await service.exportarExcel(req.usuario!, filtros);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="kardex.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

router.get('/', validar(kardexSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.listar(req.usuario!, req.query as never));
  } catch (err) {
    next(err);
  }
});

export default router;
