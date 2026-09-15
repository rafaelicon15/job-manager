/**
 * Lectura de los documentos que manda un reclutador: la descripción del puesto
 * en PDF, un contrato, una propuesta económica, una prueba técnica en .docx.
 *
 * Dos caminos según el formato:
 *  - PDF e imágenes van tal cual a Gemini como `inlineData`. Gemini los lee
 *    nativamente, así que no hace falta ninguna librería de extracción ni
 *    OCR: un contrato escaneado también se entiende.
 *  - Texto plano, CSV, Markdown, JSON y .docx se convierten a texto aquí y
 *    viajan como parte del prompt. Gemini NO acepta .docx como inlineData,
 *    de ahí el descomprimido manual.
 *
 * Lo que NO se hace, y es deliberado: los bytes del archivo no se guardan.
 * El estado entero de la app vive en localStorage, que ronda los 5 MB en la
 * mayoría de navegadores; tres contratos en PDF lo llenarían y el usuario
 * perdería vacantes y conversaciones sin entender por qué. Se guarda el
 * análisis y la ficha del archivo (nombre, tamaño, fecha). El archivo original
 * sigue en su disco, que es donde tiene sentido que esté.
 */

import {
  csvAMarkdown,
  docxAMarkdown,
  LIMITE_MARKDOWN,
  recortarMarkdown,
  textoAMarkdown,
} from "./markdown";
import { textoDePdf } from "./pdfTexto";

/** Tipos que Gemini lee directamente, sin convertir. */
const NATIVOS = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Formatos de texto que se leen aquí y viajan dentro del prompt. */
const TEXTO = /\.(txt|csv|md|markdown|json|rtf)$/i;
const DOCX = /\.docx$/i;

/** 18 MB: por encima de eso Gemini rechaza la petición por tamaño. */
export const LIMITE_BYTES = 18 * 1024 * 1024;

export interface ArchivoLeido {
  nombre: string;
  bytes: number;
  /** Cómo hay que mandárselo a Gemini. */
  via: "inline" | "texto";
  mimeType: string;
  /** base64 sin cabecera, solo cuando via === "inline". */
  datos?: string;
  /** Texto extraído, solo cuando via === "texto". */
  texto?: string;
}

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  // De 8 KB en 8 KB: pasar un array de millones de elementos a
  // String.fromCharCode de golpe desborda la pila de argumentos.
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}

/**
 * Saca el texto de un .docx. Un .docx es un ZIP y el texto vive en
 * `word/document.xml`, así que se localiza esa entrada en el directorio
 * central del ZIP y se descomprime con DecompressionStream, que ya traen los
 * navegadores. Evita añadir una librería de 200 KB para leer un párrafo.
 */
