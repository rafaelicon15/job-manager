import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

/**
 * El bloque de dirección de un formulario, que es donde más daño hace
 * equivocarse: un dato en el campo que no toca se envía sin que nadie lo mire.
 *
 * Todos los casos salen de un formulario real en el que el país decía "United
 * States", la calle decía "Maracay" y el estado quedaba vacío y obligatorio.
 */
const FUENTE = readFileSync(new URL("../extension/rellenar.js", import.meta.url), "utf8");

const FICHA = {
  nombre: "Ana Torres Gil",
  nombrePila: "Ana",
  apellidos: "Torres Gil",
  email: "correo@ejemplo.com",
  telefono: "+58 000 0000000",
  ciudad: "Maracay",
  provincia: "Aragua",
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
  return w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> };
}

const val = (sel: string) =>
  (dom.window.document.querySelector(sel) as HTMLInputElement | null)?.value ?? null;

test("la calle NO se rellena con la ciudad", async () => {
  // Habia una regla que mapeaba "dirección"/"address" a la ciudad. El campo
  // "Street" acababa diciendo "Maracay", y eso se envía sin que nadie lo mire.
  const w = montar(`<form>
    <label for="s">Street</label><input id="s">
    <label for="d">Dirección</label><input id="d">
    <label for="a">Address line 1</label><input id="a">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#s"), "", "la calle no es la ciudad");
  assert.equal(val("#d"), "", "la dirección no es la ciudad");
  assert.equal(val("#a"), "", "la línea de dirección no es la ciudad");
});

test("un campo dentro de un diálogo titulado Address tampoco hereda la ciudad", async () => {
  const w = montar(`<div role="dialog"><h2>Address</h2>
    <form><div><label for="s">Street</label><input id="s"></div></form>
  </div>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#s"), "");
});

test("la ciudad, el estado y el país van cada uno a lo suyo", async () => {
  const w = montar(`<form>
    <label for="c">City</label><input id="c">
    <label for="e">State</label><input id="e">
    <label for="p">Country</label><input id="p">
    <label for="z">Zip</label><input id="z">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#c"), "Maracay");
  assert.equal(val("#e"), "Aragua");
  assert.equal(val("#p"), "Venezuela");
  assert.equal(val("#z"), "2101");
});

test("acepta los nombres en español de la división territorial", async () => {
  const w = montar(`<form>
    <label for="a">Provincia</label><input id="a">
    <label for="b">Estado</label><input id="b">
    <label for="c">Departamento</label><input id="c">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#a"), "Aragua");
  assert.equal(val("#b"), "Aragua");
  assert.equal(val("#c"), "Aragua");
});

test("no confunde el estado civil con el estado territorial", async () => {
  const w = montar(`<form>
    <label for="a">Estado civil</label><input id="a">
    <label for="b">Marital status</label><input id="b">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#a"), "", "el estado civil no es Aragua");
  assert.equal(val("#b"), "");
});

test("sin provincia en el perfil, el campo queda vacío", async () => {
  const w = montar(`<form><label for="e">State</label><input id="e"></form>`);
  await w.rellenarFormulario({ ...FICHA, provincia: "" });
  assert.equal(val("#e"), "");
});

test("el país es el último tramo de la ubicación, no todo lo que sigue a la ciudad", () => {
  // Esta es la partición que hace el popup al leer el perfil. Se comprueba
  // aquí porque es la causa de que el desplegable de país no encontrara
  // ninguna opción: buscaba "Aragua, Venezuela".
  const partir = (ubicacion: string) => {
    const partes = ubicacion.split(",").map((x) => x.trim()).filter(Boolean);
    return {
      ciudad: partes[0] ?? "",
      pais: partes.length > 1 ? partes[partes.length - 1] : "",
      provincia: partes.length > 2 ? partes.slice(1, -1).join(", ") : "",
    };
  };

  assert.deepEqual(partir("Maracay, Aragua, Venezuela"), {
    ciudad: "Maracay",
    provincia: "Aragua",
    pais: "Venezuela",
  });
  assert.deepEqual(partir("Valencia, España"), {
    ciudad: "Valencia",
    provincia: "",
    pais: "España",
  });
  assert.deepEqual(partir("Madrid"), { ciudad: "Madrid", provincia: "", pais: "" });
  assert.deepEqual(partir(""), { ciudad: "", provincia: "", pais: "" });
});

test("el popup parte la ubicación igual que esta prueba", () => {
  // Si el popup cambia esa partición y la prueba no se entera, el fallo vuelve
  // en silencio. Se comprueba que el código sigue estando.
  const popup = readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8");
  assert.match(popup, /partes\[partes\.length - 1\]/, "el país tiene que ser el último tramo");
  assert.match(popup, /partes\.slice\(1, -1\)/, "la provincia es lo de en medio");
});
