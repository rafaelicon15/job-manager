"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { generarRespuesta, type RespuestaGenerada } from "@/lib/gemini";
import type { Idioma, Vacante } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando, EsqueletoPaneles } from "@/components/ui";

const TONOS = [
  "Profesional y directo",
  "Cercano y conversacional",
  "Formal y corporativo",
  "Vendedor, orientado a resultados",
];

const PLANTILLAS = [
  {
    label: "Mensaje en frío a un reclutador",
    texto:
      "Escribe un mensaje de LinkedIn de máximo 300 caracteres para un reclutador al que no conozco, presentándome y pidiendo que consideren mi perfil.",
  },
  {
    label: "Seguimiento tras postular",
    texto:
      "Han pasado 7 días desde que postulé y no tengo respuesta. Escribe un mensaje de seguimiento breve que no suene desesperado.",
  },
  {
    label: "Agradecimiento tras entrevista",
    texto:
      "Acabo de terminar una entrevista. Escribe un email de agradecimiento que refuerce por qué encajo.",
  },
  {
    label: "Negociar el salario ofrecido",
    texto:
      "Me ofrecieron una cifra por debajo de mi objetivo. Escribe una respuesta que negocie al alza sin cerrar la puerta.",
  },
  {
    label: "Explicar por qué dejo mi trabajo actual",
    texto: "¿Por qué estás buscando salir de tu puesto actual?",
  },
  {
    label: "Justificar el título sin finalizar",
    texto:
      "En la entrevista me van a preguntar por mi TSU en Informática, que tengo pendiente el proyecto final. ¿Cómo lo explico sin que reste?",
  },
];

/** Vacante ficticia para poder consultar al asistente sin haber guardado ninguna. */
function vacanteGenerica(perfil: string): Vacante {
  return {
    id: "generica",
    titulo: "Consulta general de carrera",
    empresa: "",
    ubicacion: "",
    modalidad: "Remoto",
    fuente: "Asistente",
    descripcion: `Consulta general, sin una oferta concreta asociada. Perfil objetivo: ${perfil}`,
    estado: "descubierta",
    favorito: false,
    creadaEn: new Date().toISOString(),
    actualizadaEn: new Date().toISOString(),
    documentos: [],
    notas: [],
  };
}

export default function Asistente() {
  const { estado, listo } = useApp();
  const [idVacante, setIdVacante] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [extra, setExtra] = useState("");
  const [tono, setTono] = useState(TONOS[0]);
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [res, setRes] = useState<RespuestaGenerada | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const contexto = useMemo(
    () =>
      estado.vacantes.find((v) => v.id === idVacante) ??
      vacanteGenerica(estado.perfil.titular),
    [idVacante, estado.vacantes, estado.perfil.titular]
  );

  if (!listo) return <EsqueletoPaneles />;

  async function responder() {
    if (!pregunta.trim()) return;
    setCargando(true);
    setError("");
    setRes(null);
    try {
      setRes(
        await generarRespuesta(
          estado.ajustes.geminiApiKey,
          estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
          estado.perfil,
          contexto,
          pregunta,
          idioma,
          tono,
          extra
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Asistente</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-suave)]">
          Cualquier cosa que un reclutador te pregunte, respondida como tú y anclada a
          tu perfil real. Si eliges una vacante, adapta la respuesta a esa oferta.
        </p>
      </header>

      {!estado.ajustes.geminiApiKey && (
        <Alerta tipo="aviso">
          Necesitas tu API key de Gemini en{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>{" "}
          para usar el asistente.
        </Alerta>
      )}

      <section className="panel space-y-4 p-5">
        <div>
          <label className="etiqueta" htmlFor="ctx">
            Contexto
          </label>
          <select
            id="ctx"
            className="campo"
            value={idVacante}
            onChange={(e) => setIdVacante(e.target.value)}
          >
            <option value="">Sin vacante concreta (consulta general)</option>
            {estado.vacantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo} — {v.empresa}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiqueta" htmlFor="preg">
            ¿Qué necesitas responder o escribir?
          </label>
          <textarea
            id="preg"
            className="campo min-h-[110px] resize-y"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
            placeholder="Pega la pregunta del reclutador, o describe el mensaje que necesitas escribir."
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLANTILLAS.map((t) => (
              <button
                key={t.label}
                className="chip transition hover:border-[var(--color-acento)]"
                onClick={() => setPregunta(t.texto)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="extra-a">
            Contexto extra (opcional)
          </label>
          <textarea
            id="extra-a"
            className="campo min-h-[62px] resize-y"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Datos que solo tú sabes: nombres, cifras que te dieron, cómo fue la conversación…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="tono-a">
              Tono
            </label>
            <select
              id="tono-a"
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
            <label className="etiqueta" htmlFor="idioma-a">
              Idioma
            </label>
            <select
              id="idioma-a"
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
            <Sparkles size={15} className="icono-late" />
            {cargando ? "Redactando…" : "Responder como yo"}
          </button>
          {cargando && <Cargando texto="Pensando…" />}
        </div>
      </section>

      {error && <Alerta tipo="error">{error}</Alerta>}

      {res && (
        <>
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
              <h2 className="text-sm font-semibold">Respuesta</h2>
              <BotonCopiar texto={res.respuesta} />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{res.respuesta}</p>
          </div>
          {res.variantes.length > 0 && (
            <div className="panel p-5">
              <h2 className="mb-3 text-sm font-semibold">Versiones más cortas</h2>
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
        </>
      )}
    </div>
  );
}
