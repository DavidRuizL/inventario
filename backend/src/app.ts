import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { errorHandler } from './shared/middleware/error';
import { config } from './config';

import authRoutes from './modules/auth/auth.routes';
import sedesRoutes from './modules/sedes/sedes.routes';
import usuariosRoutes from './modules/usuarios/usuarios.routes';
import catalogoRoutes from './modules/catalogo/catalogo.routes';
import movimientosRoutes from './modules/movimientos/movimientos.routes';
import inventarioRoutes from './modules/inventario/inventario.routes';
import kardexRoutes from './modules/kardex/kardex.routes';
import inicioRoutes from './modules/inicio/inicio.routes';
import syncRoutes from './modules/sync/sync.routes';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/sedes', sedesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/movimientos', movimientosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/kardex', kardexRoutes);
app.use('/api/inicio', inicioRoutes);
app.use('/api/sync', syncRoutes);

if (config.NODE_ENV === 'production') {
  const distDir = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use(errorHandler);

export default app;
