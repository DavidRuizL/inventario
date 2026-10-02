import { createBrowserRouter } from 'react-router';
import { Layout } from './components/layout/Layout';
import { RequireAuth } from './lib/auth';
import { Login } from './pages/Login';
import { Inicio } from './pages/Inicio';
import { Inventario } from './pages/Inventario';
import { Kardex } from './pages/Kardex';
import { NuevoTraslado } from './pages/traslados/NuevoTraslado';
import { NuevaSalida } from './pages/salidas/NuevaSalida';
import { NuevoAjuste } from './pages/ajustes/NuevoAjuste';
import { PorRecibir } from './pages/PorRecibir';
import { Aprobaciones } from './pages/Aprobaciones';
import { Movimientos } from './pages/movimientos/Movimientos';
import { MovimientoDetalle } from './pages/movimientos/MovimientoDetalle';
import { Usuarios } from './pages/admin/Usuarios';
import { Sedes } from './pages/admin/Sedes';
import { Sync } from './pages/Sync';
import { CambiarClave } from './pages/CambiarClave';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Inicio /> },
      { path: 'inventario', element: <Inventario /> },
      { path: 'kardex', element: <Kardex /> },
      { path: 'traslados/nuevo', element: <NuevoTraslado /> },
      { path: 'salidas/nueva', element: <NuevaSalida /> },
      { path: 'ajustes/nuevo', element: <NuevoAjuste /> },
      { path: 'por-recibir', element: <PorRecibir /> },
      { path: 'aprobaciones', element: <RequireAuth roles={['ADMIN', 'SUPERADMIN']}><Aprobaciones /></RequireAuth> },
      { path: 'movimientos', element: <Movimientos /> },
      { path: 'movimientos/:id', element: <MovimientoDetalle /> },
      { path: 'admin/usuarios', element: <RequireAuth roles={['SUPERADMIN']}><Usuarios /></RequireAuth> },
      { path: 'admin/sedes', element: <RequireAuth roles={['SUPERADMIN']}><Sedes /></RequireAuth> },
      { path: 'sync', element: <RequireAuth roles={['ADMIN', 'SUPERADMIN']}><Sync /></RequireAuth> },
      { path: 'cambiar-clave', element: <CambiarClave /> },
    ],
  },
]);
