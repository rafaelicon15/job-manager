"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CircleAlert,
  Link2,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Unlink,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { parsearVacante, redactarEnHilo, type RespuestaHilo } from "@/lib/gemini";
import { CANALES, type Idioma } from "@/lib/types";
import { nuevoId } from "@/lib/store";
import { Alerta, BotonCopiar, Cargando, EsqueletoDetalle, Modal, Vacio } from "@/components/ui";

const TONOS = [
  "Profesional y directo",
  "Cercano y conversacional",
  "Formal y corporativo",
  "Vendedor, orientado a resultados",
];

const ATAJOS = [
  "Responde a lo último y haz avanzar el proceso.",
  "Confirma la videollamada y pregunta la agenda.",
  "Envía el CV y el portafolio.",
  "Pide que me confirmen el rango salarial y la dedicación.",
  "Haz seguimiento: llevo días sin respuesta.",
  "Agradece la entrevista y refuerza por qué encajo.",
  "Negocia al alza la cifra que me ofrecieron.",
  "Declina la oferta con cortesía, dejando la puerta abierta.",
];

export default function Hilo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    estado,
    listo,
    actualizarConversacion,
    borrarConversacion,
    agregarMensaje,
    borrarMensaje,
    agregarVacante,
  } = useApp();

  const [instrucciones, setInstrucciones] = useState("");
  const [tono, setTono] = useState(TONOS[0]);
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  const [res, setRes] = useState<RespuestaHilo | null>(null);
  const [cargando, setCargando] = useState("");
  const [error, setError] = useState("");
  const [abrirMensaje, setAbrirMensaje] = useState(false);
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [nuevoDe, setNuevoDe] = useState<"ellos" | "yo">("ellos");

  const conv = estado.conversaciones.find((c) => c.id === id);
  const vacante = useMemo(
    () => estado.vacantes.find((v) => v.id === conv?.vacanteId),
    [estado.vacantes, conv?.vacanteId]
  );

  if (!listo) return <EsqueletoDetalle />;

  if (!conv)
    return (
      <Vacio
        titulo="Conversación no encontrada"
        detalle="Puede que la hayas eliminado, o que este enlace venga de otro navegador."
        accion={
          <Link href="/conversaciones" className="btn btn-primario">
            Volver a conversaciones
          </Link>
        }
      />
    );

  const canalLabel = CANALES.find((c) => c.id === conv.canal)!.label;
  const pendientesAbiertos = conv.pendientes.filter((p) => !p.hecho);

  async function redactar() {
    setError("");
    setRes(null);
    setCargando("Redactando tu respuesta y revisando el hilo…");
    try {
      const r = await redactarEnHilo(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        conv!,
        vacante,
        instrucciones,
        idioma,
        tono
      );
      setRes(r);
      // Fusiona los pendientes nuevos sin perder los que ya marcaste hechos.
      const yaConocidos = new Set(
        conv!.pendientes.map((p) => p.que.toLowerCase().trim())
      );
      actualizarConversacion(conv!.id, {
        pendientes: [
          ...conv!.pendientes,
          ...r.pendientes
            .filter((q) => !yaConocidos.has(q.toLowerCase().trim()))
            .map((q) => ({ id: nuevoId("pend"), que: q, hecho: false })),
        ],
        preguntasSinResponder: r.preguntasSinResponder,
        incoherencias: r.incoherencias,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando("");
    }
  }

  /** Registra la respuesta como mensaje enviado y limpia el borrador. */
  function marcarEnviada(texto: string) {
    agregarMensaje(conv!.id, {
      de: "yo",
      texto,
      fecha: new Date().toISOString(),
    });
    setRes(null);
    setInstrucciones("");
  }

  async function crearVacanteDesdeHilo() {
    setError("");
    setCargando("Extrayendo la oferta del hilo…");
    try {
      const crudo = conv!.mensajes
        .filter((m) => m.de === "ellos")
        .map((m) => m.texto)
        .join("\n\n");
      const d = await parsearVacante(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modelo,
        crudo
      );
      const v = agregarVacante({
        titulo: d.titulo,
        empresa: d.empresa || conv!.contacto.empresa || "",
        ubicacion: d.ubicacion ?? "",
        modalidad: d.modalidad ?? "",
        salario: d.salario ?? "",
        fuente: `${canalLabel} (contacto directo)`,
        descripcion: d.descripcion,
      });
      actualizarConversacion(conv!.id, { vacanteId: v.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando("");
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href="/conversaciones"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-suave)] transition hover:text-[var(--color-texto)]"
      >
        <ArrowLeft size={15} /> Conversaciones
      </Link>

      <header className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <input
              className="w-full bg-transparent text-xl font-bold leading-tight outline-none focus:underline"
              value={conv.asunto}
              placeholder="Asunto del hilo"
              onChange={(e) =>
                actualizarConversacion(conv.id, { asunto: e.target.value })
              }
            />
            <p className="mt-1 text-sm text-[var(--color-suave)]">
              {[conv.contacto.nombre, conv.contacto.cargo, conv.contacto.empresa]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="chip">{canalLabel}</span>
              {conv.contacto.handle && (
                <a
                  href={
                    conv.contacto.handle.startsWith("http")
                      ? conv.contacto.handle
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="chip max-w-[280px] truncate"
                >
                  {conv.contacto.handle}
                </a>
              )}
              <span className="chip">{conv.mensajes.length} mensajes</span>
            </div>
          </div>
          <button
            className="btn px-2 text-rose-300"
            title="Eliminar conversación"
            onClick={() => {
              if (confirm(`¿Eliminar la conversación con ${conv.contacto.nombre}?`)) {
                borrarConversacion(conv.id);
                router.push("/conversaciones");
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-borde)] pt-4">
          <span className="etiqueta mb-0 flex items-center gap-1.5">
            <Briefcase size={13} /> Vacante enlazada
          </span>
          <select
            className="campo max-w-[320px] flex-1 py-1.5 text-xs"
            value={conv.vacanteId ?? ""}
            onChange={(e) =>
              actualizarConversacion(conv.id, {
                vacanteId: e.target.value || undefined,
              })
            }
          >
            <option value="">Sin enlazar</option>
            {estado.vacantes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.titulo} — {v.empresa}
              </option>
            ))}
          </select>
          {vacante ? (
            <>
              <Link href={`/vacantes/${vacante.id}`} className="btn py-1.5 text-xs">
                <Link2 size={14} /> Abrir ficha
              </Link>
              <button
                className="btn py-1.5 text-xs"
                onClick={() => actualizarConversacion(conv.id, { vacanteId: undefined })}
              >
                <Unlink size={14} /> Desenlazar
              </button>
            </>
          ) : (
            <button
              className="btn py-1.5 text-xs"
              onClick={crearVacanteDesdeHilo}
              disabled={
                !!cargando ||
                !estado.ajustes.geminiApiKey ||
                !conv.mensajes.some((m) => m.de === "ellos")
              }
              title="Extrae la oferta de lo que escribió el reclutador y la registra como vacante"
            >
              <Plus size={14} /> Crear vacante desde el hilo
            </button>
          )}
        </div>
        {!vacante && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-suave)]">
            Sin vacante enlazada el motor responde solo con tu perfil. Al enlazarla
            usa también los requisitos, las brechas detectadas y el ángulo a vender.
          </p>
        )}
      </header>

      {conv.incoherencias.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5">
          <p className="mb-1 flex items-center gap-2 text-sm font-bold text-rose-200">
            <CircleAlert size={16} /> Afirmaciones de este hilo que tu perfil no
            respalda
          </p>
          <p className="mb-3 text-xs leading-relaxed text-rose-100/70">
            Dijiste esto en la conversación pero no está en tu perfil maestro. Si te
            preguntan por ello en la entrevista y no puedes sostenerlo, pierdes la
            credibilidad que ganaste.
          </p>
          <ul className="space-y-3">
            {conv.incoherencias.map((inc, i) => (
              <li key={i} className="border-l-2 border-rose-500/40 pl-3">
                <p className="text-sm font-medium text-rose-100">
                  “{inc.afirmacion}”
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-rose-100/80">
                  {inc.problema}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-200/90">
                  Cómo reencuadrarlo: {inc.comoCorregir}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/perfil" className="btn py-1.5 text-xs">
              Añadirlo al perfil si es cierto
            </Link>
            <button
              className="btn py-1.5 text-xs"
              onClick={() => actualizarConversacion(conv.id, { incoherencias: [] })}
            >
              Ya lo revisé
            </button>
          </div>
        </div>
      )}

      {(pendientesAbiertos.length > 0 || conv.preguntasSinResponder.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {pendientesAbiertos.length > 0 && (
            <div className="panel p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-300">
                <ListChecks size={15} /> Te lo pidieron y falta hacerlo
              </h2>
              <ul className="space-y-2">
                {conv.pendientes.map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={p.hecho}
                      onChange={() =>
                        actualizarConversacion(conv.id, {
                          pendientes: conv.pendientes.map((x) =>
                            x.id === p.id ? { ...x, hecho: !x.hecho } : x
                          ),
                        })
                      }
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        p.hecho ? "text-[var(--color-suave)] line-through" : ""
                      }`}
                    >
                      {p.que}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {conv.preguntasSinResponder.length > 0 && (
            <div className="panel p-5">
              <h2 className="mb-1 text-sm font-semibold text-amber-300">
                Preguntas tuyas que esquivaron
              </h2>
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-suave)]">
                Que no te contesten esto también es información. Vuelve a
                plantearlo antes de invertir más tiempo.
              </p>
              <ul className="space-y-2">
                {conv.preguntasSinResponder.map((q, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    • {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <section className="panel p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Hilo</h2>
          <button className="btn py-1.5 text-xs" onClick={() => setAbrirMensaje(true)}>
            <Plus size={14} /> Añadir mensaje
          </button>
        </div>
        {conv.mensajes.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-suave)]">
            Hilo vacío. Añade el primer mensaje del reclutador para empezar.
          </p>
        ) : (
          <ul className="space-y-3">
            {conv.mensajes.map((m) => (
              <li
                key={m.id}
                className={`flex ${m.de === "yo" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] rounded-xl border px-4 py-3 ${
                    m.de === "yo"
                      ? "border-[var(--color-acento)]/40 bg-[var(--color-acento)]/10"
                      : "border-[var(--color-borde)] bg-[var(--color-panel2)]"
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-suave)]">
                      {m.de === "yo" ? "Tú" : conv.contacto.nombre}
                    </span>
                    {m.fecha && (
                      <span className="text-[10px] text-[var(--color-suave)]">
                        {m.fecha.includes("T")
                          ? new Date(m.fecha).toLocaleString("es")
                          : m.fecha}
                      </span>
                    )}
                    <div className="flex-1" />
                    <BotonCopiar texto={m.texto} etiqueta="" />
                    <button
                      className="rounded p-1 text-[var(--color-suave)] transition hover:text-rose-300"
                      title="Eliminar mensaje"
                      onClick={() => borrarMensaje(conv.id, m.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {m.texto}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold">Redactar respuesta</h2>

        <div>
          <label className="etiqueta" htmlFor="instr">
            ¿Qué quieres conseguir con este mensaje?
          </label>
          <textarea
            id="instr"
            className="campo min-h-[80px] resize-y"
            placeholder="Déjalo vacío para que responda a lo último y haga avanzar el proceso."
            value={instrucciones}
            onChange={(e) => setInstrucciones(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ATAJOS.map((a) => (
              <button
                key={a}
                className="chip transition hover:border-[var(--color-acento)]"
                onClick={() => setInstrucciones(a)}
              >
                {a.length > 44 ? a.slice(0, 44) + "…" : a}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="tono-h">
              Tono
            </label>
            <select
              id="tono-h"
              className="campo"
              value={tono}
              onChange={(e) => setTono(e.target.value)}
            >
              {TONOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="idioma-h">
              Idioma
            </label>
            <select
              id="idioma-h"
              className="campo"
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as Idioma)}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="btn btn-primario"
            onClick={redactar}
            disabled={!!cargando || conv.mensajes.length === 0}
          >
            <Sparkles size={15} className="icono-late" /> Redactar como yo
          </button>
          {cargando && <Cargando texto={cargando} />}
        </div>
        {conv.mensajes.length === 0 && (
          <p className="text-xs text-[var(--color-suave)]">
            Añade al menos un mensaje del reclutador para poder responder.
          </p>
        )}
      </section>

      {error && <Alerta tipo="error">{error}</Alerta>}

      {res && (
        <div className="space-y-3">
          {res.avisos.length > 0 && (
            <Alerta tipo="aviso">
              <ul className="space-y-1">
                {res.avisos.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </Alerta>
          )}

          <div className="panel p-5">
            {conv.canal === "email" && res.asunto && (
              <div className="mb-3 flex items-center gap-2 border-b border-[var(--color-borde)] pb-3">
                <span className="etiqueta mb-0">Asunto</span>
                <span className="flex-1 text-sm font-semibold">{res.asunto}</span>
                <BotonCopiar texto={res.asunto} etiqueta="" />
              </div>
            )}
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Respuesta para {canalLabel}
                <span className="ml-2 font-normal text-[var(--color-suave)]">
                  {res.respuesta.length} caracteres
                </span>
              </h3>
              <div className="flex gap-1.5">
                <BotonCopiar texto={res.respuesta} />
                <button
                  className="btn"
                  onClick={() => marcarEnviada(res.respuesta)}
                  title="Guárdalo en el hilo como mensaje tuyo ya enviado"
                >
                  <Send size={15} /> Marcar como enviada
                </button>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {res.respuesta}
            </p>
          </div>

          {res.variantes.length > 0 && (
            <div className="panel p-5">
              <h3 className="mb-3 text-sm font-semibold">Otras versiones</h3>
              <ul className="space-y-3">
                {res.variantes.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 border-l-2 border-[var(--color-borde)] pl-3"
                  >
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{v}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-suave)]">
                        {v.length} caracteres
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <BotonCopiar texto={v} etiqueta="" />
                      <button
                        className="btn px-2"
                        title="Marcar esta como enviada"
                        onClick={() => marcarEnviada(v)}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Modal
        abierto={abrirMensaje}
        onCerrar={() => setAbrirMensaje(false)}
        titulo="Añadir mensaje al hilo"
      >
        <div className="space-y-4">
          <div>
            <p className="etiqueta">¿Quién lo escribió?</p>
            <div className="flex gap-1.5">
              {(
                [
                  ["ellos", conv.contacto.nombre || "El reclutador"],
                  ["yo", "Yo"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  className={`chip ${
                    nuevoDe === v
                      ? "border-[var(--color-acento)] text-[var(--color-acento)]"
                      : ""
                  }`}
                  onClick={() => setNuevoDe(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="etiqueta" htmlFor="nuevo-msg">
              Mensaje
            </label>
            <textarea
              id="nuevo-msg"
              className="campo min-h-[150px] resize-y"
              value={nuevoTexto}
              onChange={(e) => setNuevoTexto(e.target.value)}
              placeholder="Pega aquí el mensaje tal cual llegó."
            />
          </div>
          <button
            className="btn btn-primario"
            disabled={!nuevoTexto.trim()}
            onClick={() => {
              agregarMensaje(conv.id, {
                de: nuevoDe,
                texto: nuevoTexto.trim(),
                fecha: new Date().toISOString(),
              });
              setNuevoTexto("");
              setAbrirMensaje(false);
            }}
          >
            Añadir al hilo
          </button>
        </div>
      </Modal>
    </div>
  );
}
