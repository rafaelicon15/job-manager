"use client";

import { useState } from "react";
import { Flame, Mic, Sparkles, Target } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { prepararEntrevista, type GuionEntrevista } from "@/lib/gemini";
import type { Idioma, Vacante } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando } from "@/components/ui";

/**
 * Guion de entrevista para esta vacante concreta. Lo importante no son las
 * preguntas fáciles, sino el bloque de preguntas incómodas: los requisitos que
 * no cumple, los solapamientos de fechas, el título pendiente y el salario.
 */
export default function PanelEntrevista({ vacante }: { vacante: Vacante }) {
  const { estado, agregarDocumento } = useApp();
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  const [guion, setGuion] = useState<GuionEntrevista | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  const guardado = vacante.documentos.find((d) => d.tipo === "notas_entrevista");
  const activo =
    guion ?? (guardado ? (JSON.parse(guardado.contenido) as GuionEntrevista) : null);

  async function generar() {
    setCargando(true);
    setError("");
    try {
      const g = await prepararEntrevista(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        vacante,
        idioma
      );
      setGuion(g);
      agregarDocumento(vacante.id, {
        tipo: "notas_entrevista",
        titulo: `Guion de entrevista — ${vacante.empresa}`,
        contenido: JSON.stringify(g),
        idioma,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  /** Guion completo en texto plano, para imprimir o tener al lado en la llamada. */
  function comoTexto(g: GuionEntrevista): string {
    const p: string[] = [
      `GUION DE ENTREVISTA — ${vacante.titulo} · ${vacante.empresa}`,
      "",
      "ESTRATEGIA",
      g.estrategia,
      "",
      "DATOS A MEMORIZAR",
      ...g.datosAMemorizar.map((d) => `- ${d}`),
      "",
      "PREGUNTAS PROBABLES",
    ];
    for (const q of g.preguntas)
      p.push(
        "",
        `P: ${q.pregunta}`,
        `   (evalúan: ${q.porQue})`,
        `R: ${q.respuesta}`,
        `   NO: ${q.evitar}`
      );
    p.push("", "PREGUNTAS INCÓMODAS");
    for (const q of g.preguntasIncomodas)
      p.push("", `P: ${q.pregunta}`, `   (duele porque: ${q.porQueDuele})`, `R: ${q.respuesta}`);
    p.push(
      "",
      "TU TURNO DE PREGUNTAR",
      ...g.tuTurno.map((t) => `- ${t}`),
      "",
      "CIERRE",
      g.cierre
    );
    if (g.avisos.length) p.push("", "DECIDIR ANTES DE LA LLAMADA", ...g.avisos.map((a) => `- ${a}`));
    return p.join("\n");
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <div>
          <p className="etiqueta">Idioma de la entrevista</p>
          <div className="flex gap-1.5">
            {(["es", "en"] as Idioma[]).map((i) => (
              <button
                key={i}
                className={`chip ${idioma === i ? "border-[var(--color-acento)] text-[var(--color-acento)]" : ""}`}
                onClick={() => setIdioma(i)}
              >
                {i === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        {activo && <BotonCopiar texto={comoTexto(activo)} etiqueta="Copiar guion completo" />}
        <button className="btn btn-primario" onClick={generar} disabled={cargando}>
          <Sparkles size={15} />
          {cargando ? "Preparando…" : activo ? "Regenerar guion" : "Preparar entrevista"}
        </button>
      </div>

      {cargando && (
        <div className="panel px-4 py-3">
          <Cargando texto="Anticipando por dónde te van a apretar…" />
        </div>
      )}
      {error && <Alerta tipo="error">{error}</Alerta>}

      {!activo && !cargando && (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Mic size={26} className="text-[var(--color-suave)]" />
          <p className="text-base font-semibold">Sin guion todavía</p>
          <p className="max-w-lg text-sm leading-relaxed text-[var(--color-suave)]">
            El motor anticipa las preguntas de esta entrevista concreta con tu
            respuesta ya armada, y sobre todo las incómodas: los requisitos que no
            cumples, los solapamientos de fechas, el título pendiente y el salario.
            Todo apoyado solo en hechos de tu perfil.
          </p>
          {!vacante.analisis && (
            <p className="mt-2 max-w-lg text-xs text-amber-300">
              Analiza la vacante primero: sin el análisis el motor no sabe qué
              requisitos te faltan, y ahí está lo que más importa.
            </p>
          )}
        </div>
      )}

      {activo && (
        <>
          {activo.avisos.length > 0 && (
            <Alerta tipo="aviso">
              <p className="mb-1 font-semibold">Decide esto antes de la llamada:</p>
              <ul className="space-y-1">
                {activo.avisos.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </Alerta>
          )}

          <div className="panel p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Target size={15} /> Estrategia de la llamada
            </h3>
            <p className="text-sm leading-relaxed">{activo.estrategia}</p>
          </div>

          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold">
              Datos que debes tener frescos
            </h3>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {activo.datosAMemorizar.map((d, i) => (
                <li key={i} className="text-sm leading-relaxed">
                  • {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-200">
              <Flame size={16} /> Preguntas incómodas
            </h3>
            <p className="mb-3 text-xs leading-relaxed text-amber-100/70">
              Estas son las que deciden la entrevista. Léelas en voz alta antes de
              la llamada.
            </p>
            <ul className="space-y-4">
              {activo.preguntasIncomodas.map((q, i) => (
                <li key={i} className="border-l-2 border-amber-500/40 pl-3">
                  <p className="text-sm font-semibold text-amber-100">
                    {q.pregunta}
                  </p>
                  <p className="mt-0.5 text-xs italic leading-relaxed text-amber-100/70">
                    Duele porque: {q.porQueDuele}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                    {q.respuesta}
                  </p>
                  <div className="mt-1.5">
                    <BotonCopiar texto={q.respuesta} etiqueta="Copiar respuesta" />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold">
              Preguntas probables ({activo.preguntas.length})
            </h3>
            <ul className="space-y-2">
              {activo.preguntas.map((q, i) => {
                const id = `q${i}`;
                const open = abierta === id;
                return (
                  <li key={i} className="rounded-lg border border-[var(--color-borde)]">
                    <button
                      className="flex w-full items-start gap-2 px-3.5 py-3 text-left"
                      onClick={() => setAbierta(open ? null : id)}
                    >
                      <span className="mt-0.5 shrink-0 text-xs font-bold text-[var(--color-suave)]">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium">{q.pregunta}</span>
                    </button>
                    {open && (
                      <div className="space-y-2 border-t border-[var(--color-borde)] px-3.5 py-3">
                        <p className="text-xs italic text-[var(--color-suave)]">
                          Lo que evalúan: {q.porQue}
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {q.respuesta}
                        </p>
                        <p className="text-xs leading-relaxed text-rose-300">
                          No hagas esto: {q.evitar}
                        </p>
                        <BotonCopiar texto={q.respuesta} etiqueta="Copiar respuesta" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="mb-3 text-sm font-semibold">Lo que preguntas tú</h3>
              <ul className="space-y-2">
                {activo.tuTurno.map((t, i) => (
                  <li key={i} className="flex items-start justify-between gap-2">
                    <span className="text-sm leading-relaxed">• {t}</span>
                    <BotonCopiar texto={t} etiqueta="" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel p-5">
              <h3 className="mb-3 text-sm font-semibold">Cómo cerrar</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {activo.cierre}
              </p>
              <div className="mt-3">
                <BotonCopiar texto={activo.cierre} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
