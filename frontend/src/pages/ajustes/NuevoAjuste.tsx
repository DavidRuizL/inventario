import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Combobox, OpcionCombobox } from '../../components/ui/Combobox';
import { api, ApiError } from '../../lib/api';
import { useAuth, esAdmin } from '../../lib/auth';
import { numero } from '../../lib/formato';

interface Sede { id: number; nombre: string; controlaSaldo: boolean }
interface Linea {
  key: string;
  loteId?: number;
  productoNuevo?: { codigo: string; descripcion: string; referencia?: string; marca?: string };
  nroLote?: string;
  fechaVencimiento?: string;
  saldoSistema: number;
  conteo: number | '';
  etiquetaProducto: string;
  etiquetaLote: string;
  error?: string;
}

export function NuevoAjuste() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [sedeId, setSedeId] = useState('');
  const [observacion, setObservacion] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');

  const { data: sedes } = useQuery<Sede[]>({ queryKey: ['sedes'], queryFn: async () => (await api.get('/sedes')).data });
  const sedesPropias = useMemo(
    () => (sedes ?? []).filter((s) => s.controlaSaldo && usuario && (esAdmin(usuario) || usuario.sedeIds.includes(s.id))),
    [sedes, usuario],
  );

  const lineasConDiferencia = lineas.filter((l) => l.conteo !== '' && Number(l.conteo) !== l.saldoSistema);

  async function onSubmit() {
    setErrorGeneral('');
    if (!sedeId) return setErrorGeneral('Elige la sede.');
    if (lineas.some((l) => l.conteo === '')) return setErrorGeneral('Escribe lo contado en todas las líneas.');
    if (lineasConDiferencia.length === 0) return setErrorGeneral('No hay diferencias entre el sistema y el conteo.');

    setEnviando(true);
    setLineas((prev) => prev.map((l) => ({ ...l, error: undefined })));
    try {
      const { data } = await api.post('/movimientos/ajustes', {
        sedeId: Number(sedeId),
        observacion: observacion || undefined,
        lineas: lineas.map((l) =>
          l.loteId
            ? { loteId: l.loteId, conteo: Number(l.conteo) }
            : { producto: l.productoNuevo!, nroLote: l.nroLote!, fechaVencimiento: l.fechaVencimiento, conteo: Number(l.conteo) },
        ),
      });
      toast.success(`Ajuste ${data.consecutivo} creado. Queda pendiente de aprobación.`);
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
        setErrorGeneral('No se pudo crear el ajuste.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader titulo="Nuevo ajuste de conteo" descripcion="Corrige el saldo del sistema según lo contado físicamente. Queda pendiente hasta que un admin lo aprueba." />

      <Card>
        <CardBody className="space-y-4">
          <Select etiqueta="Sede" value={sedeId} onChange={(e) => { setSedeId(e.target.value); setLineas([]); }} className="max-w-sm">
            <option value="">Selecciona…</option>
            {sedesPropias.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </Select>
          <Textarea etiqueta="Observación (opcional)" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </CardBody>
      </Card>

      {sedeId && (
        <Card className="mt-4">
          <CardHeader titulo="Líneas" />
          <CardBody className="space-y-4">
            <AgregarLineaAjuste sedeId={Number(sedeId)} excluirLoteIds={lineas.map((l) => l.loteId).filter(Boolean) as number[]} onAgregar={(l) => setLineas((prev) => [...prev, l])} />

            {lineas.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Sistema</th>
                      <th className="px-3 py-2">Contado</th>
                      <th className="px-3 py-2">Diferencia</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineas.map((l) => {
                      const diferencia = l.conteo === '' ? null : Number(l.conteo) - l.saldoSistema;
                      return (
                        <tr key={l.key} className={diferencia === 0 ? 'opacity-50' : ''}>
                          <td className="px-3 py-2">{l.etiquetaProducto}</td>
                          <td className="px-3 py-2">{l.etiquetaLote}</td>
                          <td className="px-3 py-2 text-slate-400">{numero(l.saldoSistema)}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={l.conteo}
                              onChange={(e) => setLineas((prev) => prev.map((x) => (x.key === l.key ? { ...x, conteo: e.target.value === '' ? '' : Number(e.target.value) } : x)))}
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                            />
                            {l.error && <p className="mt-1 text-xs text-danger-600">{l.error}</p>}
                          </td>
                          <td className={`px-3 py-2 font-medium ${diferencia === null ? 'text-slate-300' : diferencia > 0 ? 'text-success-700' : diferencia < 0 ? 'text-danger-600' : 'text-slate-400'}`}>
                            {diferencia === null ? '—' : diferencia === 0 ? 'sin cambio' : `${diferencia > 0 ? '+' : ''}${diferencia}`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => setLineas((prev) => prev.filter((x) => x.key !== l.key))} className="text-slate-400 hover:text-danger-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {errorGeneral && <p className="mt-3 text-sm text-danger-600">{errorGeneral}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button onClick={onSubmit} cargando={enviando} disabled={lineas.length === 0}>Enviar ajuste</Button>
      </div>
    </div>
  );
}

function AgregarLineaAjuste({ sedeId, onAgregar, excluirLoteIds }: { sedeId: number; onAgregar: (l: Linea) => void; excluirLoteIds: number[] }) {
  const [qProducto, setQProducto] = useState('');
  const [producto, setProducto] = useState<any | null>(null);
  const [productoNuevo, setProductoNuevo] = useState<{ codigo: string; descripcion: string; referencia?: string; marca?: string } | null>(null);
  const [lote, setLote] = useState<any | null>(null);
  const [loteNuevoNombre, setLoteNuevoNombre] = useState<string | null>(null);
  const [qLote, setQLote] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [conteo, setConteo] = useState<number | ''>('');
  const [mostrarCrearProducto, setMostrarCrearProducto] = useState(false);

  const { data: disponibles } = useQuery({
    queryKey: ['disponible', sedeId, qProducto],
    queryFn: async () => (await api.get('/inventario/disponible', { params: { sedeId, q: qProducto } })).data,
    enabled: qProducto.length > 0 && !producto && !productoNuevo,
  });

  const { data: productosCatalogo } = useQuery({
    queryKey: ['catalogo-productos', qProducto],
    queryFn: async () => (await api.get('/catalogo/productos', { params: { q: qProducto } })).data,
    enabled: qProducto.length > 0 && !producto && !productoNuevo,
  });

  const { data: lotesProducto } = useQuery({
    queryKey: ['catalogo-lotes', producto?.id, qLote],
    queryFn: async () => (await api.get('/catalogo/lotes', { params: { productoId: producto.id, q: qLote } })).data,
    enabled: !!producto && !lote && !loteNuevoNombre,
  });

  const productoListo = producto || productoNuevo;

  function reiniciar() {
    setQProducto('');
    setProducto(null);
    setProductoNuevo(null);
    setLote(null);
    setLoteNuevoNombre(null);
    setQLote('');
    setVencimiento('');
    setConteo('');
  }

  function seleccionarDesdeSaldo(saldo: any) {
    setProducto(saldo.lote.producto);
    setLote(saldo.lote);
  }

  function agregar() {
    if (!productoListo || conteo === '') return;
    const nroLote = lote ? lote.nroLote : loteNuevoNombre!;
    onAgregar({
      key: crypto.randomUUID(),
      loteId: lote?.id,
      productoNuevo: producto ? undefined : productoNuevo!,
      nroLote: lote ? undefined : nroLote,
      fechaVencimiento: lote ? undefined : vencimiento || undefined,
      saldoSistema: lote ? disponibles?.find((s: any) => s.loteId === lote.id)?.cantidad ?? 0 : 0,
      conteo,
      etiquetaProducto: producto ? `${producto.codigo} — ${producto.descripcion}` : `${productoNuevo!.codigo} — ${productoNuevo!.descripcion} (nuevo)`,
      etiquetaLote: nroLote,
    });
    reiniciar();
  }

  const opcionesCombinadas: OpcionCombobox[] = useMemo(() => {
    const deSaldo = (disponibles ?? [])
      .filter((s: any) => !excluirLoteIds.includes(s.loteId))
      .map((s: any) => ({ id: `saldo-${s.loteId}`, etiqueta: `${s.lote.producto.codigo} — ${s.lote.producto.descripcion}`, subEtiqueta: `lote ${s.lote.nroLote} · sistema ${s.cantidad}` }));
    const deCatalogo = (productosCatalogo ?? [])
      .filter((p: any) => !(disponibles ?? []).some((s: any) => s.lote.producto.id === p.id))
      .map((p: any) => ({ id: `cat-${p.id}`, etiqueta: p.descripcion, subEtiqueta: p.codigo, insignia: p.origen }));
    return [...deSaldo, ...deCatalogo];
  }, [disponibles, productosCatalogo, excluirLoteIds]);

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Combobox
          placeholder="Buscar producto (en el sistema o nuevo)…"
          valor={productoListo ? (producto ? `${producto.codigo} — ${producto.descripcion}` : `${productoNuevo!.codigo} — ${productoNuevo!.descripcion}`) : qProducto}
          onCambiarValor={(v) => { setQProducto(v); setProducto(null); setProductoNuevo(null); }}
          opciones={productoListo ? [] : opcionesCombinadas}
          textoCrear={qProducto.length > 0 && !productoListo ? `Crear producto "${qProducto}"` : undefined}
          onCrear={() => setMostrarCrearProducto(true)}
          onSeleccionar={(op) => {
            const id = String(op.id);
            if (id.startsWith('saldo-')) {
              const loteId = Number(id.replace('saldo-', ''));
              seleccionarDesdeSaldo((disponibles ?? []).find((s: any) => s.loteId === loteId));
            } else {
              const prodId = Number(id.replace('cat-', ''));
              setProducto((productosCatalogo ?? []).find((p: any) => p.id === prodId));
            }
          }}
        />

        <div>
          {producto && !lote ? (
            <Combobox
              placeholder="Buscar lote…"
              valor={loteNuevoNombre ?? qLote}
              onCambiarValor={(v) => { setQLote(v); setLoteNuevoNombre(null); }}
              opciones={(lotesProducto ?? []).map((l: any) => ({ id: l.id, etiqueta: l.nroLote, insignia: l.origen }))}
              textoCrear={qLote.length > 0 ? `Crear lote "${qLote}"` : undefined}
              onCrear={() => setLoteNuevoNombre(qLote)}
              onSeleccionar={(op) => setLote((lotesProducto ?? []).find((l: any) => l.id === op.id))}
            />
          ) : lote ? (
            <Input placeholder="Número de lote" value={lote.nroLote} disabled readOnly />
          ) : (
            <Input
              placeholder="Número de lote"
              value={loteNuevoNombre ?? ''}
              disabled={!productoNuevo}
              onChange={(e) => setLoteNuevoNombre(e.target.value)}
            />
          )}
        </div>

        <Input type="number" min={0} placeholder="Contado" value={conteo} onChange={(e) => setConteo(e.target.value === '' ? '' : Number(e.target.value))} />
      </div>

      {productoNuevo && !lote && (
        <Input type="date" etiqueta="Vencimiento (opcional)" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className="max-w-xs" />
      )}

      <Button type="button" variante="secundario" onClick={agregar} disabled={!productoListo || conteo === '' || (!lote && !loteNuevoNombre)}>
        <Plus className="h-4 w-4" /> Agregar línea
      </Button>

      <Dialog abierto={mostrarCrearProducto} onCerrar={() => setMostrarCrearProducto(false)} titulo="Crear producto">
        <FormCrearProducto codigoInicial={qProducto} onCrear={(p) => { setProductoNuevo(p); setMostrarCrearProducto(false); }} />
      </Dialog>
    </div>
  );
}

function FormCrearProducto({ codigoInicial, onCrear }: { codigoInicial: string; onCrear: (p: { codigo: string; descripcion: string; referencia?: string; marca?: string }) => void }) {
  const [codigo, setCodigo] = useState(codigoInicial);
  const [descripcion, setDescripcion] = useState('');
  const [referencia, setReferencia] = useState('');
  const [marca, setMarca] = useState('');

  return (
    <div className="space-y-3">
      <Input etiqueta="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      <Input etiqueta="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      <Input etiqueta="Referencia (opcional)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      <Input etiqueta="Marca (opcional)" value={marca} onChange={(e) => setMarca(e.target.value)} />
      <Button type="button" className="w-full" disabled={!codigo || !descripcion} onClick={() => onCrear({ codigo, descripcion, referencia: referencia || undefined, marca: marca || undefined })}>
        Usar este producto
      </Button>
    </div>
  );
}
