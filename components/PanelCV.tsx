"use client";

import { useState } from "react";
import { Download, Eye, FileText, Sparkles } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { generarCV, type CVGenerado } from "@/lib/gemini";
import { cvComoTextoPlano, descargarCVPDF, previsualizarCVPDF } from "@/lib/pdf";
import type { Idioma, Vacante } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando, Modal } from "@/components/ui";

export default function PanelCV({ vacante }: { vacante: Vacante }) {
  const { estado, agregarDocumento, actualizarVacante } = useApp();
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  const [cv, setCv] = useState<CVGenerado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [previa, setPrevia] = useState("");

  // Recupera el último CV guardado para esta vacante si aún no se generó uno.
  const guardado = vacante.documentos.find((d) => d.tipo === "cv");
  const activo =
    cv ?? (guardado ? (JSON.parse(guardado.contenido) as CVGenerado) : null);

  async function generar() {
    setCargando(true);
    setError("");
    try {
      const res = await generarCV(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        vacante,
        idioma
      );
      setCv(res);
      agregarDocumento(vacante.id, {
        tipo: "cv",
        titulo: `CV ${idioma.toUpperCase()} — ${vacante.empresa}`,
        contenido: JSON.stringify(res),
        idioma,
      });
      if (["descubierta", "analizada"].includes(vacante.estado))
        actualizarVacante(vacante.id, { estado: "preparada" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <div>
          <p className="etiqueta">Idioma del CV</p>
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
        <button className="btn btn-primario" onClick={generar} disabled={cargando}>
          <Sparkles size={15} />
          {cargando ? "Redactando…" : activo ? "Regenerar CV" : "Generar CV ATS"}
        </button>
      </div>

      {!vacante.analisis && (
        <Alerta tipo="info">
          Analiza la vacante primero. El CV sale mucho mejor cuando el motor ya sabe
          qué ángulo vender y qué keywords necesita el ATS.
        </Alerta>
      )}
      {cargando && (
        <div className="panel px-4 py-3">
          <Cargando texto="Reescribiendo tu experiencia para esta oferta…" />
        </div>
      )}
      {error && <Alerta tipo="error">{error}</Alerta>}

      {activo && (
        <>
          {activo.avisos.length > 0 && (
            <Alerta tipo="aviso">
              <p className="mb-1 font-semibold">Revisa antes de enviar:</p>
              <ul className="space-y-1">
                {activo.avisos.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </Alerta>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primario"
              onClick={() =>
                descargarCVPDF(activo, estado.perfil, vacante.empresa || "empresa", idioma)
              }
            >
              <Download size={15} /> Descargar PDF
            </button>
            <button
              className="btn"
              onClick={() => setPrevia(previsualizarCVPDF(activo, estado.perfil, idioma))}
            >
              <Eye size={15} /> Vista previa
            </button>
            <BotonCopiar
              texto={cvComoTextoPlano(activo, estado.perfil)}
              etiqueta="Copiar como texto plano"
            />
          </div>

          <div className="panel space-y-5 p-5">
            <div>
              <h3 className="text-lg font-bold">{estado.perfil.nombre}</h3>
              <p className="text-sm font-semibold text-[var(--color-acento)]">
                {activo.titular}
              </p>
              <p className="mt-1 text-xs text-[var(--color-suave)]">
                {[estado.perfil.email, estado.perfil.telefono, estado.perfil.ubicacion].join(
                  "  |  "
                )}
              </p>
            </div>

            <Seccion titulo="Resumen">
              <p className="text-sm leading-relaxed">{activo.resumen}</p>
            </Seccion>

            <Seccion titulo="Experiencia">
              <div className="space-y-4">
                {activo.experiencias.map((e, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold">{e.puesto}</p>
                    <p className="text-xs italic text-[var(--color-suave)]">
                      {[e.empresa, e.ubicacion, e.periodo].filter(Boolean).join(" | ")}
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {e.bullets.map((b, j) => (
                        <li key={j} className="text-sm leading-relaxed">
                          <span className="text-[var(--color-suave)]">•</span> {b.texto}
                          <span className="ml-1.5 text-[10px] text-[var(--color-suave)]">
                            [{b.origen}]
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Seccion>

            <Seccion titulo="Habilidades">
              <div className="space-y-1.5">
                {activo.habilidades.map((h, i) => (
                  <p key={i} className="text-sm leading-relaxed">
                    <span className="font-semibold">{h.categoria}:</span>{" "}
                    {h.items.join(", ")}
                  </p>
                ))}
              </div>
            </Seccion>

            {activo.certificaciones.length > 0 && (
              <Seccion titulo="Certificaciones">
                <ul className="space-y-1">
                  {activo.certificaciones.map((c, i) => (
                    <li key={i} className="text-sm">
                      • {c}
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            {activo.educacion.length > 0 && (
              <Seccion titulo="Educación">
                <ul className="space-y-1">
                  {activo.educacion.map((e, i) => (
                    <li key={i} className="text-sm">
                      • {e}
                    </li>
                  ))}
                </ul>
              </Seccion>
            )}

            {activo.idiomas.length > 0 && (
              <Seccion titulo="Idiomas">
                <p className="text-sm">{activo.idiomas.join("  |  ")}</p>
              </Seccion>
            )}
          </div>

          <p className="text-xs leading-relaxed text-[var(--color-suave)]">
            La etiqueta entre corchetes tras cada bullet es el id del logro de tu perfil
            del que sale. Sirve para que verifiques de un vistazo que nada está
            inventado; no aparece en el PDF.
          </p>
        </>
      )}

      {!activo && !cargando && (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <FileText size={26} className="text-[var(--color-suave)]" />
          <p className="text-base font-semibold">Sin CV generado</p>
          <p className="max-w-md text-sm leading-relaxed text-[var(--color-suave)]">
            El motor reordena y reescribe tus logros reales para esta oferta, integra
            las keywords del ATS y produce un PDF de una sola columna con capa de
            texto real: el formato que los filtros saben leer.
          </p>
        </div>
      )}

      <Modal
        abierto={!!previa}
        onCerrar={() => setPrevia("")}
        titulo="Vista previa del PDF"
        ancho="max-w-4xl"
      >
        <iframe
          src={previa}
          className="h-[70vh] w-full rounded-lg border border-[var(--color-borde)] bg-white"
          title="Vista previa del CV"
        />
      </Modal>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 border-b border-[var(--color-borde)] pb-1 text-xs font-bold uppercase tracking-wide text-[var(--color-suave)]">
        {titulo}
      </p>
      {children}
    </div>
  );
}
