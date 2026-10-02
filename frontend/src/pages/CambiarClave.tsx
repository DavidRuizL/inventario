import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { esApiError } from '../lib/auth';

export function CambiarClave() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (nueva !== confirmar) {
      setError('La confirmación no coincide con la clave nueva.');
      return;
    }
    setCargando(true);
    try {
      await api.post('/auth/cambiar-clave', { actual, nueva });
      toast.success('Clave actualizada.');
      setActual('');
      setNueva('');
      setConfirmar('');
    } catch (err) {
      setError(esApiError(err) ? err.message : 'No se pudo cambiar la clave.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader titulo="Cambiar clave" />
      <Card>
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-4">
            <Input etiqueta="Clave actual" type="password" required value={actual} onChange={(e) => setActual(e.target.value)} />
            <Input etiqueta="Clave nueva" type="password" required minLength={6} value={nueva} onChange={(e) => setNueva(e.target.value)} />
            <Input etiqueta="Confirmar clave nueva" type="password" required minLength={6} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" cargando={cargando}>
              Guardar
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
