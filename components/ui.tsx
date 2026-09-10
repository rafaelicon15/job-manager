"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, X } from "lucide-react";
import { ESTADOS, type EstadoVacante } from "@/lib/types";

export function Cargando({ texto = "Trabajando…" }: { texto?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--color-suave)]">
      <Loader2 size={15} className="animate-spin" />
      {texto}
    </span>
  );
}

export function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-base font-semibold">{titulo}</p>
      <p className="max-w-md text-sm leading-relaxed text-[var(--color-suave)]">
        {detalle}
      </p>
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}

export function Alerta({
  tipo = "error",
  children,
}: {
  tipo?: "error" | "aviso" | "ok" | "info";
  children: React.ReactNode;
}) {
  const estilos = {
    error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    aviso: "border-amber-500/40 bg-amber-500/10 text-amber-200",
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    info: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  }[tipo];
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed ${estilos}`}>
      {children}
    </div>
  );
}

export function colorPuntaje(p: number) {
  if (p >= 80) return { texto: "text-emerald-300", fondo: "bg-emerald-500" };
  if (p >= 60) return { texto: "text-sky-300", fondo: "bg-sky-500" };
  if (p >= 40) return { texto: "text-amber-300", fondo: "bg-amber-500" };
  return { texto: "text-rose-300", fondo: "bg-rose-500" };
}

export function Puntaje({ valor, size = 44 }: { valor: number; size?: number }) {
  const c = colorPuntaje(valor);
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-borde)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          className={c.fondo.replace("bg-", "stroke-")}
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * Math.min(100, Math.max(0, valor))) / 100}
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center text-xs font-bold ${c.texto}`}
      >
        {valor}
      </span>
    </div>
  );
}

const COLORES_ESTADO: Record<string, string> = {
  slate: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  sky: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  violet: "border-violet-500/40 bg-violet-500/15 text-violet-300",
  amber: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  orange: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  cyan: "border-cyan-500/40 bg-cyan-500/15 text-cyan-300",
  emerald: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  rose: "border-rose-500/40 bg-rose-500/15 text-rose-300",
  zinc: "border-zinc-500/40 bg-zinc-500/15 text-zinc-400",
};

export function InsigniaEstado({ estado }: { estado: EstadoVacante }) {
  const def = ESTADOS.find((e) => e.id === estado) ?? ESTADOS[0];
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        COLORES_ESTADO[def.color]
      }`}
    >
      {def.label}
    </span>
  );
}

export function BotonCopiar({
  texto,
  etiqueta = "Copiar",
}: {
  texto: string;
  etiqueta?: string;
}) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 1800);
    return () => clearTimeout(t);
  }, [ok]);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
        } catch {
          // Safari/permisos: caemos a selección manual
          window.prompt("Copia el texto manualmente:", texto);
        }
      }}
    >
      {ok ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
      {ok ? "Copiado" : etiqueta}
    </button>
  );
}

export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  ancho = "max-w-2xl",
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    function alTecla(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", alTecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTecla);
      document.body.style.overflow = "";
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCerrar}
    >
      <div
        className={`panel my-8 w-full ${ancho}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-borde)] px-5 py-3.5">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1 text-[var(--color-suave)] transition hover:bg-[var(--color-panel2)] hover:text-[var(--color-texto)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tarjeta({
  titulo,
  valor,
  detalle,
  acento,
}: {
  titulo: string;
  valor: string | number;
  detalle?: string;
  acento?: string;
}) {
  return (
    <div className="panel px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-suave)]">
        {titulo}
      </p>
      <p className={`mt-1 text-2xl font-bold ${acento ?? ""}`}>{valor}</p>
      {detalle && (
        <p className="mt-0.5 text-xs text-[var(--color-suave)]">{detalle}</p>
      )}
    </div>
  );
}
