import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { validar } from '../../shared/validate';
import { AuthRequest } from '../../shared/types';
import {
  anularSchema,
  crearAjusteSchema,
  crearSalidaSchema,
  crearTrasladoSchema,
  listarMovimientosSchema,
  rechazarSchema,
} from './movimientos.schemas';
import * as service from './movimientos.service';

const router = Router();
router.use(requireAuth);

router.get('/por-recibir', async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.porRecibir(req.usuario!));
  } catch (err) {
    next(err);
  }
});

router.get('/por-aprobar', async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.porAprobar(req.usuario!));
  } catch (err) {
    next(err);
  }
});

router.get('/', validar(listarMovimientosSchema, 'query'), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.listarMovimientos(req.usuario!, req.query as never));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.obtenerMovimiento(req.usuario!, Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.post('/traslados', validar(crearTrasladoSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await service.crearTraslado(req.usuario!, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/salidas', validar(crearSalidaSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await service.crearSalida(req.usuario!, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/ajustes', validar(crearAjusteSchema), async (req: AuthRequest, res, next) => {
  try {
    res.status(201).json(await service.crearAjuste(req.usuario!, req.body));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/confirmar', async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.confirmarTraslado(req.usuario!, Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/rechazar', validar(rechazarSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.rechazarMovimiento(req.usuario!, Number(req.params.id), req.body.motivo));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/aprobar', async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.aprobarAjuste(req.usuario!, Number(req.params.id)));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/anular', validar(anularSchema), async (req: AuthRequest, res, next) => {
  try {
    res.json(await service.anularMovimiento(req.usuario!, Number(req.params.id), req.body.motivo));
  } catch (err) {
    next(err);
  }
});

export default router;
