"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Mail,
  Mic,
  MessagesSquare,
  CalendarClock,
  NotebookPen,
  Paperclip,
  Star,
  Target,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { ESTADOS, type EstadoVacante } from "@/lib/types";
import { Alerta, EsqueletoDetalle, InsigniaEstado, Vacio } from "@/components/ui";
import PanelAnalisis from "@/components/PanelAnalisis";
import PanelCV from "@/components/PanelCV";
import PanelCarta from "@/components/PanelCarta";
import PanelRespuestas from "@/components/PanelRespuestas";
import PanelEntrevista from "@/components/PanelEntrevista";
import PanelReuniones from "@/components/PanelReuniones";
import Adjuntos from "@/components/Adjuntos";
import { nuevoId } from "@/lib/store";

type Pestana =
  | "analisis"
  | "cv"
  | "carta"
  | "respuestas"
  | "entrevista"
  | "reuniones"
  | "material"
  | "oferta"
  | "notas";

const PESTANAS: { id: Pestana; label: string; Icono: typeof Target }[] = [
  { id: "analisis", label: "Análisis", Icono: Target },
  { id: "cv", label: "CV a medida", Icono: FileText },
  { id: "carta", label: "Carta y mensaje", Icono: Mail },
  { id: "respuestas", label: "Respuestas", Icono: MessagesSquare },
  { id: "entrevista", label: "Entrevista", Icono: Mic },
  { id: "reuniones", label: "Reuniones", Icono: CalendarClock },
  { id: "material", label: "Material", Icono: Paperclip },
  { id: "oferta", label: "La oferta", Icono: ExternalLink },
  { id: "notas", label: "Notas", Icono: NotebookPen },
];

