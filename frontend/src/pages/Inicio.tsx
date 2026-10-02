import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Inbox, CheckSquare, AlertTriangle, History } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { BadgeEstado, BadgeTipo } from '../components/ui/Badge';
import { api } from '../lib/api';
import { useAuth, esAdmin } from '../lib/auth';
import { fechaHora, fecha, numero, diasHasta } from '../lib/formato';

interface Resumen {
  porRecibir: { total: number; items: any[] };
  porAprobar: { total: number; items: any[] };
  ultimosMovimientos: any[];
  porVencer: { total: number; items: any[] };
}

export function Inicio() {
  const { usuario } = useAuth();
  const admin = esAdmin(usuario);

  const { data, isLoading } = useQuery<Resumen>({
    queryKey: ['inicio'],
    queryFn: async () => (await api.get('/inicio')).data,
  });

  return (
    <div>
      <PageHeader titulo={`Hola, ${usuario?.nombre?.split(' ')[0] ?? ''}`} descripcion="Resumen de lo que necesita tu atención." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaResumen icono={<Inbox className="h-5 w-5" />} titulo="Por recibir" valor={data?.porRecibir.total} color="bg-warning-100 text-warning-700" />
        {admin && (
          <TarjetaResumen icono={<CheckSquare className="h-5 w-5" />} titulo="Ajustes por aprobar" valor={data?.porAprobar.total} color="bg-info-100 text-info-700" />
        )}
        <TarjetaResumen icono={<AlertTriangle className="h-5 w-5" />} titulo="Por vencer (90 días)" valor={data?.porVencer.total} color="bg-danger-100 text-danger-700" />
        <TarjetaResumen icono={<History className="h-5 w-5" />} titulo="Movimientos recientes" valor={data?.ultimosMovimientos.length} color="bg-primary-100 text-primary-700" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader titulo="Traslados por recibir" accion={<Link to="/por-recibir" className="text-xs font-medium text-primary-700">Ver todos</Link>} />
          <CardBody className="space-y-2">
            {isLoading && <p className="text-sm text-slate-400">Cargando…</p>}
            {!isLoading && data?.porRecibir.items.length === 0 && <p className="text-sm text-slate-400">No hay traslados pendientes de recibir.</p>}
            {data?.porRecibir.items.map((m) => (
              <Link key={m.id} to={`/movimientos/${m.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                <span>
                  <span className="font-medium text-slate-700">{m.consecutivo}</span>
                  <span className="ml-2 text-slate-400">{m.sedeOrigen?.nombre} → {m.sedeDestino?.nombre}</span>
                </span>
                <span className="text-xs text-slate-400">{fechaHora(m.creadoEn)}</span>
              </Link>
            ))}
          </CardBody>
        </Card>

        {admin && (
          <Card>
            <CardHeader titulo="Ajustes por aprobar" accion={<Link to="/aprobaciones" className="text-xs font-medium text-primary-700">Ver todos</Link>} />
            <CardBody className="space-y-2">
              {!isLoading && data?.porAprobar.items.length === 0 && <p className="text-sm text-slate-400">No hay ajustes pendientes.</p>}
              {data?.porAprobar.items.map((m: any) => (
                <Link key={m.id} to={`/movimientos/${m.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                  <span>
                    <span className="font-medium text-slate-700">{m.consecutivo}</span>
                    <span className="ml-2 text-slate-400">{m.sedeDestino?.nombre}</span>
                  </span>
                  <span className="text-xs text-slate-400">{fechaHora(m.creadoEn)}</span>
                </Link>
              ))}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader titulo="Últimos movimientos" accion={<Link to="/movimientos" className="text-xs font-medium text-primary-700">Ver todos</Link>} />
          <CardBody className="space-y-2">
            {data?.ultimosMovimientos.map((m: any) => (
              <Link key={m.id} to={`/movimientos/${m.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-700">{m.consecutivo}</span>
                  <BadgeTipo tipo={m.tipo} />
                </span>
                <BadgeEstado estado={m.estado} />
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader titulo="Lotes por vencer (90 días)" accion={<Link to="/inventario" className="text-xs font-medium text-primary-700">Ver inventario</Link>} />
          <CardBody className="space-y-2">
            {!isLoading && data?.porVencer.items.length === 0 && <p className="text-sm text-slate-400">No hay lotes por vencer pronto.</p>}
            {data?.porVencer.items.map((s: any) => {
              const dias = diasHasta(s.lote.fechaVencimiento);
              return (
                <div key={`${s.sedeId}-${s.loteId}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-700">{s.lote.producto.descripcion}</span>
                    <span className="ml-2 text-slate-400">lote {s.lote.nroLote} · {s.sede.nombre} · {numero(s.cantidad)} u.</span>
                  </span>
                  <span className={`text-xs font-medium ${dias !== null && dias <= 30 ? 'text-danger-600' : 'text-warning-600'}`}>
                    vence {fecha(s.lote.fechaVencimiento)}
                  </span>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function TarjetaResumen({ icono, titulo, valor, color }: { icono: React.ReactNode; titulo: string; valor?: number; color: string }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>{icono}</div>
        <div>
          <div className="text-xl font-semibold text-slate-800">{valor ?? '—'}</div>
          <div className="text-xs text-slate-500">{titulo}</div>
        </div>
      </CardBody>
    </Card>
  );
}
