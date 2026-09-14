import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Los ficheros de la extensión no pasan por el compilador: no son parte del
 * proyecto de Next, así que `tsc` no los mira y `npm run build` no los toca.
 * Sin esta prueba, un error de sintaxis llega al repositorio sin que nada
 * chille, y la extensión se rompe entera al cargarla.
 *
 * Pasó: renombrar una variable dejó dos `const partes` en la misma función, y
 * las pruebas no se enteraron porque solo cargaban `rellenar.js`.
 */
const CARPETA = fileURLToPath(new URL("../extension/", import.meta.url));

const ficheros = readdirSync(CARPETA).filter((f) => f.endsWith(".js"));

test("hay ficheros de la extensión que comprobar", () => {
  assert.ok(ficheros.length >= 2, `solo se encontraron: ${ficheros.join(", ")}`);
});

for (const fichero of ficheros)
  test(`${fichero} no tiene errores de sintaxis`, () => {
    const fuente = readFileSync(CARPETA + fichero, "utf8");
    // `new Function` compila sin ejecutar: detecta la sintaxis y las
    // redeclaraciones sin necesitar un navegador ni las APIs de Chrome.
    assert.doesNotThrow(() => new Function(fuente), `${fichero} no compila`);
  });

test("el manifest es JSON válido y declara lo que carga el popup", () => {
  const manifest = JSON.parse(readFileSync(CARPETA + "manifest.json", "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  // Los permisos son la promesa que se le hace al usuario: si crecen, que sea
  // a propósito y no de refilón.
  assert.deepEqual(
    [...manifest.permissions].sort(),
    ["activeTab", "scripting", "storage"],
    "cualquier permiso nuevo hay que justificarlo en la documentación"
  );
});

test("el popup carga todos los scripts que usa", () => {
  const html = readFileSync(CARPETA + "popup.html", "utf8");
  for (const f of ficheros)
    assert.match(html, new RegExp(`src="${f}"`), `popup.html no carga ${f}`);
  // El orden importa: rellenar.js define las funciones que popup.js inyecta.
  assert.ok(
    html.indexOf('src="rellenar.js"') < html.indexOf('src="popup.js"'),
    "rellenar.js tiene que cargarse antes que popup.js"
  );
});

test("popup.js usa las funciones que define rellenar.js", () => {
  const popup = readFileSync(CARPETA + "popup.js", "utf8");
  const rellenar = readFileSync(CARPETA + "rellenar.js", "utf8");
  for (const fn of ["rellenarFormulario", "recogerPreguntas"]) {
    assert.match(rellenar, new RegExp(`function ${fn}`), `rellenar.js no define ${fn}`);
    assert.match(popup, new RegExp(`func: ${fn}`), `popup.js no inyecta ${fn}`);
  }
});
