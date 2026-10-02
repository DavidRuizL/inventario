import { ReactNode } from 'react';

export function PageHeader({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
        {descripcion && <p className="text-sm text-slate-500">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
