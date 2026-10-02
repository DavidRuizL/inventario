import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Paginacion({
  page,
  pageSize,
  total,
  onCambiar,
}: {
  page: number;
  pageSize: number;
  total: number;
  onCambiar: (page: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-slate-500">
      <span>
        {total} registro{total === 1 ? '' : 's'} · página {page} de {totalPaginas}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onCambiar(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </button>
        <button
          onClick={() => onCambiar(page + 1)}
          disabled={page >= totalPaginas}
          className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 disabled:opacity-40"
        >
          Siguiente <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
