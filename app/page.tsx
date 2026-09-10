"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  CalendarClock,
  Download,
  Inbox,
  KeyRound,
  Plus,
  Radar,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { ESTADOS } from "@/lib/types";
import { Alerta, EsqueletoPanel, InsigniaEstado, Puntaje, Tarjeta, Vacio } from "@/components/ui";

export default function Panel() {
  const { estado, listo, exportar, diasSinRespaldo } = useApp();
  const { vacantes, ajustes, perfil } = estado;

  const m = useMemo(() => {
    const por = (e: string) => vacantes.filter((v) => v.estado === e).length;
    const enviadas = vacantes.filter((v) =>
      ["postulada", "screening", "entrevista", "oferta", "rechazada"].includes(v.estado)
    ).length;
    const conRespuesta = vacantes.filter((v) =>
      ["screening", "entrevista", "oferta"].includes(v.estado)
    ).length;
    return {
      total: vacantes.length,
      enviadas,
      conRespuesta,
      entrevistas: por("entrevista") + por("oferta"),
      tasa: enviadas ? Math.round((conRespuesta / enviadas) * 100) : 0,
    };
  }, [vacantes]);

  const pendientes = useMemo(
    () =>
      vacantes
        .filter((v) => ["descubierta", "analizada", "preparada"].includes(v.estado))
        .sort((a, b) => (b.analisis?.puntaje ?? -1) - (a.analisis?.puntaje ?? -1))
        .slice(0, 6),
    [vacantes]
  );

  // El último mensaje lo escribió el reclutador: la pelota está en tu tejado.
  const esperandoRespuesta = useMemo(
    () =>
      estado.conversaciones
        .filter((c) => !c.archivada && c.mensajes.at(-1)?.de === "ellos")
        .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn)),
    [estado.conversaciones]
  );

  const acciones = useMemo(
    () =>
      vacantes
        .filter((v) => v.proximaAccion)
        .sort((a, b) =>
          (a.proximaAccion?.cuando ?? "").localeCompare(b.proximaAccion?.cuando ?? "")
        )
        .slice(0, 5),
    [vacantes]
  );

  const hoy = new Date().toISOString().slice(0, 10);

  if (!listo) return <EsqueletoPanel />;

  return (
    <div className="space-y-6">
      <header>
        {/* Sin perfil cargado el saludo quedaba en "Hola," a secas. */}
        <h1 className="text-2xl font-bold">
          {perfil.nombre ? `Hola, ${perfil.nombre.split(" ")[0]}` : "Hola"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-suave)]">
          Tu centro de mando para buscar, evaluar y ganar vacantes.
        </p>
      </header>

      {!ajustes.geminiApiKey && (
        <Alerta tipo="aviso">
          <span className="inline-flex items-center gap-2 font-semibold">
            <KeyRound size={15} /> El motor de IA está apagado.
          </span>{" "}
          Genera una API key gratis en{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Google AI Studio
          </a>{" "}
          y pégala en{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>
          . Sin ella puedes guardar vacantes, pero no analizarlas ni generar CVs.
        </Alerta>
      )}

      {diasSinRespaldo !== null && diasSinRespaldo >= 7 && (
        <Alerta tipo="aviso">
          Llevas {diasSinRespaldo} días sin respaldar. Tus datos viven solo en este
          navegador: si limpias la caché, se pierden.{" "}
          <button onClick={exportar} className="underline">
            Descargar respaldo ahora
          </button>
        </Alerta>
      )}
      {diasSinRespaldo === null && vacantes.length >= 3 && (
        <Alerta tipo="info">
          Ya tienes {vacantes.length} vacantes guardadas y nunca has respaldado.{" "}
          <button onClick={exportar} className="underline">
            Descargar respaldo
          </button>
        </Alerta>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tarjeta titulo="Vacantes guardadas" valor={m.total} />
        <Tarjeta titulo="Postulaciones enviadas" valor={m.enviadas} />
        <Tarjeta
          titulo="Tasa de respuesta"
          valor={`${m.tasa}%`}
          detalle={`${m.conRespuesta} de ${m.enviadas}`}
          acento={m.tasa >= 15 ? "text-emerald-300" : undefined}
        />
        <Tarjeta
          titulo="Esperan tu respuesta"
          valor={esperandoRespuesta.length}
          acento={esperandoRespuesta.length ? "text-amber-300" : undefined}
        />
        <Tarjeta
          titulo="En entrevista u oferta"
          valor={m.entrevistas}
          acento={m.entrevistas ? "text-emerald-300" : undefined}
        />
      </section>

      <section className="panel p-5">
        <h2 className="mb-4 text-sm font-semibold">Embudo</h2>
        <div className="flex flex-wrap gap-2">
          {ESTADOS.filter((e) => e.id !== "descartada").map((e) => {
            const n = vacantes.filter((v) => v.estado === e.id).length;
            return (
              <Link
                key={e.id}
                href={`/vacantes?estado=${e.id}`}
                className={`panel flex min-w-[104px] flex-1 flex-col gap-0.5 px-3 py-2.5 transition hover:border-[var(--color-acento)] ${
                  n === 0 ? "opacity-45" : ""
                }`}
              >
                <span className="text-lg font-bold">{n}</span>
                <span className="text-[11px] text-[var(--color-suave)]">{e.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Siguientes a trabajar</h2>
            <Link
              href="/vacantes"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-acento)] hover:underline"
            >
              Ver todas <ArrowRight size={13} className="icono-avanza" />
            </Link>
          </div>
          {pendientes.length === 0 ? (
            <Vacio
              titulo="Nada en cola"
              detalle="Busca vacantes en los agregadores o pega una oferta que hayas visto en LinkedIn o Computrabajo."
              accion={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/buscar" className="btn btn-primario">
                    <Radar size={15} /> Buscar vacantes
                  </Link>
                  <Link href="/vacantes?nueva=1" className="btn">
                    <Plus size={15} /> Pegar una oferta
                  </Link>
                </div>
              }
            />
          ) : (
            <ul className="space-y-2">
              {pendientes.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/vacantes/${v.id}`}
                    className="panel flex items-center gap-3 px-3.5 py-3 transition hover:border-[var(--color-acento)]"
                  >
                    {v.analisis ? (
                      <Puntaje valor={v.analisis.puntaje} size={40} />
                    ) : (
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-borde)] text-[10px] text-[var(--color-suave)]">
                        s/a
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {v.titulo}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-suave)]">
                        {v.empresa} · {v.fuente}
                      </span>
                    </span>
                    <InsigniaEstado estado={v.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock size={15} /> Seguimientos
          </h2>
          {acciones.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-suave)]">
              Sin seguimientos programados. Se crean solos cuando marcas una vacante
              como postulada.
            </p>
          ) : (
            <ul className="space-y-2">
              {acciones.map((v) => {
                const vencido = (v.proximaAccion?.cuando ?? "") <= hoy;
                return (
                  <li key={v.id}>
                    <Link
                      href={`/vacantes/${v.id}`}
                      className="panel block px-3.5 py-3 transition hover:border-[var(--color-acento)]"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {v.empresa}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            vencido ? "text-rose-300" : "text-[var(--color-suave)]"
                          }`}
                        >
                          {vencido ? "Vencido · " : ""}
                          {v.proximaAccion?.cuando}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--color-suave)]">
                        {v.proximaAccion?.que}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {esperandoRespuesta.length > 0 && (
            <div className="mt-5 border-t border-[var(--color-borde)] pt-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300">
                <Inbox size={15} /> Te toca responder
              </h3>
              <ul className="space-y-2">
                {esperandoRespuesta.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/conversaciones/${c.id}`}
                      className="panel block px-3.5 py-2.5 transition hover:border-[var(--color-acento)]"
                    >
                      <span className="block truncate text-sm font-semibold">
                        {c.contacto.nombre}
                        {c.contacto.empresa ? ` · ${c.contacto.empresa}` : ""}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--color-suave)]">
                        {c.mensajes.at(-1)?.texto.slice(0, 90)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vacantes.length > 0 && (
            <button onClick={exportar} className="btn mt-4 w-full">
              <Download size={15} className="icono-late" /> Descargar respaldo (.json)
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
