import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { textoDePdf } from "../lib/pdfTexto";
import { leerComoMarkdown } from "../lib/archivos";

/**
 * Extracción de texto de un PDF, y la decisión de convertirlo o mandarlo
 * nativo.
 *
 * La prueba que más importa es la del PDF sin capa de texto: tiene que decir
 * que NO es legible. Si dijera que sí, el motor resumiría un contrato a partir
 * de cuatro palabras de una marca de agua y se inventaría el resto.
 */

const LINEAS = [
  "Propuesta economica para el puesto de responsable de crecimiento.",
  "La retribucion fija es de mil ochocientos dolares mensuales.",
  "La revision salarial se hace en el mes de enero de cada anio.",
  "El modelo de trabajo es remoto con tres dias en la oficina.",
  "El periodo de prueba se fija en tres meses naturales.",
  "La terminacion requiere un aviso previo de quince dias.",
];

/** Un PDF de verdad, mínimo pero con la estructura que espera un lector. */
function pdfConTexto(lineas: string[], comprimir: boolean): Uint8Array {
  const ordenes = [
    "BT",
    "/F1 11 Tf",
    "72 720 Td",
    ...lineas.flatMap((l, i) => [
      i === 0 ? "" : "0 -16 Td",
      // Solo se escapan los paréntesis: las barras que traigan las líneas son
      // escapes de PDF a propósito, como los octales de las comillas curvas.
      `(${l.replace(/[()]/g, "\\$&")}) Tj`,
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const contenido = comprimir
    ? deflateSync(Buffer.from(ordenes, "latin1"))
    : Buffer.from(ordenes, "latin1");

  const filtro = comprimir ? "/Filter /FlateDecode " : "";
  const cabeza = Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj",
      `4 0 obj << ${filtro}/Length ${contenido.length} >>`,
      "stream\n",
    ].join("\n"),
    "latin1"
  );
  const cola = Buffer.from("\nendstream endobj\n%%EOF\n", "latin1");
  return new Uint8Array(Buffer.concat([cabeza, contenido, cola]));
}

/** Un PDF escaneado: una imagen y ninguna orden de texto. */
function pdfEscaneado(): Uint8Array {
  const imagen = deflateSync(Buffer.alloc(4096, 0x7f));
  return new Uint8Array(
    Buffer.concat([
      Buffer.from(
        [
          "%PDF-1.4",
          "1 0 obj << /Type /Catalog >> endobj",
          `2 0 obj << /Subtype /Image /Filter /FlateDecode /Width 64 /Height 64 /Length ${imagen.length} >>`,
          "stream\n",
        ].join("\n"),
        "latin1"
      ),
      imagen,
      Buffer.from("\nendstream endobj\n%%EOF\n", "latin1"),
    ])
  );
}

const bufferDe = (u8: Uint8Array): ArrayBuffer =>
  u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;

// -------------------------------------------------------------- extracción

test("saca el texto de un PDF con el flujo comprimido", async () => {
  const { texto, legible, bloques } = await textoDePdf(bufferDe(pdfConTexto(LINEAS, true)));
  assert.equal(legible, true);
  assert.equal(bloques, 1);
  for (const l of LINEAS) assert.ok(texto.includes(l), `falta la línea: ${l}`);
});

test("saca el texto de un PDF sin comprimir", async () => {
  const { texto, legible } = await textoDePdf(bufferDe(pdfConTexto(LINEAS, false)));
  assert.equal(legible, true);
  assert.match(texto, /mil ochocientos dolares/);
});

test("cada línea del PDF queda en su línea, no todo seguido", async () => {
  // Sin mirar la coordenada vertical, un PDF que coloca cada línea con su
  // propia orden salía como un único párrafo de mil palabras.
  const { texto } = await textoDePdf(bufferDe(pdfConTexto(LINEAS, true)));
  assert.equal(texto.split("\n").filter((l) => l.trim()).length, LINEAS.length);
});

test("un PDF escaneado NO es legible", async () => {
  const { texto, legible } = await textoDePdf(bufferDe(pdfEscaneado()));
  assert.equal(legible, false);
  assert.equal(texto, "", "no hay texto que extraer de una imagen");
});

test("las comillas tipográficas y los acentos sobreviven", async () => {
  // Las cadenas de un PDF van en cp1252, que no es latin1 en el tramo donde
  // viven las comillas curvas: sin la tabla, un contrato sale con basura.
  const linea =
    "El anexo \\223Condiciones especiales\\224 fija la retribuci\\363n y el a\\361o de revisi\\363n.";
  const { texto } = await textoDePdf(
    bufferDe(pdfConTexto([...LINEAS, linea], true))
  );
  assert.match(texto, /“Condiciones especiales”/);
  assert.match(texto, /retribución/);
  assert.match(texto, /año/);
});

test("los números de página sueltos se quitan", async () => {
  const { texto } = await textoDePdf(bufferDe(pdfConTexto([...LINEAS, "12"], true)));
  assert.ok(!/^\s*12\s*$/m.test(texto));
});

test("un archivo que no es un PDF no lanza, solo no es legible", async () => {
  const basura = new TextEncoder().encode("esto no es un pdf ni lo pretende");
  const { legible, bloques } = await textoDePdf(bufferDe(basura));
  assert.equal(legible, false);
  assert.equal(bloques, 0);
});

// ------------------------------------------------- decisión de convertir

const archivo = (nombre: string, datos: Uint8Array | string, tipo: string) =>
  new File([datos as BlobPart], nombre, { type: tipo });

test("un PDF con texto se convierte a Markdown y se marca como extraído", async () => {
  const m = await leerComoMarkdown(
    archivo("propuesta.pdf", pdfConTexto(LINEAS, true), "application/pdf")
  );
  assert.equal(m.via, "markdown");
  if (m.via !== "markdown") return;
  assert.equal(m.extraido, true);
  assert.ok(m.palabras > 40);
  assert.match(m.markdown, /mil ochocientos dolares/);
});

test("el Markdown pesa una fracción del PDF original", async () => {
  // Es la razón de ser de todo esto: lo convertido cabe en localStorage.
  const pdf = pdfConTexto(LINEAS, true);
  const m = await leerComoMarkdown(archivo("propuesta.pdf", pdf, "application/pdf"));
  if (m.via !== "markdown") throw new Error("debería haberse convertido");
  assert.ok(
    m.markdown.length < pdf.byteLength,
    `Markdown ${m.markdown.length} B contra PDF ${pdf.byteLength} B`
  );
});

test("un PDF escaneado se manda nativo y dice por qué", async () => {
  const m = await leerComoMarkdown(
    archivo("contrato-escaneado.pdf", pdfEscaneado(), "application/pdf")
  );
  assert.equal(m.via, "inline");
  if (m.via !== "inline") return;
  assert.equal(m.mimeType, "application/pdf");
  assert.ok(m.datos.length > 0, "tienen que ir los bytes");
  assert.match(m.motivo, /escaneado/);
});

test("un .md y un .txt entran tal cual", async () => {
  const md = await leerComoMarkdown(
    archivo("plan.md", "# Plan\n\n- Primer mes\n- Segundo mes", "text/markdown")
  );
  if (md.via !== "markdown") throw new Error("debería haberse convertido");
  assert.equal(md.markdown, "# Plan\n\n- Primer mes\n- Segundo mes");
});

test("un CSV se convierte en tabla", async () => {
  const m = await leerComoMarkdown(
    archivo("importes.csv", "Concepto;Valor\nFijo;1800", "text/csv")
  );
  if (m.via !== "markdown") throw new Error("debería haberse convertido");
  assert.match(m.markdown, /\| Concepto \| Valor \|/);
});

test("una imagen va nativa: no hay texto que convertir", async () => {
  const m = await leerComoMarkdown(archivo("pantallazo.png", new Uint8Array(64), "image/png"));
  assert.equal(m.via, "inline");
});

test("un .doc antiguo se rechaza con una salida clara", async () => {
  await assert.rejects(
    () => leerComoMarkdown(archivo("propuesta.doc", "contenido binario", "application/msword")),
    /formato \.doc antiguo/
  );
});

test("un archivo vacío se rechaza antes de intentar nada", async () => {
  await assert.rejects(
    () => leerComoMarkdown(archivo("vacio.txt", "", "text/plain")),
    /está vacío/
  );
});

test("un formato que no sabemos leer lo dice en lugar de fallar raro", async () => {
  await assert.rejects(
    () => leerComoMarkdown(archivo("presentacion.pptx", new Uint8Array(64), "")),
    /No puedo leer/
  );
});
