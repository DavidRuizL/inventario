const ZONA = 'America/Bogota';

export function fechaHora(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha);
}

export function fecha(valor: string | Date | null | undefined): string {
  if (!valor) return '—';
  const fecha = typeof valor === 'string' ? new Date(valor) : valor;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(fecha);
}

export function numero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return new Intl.NumberFormat('es-CO').format(valor);
}

export function diasHasta(valor: string | Date | null | undefined): number | null {
  if (!valor) return null;
  const objetivo = typeof valor === 'string' ? new Date(valor) : valor;
  const hoy = new Date();
  const hoyUtc = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const objetivoUtc = Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth(), objetivo.getUTCDate());
  return Math.round((objetivoUtc - hoyUtc) / (1000 * 60 * 60 * 24));
}
