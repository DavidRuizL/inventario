import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Columna } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input } from '../../components/ui/Input';
import { api, ApiError } from '../../lib/api';

interface Sede { id: number; codigo: string; nombre: string; controlaSaldo: boolean; activo: boolean }

export function Sedes() {
  const queryClient = useQueryClient();
  const [crear, setCrear] = useState(false);
  const [editar, setEditar] = useState<Sede | null>(null);

  const { data, isLoading } = useQuery<Sede[]>({ queryKey: ['sedes-todas'], queryFn: async () => (await api.get('/sedes', { params: { incluirInactivas: true } })).data });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['sedes-todas'] });
    queryClient.invalidateQueries({ queryKey: ['sedes'] });
  }

  const columnas: Columna<Sede>[] = [
    { encabezado: 'Código', render: (s) => s.codigo },
    { encabezado: 'Nombre', render: (s) => s.nombre },
    { encabezado: 'Controla saldo', render: (s) => (s.controlaSaldo ? 'Sí' : 'No (Bodega ERP)') },
    { encabezado: 'Estado', render: (s) => (s.activo ? <span className="text-success-700">Activa</span> : <span className="text-slate-400">Inactiva</span>) },
    { encabezado: '', render: (s) => <button onClick={() => setEditar(s)} className="text-slate-400 hover:text-primary-700"><Pencil className="h-4 w-4" /></button> },
  ];

  return (
    <div>
      <PageHeader titulo="Sedes" descripcion="Sedes reales y la Bodega ERP." accion={<Button onClick={() => setCrear(true)}><Plus className="h-4 w-4" /> Nueva sede</Button>} />
      <DataTable columnas={columnas} filas={data ?? []} llave={(s) => s.id} cargando={isLoading} />

      <DialogCrearSede abierto={crear} onCerrar={() => setCrear(false)} onOk={invalidar} />
      {editar && <DialogEditarSede sede={editar} onCerrar={() => setEditar(null)} onOk={invalidar} />}
    </div>
  );
}

function DialogCrearSede({ abierto, onCerrar, onOk }: { abierto: boolean; onCerrar: () => void; onOk: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [controlaSaldo, setControlaSaldo] = useState(true);
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () => api.post('/sedes', { codigo, nombre, controlaSaldo }),
    onSuccess: () => { toast.success('Sede creada.'); onOk(); onCerrar(); setCodigo(''); setNombre(''); setControlaSaldo(true); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear la sede.'),
  });

  return (
    <Dialog abierto={abierto} onCerrar={onCerrar} titulo="Nueva sede">
      <div className="space-y-3">
        <Input etiqueta="Código" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ej: CAL" />
        <Input etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Cali" />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={controlaSaldo} onChange={(e) => setControlaSaldo(e.target.checked)} />
          Controla saldo (desmarca solo para una bodega ERP adicional)
        </label>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button className="w-full" disabled={!codigo || !nombre} cargando={crear.isPending} onClick={() => crear.mutate()}>Crear sede</Button>
      </div>
    </Dialog>
  );
}

function DialogEditarSede({ sede, onCerrar, onOk }: { sede: Sede; onCerrar: () => void; onOk: () => void }) {
  const [nombre, setNombre] = useState(sede.nombre);
  const [activo, setActivo] = useState(sede.activo);
  const [error, setError] = useState('');

  const guardar = useMutation({
    mutationFn: () => api.patch(`/sedes/${sede.id}`, { nombre, activo }),
    onSuccess: () => { toast.success('Sede actualizada.'); onOk(); onCerrar(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la sede.'),
  });

  return (
    <Dialog abierto onCerrar={onCerrar} titulo={`Editar — ${sede.codigo}`}>
      <div className="space-y-3">
        <Input etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Sede activa
        </label>
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button className="w-full" cargando={guardar.isPending} onClick={() => guardar.mutate()}>Guardar cambios</Button>
      </div>
    </Dialog>
  );
}
