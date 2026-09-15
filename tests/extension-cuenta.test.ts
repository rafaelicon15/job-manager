import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

/**
 * El registro de una cuenta nueva: usuario, confirmación y país.
 *
 * Los tres fallos que cubren estas pruebas salieron del mismo formulario real.
 * "Email o usuario" se rellenaba con el correo en lugar del usuario; el campo
 * de confirmar, que tiene que coincidir con el de arriba, se rellenaba con el
 * dato del perfil y quedaban dos valores distintos; y el país se quedaba en
 * "United States" porque el desplegable no traía ninguna etiqueta que las
 * reglas pudieran reconocer.
 */
const FUENTE = readFileSync(new URL("../extension/rellenar.js", import.meta.url), "utf8");

const FICHA = {
  nombre: "Ana Beatriz Torres Gil",
  nombrePila: "Ana",
  segundoNombre: "Beatriz",
  apellidos: "Torres Gil",
  email: "correo@ejemplo.com",
  usuario: "anatorres",
  telefono: "+58 000 0000000",
  calle: "Av. Bolívar 123",
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

/** Una lista de países de verdad, con los centinelas que la delatan. */
const PAISES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina",
  "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Botswana", "Brazil", "Bulgaria", "Cambodia", "Cameroon",
  "Canada", "Chad", "Chile", "China", "Colombia", "Croatia", "Cuba",
  "Cyprus", "Denmark", "Ecuador", "Egypt", "Estonia", "Ethiopia",
  "Finland", "France", "Georgia", "Germany", "Ghana", "Greece",
  "Guatemala", "Haiti", "Honduras", "Hungary", "Iceland", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica",
  "Japan", "Jordan", "Kenya", "Kuwait", "Latvia", "Lebanon", "Libya",
  "Lithuania", "Luxembourg", "Malaysia", "Mexico", "Morocco", "Nepal",
  "Netherlands", "New Zealand", "Nicaragua", "Nigeria", "Norway", "Oman",
  "Pakistan", "Panama", "Paraguay", "Peru", "Philippines", "Poland",
  "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Senegal",
  "Serbia", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa",
  "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria",
  "Thailand", "Tunisia", "Turkey", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

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

const opciones = (nombres: string[]) =>
  nombres.map((n) => `<option value="${n}">${n}</option>`).join("");

test("'Email o usuario' se rellena con el usuario, no con el correo", async () => {
  const w = montar(`<form>
    <label for="u">Email or username</label><input id="u">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#u"), "anatorres");
});

test("un campo de correo a secas sigue llevando el correo", async () => {
  const w = montar(`<form>
    <label for="e">Email address</label><input id="e">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#e"), "correo@ejemplo.com");
});

test("el campo de confirmar copia lo que quedó arriba", async () => {
  const w = montar(`<form>
    <label for="u">Email or username</label><input id="u">
    <label for="r">Re-enter email or username</label><input id="r">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#u"), "anatorres");
  assert.equal(val("#r"), "anatorres", "el par tiene que coincidir o el portal lo rechaza");
});

test("si el campo de arriba lo escribiste tú, la confirmación copia eso", async () => {
  // El caso que rompía antes: el primer campo ya tenía valor, el código lo
  // saltaba sin identificarlo y la confirmación se quedaba sin nada que copiar.
  const w = montar(`<form>
    <label for="u">Email or username</label><input id="u" value="otrousuario">
    <label for="r">Re-enter email or username</label><input id="r">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#u"), "otrousuario", "lo que escribe el usuario no se pisa");
  assert.equal(val("#r"), "otrousuario");
});

test("confirmar el correo copia el correo", async () => {
  const w = montar(`<form>
    <label for="e">Email</label><input id="e">
    <label for="c">Confirm email</label><input id="c">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#c"), "correo@ejemplo.com");
});

test("el país se elige aunque el desplegable no tenga etiqueta", async () => {
  // Sin label, sin name legible y preseleccionado en otro país. La lista se
  // reconoce por sus opciones.
  const w = montar(`<form>
    <select id="p">${opciones(PAISES)}</select>
  </form>`);
  const sel = dom.window.document.querySelector("#p") as HTMLSelectElement;
  sel.value = "United States";
  await w.rellenarFormulario(FICHA);
  assert.equal(sel.value, "Venezuela");
});

test("un desplegable corto sin etiqueta no se toca", async () => {
  // Tres opciones no son una lista de países: podría ser cualquier cosa.
  const w = montar(`<form>
    <select id="x">${opciones(["Spain", "France", "Germany"])}</select>
  </form>`);
  const sel = dom.window.document.querySelector("#x") as HTMLSelectElement;
  sel.value = "France";
  await w.rellenarFormulario(FICHA);
  assert.equal(sel.value, "France");
});

test("una lista larga que no es de países tampoco se toca", async () => {
  const meses = Array.from({ length: 60 }, (_, i) => `Opción ${i + 1}`);
  const w = montar(`<form>
    <select id="x">${opciones(meses)}</select>
  </form>`);
  const sel = dom.window.document.querySelector("#x") as HTMLSelectElement;
  sel.value = "Opción 7";
  await w.rellenarFormulario(FICHA);
  assert.equal(sel.value, "Opción 7");
});

test("el país con etiqueta sigue funcionando", async () => {
  const w = montar(`<form>
    <label for="p">Country</label>
    <select id="p">${opciones(PAISES)}</select>
  </form>`);
  const sel = dom.window.document.querySelector("#p") as HTMLSelectElement;
  sel.value = "Pakistan";
  await w.rellenarFormulario(FICHA);
  assert.equal(sel.value, "Venezuela");
});

test("la contraseña sigue sin tocarse aunque pida confirmarla", async () => {
  const w = montar(`<form>
    <label for="p">Password</label><input id="p" type="password">
    <label for="c">Confirm password</label><input id="c" type="password">
  </form>`);
  await w.rellenarFormulario(FICHA);
  assert.equal(val("#p"), "");
  assert.equal(val("#c"), "");
});
