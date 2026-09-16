"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Radar, Scale, ShieldAlert, TrendingUp } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { analizarSilencios } from "@/lib/silencios";
import { Alerta, EsqueletoPaneles } from "@/components/ui";
import RadarSilencios from "@/components/RadarSilencios";
import DiagnosticoEmbudo from "@/components/DiagnosticoEmbudo";
import PanelCoherencia from "@/components/PanelCoherencia";
import ComparadorOfertas from "@/components/ComparadorOfertas";

type Pestana = "silencios" | "diagnostico" | "coherencia" | "ofertas";

/**
 * La revisión de tu propia búsqueda.
 *
 * Las otras pantallas sirven para trabajar una vacante concreta. Esta sirve
 * para mirar el conjunto, que es donde se pierden las búsquedas de empleo: por
 * procesos que se enfrían sin que nadie los toque, por repetir durante meses una
 * estrategia que no funciona sin darse cuenta, y por contradecirse entre una
 * empresa y otra.
 */
export default function Revision() {
  const { estado, listo } = useApp();
  const [pestana, setPestana] = useState<Pestana>("silencios");

  const callados = useMemo(
    () => (listo ? analizarSilencios(estado.vacantes, estado.conversaciones).length : 0),
    [estado.vacantes, estado.conversaciones, listo]
  );
  const ofertas = estado.vacantes.filter(
    (v) => v.oferta || ["oferta", "entrevista"].includes(v.estado)
  ).length;

  const PESTANAS: { id: Pestana; label: string; Icono: typeof Radar; insignia?: number }[] = [
    { id: "silencios", label: "Silencios", Icono: Radar, insignia: callados },
    { id: "diagnostico", label: "Diagnóstico", Icono: TrendingUp },
    { id: "coherencia", label: "Coherencia", Icono: ShieldAlert },
    { id: "ofertas", label: "Ofertas", Icono: Scale, insignia: ofertas },
  ];

  if (!listo) return <EsqueletoPaneles />;

  const sinClave = !estado.ajustes.geminiApiKey;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Revisión</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-suave)]">
          Cómo va tu búsqueda en conjunto: qué se está enfriando, qué no está
          funcionando, dónde te has contradicho y qué hay encima de la mesa.
        </p>
      </header>

      {sinClave && (
        <Alerta tipo="aviso">
          El motor está apagado: falta tu API key de Gemini en{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>
          . El diagnóstico y el comparador funcionan igual porque son aritmética
          sobre tus datos. Redactar seguimientos y revisar la coherencia sí
          necesitan el motor.
        </Alerta>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-borde)]">
        {PESTANAS.map(({ id, label, Icono, insignia }) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition ${
              pestana === id
                ? "border-[var(--color-acento)] font-semibold text-[var(--color-acento)]"
                : "border-transparent text-[var(--color-suave)] hover:text-[var(--color-texto)]"
            }`}
          >
            <Icono size={15} />
            {label}
            {insignia ? (
              <span className="rounded-full bg-[var(--color-borde)] px-1.5 text-[11px] font-semibold">
                {insignia}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {pestana === "silencios" && <RadarSilencios />}
      {pestana === "diagnostico" && <DiagnosticoEmbudo />}
      {pestana === "coherencia" && <PanelCoherencia />}
      {pestana === "ofertas" && <ComparadorOfertas />}
    </div>
  );
}
