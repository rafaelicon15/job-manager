"use client";

import { useState } from "react";
import { Mail, Sparkles } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { generarCarta, type CartaGenerada } from "@/lib/gemini";
import type { Idioma, Vacante } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando } from "@/components/ui";

const TONOS = [
  "Profesional y directo",
  "Cercano y conversacional",
  "Formal y corporativo",
  "Vendedor, orientado a resultados",
];

/**
 * Carta de presentación, asunto de correo y mensaje corto para el reclutador.
 * Se guardan como documentos de la vacante para poder recuperarlos después.
 */
export default function PanelCarta({ vacante }: { vacante: Vacante }) {
  const { estado, agregarDocumento } = useApp();
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  const [tono, setTono] = useState(TONOS[0]);
  const [res, setRes] = useState<CartaGenerada | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Recupera la última carta guardada si aún no se generó una en esta sesión.
  const guardada = vacante.documentos.find((d) => d.tipo === "carta");
  const mensajeGuardado = vacante.documentos.find(
    (d) => d.tipo === "mensaje_reclutador"
  );
  const activo: CartaGenerada | null =
    res ??
    (guardada
      ? {
          asuntoEmail: guardada.titulo,
          carta: guardada.contenido,
          mensajeReclutador: mensajeGuardado?.contenido ?? "",
          avisos: [],
        }
      : null);

  async function generar() {
    setCargando(true);
    setError("");
    try {
      const r = await generarCarta(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        vacante,
        idioma,
        tono
      );
      setRes(r);
      agregarDocumento(vacante.id, {
        tipo: "carta",
        titulo: r.asuntoEmail,
        contenido: r.carta,
        idioma,
      });
      agregarDocumento(vacante.id, {
        tipo: "mensaje_reclutador",
        titulo: `Mensaje a ${vacante.contacto?.nombre ?? "el reclutador"}`,
        contenido: r.mensajeReclutador,
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
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <div>
          <p className="etiqueta">Idioma</p>
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
        <div className="min-w-[220px]">
          <label className="etiqueta" htmlFor="tono-carta">
            Tono
          </label>
          <select
            id="tono-carta"
            className="campo py-1.5 text-xs"
            value={tono}
            onChange={(e) => setTono(e.target.value)}
          >
            {TONOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <button className="btn btn-primario" onClick={generar} disabled={cargando}>
          <Sparkles size={15} />
          {cargando ? "Redactando…" : activo ? "Regenerar" : "Generar carta y mensaje"}
        </button>
      </div>

      {cargando && (
        <div className="panel px-4 py-3">
          <Cargando texto="Escribiendo la carta y el mensaje al reclutador…" />
        </div>
      )}
      {error && <Alerta tipo="error">{error}</Alerta>}
      {!vacante.analisis && !activo && (
        <Alerta tipo="info">
          Analiza la vacante primero: la carta sale mucho mejor cuando el motor ya
          sabe qué requisitos cubres y cuáles no.
        </Alerta>
      )}

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

          <div className="panel p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-borde)] pb-3">
              <span className="flex items-center gap-2 text-sm">
                <Mail size={15} className="text-[var(--color-suave)]" />
                <span className="etiqueta mb-0">Asunto</span>
                <span className="font-semibold">{activo.asuntoEmail}</span>
              </span>
              <BotonCopiar texto={activo.asuntoEmail} etiqueta="Copiar asunto" />
            </div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Carta de presentación
                <span className="ml-2 font-normal text-[var(--color-suave)]">
                  {activo.carta.split(/\s+/).length} palabras
                </span>
              </h3>
              <BotonCopiar texto={activo.carta} etiqueta="Copiar carta" />
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {activo.carta}
            </p>
          </div>

          {activo.mensajeReclutador && (
            <div className="panel p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Mensaje para el reclutador
                  <span className="ml-2 font-normal text-[var(--color-suave)]">
                    {activo.mensajeReclutador.length} caracteres
                  </span>
                </h3>
                <BotonCopiar texto={activo.mensajeReclutador} />
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {activo.mensajeReclutador}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
