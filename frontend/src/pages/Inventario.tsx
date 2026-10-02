import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, Columna } from '../components/ui/DataTable';
import { Select, Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Paginacion } from '../components/ui/Paginacion';
import { api } from '../lib/api';
import { numero, fecha } from '../lib/formato';

interface FilaSaldo {
  sedeId: number;
  loteId: number;
  cantidad: number;
  sede: { nombre: string };
  lote: { nroLote: string; fechaVencimiento: string | null; producto: { codigo: string; descripcion: string; referencia: string | null; marca: string | null } };
}

export function Inventario() {
  const [sedeId, setSedeId] = useState('');
  const [marca, setMarca] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const { data: sedes } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['sedes'],
    queryFn: async () => (await api.get('/sedes')).data,
  });

  const { data: marcas } = useQuery<string[]>({
    queryKey: ['marcas'],
    queryFn: async () => (await api.get('/catalogo/marcas')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventario', { sedeId, marca, q, page }],
    queryFn: async () => {
      const { data } = await api.get('/inventario', { params: { sedeId: sedeId || undefined, marca: marca || undefined, q: q || undefined, page, pageSize } });
      return data as { items: FilaSaldo[]; total: number };
    },
    placeholderData: (prev) => prev,
  });

  function exportar() {
    const params = new URLSearchParams();
    if (sedeId) params.set('sedeId', sedeId);
    if (marca) params.set('marca', marca);
    if (q) params.set('q', q);
    window.open(`/api/inventario/export.xlsx?${params.toString()}`, '_blank');
  }

  const columnas: Columna<FilaSaldo>[] = [
    { encabezado: 'Sede', render: (f) => f.sede.nombre },
    { encabezado: 'Código', render: (f) => f.lote.producto.codigo },
    { encabezado: 'Descripción', render: (f) => f.lote.producto.descripcion },
    { encabezado: 'Referencia', render: (f) => f.lote.producto.referencia ?? '—' },
    { encabezado: 'Marca', render: (f) => f.lote.producto.marca ?? '—' },
    { encabezado: 'Lote', render: (f) => f.lote.nroLote },
    { encabezado: 'Vencimiento', render: (f) => fecha(f.lote.fechaVencimiento) },
    { encabezado: 'Cantidad', render: (f) => <span className="font-medium">{numero(f.cantidad)}</span>, claseCelda: 'text-right' },
  ];

  return (
    <div>
      <PageHeader
        titulo="Inventario"
        descripcion="Saldo aprobado por sede, producto y lote."
        accion={
          <Button variante="secundario" onClick={exportar}>
            <Download className="h-4 w-4" /> Exportar a Excel
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Select value={sedeId} onChange={(e) => { setSedeId(e.target.value); setPage(1); }}>
          <option value="">Todas las sedes</option>
          {sedes?.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </Select>
        <Select value={marca} onChange={(e) => { setMarca(e.target.value); setPage(1); }}>
          <option value="">Todas las marcas</option>
          {marcas?.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
        <Input placeholder="Código, descripción o referencia" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:col-span-2" />
      </div>

      <DataTable columnas={columnas} filas={data?.items ?? []} llave={(f) => `${f.sedeId}-${f.loteId}`} cargando={isLoading} vacio="No hay saldo con estos filtros." />
      {data && <Paginacion page={page} pageSize={pageSize} total={data.total} onCambiar={setPage} />}
    </div>
  );
}
