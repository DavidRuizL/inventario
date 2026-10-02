import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { AuthRequest } from '../../shared/types';
import { prisma } from '../../db';
import { esAdmin } from '../../core/permisos';
import * as movimientosService from '../movimientos/movimientos.service';
import * as inventarioService from '../inventario/inventario.service';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const usuario = req.usuario!;
    const admin = esAdmin(usuario);

    const [porRecibir, porAprobar, ultimosMovimientos, porVencer] = await Promise.all([
      movimientosService.porRecibir(usuario),
      admin ? movimientosService.porAprobar(usuario) : Promise.resolve([]),
      prisma.movimiento.findMany({
        where: admin ? {} : { OR: [{ sedeOrigenId: { in: usuario.sedeIds } }, { sedeDestinoId: { in: usuario.sedeIds } }] },
        include: { sedeOrigen: true, sedeDestino: true, creadoPor: { select: { id: true, nombre: true } } },
        orderBy: { creadoEn: 'desc' },
        take: 10,
      }),
      inventarioService.porVencer(usuario, 90),
    ]);

    res.json({
      porRecibir: { total: porRecibir.length, items: porRecibir.slice(0, 5) },
      porAprobar: { total: porAprobar.length, items: porAprobar.slice(0, 5) },
      ultimosMovimientos,
      porVencer: { total: porVencer.length, items: porVencer.slice(0, 10) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
