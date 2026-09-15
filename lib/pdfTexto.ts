/**
 * Saca el texto de un PDF en el navegador, sin librerías.
 *
 * Un PDF lleva su texto dentro de flujos comprimidos con zlib, y los
 * navegadores ya traen `DecompressionStream`, así que descomprimirlos no cuesta
 * nada. Lo que hay dentro es un lenguaje de dibujo: hay que leer los operadores
 * que pintan texto (Tj, TJ) y las órdenes que mueven el cursor (Td, TD, Tm, T*)
 * para saber dónde acaba una línea y empieza otra.
 *
 * Esto NO es un lector de PDF completo, y no pretende serlo:
 *
 *  - Un PDF escaneado no tiene texto, tiene una imagen de un texto. De aquí
 *    sale poco o nada, y está bien: quien llama lo detecta y manda el archivo
 *    nativo a Gemini, que sí sabe leer la imagen.
 *  - Un PDF con fuentes CID sin tabla ToUnicode devuelve los códigos internos
 *    de la fuente, que salen como símbolos sin sentido. Interpretar eso bien
 *    exige implementar los CMap, y no merece la pena cuando el mismo archivo
 *    puede irse nativo.
 *
 * De ahí que la función devuelva `legible`. Quien llama NUNCA debe usar el
 * texto si `legible` es falso: una cifra mal extraída de un contrato es peor
 * que no tener el contrato.
 */

import { esLegible, limpiarTexto } from "./markdown";

const latin1 = new TextDecoder("latin1");

/** Los 32 huecos donde cp1252 se separa de latin1. */
const CP1252: Record<number, string> = {
  0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
  0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "'",
  0x92: "'", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—",
  0x98: "˜", 0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
};

/**
 * Pasa los bytes de una cadena de PDF a texto.
 *
 * Por defecto las cadenas van en cp1252, que es latin1 salvo en el tramo
 * 0x80-0x9F donde viven las comillas tipográficas y el guion largo. Sin esta
 * tabla, un contrato lleno de comillas curvas sale con basura en medio.
 */
function decodificar(bruto: string): string {
  // Marca de orden de bytes: la cadena va en UTF-16 big endian.
  if (bruto.charCodeAt(0) === 0xfe && bruto.charCodeAt(1) === 0xff) {
    let s = "";
    for (let i = 2; i + 1 < bruto.length; i += 2)
      s += String.fromCharCode((bruto.charCodeAt(i) << 8) | bruto.charCodeAt(i + 1));
    return s;
  }
  let s = "";
  for (let i = 0; i < bruto.length; i++) {
    const c = bruto.charCodeAt(i);
    s += CP1252[c] ?? String.fromCharCode(c);
  }
  return s;
}

/** Lee una cadena literal `(...)`, con paréntesis anidados y escapes. */
function leerLiteral(s: string, desde: number): [string, number] {
  let i = desde + 1;
  let profundidad = 1;
  let bruto = "";

  while (i < s.length) {
    const c = s[i];

    if (c === "\\") {
      const d = s[i + 1];
      i += 2;
      if (d === "n") bruto += "\n";
      else if (d === "r") bruto += "\r";
      else if (d === "t") bruto += "\t";
      else if (d === "b") bruto += "\b";
      else if (d === "f") bruto += "\f";
      else if (d === "\n") continue; // línea partida dentro de la cadena
      else if (d === "\r") {
        if (s[i] === "\n") i++;
      } else if (d >= "0" && d <= "7") {
        let octal = d;
        while (octal.length < 3 && s[i] >= "0" && s[i] <= "7") octal += s[i++];
        bruto += String.fromCharCode(parseInt(octal, 8));
      } else bruto += d;
      continue;
    }

    if (c === "(") profundidad++;
    else if (c === ")") {
      profundidad--;
      if (profundidad === 0) return [decodificar(bruto), i + 1];
    }
    bruto += c;
    i++;
  }
  return [decodificar(bruto), i];
}

/** Lee una cadena hexadecimal `<...>` como bytes. */
function leerHex(s: string, desde: number): [string, number] {
  const fin = s.indexOf(">", desde);
  if (fin === -1) return ["", s.length];
  const hex = s.slice(desde + 1, fin).replace(/[^0-9a-fA-F]/g, "");
  let bruto = "";
  for (let i = 0; i + 1 < hex.length; i += 2)
    bruto += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  // Un hex impar completa con cero, según la especificación.
  if (hex.length % 2) bruto += String.fromCharCode(parseInt(`${hex.at(-1)}0`, 16));
  return [decodificar(bruto), fin + 1];
}

/**
 * Recorre un flujo de contenido y devuelve su texto con los saltos de línea
 * donde toca.
 *
 * El criterio de salto es la coordenada vertical: si una orden de posición
 * cambia la Y, empieza una línea nueva; si solo cambia la X, es la misma línea
 * y va un espacio. Muchos PDFs colocan cada palabra con su propia orden, así
 * que sin esto el documento sale a razón de una palabra por línea.
 */
