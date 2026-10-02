import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Combobox, OpcionCombobox } from '../../components/ui/Combobox';
import { Dialog } from '../../components/ui/Dialog';
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
  cantidad: number | '';
  etiquetaProducto: string;
  etiquetaLote: string;
  disponible?: number;
  insignia?: string;
  error?: string;
}

export function NuevoTraslado() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const copiarId = params.get('copiar');

  const [sedeOrigenId, setSedeOrigenId] = useState('');
  const [sedeDestinoId, setSedeDestinoId] = useState('');
  const [cargaInicial, setCargaInicial] = useState(false);
  const [documentoSoporte, setDocumentoSoporte] = useState('');
  const [observacion, setObservacion] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [mostrarPegar, setMostrarPegar] = useState(false);

  const { data: sedes } = useQuery<Sede[]>({ queryKey: ['sedes'], queryFn: async () => (await api.get('/sedes')).data });
  const sedesPropias = useMemo(() => (sedes ?? []).filter((s) => usuario && (esAdmin(usuario) || usuario.sedeIds.includes(s.id))), [sedes, usuario]);
  const origen = sedes?.find((s) => String(s.id) === sedeOrigenId);
  const origenControlaSaldo = origen?.controlaSaldo ?? true;

  useEffect(() => {
    if (!copiarId) return;
    api.get(`/movimientos/${copiarId}`).then(({ data }) => {
      setSedeOrigenId(String(data.sedeOrigenId));
      setSedeDestinoId(String(data.sedeDestinoId));
      setDocumentoSoporte(data.documentoSoporte ?? '');
      setLineas(
        data.lineas.map((l: any) => ({
          key: crypto.randomUUID(),
          loteId: l.loteId,
          cantidad: l.cantidad,
          etiquetaProducto: `${l.lote.producto.codigo} — ${l.lote.producto.descripcion}`,
          etiquetaLote: l.lote.nroLote,
        })),
      );
      toast.info('Se copiaron las líneas del traslado rechazado. Corrígelas y envía de nuevo.');
    });
  }, [copiarId]);

  function agregarLinea(l: Linea) {
    setLineas((prev) => [...prev, l]);
  }

  function quitarLinea(key: string) {
    setLineas((prev) => prev.filter((l) => l.key !== key));
  }

  function actualizarCantidad(key: string, cantidad: number | '') {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, cantidad } : l)));
  }

  const totalUnidades = lineas.reduce((acc, l) => acc + (Number(l.cantidad) || 0), 0);

  async function onSubmit() {
    setErrorGeneral('');
    if (!sedeOrigenId || !sedeDestinoId) return setErrorGeneral('Elige la sede de origen y la de destino.');
    if (sedeOrigenId === sedeDestinoId) return setErrorGeneral('El origen y el destino deben ser distintos.');
    if (lineas.length === 0) return setErrorGeneral('Agrega al menos una línea.');

    const lineasInvalidas = lineas.filter((l) => !l.cantidad || Number(l.cantidad) <= 0);
    if (lineasInvalidas.length > 0) return setErrorGeneral('Todas las líneas deben tener una cantidad mayor que cero.');

    const payloadLineas = lineas.map((l) =>
      l.loteId
        ? { loteId: l.loteId, cantidad: Number(l.cantidad) }
        : { producto: l.productoNuevo!, nroLote: l.nroLote!, fechaVencimiento: l.fechaVencimiento, cantidad: Number(l.cantidad) },
    );

    setEnviando(true);
    setLineas((prev) => prev.map((l) => ({ ...l, error: undefined })));
    try {
      const { data } = await api.post('/movimientos/traslados', {
        sedeOrigenId: Number(sedeOrigenId),
        sedeDestinoId: Number(sedeDestinoId),
        motivo: cargaInicial ? 'CARGA_INICIAL' : undefined,
        documentoSoporte: documentoSoporte || undefined,
        observacion: observacion || undefined,
        lineas: payloadLineas,
      });
      toast.success(`Traslado ${data.consecutivo} enviado.`);
      navigate(`/movimientos/${data.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorGeneral(err.message);
        if (err.detalles) {
          setLineas((prev) =>
            prev.map((l, i) => {
              const detalle = err.detalles!.find((d) => d.loteId === l.loteId || d.campo === `lineas.${i}`);
              return detalle ? { ...l, error: detalle.mensaje } : l;
            }),
          );
        }
      } else {
        setErrorGeneral('No se pudo enviar el traslado.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader titulo="Nuevo traslado" descripcion="Envía mercancía de una sede a otra." />

      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select etiqueta="Sede de origen" value={sedeOrigenId} onChange={(e) => { setSedeOrigenId(e.target.value); setLineas([]); }}>
              <option value="">Selecciona…</option>
              {sedesPropias.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}{!s.controlaSaldo ? ' (sin saldo)' : ''}</option>
              ))}
            </Select>
            <Select etiqueta="Sede de destino" value={sedeDestinoId} onChange={(e) => setSedeDestinoId(e.target.value)}>
              <option value="">Selecciona…</option>
              {sedes?.filter((s) => String(s.id) !== sedeOrigenId).map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>
          </div>

          {!origenControlaSaldo && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={cargaInicial} onChange={(e) => setCargaInicial(e.target.checked)} />
              Es carga inicial (primer ingreso de este inventario)
            </label>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input etiqueta="Documento soporte (opcional)" value={documentoSoporte} onChange={(e) => setDocumentoSoporte(e.target.value)} />
          </div>
          <Textarea etiqueta="Observación (opcional)" value={observacion} onChange={(e) => setObservacion(e.target.value)} />
        </CardBody>
      </Card>

      {sedeOrigenId && (
        <Card className="mt-4">
          <CardHeader
            titulo="Líneas"
            accion={
              !origenControlaSaldo ? (
                <Button variante="secundario" tamano="sm" onClick={() => setMostrarPegar(true)}>
                  <ClipboardPaste className="h-4 w-4" /> Pegar desde Excel
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            {origenControlaSaldo ? (
              <AgregarLineaExistente sedeId={Number(sedeOrigenId)} onAgregar={agregarLinea} excluir={lineas.map((l) => l.loteId).filter(Boolean) as number[]} />
            ) : (
              <AgregarLineaNueva onAgregar={agregarLinea} excluirLoteIds={lineas.map((l) => l.loteId).filter(Boolean) as number[]} />
            )}

            {lineas.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Lote</th>
                      {origenControlaSaldo && <th className="px-3 py-2">Disponible</th>}
                      <th className="px-3 py-2">Cantidad</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineas.map((l) => (
                      <tr key={l.key}>
                        <td className="px-3 py-2">{l.etiquetaProducto}</td>
                        <td className="px-3 py-2">
                          {l.etiquetaLote} {l.insignia && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] uppercase text-slate-500">{l.insignia}</span>}
                        </td>
                        {origenControlaSaldo && <td className="px-3 py-2">{numero(l.disponible)}</td>}
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            max={origenControlaSaldo ? l.disponible : undefined}
                            value={l.cantidad}
                            onChange={(e) => actualizarCantidad(l.key, e.target.value === '' ? '' : Number(e.target.value))}
                            className={`w-24 rounded-lg border px-2 py-1 ${
                              origenControlaSaldo && l.disponible !== undefined && Number(l.cantidad) > l.disponible ? 'border-danger-500 text-danger-600' : 'border-slate-300'
                            }`}
                          />
                          {l.error && <p className="mt-1 text-xs text-danger-600">{l.error}</p>}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => quitarLinea(l.key)} className="text-slate-400 hover:text-danger-600">
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

      {lineas.length > 0 && sedeDestinoId && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-800">
          Vas a enviar <strong>{numero(totalUnidades)}</strong> unidades en <strong>{lineas.length}</strong> línea{lineas.length === 1 ? '' : 's'} de{' '}
          <strong>{origen?.nombre}</strong> a <strong>{sedes?.find((s) => String(s.id) === sedeDestinoId)?.nombre}</strong>.
        </div>
      )}

      {errorGeneral && <p className="mt-3 text-sm text-danger-600">{errorGeneral}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button onClick={onSubmit} cargando={enviando} disabled={lineas.length === 0}>
          Enviar traslado
        </Button>
      </div>

      <DialogPegarExcel
        abierto={mostrarPegar}
        onCerrar={() => setMostrarPegar(false)}
        onAgregarVarias={(nuevas) => setLineas((prev) => [...prev, ...nuevas])}
      />
    </div>
  );
}

function AgregarLineaExistente({ sedeId, onAgregar, excluir }: { sedeId: number; onAgregar: (l: Linea) => void; excluir: number[] }) {
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

function AgregarLineaNueva({ onAgregar, excluirLoteIds }: { onAgregar: (l: Linea) => void; excluirLoteIds: number[] }) {
  const [qProducto, setQProducto] = useState('');
  const [producto, setProducto] = useState<any | null>(null);
  const [productoNuevo, setProductoNuevo] = useState<{ codigo: string; descripcion: string; referencia?: string; marca?: string } | null>(null);
  const [qLote, setQLote] = useState('');
  const [lote, setLote] = useState<any | null>(null);
  const [loteNuevoNombre, setLoteNuevoNombre] = useState<string | null>(null);
  const [vencimiento, setVencimiento] = useState('');
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [mostrarCrearProducto, setMostrarCrearProducto] = useState(false);

  const { data: productos, isFetching: buscandoProducto } = useQuery({
    queryKey: ['catalogo-productos', qProducto],
    queryFn: async () => (await api.get('/catalogo/productos', { params: { q: qProducto } })).data,
    enabled: qProducto.length > 0 && !producto && !productoNuevo,
  });

  const { data: lotes, isFetching: buscandoLote } = useQuery({
    queryKey: ['catalogo-lotes', producto?.id, qLote],
    queryFn: async () => (await api.get('/catalogo/lotes', { params: { productoId: producto.id, q: qLote } })).data,
    enabled: !!producto && !lote && !loteNuevoNombre,
  });

  const productoListo = producto || productoNuevo;

  function reiniciar() {
    setQProducto('');
    setProducto(null);
    setProductoNuevo(null);
    setQLote('');
    setLote(null);
    setLoteNuevoNombre(null);
    setVencimiento('');
    setCantidad('');
  }

  function agregar() {
    if (!productoListo || !cantidad) return;
    const nroLote = lote ? lote.nroLote : loteNuevoNombre!;
    onAgregar({
      key: crypto.randomUUID(),
      loteId: lote?.id,
      productoNuevo: producto ? undefined : productoNuevo!,
      nroLote: lote ? undefined : nroLote,
      fechaVencimiento: lote ? undefined : vencimiento || undefined,
      cantidad,
      etiquetaProducto: producto ? `${producto.codigo} — ${producto.descripcion}` : `${productoNuevo!.codigo} — ${productoNuevo!.descripcion} (nuevo)`,
      etiquetaLote: nroLote + (lote ? '' : ' (nuevo)'),
      insignia: !producto || !lote ? 'Manual' : producto.origen,
    });
    reiniciar();
  }

  const opcionesProducto: OpcionCombobox[] = (productos ?? []).map((p: any) => ({ id: p.id, etiqueta: p.descripcion, subEtiqueta: p.codigo, insignia: p.origen }));
  const opcionesLote: OpcionCombobox[] = (lotes ?? [])
    .filter((l: any) => !excluirLoteIds.includes(l.id))
    .map((l: any) => ({ id: l.id, etiqueta: l.nroLote, subEtiqueta: l.fechaVencimiento ?? undefined, insignia: l.origen }));

  return (
    <div className="space-y-3 rounded-lg bg-slate-50 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Combobox
            placeholder="Buscar producto…"
            valor={productoListo ? (producto ? `${producto.codigo} — ${producto.descripcion}` : `${productoNuevo!.codigo} — ${productoNuevo!.descripcion}`) : qProducto}
            onCambiarValor={(v) => { setQProducto(v); setProducto(null); setProductoNuevo(null); }}
            opciones={productoListo ? [] : opcionesProducto}
            cargando={buscandoProducto}
            textoCrear={qProducto.length > 0 && !productoListo ? `Crear producto "${qProducto}"` : undefined}
            onCrear={() => setMostrarCrearProducto(true)}
            onSeleccionar={(op) => setProducto((productos ?? []).find((p: any) => p.id === op.id))}
          />
        </div>

        {productoListo && !producto?.origen && null}

        <div>
          {producto ? (
            <Combobox
              placeholder="Buscar lote…"
              valor={lote ? lote.nroLote : loteNuevoNombre ?? qLote}
              onCambiarValor={(v) => { setQLote(v); setLote(null); setLoteNuevoNombre(null); }}
              opciones={lote || loteNuevoNombre ? [] : opcionesLote}
              cargando={buscandoLote}
              textoCrear={qLote.length > 0 && !lote ? `Crear lote "${qLote}"` : undefined}
              onCrear={() => setLoteNuevoNombre(qLote)}
              onSeleccionar={(op) => setLote((lotes ?? []).find((l: any) => l.id === op.id))}
            />
          ) : (
            <Input placeholder="Número de lote" disabled={!productoNuevo} value={loteNuevoNombre ?? ''} onChange={(e) => setLoteNuevoNombre(e.target.value)} />
          )}
        </div>

        <Input type="number" min={1} placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value === '' ? '' : Number(e.target.value))} />
      </div>

      {productoListo && !lote && (
        <Input type="date" etiqueta="Vencimiento (opcional)" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className="max-w-xs" />
      )}

      <Button type="button" variante="secundario" onClick={agregar} disabled={!productoListo || !cantidad || (!lote && !loteNuevoNombre)}>
        <Plus className="h-4 w-4" /> Agregar línea
      </Button>

      <Dialog abierto={mostrarCrearProducto} onCerrar={() => setMostrarCrearProducto(false)} titulo="Crear producto">
        <FormCrearProducto
          codigoInicial={qProducto}
          onCrear={(p) => { setProductoNuevo(p); setMostrarCrearProducto(false); }}
        />
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
      <Button
        type="button"
        className="w-full"
        disabled={!codigo || !descripcion}
        onClick={() => onCrear({ codigo, descripcion, referencia: referencia || undefined, marca: marca || undefined })}
      >
        Usar este producto
      </Button>
    </div>
  );
}

interface FilaPegada {
  codigo: string;
  nroLote: string;
  cantidad: number;
  estado: 'ok' | 'lote_nuevo' | 'producto_desconocido';
  productoId?: number;
  descripcion?: string;
  loteId?: number;
  fechaVencimiento?: string | null;
}

function DialogPegarExcel({ abierto, onCerrar, onAgregarVarias }: { abierto: boolean; onCerrar: () => void; onAgregarVarias: (l: Linea[]) => void }) {
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<FilaPegada[]>([]);
  const [procesando, setProcesando] = useState(false);

  async function procesar() {
    const lineas = texto
      .trim()
      .split('\n')
      .map((linea) => linea.split('\t').map((c) => c.trim()))
      .filter((c) => c.length >= 2 && c[0]);

    const filasEntrada = lineas.map((c) => ({
      codigo: c[0],
      nroLote: c[1],
      fechaVencimiento: c[2] || undefined,
      cantidad: Number(c[3] ?? 0) || 0,
    }));

    setProcesando(true);
    try {
      const { data } = await api.post('/catalogo/resolver', { filas: filasEntrada });
      setFilas(data);
    } catch {
      toast.error('No se pudieron resolver las filas pegadas.');
    } finally {
      setProcesando(false);
    }
  }

  function confirmar() {
    const nuevas: Linea[] = filas
      .filter((f) => f.estado !== 'producto_desconocido' && f.cantidad > 0)
      .map((f) => ({
        key: crypto.randomUUID(),
        loteId: f.loteId,
        productoNuevo: f.loteId ? undefined : { codigo: f.codigo, descripcion: f.descripcion ?? f.codigo },
        nroLote: f.loteId ? undefined : f.nroLote,
        fechaVencimiento: f.loteId ? undefined : f.fechaVencimiento ?? undefined,
        cantidad: f.cantidad,
        etiquetaProducto: f.descripcion ?? f.codigo,
        etiquetaLote: f.nroLote + (f.estado === 'lote_nuevo' ? ' (nuevo)' : ''),
        insignia: f.estado === 'lote_nuevo' ? 'Nuevo' : undefined,
      }));
    onAgregarVarias(nuevas);
    setTexto('');
    setFilas([]);
    onCerrar();
  }

  return (
    <Dialog abierto={abierto} onCerrar={onCerrar} titulo="Pegar desde Excel" ancho="max-w-2xl">
      <p className="mb-2 text-sm text-slate-500">Pega filas copiadas con columnas: código, lote, vencimiento (AAAA-MM-DD), cantidad — separadas por tabulación.</p>
      <Textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'136022\t01599-9\t2027-06-30\t10\n140011\ta12572\t\t5'} />
      <Button type="button" variante="secundario" className="mt-2" onClick={procesar} cargando={procesando}>
        Revisar filas
      </Button>

      {filas.length > 0 && (
        <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Lote</th>
                <th className="px-3 py-2">Cantidad</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{f.codigo}</td>
                  <td className="px-3 py-2">{f.nroLote}</td>
                  <td className="px-3 py-2">{f.cantidad}</td>
                  <td className="px-3 py-2">
                    {f.estado === 'ok' && <span className="text-success-700">ok</span>}
                    {f.estado === 'lote_nuevo' && <span className="text-warning-700">lote nuevo</span>}
                    {f.estado === 'producto_desconocido' && <span className="text-danger-600">producto desconocido (falta descripción)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variante="secundario" onClick={onCerrar}>Cancelar</Button>
        <Button onClick={confirmar} disabled={filas.length === 0}>Agregar líneas válidas</Button>
      </div>
    </Dialog>
  );
}
