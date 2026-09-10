"use client";

import { useState } from "react";
import { AlertOctagon, RefreshCw, Sparkles } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { analizarVacante } from "@/lib/gemini";
import type { Vacante } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando, Puntaje, colorPuntaje } from "@/components/ui";

const VEREDICTOS: Record<string, { label: string; clase: string }> = {
  aplicar_ya: { label: "Aplica ya", clase: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" },
  aplicar: { label: "Vale la pena", clase: "text-sky-300 border-sky-500/40 bg-sky-500/10" },
  dudoso: { label: "Tiro largo", clase: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  no_aplicar: { label: "No apliques", clase: "text-rose-300 border-rose-500/40 bg-rose-500/10" },
};

const COBERTURA = {
  si: { label: "Cubierto", clase: "text-emerald-300" },
  parcial: { label: "Parcial", clase: "text-amber-300" },
  no: { label: "No cubierto", clase: "text-rose-300" },
};

export default function PanelAnalisis({ vacante }: { vacante: Vacante }) {
  const { estado, actualizarVacante } = useApp();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const a = vacante.analisis;

  async function analizar() {
    setCargando(true);
    setError("");
    try {
      const res = await analizarVacante(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modelo,
        estado.perfil,
        vacante
      );
      actualizarVacante(vacante.id, {
        analisis: res,
        estado: vacante.estado === "descubierta" ? "analizada" : vacante.estado,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  if (!a) {
    return (
      <div className="space-y-4">
        {error && <Alerta tipo="error">{error}</Alerta>}
        <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
          <p className="text-base font-semibold">Sin analizar todavía</p>
          <p className="max-w-md text-sm leading-relaxed text-[var(--color-suave)]">
            El motor va a cruzar esta oferta contra tu perfil maestro: qué requisitos
            cumples de verdad, dónde estás flojo, qué ángulo vender y qué keywords ATS
            debe llevar el CV.
          </p>
          <button className="btn btn-primario" onClick={analizar} disabled={cargando}>
            <Sparkles size={15} />
            {cargando ? "Analizando…" : "Analizar encaje"}
          </button>
          {cargando && <Cargando texto="Puede tardar 15-40 segundos." />}
        </div>
      </div>
    );
  }

  const v = VEREDICTOS[a.veredicto] ?? VEREDICTOS.dudoso;

  return (
    <div className="space-y-4">
      {error && <Alerta tipo="error">{error}</Alerta>}

      <div className="panel p-5">
        <div className="flex flex-wrap items-center gap-4">
          <Puntaje valor={a.puntaje} size={62} />
          <div className="min-w-0 flex-1">
            <span className={`inline-flex rounded-full border px-3 py-0.5 text-xs font-bold ${v.clase}`}>
              {v.label}
            </span>
            <p className="mt-2 text-sm leading-relaxed">{a.razonVeredicto}</p>
          </div>
          <button className="btn" onClick={analizar} disabled={cargando}>
            <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
            Reanalizar
          </button>
        </div>
        <div className="mt-4 grid gap-3 border-t border-[var(--color-borde)] pt-4 sm:grid-cols-2">
          <div>
            <p className="etiqueta">Ángulo a vender</p>
            <p className="text-sm font-semibold">{a.anguloRecomendado}</p>
          </div>
          <div>
            <p className="etiqueta">Titular sugerido para el CV</p>
            <p className="text-sm font-semibold">{a.titularSugerido}</p>
          </div>
        </div>
      </div>

      {a.banderasRojas.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-200">
            <AlertOctagon size={16} /> Banderas rojas de esta oferta
          </p>
          <ul className="space-y-1.5">
            {a.banderasRojas.map((b, i) => (
              <li key={i} className="text-sm leading-relaxed text-rose-100/90">
                • {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel p-5">
        <h3 className="mb-3 text-sm font-semibold">
          Requisitos ({a.requisitos.filter((r) => r.cubierto === "si").length} de{" "}
          {a.requisitos.length} cubiertos)
        </h3>
        <ul className="space-y-2.5">
          {a.requisitos.map((r, i) => {
            const c = COBERTURA[r.cubierto];
            return (
              <li key={i} className="border-l-2 border-[var(--color-borde)] pl-3.5">
                <p className="flex flex-wrap items-baseline gap-2 text-sm font-medium">
                  {r.requisito}
                  <span className={`text-[11px] font-bold uppercase ${c.clase}`}>
                    {c.label}
                  </span>
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-suave)]">
                  {r.evidencia}
                </p>
                {r.comoResponder && (
                  <p className="mt-1 text-xs leading-relaxed text-sky-300/90">
                    Si te preguntan: {r.comoResponder}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-emerald-300">
            Dónde eres más fuerte
          </h3>
          <ul className="space-y-2">
            {a.fortalezas.map((f, i) => (
              <li key={i} className="text-sm leading-relaxed">
                • {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="panel p-5">
          <h3 className="mb-3 text-sm font-semibold text-amber-300">
            Brechas y cómo cubrirlas
          </h3>
          <ul className="space-y-3">
            {a.brechas.map((b, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{b.brecha}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-suave)]">
                  → {b.mitigacion}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Keywords ATS obligatorias</h3>
          <BotonCopiar texto={a.keywordsATS.join(", ")} etiqueta="Copiar lista" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {a.keywordsATS.map((k, i) => (
            <span key={i} className="chip">
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="mb-3 text-sm font-semibold">Preguntas que deberías hacerles</h3>
        <ul className="space-y-2">
          {a.preguntasParaElReclutador.map((p, i) => (
            <li key={i} className="flex items-start justify-between gap-3">
              <span className="text-sm leading-relaxed">• {p}</span>
              <BotonCopiar texto={p} etiqueta="" />
            </li>
          ))}
        </ul>
      </div>

      <p className={`text-xs ${colorPuntaje(a.puntaje).texto}`}>
        Analizado el {new Date(a.generadoEn).toLocaleString("es")} con {a.modelo}.
      </p>
    </div>
  );
}
