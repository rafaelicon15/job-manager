import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

/**
 * Desplegables que no son un <select>: un div con role="combobox" que abre una
 * lista al pulsarlo. Los usan casi todos los portales modernos, y el código que
 * maneja los nativos ni los ve.
 *
 * La regla es la misma que en el resto: solo se elige una opción con
 * coincidencia EXACTA. Si hay dudas, se marca en ámbar diciendo qué elegir.
 */
const FUENTE = readFileSync(new URL("../extension/rellenar.js", import.meta.url), "utf8");

const FICHA = {
  nombre: "Ana Torres Gil",
  nombrePila: "Ana",
  apellidos: "Torres Gil",
  email: "correo@ejemplo.com",
  telefono: "+00 000 0000000",
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

/**
 * Monta un combobox como los de verdad: al pulsar el disparador se pinta la
 * lista, y al pulsar una opción se cierra y se escribe el texto elegido.
 */
function montarCombo(etiqueta: string, opciones: string[], actual = "Selecciona…") {
  dom = new JSDOM(
    `<!doctype html><body><form>
      <span id="lbl">${etiqueta}</span>
      <div id="combo" role="combobox" aria-labelledby="lbl">${actual}</div>
      <div id="lista" style="display:none"></div>
    </form></body>`,
    { runScripts: "outside-only", pretendToBeVisual: true }
  );
  const d = dom.window.document;
  dom.window.Element.prototype.getBoundingClientRect = function () {
    const oculto = (this as HTMLElement).dataset?.oculto === "si";
    const n = oculto ? 0 : 120;
    return { width: n, height: n ? 24 : 0, top: 0, left: 0, right: n, bottom: 24, x: 0, y: 0, toJSON: () => ({}) };
  } as never;

  const combo = d.getElementById("combo")!;
  const lista = d.getElementById("lista")!;
  let abierta = false;

  combo.addEventListener("click", () => {
    abierta = !abierta;
    lista.innerHTML = abierta
      ? opciones
          .map((o) => `<div role="option">${o}</div>`)
          .join("")
      : "";
    for (const op of lista.querySelectorAll('[role="option"]'))
      op.addEventListener("click", () => {
        combo.textContent = op.textContent;
        lista.innerHTML = "";
        abierta = false;
      });
  });

  const w = dom.window as unknown as { eval: (s: string) => void };
  w.eval(FUENTE);
  return w as never as {
    rellenarFormulario: (f: unknown) => Promise<{ escritos: number; pendientes: number }>;
  };
}

const combo = () => dom.window.document.getElementById("combo")!;
const textoCombo = () => (combo().textContent || "").trim();
const notaCombo = () => (combo() as HTMLElement).title;

test("elige la opción cuando el texto coincide exactamente", async () => {
  const w = montarCombo("País", ["Argentina", "Venezuela", "México"]);
  await w.rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Venezuela");
  assert.match(notaCombo(), /Compruébalo/i, "una elección automática tiene que avisarse");
});

test("corrige un país preseleccionado por el portal", async () => {
  const w = montarCombo("Country", ["Pakistan", "Venezuela"], "Pakistan");
  await w.rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Venezuela");
});

test("no elige nada si ninguna opción coincide exactamente", async () => {
  const w = montarCombo("País", ["Venezuela (Bolivariana)", "Colombia"]);
  const r = await w.rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Selecciona…", "elegir la que más se parece es justo lo que no debe hacer");
  assert.match(notaCombo(), /Elige "Venezuela"/, "pero sí dice cuál elegir");
  assert.ok(r.pendientes > 0);
});

test("si ya estaba en el valor correcto no lo toca", async () => {
  const w = montarCombo("País", ["Venezuela", "Colombia"], "Venezuela");
  await w.rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Venezuela");
  assert.match(notaCombo(), /Ya estaba/i);
});

test("no toca un desplegable cuyo dato no está en el perfil", async () => {
  const w = montarCombo("Selecciona tu industria", ["Marketing", "Finanzas"]);
  await w.rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Selecciona…", "no hay industria en el perfil que copiar");
});

test("no toca un desplegable que sea una pregunta abierta", async () => {
  const w = montarCombo(
    "¿Qué experiencia tienes en el país donde resides?",
    ["Venezuela", "Colombia"]
  );
  await w.rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Selecciona…");
});

test("un componente que no abre nada se marca, no se rompe", async () => {
  dom = new JSDOM(
    `<!doctype html><body><form>
      <span id="lbl">País</span>
      <div id="combo" role="combobox" aria-labelledby="lbl">Selecciona…</div>
    </form></body>`,
    { runScripts: "outside-only", pretendToBeVisual: true }
  );
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return { width: 120, height: 24, top: 0, left: 0, right: 120, bottom: 24, x: 0, y: 0, toJSON: () => ({}) };
  } as never;
  const w = dom.window as unknown as { eval: (s: string) => void };
  w.eval(FUENTE);
  const r = await (
    w as never as { rellenarFormulario: (f: unknown) => Promise<{ pendientes: number }> }
  ).rellenarFormulario(FICHA);
  assert.equal(textoCombo(), "Selecciona…");
  assert.match(notaCombo(), /Elige "Venezuela"/);
  assert.ok(r.pendientes > 0);
});
