import type { Conversacion, Vacante } from "./types";

/**
 * Detecta los procesos que se están enfriando.
 *
 * Es el fallo más caro de una búsqueda de empleo real: los procesos casi nunca
 * se pierden de golpe, se apagan porque nadie dio un toque a tiempo. Y la app
 * los escondía sin querer: en cuanto marcabas la próxima acción como hecha, esa
 * postulación desaparecía de todas las pantallas. Te postulaste hace veinte
 * días, nadie contestó, y no había ni un sitio donde eso se viera.
 *
 * La otra mitad del trabajo es igual de importante: decir cuándo un proceso
 * está muerto. Dos toques sin respuesta y tres semanas de silencio no son un
 * proceso lento, son un no que nadie se molestó en escribir. Mantenerlo en la
 * lista solo gasta atención que le hace falta a otro sitio.
 */

export type EstadoSilencio = "esperando" | "enfriandose" | "muerta";

export interface Silencio {
  vacante: Vacante;
  estado: EstadoSilencio;
  /** Días completos desde la última señal de vida del proceso. */
  dias: number;
  /** Fecha ISO de esa última señal. */
  ultimaSenal: string;
  /** Qué fue esa señal, para poder decírselo al usuario. */
  queFue: string;
  /** Quién habló el último. "nadie" cuando solo consta la postulación. */
  ultimoEn: "ellos" | "yo" | "nadie";
  toques: number;
  /** true cuando toca rendirse y marcarla como descartada. */
  sugiereCerrar: boolean;
}

/** Estados en los que la pelota puede estar en su tejado. */
const EN_JUEGO = ["postulada", "screening", "entrevista", "oferta"];

/**
 * A partir de una entrevista el reloj corre mucho más rápido.
 *
 * Diez días de silencio tras una postulación son lo normal. Diez días tras una
 * entrevista final significan que están cerrando con otro y no te lo han dicho,
 * y ahí un correo a tiempo todavía cambia algo.
 */
const UMBRALES: Record<string, { tibio: number; frio: number }> = {
  postulada: { tibio: 7, frio: 21 },
  screening: { tibio: 5, frio: 14 },
  entrevista: { tibio: 4, frio: 10 },
  oferta: { tibio: 3, frio: 7 },
};

const DIA = 86400000;

function dias(desde: string, hasta: Date): number {
  const t = new Date(desde).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((hasta.getTime() - t) / DIA));
}

/**
 * La última señal de vida del proceso.
 *
 * Deliberadamente NO se usa `actualizadaEn`: cambia cada vez que tocas
 * cualquier campo de la vacante, así que corregir una errata en el título haría
 * parecer vivo un proceso muerto hace un mes.
 */
function ultimaSenal(
  v: Vacante,
  hilos: Conversacion[]
): { fecha: string; queFue: string; ultimoEn: "ellos" | "yo" | "nadie" } {
  const candidatos: { fecha: string; queFue: string; ultimoEn: "ellos" | "yo" | "nadie" }[] = [];

  if (v.fechaPostulacion)
    candidatos.push({ fecha: v.fechaPostulacion, queFue: "te postulaste", ultimoEn: "nadie" });

  for (const t of v.toques ?? [])
    candidatos.push({ fecha: t, queFue: "diste un toque", ultimoEn: "yo" });

  for (const r of v.reuniones ?? [])
    if (r.fecha)
      candidatos.push({ fecha: r.fecha, queFue: "hubo una reunión", ultimoEn: "ellos" });

  for (const h of hilos) {
    const m = h.mensajes.at(-1);
    if (!m?.fecha || m.borrador) continue;
    candidatos.push({
      fecha: m.fecha,
      queFue: m.de === "ellos" ? "te escribieron" : "les escribiste",
      ultimoEn: m.de,
    });
  }

  if (!candidatos.length)
    return { fecha: v.creadaEn, queFue: "la guardaste", ultimoEn: "nadie" };

  return candidatos.reduce((mejor, c) =>
    new Date(c.fecha).getTime() > new Date(mejor.fecha).getTime() ? c : mejor
  );
}

export function analizarSilencios(
  vacantes: Vacante[],
  conversaciones: Conversacion[],
  ahora = new Date()
): Silencio[] {
  const salida: Silencio[] = [];

  for (const v of vacantes) {
    if (!EN_JUEGO.includes(v.estado)) continue;

    const hilos = conversaciones.filter((c) => c.vacanteId === v.id && !c.archivada);
    const senal = ultimaSenal(v, hilos);
    const d = dias(senal.fecha, ahora);
    const umbral = UMBRALES[v.estado] ?? UMBRALES.postulada;

    // Si el último en hablar fueron ellos, no es un silencio suyo: es tuyo, y
    // eso ya sale en "te toca responder" del panel.
    if (senal.ultimoEn === "ellos" && d < umbral.frio) continue;

    const estado: EstadoSilencio =
      d >= umbral.frio ? "muerta" : d >= umbral.tibio ? "enfriandose" : "esperando";
    if (estado === "esperando") continue;

    const toques = (v.toques ?? []).length;
    salida.push({
      vacante: v,
      estado,
      dias: d,
      ultimaSenal: senal.fecha,
      queFue: senal.queFue,
      ultimoEn: senal.ultimoEn,
      toques,
      // Dos toques y el proceso frío: ya has hecho tu parte.
      sugiereCerrar: estado === "muerta" && toques >= 2,
    });
  }

  // Lo más urgente arriba, y a igualdad de urgencia lo más callado.
  const orden: Record<EstadoSilencio, number> = { muerta: 0, enfriandose: 1, esperando: 2 };
  return salida.sort(
    (a, b) => orden[a.estado] - orden[b.estado] || b.dias - a.dias
  );
}

export function etiquetaSilencio(s: Silencio): string {
  if (s.sugiereCerrar) return "Dala por perdida";
  if (s.estado === "muerta") return "Último aviso";
  return "Toca dar un toque";
}
