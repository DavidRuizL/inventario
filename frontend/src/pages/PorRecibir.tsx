import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { PackageCheck, PackageX } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Textarea } from '../components/ui/Input';
import { api, ApiError } from '../lib/api';
import { fechaHora, numero } from '../lib/formato';

export function PorRecibir() {
  const queryClient = useQueryClient();
  const [rechazando, setRechazando] = useState<number | null>(null);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['por-recibir'],
    queryFn: async () => (await api.get('/movimientos/por-recibir')).data,
  });

  const confirmar = useMutation({
    mutationFn: (id: number) => api.post(`/movimientos/${id}/confirmar`),
    onSuccess: () => {
      toast.success('Traslado confirmado. El inventario ya quedó actualizado.');
      queryClient.invalidateQueries({ queryKey: ['por-recibir'] });
      queryClient.invalidateQueries({ queryKey: ['inicio'] });
      queryClient.invalidateQueries({ queryKey: ['inventario'] });
      queryClient.invalidateQueries({ queryKey: ['contadores-nav'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo confirmar.'),
  });

  if (isLoading) return <p className="text-sm text-slate-400">Cargando…</p>;

  return (
    <div>
      <PageHeader titulo="Por recibir" descripcion="Traslados pendientes de confirmar en tus sedes." />

      {data?.length === 0 && <p className="text-sm text-slate-400">No tienes traslados pendientes de recibir.</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {data?.map((m) => (
          <Card key={m.id}>
            <CardBody>
              <div className="mb-2 flex items-center justify-between">
                <Link to={`/movimientos/${m.id}`} className="font-semibold text-primary-700 hover:underline">{m.consecutivo}</Link>
                <span className="text-xs text-slate-400">{fechaHora(m.creadoEn)}</span>
              </div>
              <p className="text-sm text-slate-600">
                De <strong>{m.sedeOrigen.nombre}</strong> a <strong>{m.sedeDestino.nombre}</strong> · enviado por {m.creadoPor.nombre}
              </p>
              {m.documentoSoporte && <p className="text-xs text-slate-400">Documento: {m.documentoSoporte}</p>}

              <ul className="mt-3 space-y-1 text-sm">
                {m.lineas.map((l: any) => (
                  <li key={l.id} className="flex justify-between rounded bg-slate-50 px-2 py-1">
                    <span>Lote {l.loteId}</span>
                    <span className="font-medium">{numero(l.cantidad)} u.</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex gap-2">
                <Button tamano="sm" onClick={() => confirmar.mutate(m.id)} cargando={confirmar.isPending}>
                  <PackageCheck className="h-4 w-4" /> Confirmar recibido
                </Button>
                <Button tamano="sm" variante="peligro" onClick={() => setRechazando(m.id)}>
                  <PackageX className="h-4 w-4" /> Rechazar
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <DialogRechazar id={rechazando} onCerrar={() => setRechazando(null)} />
    </div>
  );
}

function DialogRechazar({ id, onCerrar }: { id: number | null; onCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');

  const rechazar = useMutation({
    mutationFn: () => api.post(`/movimientos/${id}/rechazar`, { motivo }),
    onSuccess: () => {
      toast.success('Traslado rechazado. El origen puede crearlo de nuevo.');
      queryClient.invalidateQueries({ queryKey: ['por-recibir'] });
      queryClient.invalidateQueries({ queryKey: ['contadores-nav'] });
      setMotivo('');
      onCerrar();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo rechazar.'),
  });

  return (
    <Dialog abierto={id !== null} onCerrar={onCerrar} titulo="Rechazar traslado">
      <p className="mb-3 text-sm text-slate-500">Si llegó algo distinto, recházalo; el origen lo enviará de nuevo con lo correcto.</p>
      <Textarea etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: en la caja llegaron 2, no 3" />
      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
        <Button variante="peligro" disabled={motivo.trim().length < 3} cargando={rechazar.isPending} onClick={() => rechazar.mutate()}>
          Rechazar
        </Button>
      </div>
    </Dialog>
  );
}
