import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Combobox, OpcionCombobox } from '../../components/ui/Combobox';
import { api, ApiError } from '../../lib/api';
import { useAuth, esAdmin } from '../../lib/auth';
import { numero } from '../../lib/formato';

interface Sede { id: number; nombre: string; controlaSaldo: boolean }
interface Linea { key: string; loteId: number; cantidad: number | ''; etiquetaProducto: string; etiquetaLote: string; disponible: number; error?: string }

const MOTIVOS = [
  { value: 'CIRUGIA', label: 'Cirugía' },
  { value: 'VENTA', label: 'Venta' },
  { value: 'VENCIDO', label: 'Vencido' },
  { value: 'AVERIA', label: 'Avería' },
];

export function NuevaSalida() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [sedeOrigenId, setSedeOrigenId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [documentoSoporte, setDocumentoSoporte] = useState('');
  const [observacion, setObservacion] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');

  const { data: sedes } = useQuery<Sede[]>({ queryKey: ['sedes'], queryFn: async () => (await api.get('/sedes')).data });
  const sedesPropias = useMemo(
    () => (sedes ?? []).filter((s) => s.controlaSaldo && usuario && (esAdmin(usuario) || usuario.sedeIds.includes(s.id))),
    [sedes, usuario],
  );

  const totalUnidades = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);

  async function onSubmit() {
    setErrorGeneral('');
    if (!sedeOrigenId) return setErrorGeneral('Elige la sede.');
    if (!motivo) return setErrorGeneral('Elige el motivo de la salida.');
    if (lineas.length === 0) return setErrorGeneral('Agrega al menos una línea.');
    if (lineas.some((l) => !l.cantidad || Number(l.cantidad) <= 0)) return setErrorGeneral('Todas las líneas deben tener cantidad mayor que cero.');

    setEnviando(true);
    setLineas((prev) => prev.map((l) => ({ ...l, error: undefined })));
    try {
      const { data } = await api.post('/movimientos/salidas', {
        sedeOrigenId: Number(sedeOrigenId),
        motivo,
        documentoSoporte: documentoSoporte || undefined,
        observacion: observacion || undefined,
        lineas: lineas.map((l) => ({ loteId: l.loteId, cantidad: Number(l.cantidad) })),
      });
      toast.success(`Salida ${data.consecutivo} registrada.`);
      navigate(`/movimientos/${data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorGeneral(err.message);
        if (err.detalles) {
          setLineas((prev) => prev.map((l) => {
            const d = err.detalles!.find((d) => d.loteId === l.loteId);
            return d ? { ...l, error: d.mensaje } : l;
          }));
        }
      } else {
        setErrorGeneral('No se pudo registrar la salida.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader titulo="Nueva salida" descripcion="Registra unidades que salen de una sede (cirugía, venta, vencido o avería)." />

      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select etiqueta="Sede" value={sedeOrigenId} onChange={(e) => { setSedeOrigenId(e.target.value); setLineas([]); }}>
              <option value="">Selecciona…</option>
              {sedesPropias.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>
            <Select etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
              <option value="">Selecciona…</option>
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
          <Input etiqueta="Documento soporte (opcional)" placeholder="N.º de cirugía, factura…" value={documentoSoporte} onChange={(e) => setDocumentoSoporte(e.target.value)} />
          <Textarea etiqueta="Observación (opcional)" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </CardBody>
      </Card>

      {sedeOrigenId && (
        <Card className="mt-4">
          <CardHeader titulo="Líneas" />
          <CardBody className="space-y-4">
            <AgregarLinea sedeId={Number(sedeOrigenId)} excluir={lineas.map((l) => l.loteId)} onAgregar={(l) => setLineas((prev) => [...prev, l])} />

            {lineas.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Disponible</th>
                      <th className="px-3 py-2">Cantidad</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineas.map((l) => (
                      <tr key={l.key}>
                        <td className="px-3 py-2">{l.etiquetaProducto}</td>
                        <td className="px-3 py-2">{l.etiquetaLote}</td>
                        <td className="px-3 py-2">{numero(l.disponible)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            max={l.disponible}
                            value={l.cantidad}
                            onChange={(e) =>
                              setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, cantidad: e.target.value === '' ? '' : Number(e.target.value) } : x)))
                            }
                            className={`w-24 rounded-lg border px-2 py-1 ${Number(l.cantidad) > l.disponible ? 'border-danger-500 text-danger-600' : 'border-slate-300'}`}
                          />
                          {l.error && <p className="mt-1 text-xs text-danger-600">{l.error}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))} className="text-slate-400 hover:text-danger-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {lineas.length > 0 && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-800">
          Vas a registrar la salida de <strong>{numero(totalUnidades)}</strong> unidades en <strong>{lineas.length}</strong> línea{lineas.length === 1 ? '' : 's'}.
        </div>
      )}

      {errorGeneral && <p className="mt-3 text-sm text-danger-600">{errorGeneral}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button onClick={onSubmit} cargando={enviando} disabled={lineas.length === 0}>Registrar salida</Button>
      </div>
    </div>
  );
}

function AgregarLinea({ sedeId, onAgregar, excluir }: { sedeId: number; onAgregar: (l: Linea) => void; excluir: number[] }) {
  const [q, setQ] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [seleccion, setSeleccion] = useState<any | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['disponible', sedeId, q],
    queryFn: async () => (await api.get('/inventario/disponible', { params: { sedeId, q } })).data,
  });

  const opciones: OpcionCombobox[] = (data ?? [])
    .filter((s: any) => !excluir.includes(s.loteId))
    .map((s: any) => ({ id: s.loteId, etiqueta: `${s.lote.producto.codigo} — ${s.lote.producto.descripcion}`, subEtiqueta: `lote ${s.lote.nroLote} · disp. ${s.cantidad}` }));

  function agregar() {
    if (!seleccion || !cantidad) return;
    onAgregar({
      key: crypto.randomUUID(),
      loteId: seleccion.loteId,
      cantidad,
      etiquetaProducto: `${seleccion.lote.producto.codigo} — ${seleccion.lote.producto.descripcion}`,
      etiquetaLote: seleccion.lote.nroLote,
      disponible: seleccion.cantidad,
    });
    setSeleccion(null);
    setQ('');
    setCantidad('');
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
      <div className="min-w-64 flex-1">
        <Combobox
          placeholder="Buscar por código, descripción, referencia o lote…"
          valor={seleccion ? `${seleccion.lote.producto.codigo} — ${seleccion.lote.nroLote}` : q}
          onCambiarValor={(v) => { setQ(v); setSeleccion(null); }}
          opciones={seleccion ? [] : opciones}
          cargando={isFetching && q.length > 0}
          onSeleccionar={(op) => setSeleccion((data ?? []).find((s: any) => s.loteId === op.id))}
        />
      </div>
      <Input type="number" min={1} max={seleccion?.cantidad} placeholder="Cantidad" className="w-28" value={cantidad} onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))} />
      <Button type="button" variante="secundario" onClick={agregar} disabled={!seleccion || !cantidad}>
        <Plus className="h-4 w-4" /> Agregar
      </Button>
    </div>
  );
}
