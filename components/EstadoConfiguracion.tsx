"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  CircleDashed,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { probarClave } from "@/lib/gemini";

type Resultado = { ok: boolean; mensaje: string } | "probando" | null;

/**
 * Comprueba en vivo cada pieza de la configuración en lugar de que el usuario
 * adivine por qué algo no funciona. Importa especialmente con Gemini: la
 * restricción geográfica da un error que sin contexto no dice nada.
 */
export default function EstadoConfiguracion() {
  const { estado, exportar, diasSinRespaldo } = useApp();
  const { ajustes, perfil } = estado;
  const [gemini, setGemini] = useState<Resultado>(null);
  const [adzuna, setAdzuna] = useState<Resultado>(null);
  const [jooble, setJooble] = useState<Resultado>(null);
  const [careerjet, setCareerjet] = useState<Resultado>(null);

  async function probarFuente(
    fuente: "adzuna" | "jooble" | "careerjet",
    set: (r: Resultado) => void
  ) {
    set("probando");
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: "marketing",
          fuentes: [fuente],
          adzunaAppId: ajustes.adzunaAppId,
          adzunaAppKey: ajustes.adzunaAppKey,
          joobleKey: ajustes.joobleKey,
          careerjetKey: ajustes.careerjetKey,
        }),
      });
      const d = await r.json();
      const fallo = d.fallos?.[0];
      if (fallo)
        set({ ok: false, mensaje: `${fallo.fuente} respondió: ${fallo.error}` });
      else if (!d.total)
        set({
          ok: false,
          mensaje:
            "La clave funciona (la API respondió sin error), pero esta búsqueda no devolvió vacantes.",
        });
      else set({ ok: true, mensaje: `Devolvió ${d.total} vacantes.` });
    } catch (e) {
      set({ ok: false, mensaje: e instanceof Error ? e.message : String(e) });
    }
  }

  // Huecos del perfil que el motor tiene prohibido rellenar por su cuenta.
  const faltaIngles = perfil.idiomas.some((i) => /pendiente/i.test(i.nivel));
  const faltaSalario = !perfil.preferencias.salarioObjetivo;
  const perfilCompleto = !faltaIngles && !faltaSalario;

  const filas: {
    clave: string;
    titulo: string;
    detalle: string;
    estado: "ok" | "falta" | "opcional";
    resultado?: Resultado;
    accion?: React.ReactNode;
  }[] = [
    {
      clave: "gemini",
      titulo: "Motor de IA (Gemini)",
      detalle: ajustes.geminiApiKey
        ? `Clave guardada · modelo ${ajustes.modelo}`
        : "Sin esto no se analiza nada ni se generan documentos.",
      estado: ajustes.geminiApiKey ? "ok" : "falta",
      resultado: gemini,
      accion: (
        <button
          className="btn py-1.5 text-xs"
          disabled={gemini === "probando" || !ajustes.geminiApiKey}
          onClick={async () => {
            setGemini("probando");
            setGemini(await probarClave(ajustes.geminiApiKey, ajustes.modelo));
          }}
        >
          Probar clave
        </button>
      ),
    },
    {
      clave: "adzuna",
      titulo: "Adzuna (vacantes en español)",
      detalle:
        ajustes.adzunaAppId && ajustes.adzunaAppKey
          ? "App ID y App Key guardados"
          : "Opcional. Sin esto no ves ofertas de España, México ni presenciales.",
      estado: ajustes.adzunaAppId && ajustes.adzunaAppKey ? "ok" : "opcional",
      resultado: adzuna,
      accion: (
        <button
          className="btn py-1.5 text-xs"
          disabled={adzuna === "probando" || !ajustes.adzunaAppId}
          onClick={() => probarFuente("adzuna", setAdzuna)}
        >
          Probar
        </button>
      ),
    },
    {
      clave: "jooble",
      titulo: "Jooble (Venezuela y LatAm)",
      detalle: ajustes.joobleKey
        ? "Clave guardada"
        : "Opcional. Es la fuente que mejor cubre Venezuela.",
      estado: ajustes.joobleKey ? "ok" : "opcional",
      resultado: jooble,
      accion: (
        <button
          className="btn py-1.5 text-xs"
          disabled={jooble === "probando" || !ajustes.joobleKey}
          onClick={() => probarFuente("jooble", setJooble)}
        >
          Probar
        </button>
      ),
    },
    {
      clave: "careerjet",
      titulo: "Careerjet (Venezuela, España y LatAm)",
      detalle: ajustes.careerjetKey
        ? "Clave guardada"
        : "Opcional. Gratuita, y la única fuente con clave que trae vacantes de Venezuela. La clave está en careerjet.com/partners, dentro de «Access API» de tu sitio.",
      estado: ajustes.careerjetKey ? "ok" : "opcional",
      resultado: careerjet,
      accion: (
        <button
          className="btn py-1.5 text-xs"
          disabled={careerjet === "probando" || !ajustes.careerjetKey}
          onClick={() => probarFuente("careerjet", setCareerjet)}
        >
          Probar
        </button>
      ),
    },
    {
      clave: "perfil",
      titulo: "Perfil maestro completo",
      detalle: perfilCompleto
        ? "Sin huecos: el motor puede responderlo todo."
        : `Falta ${[faltaIngles && "tu nivel de inglés", faltaSalario && "tu expectativa salarial"].filter(Boolean).join(" y ")}. El motor no puede inventarlos y dejará [COMPLETAR: …].`,
      estado: perfilCompleto ? "ok" : "falta",
      accion: (
        <Link href="/perfil" className="btn py-1.5 text-xs">
          Completar <ChevronRight size={13} />
        </Link>
      ),
    },
    {
      clave: "respaldo",
      titulo: "Respaldo de tus datos",
      detalle:
        diasSinRespaldo === null
          ? "Nunca has respaldado. Tus datos viven solo en este navegador."
          : `Último respaldo hace ${diasSinRespaldo} ${diasSinRespaldo === 1 ? "día" : "días"}.`,
      estado:
        diasSinRespaldo !== null && diasSinRespaldo < 7 ? "ok" : "falta",
      accion: (
        <button className="btn py-1.5 text-xs" onClick={exportar}>
          Descargar
        </button>
      ),
    },
  ];

  const pendientes = filas.filter((f) => f.estado === "falta").length;

  return (
    <section className="panel p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Estado de la configuración</h2>
        <span
          className={`chip ${pendientes ? "border-amber-500/40 text-amber-300" : "border-emerald-500/40 text-emerald-300"}`}
        >
          {pendientes
            ? `${pendientes} cosa${pendientes > 1 ? "s" : ""} por resolver`
            : "Todo listo"}
        </span>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-[var(--color-suave)]">
        Los botones de probar hacen una llamada real. Si algo falla te dice
        exactamente por qué, en vez de dejarte adivinando.
      </p>

      <ul className="space-y-2">
        {filas.map((f) => (
          <li
            key={f.clave}
            className="rounded-lg border border-[var(--color-borde)] px-3.5 py-3"
          >
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-0.5 shrink-0">
                {f.estado === "ok" ? (
                  <Check size={16} className="text-emerald-400" />
                ) : f.estado === "falta" ? (
                  <TriangleAlert size={16} className="text-amber-400" />
                ) : (
                  <CircleDashed size={16} className="text-[var(--color-suave)]" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{f.titulo}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-suave)]">
                  {f.detalle}
                </p>
                {f.resultado && f.resultado !== "probando" && (
                  <p
                    className={`mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed ${
                      f.resultado.ok ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {f.resultado.ok ? (
                      <Check size={13} className="mt-0.5 shrink-0" />
                    ) : (
                      <X size={13} className="mt-0.5 shrink-0" />
                    )}
                    {f.resultado.mensaje}
                  </p>
                )}
                {f.resultado === "probando" && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-suave)]">
                    <Loader2 size={13} className="animate-spin" /> Probando…
                  </p>
                )}
              </div>
              <div className="shrink-0">{f.accion}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
