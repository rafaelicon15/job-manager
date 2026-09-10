"use client";

import { useRef, useState } from "react";
import {
  CircleAlert,
  FileText,
  HelpCircle,
  Paperclip,
  ScrollText,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Adjunto, ClaseDocumento } from "@/lib/types";
import { useApp } from "@/lib/contexto";
import { analizarDocumento } from "@/lib/gemini";
import { leerArchivo, tamanoLegible } from "@/lib/archivos";
import { nuevoId } from "@/lib/store";
import { Alerta, BotonCopiar, Cargando, Vacio } from "@/components/ui";

const CLASES: Record<ClaseDocumento, string> = {
  descripcion_puesto: "Descripción del puesto",
  contrato: "Contrato",
  propuesta_economica: "Propuesta económica",
  prueba_tecnica: "Prueba técnica",
  confidencialidad: "Confidencialidad / NDA",
  otro: "Documento",
};

/**
 * Material que manda el reclutador, analizado contra el perfil. Sirve igual
 * para una conversación y para una vacante: el contenedor solo tiene que
 * decirle qué lista guarda y cómo guardarla.
 */
export default function Adjuntos({
  adjuntos,
  onCambio,
  contexto,
}: {
  adjuntos: Adjunto[];
  onCambio: (nuevos: Adjunto[]) => void;
  /** Una línea que sitúa el documento: el puesto, la empresa, el hilo. */
  contexto: string;
}) {
  const { estado } = useApp();
  const { ajustes, perfil } = estado;
  const entrada = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState("");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = [...(e.target.files ?? [])];
    e.target.value = "";
    if (!archivos.length) return;
    setError("");

    if (!ajustes.geminiApiKey) {
      setError("Pon tu clave de Gemini en Ajustes: sin motor no puedo leer el documento.");
      return;
    }

    const nuevos: Adjunto[] = [];
    for (const f of archivos) {
      setCargando(`Leyendo "${f.name}"…`);
      try {
        const leido = await leerArchivo(f);
        setCargando(`Analizando "${f.name}"… puede tardar 20-60 segundos.`);
        const analisis = await analizarDocumento(
          ajustes.geminiApiKey,
          ajustes.modeloGeneracion || ajustes.modelo,
          perfil,
          leido.nombre,
          contexto,
          leido.via === "inline"
            ? { via: "inline", mimeType: leido.mimeType, datos: leido.datos! }
            : { via: "texto", texto: leido.texto! }
        );
        nuevos.push({
          id: nuevoId("adj"),
          nombre: leido.nombre,
          bytes: leido.bytes,
          tipo: leido.mimeType,
          subidoEn: new Date().toISOString(),
          analisis,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        break;
      }
    }
    setCargando("");
    if (nuevos.length) {
      onCambio([...nuevos, ...adjuntos]);
      setAbierto(nuevos[0].id);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip size={15} /> Material del reclutador
          {adjuntos.length > 0 && (
            <span className="text-[var(--color-suave)]">({adjuntos.length})</span>
          )}
        </h2>
        <button
          className="btn py-1.5 text-xs"
          disabled={!!cargando}
          onClick={() => entrada.current?.click()}
        >
          <Paperclip size={13} className="icono-late" /> Añadir documento
        </button>
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-suave)]">
        La descripción del puesto, un contrato, una propuesta o una prueba
        técnica. Acepto PDF, imágenes, .docx, .txt y .csv. Se guarda el análisis,
        no el archivo: el original se queda en tu disco.
      </p>

      <input
        ref={entrada}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt,.csv,.md,.json"
        className="hidden"
        onChange={alElegir}
      />

      {cargando && <Cargando texto={cargando} />}
      {error && <Alerta tipo="error">{error}</Alerta>}

      {!adjuntos.length && !cargando && (
        <Vacio
          titulo="Nada adjunto todavía"
          detalle="Si te mandan un contrato o una propuesta, súbelo aquí antes de responder. Te digo qué dice, qué se calla y qué preguntar."
        />
      )}

      <ul className="space-y-2">
        {adjuntos.map((a) => {
          const an = a.analisis;
          const desplegado = abierto === a.id;
          return (
            <li key={a.id} className="rounded-lg border border-[var(--color-borde)]">
              <div className="flex flex-wrap items-start gap-2.5 p-3">
                <ScrollText size={15} className="mt-0.5 shrink-0 text-[var(--color-suave)]" />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setAbierto(desplegado ? null : a.id)}
                >
                  <p className="truncate text-sm font-medium">{an?.titulo || a.nombre}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-suave)]">
                    {an ? CLASES[an.clase] : "Sin analizar"} · {a.nombre} ·{" "}
                    {tamanoLegible(a.bytes)}
                    {an?.alertas.length ? (
                      <span className="ml-1.5 text-amber-300">
                        · {an.alertas.length}{" "}
                        {an.alertas.length === 1 ? "alerta" : "alertas"}
                      </span>
                    ) : null}
                  </p>
                </button>
                <button
                  className="shrink-0 rounded-md p-1.5 text-[var(--color-suave)] transition hover:bg-[var(--color-panel2)] hover:text-rose-300"
                  aria-label={`Quitar ${a.nombre}`}
                  onClick={() => onCambio(adjuntos.filter((x) => x.id !== a.id))}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {desplegado && an && (
                <div className="aparece space-y-4 border-t border-[var(--color-borde)] p-4">
                  <p className="text-sm leading-relaxed">{an.resumen}</p>

                  {an.alertas.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <TriangleAlert size={13} /> Míralo dos veces antes de aceptar
                      </h3>
                      {an.alertas.map((al, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
                        >
                          <p className="text-sm font-medium">{al.asunto}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--color-suave)]">
                            {al.porque}
                          </p>
                          <p className="mt-1.5 text-xs leading-relaxed text-emerald-300">
                            → {al.queHacer}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {an.cifras.length > 0 && (
                    <div>
                      <h3 className="mb-1.5 text-xs font-semibold">Cifras del documento</h3>
                      <ul className="space-y-1">
                        {an.cifras.map((c, i) => (
                          <li key={i} className="flex flex-wrap gap-2 text-xs">
                            <span className="text-[var(--color-suave)]">{c.concepto}:</span>
                            <span className="font-medium">{c.valor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {an.puntosClave.length > 0 && (
                    <div>
                      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                        <FileText size={13} /> Lo que importa
                      </h3>
                      <ul className="space-y-1">
                        {an.puntosClave.map((t, i) => (
                          <li key={i} className="text-xs leading-relaxed">
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {an.encaje && (
                    <div>
                      <h3 className="mb-1 text-xs font-semibold">Cómo te cuadra</h3>
                      <p className="text-xs leading-relaxed text-[var(--color-suave)]">
                        {an.encaje}
                      </p>
                    </div>
                  )}

                  {an.huecos.length > 0 && (
                    <div>
                      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                        <CircleAlert size={13} /> Lo que no dice
                      </h3>
                      <ul className="space-y-1">
                        {an.huecos.map((t, i) => (
                          <li key={i} className="text-xs leading-relaxed">
                            • {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {an.preguntasQueHacer.length > 0 && (
                    <div>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
                          <HelpCircle size={13} /> Pregunta esto por escrito
                        </h3>
                        <BotonCopiar
                          texto={an.preguntasQueHacer.map((q) => `- ${q}`).join("\n")}
                          etiqueta="Copiar preguntas"
                        />
                      </div>
                      <ul className="space-y-1.5">
                        {an.preguntasQueHacer.map((q, i) => (
                          <li key={i} className="text-xs leading-relaxed">
                            • {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-[11px] text-[var(--color-suave)]">
                    No es asesoría legal. Señala qué mirar, no si debes firmar.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