async function xmlDeDocx(buf: ArrayBuffer): Promise<string> {
  const vista = new DataView(buf);
  const bytes = new Uint8Array(buf);

  // El directorio central acaba con la firma EOCD (0x06054b50). Se busca desde
  // el final porque puede haber comentario después.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 65558; i--) {
    if (vista.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("El .docx no parece un archivo válido.");

  const entradas = vista.getUint16(eocd + 10, true);
  let p = vista.getUint32(eocd + 16, true); // inicio del directorio central

  for (let n = 0; n < entradas; n++) {
    if (vista.getUint32(p, true) !== 0x02014b50) break;
    const metodo = vista.getUint16(p + 10, true);
    const comprimido = vista.getUint32(p + 20, true);
    const largoNombre = vista.getUint16(p + 28, true);
    const largoExtra = vista.getUint16(p + 30, true);
    const largoComent = vista.getUint16(p + 32, true);
    const desplazamiento = vista.getUint32(p + 42, true);
    const nombre = new TextDecoder().decode(
      bytes.subarray(p + 46, p + 46 + largoNombre)
    );

    if (nombre === "word/document.xml") {
      // En la cabecera local el nombre y el extra pueden medir otra cosa.
      const nomLocal = vista.getUint16(desplazamiento + 26, true);
      const extraLocal = vista.getUint16(desplazamiento + 28, true);
      const inicio = desplazamiento + 30 + nomLocal + extraLocal;
      const crudo = bytes.subarray(inicio, inicio + comprimido);

      let xml: string;
      if (metodo === 0) {
        xml = new TextDecoder().decode(crudo);
      } else if (metodo === 8) {
        const flujo = new Blob([crudo])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        xml = await new Response(flujo).text();
      } else {
        throw new Error(`El .docx usa una compresión que no sé leer (${metodo}).`);
      }

      return xml;
    }

    p += 46 + largoNombre + largoExtra + largoComent;
  }
  throw new Error("No encontré el texto dentro del .docx.");
}

export async function leerArchivo(f: File): Promise<ArchivoLeido> {
  if (f.size > LIMITE_BYTES)
    throw new Error(
      `"${f.name}" pesa ${(f.size / 1048576).toFixed(1)} MB y el límite es 18 MB.`
    );
  if (f.size === 0) throw new Error(`"${f.name}" está vacío.`);

  const base = { nombre: f.name, bytes: f.size };

  if (NATIVOS.has(f.type)) {
    return {
      ...base,
      via: "inline",
      mimeType: f.type,
      datos: base64(await f.arrayBuffer()),
    };
  }

  if (DOCX.test(f.name)) {
    const texto = docxAMarkdown(await xmlDeDocx(await f.arrayBuffer()));
    if (!texto) throw new Error(`"${f.name}" no tiene texto que leer.`);
    return { ...base, via: "texto", mimeType: "text/plain", texto };
  }

  if (TEXTO.test(f.name) || f.type.startsWith("text/")) {
    const texto = (await f.text()).trim();
    if (!texto) throw new Error(`"${f.name}" no tiene texto que leer.`);
    return { ...base, via: "texto", mimeType: "text/plain", texto };
  }

  // .doc antiguo es un formato binario propietario; convertirlo a mano no
  // merece la pena cuando "Guardar como PDF" tarda cinco segundos.
  if (/\.docx?$/i.test(f.name))
    throw new Error(
      `"${f.name}" está en el formato .doc antiguo. Ábrelo y guárdalo como PDF o .docx.`
    );

  throw new Error(
    `No puedo leer "${f.name}". Acepto PDF, imágenes, .docx, .txt, .csv, .md y .json.`
  );
}


// -------------------------------------------------------------- a Markdown

/**
 * Lo que cuelgas de una reunión, ya convertido.
 *
 * `markdown` es el caso normal y el bueno: el documento en texto, con su
 * estructura, ligero de mandar y pequeño de guardar. `inline` es el plan B para
 * lo que no se puede convertir de forma fiable, un PDF escaneado o una captura
 * de pantalla: esos viajan como bytes y los lee Gemini, pero no se quedan
 * guardados porque no caben en localStorage.
 */
export type MaterialLeido =
  | {
      nombre: string;
      bytes: number;
      tipo: string;
      via: "markdown";
      markdown: string;
      /** Palabras del Markdown, para que se vea el peso real en pantalla. */
      palabras: number;
      /** Cuando el original era un PDF y hubo que extraerle el texto. */
      extraido?: boolean;
    }
  | {
      nombre: string;
      bytes: number;
      tipo: string;
      via: "inline";
      mimeType: string;
      datos: string;
      /** Por qué no se pudo convertir, para decírselo al usuario. */
      motivo: string;
    };

const IMAGEN = /^image\//;

/**
 * Convierte un documento a Markdown, o lo deja en bytes si no hay forma.
 *
 * El orden importa. Un PDF se intenta extraer SIEMPRE antes de mandarlo
 * nativo, porque el Markdown pesa dos órdenes de magnitud menos y se puede
 * guardar con la reunión. Pero si lo extraído no pasa la prueba de legibilidad,
 * el archivo se va nativo: preferimos que Gemini lea la imagen del contrato
 * antes que pasarle un texto con las cifras rotas.
 */
export async function leerComoMarkdown(f: File): Promise<MaterialLeido> {
  if (f.size > LIMITE_BYTES)
    throw new Error(
      `"${f.name}" pesa ${(f.size / 1048576).toFixed(1)} MB y el límite es 18 MB.`
    );
  if (f.size === 0) throw new Error(`"${f.name}" está vacío.`);

  const base = { nombre: f.name, bytes: f.size, tipo: f.type || extension(f.name) };
  const enMarkdown = (md: string, extraido = false): MaterialLeido => {
    const limpio = recortarMarkdown(md, LIMITE_MARKDOWN);
    return {
      ...base,
      via: "markdown",
      markdown: limpio,
      palabras: (limpio.match(/\S+/g) ?? []).length,
      extraido,
    };
  };

  if (/\.pdf$/i.test(f.name) || f.type === "application/pdf") {
    const { texto, legible } = await textoDePdf(await f.arrayBuffer());
    if (legible) return enMarkdown(texto, true);
    return {
      ...base,
      via: "inline",
      mimeType: "application/pdf",
      datos: base64(await f.arrayBuffer()),
      motivo: texto.trim()
        ? "El texto que trae dentro sale corrupto, así que va el PDF entero para que lo lea la IA."
        : "Es un PDF escaneado, sin texto que extraer: va entero para que lo lea la IA.",
    };
  }

  if (IMAGEN.test(f.type)) {
    if (!NATIVOS.has(f.type))
      throw new Error(`"${f.name}" está en un formato de imagen que Gemini no lee.`);
    return {
      ...base,
      via: "inline",
      mimeType: f.type,
      datos: base64(await f.arrayBuffer()),
      motivo: "Una imagen no se convierte a texto: va entera para que la lea la IA.",
    };
  }

  if (DOCX.test(f.name))
    return enMarkdown(docxAMarkdown(await xmlDeDocx(await f.arrayBuffer())));

  if (/\.(csv|tsv)$/i.test(f.name)) return enMarkdown(csvAMarkdown(await f.text()));

  if (TEXTO.test(f.name) || f.type.startsWith("text/"))
    return enMarkdown(textoAMarkdown(await f.text()));

  if (/\.docx?$/i.test(f.name))
    throw new Error(
      `"${f.name}" está en el formato .doc antiguo. Ábrelo y guárdalo como PDF o .docx.`
    );

  throw new Error(
    `No puedo leer "${f.name}". Acepto PDF, .docx, .txt, .md, .csv, .json e imágenes.`
  );
}

function extension(nombre: string): string {
  const e = /\.([a-z0-9]+)$/i.exec(nombre)?.[1];
  return e ? e.toLowerCase() : "desconocido";
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
