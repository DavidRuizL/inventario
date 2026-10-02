import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { PackageCheck, PackageX, Check, Ban, Copy, ArrowLeft, History as HistoryIcon } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Textarea } from '../../components/ui/Input';
import { BadgeEstado, BadgeTipo, ETIQUETAS_ESTADO } from '../../components/ui/Badge';
import { api, ApiError } from '../../lib/api';
import { fechaHora, fecha, numero } from '../../lib/formato';

const CHECKLIST_RECEPCION_ERP = [
  'El empaque llegó en buen estado, sin daños.',
  'La fecha de vencimiento es visible y está vigente.',
  'El registro INVIMA es visible en el empaque.',
];

export function MovimientoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<'confirmar' | 'rechazar' | 'anular' | null>(null);

  const { data: m, isLoading } = useQuery<any>({
    queryKey: ['movimiento', id],
    queryFn: async () => (await api.get(`/movimientos/${id}`)).data,
  });

  function invalidarTodo() {
    queryClient.invalidateQueries({ queryKey: ['movimiento', id] });
    queryClient.invalidateQueries({ queryKey: ['movimientos'] });
    queryClient.invalidateQueries({ queryKey: ['por-recibir'] });
    queryClient.invalidateQueries({ queryKey: ['por-aprobar'] });
    queryClient.invalidateQueries({ queryKey: ['inicio'] });
    queryClient.invalidateQueries({ queryKey: ['inventario'] });
    queryClient.invalidateQueries({ queryKey: ['kardex'] });
    queryClient.invalidateQueries({ queryKey: ['contadores-nav'] });
  }

  const confirmar = useMutation({
    mutationFn: () => api.post(`/movimientos/${id}/confirmar`),
    onSuccess: () => { toast.success('Traslado confirmado.'); invalidarTodo(); setDialogo(null); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo confirmar.'),
  });

  const aprobar = useMutation({
    mutationFn: () => api.post(`/movimientos/${id}/aprobar`),
    onSuccess: () => { toast.success('Ajuste aprobado.'); invalidarTodo(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo aprobar.'),
  });

  if (isLoading) return <p className="text-sm text-slate-400">Cargando…</p>;
  if (!m) return <p className="text-sm text-slate-400">No se encontró el movimiento.</p>;

  const origenNoControla = m.sedeOrigen && m.sedeOrigen.controlaSaldo === false;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <PageHeader
        titulo={m.consecutivo}
        descripcion={`${m.tipo}${m.motivo ? ' · ' + m.motivo : ''}`}
        accion={
          <div className="flex items-center gap-2">
            <BadgeTipo tipo={m.tipo} />
            <BadgeEstado estado={m.estado} />
          </div>
        }
      />

      <Card>
        <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Dato etiqueta="Origen" valor={m.sedeOrigen?.nombre ?? '—'} />
          <Dato etiqueta="Destino" valor={m.sedeDestino?.nombre ?? '—'} />
          <Dato etiqueta="Creado por" valor={m.creadoPor?.nombre} />
          <Dato etiqueta="Creado el" valor={fechaHora(m.creadoEn)} />
          {m.resueltoPor && <Dato etiqueta="Resuelto por" valor={m.resueltoPor.nombre} />}
          {m.resueltoEn && <Dato etiqueta="Resuelto el" valor={fechaHora(m.resueltoEn)} />}
          {m.documentoSoporte && <Dato etiqueta="Documento soporte" valor={m.documentoSoporte} />}
        </CardBody>
      </Card>

      {m.observacion && (
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">{m.observacion}</div>
      )}

      {m.motivoResolucion && (
        <div className="mt-3 rounded-lg bg-danger-50 px-4 py-2 text-sm text-danger-700">
          <strong>{m.estado === 'ANULADO' ? 'Motivo de anulación' : 'Motivo de rechazo'}:</strong> {m.motivoResolucion}
        </div>
      )}

      {m.anulaA && (
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Esta es la anulación de <Link to={`/movimientos/${m.anulaA.id}`} className="font-medium text-primary-700 hover:underline">{m.anulaA.consecutivo}</Link>.
        </div>
      )}
      {m.anulaciones?.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Anulado por <Link to={`/movimientos/${m.anulaciones[0].id}`} className="font-medium text-primary-700 hover:underline">{m.anulaciones[0].consecutivo}</Link>.
        </div>
      )}

      <Card className="mt-4">
        <CardHeader titulo="Líneas" />
        <CardBody className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Producto</th>
                <th className="px-4 py-2">Lote</th>
                <th className="px-4 py-2">Vencimiento</th>
                {m.tipo === 'AJUSTE' ? (
                  <>
                    <th className="px-4 py-2">Sistema</th>
                    <th className="px-4 py-2">Contado</th>
                    <th className="px-4 py-2">Diferencia</th>
                  </>
                ) : (
                  <th className="px-4 py-2">Cantidad</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {m.lineas.map((l: any) => (
                <tr key={l.id}>
                  <td className="px-4 py-2">{l.lote.producto.codigo} — {l.lote.producto.descripcion}</td>
                  <td className="px-4 py-2">{l.lote.nroLote}</td>
                  <td className="px-4 py-2">{fecha(l.lote.fechaVencimiento)}</td>
                  {m.tipo === 'AJUSTE' ? (
                    <>
                      <td className="px-4 py-2">{numero(l.saldoSistema)}</td>
                      <td className="px-4 py-2">{numero(l.conteo)}</td>
                      <td className={`px-4 py-2 font-medium ${l.cantidad >= 0 ? 'text-success-700' : 'text-danger-600'}`}>{l.cantidad > 0 ? '+' : ''}{l.cantidad}</td>
                    </>
                  ) : (
                    <td className="px-4 py-2 font-medium">{numero(l.cantidad)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      {m.auditoria?.length > 0 && (
        <Card className="mt-4">
          <CardHeader titulo={<span className="flex items-center gap-2"><HistoryIcon className="h-4 w-4" /> Historial de cambios</span>} />
          <CardBody>
            <ul className="space-y-4">
              {m.auditoria.map((f: any) => (
                <li key={f.id} className="flex gap-3 text-sm">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                  <div className="min-w-0">
                    <p className="text-slate-700">{resumenAuditoria(f, m.lineas)}</p>
                    <p className="text-xs text-slate-400">
                      {f.usuario?.nombre ?? 'Sistema'} · {fechaHora(f.fechaHora)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {m.banderas.puedeConfirmar && (
          <Button onClick={() => setDialogo('confirmar')}>
            <PackageCheck className="h-4 w-4" /> Confirmar recibido
          </Button>
        )}
        {m.banderas.puedeRechazar && (
          <Button variante="peligro" onClick={() => setDialogo('rechazar')}>
            <PackageX className="h-4 w-4" /> Rechazar
          </Button>
        )}
        {m.banderas.puedeAprobar && (
          <Button onClick={() => aprobar.mutate()} cargando={aprobar.isPending}>
            <Check className="h-4 w-4" /> Aprobar
          </Button>
        )}
        {m.banderas.puedeAnular && (
          <Button variante="peligro" onClick={() => setDialogo('anular')}>
            <Ban className="h-4 w-4" /> Anular
          </Button>
        )}
        {m.banderas.puedeCrearDeNuevo && (
          <Button variante="secundario" onClick={() => navigate(`/traslados/nuevo?copiar=${m.id}`)}>
            <Copy className="h-4 w-4" /> Crear de nuevo
          </Button>
        )}
      </div>

      <Dialog abierto={dialogo === 'confirmar'} onCerrar={() => setDialogo(null)} titulo="Confirmar recepción">
        <DialogConfirmar conChecklist={origenNoControla} onConfirmar={() => confirmar.mutate()} cargando={confirmar.isPending} />
      </Dialog>

      <DialogMotivo
        abierto={dialogo === 'rechazar'}
        titulo="Rechazar traslado"
        ayuda="Si llegó algo distinto, recházalo; el origen lo enviará de nuevo con lo correcto."
        onCerrar={() => setDialogo(null)}
        accion={(motivo) => api.post(`/movimientos/${id}/rechazar`, { motivo })}
        onOk={() => { toast.success('Movimiento rechazado.'); invalidarTodo(); setDialogo(null); }}
      />

      <DialogMotivo
        abierto={dialogo === 'anular'}
        titulo="Anular movimiento"
        ayuda="Se creará un movimiento contrario que revierte el efecto en el inventario."
        onCerrar={() => setDialogo(null)}
        accion={(motivo) => api.post(`/movimientos/${id}/anular`, { motivo })}
        onOk={() => { toast.success('Movimiento anulado.'); invalidarTodo(); setDialogo(null); }}
      />
    </div>
  );
}

const CAMPOS_RELEVANTES: Record<string, string> = {
  estado: 'Estado',
  motivo_resolucion: 'Motivo',
  observacion: 'Observación',
  documento_soporte: 'Documento soporte',
};

function formatearValorCampo(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (campo === 'estado') return ETIQUETAS_ESTADO[String(valor)] ?? String(valor);
  return String(valor);
}

function resumenAuditoria(fila: any, lineas: any[]): string {
  if (fila.tabla === 'movimiento_linea') {
    const linea = lineas.find((l) => String(l.id) === fila.registroId);
    return linea
      ? `Línea agregada: ${linea.lote.producto.codigo} — ${linea.lote.producto.descripcion}, lote ${linea.lote.nroLote}`
      : 'Línea agregada.';
  }

  if (fila.accion === 'CREAR') return 'Se creó el movimiento.';

  if (fila.accion === 'MODIFICAR' && fila.antes && fila.despues) {
    const cambios: string[] = [];
    for (const [campo, etiqueta] of Object.entries(CAMPOS_RELEVANTES)) {
      const antes = fila.antes[campo];
      const despues = fila.despues[campo];
      if (antes === despues) continue;
      if (campo === 'estado') {
        cambios.push(`${etiqueta}: ${formatearValorCampo(campo, antes)} → ${formatearValorCampo(campo, despues)}`);
      } else if (despues) {
        cambios.push(`${etiqueta}: ${formatearValorCampo(campo, despues)}`);
      }
    }
    return cambios.length > 0 ? cambios.join(' · ') : 'Se actualizó el movimiento.';
  }

  return 'Cambio registrado.';
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-slate-400">{etiqueta}</div>
      <div className="font-medium text-slate-700">{valor}</div>
    </div>
  );
}

function DialogConfirmar({ conChecklist, onConfirmar, cargando }: { conChecklist: boolean; onConfirmar: () => void; cargando: boolean }) {
  const [marcados, setMarcados] = useState<boolean[]>(CHECKLIST_RECEPCION_ERP.map(() => false));
  const listo = !conChecklist || marcados.every(Boolean);

  return (
    <div className="space-y-4">
      {conChecklist ? (
        <>
          <p className="text-sm text-slate-500">Esta mercancía viene de la Bodega ERP. Revisa antes de confirmar:</p>
          <ul className="space-y-2">
            {CHECKLIST_RECEPCION_ERP.map((texto, i) => (
              <li key={i}>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={marcados[i]}
                    onChange={(e) => setMarcados((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))}
                  />
                  {texto}
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-slate-600">Confirmo que recibí físicamente todo lo listado.</p>
      )}
      <Button className="w-full" disabled={!listo} cargando={cargando} onClick={onConfirmar}>
        Confirmar recibido
      </Button>
    </div>
  );
}

function DialogMotivo({
  abierto,
  titulo,
  ayuda,
  onCerrar,
  accion,
  onOk,
}: {
  abierto: boolean;
  titulo: string;
  ayuda?: string;
  onCerrar: () => void;
  accion: (motivo: string) => Promise<unknown>;
  onOk: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const mutacion = useMutation({
    mutationFn: () => accion(motivo),
    onSuccess: () => { setMotivo(''); onOk(); },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo completar la acción.'),
  });

  return (
    <Dialog abierto={abierto} onCerrar={onCerrar} titulo={titulo}>
      {ayuda && <p className="mb-2 text-sm text-slate-500">{ayuda}</p>}
      <Textarea etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
        <Button variante="peligro" disabled={motivo.trim().length < 3} cargando={mutacion.isPending} onClick={() => mutacion.mutate()}>
          Confirmar
        </Button>
      </div>
    </Dialog>
  );
}
