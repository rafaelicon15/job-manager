"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookmarkPlus,
  ExternalLink,
  Filter,
  Search,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { triarLote } from "@/lib/gemini";
import type { VacanteCruda } from "@/app/api/jobs/route";
import { Alerta, Cargando, Puntaje, Vacio, colorPuntaje } from "@/components/ui";

const FUENTES = [
  { id: "remotive", label: "Remotive", requiereClave: false },
  { id: "remoteok", label: "RemoteOK", requiereClave: false },
  { id: "arbeitnow", label: "Arbeitnow", requiereClave: false },
  { id: "jobicy", label: "Jobicy", requiereClave: false },
  { id: "wwr", label: "WeWorkRemotely", requiereClave: false },
  { id: "adzuna", label: "Adzuna", requiereClave: true },
  { id: "jooble", label: "Jooble", requiereClave: true },
  { id: "careerjet", label: "Careerjet", requiereClave: true },
];

export default function Buscar() {
  const { estado, agregarVacante } = useApp();
  const { ajustes, perfil, vacantes } = estado;

  const [query, setQuery] = useState("");
  const [fuentes, setFuentes] = useState<string[]>(FUENTES.map((f) => f.id));
  const [resultados, setResultados] = useState<VacanteCruda[]>([]);
  const [puntajes, setPuntajes] = useState<Record<string, { puntaje: number; motivo: string }>>({});
  const [buscando, setBuscando] = useState(false);
  const [triando, setTriando] = useState(false);
  // Cuántas se han puntuado ya, para que el lote no parezca colgado.
  const [progreso, setProgreso] = useState({ hechas: 0, total: 0 });
  const [error, setError] = useState("");
  const [fallos, setFallos] = useState<{ fuente: string; error: string }[]>([]);
  const [soloBuenas, setSoloBuenas] = useState(false);
  const [guardadas, setGuardadas] = useState<Record<string, string>>({});

  // Evita ofrecer "guardar" algo que ya está en el tablero.
  const yaGuardadas = useMemo(
    () =>
      new Set(
        vacantes.map((v) => `${v.empresa}|${v.titulo}`.toLowerCase().replace(/[^a-z0-9|]/g, ""))
      ),
    [vacantes]
  );
  const claveDe = (v: VacanteCruda) =>
    `${v.empresa}|${v.titulo}`.toLowerCase().replace(/[^a-z0-9|]/g, "");

  const buscar = useCallback(async () => {
    setBuscando(true);
    setError("");
    setFallos([]);
    setPuntajes({});
    try {
      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          fuentes,
          adzunaAppId: ajustes.adzunaAppId,
          adzunaAppKey: ajustes.adzunaAppKey,
          joobleKey: ajustes.joobleKey,
          careerjetKey: ajustes.careerjetKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setResultados(d.vacantes);
      setFallos(d.fallos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuscando(false);
    }
  }, [query, fuentes, ajustes]);

  const triar = useCallback(async () => {
    if (!ajustes.geminiApiKey) {
      setError("Necesitas tu API key de Gemini en Ajustes para puntuar el lote.");
      return;
    }
    setTriando(true);
    setError("");
    try {
      // En tandas de 15 para no reventar el contexto ni la cuota de una vez.
      const pendientes = resultados.filter((v) => !puntajes[v.id]).slice(0, 60);
      setProgreso({ hechas: 0, total: pendientes.length });
      for (let i = 0; i < pendientes.length; i += 15) {
        const tanda = pendientes.slice(i, i + 15);
        const res = await triarLote(
          ajustes.geminiApiKey,
          ajustes.modelo,
          perfil,
          tanda.map((v) => ({
            id: v.id,
            titulo: v.titulo,
            empresa: v.empresa,
            extracto: v.descripcion,
          }))
        );
        setPuntajes((prev) => {
          const sig = { ...prev };
          for (const r of res) sig[r.id] = { puntaje: r.puntaje, motivo: r.motivo };
          return sig;
        });
        setProgreso((p) => ({ ...p, hechas: Math.min(i + tanda.length, p.total) }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTriando(false);
    }
  }, [ajustes, perfil, resultados, puntajes]);

  const guardar = (v: VacanteCruda) => {
    const nueva = agregarVacante({
      titulo: v.titulo,
      empresa: v.empresa,
      ubicacion: v.ubicacion,
      modalidad: v.modalidad || "Remoto",
      salario: v.salario,
      fuente: v.fuente,
      url: v.url,
      descripcion: v.descripcion,
    });
    setGuardadas((g) => ({ ...g, [v.id]: nueva.id }));
  };

  const visibles = useMemo(() => {
    const lista = soloBuenas
      ? resultados.filter((v) => (puntajes[v.id]?.puntaje ?? 0) >= 60)
      : resultados;
    return [...lista].sort(
      (a, b) => (puntajes[b.id]?.puntaje ?? -1) - (puntajes[a.id]?.puntaje ?? -1)
    );
  }, [resultados, puntajes, soloBuenas]);

  const sinClavesAdzuna = !ajustes.adzunaAppId || !ajustes.adzunaAppKey;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Buscar vacantes</h1>
        <p className="mt-1 text-sm text-[var(--color-suave)]">
          Rastrea siete agregadores a la vez y deja que el motor puntúe el encaje
          antes de que pierdas tiempo leyendo.
        </p>
      </header>

      <section className="panel space-y-4 p-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="campo flex-1"
            placeholder="Ej.: CRO, marketing automation, google ads, shopify…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
          />
          <button
            className="btn btn-primario shrink-0"
            onClick={buscar}
            disabled={buscando}
          >
            <Search size={15} />
            {buscando ? "Buscando…" : "Buscar"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {perfil.preferencias.keywordsBusqueda.slice(0, 10).map((k) => (
            <button
              key={k}
              className="chip transition hover:border-[var(--color-acento)]"
              onClick={() => setQuery(k)}
            >
              {k}
            </button>
          ))}
        </div>

        <div>
          <p className="etiqueta">Fuentes</p>
          <div className="flex flex-wrap gap-1.5">
            {FUENTES.map((f) => {
              const activa = fuentes.includes(f.id);
              const bloqueada =
                (f.id === "adzuna" && sinClavesAdzuna) ||
                (f.id === "jooble" && !ajustes.joobleKey) ||
                (f.id === "careerjet" && !ajustes.careerjetKey);
              return (
                <button
                  key={f.id}
                  title={
                    bloqueada ? "Falta la API key de esta fuente en Ajustes" : undefined
                  }
                  className={`chip transition ${
                    activa && !bloqueada
                      ? "border-[var(--color-acento)] text-[var(--color-acento)]"
                      : "opacity-50"
                  }`}
                  onClick={() =>
                    setFuentes((s) =>
                      s.includes(f.id) ? s.filter((x) => x !== f.id) : [...s, f.id]
                    )
                  }
                >
                  {f.label}
                  {bloqueada && " 🔑"}
                </button>
              );
            })}
          </div>
          {(sinClavesAdzuna || !ajustes.joobleKey || !ajustes.careerjetKey) && (
            <p className="mt-2 text-xs text-[var(--color-suave)]">
              Adzuna, Jooble y Careerjet son las que traen vacantes en español y no
              remotas: cubren España, Venezuela y LatAm.{" "}
              <Link href="/ajustes" className="text-[var(--color-acento)] underline">
                Configura sus claves gratis
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      {error && <Alerta tipo="error">{error}</Alerta>}
      {fallos.length > 0 && (
        <Alerta tipo="aviso">
          Estas fuentes no respondieron:{" "}
          {fallos.map((f) => `${f.fuente} (${f.error})`).join(", ")}. El resto sí
          funcionó.
        </Alerta>
      )}

      {resultados.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-suave)]">
              {visibles.length} de {resultados.length} vacantes
            </span>
            <div className="flex-1" />
            <button
              className="btn"
              onClick={() => setSoloBuenas((s) => !s)}
              disabled={Object.keys(puntajes).length === 0}
            >
              <Filter size={15} />
              {soloBuenas ? "Ver todas" : "Solo encaje ≥ 60"}
            </button>
            <button className="btn btn-primario" onClick={triar} disabled={triando}>
              <Sparkles size={15} />
              {triando
                ? progreso.total
                  ? `Puntuando ${progreso.hechas} de ${progreso.total}…`
                  : "Puntuando…"
                : "Puntuar encaje con IA"}
            </button>
          </div>

          {triando && (
            <div className="panel space-y-2 px-4 py-3">
              <Cargando
                texto={
                  progreso.total
                    ? `Evaluando ${progreso.hechas} de ${progreso.total} vacantes contra tu perfil…`
                    : "Preparando el lote…"
                }
              />
              {progreso.total > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-borde)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-acento)] transition-all duration-500"
                    style={{
                      width: `${Math.round((progreso.hechas / progreso.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <ul className="space-y-2.5">
            {visibles.map((v) => {
              const p = puntajes[v.id];
              const idGuardada = guardadas[v.id];
              const duplicada = yaGuardadas.has(claveDe(v));
              return (
                <li key={v.id} className="panel p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {p ? (
                      <Puntaje valor={p.puntaje} />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-borde)] text-[10px] text-[var(--color-suave)]">
                        s/p
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{v.titulo}</h3>
                      <p className="mt-0.5 text-xs text-[var(--color-suave)]">
                        {[v.empresa, v.ubicacion, v.salario].filter(Boolean).join(" · ")}
                      </p>
                      {p && (
                        <p className={`mt-1.5 text-xs ${colorPuntaje(p.puntaje).texto}`}>
                          {p.motivo}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-suave)]">
                        {v.descripcion.slice(0, 260)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <span className="chip justify-center">{v.fuente}</span>
                      {idGuardada ? (
                        <Link href={`/vacantes/${idGuardada}`} className="btn">
                          Abrir ficha
                        </Link>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => guardar(v)}
                          title={duplicada ? "Ya tienes una vacante igual guardada" : undefined}
                        >
                          <BookmarkPlus size={15} />
                          {duplicada ? "Guardar igual" : "Guardar"}
                        </button>
                      )}
                      {v.url && (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn"
                        >
                          <ExternalLink size={15} /> Ver oferta
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!buscando && resultados.length === 0 && (
        <Vacio
          titulo="Aún no has buscado"
          detalle="Escribe un término o toca una de tus palabras clave guardadas. Se consultan todas las fuentes activas en paralelo."
        />
      )}
    </div>
  );
}
