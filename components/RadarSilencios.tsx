"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, CalendarPlus, Check, Radar, Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { redactarSeguimiento, type SeguimientoGenerado } from "@/lib/gemini";
import { analizarSilencios, etiquetaSilencio, type Silencio } from "@/lib/silencios";
import { crearIcs, nombreIcs } from "@/lib/ics";
import { descargarTexto } from "@/lib/descargar";
import type { Idioma } from "@/lib/types";
import { Alerta, BotonCopiar, Cargando } from "@/components/ui";

/**
 * Los procesos que llevan días callados.
 *
 * Existe porque la app los escondía sin querer: en cuanto marcabas la próxima
 * acción como hecha, esa postulación desaparecía de todas las pantallas. Te
 * postulaste hace veinte días, nadie contestó, y no había un solo sitio donde
 * eso se viera.
 */
export default function RadarSilencios() {
  const { estado, registrarToque, cambiarEstadoVacante, actualizarVacante } = useApp();
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [textos, setTextos] = useState<Record<string, SeguimientoGenerado>>({});

  const silencios = useMemo(
    () => analizarSilencios(estado.vacantes, estado.conversaciones),
    [estado.vacantes, estado.conversaciones]
  );

  const sinClave = !estado.ajustes.geminiApiKey;

  async function redactar(s: Silencio) {
    setTrabajando(s.vacante.id);
    setError("");
    try {
      const t = await redactarSeguimiento(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        s.vacante,
        s.dias,
        s.toques,
        s.queFue,
        idioma
      );
      setTextos((v) => ({ ...v, [s.vacante.id]: t }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrabajando(null);
    }
  }

  /** Apunta el toque y programa la siguiente revisión para dentro de una semana. */
  function marcarDado(s: Silencio) {
    registrarToque(s.vacante.id);
    actualizarVacante(s.vacante.id, {
      proximaAccion: {
        que: `Revisar si ${s.vacante.empresa} contestó al seguimiento`,
        cuando: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
      },
    });
  }

  function alCalendario(s: Silencio) {
    const cuando = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    descargarTexto(
      nombreIcs(`Seguimiento ${s.vacante.empresa}`),
      crearIcs({
        titulo: `Seguimiento: ${s.vacante.titulo} en ${s.vacante.empresa}`,
        inicio: cuando,
        descripcion: `Llevan ${s.dias} días sin contestar. Última señal: ${s.queFue}.`,
      }),
      "text/calendar"
    );
  }

  if (silencios.length === 0)
    return (
      <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
        <Radar size={26} className="text-[var(--color-suave)]" />
        <p className="text-base font-semibold">Ningún proceso está callado</p>
        <p className="max-w-lg text-sm leading-relaxed text-[var(--color-suave)]">
          Aparecerán aquí las postulaciones que lleven días sin señal. El reloj
          corre más rápido cuanto más avanzado está el proceso: una semana tras
          postularte es normal, pero cuatro días después de una entrevista final
          ya conviene escribir.
        </p>
      </div>
    );

  const urgentes = silencios.filter((s) => s.estado === "muerta").length;

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <div>
          <p className="etiqueta">Idioma del seguimiento</p>
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
        <p className="text-sm text-[var(--color-suave)]">
          {silencios.length} {silencios.length === 1 ? "proceso callado" : "procesos callados"}
          {urgentes > 0 && `, ${urgentes} sin margen`}
        </p>
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}

      {silencios.map((s) => {
        const t = textos[s.vacante.id];
        const grave = s.estado === "muerta";
        return (
          <div
            key={s.vacante.id}
            className={`panel p-4 ${grave ? "border-rose-500/40" : "border-amber-500/40"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/vacantes/${s.vacante.id}`}
                  className="text-sm font-semibold transition hover:text-[var(--color-acento)]"
                >
                  {s.vacante.titulo}
                  <span className="text-[var(--color-suave)]"> · {s.vacante.empresa}</span>
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`chip ${grave ? "border-rose-500/40 text-rose-300" : "border-amber-500/40 text-amber-300"}`}
                  >
                    <BellRing size={12} /> {etiquetaSilencio(s)}
                  </span>
                  <span className="chip">
                    {s.dias} {s.dias === 1 ? "día" : "días"} en silencio
                  </span>
                  <span className="chip">Última señal: {s.queFue}</span>
                  {s.toques > 0 && (
                    <span className="chip">
                      {s.toques} {s.toques === 1 ? "toque dado" : "toques dados"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <button
                  className="btn py-1.5 text-xs"
                  disabled={trabajando === s.vacante.id || sinClave}
                  title={sinClave ? "Falta la API key de Gemini en Ajustes" : ""}
                  onClick={() => redactar(s)}
                >
                  <Sparkles size={14} />
                  {trabajando === s.vacante.id ? "Redactando…" : t ? "Otra versión" : "Redactar toque"}
                </button>
                <button
                  className="btn px-2 py-1.5"
                  title="Apuntar el seguimiento en el calendario"
                  onClick={() => alCalendario(s)}
                >
                  <CalendarPlus size={14} />
                </button>
              </div>
            </div>

            {s.sugiereCerrar && (
              <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5">
                <p className="text-sm leading-relaxed text-rose-100">
                  Ya diste {s.toques} toques y llevan {s.dias} días sin contestar. Esto
                  no es un proceso lento, es un no que nadie se molestó en escribir.
                  Ciérralo y recupera la atención para otro sitio.
                </p>
                <button
                  className="btn mt-2 py-1.5 text-xs"
                  onClick={() => cambiarEstadoVacante(s.vacante.id, "descartada")}
                >
                  <X size={14} /> Darla por perdida
                </button>
              </div>
            )}

            {trabajando === s.vacante.id && (
              <div className="mt-3">
                <Cargando texto="Buscando una razón honesta para escribir hoy…" />
              </div>
            )}

            {t && (
              <div className="mt-3 space-y-3 border-t border-[var(--color-borde)] pt-3">
                {t.asunto && (
                  <div>
                    <p className="etiqueta">Asunto</p>
                    <p className="text-sm font-medium">{t.asunto}</p>
                  </div>
                )}
                <div>
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <p className="etiqueta mb-0">Mensaje</p>
                    <BotonCopiar texto={t.mensaje} etiqueta="Copiar" />
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.mensaje}</p>
                </div>
                <p className="text-xs italic leading-relaxed text-[var(--color-suave)]">
                  Por qué puede funcionar: {t.porQue}
                </p>
                {t.siNoContestan && (
                  <p className="text-xs leading-relaxed text-amber-300">
                    Si tampoco contestan: {t.siNoContestan}
                  </p>
                )}
                <button className="btn py-1.5 text-xs" onClick={() => marcarDado(s)}>
                  <Check size={14} /> Ya lo envié
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
