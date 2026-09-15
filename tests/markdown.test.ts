import { test } from "node:test";
import assert from "node:assert/strict";
import {
  csvAMarkdown,
  docxAMarkdown,
  esLegible,
  limpiarTexto,
  recortarMarkdown,
  textoAMarkdown,
} from "../lib/markdown";

/**
 * La conversión a Markdown de los documentos que manda una empresa.
 *
 * Lo que más se protege aquí es `esLegible`, que es la puerta que decide si un
 * documento se convierte o se manda nativo. Si deja pasar un texto corrupto, el
 * motor resume un contrato con las cifras rotas y nadie se entera.
 */

// ---------------------------------------------------------------- limpieza

test("normaliza saltos y espacios sin tocar la estructura", () => {
  const md = limpiarTexto("# Título\r\n\r\n\r\n\r\nTexto con espacio raro   \n");
  assert.equal(md, "# Título\n\nTexto con espacio raro");
});

test("quita los caracteres de control pero respeta tabuladores y saltos", () => {
  assert.equal(limpiarTexto("ab\tc\nd"), "ab\tc\nd");
});

// --------------------------------------------------------------- legibilidad

const PARRAFO_REAL = `
Propuesta económica para el puesto de responsable de crecimiento. La empresa
ofrece una retribución fija de mil ochocientos dólares mensuales, con revisión
anual en el mes de enero. La jornada es completa y el modelo de trabajo es
remoto, con tres días de presencia en la oficina durante el primer trimestre.
El periodo de prueba se fija en tres meses y la terminación requiere un aviso
previo de quince días por cualquiera de las dos partes.
`;

test("un texto de verdad pasa la prueba de legibilidad", () => {
  assert.equal(esLegible(PARRAFO_REAL), true);
});

test("los códigos internos de una fuente CID NO pasan", () => {
  // Esto es lo que devuelve un PDF con fuentes CID sin tabla ToUnicode, y es
  // exactamente lo que no debe llegar nunca al motor.
  const basura = "HUR  ".repeat(60);
  assert.equal(esLegible(basura), false);
});

test("una ristra de consonantes sin vocales NO pasa", () => {
  assert.equal(esLegible("bcdf ghjk lmnp qrst vwxz ".repeat(40)), false);
});

test("un texto demasiado corto NO pasa: seguramente es un PDF escaneado", () => {
  // Media docena de palabras es lo que saca un escaneo de su marca de agua.
  assert.equal(esLegible("Documento confidencial. Página 1 de 12."), false);
});

test("recortar avisa de que ha recortado", () => {
  const md = recortarMarkdown("x".repeat(500), 100);
  assert.ok(md.length < 300);
  assert.match(md, /documento recortado/);
  assert.equal(recortarMarkdown("corto", 100), "corto");
});

test("el texto plano solo se limpia, no se reinterpreta", () => {
  assert.equal(textoAMarkdown("  Hola\r\n\r\n\r\nmundo  "), "Hola\n\nmundo");
});

// ----------------------------------------------------------------------- CSV

test("un CSV se convierte en tabla Markdown", () => {
  const md = csvAMarkdown("Concepto,Valor\nFijo,1800 USD\nVariable,10%");
  assert.equal(
    md,
    ["| Concepto | Valor |", "| --- | --- |", "| Fijo | 1800 USD |", "| Variable | 10% |"].join("\n")
  );
});

test("detecta el punto y coma, que es lo que usan los exportadores en español", () => {
  // Con la coma como separador, "1.800,50" partiría la fila en dos.
  const md = csvAMarkdown("Concepto;Valor\nFijo;1.800,50 EUR");
  assert.match(md, /\| Fijo \| 1\.800,50 EUR \|/);
});

test("respeta las comas que van dentro de comillas", () => {
  const md = csvAMarkdown('Puesto,Notas\n"Growth, EMEA","Remoto, con viajes"');
  assert.match(md, /\| Growth, EMEA \| Remoto, con viajes \|/);
});

test("una barra vertical dentro de una celda no rompe la tabla", () => {
  const md = csvAMarkdown("a,b\nuno|dos,tres");
  assert.match(md, /uno\\\|dos/);
});

test("un archivo de una sola columna se deja como texto", () => {
  assert.equal(csvAMarkdown("Madrid\nValencia\nSevilla"), "Madrid\nValencia\nSevilla");
});

// ---------------------------------------------------------------------- DOCX

