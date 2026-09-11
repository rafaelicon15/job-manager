/**
 * Deduplicación de pendientes por significado, no por cadena exacta.
 *
 * Cada vez que se redacta una respuesta, el motor vuelve a listar lo que el
 * reclutador ha pedido, con otras palabras. Comparando cadenas literales,
 * "Enviar CV actualizado" y "Enviar CV actualizado con el detalle de
 * experiencia" entraban como dos tareas distintas; tras cuatro redacciones la
 * lista tenía nueve entradas para dos cosas y dejaba de servir para nada.
 *
 * La clave está en qué distingue una tarea de otra: **el objeto, no el verbo**.
 * "Enviar el CV", "compartir el CV" y "mandar el currículum actualizado" son la
 * misma tarea. Por eso se clasifica cada frase por el asunto del que habla, y
 * dos frases que hablan del mismo asunto son la misma tarea. Comparar
 * porcentajes de palabras en común no bastaba: las coletillas del tipo "si el
 * reclutador lo solicita explícitamente" diluían la coincidencia.
 */

/**
 * Asuntos típicos de un proceso de selección. El primero que coincide gana, así
 * que van de más específico a más general.
 */
const ASUNTOS: [string, RegExp][] = [
  ["cv", /\bcv\b|curr[íi]cul|\bresume\b|hoja de vida/i],
  ["salario", /salari|remunerac|expectativ|compensac|honorari|tarifa|presupuest|\brate\b|pretensi/i],
  ["portafolio", /portafoli|portfolio|trabajos previos|casos de [ée]xito|muestras/i],
  ["prueba", /prueba t[ée]cnica|test t[ée]cnico|ejercicio|challenge|reto t[ée]cnico/i],
  [
    "entrevista",
    /entrevista|videollamada|videoconferencia|reuni[óo]n|llamada|interview|\bmeet\b|agendar|calendario|horario/i,
  ],
  ["formulario", /formulario|solicitud|aplicaci[óo]n en el portal|postular en/i],
  ["referencias", /referencia|recomendaci[óo]n|contacto de mi/i],
  ["disponibilidad", /disponibilidad|incorporaci[óo]n|fecha de inicio|cu[áa]ndo puedes/i],
  // Los límites de palabra no son adorno: sin ellos "conFIRMAr" caía en
  // "contrato" por contener "firma", y "segUNDA" o "ageNDA" en "nda".
  ["contrato", /contrato|cl[áa]?usul|\bfirm(a|ar|ado|ada)\b|\bnda\b|confidencialidad/i],
  ["documentos", /documento|identificaci[óo]n|t[íi]tulo|certificad|diploma/i],
];

/** Palabras que no distinguen una tarea de otra. */
const VACIAS = new Set([
  "para", "por", "con", "sin", "una", "unos", "unas", "los", "las", "del",
  "que", "como", "cuando", "tras", "sobre", "este", "esta", "esto", "ese",
  "esa", "eso", "sus", "mas", "muy", "lo", "la", "el", "de", "en", "al",
  "si", "se", "su", "mi", "me", "yo", "ya", "vez", "una", "the", "and",
  "for", "with", "about", "once", "when", "after", "your",
  // Verbos de acción: no distinguen. "Enviar el CV" y "compartir el CV" son lo
  // mismo, y lo que importa es el CV.
  "enviar", "envio", "mandar", "compartir", "adjuntar", "remitir", "pasar",
  "facilitar", "entregar", "aportar", "send", "share", "attach",
  "confirmar", "aclarar", "indicar", "definir", "concretar", "especificar",
  "actualizado", "actualizada", "nuevo", "nueva", "explicitamente",
  "formalmente", "solicita", "solicite", "reclutador", "detalles", "detalle",
]);

function palabras(texto: string): Set<string> {
  const limpio = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ");
  return new Set(
    limpio
      .split(/\s+/)
      .filter((w) => w.length > 2 && !VACIAS.has(w))
      .map((w) => w.replace(/(ales|es|as|os|s)$/, ""))
      .filter((w) => w.length > 2)
  );
}

/** Los asuntos de los que habla una frase. Vacío si no reconoce ninguno. */
function asuntosDe(texto: string): Set<string> {
  const encontrados = new Set<string>();
  for (const [nombre, patron] of ASUNTOS) if (patron.test(texto)) encontrados.add(nombre);
  return encontrados;
}

/** true si las dos frases piden esencialmente lo mismo. */
export function mismoPendiente(a: string, b: string): boolean {
  const A = asuntosDe(a);
  const B = asuntosDe(b);

  // Si de las dos se reconoce el asunto, eso decide: hablan de lo mismo o no.
  if (A.size && B.size) {
    for (const x of A) if (B.has(x)) return true;
    return false;
  }

  // Si de alguna no se reconoce el asunto, se cae a comparar palabras. El
  // umbral se mide contra el conjunto más pequeño, para que una frase corta
  // absorba a otra que solo le añade coletillas.
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.size || !pb.size) return false;
  let comunes = 0;
  for (const w of pa) if (pb.has(w)) comunes++;
  return comunes / Math.min(pa.size, pb.size) >= 0.6;
}

/**
 * Colapsa una lista que YA tiene duplicados. Hace falta además de
 * `juntarPendientes` porque arreglar la fusión no limpia lo que se guardó
 * antes: quien ya tenía nueve entradas para dos tareas seguiría viéndolas.
 * Se aplica al leer el estado, así que la lista se arregla sola.
 *
 * De cada grupo de duplicados sobrevive el texto más corto, que es el más
 * legible, y queda marcado como hecho si CUALQUIERA del grupo lo estaba: si ya
 * mandaste el CV, la tarea está hecha aunque el motor la haya reescrito luego
 * de cuatro maneras distintas.
 */
export function limpiarPendientes<T extends { que: string; hecho: boolean }>(
  lista: T[]
): T[] {
  const salida: T[] = [];

  for (const p of lista) {
    const i = salida.findIndex((q) => mismoPendiente(q.que, p.que));
    if (i === -1) {
      salida.push(p);
      continue;
    }
    salida[i] = {
      ...salida[i],
      que: p.que.length < salida[i].que.length ? p.que : salida[i].que,
      hecho: salida[i].hecho || p.hecho,
    };
  }

  return salida;
}

/**
 * Une los pendientes que ya existen con los recién detectados, sin repetir.
 * Se conserva el que ya estaba —puede estar marcado como hecho— y si el nuevo
 * explica mejor la tarea y nadie la ha tocado, se queda la redacción más corta
 * de las dos: una lista que se lee de un vistazo sirve más que una exhaustiva.
 */
export function juntarPendientes<T extends { que: string; hecho: boolean }>(
  existentes: T[],
  nuevos: string[],
  crear: (que: string) => T
): T[] {
  const resultado = [...existentes];

  for (const texto of nuevos) {
    const limpio = texto.trim();
    if (!limpio) continue;

    const i = resultado.findIndex((p) => mismoPendiente(p.que, limpio));
    if (i === -1) {
      resultado.push(crear(limpio));
      continue;
    }
    if (!resultado[i].hecho && limpio.length < resultado[i].que.length)
      resultado[i] = { ...resultado[i], que: limpio };
  }

  return resultado;
}
