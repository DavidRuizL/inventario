import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { validar } from '../../shared/validate';
import { AuthRequest } from '../../shared/types';
import { disponibleSchema, inventarioSchema, porVencerSchema } from './inventario.schemas';
import * as service from './inventario.service';

const router = Router();
router.use(requireAuth);

router.get('/disponible', validar(disponibleSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    const { sedeId, q } = req.query as unknown as { sedeId: number; q: string };
    res.json(await service.disponible(req.usuario!, sedeId, q));
  } catch (err) {
    next(err);
  }
});

router.get('/por-vencer', validar(porVencerSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    const { dias, sedeId } = req.query as unknown as { dias: number; sedeId?: number };
    res.json(await service.porVencer(req.usuario!, dias, sedeId));
  } catch (err) {
    next(err);
  }
});

router.get('/export.xlsx', validar(inventarioSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    const filtros = req.query as unknown as { sedeId?: number; q?: string; marca?: string; lote?: string };
    const buffer = await service.exportarExcel(req.usuario!, filtros);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="inventario.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});

router.get('/', validar(inventarioSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.listar(req.usuario!, req.query as never));
  } catch (err) {
    next(err);
  }
});

export default router;
