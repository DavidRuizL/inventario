import { ReactNode } from 'react';
import { Loader2, Inbox } from 'lucide-react';

export interface Columna<T> {
  encabezado: string;
  render: (fila: T) => ReactNode;
  claseCelda?: string;
}

interface Props<T> {
  columnas: Columna<T>[];
  filas: T[];
  llave: (fila: T) => string | number;
  cargando?: boolean;
  vacio?: string;
  onFilaClick?: (fila: T) => void;
}

export function DataTable<T>({ columnas, filas, llave, cargando, vacio = 'No hay datos para mostrar.', onFilaClick }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columnas.map((c, i) => (
              <th key={i} className="px-4 py-2.5 font-medium">
                {c.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cargando && (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-slate-400">
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              </td>
            </tr>
          )}
          {!cargando && filas.length === 0 && (
            <tr>
              <td colSpan={columnas.length} className="px-4 py-10 text-center text-slate-400">
                <Inbox className="mx-auto mb-2 h-6 w-6" />
                {vacio}
              </td>
            </tr>
          )}
          {!cargando &&
            filas.map((fila) => (
              <tr
                key={llave(fila)}
                onClick={() => onFilaClick?.(fila)}
                className={onFilaClick ? 'cursor-pointer hover:bg-primary-50/50' : ''}
              >
                {columnas.map((c, i) => (
                  <td key={i} className={`px-4 py-2.5 text-slate-700 ${c.claseCelda ?? ''}`}>
                    {c.render(fila)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
