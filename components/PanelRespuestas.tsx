"use client";

import { useState } from "react";
import { MessageSquareQuote, Sparkles, Trash2 } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { generarRespuesta, type RespuestaGenerada } from "@/lib/gemini";
import type { Idioma, Vacante } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando } from "@/components/ui";

const TONOS = [
  "Profesional y directo",
  "Cercano y conversacional",
  "Formal y corporativo",
  "Vendedor, orientado a resultados",
];

const SUGERENCIAS = [
  "¿Por qué te interesa esta posición y nuestra empresa?",
  "¿Cuál es tu expectativa salarial?",
  "Cuéntame sobre ti en dos minutos.",
  "Háblame de un proyecto donde subiste la conversión. ¿Qué hiciste exactamente?",
  "¿Cuál es tu nivel de inglés?",
  "¿Por qué deberíamos contratarte a ti y no a otro candidato?",
  "Cuéntame de un error que cometiste y qué aprendiste.",
  "¿Cuánta experiencia tienes con [herramienta]?",
  "¿Por qué estás buscando cambiar de trabajo?",
  "¿Tienes disponibilidad inmediata? ¿Qué horario puedes cubrir?",
];

export default function PanelRespuestas({ vacante }: { vacante: Vacante }) {
  const { estado, agregarDocumento, borrarDocumento } = useApp();
  const [pregunta, setPregunta] = useState("");
  const [extra, setExtra] = useState("");
  const [tono, setTono] = useState(TONOS[0]);
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  const [res, setRes] = useState<RespuestaGenerada | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const historial = vacante.documentos.filter((d) => d.tipo === "respuesta");

  async function responder() {
    if (!pregunta.trim()) return;
    setCargando(true);
    setError("");
    setRes(null);
    try {
      const r = await generarRespuesta(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        vacante,
        pregunta,
        idioma,
        tono,
        extra
      );
      setRes(r);
      agregarDocumento(vacante.id, {
        tipo: "respuesta",
        titulo: pregunta.slice(0, 90),
        contenido: r.respuesta,
        idioma,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-4 p-5">
        <div>
          <label className="etiqueta" htmlFor="pregunta">
            Pregunta del reclutador o del formulario
          </label>
          <textarea
            id="pregunta"
            className="campo min-h-[90px] resize-y"
            placeholder="Pega aquí la pregunta tal cual te la hicieron…"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SUGERENCIAS.map((s) => (
              <button
                key={s}
                className="chip text-left transition hover:border-[var(--color-acento)]"
                onClick={() => setPregunta(s)}
              >
                {s.length > 46 ? s.slice(0, 46) + "…" : s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="extra">
            Contexto extra (opcional)
          </label>
          <textarea
            id="extra"
            className="campo min-h-[62px] resize-y"
            placeholder="Ej.: ya me dijeron que el rango es 1.200-1.500 €; o: el reclutador se llama Marta y es la Head of Growth."
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="tono">
              Tono
            </label>
            <select
              id="tono"
              className="campo"
              value={tono}
              onChange={(e) => setTono(e.target.value)}
            >
              {TONOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="idioma-resp">
              Idioma
            </label>
            <select
              id="idioma-resp"
              className="campo"
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as Idioma)}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-primario"
            onClick={responder}
            disabled={cargando || !pregunta.trim()}
          >
            <Sparkles size={15} />
            {cargando ? "Redactando…" : "Responder como yo"}
          </button>
          {cargando && <Cargando texto="Cruzando la pregunta con tu perfil…" />}
        </div>
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}

      {res && (
        <div className="space-y-3">
          {res.avisos.length > 0 && (
            <Alerta tipo="aviso">
              <ul className="space-y-1">
                {res.avisos.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </Alerta>
          )}
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Respuesta</h3>
              <BotonCopiar texto={res.respuesta} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{res.respuesta}</p>
          </div>
          {res.variantes.length > 0 && (
            <div className="panel p-5">
              <h3 className="mb-3 text-sm font-semibold">
                Versiones más cortas (para formularios con límite)
              </h3>
              <ul className="space-y-3">
                {res.variantes.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-l-2 border-[var(--color-borde)] pl-3"
                  >
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{v}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-suave)]">
                        {v.length} caracteres
                      </p>
                    </div>
                    <BotonCopiar texto={v} etiqueta="" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {historial.length > 0 && (
        <div className="panel p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MessageSquareQuote size={15} /> Respuestas guardadas de esta vacante
          </h3>
          <ul className="space-y-3">
            {historial.map((d) => (
              <li key={d.id} className="border-l-2 border-[var(--color-borde)] pl-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--color-suave)]">
                    {d.titulo}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <BotonCopiar texto={d.contenido} etiqueta="" />
                    <button
                      className="btn px-2 text-rose-300"
                      onClick={() => borrarDocumento(vacante.id, d.id)}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {d.contenido}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
