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
    // undefined es válido: una ficha sincronizada antes de que existiera un
    // campo no lo trae, y el relleno lo salta sin más. Lo que no puede ser es
    // un array o un objeto, que es lo que dejaba un reemplazo mal hecho.
    assert.ok(
      typeof valor === "string" || valor === undefined,
      `el valor no es texto ni está ausente: ${JSON.stringify(valor)}`
    );
  }
});

test("una ficha vieja sin los campos nuevos no rompe el relleno", async () => {
  // Quien sincronizó antes de que existieran provincia o código postal tiene
  // una ficha sin esas claves. Debe rellenar lo que sí tiene y dejar el resto.
  const vieja = { nombre: "Ana Torres Gil", nombrePila: "Ana", email: "correo@ejemplo.com" };
  const w = montar(`<form>
    <label for="e">Correo</label><input id="e">
    <label for="s">State</label><input id="s">
    <label for="z">Zip</label><input id="z">
  </form>`);
  await w.rellenarFormulario(vieja);
  assert.equal(val("#e"), "correo@ejemplo.com");
  assert.equal(val("#s"), "");
  assert.equal(val("#z"), "");
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

test("reconoce campos nombrados con guion bajo, como en un ATS", async () => {
  // Medido en BKX Holdings: las etiquetas eran "First" y "Last" y los campos
  // se llamaban first_name y last_name. El patrón buscaba "first name" con
  // espacio, así que no coincidía con ninguno y quedaban los dos en ámbar.
  const w = montar(`<form>
    <label for="a">First</label><input id="a" name="first_name">
    <label for="b">Last</label><input id="b" name="last_name">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#a"), "Ana");
  assert.equal(val("#b"), "Torres Gil");
});

test("reconoce campos nombrados en camelCase", async () => {
  const w = montar(`<form>
    <input name="firstName" aria-label="firstName">
    <input name="postalCode" aria-label="postalCode">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("[name=firstName]"), "Ana");
  assert.equal(val("[name=postalCode]"), "2101");
});

test("los identificadores generados no provocan coincidencias por azar", async () => {
  // "hxzorhfmlrbkt36hszhf" es un id de framework: no describe nada, y una
  // cadena larga al azar acaba conteniendo "zip" o "dob" tarde o temprano.
  const w = montar(`<form>
    <input id="hxzodobrhfmlrbkt36hszhf">
    <input id="qwzipfmlrbkt36hszhfxc">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#hxzodobrhfmlrbkt36hszhf"), "", "un id generado no es una fecha de nacimiento");
  assert.equal(val("#qwzipfmlrbkt36hszhfxc"), "", "un id generado no es un código postal");
});

test("un id legible sí se usa para reconocer el campo", async () => {
  const w = montar(`<form><input id="postal_code"></form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#postal_code"), "2101");
});

test("los patrones cuentan con los separadores ya normalizados", async () => {
  // Separar camelCase convierte "LinkedIn" en "Linked In" y "E-mail" en
  // "E mail". Los patrones tienen que seguir reconociéndolos: al añadir la
  // normalización se rompieron estos tres sin que nadie lo notara hasta que
  // falló una prueba de LinkedIn.
  const w = montar(`<form>
    <label for="l">LinkedIn</label><input id="l">
    <label for="e">E-mail</label><input id="e">
    <label for="c">C.P.</label><input id="c">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#l"), "https://linkedin.com/in/x");
  assert.equal(val("#e"), "correo@ejemplo.com");
  assert.equal(val("#c"), "2101");
});
