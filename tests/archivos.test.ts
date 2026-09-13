import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { leerArchivo, tamanoLegible, LIMITE_BYTES } from "../lib/archivos.ts";

/** Construye un .docx real (ZIP con deflate) con el XML que se le pase. */
function docx(xml: string): Uint8Array {
  const datos = new TextEncoder().encode(xml);
  const comprimido = deflateRawSync(Buffer.from(datos));
  const nombre = new TextEncoder().encode("word/document.xml");

  // CRC32 del contenido sin comprimir, que es lo que guarda el ZIP.
  const tabla: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c;
  }
  let crc = -1;
  for (const b of datos) crc = (crc >>> 8) ^ tabla[(crc ^ b) & 0xff];
  crc = (crc ^ -1) >>> 0;

  const u16 = (n: number) => [n & 255, (n >> 8) & 255];
  const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255];

  const local = Uint8Array.from([
    ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0),
    ...u32(crc), ...u32(comprimido.length), ...u32(datos.length),
    ...u16(nombre.length), ...u16(0), ...nombre,
  ]);
  const central = Uint8Array.from([
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0),
    ...u16(0), ...u32(crc), ...u32(comprimido.length), ...u32(datos.length),
    ...u16(nombre.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
    ...u32(0), ...u32(0), ...nombre,
  ]);
  const off = local.length + comprimido.length;
  const eocd = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1),
    ...u32(central.length), ...u32(off), ...u16(0),
  ]);
  return Buffer.concat([local, comprimido, central, eocd]);
}

const XML = `<?xml version="1.0"?>
<w:document xmlns:w="x"><w:body>
<w:p><w:r><w:t>CONTRATO DE PRESTACIÓN DE SERVICIOS</w:t></w:r></w:p>
<w:p><w:r><w:t>Cláusula 1: 900 USD mensuales &amp; exclusividad total.</w:t></w:r></w:p>
<w:p/>
<w:p><w:r><w:t>Cláusula 2: propiedad intelectual &lt;incluida la previa&gt;.</w:t></w:r></w:p>
</w:body></w:document>`;

test("extrae el texto de un .docx real", async () => {
  const f = new File([docx(XML)], "contrato.docx");
  const r = await leerArchivo(f);
  assert.equal(r.via, "texto");
  assert.match(r.texto!, /CONTRATO DE PRESTACIÓN/);
  assert.match(r.texto!, /900 USD/);
});

test("resuelve las entidades XML del .docx", async () => {
  const r = await leerArchivo(new File([docx(XML)], "c.docx"));
  assert.match(r.texto!, /exclusividad total & exclusividad|& exclusividad/);
  assert.match(r.texto!, /<incluida la previa>/);
});

test("respeta los saltos de párrafo, incluidos los vacíos", async () => {
  const r = await leerArchivo(new File([docx(XML)], "c.docx"));
  assert.ok(r.texto!.includes("\n"), "los párrafos no se pegan entre sí");
});

test("los PDF van a Gemini tal cual, en base64", async () => {
  const f = new File([new Uint8Array([37, 80, 68, 70])], "cv.pdf", {
    type: "application/pdf",
  });
  const r = await leerArchivo(f);
  assert.equal(r.via, "inline");
  assert.equal(r.mimeType, "application/pdf");
  assert.ok(r.datos && r.datos.length > 0);
});

test("el texto plano y el CSV se leen como texto", async () => {
  const r = await leerArchivo(new File(["a,b\n1,2"], "datos.csv"));
  assert.equal(r.via, "texto");
  assert.match(r.texto!, /a,b/);
});

test("rechaza el .doc antiguo con instrucciones, no con un error seco", async () => {
  await assert.rejects(
    () => leerArchivo(new File([new Uint8Array([1, 2, 3])], "viejo.doc")),
    /guárdalo como PDF/i
  );
});

test("rechaza formatos que no sabe leer diciendo cuáles acepta", async () => {
  await assert.rejects(
    () => leerArchivo(new File([new Uint8Array([1, 2, 3])], "cosa.zip")),
    /Acepto PDF/
  );
});

test("rechaza un archivo vacío y uno demasiado grande", async () => {
  await assert.rejects(() => leerArchivo(new File([], "vacio.pdf", { type: "application/pdf" })), /vacío/);
  const grande = new File([new Uint8Array(LIMITE_BYTES + 1)], "grande.pdf", {
    type: "application/pdf",
  });
  await assert.rejects(() => leerArchivo(grande), /límite es 18 MB/);
});

test("el tamaño se muestra en unidades legibles", () => {
  assert.equal(tamanoLegible(512), "512 B");
  assert.equal(tamanoLegible(2048), "2 KB");
  assert.equal(tamanoLegible(1572864), "1.5 MB");
});
