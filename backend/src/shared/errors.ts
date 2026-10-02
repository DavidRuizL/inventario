export type DetalleError = { loteId?: number; campo?: string; mensaje: string };

export class ApiError extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public detalles?: DetalleError[],
  ) {
    super(mensaje);
  }

  toJSON() {
    return {
      error: {
        codigo: this.codigo,
        mensaje: this.message,
        ...(this.detalles ? { detalles: this.detalles } : {}),
      },
    };
  }
}

export class ValidacionError extends ApiError {
  constructor(mensaje: string, detalles?: DetalleError[]) {
    super(400, 'VALIDACION', mensaje, detalles);
  }
}

export class NoAutenticadoError extends ApiError {
  constructor(mensaje = 'Debes iniciar sesión.') {
    super(401, 'NO_AUTENTICADO', mensaje);
  }
}

export class SinPermisoError extends ApiError {
  constructor(mensaje = 'No tienes permiso para esta acción.') {
    super(403, 'SIN_PERMISO', mensaje);
  }
}

export class NoEncontradoError extends ApiError {
  constructor(mensaje = 'No se encontró el registro.') {
    super(404, 'NO_ENCONTRADO', mensaje);
  }
}

export class ConflictoError extends ApiError {
  constructor(mensaje: string) {
    super(409, 'CONFLICTO', mensaje);
  }
}

export class ReglaError extends ApiError {
  constructor(mensaje: string, detalles?: DetalleError[]) {
    super(422, 'REGLA_NEGOCIO', mensaje, detalles);
  }
}
