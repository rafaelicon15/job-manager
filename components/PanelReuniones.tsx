"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { useApp } from "@/lib/contexto";
import { resumirReunion } from "@/lib/gemini";
import { juntarPendientes } from "@/lib/pendientes";
import { nuevoId } from "@/lib/store";
import {
  TIPOS_REUNION,
  type Idioma,
  type Reunion,
  type ResumenReunion,
  type TipoReunion,
  type Vacante,
} from "@/lib/types";
import { Alerta, BotonCopiar, Cargando } from "@/components/ui";
import {
  etiquetaDeTipo,
  fechaLegible,
  participantesDe,
  resumenComoTexto,
} from "@/lib/reuniones";
import MaterialesReunion, { type BytesSueltos } from "@/components/MaterialesReunion";

/**
 * Las reuniones que ya han pasado en este proceso, con su resumen.
 *
 * Lo que se dice en una llamada no queda escrito en ningún sitio. A la tercera
 * entrevista nadie recuerda qué rango mencionaron de pasada, qué prometió
 * mandar, ni qué pregunta contestó regular. Esta pestaña existe para que eso
 * deje de perderse, y para que el guion de la siguiente ronda parta de ahí en
 * lugar de empezar de cero.
 */
export default function PanelReuniones({ vacante }: { vacante: Vacante }) {
  const {
    estado,
    agregarReunion,
    actualizarReunion,
    borrarReunion,
    actualizarVacante,
    actualizarConversacion,
  } = useApp();

  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [idioma, setIdioma] = useState<Idioma>(estado.ajustes.idiomaPorDefecto);
  // Un PDF escaneado no se puede guardar en localStorage, así que sus bytes se
  // quedan aquí mientras la pestaña esté abierta. El aviso de que eso se pierde
  // al recargar lo da MaterialesReunion.
  const [bytes, setBytes] = useState<BytesSueltos>({});

  const reuniones = vacante.reuniones ?? [];
  const sinClave = !estado.ajustes.geminiApiKey;
  const conversacion = estado.conversaciones.find((c) => c.vacanteId === vacante.id);

  async function resumir(r: Reunion) {
    setTrabajando(r.id);
    setError("");
    try {
      const nativos = (r.materiales ?? [])
        .map((m) => bytes[m.id])
        .filter((b): b is { mimeType: string; datos: string } => Boolean(b));

      const resumen = await resumirReunion(
        estado.ajustes.geminiApiKey,
        estado.ajustes.modeloGeneracion || estado.ajustes.modelo,
        estado.perfil,
        vacante,
        r,
        idioma,
        nativos
      );
      actualizarReunion(vacante.id, r.id, { resumen });
      setAbierta(r.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTrabajando(null);
    }
  }

  /** Pasa los compromisos al hilo del reclutador, sin duplicar los que ya estén. */
  function pasarAPendientes(x: ResumenReunion) {
    if (!conversacion) return;
    actualizarConversacion(conversacion.id, {
      pendientes: juntarPendientes(conversacion.pendientes, x.compromisosMios, (que) => ({
        id: nuevoId("pen"),
        que,
        hecho: false,
      })),
    });
  }

  function anotarEnBitacora(r: Reunion, x: ResumenReunion) {
    actualizarVacante(vacante.id, {
      notas: [
        {
          id: nuevoId("nota"),
          texto: `${etiquetaDeTipo(r.tipo)}: ${x.resumen}`,
          fecha: new Date().toISOString(),
        },
        ...vacante.notas,
      ],
    });
  }

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <div>
          <p className="etiqueta">Idioma del resumen</p>
          <div className="flex gap-1.5">
            {(["es", "en"] as Idioma[]).map((i) => (
              <button
                key={i}
                className={`chip ${idioma === i ? "border-[var(--color-acento)] text-[var(--color-acento)]" : ""}`}
                onClick={() => setIdioma(i)}
              >
                {i === "es" ? "Español" : "English"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1" />
        <button className="btn btn-primario" onClick={() => setCreando(true)}>
          <Plus size={15} /> Registrar reunión
        </button>
      </div>

      {error && <Alerta tipo="error">{error}</Alerta>}

      {creando && (
        <FormularioReunion
          onCancelar={() => setCreando(false)}
          onGuardar={(datos) => {
            const r = agregarReunion(vacante.id, datos);
            setCreando(false);
            setAbierta(r.id);
            if (!sinClave && datos.notasCrudas.trim()) resumir(r);
          }}
        />
      )}

      {reuniones.length === 0 && !creando && (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <CalendarClock size={26} className="text-[var(--color-suave)]" />
          <p className="text-base font-semibold">Ninguna reunión registrada</p>
          <p className="max-w-lg text-sm leading-relaxed text-[var(--color-suave)]">
            Después de cada llamada, pega aquí tus apuntes, la transcripción de
            Meet o el chat de la reunión. El motor saca lo que se pierde al
            colgar: qué prometiste tú, qué prometieron ellos, qué condiciones
            salieron y qué contestaste regular. La siguiente ronda se prepara con
            eso delante.
          </p>
        </div>
      )}

      {reuniones.map((r) => {
        const abierto = abierta === r.id;
        const x = r.resumen;
        return (
          <div key={r.id} className="panel overflow-hidden">
            <div className="flex flex-wrap items-start gap-3 p-4">
              <button
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => setAbierta(abierto ? null : r.id)}
              >
                <ChevronDown
                  size={16}
                  className={`mt-0.5 shrink-0 text-[var(--color-suave)] transition-transform ${abierto ? "rotate-180" : ""}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {x?.titulo || etiquetaDeTipo(r.tipo)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip">{etiquetaDeTipo(r.tipo)}</span>
                    {r.fecha && <span className="chip">{fechaLegible(r.fecha)}</span>}
                    {r.canal && (
                      <span className="chip">
                        <Video size={12} /> {r.canal}
                      </span>
                    )}
                    {r.duracionMin ? <span className="chip">{r.duracionMin} min</span> : null}
                    {r.participantes.length > 0 && (
                      <span className="chip">
                        <Users size={12} />{" "}
                        {r.participantes.map((p) => p.nombre).filter(Boolean).join(", ")}
                      </span>
                    )}
                    {x && x.compromisosMios.length > 0 && (
                      <span className="chip border-amber-500/40 text-amber-300">
                        {x.compromisosMios.length}{" "}
                        {x.compromisosMios.length === 1 ? "compromiso tuyo" : "compromisos tuyos"}
                      </span>
                    )}
                    {x && x.senalesDeAlerta.length > 0 && (
                      <span className="chip border-rose-500/40 text-rose-300">
                        <AlertTriangle size={12} /> {x.senalesDeAlerta.length}
                      </span>
                    )}
                    {!x && (
                      <span className="chip border-[var(--color-acento)]/40 text-[var(--color-acento)]">
                        Sin resumir
                      </span>
                    )}
                  </div>
                </div>
              </button>
              <div className="flex shrink-0 gap-1.5">
                <button
                  className="btn py-1.5 text-xs"
                  disabled={trabajando === r.id || sinClave || !hayMaterial(r)}
                  onClick={() => resumir(r)}
                  title={
                    sinClave
                      ? "Falta la API key de Gemini en Ajustes"
                      : !hayMaterial(r)
                        ? "Pega tus apuntes o cuelga un documento de la reunión"
                        : ""
                  }
                >
                  <Sparkles size={14} />
                  {trabajando === r.id ? "Resumiendo…" : x ? "Regenerar" : "Resumir"}
                </button>
                <button
                  className="btn px-2 py-1.5 text-rose-300"
                  title="Eliminar esta reunión"
                  onClick={() => {
                    if (confirm("¿Eliminar esta reunión y su resumen? No se puede deshacer."))
                      borrarReunion(vacante.id, r.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {trabajando === r.id && (
              <div className="border-t border-[var(--color-borde)] px-4 py-3">
                <Cargando texto="Buscando lo que se pierde al colgar…" />
              </div>
            )}

            {abierto && (
              <div className="space-y-4 border-t border-[var(--color-borde)] p-4">
                <div>
                  <label className="etiqueta" htmlFor={`notas-${r.id}`}>
                    Tus apuntes, la transcripción o el chat de la reunión
                  </label>
                  <textarea
                    id={`notas-${r.id}`}
                    className="campo min-h-[140px] font-mono text-xs leading-relaxed"
                    value={r.notasCrudas}
                    placeholder="Pega aquí lo que tengas, sin ordenarlo. Cuanto más literal, mejor sale el resumen."
                    onChange={(e) =>
                      actualizarReunion(vacante.id, r.id, { notasCrudas: e.target.value })
                    }
                  />
                </div>

                <MaterialesReunion
                  materiales={r.materiales ?? []}
                  onCambio={(materiales) =>
                    actualizarReunion(vacante.id, r.id, { materiales })
                  }
                  bytes={bytes}
                  onBytes={setBytes}
                />

                {x && <Resumen reunion={r} resumen={x} />}

                {x && (
                  <div className="flex flex-wrap gap-2 border-t border-[var(--color-borde)] pt-3">
                    <BotonCopiar texto={resumenComoTexto(r, x)} etiqueta="Copiar resumen completo" />
                    <button className="btn py-1.5 text-xs" onClick={() => anotarEnBitacora(r, x)}>
                      Añadir a la bitácora
                    </button>
                    {x.proximoPaso && (
                      <button
                        className="btn py-1.5 text-xs"
                        onClick={() =>
                          actualizarVacante(vacante.id, {
                            proximaAccion: {
                              que: x.proximoPaso,
                              cuando: new Date(Date.now() + 2 * 864e5)
                                .toISOString()
                                .slice(0, 10),
                            },
                          })
                        }
                      >
                        Guardar como próxima acción
                      </button>
                    )}
                    {conversacion && x.compromisosMios.length > 0 && (
                      <button
                        className="btn py-1.5 text-xs"
                        onClick={() => pasarAPendientes(x)}
                        title={`Se añaden al hilo con ${conversacion.contacto.nombre}`}
                      >
                        Pasar compromisos a pendientes
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Hay con qué resumir si hay apuntes o algún documento convertido. */
function hayMaterial(r: Reunion): boolean {
  return Boolean(r.notasCrudas.trim()) || (r.materiales ?? []).length > 0;
}

// ------------------------------------------------------------------ resumen

function Resumen({ reunion, resumen: x }: { reunion: Reunion; resumen: ResumenReunion }) {
  return (
    <div className="space-y-4">
      {x.incoherencias.length > 0 && (
        <Alerta tipo="error">
          <p className="mb-1 font-semibold">
            Dijiste cosas que tu perfil no respalda. Esto se cobra en la siguiente ronda:
          </p>
          <ul className="space-y-2">
            {x.incoherencias.map((i, n) => (
              <li key={n}>
                <p className="font-medium">{i.afirmacion}</p>
                <p className="text-xs opacity-80">{i.problema}</p>
                <p className="mt-0.5 text-xs">Cómo reencuadrarlo: {i.comoCorregir}</p>
              </li>
            ))}
          </ul>
        </Alerta>
      )}

      <p className="text-sm leading-relaxed">{x.resumen}</p>

      {x.puntosClave.length > 0 && (
        <div>
          <p className="etiqueta">Lo que importa</p>
          <ul className="space-y-1">
            {x.puntosClave.map((p, i) => (
              <li key={i} className="text-sm leading-relaxed">
                • {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Lista
          titulo="Lo que prometiste tú"
          vacio="No te comprometiste a nada en esta reunión."
          items={x.compromisosMios}
          acento="amber"
          Icono={CheckCircle2}
        />
        <Lista
          titulo="Lo que prometieron ellos"
          vacio="No se comprometieron a nada concreto."
          items={x.compromisosDeEllos}
        />
      </div>

      {x.datosDelPuesto.length > 0 && (
        <div>
          <p className="etiqueta">Condiciones que salieron en la llamada</p>
          <dl className="grid gap-1.5 sm:grid-cols-2">
            {x.datosDelPuesto.map((d, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-3 rounded-lg border border-[var(--color-borde)] px-3 py-2"
              >
                <dt className="text-xs text-[var(--color-suave)]">{d.concepto}</dt>
                <dd className="text-sm font-semibold">{d.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {x.senalesDeAlerta.length > 0 && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-200">
            <AlertTriangle size={15} /> Señales de alerta
          </h4>
          <ul className="space-y-1">
            {x.senalesDeAlerta.map((s, i) => (
              <li key={i} className="text-sm leading-relaxed text-rose-100">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {x.preguntasQueMeHicieron.length > 0 && (
        <div>
          <p className="etiqueta">Lo que te preguntaron</p>
          <ul className="space-y-2.5">
            {x.preguntasQueMeHicieron.map((q, i) => (
              <li key={i} className="rounded-lg border border-[var(--color-borde)] p-3">
                <p className="text-sm font-medium">{q.pregunta}</p>
                <p className="mt-1 text-xs italic leading-relaxed text-[var(--color-suave)]">
                  Contestaste: {q.comoRespondi}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                  {q.mejorRespuesta}
                </p>
                <div className="mt-1.5">
                  <BotonCopiar texto={q.mejorRespuesta} etiqueta="" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Lista
          titulo="Sigue sin respuesta"
          vacio="Te contestaron todo lo que preguntaste."
          items={x.preguntasSinResponder}
        />
        <Lista
          titulo="A reforzar para la siguiente"
          vacio="Nada flojo que reforzar."
          items={x.aReforzar}
        />
      </div>

      {x.senalesBuenas.length > 0 && (
        <Lista titulo="Va bien por aquí" vacio="" items={x.senalesBuenas} />
      )}

      {x.proximoPaso && (
        <div className="rounded-xl border border-[var(--color-borde)] p-4">
          <p className="etiqueta">Próximo paso</p>
          <p className="text-sm leading-relaxed">{x.proximoPaso}</p>
        </div>
      )}

      {x.seguimiento && (
        <div className="rounded-xl border border-[var(--color-borde)] p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="etiqueta mb-0">Seguimiento para mandar hoy</p>
            <BotonCopiar texto={x.seguimiento} etiqueta="Copiar mensaje" />
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{x.seguimiento}</p>
        </div>
      )}

      <p className="text-[11px] text-[var(--color-suave)]">
        Resumido el {new Date(x.generadoEn).toLocaleString("es")} con {x.modelo}. Reunión
        del {fechaLegible(reunion.fecha)}.
      </p>
    </div>
  );
}

function Lista({
  titulo,
  items,
  vacio,
  acento,
  Icono,
}: {
  titulo: string;
  items: string[];
  vacio: string;
  acento?: "amber";
  Icono?: typeof CheckCircle2;
}) {
  if (!items.length && !vacio) return null;
  return (
    <div>
      <p className={`etiqueta ${acento === "amber" ? "text-amber-300" : ""}`}>
        {Icono && <Icono size={12} className="mr-1 inline" />}
        {titulo}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-suave)]">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((t, i) => (
            <li key={i} className="text-sm leading-relaxed">
              • {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -------------------------------------------------------------- formulario

type DatosReunion = Omit<Reunion, "id" | "creadaEn" | "actualizadaEn">;

function FormularioReunion({
  onGuardar,
  onCancelar,
}: {
  onGuardar: (d: DatosReunion) => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoReunion>("screening");
  // Por defecto, ahora: lo normal es registrarla justo al colgar.
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 16));
  const [duracion, setDuracion] = useState("");
  const [canal, setCanal] = useState("");
  const [gente, setGente] = useState("");
  const [notas, setNotas] = useState("");

  function guardar() {
    onGuardar({
      tipo,
      fecha,
      duracionMin: duracion.trim() ? Number(duracion) : undefined,
      canal: canal.trim(),
      participantes: participantesDe(gente),
      notasCrudas: notas,
      materiales: [],
    });
  }

  return (
    <div className="panel space-y-3 p-5">
      <h3 className="text-sm font-semibold">Registrar una reunión</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="r-tipo">
            Tipo
          </label>
          <select
            id="r-tipo"
            className="campo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoReunion)}
          >
            {TIPOS_REUNION.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="r-fecha">
            Cuándo fue
          </label>
          <input
            id="r-fecha"
            type="datetime-local"
            className="campo"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="r-canal">
            Por dónde
          </label>
          <input
            id="r-canal"
            className="campo"
            placeholder="Google Meet, Zoom, Teams, teléfono, presencial"
            value={canal}
            onChange={(e) => setCanal(e.target.value)}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="r-duracion">
            Duración en minutos
          </label>
          <input
            id="r-duracion"
            type="number"
            min={1}
            className="campo"
            placeholder="45"
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="etiqueta" htmlFor="r-gente">
          Quién estaba
        </label>
        <input
          id="r-gente"
          className="campo"
          placeholder="Marta Ruiz, Talent Partner; Luis Gómez, Head of Growth"
          value={gente}
          onChange={(e) => setGente(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--color-suave)]">
          Separa a cada persona con punto y coma, y su cargo con una coma.
        </p>
      </div>
      <div>
        <label className="etiqueta" htmlFor="r-notas">
          Apuntes, transcripción o chat de la reunión
        </label>
        <textarea
          id="r-notas"
          className="campo min-h-[160px] font-mono text-xs leading-relaxed"
          placeholder="Pega aquí lo que tengas, sin ordenarlo. Vale la transcripción de Meet, tus notas a mano o el chat de la llamada. Cuanto más literal, mejor sale el resumen."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--color-suave)]">
          Los documentos que mandaron (la propuesta, el plan, la prueba técnica)
          se cuelgan al guardar, desde la reunión.
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="btn btn-primario" onClick={guardar} disabled={!notas.trim()}>
          Guardar y resumir
        </button>
      </div>
    </div>
  );
}
