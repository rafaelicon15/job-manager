import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

/**
 * El bloque de datos personales de un formulario real, con los casos que
 * salieron mal y la forma en que debían quedar.
 *
 * Los tres fallos que cubren estas pruebas tienen la misma raíz: rellenar un
 * campo con un dato PARECIDO en lugar de dejarlo vacío. El correo secundario
 * con el principal, el teléfono fijo con el móvil, y el nombre de pila con el
 * nombre más la inicial del segundo.
 */
const FUENTE = readFileSync(new URL("../extension/rellenar.js", import.meta.url), "utf8");

const FICHA = {
  nombre: "Ana Beatriz Torres Gil",
  nombrePila: "Ana",
  segundoNombre: "Beatriz",
  apellidos: "Torres Gil",
  email: "correo@ejemplo.com",
  telefono: "+58 000 0000000",
  calle: "Av. Bolívar 123, Edificio Central",
  ciudad: "Villa de Cura",
  provincia: "Aragua",
  pais: "Venezuela",
  codigoPostal: "2126",
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
  return w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> };
}

const val = (sel: string) =>
  (dom.window.document.querySelector(sel) as HTMLInputElement | null)?.value ?? null;

test("el nombre se parte en tres como lo pide el formulario", async () => {
  const w = montar(`<form>
    <label for="f">First</label><input id="f">
    <label for="m">Middle</label><input id="m">
    <label for="l">Last</label><input id="l">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#f"), "Ana", "el nombre de pila no lleva la inicial del segundo");
  assert.equal(val("#m"), "Beatriz");
  assert.equal(val("#l"), "Torres Gil");
});

test("sin segundo nombre en el perfil, ese campo queda vacío", async () => {
  // De una inicial como "A." no se puede sacar "Andrés", y de un apellido
  // tampoco: es preferible dejarlo que inventarlo.
  const w = montar(`<form>
    <label for="m">Middle name</label><input id="m">
  </form>`);
  await w.rellenarFormulario({ ...FICHA, segundoNombre: "" });
  assert.equal(val("#m"), "");
});

test("el correo secundario NO se rellena con el principal", async () => {
  const w = montar(`<form>
    <label for="p">Personal Email</label><input id="p">
    <label for="s">Secondary Email</label><input id="s">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#p"), "correo@ejemplo.com");
  assert.equal(val("#s"), "", "repetir el mismo correo no aporta nada y puede rechazarse");
});

test("reconoce las demás formas de pedir un correo alternativo", async () => {
  const w = montar(`<form>
    <label for="a">Correo secundario</label><input id="a">
    <label for="b">Email alternativo</label><input id="b">
    <label for="c">Alternate email</label><input id="c">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#a"), "");
  assert.equal(val("#b"), "");
  assert.equal(val("#c"), "");
});

test("el teléfono fijo NO se rellena con el móvil", async () => {
  const w = montar(`<form>
    <label for="h">Home Phone</label><input id="h">
    <label for="c">Cell Phone</label><input id="c">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#h"), "", "el fijo no es el móvil, y decir que lo es cuesta una llamada");
  assert.equal(val("#c"), "+58 000 0000000");
});

test("un campo de teléfono a secas sí se rellena", async () => {
  const w = montar(`<form><label for="t">Phone</label><input id="t"></form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#t"), "+58 000 0000000");
});

test("la calle sale de la dirección postal, no de la ciudad", async () => {
  const w = montar(`<form>
    <label for="s">Street</label><input id="s">
    <label for="c">City</label><input id="c">
    <label for="z">Postal Code</label><input id="z">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#s"), "Av. Bolívar 123, Edificio Central");
  assert.equal(val("#c"), "Villa de Cura");
  assert.equal(val("#z"), "2126");
});

test("sin dirección postal guardada, la calle queda vacía", async () => {
  const w = montar(`<form><label for="s">Street</label><input id="s"></form>`);
  await w.rellenarFormulario({ ...FICHA, calle: "" });
  assert.equal(val("#s"), "", "antes ponía la ciudad aquí");
});

test("la dirección de correo no se confunde con la dirección postal", async () => {
  const w = montar(`<form>
    <label for="a">Dirección de email</label><input id="a">
    <label for="b">Email address</label><input id="b">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#a"), "correo@ejemplo.com");
  assert.equal(val("#b"), "correo@ejemplo.com");
});
