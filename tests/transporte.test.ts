import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * El viaje de datos entre la extensión y la app. Va por el fragmento de la
 * URL, que nunca llega al servidor, y ese fragmento se codifica en base64-URL
 * con bytes UTF-8. Si la codificación y la descodificación se desincronizan, la
 * app abre una pantalla en blanco sin decir por qué: por eso se prueban juntas.
 *
 * Las dos funciones se copian aquí a propósito, tal cual están en
 * `extension/popup.js` y en `app/capture` y `app/responder`. Son código que
 * vive en dos mundos que no comparten módulos.
 */
function aBase64Url(objeto: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodificar<T>(hash: string): T | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

const ida = <T>(o: T) => decodificar<T>("#" + aBase64Url(o));

test("las preguntas reales de un formulario llegan intactas", () => {
  const carga = {
    preguntas: [
      {
        texto:
          "What hands-on experience do you have with GoHighLevel (CRM setup, workflows, email automation, pipeline management), and what specific results did you achieve using it?",
        largo: true,
      },
      {
        texto: "The salary range for this role is $1200-$1300 USD per month. Are you comfortable with that range?",
        largo: false,
      },
    ],
    titulo: "GoHighLevel Marketing Operations Specialist",
    empresa: "Pavago",
    url: "https://www.adzuna.com.mx/aplicar/5236019813?utm_source=email",
  };
  assert.deepEqual(ida(carga), carga);
});

test("sobreviven acentos, eñes y signos de apertura", () => {
  const c = { titulo: "Diseño de campañas ¿Cuál es tu disponibilidad? — прив" };
  assert.deepEqual(ida(c), c);
});

test("sobreviven los emojis, que ocupan cuatro bytes", () => {
  const c = { texto: "Crecimiento 📈 y automatización 🤖" };
  assert.deepEqual(ida(c), c);
});

test("el base64-URL no contiene caracteres que rompan una URL", () => {
  const hash = aBase64Url({ texto: "a".repeat(500) + "?&#=/+" });
  assert.doesNotMatch(hash, /[+/=?&#]/, "esos caracteres romperían el fragmento");
});

test("un hash corrupto devuelve null en lugar de lanzar", () => {
  assert.equal(decodificar("#esto-no-es-base64-valido!!"), null);
  assert.equal(decodificar("#"), null);
});

test("una carga vacía sigue siendo válida", () => {
  assert.deepEqual(ida({ preguntas: [] }), { preguntas: [] });
});

test("una oferta larga cabe en el fragmento", () => {
  const c = { texto: "x".repeat(60000) };
  const hash = aBase64Url(c);
  assert.ok(hash.length < 200000, "el fragmento no tiene el límite de la ruta");
  assert.deepEqual(decodificar("#" + hash), c);
});
