import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

/**
 * Pruebas del script que se inyecta en el portal. Corre en un DOM simulado,
 * así que se puede comprobar sin abrir un navegador lo que de verdad importa:
 * que no toque contraseñas, que no marque casillas y que no meta un dato en
 * un sitio donde no va.
 *
 * El fichero es JavaScript suelto para la extensión, sin exports, así que se
 * evalúa dentro de la ventana simulada.
 */
const FUENTE = readFileSync(new URL("../extension/rellenar.js", import.meta.url), "utf8");

const FICHA = {
  nombre: "Ana Torres Gil",
  nombrePila: "Ana",
  apellidos: "Torres Gil",
  email: "ana@ejemplo.com",
  telefono: "+34 600 000 000",
  ciudad: "Valencia",
  pais: "España",
  titular: "Analista de datos",
  resumen: "Analista con cuatro años.",
  linkedin: "https://linkedin.com/in/ana",
  web: "https://ana.example",
  salario: "38.000 EUR",
  disponibilidad: "Inmediata",
};

let dom: JSDOM;

function montar(html: string) {
  dom = new JSDOM(`<!doctype html><body>${html}</body>`, {
    // Sin esto window.eval no existe y el script de la extensión no se carga.
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window as unknown as Record<string, unknown> & {
    eval: (s: string) => void;
  };
  // jsdom no calcula diseño: todo mediría 0x0 y el filtro de campos invisibles
  // los descartaría todos. Se les da un tamaño para que la prueba mida la
  // lógica de relleno, no la maquetación.
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return { width: 120, height: 24, top: 0, left: 0, right: 120, bottom: 24, x: 0, y: 0, toJSON: () => ({}) };
  } as never;
  w.eval(FUENTE);
  return w;
}

const val = (sel: string) =>
  (dom.window.document.querySelector(sel) as HTMLInputElement | null)?.value ?? null;

before(() => {
  // Falla pronto y con un mensaje claro si falta la dependencia de pruebas.
  assert.ok(FUENTE.includes("rellenarFormulario"), "no se encontró el script de la extensión");
});

test("rellena los datos que están en la ficha", async () => {
  const w = montar(`<form>
    <label for="n">Nombre completo</label><input id="n">
    <label for="e">Correo electrónico</label><input id="e">
    <label for="t">Teléfono</label><input id="t">
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<{ escritos: number }> }).rellenarFormulario(FICHA);
  assert.equal(val("#n"), "Ana Torres Gil");
  assert.equal(val("#e"), "ana@ejemplo.com");
  assert.equal(val("#t"), "+34 600 000 000");
});

test("NUNCA toca contraseñas ni documentos de identidad", async () => {
  const w = montar(`<form>
    <label for="p">Contraseña</label><input id="p" type="password">
    <label for="d">Número de DNI</label><input id="d">
    <label for="c">Número de tarjeta</label><input id="c">
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#p"), "");
  assert.equal(val("#d"), "");
  assert.equal(val("#c"), "");
});

test("NUNCA marca casillas ni botones de opción", async () => {
  const w = montar(`<form>
    <label><input type="checkbox" id="ck"> Acepto los términos</label>
    <label><input type="radio" id="rd" name="g"> Sí, quiero correos</label>
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  const ck = dom.window.document.querySelector("#ck") as HTMLInputElement;
  const rd = dom.window.document.querySelector("#rd") as HTMLInputElement;
  assert.equal(ck.checked, false);
  assert.equal(rd.checked, false);
});

test("no sobrescribe lo que ya está escrito", async () => {
  const w = montar(`<form><label for="n">Nombre completo</label><input id="n" value="No me pises"></form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#n"), "No me pises");
});

test("no confunde el nombre de la empresa con el del candidato", async () => {
  const w = montar(`<form><label for="x">Nombre de la empresa donde trabajas</label><input id="x"></form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#x"), "");
});

test("no rellena el campo trampa de ancho cero", async () => {
  const w = montar(`<form><label for="h">Correo</label><input id="h" style="width:0;height:0"></form>`);
  // Este campo concreto sí debe medir 0: se anula el parche de tamaño.
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) };
  } as never;
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#h"), "");
});

test("encuentra la etiqueta aunque sea un hermano previo con formato", async () => {
  const w = montar(`<form>
    <div><p>Please share your <b>LinkedIn</b> Profile URL.</p><input name="q"></div>
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("[name=q]"), "https://linkedin.com/in/ana");
});

test("NO mete el correo en una pregunta sobre experiencia que mencione email", async () => {
  const w = montar(`<form>
    <div><p>What hands-on experience do you have with GoHighLevel (CRM setup, workflows, email automation), and what results did you achieve?</p><textarea name="q"></textarea></div>
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("[name=q]"), "", "una pregunta abierta no se contesta con un dato de ficha");
});

test("un desplegable con opción vacía se rellena", async () => {
  const w = montar(`<form>
    <label for="p">País</label>
    <select id="p"><option value="">-- Elige --</option><option value="es">España</option><option value="ve">Venezuela</option></select>
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#p"), "es");
});

test("un desplegable sin opción vacía corrige su valor por defecto", async () => {
  const w = montar(`<form>
    <label for="p">País de residencia</label>
    <select id="p"><option value="ar">Argentina</option><option value="es">España</option></select>
  </form>`);
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#p"), "es", "enviar Argentina a alguien de España es peor que no tocarlo");
});

test("un desplegable que el usuario ya eligió no se toca", async () => {
  const w = montar(`<form>
    <label for="p">País</label>
    <select id="p"><option value="ar">Argentina</option><option value="mx">México</option></select>
  </form>`);
  (dom.window.document.querySelector("#p") as HTMLSelectElement).selectedIndex = 1;
  await (w as never as { rellenarFormulario: (f: unknown) => Promise<unknown> }).rellenarFormulario(FICHA);
  assert.equal(val("#p"), "mx");
});

test("recoge las preguntas abiertas y descarta los campos de datos", async () => {
  const w = montar(`<form>
    <label for="n">Nombre</label><input id="n" value="Ana">
    <div><p>What hands-on experience do you have with GoHighLevel?</p><textarea name="a"></textarea></div>
    <div><p>The salary range is $1200-$1300. Are you comfortable with that range?</p><input name="b"></div>
    <label for="t">Teléfono</label><input id="t">
  </form>`);
  const r = (
    w as never as { recogerPreguntas: () => { preguntas: { texto: string }[] } }
  ).recogerPreguntas();
  assert.equal(r.preguntas.length, 2, "solo las dos preguntas, no los campos de datos");
  assert.match(r.preguntas[0].texto, /GoHighLevel/);
});

test("quita el prefijo 'Candidatura para' del título de la página", async () => {
  const w = montar(`<h1>Candidatura para GoHighLevel Marketing Operations Specialist</h1>
    <form><div><p>¿Qué experiencia tienes con esto y qué resultados lograste?</p><textarea name="a"></textarea></div></form>`);
  const r = (w as never as { recogerPreguntas: () => { titulo: string } }).recogerPreguntas();
  assert.equal(r.titulo, "GoHighLevel Marketing Operations Specialist");
});
