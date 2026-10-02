import { Request } from 'express';

export type Rol = 'SUPERADMIN' | 'ADMIN' | 'BASE';

export interface UsuarioAuth {
  id: number;
  email: string;
  nombre: string;
  rol: Rol;
  sedeIds: number[];
}

export interface AuthRequest extends Request {
  usuario?: UsuarioAuth;
}

export interface SesionPayload {
  sub: number;
}

export interface Paginado<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
