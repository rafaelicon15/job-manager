"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, ShieldAlert, Sparkles } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { revisarCoherencia, type RevisionCoherencia } from "@/lib/gemini";
import { Alerta, Cargando } from "@/components/ui";

/**
 * Contradicciones entre procesos distintos.
 *
 * El motor ya vigila la coherencia dentro de un hilo y dentro de una reunión.
 * Lo que nadie vigilaba es lo que pasa ENTRE procesos: a una empresa le dices
 * que tu disponibilidad es inmediata y a otra que necesitas treinta días. Eso
 * no lo descubre nadie hasta que dos reclutadores del mismo sector hablan entre
 * ellos, y entonces ya no hay arreglo.
 */
export default function PanelCoherencia() {
  const { estado } = useApp();
  const [revision, setRevision] = useState<RevisionCoherencia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  /**
   * Lo que has dicho por ahí, con su procedencia.
   *
   * Solo entran tus propias palabras: los mensajes que escribiste y los
   * resúmenes de tus reuniones. Lo que diga el reclutador no puede
   * contradecirte a ti.
   */
  const dichos = useMemo(() => {
    const salida: { donde: string; cuando: string; texto: string }[] = [];

    for (const c of estado.conversaciones) {
      if (c.archivada) continue;
      const donde = `${c.contacto.empresa || c.contacto.nombre}, por ${c.canal}`;
      for (const m of c.mensajes) {
        if (m.de !== "yo" || m.borrador || !m.texto.trim()) continue;
        salida.push({ donde, cuando: m.fecha.slice(0, 10), texto: m.texto });
      }
    }

    for (const v of estado.vacantes) {
      for (const r of v.reuniones ?? []) {
        const x = r.resumen;
        if (!x) continue;
        const donde = `${v.empresa}, en reunión`;
        // De la reunión entran las respuestas que diste y lo que prometiste,
        // que es donde uno se compromete sin darse cuenta.
        for (const q of x.preguntasQueMeHicieron)
          if (q.comoRespondi.trim())
            salida.push({
              donde,
              cuando: (r.fecha || r.creadaEn).slice(0, 10),
              texto: `Me preguntaron "${q.pregunta}" y contesté: ${q.comoRespondi}`,
            });
        for (const c of x.compromisosMios)
          salida.push({ donde, cuando: (r.fecha || r.creadaEn).slice(0, 10), texto: `Me comprometí a: ${c}` });
      }
    }

    // Lo más reciente primero y con tope: cuarenta fragmentos ya son un prompt
    // grande, y lo de hace seis meses rara vez sigue en juego.
    return salida
      .sort((a, b) => b.cuando.localeCompare(a.cuando))
      .slice(0, 40);
  }, [estado.conversaciones, estado.vacantes]);

  const sinClave = !estado.ajustes.geminiApiKey;
  const suficiente = dichos.length >= 2;

  async function revisar() {
    setCargando(true);
    setError("");
    try {
      setRevision(
        await revisarCoherencia(
          estado.ajustes.geminiApiKey,
          estado.ajustes.modelo,
          estado.perfil,
          dichos
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-[var(--color-suave)]">
          {suficiente
            ? `Se revisarán ${dichos.length} cosas que has dicho en ${
                new Set(dichos.map((d) => d.donde)).size
              } sitios distintos.`
            : "Hace falta que hayas escrito en al menos dos sitios para poder comparar."}
        </p>
        <button
          className="btn btn-primario"
          disabled={cargando || sinClave || !suficiente}
          title={sinClave ? "Falta la API key de Gemini en Ajustes" : ""}
          onClick={revisar}
        >
          <Sparkles size={15} />
          {cargando ? "Revisando…" : revision ? "Revisar otra vez" : "Revisar coherencia"}
        </button>
      </div>

      {cargando && (
        <div className="panel px-4 py-3">
          <Cargando texto="Cruzando lo que has dicho en cada sitio…" />
        </div>
      )}
      {error && <Alerta tipo="error">{error}</Alerta>}

      {!revision && !cargando && (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <ShieldCheck size={26} className="text-[var(--color-suave)]" />
          <p className="text-base font-semibold">Sin revisar</p>
          <p className="max-w-lg text-sm leading-relaxed text-[var(--color-suave)]">
            Cruza lo que has dicho en cada proceso para encontrar dónde te has
            contradicho: disponibilidad, años con una herramienta, expectativa
            salarial, motivo de la salida. Es lo que sale a la luz cuando dos
            reclutadores del mismo sector hablan entre ellos.
          </p>
        </div>
      )}

      {revision?.limpio && revision.contradicciones.length === 0 && (
        <Alerta tipo="ok">
          No se encontró ninguna contradicción entre lo que has dicho en unos
          sitios y otros. Revísalo otra vez cuando avancen los procesos.
        </Alerta>
      )}

      {revision && revision.contradicciones.length > 0 && (
        <div className="space-y-3">
          {revision.riesgoAlto.length > 0 && (
            <Alerta tipo="error">
              <p className="mb-1 font-semibold">Arregla esto esta semana:</p>
              <ul className="space-y-0.5">
                {revision.riesgoAlto.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </Alerta>
          )}

          {revision.contradicciones.map((c, i) => {
            const urgente = revision.riesgoAlto.some((r) =>
              c.asunto.toLowerCase().includes(r.toLowerCase())
            );
            return (
              <div
                key={i}
                className={`panel p-5 ${urgente ? "border-rose-500/40" : "border-amber-500/40"}`}
              >
                <h3 className="flex items-center gap-2 text-sm font-bold">
                  <ShieldAlert
                    size={15}
                    className={urgente ? "text-rose-300" : "text-amber-300"}
                  />
                  {c.asunto}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {c.dijiste.map((d, n) => (
                    <li
                      key={n}
                      className="border-l-2 border-[var(--color-borde)] pl-3 text-sm leading-relaxed"
                    >
                      {d}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-sm leading-relaxed">{c.porQueImporta}</p>
                <p className="mt-1.5 text-sm font-medium leading-relaxed text-[var(--color-acento)]">
                  {c.queHacer}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
