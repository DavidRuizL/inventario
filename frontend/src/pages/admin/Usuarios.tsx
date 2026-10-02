import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, KeyRound, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { DataTable, Columna } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Input, Select } from '../../components/ui/Input';
import { api, ApiError } from '../../lib/api';

interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  sedes: { id: number; nombre: string }[];
}

export function Usuarios() {
  const queryClient = useQueryClient();
  const [crear, setCrear] = useState(false);
  const [editar, setEditar] = useState<Usuario | null>(null);

  const { data, isLoading } = useQuery<Usuario[]>({ queryKey: ['usuarios'], queryFn: async () => (await api.get('/usuarios')).data });
  const { data: sedes } = useQuery<{ id: number; nombre: string }[]>({ queryKey: ['sedes-todas'], queryFn: async () => (await api.get('/sedes', { params: { incluirInactivas: true } })).data });

  const restablecer = useMutation({
    mutationFn: (id: number) => api.post(`/usuarios/${id}/restablecer-clave`),
    onSuccess: ({ data }) => toast.success(`Clave temporal: ${data.claveTemporal}`, { duration: 20000 }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'No se pudo restablecer la clave.'),
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['usuarios'] });
  }

  const columnas: Columna<Usuario>[] = [
    { encabezado: 'Nombre', render: (u) => u.nombre },
    { encabezado: 'Correo', render: (u) => u.email },
    { encabezado: 'Rol', render: (u) => u.rol },
    { encabezado: 'Sedes', render: (u) => u.sedes.map((s) => s.nombre).join(', ') || '—' },
    { encabezado: 'Estado', render: (u) => (u.activo ? <span className="text-success-700">Activo</span> : <span className="text-slate-400">Inactivo</span>) },
    {
      encabezado: '',
      render: (u) => (
        <div className="flex gap-2">
          <button onClick={() => setEditar(u)} className="text-slate-400 hover:text-primary-700"><Pencil className="h-4 w-4" /></button>
          <button onClick={() => restablecer.mutate(u.id)} className="text-slate-400 hover:text-primary-700" title="Restablecer clave"><KeyRound className="h-4 w-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader titulo="Usuarios" descripcion="Crea usuarios, asigna sedes y cambia roles." accion={<Button onClick={() => setCrear(true)}><Plus className="h-4 w-4" /> Nuevo usuario</Button>} />
      <DataTable columnas={columnas} filas={data ?? []} llave={(u) => u.id} cargando={isLoading} />

      <DialogCrearUsuario abierto={crear} onCerrar={() => setCrear(false)} sedes={sedes ?? []} onOk={invalidar} />
      {editar && <DialogEditarUsuario usuario={editar} sedes={sedes ?? []} onCerrar={() => setEditar(null)} onOk={invalidar} />}
    </div>
  );
}

function DialogCrearUsuario({ abierto, onCerrar, sedes, onOk }: { abierto: boolean; onCerrar: () => void; sedes: { id: number; nombre: string }[]; onOk: () => void }) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('BASE');
  const [clave, setClave] = useState('');
  const [sedeIds, setSedeIds] = useState<number[]>([]);
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: () => api.post('/usuarios', { email, nombre, rol, clave, sedeIds }),
    onSuccess: () => {
      toast.success('Usuario creado.');
      onOk();
      onCerrar();
      setEmail(''); setNombre(''); setRol('BASE'); setClave(''); setSedeIds([]);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario.'),
  });

  return (
    <Dialog abierto={abierto} onCerrar={onCerrar} titulo="Nuevo usuario">
      <div className="space-y-3">
        <Input etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input etiqueta="Correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input etiqueta="Clave inicial" type="text" value={clave} onChange={(e) => setClave(e.target.value)} ayuda="Mínimo 6 caracteres. Compártela con el usuario de forma segura." />
        <Select etiqueta="Rol" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="BASE">BASE</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPERADMIN">SUPERADMIN</option>
        </Select>
        <SelectorSedes sedes={sedes} seleccionadas={sedeIds} onCambiar={setSedeIds} />
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button className="w-full" disabled={!email || !nombre || clave.length < 6} cargando={crear.isPending} onClick={() => crear.mutate()}>
          Crear usuario
        </Button>
      </div>
    </Dialog>
  );
}

function DialogEditarUsuario({ usuario, sedes, onCerrar, onOk }: { usuario: Usuario; sedes: { id: number; nombre: string }[]; onCerrar: () => void; onOk: () => void }) {
  const [rol, setRol] = useState(usuario.rol);
  const [activo, setActivo] = useState(usuario.activo);
  const [motivo, setMotivo] = useState('');
  const [sedeIds, setSedeIds] = useState<number[]>(usuario.sedes.map((s) => s.id));
  const [error, setError] = useState('');

  const guardar = useMutation({
    mutationFn: async () => {
      const cambios: any = {};
      if (rol !== usuario.rol) { cambios.rol = rol; cambios.motivo = motivo; }
      if (activo !== usuario.activo) cambios.activo = activo;
      if (Object.keys(cambios).length > 0) await api.patch(`/usuarios/${usuario.id}`, cambios);
      await api.put(`/usuarios/${usuario.id}/sedes`, { sedeIds });
    },
    onSuccess: () => { toast.success('Usuario actualizado.'); onOk(); onCerrar(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo actualizar.'),
  });

  const rolCambio = rol !== usuario.rol;

  return (
    <Dialog abierto onCerrar={onCerrar} titulo={`Editar — ${usuario.nombre}`}>
      <div className="space-y-3">
        <Select etiqueta="Rol" value={rol} onChange={(e) => setRol(e.target.value)}>
          <option value="BASE">BASE</option>
          <option value="ADMIN">ADMIN</option>
          <option value="SUPERADMIN">SUPERADMIN</option>
        </Select>
        {rolCambio && <Input etiqueta="Motivo del cambio de rol" value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Usuario activo
        </label>
        <SelectorSedes sedes={sedes} seleccionadas={sedeIds} onCambiar={setSedeIds} />
        {error && <p className="text-sm text-danger-600">{error}</p>}
        <Button className="w-full" disabled={rolCambio && motivo.trim().length < 3} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar cambios
        </Button>
      </div>
    </Dialog>
  );
}

function SelectorSedes({ sedes, seleccionadas, onCambiar }: { sedes: { id: number; nombre: string }[]; seleccionadas: number[]; onCambiar: (ids: number[]) => void }) {
  return (
    <div>
      <span className="text-sm font-medium text-slate-700">Sedes asignadas</span>
      <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {sedes.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={seleccionadas.includes(s.id)}
              onChange={(e) => onCambiar(e.target.checked ? [...seleccionadas, s.id] : seleccionadas.filter((id) => id !== s.id))}
            />
            {s.nombre}
          </label>
        ))}
      </div>
    </div>
  );
}
