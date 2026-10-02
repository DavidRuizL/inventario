import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, Columna } from '../components/ui/DataTable';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { api, ApiError } from '../lib/api';
import { fechaHora } from '../lib/formato';

interface Corrida {
  id: number;
  inicio: string;
  fin: string | null;
  productosNuevos: number;
  productosActualizados: number;
  lotesNuevos: number;
  lotesActualizados: number;
  error: string | null;
  usuario: { nombre: string } | null;
}

export function Sync() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ habilitada: boolean; intervaloMin: number; corridas: Corrida[] }>({
    queryKey: ['sync'],
    queryFn: async () => (await api.get('/sync')).data,
    refetchInterval: 15_000,
  });

  const sincronizar = useMutation({
    mutationFn: () => api.post('/sync/ahora'),
    onSuccess: () => {
      toast.success('Sincronización iniciada.');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['sync'] }), 2000);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo iniciar la sincronización.'),
  });

  const columnas: Columna<Corrida>[] = [
    { encabezado: 'Inicio', render: (c) => fechaHora(c.inicio) },
    { encabezado: 'Fin', render: (c) => (c.fin ? fechaHora(c.fin) : 'En curso…') },
    { encabezado: 'Productos nuevos', render: (c) => c.productosNuevos },
    { encabezado: 'Productos actualizados', render: (c) => c.productosActualizados },
    { encabezado: 'Lotes nuevos', render: (c) => c.lotesNuevos },
    { encabezado: 'Lotes actualizados', render: (c) => c.lotesActualizados },
    { encabezado: 'Origen', render: (c) => c.usuario?.nombre ?? 'Automática' },
    { encabezado: 'Error', render: (c) => (c.error ? <span className="text-danger-600">{c.error}</span> : '—') },
  ];

  return (
    <div>
      <PageHeader
        titulo="Sincronización con el ERP"
        descripcion={data?.habilitada ? `Automática cada ${data.intervaloMin} minutos. Solo trae nombres y lotes como sugerencia.` : 'No configurada: falta la variable ERP_DB.'}
        accion={
          <Button onClick={() => sincronizar.mutate()} cargando={sincronizar.isPending} disabled={!data?.habilitada}>
            <RefreshCw className="h-4 w-4" /> Sincronizar ahora
          </Button>
        }
      />

      {!data?.habilitada && (
        <Card className="mb-4 border-warning-200 bg-warning-50">
          <CardBody className="text-sm text-warning-700">
            La sincronización automática está deshabilitada porque falta configurar <code>ERP_DB</code> en el servidor.
          </CardBody>
        </Card>
      )}

      <DataTable columnas={columnas} filas={data?.corridas ?? []} llave={(c) => c.id} cargando={isLoading} vacio="Todavía no se ha corrido ninguna sincronización." />
    </div>
  );
}
