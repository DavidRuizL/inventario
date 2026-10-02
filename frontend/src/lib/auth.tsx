import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, ApiError } from './api';

export type Rol = 'SUPERADMIN' | 'ADMIN' | 'BASE';

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  sedeIds: number[];
}

interface AuthState {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, clave: string) => Promise<void>;
  logout: () => Promise<void>;
  recargar: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  async function recargar() {
    try {
      const { data } = await api.get<{ usuario: Usuario }>('/auth/me');
      setUsuario(data.usuario);
    } catch {
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function login(email: string, clave: string) {
    const { data } = await api.post<{ usuario: Usuario }>('/auth/login', { email, clave });
    setUsuario(data.usuario);
  }

  async function logout() {
    await api.post('/auth/logout');
    setUsuario(null);
  }

  return <AuthContext.Provider value={{ usuario, cargando, login, logout, recargar }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export function esAdmin(usuario: Usuario | null): boolean {
  return usuario?.rol === 'ADMIN' || usuario?.rol === 'SUPERADMIN';
}

export function esSuperAdmin(usuario: Usuario | null): boolean {
  return usuario?.rol === 'SUPERADMIN';
}

export function RequireAuth({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return null;
  if (!usuario) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export function esApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
