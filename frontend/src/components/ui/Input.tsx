import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef, ReactNode } from 'react';

interface CampoBaseProps {
  etiqueta?: string;
  error?: string;
  ayuda?: string;
}

function Envoltura({ etiqueta, error, ayuda, children }: CampoBaseProps & { children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {etiqueta && <span className="font-medium text-slate-700">{etiqueta}</span>}
      {children}
      {ayuda && !error && <span className="text-xs text-slate-500">{ayuda}</span>}
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </label>
  );
}

const estiloCampo = (error?: string) =>
  `rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-primary-200 ${
    error ? 'border-danger-400 focus:border-danger-500' : 'border-slate-300 focus:border-primary-500'
  }`;

type InputProps = InputHTMLAttributes<HTMLInputElement> & CampoBaseProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ etiqueta, error, ayuda, className = '', ...props }, ref) => (
  <Envoltura etiqueta={etiqueta} error={error} ayuda={ayuda}>
    <input ref={ref} className={`${estiloCampo(error)} ${className}`} {...props} />
  </Envoltura>
));
Input.displayName = 'Input';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & CampoBaseProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ etiqueta, error, ayuda, className = '', ...props }, ref) => (
  <Envoltura etiqueta={etiqueta} error={error} ayuda={ayuda}>
    <textarea ref={ref} className={`${estiloCampo(error)} ${className}`} rows={3} {...props} />
  </Envoltura>
));
Textarea.displayName = 'Textarea';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & CampoBaseProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ etiqueta, error, ayuda, className = '', children, ...props }, ref) => (
  <Envoltura etiqueta={etiqueta} error={error} ayuda={ayuda}>
    <select ref={ref} className={`${estiloCampo(error)} bg-white ${className}`} {...props}>
      {children}
    </select>
  </Envoltura>
));
Select.displayName = 'Select';
