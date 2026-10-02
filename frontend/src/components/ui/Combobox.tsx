import { useEffect, useRef, useState } from 'react';
import { Search, Plus } from 'lucide-react';

export interface OpcionCombobox {
  id: number | string;
  etiqueta: string;
  subEtiqueta?: string;
  insignia?: string;
}

interface Props {
  placeholder?: string;
  valor: string;
  onCambiarValor: (q: string) => void;
  opciones: OpcionCombobox[];
  onSeleccionar: (opcion: OpcionCombobox) => void;
  cargando?: boolean;
  textoCrear?: string;
  onCrear?: () => void;
  disabled?: boolean;
}

export function Combobox({ placeholder, valor, onCambiarValor, opciones, onSeleccionar, cargando, textoCrear, onCrear, disabled }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          disabled={disabled}
          value={valor}
          onChange={(e) => {
            onCambiarValor(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 disabled:bg-slate-100"
        />
      </div>
      {abierto && (opciones.length > 0 || cargando || textoCrear) && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {cargando && <div className="px-3 py-2 text-sm text-slate-400">Buscando…</div>}
          {!cargando &&
            opciones.map((op) => (
              <button
                key={op.id}
                type="button"
                onClick={() => {
                  onSeleccionar(op);
                  setAbierto(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50"
              >
                <span>
                  <span className="font-medium text-slate-700">{op.etiqueta}</span>
                  {op.subEtiqueta && <span className="ml-1 text-slate-400">{op.subEtiqueta}</span>}
                </span>
                {op.insignia && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">{op.insignia}</span>
                )}
              </button>
            ))}
          {!cargando && textoCrear && onCrear && (
            <button
              type="button"
              onClick={() => {
                onCrear();
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-primary-700 hover:bg-primary-50"
            >
              <Plus className="h-4 w-4" /> {textoCrear}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
