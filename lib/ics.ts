/**
 * Genera un archivo .ics para meter una entrevista o un seguimiento en el
 * calendario.
 *
 * Es de las cosas más pequeñas de la app y de las que más disgustos evita: la
 * entrevista que se pasa porque estaba anotada solo aquí. Se escribe a mano
 * porque el formato es corto y una librería de calendarios pesa más que esto
 * entero.
 *
 * Las dos reglas del formato que se saltan casi todas las implementaciones
 * caseras están cubiertas: escapar comas, puntos y comas y saltos de línea, y
 * plegar las líneas a 75 octetos. Sin plegar, una descripción larga hace que
 * Outlook rechace el archivo sin decir por qué.
 */

function escapar(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Pliega una línea a 75 octetos, continuando con un espacio.
 *
 * Se cuenta en bytes UTF-8, no en caracteres: una descripción con acentos y
 * eñes ocupa más de lo que parece, y cortar a mitad de un carácter multibyte
 * produce un archivo corrupto.
 */
function plegar(linea: string): string {
  const bytes = new TextEncoder().encode(linea);
  if (bytes.length <= 75) return linea;

  const trozos: string[] = [];
  let actual = "";
  let cuenta = 0;
  // Las continuaciones llevan un espacio delante, que también ocupa.
  let tope = 75;

  for (const caracter of linea) {
    const ancho = new TextEncoder().encode(caracter).length;
    if (cuenta + ancho > tope) {
      trozos.push(actual);
      actual = "";
      cuenta = 0;
      tope = 74;
    }
    actual += caracter;
    cuenta += ancho;
  }
  if (actual) trozos.push(actual);
  return trozos.join("\r\n ");
}

function sello(fecha: Date): string {
  return `${fecha.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

export interface Evento {
  titulo: string;
  /** Fecha y hora de inicio. Acepta "AAAA-MM-DDTHH:MM" o un ISO completo. */
  inicio: string;
  duracionMin?: number;
  descripcion?: string;
  lugar?: string;
  /** Minutos antes para el aviso. 0 o ausente lo deja sin aviso. */
  avisoMin?: number;
}

/**
 * Un evento de día completo cuando solo hay fecha, y con hora cuando la hay.
 *
 * Un seguimiento se apunta como "el martes", no como "el martes a las 9:03".
 * Forzarle una hora inventada al calendario lo llena de citas falsas.
 */
export function crearIcs(e: Evento, ahora = new Date()): string {
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(e.inicio.trim());
  const uid = `${sello(ahora)}-${Math.random().toString(36).slice(2, 10)}@job-manager`;

  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Job Manager//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${sello(ahora)}`,
  ];

  if (soloFecha) {
    const compacta = e.inicio.replace(/-/g, "");
    const siguiente = new Date(`${e.inicio}T00:00:00Z`);
    siguiente.setUTCDate(siguiente.getUTCDate() + 1);
    lineas.push(
      `DTSTART;VALUE=DATE:${compacta}`,
      `DTEND;VALUE=DATE:${siguiente.toISOString().slice(0, 10).replace(/-/g, "")}`
    );
  } else {
    const inicio = new Date(e.inicio);
    if (Number.isNaN(inicio.getTime()))
      throw new Error(`No entiendo la fecha "${e.inicio}".`);
    const fin = new Date(inicio.getTime() + (e.duracionMin ?? 45) * 60000);
    lineas.push(`DTSTART:${sello(inicio)}`, `DTEND:${sello(fin)}`);
  }

  lineas.push(`SUMMARY:${escapar(e.titulo)}`);
  if (e.descripcion) lineas.push(`DESCRIPTION:${escapar(e.descripcion)}`);
  if (e.lugar) lineas.push(`LOCATION:${escapar(e.lugar)}`);

  if (e.avisoMin && e.avisoMin > 0)
    lineas.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapar(e.titulo)}`,
      `TRIGGER:-PT${Math.round(e.avisoMin)}M`,
      "END:VALARM"
    );

  lineas.push("END:VEVENT", "END:VCALENDAR");
  // El formato exige CRLF, y hay clientes que rechazan el archivo sin ellos.
  return `${lineas.map(plegar).join("\r\n")}\r\n`;
}

/** Nombre de archivo sin caracteres que Windows rechace. */
export function nombreIcs(titulo: string): string {
  const limpio = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${limpio || "evento"}.ics`;
}
