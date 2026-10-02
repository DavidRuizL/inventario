export function Logo({ tamano = 36, conTexto = true }: { tamano?: number; conTexto?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo-rp.svg" width={tamano} height={tamano} alt="RP Dental" className="shrink-0" />
      {conTexto && (
        <div className="leading-tight">
          <div className="font-semibold text-slate-800">RP Dental</div>
          <div className="text-[11px] uppercase tracking-wide text-primary-700">Inventario por sedes</div>
        </div>
      )}
    </div>
  );
}
