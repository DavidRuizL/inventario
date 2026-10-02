import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Textarea } from '../components/ui/Input';
import { api, ApiError } from '../lib/api';
import { fechaHora, numero } from '../lib/formato';

export function Aprobaciones() {
  const queryClient = useQueryClient();
  const [rechazando, setRechazando] = useState<number | null>(null);

  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['por-aprobar'],
    queryFn: async () => (await api.get('/movimientos/por-aprobar')).data,
  });

  const aprobar = useMutation({
    mutationFn: (id: number) => api.post(`/movimientos/${id}/aprobar`),
    onSuccess: () => {
      toast.success('Ajuste aprobado. El inventario ya quedó actualizado.');
      invalidar();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo aprobar.'),
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['por-aprobar'] });
    queryClient.invalidateQueries({ queryKey: ['inicio'] });
    queryClient.invalidateQueries({ queryKey: ['inventario'] });
    queryClient.invalidateQueries({ queryKey: ['contadores-nav'] });
  }

  if (isLoading) return <p className="text-sm text-slate-400">Cargando…</p>;

  return (
    <div>
      <PageHeader titulo="Aprobaciones" descripcion="Ajustes de conteo pendientes de aprobación." />

      {data?.length === 0 && <p className="text-sm text-slate-400">No hay ajustes pendientes.</p>}

      <div className="space-y-4">
        {data?.map((m) => (
          <Card key={m.id}>
            <CardBody>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <Link to={`/movimientos/${m.id}`} className="font-semibold text-primary-700 hover:underline">{m.consecutivo}</Link>
                  <span className="ml-2 text-sm text-slate-500">{m.sedeDestino.nombre}</span>
                </div>
                <span className="text-xs text-slate-400">{fechaHora(m.creadoEn)} · propuesto por {m.creadoPor.nombre}</span>
              </div>

              <table className="mt-2 w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-1">Lote</th>
                    <th className="py-1">Sistema al contar</th>
                    <th className="py-1">Saldo actual</th>
                    <th className="py-1">Contado</th>
                    <th className="py-1">Diferencia a aplicar</th>
                  </tr>
                </thead>
                <tbody>
                  {m.lineas.map((l: any) => {
                    const cambioSaldo = l.saldoActual !== l.saldoSistema;
                    const diferenciaAplicar = l.conteo - l.saldoActual;
                    return (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="py-1.5">{l.lote.producto.codigo} — {l.lote.producto.descripcion} <span className="text-slate-400">lote {l.lote.nroLote}</span></td>
                        <td className="py-1.5">{numero(l.saldoSistema)}</td>
                        <td className="py-1.5">{numero(l.saldoActual)}</td>
                        <td className="py-1.5">{numero(l.conteo)}</td>
                        <td className={`py-1.5 font-medium ${l.cantidad >= 0 ? 'text-success-700' : 'text-danger-600'}`}>
                          {diferenciaAplicar > 0 ? '+' : ''}{diferenciaAplicar}
                          {cambioSaldo && (
                            <div className="text-xs font-normal text-warning-700">
                              El saldo cambió desde el conteo (era {l.saldoSistema}, ahora {l.saldoActual}).
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {m.observacion && <p className="mt-2 text-xs text-slate-500">Observación: {m.observacion}</p>}

              <div className="mt-4 flex items-center gap-2">
                <Button tamano="sm" onClick={() => aprobar.mutate(m.id)} disabled={!m.puedeAprobar} cargando={aprobar.isPending}>
                  <Check className="h-4 w-4" /> Aprobar
                </Button>
                <Button tamano="sm" variante="peligro" onClick={() => setRechazando(m.id)}>
                  <X className="h-4 w-4" /> Rechazar
                </Button>
                {!m.puedeAprobar && <span className="text-xs text-slate-400">No puedes aprobar tu propio ajuste.</span>}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <DialogRechazarAjuste id={rechazando} onCerrar={() => setRechazando(null)} onOk={invalidar} />
    </div>
  );
}

function DialogRechazarAjuste({ id, onCerrar, onOk }: { id: number | null; onCerrar: () => void; onOk: () => void }) {
  const [motivo, setMotivo] = useState('');

  const rechazar = useMutation({
    mutationFn: () => api.post(`/movimientos/${id}/rechazar`, { motivo }),
    onSuccess: () => {
      toast.success('Ajuste rechazado.');
      setMotivo('');
      onOk();
      onCerrar();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo rechazar.'),
  });

  return (
    <Dialog abierto={id !== null} onCerrar={onCerrar} titulo="Rechazar ajuste">
      <Textarea etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
        <Button variante="peligro" disabled={motivo.trim().length < 3} cargando={rechazar.isPending} onClick={() => rechazar.mutate()}>Rechazar</Button>
      </div>
    </Dialog>
  );
}
