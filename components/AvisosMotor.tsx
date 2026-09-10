"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, X } from "lucide-react";
import { escucharMotor, type EventoMotor } from "@/lib/gemini";

interface Aviso {
  id: number;
  clase: "reintento" | "respaldo" | "fallo";
  titulo: string;
  detalle: string;
  /** Segundos que quedan de espera; solo para los reintentos. */
  restante?: number;
}

let secuencia = 0;

/**
 * Avisador global de lo que hace el motor. Se monta una sola vez en el layout,
 * así que no hay que tocar las 16 pantallas para que los errores se vean:
 * el aviso aparece igual aunque hayas hecho scroll o estés en otra pestaña
 * de la ficha.
 *
 * Los reintentos importan especialmente: en el plan gratuito de Gemini pueden
 * sumar 45 segundos de espera y sin este aviso parece que la app se colgó.
 */
export default function AvisosMotor() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  useEffect(() => {
    return escucharMotor((e: EventoMotor) => {
      if (e.tipo === "exito") {
        // Al terminar bien se limpian los reintentos, pero no los fallos:
        // esos los cierra el usuario cuando los ha leído.
        setAvisos((a) => a.filter((x) => x.clase === "fallo"));
        return;
      }
      const id = ++secuencia;
      if (e.tipo === "reintento") {
        setAvisos((a) => [
          ...a.filter((x) => x.clase !== "reintento"),
          {
            id,
            clase: "reintento",
            titulo: `${e.motivo}. Reintentando (${e.intento}/${e.tope})`,
            detalle: "La app espera y vuelve a intentarlo sola.",
            restante: Math.round(e.esperaMs / 1000),
          },
        ]);
      } else if (e.tipo === "respaldo") {
        setAvisos((a) => [
          ...a.filter((x) => x.clase !== "reintento"),
          {
            id,
            clase: "respaldo",
            titulo: "Se usó el modelo de respaldo",
            detalle: `${e.modeloOriginal} no respondía; la respuesta la generó ${e.modeloUsado}.`,
          },
        ]);
      } else {
        setAvisos((a) => [
          ...a.filter((x) => x.clase !== "reintento"),
          { id, clase: "fallo", titulo: "El motor falló", detalle: e.mensaje },
        ]);
      }
    });
  }, []);

  // Cuenta atrás de la espera, para que se vea que algo avanza.
  useEffect(() => {
    if (!avisos.some((a) => a.clase === "reintento")) return;
    const t = setInterval(() => {
      setAvisos((a) =>
        a.map((x) =>
          x.clase === "reintento" && x.restante && x.restante > 0
            ? { ...x, restante: x.restante - 1 }
            : x
        )
      );
    }, 1000);
    return () => clearInterval(t);
  }, [avisos]);

  // Los avisos informativos se van solos; los fallos se quedan.
  useEffect(() => {
    const efimeros = avisos.filter((a) => a.clase === "respaldo");
    if (!efimeros.length) return;
    const t = setTimeout(
      () => setAvisos((a) => a.filter((x) => x.clase !== "respaldo")),
      8000
    );
    return () => clearTimeout(t);
  }, [avisos]);

  if (!avisos.length) return null;

  const estilos = {
    reintento: "border-sky-500/40 bg-sky-500/15 text-sky-100",
    respaldo: "border-violet-500/40 bg-violet-500/15 text-violet-100",
    fallo: "border-rose-500/50 bg-rose-500/15 text-rose-100",
  };

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {avisos.map((a) => (
        <div
          key={a.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur ${estilos[a.clase]}`}
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0">
              {a.clase === "reintento" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : a.clase === "respaldo" ? (
                <ShieldCheck size={15} />
              ) : (
                <AlertTriangle size={15} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug">
                {a.titulo}
                {a.clase === "reintento" && a.restante !== undefined && a.restante > 0
                  ? ` · ${a.restante}s`
                  : ""}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed opacity-85">{a.detalle}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar aviso"
              className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
              onClick={() => setAvisos((s) => s.filter((x) => x.id !== a.id))}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
