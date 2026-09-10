"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CircleAlert,
  Inbox,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { CANALES, type Canal } from "@/lib/types";
import { Modal, Vacio } from "@/components/ui";
import NuevaConversacion from "@/components/NuevaConversacion";

const ICONO_CANAL: Record<Canal, string> = {
  linkedin: "in",
  email: "@",
  whatsapp: "wa",
  otro: "··",
};

function Contenido() {
  const params = useSearchParams();
  const { estado, listo, borrarConversacion, actualizarConversacion } = useApp();
  const [abrirNueva, setAbrirNueva] = useState(params.get("nueva") === "1");
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [filtroCanal, setFiltroCanal] = useState<Canal | "todos">("todos");

  const visibles = useMemo(
    () =>
      estado.conversaciones
        .filter((c) => c.archivada === verArchivadas)
        .filter((c) => filtroCanal === "todos" || c.canal === filtroCanal)
        .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn)),
    [estado.conversaciones, verArchivadas, filtroCanal]
  );

  if (!listo) return <p className="text-sm text-[var(--color-suave)]">Cargando…</p>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Conversaciones</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--color-suave)]">
            Las vacantes que llegan por mensaje, no por portal. Pega el hilo de
            LinkedIn, del correo o de WhatsApp, enlázalo con una vacante y
            responde desde aquí.
          </p>
        </div>
        <button className="btn btn-primario" onClick={() => setAbrirNueva(true)}>
          <Plus size={15} /> Nueva conversación
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          className={`chip ${filtroCanal === "todos" ? "border-[var(--color-acento)] text-[var(--color-acento)]" : ""}`}
          onClick={() => setFiltroCanal("todos")}
        >
          Todos
        </button>
        {CANALES.map((c) => (
          <button
            key={c.id}
            className={`chip ${filtroCanal === c.id ? "border-[var(--color-acento)] text-[var(--color-acento)]" : ""}`}
            onClick={() => setFiltroCanal(c.id)}
          >
            {c.label}
          </button>
        ))}
        <div className="flex-1" />
        <button className="btn" onClick={() => setVerArchivadas((v) => !v)}>
          {verArchivadas ? <Inbox size={15} /> : <Archive size={15} />}
          {verArchivadas ? "Ver activas" : "Ver archivadas"}
        </button>
      </div>

      {visibles.length === 0 ? (
        <Vacio
          titulo={verArchivadas ? "Nada archivado" : "Sin conversaciones"}
          detalle={
            verArchivadas
              ? "Las conversaciones que archives aparecerán aquí."
              : "Cuando un reclutador te escriba por LinkedIn, correo o WhatsApp, pega el hilo aquí. El motor lo separa por mensajes, detecta si trae una oferta y te redacta la respuesta."
          }
          accion={
            !verArchivadas && (
              <button className="btn btn-primario" onClick={() => setAbrirNueva(true)}>
                <Plus size={15} /> Pegar una conversación
              </button>
            )
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {visibles.map((c) => {
            const vacante = estado.vacantes.find((v) => v.id === c.vacanteId);
            const ultimo = c.mensajes[c.mensajes.length - 1];
            const pendientes = c.pendientes.filter((p) => !p.hecho);
            const tocaResponder = ultimo?.de === "ellos";
            return (
              <li key={c.id} className="panel p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--color-borde)] bg-[var(--color-panel2)] text-[11px] font-bold uppercase text-[var(--color-suave)]">
                    {ICONO_CANAL[c.canal]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/conversaciones/${c.id}`}
                      className="text-sm font-semibold hover:text-[var(--color-acento)]"
                    >
                      {c.asunto || c.contacto.nombre}
                    </Link>
                    <p className="mt-0.5 text-xs text-[var(--color-suave)]">
                      {[c.contacto.nombre, c.contacto.cargo, c.contacto.empresa]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {ultimo && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-suave)]">
                        <span className="font-semibold">
                          {ultimo.de === "yo" ? "Tú: " : "Ellos: "}
                        </span>
                        {ultimo.texto.slice(0, 220)}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="chip">{c.mensajes.length} mensajes</span>
                      {tocaResponder && (
                        <span className="chip border-amber-500/40 text-amber-300">
                          Te toca responder
                        </span>
                      )}
                      {vacante ? (
                        <Link
                          href={`/vacantes/${vacante.id}`}
                          className="chip border-sky-500/40 text-sky-300 hover:border-sky-400"
                        >
                          {vacante.titulo.slice(0, 40)}
                        </Link>
                      ) : (
                        <span className="chip opacity-60">Sin vacante enlazada</span>
                      )}
                      {pendientes.length > 0 && (
                        <span className="chip border-violet-500/40 text-violet-300">
                          <ListChecks size={12} /> {pendientes.length} pendiente(s)
                        </span>
                      )}
                      {c.incoherencias.length > 0 && (
                        <span className="chip border-rose-500/40 text-rose-300">
                          <CircleAlert size={12} /> {c.incoherencias.length} a revisar
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      className="btn px-2"
                      title={c.archivada ? "Desarchivar" : "Archivar"}
                      onClick={() =>
                        actualizarConversacion(c.id, { archivada: !c.archivada })
                      }
                    >
                      {c.archivada ? (
                        <ArchiveRestore size={15} />
                      ) : (
                        <Archive size={15} />
                      )}
                    </button>
                    <button
                      className="btn px-2 text-rose-300"
                      title="Eliminar"
                      onClick={() => {
                        if (
                          confirm(
                            `¿Eliminar la conversación con ${c.contacto.nombre}? Se pierden los ${c.mensajes.length} mensajes. La vacante enlazada no se toca.`
                          )
                        )
                          borrarConversacion(c.id);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        abierto={abrirNueva}
        onCerrar={() => setAbrirNueva(false)}
        titulo="Nueva conversación"
      >
        <NuevaConversacion />
      </Modal>
    </div>
  );
}

export default function Conversaciones() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--color-suave)]">Cargando…</p>}>
      <Contenido />
    </Suspense>
  );
}
