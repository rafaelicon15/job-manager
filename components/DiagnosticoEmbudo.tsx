"use client";

import { useMemo } from "react";
import { Lightbulb, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { diagnosticar, type Corte } from "@/lib/embudo";
import { Alerta, Tarjeta, colorPuntaje } from "@/components/ui";

/**
 * Dónde se rompe tu embudo, no cuánto mide.
 *
 * "Tasa de respuesta: 12%" no le dice a nadie qué arreglar. Lo que cambia la
 * conducta es el corte: si con encaje bajo respondes al 3% y con encaje alto al
 * 55%, el problema no es tu CV, es a qué te postulas.
 */
export default function DiagnosticoEmbudo() {
  const { estado } = useApp();
  const d = useMemo(() => diagnosticar(estado.vacantes), [estado.vacantes]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta titulo="Postulaciones enviadas" valor={d.global.enviadas} />
        <Tarjeta
          titulo="Tasa de respuesta"
          valor={`${d.global.tasa}%`}
          detalle={`${d.global.respuestas} de ${d.global.enviadas}`}
          acento={colorPuntaje(d.global.tasa * 2).texto}
        />
        <Tarjeta
          titulo="Llegaron a entrevista"
          valor={d.global.entrevistas}
          detalle={
            d.global.respuestas
              ? `${Math.round((d.global.entrevistas / d.global.respuestas) * 100)}% de las respuestas`
              : "sin respuestas todavía"
          }
        />
      </div>

      {d.veredictos.length > 0 && (
        <div className="rounded-xl border border-[var(--color-acento)]/40 bg-[var(--color-acento)]/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Lightbulb size={16} className="text-[var(--color-acento)]" /> Lo que dicen
            tus números
          </h3>
          <ul className="space-y-3">
            {d.veredictos.map((v, i) => (
              <li key={i} className="text-sm leading-relaxed">
                {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.avisos.map((a, i) => (
        <Alerta key={i} tipo="aviso">
          {a}
        </Alerta>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tabla titulo="Por encaje con la oferta" cortes={d.porEncaje} />
        <Tabla titulo="Por fuente" cortes={d.porFuente} />
      </div>
      {d.porAngulo.length > 0 && (
        <Tabla titulo="Por ángulo vendido" cortes={d.porAngulo} />
      )}
    </div>
  );
}

function Tabla({ titulo, cortes }: { titulo: string; cortes: Corte[] }) {
  if (!cortes.length) return null;
  const max = Math.max(...cortes.map((c) => c.enviadas));

  return (
    <div className="panel p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <TrendingUp size={15} /> {titulo}
      </h3>
      <ul className="space-y-3">
        {cortes.map((c) => (
          <li key={c.etiqueta}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{c.etiqueta}</span>
              <span className="text-xs text-[var(--color-suave)]">
                {c.enviadas} {c.enviadas === 1 ? "envío" : "envíos"} ·{" "}
                <span className={`font-semibold ${colorPuntaje(c.tasa * 2).texto}`}>
                  {c.tasa}% responde
                </span>
              </span>
            </div>
            {/* La barra mide el volumen y el relleno la tasa: de un vistazo se
                ve dónde estás gastando los envíos y si sirven de algo. */}
            <div
              className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--color-borde)]"
              style={{ width: `${Math.max(12, (c.enviadas / max) * 100)}%` }}
            >
              <div
                className="h-full rounded-full bg-[var(--color-acento)]"
                style={{ width: `${c.tasa}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
