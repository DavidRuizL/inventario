const ESTILOS: Record<string, string> = {
  NO_CONFIRMADO: 'bg-warning-100 text-warning-700',
  RECIBIDO: 'bg-success-100 text-success-700',
  APLICADO: 'bg-success-100 text-success-700',
  APROBADO: 'bg-success-100 text-success-700',
  PENDIENTE: 'bg-info-100 text-info-700',
  RECHAZADO: 'bg-danger-100 text-danger-700',
  ANULADO: 'bg-slate-200 text-slate-600',
};

export const ETIQUETAS_ESTADO: Record<string, string> = {
  NO_CONFIRMADO: 'No confirmado',
  RECIBIDO: 'Recibido',
  APLICADO: 'Aplicado',
  APROBADO: 'Aprobado',
  PENDIENTE: 'Pendiente',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

export function BadgeEstado({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILOS[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {ETIQUETAS_ESTADO[estado] ?? estado}
    </span>
  );
}

const ESTILOS_TIPO: Record<string, string> = {
  TRASLADO: 'bg-primary-100 text-primary-700',
  SALIDA: 'bg-orange-100 text-orange-700',
  AJUSTE: 'bg-info-100 text-info-700',
  ANULACION: 'bg-slate-200 text-slate-600',
};

export function BadgeTipo({ tipo }: { tipo: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTILOS_TIPO[tipo] ?? 'bg-slate-100'}`}>{tipo}</span>;
}
