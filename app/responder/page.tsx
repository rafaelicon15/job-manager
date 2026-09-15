"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Chrome, Link2, Sparkles } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { generarRespuesta, type RespuestaGenerada } from "@/lib/gemini";
import type { Idioma, Vacante } from "@/lib/types";
import { buscarDuplicada, normalizar } from "@/lib/duplicados";
import { Alerta, BotonCopiar, Cargando, Vacio } from "@/components/ui";

interface Pregunta {
  texto: string;
  largo?: boolean;
}

interface Carga {
  preguntas?: Pregunta[];
  titulo?: string;
  empresa?: string;
  url?: string;
  /** De dónde se llegó al formulario. Ver el comentario en `sugerida`. */
  desde?: string;
}

/** Decodifica el base64-URL con bytes UTF-8 que manda la extensión. */
function decodificar(hash: string): Carga | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Carga;
  } catch {
    return null;
  }
}

/**
 * Responde las preguntas abiertas de un formulario de postulación.
 *
 * La extensión rellena lo que es un dato (nombre, correo, teléfono), pero hay
 * campos que no son datos: "¿qué experiencia tienes con GoHighLevel y qué
 * resultados conseguiste?". Eso no se copia de una ficha; se redacta contra el
 * perfil maestro, con las mismas reglas de honestidad que el resto de la app.
 *
 * Se responde aquí y no en la extensión por dos razones: la clave de Gemini
 * vive en este dominio y no tiene por qué salir de él, y una respuesta que va
 * a leer un reclutador hay que revisarla antes de pegarla, no verla aparecer
 * sola dentro de un formulario.
 */
