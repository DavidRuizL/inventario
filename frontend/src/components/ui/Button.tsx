import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';
type Tamano = 'sm' | 'md';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
}

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  peligro: 'bg-danger-600 text-white hover:bg-danger-700 disabled:bg-danger-300',
  fantasma: 'bg-transparent text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
};

const TAMANOS: Record<Tamano, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variante = 'primario', tamano = 'md', cargando, disabled, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...props}
    >
      {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