export default function FichaVacante({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { estado, listo, actualizarVacante, borrarVacante, cambiarEstadoVacante } =
    useApp();
  const [pestana, setPestana] = useState<Pestana>("analisis");
  const [nota, setNota] = useState("");

  const vacante = estado.vacantes.find((v) => v.id === id);
  const conversacionesLigadas = estado.conversaciones.filter(
    (c) => c.vacanteId === id
  );

  if (!listo) return <EsqueletoDetalle />;

  if (!vacante)
    return (
      <Vacio
        titulo="Vacante no encontrada"
        detalle="Puede que la hayas eliminado, o que este enlace venga de otro navegador (los datos viven solo en el navegador donde los guardaste)."
        accion={
          <Link href="/vacantes" className="btn btn-primario">
            Volver a mis postulaciones
          </Link>
        }
      />
    );

  const sinClave = !estado.ajustes.geminiApiKey;

  return (
    <div className="space-y-5">
      <Link
        href="/vacantes"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-suave)] transition hover:text-[var(--color-texto)]"
      >
        <ArrowLeft size={15} /> Mis postulaciones
      </Link>

      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight">{vacante.titulo}</h1>
            <p className="mt-1 text-sm text-[var(--color-suave)]">
              {[vacante.empresa, vacante.ubicacion, vacante.modalidad, vacante.salario]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <InsigniaEstado estado={vacante.estado} />
              <span className="chip">{vacante.fuente}</span>
              <span className="chip">
                Guardada el {new Date(vacante.creadaEn).toLocaleDateString("es")}
              </span>
              {vacante.fechaPostulacion && (
                <span className="chip border-amber-500/40 text-amber-300">
                  Postulada el{" "}
                  {new Date(vacante.fechaPostulacion).toLocaleDateString("es")}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <select
              className="campo w-[180px] py-1.5 text-xs"
              value={vacante.estado}
              onChange={(e) =>
                cambiarEstadoVacante(vacante.id, e.target.value as EstadoVacante)
              }
            >
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <button
                className={`btn flex-1 px-2 ${vacante.favorito ? "text-amber-300" : ""}`}
                onClick={() =>
                  actualizarVacante(vacante.id, { favorito: !vacante.favorito })
                }
                title="Marcar como prioritaria"
              >
                <Star size={15} fill={vacante.favorito ? "currentColor" : "none"} />
              </button>
              {vacante.url && (
                <a
                  href={vacante.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn flex-1 px-2"
                  title="Abrir la oferta original"
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <button
                className="btn flex-1 px-2 text-rose-300"
                title="Eliminar vacante"
                onClick={() => {
                  if (
                    confirm(
                      `¿Eliminar "${vacante.titulo}"? Se borran su análisis, sus ${vacante.documentos.length} documentos y los resúmenes de sus ${(vacante.reuniones ?? []).length} reuniones. No se puede deshacer.`
                    )
                  ) {
                    borrarVacante(vacante.id);
                    router.push("/vacantes");
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {conversacionesLigadas.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-borde)] pt-4">
            <span className="etiqueta mb-0">Conversaciones</span>
            {conversacionesLigadas.map((c) => (
              <Link
                key={c.id}
                href={`/conversaciones/${c.id}`}
                className="chip transition hover:border-[var(--color-acento)]"
              >
                <MessagesSquare size={12} /> {c.contacto.nombre} · {c.mensajes.length} mensajes
              </Link>
            ))}
          </div>
        )}

        {vacante.proximaAccion && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-borde)] pt-4">
            <span className="etiqueta mb-0">Próxima acción</span>
            <input
              className="campo max-w-xs flex-1 py-1.5 text-xs"
              value={vacante.proximaAccion.que}
              onChange={(e) =>
                actualizarVacante(vacante.id, {
                  proximaAccion: { ...vacante.proximaAccion!, que: e.target.value },
                })
              }
            />
            <input
              type="date"
              className="campo w-[150px] py-1.5 text-xs"
              value={vacante.proximaAccion.cuando}
              onChange={(e) =>
                actualizarVacante(vacante.id, {
                  proximaAccion: { ...vacante.proximaAccion!, cuando: e.target.value },
                })
              }
            />
            <button
              className="btn py-1.5 text-xs"
              onClick={() => actualizarVacante(vacante.id, { proximaAccion: undefined })}
            >
              Hecho
            </button>
          </div>
        )}
      </header>

      {sinClave && (
        <Alerta tipo="aviso">
          El motor está apagado: falta tu API key de Gemini en{" "}
          <Link href="/ajustes" className="underline">
            Ajustes
          </Link>
          . Puedes leer la oferta y llevar el seguimiento, pero no analizar ni generar.
        </Alerta>
      )}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-borde)]">
        {PESTANAS.map(({ id: p, label, Icono }) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm transition ${
              pestana === p
                ? "border-[var(--color-acento)] font-semibold text-[var(--color-acento)]"
                : "border-transparent text-[var(--color-suave)] hover:text-[var(--color-texto)]"
            }`}
          >
            <Icono size={15} />
            {label}
          </button>
        ))}
      </div>

      {pestana === "analisis" && <PanelAnalisis vacante={vacante} />}
      {pestana === "cv" && <PanelCV vacante={vacante} />}
      {pestana === "carta" && <PanelCarta vacante={vacante} />}
      {pestana === "respuestas" && <PanelRespuestas vacante={vacante} />}
      {pestana === "entrevista" && <PanelEntrevista vacante={vacante} />}
      {pestana === "reuniones" && <PanelReuniones vacante={vacante} />}

      {pestana === "material" && (
        <Adjuntos
          adjuntos={vacante.adjuntos}
          onCambio={(adjuntos) => actualizarVacante(vacante.id, { adjuntos })}
          contexto={`Vacante de ${vacante.titulo} en ${vacante.empresa || "empresa sin nombre"}.`}
        />
      )}

      {pestana === "oferta" && (
        <div className="panel p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Descripción original</h3>
            {vacante.url && (
              <a href={vacante.url} target="_blank" rel="noreferrer" className="btn">
                <ExternalLink size={15} /> Abrir en el portal
              </a>
            )}
          </div>
          <pre className="max-h-[62vh] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--color-texto)]">
            {vacante.descripcion}
          </pre>
        </div>
      )}

      {pestana === "notas" && (
        <div className="space-y-4">
          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold">Contacto en la empresa</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["nombre", "Nombre"],
                  ["cargo", "Cargo"],
                  ["linkedin", "LinkedIn"],
                  ["email", "Email"],
                ] as const
              ).map(([campo, label]) => (
                <div key={campo}>
                  <label className="etiqueta" htmlFor={`c-${campo}`}>
                    {label}
                  </label>
                  <input
                    id={`c-${campo}`}
                    className="campo"
                    value={vacante.contacto?.[campo] ?? ""}
                    onChange={(e) =>
                      actualizarVacante(vacante.id, {
                        contacto: { ...vacante.contacto, [campo]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <h3 className="mb-3 text-sm font-semibold">Bitácora</h3>
            <div className="flex gap-2">
              <input
                className="campo flex-1"
                placeholder="Ej.: hablé con Marta, me pidió portafolio de landing pages…"
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !nota.trim()) return;
                  actualizarVacante(vacante.id, {
                    notas: [
                      { id: nuevoId("nota"), texto: nota, fecha: new Date().toISOString() },
                      ...vacante.notas,
                    ],
                  });
                  setNota("");
                }}
              />
              <button
                className="btn"
                disabled={!nota.trim()}
                onClick={() => {
                  actualizarVacante(vacante.id, {
                    notas: [
                      { id: nuevoId("nota"), texto: nota, fecha: new Date().toISOString() },
                      ...vacante.notas,
                    ],
                  });
                  setNota("");
                }}
              >
                Añadir
              </button>
            </div>
            {vacante.notas.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--color-suave)]">
                Sin notas. Apunta cada interacción: te salva cuando cinco procesos
                avanzan a la vez.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {vacante.notas.map((n) => (
                  <li key={n.id} className="border-l-2 border-[var(--color-borde)] pl-3">
                    <p className="text-[11px] text-[var(--color-suave)]">
                      {new Date(n.fecha).toLocaleString("es")}
                    </p>
                    <p className="text-sm leading-relaxed">{n.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
