import axios from 'axios';

export type DetalleError = { loteId?: number; campo?: string; mensaje: string };

export class ApiError extends Error {
  codigo: string;
  detalles?: DetalleError[];
  status: number;

  constructor(status: number, codigo: string, mensaje: string, detalles?: DetalleError[]) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0;

      if (status === 401 && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }

      const cuerpo = error.response?.data?.error;
      if (cuerpo) {
        return Promise.reject(new ApiError(status, cuerpo.codigo ?? 'ERROR', cuerpo.mensaje ?? 'Ocurrió un error.', cuerpo.detalles));
      }
      return Promise.reject(new ApiError(status, 'ERROR', error.message));
    }
    return Promise.reject(error);
  },
);