const p = (texto: string, extra = "") =>
  `<w:p>${extra}<w:r><w:t>${texto}</w:t></w:r></w:p>`;

test("los estilos de título se convierten en encabezados", () => {
  const xml = [
    p("Propuesta", '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'),
    p("Condiciones", '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>'),
    p("Texto normal"),
  ].join("");
  assert.equal(docxAMarkdown(xml), "# Propuesta\n\n## Condiciones\n\nTexto normal");
});

test("los puntos de una lista van juntos, no separados por líneas en blanco", () => {
  // Separados, cada punto se lee como una lista de un solo elemento.
  const xml = [
    p("Incluye:"),
    p("Portátil", "<w:pPr><w:numPr><w:ilvl w:val=\"0\"/></w:numPr></w:pPr>"),
    p("Seguro médico", "<w:pPr><w:numPr><w:ilvl w:val=\"0\"/></w:numPr></w:pPr>"),
  ].join("");
  assert.equal(docxAMarkdown(xml), "Incluye:\n\n- Portátil\n- Seguro médico");
});

test("la sangría de una lista anidada se conserva", () => {
  const xml =
    p("Retribución:") +
    p("Fijo", '<w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>') +
    p("Revisable en enero", '<w:pPr><w:numPr><w:ilvl w:val="1"/></w:numPr></w:pPr>');
  assert.equal(
    docxAMarkdown(xml),
    ["Retribución:", "", "- Fijo", "  - Revisable en enero"].join("\n")
  );
});

test("la negrita y la cursiva se marcan sin arrastrar los espacios", () => {
  // "**texto **" no lo interpreta ningún lector de Markdown.
  const xml =
    "<w:p><w:r><w:t>El fijo es </w:t></w:r>" +
    "<w:r><w:rPr><w:b/></w:rPr><w:t>1.800 USD </w:t></w:r>" +
    "<w:r><w:t>al mes</w:t></w:r></w:p>";
  assert.equal(docxAMarkdown(xml), "El fijo es **1.800 USD** al mes");
});

test("una negrita apagada en la plantilla no se marca", () => {
  const xml =
    '<w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>normal</w:t></w:r></w:p>';
  assert.equal(docxAMarkdown(xml), "normal");
});

test("una tabla de Word se convierte en tabla Markdown", () => {
  const celda = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  const xml =
    "<w:tbl>" +
    `<w:tr>${celda("Concepto")}${celda("Valor")}</w:tr>` +
    `<w:tr>${celda("Fijo")}${celda("1.800 USD")}</w:tr>` +
    "</w:tbl>";
  assert.equal(
    docxAMarkdown(xml),
    ["| Concepto | Valor |", "| --- | --- |", "| Fijo | 1.800 USD |"].join("\n")
  );
});

test("la tabla se queda entre los párrafos que la explican", () => {
  // Sacando primero los párrafos y luego las tablas, la tabla de precios
  // acababa separada del texto que dice a qué se refiere.
  const celda = (t: string) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
  const xml =
    p("Estos son los importes:") +
    `<w:tbl><w:tr>${celda("Fijo")}${celda("1800")}</w:tr></w:tbl>` +
    p("Sujetos a retención.");
  const md = docxAMarkdown(xml);
  assert.ok(md.indexOf("Estos son los importes") < md.indexOf("| Fijo"));
  assert.ok(md.indexOf("| Fijo") < md.indexOf("Sujetos a retención"));
});

test("los saltos y tabuladores de Word no desaparecen", () => {
  const xml = "<w:p><w:r><w:t>uno</w:t><w:br/><w:t>dos</w:t><w:tab/><w:t>tres</w:t></w:r></w:p>";
  assert.equal(docxAMarkdown(xml), "uno\ndos tres");
});

test("las entidades XML se desescapan una sola vez", () => {
  // &amp;lt; tiene que quedar en "&lt;", no en "<": desescapar dos veces
  // cambia el contenido de una cláusula.
  const xml = p("Cláusula 5 &amp; 6 &lt;anexo&gt; &quot;firme&quot; &amp;lt;");
  assert.equal(docxAMarkdown(xml), 'Cláusula 5 & 6 <anexo> "firme" &lt;');
});

test("un documento vacío da una cadena vacía, no un error", () => {
  assert.equal(docxAMarkdown(""), "");
  assert.equal(docxAMarkdown("<w:p/><w:p></w:p>"), "");
});
