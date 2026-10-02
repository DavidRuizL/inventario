import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth, esApiError } from '../lib/auth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export function Login() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (usuario) navigate('/', { replace: true });
  }, [usuario, navigate]);

  if (usuario) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      await login(email, clave);
      const destino = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(destino, { replace: true });
    } catch (err) {
      setError(esApiError(err) ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-700 to-primary-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo-rp.svg" width={56} height={56} alt="RP Dental" />
          <h1 className="mt-3 text-lg font-semibold text-slate-800">RP Dental</h1>
          <p className="text-sm text-slate-500">Inventario por sedes</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            etiqueta="Correo"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@rpdental.local"
          />
          <Input
            etiqueta="Clave"
            type="password"
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <Button type="submit" cargando={cargando} className="w-full" tamano="md">
            {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ingresar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
