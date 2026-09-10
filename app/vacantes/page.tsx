"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { ESTADOS, type EstadoVacante } from "@/lib/types";
import { InsigniaEstado, Modal, Puntaje, Vacio } from "@/components/ui";
import NuevaVacante from "@/components/NuevaVacante";

function Contenido() {
  const params = useSearchParams();
  const { estado, borrarVacante, cambiarEstadoVacante } = useApp();
  const [abrirNueva, setAbrirNueva] = useState(params.get("nueva") === "1");
  const [vista, setVista] = useState<"lista" | "tablero">("lista");
  const [filtro, setFiltro] = useState<EstadoVacante | "todas">(
    (params.get("estado") as EstadoVacante) ?? "todas"
  );
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return estado.vacantes.filter((v) => {
      if (filtro !== "todas" && v.estado !== filtro) return false;
      if (!q) return true;
      return `${v.titulo} ${v.empresa} ${v.fuente}`.toLowerCase().includes(q);
    });
  }, [estado.vacantes, filtro, busqueda]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis postulaciones</h1>
          <p className="mt-1 text-sm text-[var(--color-suave)]">
            {estado.vacantes.length} vacantes en seguimiento.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn"
            onClick={() => setVista((v) => (v === "lista" ? "tablero" : "lista"))}
            title="Cambiar vista"
          >
            {vista === "lista" ? <LayoutGrid size={15} /> : <List size={15} />}
            {vista === "lista" ? "Tablero" : "Lista"}
          </button>
          <button className="btn btn-primario" onClick={() => setAbrirNueva(true)}>
            <Plus size={15} /> Nueva vacante
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="campo max-w-xs flex-1"
          placeholder="Filtrar por puesto o empresa…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          className="campo max-w-[200px]"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as EstadoVacante | "todas")}
        >
          <option value="todas">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      {visibles.length === 0 ? (
        <Vacio
          titulo={estado.vacantes.length ? "Nada con ese filtro" : "Sin vacantes todavía"}
          detalle={
            estado.vacantes.length
              ? "Prueba a limpiar la búsqueda o a cambiar el estado seleccionado."
              : "Busca en los agregadores, usa la extensión de Chrome o pega una oferta a mano."
          }
          accion={
            !estado.vacantes.length && (
              <div className="flex gap-2">
                <Link href="/buscar" className="btn btn-primario">
                  Buscar vacantes
                </Link>
                <button className="btn" onClick={() => setAbrirNueva(true)}>
                  Pegar una oferta
                </button>
              </div>
            )
          }
        />
      ) : vista === "lista" ? (
        <ul className="space-y-2.5">
          {visibles.map((v) => (
            <li key={v.id} className="panel p-4">
              <div className="flex flex-wrap items-start gap-3">
                {v.analisis ? (
                  <Puntaje valor={v.analisis.puntaje} />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-borde)] text-[10px] text-[var(--color-suave)]">
                    s/a
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/vacantes/${v.id}`}
                    className="text-sm font-semibold hover:text-[var(--color-acento)]"
                  >
                    {v.titulo}
                  </Link>
                  <p className="mt-0.5 text-xs text-[var(--color-suave)]">
                    {[v.empresa, v.ubicacion, v.modalidad, v.salario]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <InsigniaEstado estado={v.estado} />
                    <span className="chip">{v.fuente}</span>
                    {v.documentos.length > 0 && (
                      <span className="chip">{v.documentos.length} documentos</span>
                    )}
                    {v.analisis?.banderasRojas.length ? (
                      <span className="chip border-rose-500/40 text-rose-300">
                        {v.analisis.banderasRojas.length} bandera(s) roja(s)
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <select
                    className="campo w-[150px] py-1.5 text-xs"
                    value={v.estado}
                    onChange={(e) =>
                      cambiarEstadoVacante(v.id, e.target.value as EstadoVacante)
                    }
                  >
                    {ESTADOS.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                  {v.url && (
                    <a href={v.url} target="_blank" rel="noreferrer" className="btn px-2">
                      <ExternalLink size={15} />
                    </a>
                  )}
                  <button
                    className="btn px-2 text-rose-300"
                    title="Eliminar"
                    onClick={() => {
                      if (
                        confirm(
                          `¿Eliminar "${v.titulo}" de ${v.empresa}? Se borran también sus análisis y documentos. No se puede deshacer.`
                        )
                      )
                        borrarVacante(v.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ESTADOS.map((col) => {
            const items = visibles.filter((v) => v.estado === col.id);
            return (
              <div key={col.id} className="w-[260px] shrink-0">
                <p className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-suave)]">
                  {col.label}
                  <span>{items.length}</span>
                </p>
                <div className="space-y-2">
                  {items.map((v) => (
                    <Link
                      key={v.id}
                      href={`/vacantes/${v.id}`}
                      className="panel block p-3 transition hover:border-[var(--color-acento)]"
                    >
                      <p className="line-clamp-2 text-xs font-semibold">{v.titulo}</p>
                      <p className="mt-1 truncate text-[11px] text-[var(--color-suave)]">
                        {v.empresa}
                      </p>
                      {v.analisis && (
                        <p className="mt-1.5 text-[11px] font-semibold">
                          Encaje {v.analisis.puntaje}
                        </p>
                      )}
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <p className="rounded-lg border border-dashed border-[var(--color-borde)] px-3 py-6 text-center text-[11px] text-[var(--color-suave)]">
                      Vacío
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        abierto={abrirNueva}
        onCerrar={() => setAbrirNueva(false)}
        titulo="Nueva vacante"
      >
        <NuevaVacante />
      </Modal>
    </div>
  );
}

export default function Vacantes() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--color-suave)]">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
