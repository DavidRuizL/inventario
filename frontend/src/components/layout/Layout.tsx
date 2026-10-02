import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Boxes,
  History,
  ArrowLeftRight,
  LogOut as LogOutIcon,
  PackageMinus,
  ClipboardList,
  Inbox,
  CheckSquare,
  ListChecks,
  Users,
  Building2,
  RefreshCw,
  Menu,
  X,
  KeyRound,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Logo } from './Logo';
import { useAuth, esAdmin, esSuperAdmin } from '../../lib/auth';
import { api } from '../../lib/api';

interface ItemNav {
  to: string;
  label: string;
  icon: ReactNode;
  visible: boolean;
  contador?: number;
}

export function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const { data: contadores } = useQuery({
    queryKey: ['contadores-nav'],
    queryFn: async () => {
      const { data } = await api.get('/inicio');
      return { porRecibir: data.porRecibir.total as number, porAprobar: data.porAprobar.total as number };
    },
    refetchInterval: 60_000,
    enabled: !!usuario,
  });

  const admin = esAdmin(usuario);
  const superadmin = esSuperAdmin(usuario);

  const itemsMovimientos: ItemNav[] = [
    { to: '/traslados/nuevo', label: 'Nuevo traslado', icon: <ArrowLeftRight className="h-4 w-4" />, visible: true },
    { to: '/salidas/nueva', label: 'Nueva salida', icon: <PackageMinus className="h-4 w-4" />, visible: true },
    { to: '/ajustes/nuevo', label: 'Nuevo ajuste', icon: <ClipboardList className="h-4 w-4" />, visible: true },
    { to: '/por-recibir', label: 'Por recibir', icon: <Inbox className="h-4 w-4" />, visible: true, contador: contadores?.porRecibir },
    { to: '/aprobaciones', label: 'Aprobaciones', icon: <CheckSquare className="h-4 w-4" />, visible: admin, contador: contadores?.porAprobar },
    { to: '/movimientos', label: 'Todos los movimientos', icon: <ListChecks className="h-4 w-4" />, visible: true },
  ].filter((i) => i.visible);

  const itemsAntes: ItemNav[] = [
    { to: '/', label: 'Inicio', icon: <LayoutDashboard className="h-4 w-4" />, visible: true },
    { to: '/inventario', label: 'Inventario', icon: <Boxes className="h-4 w-4" />, visible: true },
  ];

  const itemsDespues: ItemNav[] = [
    { to: '/kardex', label: 'Historial', icon: <History className="h-4 w-4" />, visible: true },
    { to: '/admin/usuarios', label: 'Usuarios', icon: <Users className="h-4 w-4" />, visible: superadmin },
    { to: '/admin/sedes', label: 'Sedes', icon: <Building2 className="h-4 w-4" />, visible: superadmin },
    { to: '/sync', label: 'Sincronización ERP', icon: <RefreshCw className="h-4 w-4" />, visible: admin },
  ];

  const contadorMovimientos = (contadores?.porRecibir ?? 0) + (admin ? contadores?.porAprobar ?? 0 : 0);

  async function salir() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 px-5 py-4">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {itemsAntes.filter((i) => i.visible).map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
          <GrupoMovimientos items={itemsMovimientos} contadorTotal={contadorMovimientos} />
          {itemsDespues.filter((i) => i.visible).map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>
        <PiePerfil nombre={usuario?.nombre} rol={usuario?.rol} onSalir={salir} />
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuAbierto(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <Logo />
              <button onClick={() => setMenuAbierto(false)}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
              {itemsAntes.filter((i) => i.visible).map((item) => (
                <NavItem key={item.to} item={item} onNavegar={() => setMenuAbierto(false)} />
              ))}
              <GrupoMovimientos items={itemsMovimientos} contadorTotal={contadorMovimientos} onNavegar={() => setMenuAbierto(false)} />
              {itemsDespues.filter((i) => i.visible).map((item) => (
                <NavItem key={item.to} item={item} onNavegar={() => setMenuAbierto(false)} />
              ))}
            </nav>
            <PiePerfil nombre={usuario?.nombre} rol={usuario?.rol} onSalir={salir} onNavegar={() => setMenuAbierto(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setMenuAbierto(true)}>
            <Menu className="h-6 w-6 text-slate-600" />
          </button>
          <Logo tamano={28} />
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ item, onNavegar }: { item: ItemNav; onNavegar?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onNavegar}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <span className="flex items-center gap-2.5">
        {item.icon}
        {item.label}
      </span>
      {!!item.contador && (
        <span className="rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.contador}</span>
      )}
    </NavLink>
  );
}

function GrupoMovimientos({
  items,
  contadorTotal,
  onNavegar,
}: {
  items: ItemNav[];
  contadorTotal: number;
  onNavegar?: () => void;
}) {
  const location = useLocation();
  const hayActivo = items.some((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`));
  const [manualAbierto, setManualAbierto] = useState<boolean | null>(null);
  const abierto = manualAbierto ?? hayActivo;

  return (
    <div>
      <button
        onClick={() => setManualAbierto(!abierto)}
        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          hayActivo ? 'text-primary-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <ListChecks className="h-4 w-4" />
          Movimientos
        </span>
        <span className="flex items-center gap-1.5">
          {!abierto && !!contadorTotal && (
            <span className="rounded-full bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{contadorTotal}</span>
          )}
          {abierto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>
      {abierto && (
        <div className="mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
          {items.map((item) => (
            <NavItem key={item.to} item={item} onNavegar={onNavegar} />
          ))}
        </div>
      )}
    </div>
  );
}

function PiePerfil({
  nombre,
  rol,
  onSalir,
  onNavegar,
}: {
  nombre?: string;
  rol?: string;
  onSalir: () => void;
  onNavegar?: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  return (
    <div ref={ref} className="relative border-t border-slate-100 p-3">
      {abierto && (
        <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <NavLink
            to="/cambiar-clave"
            onClick={() => {
              setAbierto(false);
              onNavegar?.();
            }}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <KeyRound className="h-4 w-4" /> Cambiar clave
          </NavLink>
          <button
            onClick={() => {
              setAbierto(false);
              onSalir();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
          >
            <LogOutIcon className="h-4 w-4" /> Salir
          </button>
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-100"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-700">{nombre}</div>
          <div className="text-xs text-slate-400">{rol}</div>
        </div>
        <ChevronUp className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${abierto ? '' : 'rotate-180'}`} />
      </button>
    </div>
  );
}
