import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { validar } from '../../shared/validate';
import { buscarLotesSchema, buscarProductosSchema, resolverSchema } from './catalogo.schemas';
import * as service from './catalogo.service';

const router = Router();
router.use(requireAuth);

router.get('/productos', validar(buscarProductosSchema, 'query'), async (req, res, next) => {
  try {
    res.json(await service.buscarProductos((req.query as unknown as { q: string }).q));
  } catch (err) {
    next(err);
  }
});

router.get('/lotes', validar(buscarLotesSchema, 'query'), async (req, res, next) => {
  try {
    const { productoId, q } = req.query as unknown as { productoId: number; q: string };
    res.json(await service.buscarLotes(productoId, q));
  } catch (err) {
    next(err);
  }
});

router.get('/marcas', async (_req, res, next) => {
  try {
    res.json(await service.marcas());
  } catch (err) {
    next(err);
  }
});

router.post('/resolver', validar(resolverSchema), async (req, res, next) => {
  try {
    res.json(await service.resolver(req.body.filas));
  } catch (err) {
    next(err);
  }
});

export default router;