export default function Responder() {
  const { estado, listo } = useApp();
  const { ajustes, perfil } = estado;

  const [carga, setCarga] = useState<Carga | null | "vacio">("vacio");
  const [idVacante, setIdVacante] = useState("");
  const [idioma, setIdioma] = useState<Idioma>("es");
  const [enCurso, setEnCurso] = useState("");
  const [error, setError] = useState("");
  const [respuestas, setRespuestas] = useState<Record<number, RespuestaGenerada>>({});
  /** Evita que el arranque automático se dispare dos veces. */
  const yaArrancado = useRef(false);

  useEffect(() => {
    // El hash nunca llega al servidor: las preguntas no salen del navegador
    // salvo cuando el motor las manda a Gemini.
    if (!window.location.hash || window.location.hash.length < 3) {
      setCarga("vacio");
      return;
    }
    setCarga(decodificar(window.location.hash));
  }, []);

  const preguntas = useMemo(
    () => (carga && carga !== "vacio" ? (carga.preguntas ?? []) : []),
    [carga]
  );

  /**
   * Si la oferta ya está guardada, se usa su ficha: trae la descripción y el
   * análisis, y con eso la respuesta sale mucho mejor apuntada.
   *
   * Se usa la misma regla que al guardar una vacante, no una comparación
   * propia. La URL del formulario casi nunca coincide con la de la oferta
   * (`/aplicar/123` frente a `/details/123`), así que lo que suele acertar es
   * el puesto y la empresa.
   */
  const sugerida = useMemo(() => {
    if (!carga || carga === "vacio" || !carga.titulo) return undefined;
    const exacta = buscarDuplicada(estado.vacantes, {
      titulo: carga.titulo,
      empresa: carga.empresa,
      url: carga.url,
    });
    if (exacta) return exacta;

    // Si el formulario vive en un ATS externo, su URL no se parece a la de la
    // oferta guardada, pero el referente suele ser esa misma oferta.
    if (carga.desde) {
      const porReferente = buscarDuplicada(estado.vacantes, {
        titulo: carga.titulo,
        url: carga.desde,
      });
      if (porReferente) return porReferente;
    }

    // Último intento, más laxo: el título del formulario suele traer dentro el
    // del puesto, con algo delante o detrás.
    const t = normalizar(carga.titulo);
    return estado.vacantes.find((v) => {
      const p = normalizar(v.titulo);
      return p.length > 8 && (t.includes(p) || p.includes(t));
    });
  }, [carga, estado.vacantes]);

  useEffect(() => {
    if (sugerida && !idVacante) setIdVacante(sugerida.id);
  }, [sugerida, idVacante]);

  const vacante = estado.vacantes.find((v) => v.id === idVacante);

  /** Vacante mínima para cuando la oferta no está guardada todavía. */
  const contexto: Vacante = useMemo(
    () =>
      vacante ??
      ({
        id: "sin-guardar",
        titulo: (carga !== "vacio" && carga?.titulo) || "Oferta sin guardar",
        empresa: (carga !== "vacio" && carga?.empresa) || "",
        ubicacion: "",
        modalidad: "",
        fuente: "Formulario de postulación",
        url: carga !== "vacio" ? carga?.url : undefined,
        descripcion:
          "La oferta no está guardada en la app. Responde con el perfil y el texto de la pregunta.",
        estado: "descubierta",
        favorito: false,
        creadaEn: "",
        actualizadaEn: "",
        documentos: [],
        notas: [],
        adjuntos: [],
        reuniones: [],
      } as Vacante),
    [vacante, carga]
  );

  const responderTodas = useCallback(async () => {
    setError("");
    if (!ajustes.geminiApiKey) {
      setError("Pon tu clave de Gemini en Ajustes: sin motor no puedo redactar nada.");
      return;
    }
    for (let i = 0; i < preguntas.length; i++) {
      // Se consulta el estado más reciente para no repetir lo ya respondido.
      let hecha = false;
      setRespuestas((prev) => {
        hecha = !!prev[i];
        return prev;
      });
      if (hecha) continue;

      setEnCurso(`Respondiendo ${i + 1} de ${preguntas.length}…`);
      try {
        const r = await generarRespuesta(
          ajustes.geminiApiKey,
          ajustes.modeloGeneracion || ajustes.modelo,
          perfil,
          contexto,
          preguntas[i].texto,
          idioma,
          "Profesional y directo",
          preguntas[i].largo
            ? "Es un campo de texto largo de un formulario: entre 60 y 120 palabras, sin saludo ni despedida."
            : "Es un campo de una sola línea de un formulario: responde en una o dos frases, sin saludo ni despedida."
        );
        setRespuestas((prev) => ({ ...prev, [i]: r }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        break;
      }
    }
    setEnCurso("");
  }, [ajustes, perfil, contexto, preguntas, idioma]);

  /**
   * Arranca solo. Esta pantalla no se abre a mano: la abre la extensión justo
   * después de rellenar el formulario, así que llegar aquí y encontrarse un
   * botón que hay que pulsar era un paso de más. Se espera a que el perfil
   * esté cargado y a que se haya resuelto la vacante, para que la primera
   * respuesta ya salga con el contexto bueno.
   */
  useEffect(() => {
    if (yaArrancado.current) return;
    if (!listo || !preguntas.length || !ajustes.geminiApiKey) return;
    // Si hay una vacante que enlazar, se espera a tenerla seleccionada.
    if (sugerida && !idVacante) return;
    yaArrancado.current = true;
    void responderTodas();
  }, [listo, preguntas, ajustes.geminiApiKey, sugerida, idVacante, responderTodas]);

  if (!listo) return <Cargando texto="Cargando tu perfil…" />;

  if (carga === "vacio" || !preguntas.length)
    return (
      <Vacio
        titulo="No hay preguntas que responder"
        detalle="Esta pantalla la abre la extensión de Chrome cuando encuentra preguntas abiertas en un formulario de postulación. Abre la oferta, pulsa la extensión y dale a «Rellenar este formulario»."
        accion={
          <Link href="/vacantes" className="btn btn-primario">
            <Chrome size={15} /> Ver mis postulaciones
          </Link>
        }
      />
    );

  const hechas = Object.keys(respuestas).length;

  return (
    <div className="aparece max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Preguntas del formulario</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-suave)]">
          {preguntas.length} preguntas de{" "}
          <span className="text-[var(--color-texto)]">
            {carga?.titulo || "la oferta"}
          </span>
          . Se responden con tu perfil maestro, así que no van a afirmar nada que
          no esté ahí. Revísalas y cópialas tú.
        </p>
      </header>

      {!ajustes.geminiApiKey && (
        <Alerta tipo="aviso">
          <p className="mb-1 font-semibold">El motor está apagado</p>
          <p className="leading-relaxed">
            Las preguntas están aquí, pero sin clave de Gemini no puedo redactar
            nada.{" "}
            <Link href="/ajustes" className="underline">
              Ponla en Ajustes
            </Link>{" "}
            y vuelve a esta pestaña.
          </p>
        </Alerta>
      )}

      <section className="panel space-y-3 p-5">
        {sugerida && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-emerald-300">
            <Link2 size={13} className="mt-0.5 shrink-0" />
            Reconocí la vacante: ya la tienes guardada como “{sugerida.titulo}”.
            Se usa su descripción{sugerida.analisis ? " y su análisis" : ""} para
            responder.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="vac">
              Vacante de la que hablan
            </label>
            <select
              id="vac"
              className="campo"
              value={idVacante}
              onChange={(e) => setIdVacante(e.target.value)}
            >
              <option value="">Sin enlazar (solo el título de la página)</option>
              {estado.vacantes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                  {v.empresa ? ` · ${v.empresa}` : ""}
                </option>
              ))}
            </select>
            {!sugerida && (
              <p className="mt-1 text-xs text-[var(--color-suave)]">
                No reconocí esta oferta entre las tuyas. Si la enlazas, el motor
                usa su descripción y su análisis, y las respuestas salen mucho
                mejor apuntadas.
              </p>
            )}
          </div>
          <div>
            <label className="etiqueta" htmlFor="idi">
              Idioma
            </label>
            <select
              id="idi"
              className="campo"
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as Idioma)}
            >
              <option value="es">Español</option>
              <option value="en">Inglés</option>
            </select>
            <p className="mt-1 text-xs text-[var(--color-suave)]">
              Responde en el idioma en el que está escrito el formulario.
            </p>
          </div>
        </div>

        <button className="btn btn-primario" disabled={!!enCurso} onClick={responderTodas}>
          <Sparkles size={15} className="icono-late" />
          {hechas === 0
            ? "Responder todas"
            : hechas < preguntas.length
              ? "Responder las que falten"
              : "Rehacer con estos ajustes"}
        </button>

        {enCurso && <Cargando texto={enCurso} />}
        {error && <Alerta tipo="error">{error}</Alerta>}
      </section>

      <ul className="aparece-escalonado space-y-3">
        {preguntas.map((p, i) => {
          const r = respuestas[i];
          return (
            <li
              key={i}
              className="panel space-y-3 p-5"
              style={{ "--i": i } as React.CSSProperties}
            >
              <p className="text-sm font-medium leading-relaxed">{p.texto}</p>

              {!r && !enCurso && (
                <p className="text-xs text-[var(--color-suave)]">
                  {ajustes.geminiApiKey
                    ? "Sin responder todavía."
                    : "Esperando la clave de Gemini."}
                </p>
              )}

              {r && (
                <>
                  <div className="rounded-lg border border-[var(--color-borde)] bg-[var(--color-panel2)] p-3.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {r.respuesta}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BotonCopiar texto={r.respuesta} etiqueta="Copiar respuesta" />
                    <span className="text-xs text-[var(--color-suave)]">
                      {r.respuesta.length} caracteres
                    </span>
                  </div>

                  {r.variantes.length > 0 && (
                    <details>
                      <summary className="cursor-pointer text-xs text-[var(--color-suave)]">
                        Otras versiones ({r.variantes.length})
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {r.variantes.map((v, j) => (
                          <li
                            key={j}
                            className="rounded-lg border border-[var(--color-borde)] p-3"
                          >
                            <p className="whitespace-pre-wrap text-xs leading-relaxed">{v}</p>
                            <div className="mt-2">
                              <BotonCopiar texto={v} etiqueta="Copiar" />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {r.avisos.length > 0 && (
                    <Alerta tipo="aviso">
                      <ul className="space-y-1">
                        {r.avisos.map((a, j) => (
                          <li key={j}>• {a}</li>
                        ))}
                      </ul>
                    </Alerta>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-[var(--color-suave)]">
        Nada de esto se envía solo. Copia lo que te convenza, pégalo en el
        formulario y revisa antes de darle a enviar.
      </p>
    </div>
  );
}
