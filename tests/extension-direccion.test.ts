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

/**
 * Ejecuta el `leerFicha` DE VERDAD, sacándolo de popup.js.
 *
 * Antes esto se comprobaba buscando nombres de variable en el fichero, que es
 * una prueba que se rompe al renombrar algo y no comprueba nada. El popup no se
 * puede cargar entero fuera del navegador porque toca `document` y `chrome` en
 * cuanto arranca, así que se extrae solo esta función.
 */
function leerFichaDelPopup(perfil: Record<string, unknown>) {
  const popup = readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8");
  const i = popup.indexOf("function leerFicha()");
  assert.ok(i !== -1, "no se encontró leerFicha en popup.js");
  const fin = popup.indexOf("\n}", i);
  const fuente = popup.slice(i, fin + 2);

  // jsdom solo da localStorage a una página con origen: sin `url` lanza un
  // error de seguridad, igual que un navegador en about:blank.
  const ventana = new JSDOM("", {
    url: "https://ejemplo.test/",
    runScripts: "outside-only",
  }).window as unknown as {
    eval: (s: string) => unknown;
    localStorage: Storage;
  };
  ventana.localStorage.setItem("rjm:estado:v1", JSON.stringify({ perfil }));
  ventana.eval(fuente);
  return (ventana as unknown as { leerFicha: () => { ficha?: Record<string, string> } })
    .leerFicha().ficha;
}

test("el país es el último tramo de la ubicación, no todo lo que sigue a la ciudad", () => {
  // Esta era la causa de que el desplegable de país no encontrara ninguna
  // opción: buscaba una que dijera "Aragua, Venezuela".
  const f = leerFichaDelPopup({ nombre: "Ana Torres", ubicacion: "Maracay, Aragua, Venezuela" });
  assert.equal(f?.ciudad, "Maracay");
  assert.equal(f?.provincia, "Aragua");
  assert.equal(f?.pais, "Venezuela");
});

test("con dos tramos no se inventa una provincia", () => {
  const f = leerFichaDelPopup({ nombre: "Ana Torres", ubicacion: "Valencia, España" });
  assert.equal(f?.ciudad, "Valencia");
  assert.equal(f?.provincia, "");
  assert.equal(f?.pais, "España");
});

test("con un solo tramo no se inventa un país", () => {
  const f = leerFichaDelPopup({ nombre: "Ana Torres", ubicacion: "Madrid" });
  assert.equal(f?.ciudad, "Madrid");
  assert.equal(f?.pais, "", "poner Madrid de país sería peor que dejarlo vacío");
});

test("sin ubicación no revienta", () => {
  const f = leerFichaDelPopup({ nombre: "Ana Torres" });
  assert.equal(f?.ciudad, "");
  assert.equal(f?.pais, "");
  assert.equal(f?.provincia, "");
});

test("el nombre se parte aparte de la ubicación", () => {
  // Las dos particiones convivían con la misma variable y eso rompió el
  // fichero entero. Se comprueba que siguen dando resultados distintos.
  const f = leerFichaDelPopup({
    nombre: "Ana María Torres Gil",
    ubicacion: "Maracay, Aragua, Venezuela",
  });
  assert.equal(f?.nombrePila, "Ana", "el nombre de pila es uno, no dos");
  assert.equal(f?.segundoNombre, "María");
  assert.equal(f?.apellidos, "Torres Gil");
  assert.equal(f?.ciudad, "Maracay");
});

test("una inicial no entra nunca en el nombre de pila", () => {
  // Con "Ana B. Torres" el formulario acabaría creando la cuenta a nombre de
  // "Ana B.", y de la inicial no hay forma de sacar el nombre de detrás: se
  // queda fuera de los dos campos.
  const f = leerFichaDelPopup({ nombre: "Ana B. Torres" });
  assert.equal(f?.nombrePila, "Ana");
  assert.equal(f?.segundoNombre, "");
  assert.equal(f?.apellidos, "Torres");
});

test("con dos tramos, el segundo son los apellidos", () => {
  const f = leerFichaDelPopup({ nombre: "Ana Torres" });
  assert.equal(f?.nombrePila, "Ana");
  assert.equal(f?.apellidos, "Torres");
  assert.equal(f?.segundoNombre, "");
});

test("con tres tramos sin inicial, los dos últimos son apellidos", () => {
  const f = leerFichaDelPopup({ nombre: "Ana Torres Gil" });
  assert.equal(f?.nombrePila, "Ana");
  assert.equal(f?.apellidos, "Torres Gil");
});

test("lo que pongas en el perfil manda sobre la partición automática", () => {
  const f = leerFichaDelPopup({
    nombre: "Ana B. Torres",
    nombrePila: "Anabel",
    segundoNombre: "Beatriz",
    apellidos: "Torres Gil",
  });
  assert.equal(f?.nombrePila, "Anabel");
  assert.equal(f?.segundoNombre, "Beatriz");
  assert.equal(f?.apellidos, "Torres Gil");
});

test("el usuario viaja en la ficha y no se saca del correo", () => {
  const f = leerFichaDelPopup({
    nombre: "Ana Torres",
    email: "ana.torres@ejemplo.com",
    usuario: "anatorres",
  });
  assert.equal(f?.usuario, "anatorres");

  const sin = leerFichaDelPopup({ nombre: "Ana Torres", email: "ana.torres@ejemplo.com" });
  assert.equal(sin?.usuario, "", "inventarlo crearía una cuenta con un usuario que no es el tuyo");
});
