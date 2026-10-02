import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Columna } from '../../components/ui/DataTable';
import { Select, Input } from '../../components/ui/Input';
import { Paginacion } from '../../components/ui/Paginacion';
import { BadgeEstado, BadgeTipo } from '../../components/ui/Badge';
import { api } from '../../lib/api';
import { fechaHora } from '../../lib/formato';

const TIPOS = ['TRASLADO', 'SALIDA', 'AJUSTE', 'ANULACION'];
const ESTADOS = ['NO_CONFIRMADO', 'RECIBIDO', 'RECHAZADO', 'APLICADO', 'PENDIENTE', 'APROBADO', 'ANULADO'];

export function Movimientos() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [sedeId, setSedeId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 30;

  const { data: sedes } = useQuery<{ id: number; nombre: string }[]>({ queryKey: ['sedes'], queryFn: async () => (await api.get('/sedes')).data });

  const { data, isLoading } = useQuery({
    queryKey: ['movimientos', { tipo, estado, sedeId, q, page }],
    queryFn: async () => {
      const { data } = await api.get('/movimientos', {
        params: { tipo: tipo || undefined, estado: estado || undefined, sedeId: sedeId || undefined, q: q || undefined, page, pageSize },
      });
      return data as { items: any[]; total: number };
    },
    placeholderData: (prev) => prev,
  });

  const columnas: Columna<any>[] = [
    { encabezado: 'Consecutivo', render: (m) => <span className="font-medium text-primary-700">{m.consecutivo}</span> },
    { encabezado: 'Tipo', render: (m) => <BadgeTipo tipo={m.tipo} /> },
    { encabezado: 'Origen', render: (m) => m.sedeOrigen?.nombre ?? '—' },
    { encabezado: 'Destino', render: (m) => m.sedeDestino?.nombre ?? '—' },
    { encabezado: 'Estado', render: (m) => <BadgeEstado estado={m.estado} /> },
    { encabezado: 'Creado por', render: (m) => m.creadoPor?.nombre },
    { encabezado: 'Fecha', render: (m) => fechaHora(m.creadoEn) },
  ];

  return (
    <div>
      <PageHeader titulo="Movimientos" descripcion="Traslados, salidas, ajustes y anulaciones." />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
        <Select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </Select>
        <Select value={sedeId} onChange={(e) => { setSedeId(e.target.value); setPage(1); }}>
          <option value="">Todas las sedes</option>
          {sedes?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </Select>
        <Input placeholder="Consecutivo o documento" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:col-span-2" />
      </div>

      <DataTable columnas={columnas} filas={data?.items ?? []} llave={(m) => m.id} cargando={isLoading} onFilaClick={(m) => navigate(`/movimientos/${m.id}`)} />
      {data && <Paginacion page={page} pageSize={pageSize} total={data.total} onCambiar={setPage} />}
    </div>
  );
}
