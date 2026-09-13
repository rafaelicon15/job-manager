import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

/**
 * Pruebas del autorrelleno para los campos que aparecieron en formularios
 * reales después de la primera tanda: el país preseleccionado por el portal,
 * el código postal y la fecha de nacimiento.
 */
const FUENTE = readFileSync(new URL("../extension/rellenar.js", import.meta.url), "utf8");

const FICHA = {
  nombre: "Ana Torres Gil",
  nombrePila: "Ana",
  apellidos: "Torres Gil",
  email: "correo@ejemplo.com",
  telefono: "+58 000 0000000",
  ciudad: "Maracay",
  pais: "Venezuela",
  codigoPostal: "2101",
  fechaNacimiento: "1990-05-14",
  titular: "Growth",
  resumen: "x",
  linkedin: "https://linkedin.com/in/x",
  web: "https://x.example",
  salario: "1.200 USD",
  disponibilidad: "Inmediata",
};

let dom: JSDOM;

function montar(html: string) {
  dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return { width: 120, height: 24, top: 0, left: 0, right: 120, bottom: 24, x: 0, y: 0, toJSON: () => ({}) };
  } as never;
  const w = dom.window as unknown as { eval: (s: string) => void };
  w.eval(FUENTE);
  return w as never as { rellenarFormulario: (f: unknown) => Promise<{ escritos: number }> };
}

const val = (sel: string) =>
  (dom.window.document.querySelector(sel) as HTMLInputElement | null)?.value ?? null;
const nota = (sel: string) =>
  (dom.window.document.querySelector(sel) as HTMLElement | null)?.title ?? "";

test("el estructurado de REGLAS es correcto: regex y cadena, nunca anidados", async () => {
  // Un array anidado por un mal reemplazo seguía siendo JavaScript válido y
  // habría escrito basura en los campos. Se comprueba la forma, no solo que
  // el fichero cargue.
  const m = FUENTE.match(/const REGLAS = \[([\s\S]*?)\n {2}\];/);
  assert.ok(m, "no se encontró el bloque REGLAS");
  const ficha = FICHA as Record<string, string>;
  const reglas = new Function("ficha", `return [${m![1]}]`)(ficha) as unknown[][];
  for (const [patron, valor] of reglas) {
    assert.ok(patron instanceof RegExp, `patrón no es una expresión regular: ${patron}`);
    assert.equal(typeof valor, "string", `el valor no es texto: ${JSON.stringify(valor)}`);
  }
});

test("corrige el país preseleccionado por el portal", async () => {
  // Medido en HireSkys: el país venía en "Pakistan" y la ciudad en "Maracay".
  const w = montar(`<form>
    <label for="c">Country</label>
    <select id="c"><option value="pk">Pakistan</option><option value="ve">Venezuela</option></select>
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#c"), "ve", "enviar Pakistán con ciudad Maracay es peor que no tocar nada");
  assert.match(nota("#c"), /se cambió/i, "un cambio así tiene que avisarse");
});

test("no pisa una selección con una coincidencia solo aproximada", async () => {
  const w = montar(`<form>
    <label for="c">País</label>
    <select id="c"><option value="a">Argentina</option><option value="b">Venezuela (Bolivariana)</option></select>
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#c"), "a", "sin coincidencia exacta se deja lo que había");
  assert.match(nota("#c"), /puede venir puesta por el portal/i);
});

test("con la opción vacía delante sí vale una coincidencia aproximada", async () => {
  const w = montar(`<form>
    <label for="c">País</label>
    <select id="c"><option value="">Elige…</option><option value="b">Venezuela (Bolivariana)</option></select>
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#c"), "b");
});

test("rellena el código postal", async () => {
  const w = montar(`<form><label for="z">Post Code</label><input id="z"></form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#z"), "2101");
});

test("el patrón del código postal no coincide dentro de otras palabras", async () => {
  const w = montar(`<form><label for="o">Ocupación actual</label><input id="o"></form>`);
  await w.rellenarFormulario(FICHA);
  assert.notEqual(val("#o"), "2101", '"cp" dentro de "ocupación" no es un código postal');
});

test("rellena la fecha de nacimiento en el formato que espera un input date", async () => {
  const w = montar(`<form><label for="b">Birth date</label><input id="b" type="date"></form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#b"), "1990-05-14");
});

test("el patrón de la fecha no coincide dentro de otras palabras", async () => {
  const w = montar(`<form><label for="d">Turno doble disponible</label><input id="d"></form>`);
  await w.rellenarFormulario(FICHA);
  assert.notEqual(val("#d"), "1990-05-14", '"dob" dentro de "doble" no es una fecha de nacimiento');
});

test("sin esos datos en el perfil, los campos quedan en ámbar y vacíos", async () => {
  const w = montar(`<form>
    <label for="z">Post Code</label><input id="z">
    <label for="b">Birth date</label><input id="b" type="date">
  </form>`);
  await w.rellenarFormulario({ ...FICHA, codigoPostal: "", fechaNacimiento: "" });
  assert.equal(val("#z"), "");
  assert.equal(val("#b"), "");
});
