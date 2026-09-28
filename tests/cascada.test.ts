import { test } from "node:test";
import assert from "node:assert/strict";
import { CASCADA, clasificar, colaDeModelos, MODELO_RESPALDO } from "../lib/gemini";

/**
 * La cascada de modelos.
 *
 * Esto nace de un fallo visto en pantalla: con el modelo por defecto, que es el
 * mismo que era el único respaldo, la cola se quedaba con UN modelo. La app
 * reintentaba cinco veces contra el mismo sitio saturado, se rendía, y el
 * mensaje le pedía al usuario que cambiara de modelo a mano. Justo lo que la
 * app tenía que haber hecho sola.
 */

test("el modelo por defecto ya no se queda solo en la cola", () => {
  // Esta es la prueba del fallo original. Antes devolvía un único modelo.
  const cola = colaDeModelos(MODELO_RESPALDO);
  assert.ok(cola.length > 1, `la cola se quedó en ${cola.length} modelo`);
  assert.equal(cola[0], MODELO_RESPALDO, "se respeta lo que eligió el usuario");
});

test("el modelo elegido va primero y no se repite detrás", () => {
  const cola = colaDeModelos("gemini-flash-latest");
  assert.equal(cola[0], "gemini-flash-latest");
  assert.equal(
    cola.filter((m) => m === "gemini-flash-latest").length,
    1,
    "repetirlo gastaría un escalón de la cascada en el modelo que ya falló"
  );
});

test("la cola cubre todos los modelos conocidos", () => {
  const cola = colaDeModelos(MODELO_RESPALDO);
  for (const m of CASCADA) assert.ok(cola.includes(m), `falta ${m}`);
  assert.equal(new Set(cola).size, cola.length, "sin duplicados");
});

test("un modelo desconocido guardado por una versión vieja sigue valiendo", () => {
  // Si ya no existe, la cascada lo descubre con un 404 y baja al siguiente.
  const cola = colaDeModelos("gemini-de-hace-un-anio");
  assert.equal(cola[0], "gemini-de-hace-un-anio");
  assert.equal(cola.length, CASCADA.length + 1);
});

test("sin modelo guardado se arranca por el más fiable", () => {
  assert.equal(colaDeModelos("")[0], MODELO_RESPALDO);
  assert.equal(colaDeModelos("   ")[0], MODELO_RESPALDO);
});

// ------------------------------------------------------- clasificación

const como = (mensaje: string) => clasificar(new Error(mensaje));

test("la saturación se reconoce por código y por prosa", () => {
  assert.equal(como("HTTP 503 UNAVAILABLE"), "saturado");
  assert.equal(como("The model is overloaded. Please try again later."), "saturado");
  // Visto en producción: Google la devuelve sin código ninguno.
  assert.equal(como("We are experiencing a spike in demand"), "saturado");
});

test("la cuota diaria se distingue del límite por minuto", () => {
  // Importa porque una se recupera en segundos y la otra hasta mañana.
  assert.equal(
    como("429 RESOURCE_EXHAUSTED: quota exceeded for GenerateRequestsPerDay"),
    "cuotaDiaria"
  );
  assert.equal(como("429 RESOURCE_EXHAUSTED: rate limit"), "limitePorMinuto");
});

test("un modelo inexistente no es un error fatal, es un escalón que se salta", () => {
  assert.equal(
    como("404 models/gemini-x is not found for API version v1beta"),
    "modeloNoDisponible"
  );
  assert.equal(
    como("model is not supported for generateContent"),
    "modeloNoDisponible"
  );
});

test("una clave inválida sí es fatal: cambiar de modelo no la arregla", () => {
  assert.equal(como("API key not valid. Please pass a valid API key."), "fatal");
});

test("la restricción geográfica es fatal, no se reintenta a ciegas", () => {
  // Reintentar cuatro veces por modelo contra un bloqueo de país es un minuto
  // tirado para acabar en el mismo sitio.
  assert.equal(como("FAILED_PRECONDITION: User location is not supported"), "fatal");
});

test("un JSON malformado cuenta como saturación y se reintenta", () => {
  // Un modelo sobrecargado corta la respuesta a mitad, y el síntoma que llega
  // es un JSON roto, no un 503.
  assert.equal(clasificar(new SyntaxError("Unexpected end of JSON input")), "saturado");
});
