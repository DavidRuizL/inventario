import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, Columna } from '../components/ui/DataTable';
import { Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Combobox, OpcionCombobox } from '../components/ui/Combobox';
import { Paginacion } from '../components/ui/Paginacion';
import { BadgeTipo } from '../components/ui/Badge';
import { api } from '../lib/api';
import { fechaHora, numero } from '../lib/formato';

interface FilaKardex {
  id: number;
  fecha: string;
  cantidad: number;
  saldoResultante: number;
  sede: { nombre: string };
  lote: { nroLote: string; producto: { codigo: string; descripcion: string } };
  movimiento: { id: number; consecutivo: string; tipo: string; motivo: string | null };
}

export function Kardex() {
  const [qProducto, setQProducto] = useState('');
  const [productoId, setProductoId] = useState<number | null>(null);
  const [productoLabel, setProductoLabel] = useState('');
  const [loteId, setLoteId] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: sedes } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['sedes'],
    queryFn: async () => (await api.get('/sedes')).data,
  });

  const { data: productos } = useQuery<any[]>({
    queryKey: ['catalogo-productos', qProducto],
    queryFn: async () => (await api.get('/catalogo/productos', { params: { q: qProducto } })).data,
    enabled: qProducto.length > 0,
  });

  const { data: lotes } = useQuery<any[]>({
    queryKey: ['catalogo-lotes', productoId],
    queryFn: async () => (await api.get('/catalogo/lotes', { params: { productoId } })).data,
    enabled: !!productoId,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['kardex', { loteId, sedeId, page }],
    queryFn: async () => {
      const { data } = await api.get('/kardex', { params: { loteId: loteId || undefined, sedeId: sedeId || undefined, page, pageSize } });
      return data as { items: FilaKardex[]; total: number };
    },
    placeholderData: (prev) => prev,
  });

  function exportar() {
    const params = new URLSearchParams();
    if (loteId) params.set('loteId', loteId);
    if (sedeId) params.set('sedeId', sedeId);
    window.open(`/api/kardex/export.xlsx?${params.toString()}`, '_blank');
  }

  const opciones: OpcionCombobox[] = (productos ?? []).map((p) => ({ id: p.id, etiqueta: p.descripcion, subEtiqueta: p.codigo }));

  const columnas: Columna<FilaKardex>[] = [
    { encabezado: 'Fecha', render: (f) => fechaHora(f.fecha) },
    { encabezado: 'Sede', render: (f) => f.sede.nombre },
    { encabezado: 'Producto', render: (f) => `${f.lote.producto.codigo} — ${f.lote.producto.descripcion}` },
    { encabezado: 'Lote', render: (f) => f.lote.nroLote },
    {
      encabezado: 'Documento',
      render: (f) => (
        <Link to={`/movimientos/${f.movimiento.id}`} className="text-primary-700 hover:underline">
          {f.movimiento.consecutivo}
        </Link>
      ),
    },
    { encabezado: 'Tipo', render: (f) => <BadgeTipo tipo={f.movimiento.tipo} /> },
    {
      encabezado: 'Cantidad',
      render: (f) => <span className={f.cantidad >= 0 ? 'text-success-700' : 'text-danger-600'}>{f.cantidad >= 0 ? '+' : ''}{numero(f.cantidad)}</span>,
      claseCelda: 'text-right',
    },
    { encabezado: 'Saldo', render: (f) => <span className="font-medium">{numero(f.saldoResultante)}</span>, claseCelda: 'text-right' },
  ];

  return (
    <div>
      <PageHeader
        titulo="Historial"
        descripcion="Entradas, salidas y saldo de cada producto y lote (kardex)."
        accion={
          <Button variante="secundario" onClick={exportar}>
            <Download className="h-4 w-4" /> Exportar a Excel
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Combobox
            placeholder="Buscar producto…"
            valor={productoLabel || qProducto}
            onCambiarValor={(v) => {
              setQProducto(v);
              setProductoLabel(v);
            }}
            opciones={productoId ? [] : opciones}
            onSeleccionar={(op) => {
              setProductoId(Number(op.id));
              setProductoLabel(op.etiqueta);
              setLoteId('');
            }}
          />
        </div>
        <Select value={loteId} onChange={(e) => { setLoteId(e.target.value); setPage(1); }} disabled={!productoId}>
          <option value="">Todos los lotes</option>
          {lotes?.map((l) => (
            <option key={l.id} value={l.id}>{l.nroLote}</option>
          ))}
        </Select>
        <Select value={sedeId} onChange={(e) => { setSedeId(e.target.value); setPage(1); }}>
          <option value="">Todas las sedes</option>
          {sedes?.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Select>
      </div>

      <DataTable columnas={columnas} filas={data?.items ?? []} llave={(f) => f.id} cargando={isLoading} vacio="No hay movimientos de kardex con estos filtros." />
      {data && <Paginacion page={page} pageSize={pageSize} total={data.total} onCambiar={setPage} />}
    </div>
  );
}