function textoDeContenido(s: string): string {
  let salida = "";
  const numeros: number[] = [];
  let cadenas: string[] = [];
  let ultimaY: number | null = null;
  let i = 0;

  const emitir = (sep: string) => {
    if (!cadenas.length) return;
    const trozo = cadenas.join("");
    cadenas = [];
    if (!trozo) return;
    if (salida && !salida.endsWith("\n") && !/\s$/.test(salida) && sep) salida += sep;
    salida += trozo;
  };

  while (i < s.length) {
    const c = s[i];

    if (c === "(") {
      const [texto, fin] = leerLiteral(s, i);
      cadenas.push(texto);
      i = fin;
      continue;
    }
    if (c === "<" && s[i + 1] !== "<") {
      const [texto, fin] = leerHex(s, i);
      cadenas.push(texto);
      i = fin;
      continue;
    }
    if (c === "-" || c === "+" || c === "." || (c >= "0" && c <= "9")) {
      const m = /^[-+]?(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (m) {
        numeros.push(Number(m[0]));
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z'"*]/.test(c)) {
      const m = /^[A-Za-z]+\*?|^'|^"/.exec(s.slice(i));
      const op = m ? m[0] : c;
      i += op.length;

      switch (op) {
        case "Tj":
        case "TJ":
          emitir(" ");
          break;
        case "'":
        case '"':
          // Estos dos pintan en la línea siguiente por definición.
          salida += salida && !salida.endsWith("\n") ? "\n" : "";
          emitir("");
          break;
        case "Td":
        case "TD": {
          const y = numeros.at(-1);
          emitir(" ");
          if (y !== undefined && y !== 0) salida += salida.endsWith("\n") ? "" : "\n";
          break;
        }
        case "Tm": {
          const y = numeros.at(-1);
          emitir(" ");
          if (y !== undefined && ultimaY !== null && Math.abs(y - ultimaY) > 0.5)
            salida += salida.endsWith("\n") ? "" : "\n";
          if (y !== undefined) ultimaY = y;
          break;
        }
        case "T*":
        case "ET":
          emitir(" ");
          salida += salida.endsWith("\n") ? "" : "\n";
          break;
        default:
          emitir(" ");
      }
      numeros.length = 0;
      continue;
    }
    i++;
  }
  emitir(" ");
  return salida;
}

async function inflar(crudo: Uint8Array): Promise<string | null> {
  // zlib primero, que es lo que usa FlateDecode; algunos generadores dejan el
  // deflate a secas sin cabecera.
  for (const formato of ["deflate", "deflate-raw"] as const) {
    try {
      const flujo = new Blob([crudo as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream(formato));
      return latin1.decode(await new Response(flujo).arrayBuffer());
    } catch {
      // Se prueba el siguiente formato.
    }
  }
  return null;
}

/**
 * Localiza los flujos del PDF a lo bruto, buscando la palabra `stream` en vez
 * de seguir la tabla de referencias cruzadas.
 *
 * Es deliberado: la tabla puede estar comprimida, con secciones incrementales o
 * simplemente mal, y aquí no hace falta reconstruir el documento. Si un flujo
 * no descomprime, se salta y no pasa nada.
 */
function* flujos(texto: string, bytes: Uint8Array) {
  let i = 0;
  while ((i = texto.indexOf("stream", i)) !== -1) {
    if (texto.slice(i - 3, i + 6) === "endstream") {
      i += 6;
      continue;
    }
    const diccionario = texto.slice(Math.max(0, i - 900), i);
    let inicio = i + 6;
    if (texto[inicio] === "\r") inicio++;
    if (texto[inicio] === "\n") inicio++;

    const fin = texto.indexOf("endstream", inicio);
    if (fin === -1) return;

    // Entre los datos y `endstream` va un salto de línea que NO forma parte
    // del flujo. Colarlo dentro hace que el inflado falle por bytes de sobra
    // al final, y entonces el PDF entero parece ilegible. Lo dice el
    // diccionario: /Length son los bytes exactos. Si viene como referencia
    // indirecta, que es legal, se recorta el salto a mano.
    const largo = Number(/\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(diccionario)?.[1]);
    let corte = fin;
    if (Number.isFinite(largo) && largo > 0 && inicio + largo <= fin) {
      corte = inicio + largo;
    } else {
      while (corte > inicio && (bytes[corte - 1] === 0x0a || bytes[corte - 1] === 0x0d))
        corte--;
    }

    yield { diccionario, datos: bytes.subarray(inicio, corte) };
    i = fin + 9;
  }
}

export interface PdfExtraido {
  texto: string;
  /** Falso cuando lo extraído no sirve: PDF escaneado, cifrado o con CID. */
  legible: boolean;
  /** Cuántos flujos de contenido se pudieron leer. */
  bloques: number;
}

export async function textoDePdf(buf: ArrayBuffer): Promise<PdfExtraido> {
  const bytes = new Uint8Array(buf);
  const texto = latin1.decode(bytes);
  const partes: string[] = [];

  for (const { diccionario, datos } of flujos(texto, bytes)) {
    // Las imágenes y las fuentes incrustadas son la mayor parte del peso de un
    // PDF y no tienen texto: descomprimirlas sería tirar el tiempo.
    if (/\/Subtype\s*\/Image|\/DCTDecode|\/JPXDecode|\/FontFile/.test(diccionario)) continue;

    let contenido: string | null;
    if (/\/FlateDecode/.test(diccionario)) contenido = await inflar(datos);
    else if (/\/Filter/.test(diccionario)) continue; // LZW, RunLength y demás
    else contenido = latin1.decode(datos);

    if (!contenido) continue;
    // Un flujo de contenido abre bloque de texto y pinta algo.
    if (!contenido.includes("BT") || !/\bT[Jj]\b|\bTJ\b/.test(contenido)) continue;

    const trozo = textoDeContenido(contenido).trim();
    if (trozo) partes.push(trozo);
  }

  const bruto = partes.join("\n\n");
  const limpio = limpiarTexto(bruto)
    // Los números de página sueltos en su propia línea son ruido.
    .replace(/^\s*\d{1,4}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { texto: limpio, legible: esLegible(limpio), bloques: partes.length };
}
