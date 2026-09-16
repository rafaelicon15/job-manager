import { test } from "node:test";
import assert from "node:assert/strict";
import { diagnosticar, MUESTRA_MINIMA } from "../lib/embudo";
import type { EstadoVacante, Vacante } from "../lib/types";

/**
 * El diagnóstico del embudo.
 *
 * Lo que más importa aquí no es que los porcentajes salgan bien, es que el
 * diagnóstico CALLE cuando no hay muestra. Una conclusión sacada de cuatro
 * envíos suena igual de convincente que una sacada de cuarenta, y te hace
 * cambiar de estrategia por ruido.
 */

let n = 0;
function v(estado: EstadoVacante, extra: Partial<Vacante> = {}): Vacante {
  n += 1;
  return {
    id: `vac-${n}`,
    titulo: "Puesto",
    empresa: "Empresa",
    ubicacion: "Remoto",
    modalidad: "Remoto",
    fuente: "adzuna",
    descripcion: "x",
    estado,
    favorito: false,
    creadaEn: "2026-08-01T00:00:00.000Z",
    actualizadaEn: "2026-08-01T00:00:00.000Z",
    toques: [],
    documentos: [],
    reuniones: [],
    adjuntos: [],
    notas: [],
    ...extra,
  };
}

/** Una vacante con puntaje de encaje, que es lo que alimenta el corte útil. */
const conPuntaje = (estado: EstadoVacante, puntaje: number, extra: Partial<Vacante> = {}) =>
  v(estado, {
    ...extra,
    analisis: {
      puntaje,
      veredicto: "aplicar",
      razonVeredicto: "",
      anguloRecomendado: extra.analisis?.anguloRecomendado ?? "CRO",
      titularSugerido: "",
      requisitos: [],
      fortalezas: [],
      brechas: [],
      keywordsATS: [],
      banderasRojas: [],
      preguntasParaElReclutador: [],
      generadoEn: "2026-08-01T00:00:00.000Z",
      modelo: "x",
    },
  });

const repetir = <T>(cuantas: number, f: () => T): T[] =>
  Array.from({ length: cuantas }, f);

test("sin muestra no concluye nada y lo dice", () => {
  const d = diagnosticar(repetir(3, () => v("postulada")));
  assert.equal(d.veredictos.length, 0);
  assert.equal(d.avisos.length, 1);
  assert.match(d.avisos[0], new RegExp(`menos de ${MUESTRA_MINIMA}`));
});

test("una vacante guardada sin enviar no cuenta como envío", () => {
  const d = diagnosticar([v("descubierta"), v("analizada"), v("preparada")]);
  assert.equal(d.global.enviadas, 0);
  assert.equal(d.global.tasa, 0);
});

test("la tasa de respuesta cuenta screening, entrevista y oferta", () => {
  const d = diagnosticar([
    ...repetir(6, () => v("postulada")),
    v("screening"),
    v("entrevista"),
    v("oferta"),
    v("rechazada"),
  ]);
  assert.equal(d.global.enviadas, 10);
  assert.equal(d.global.respuestas, 3);
  assert.equal(d.global.entrevistas, 2);
  assert.equal(d.global.tasa, 30);
});

test("detecta que estás gastando los envíos en lo que no encaja", () => {
  const d = diagnosticar([
    ...repetir(14, () => conPuntaje("postulada", 40)),
    conPuntaje("screening", 40),
    ...repetir(2, () => conPuntaje("postulada", 85)),
    ...repetir(4, () => conPuntaje("entrevista", 85)),
  ]);
  assert.ok(
    d.veredictos.some((t) => /no es tu CV, es la selección/.test(t)),
    `veredictos: ${JSON.stringify(d.veredictos)}`
  );
});

test("detecta que el CV falla aunque el encaje sea bueno", () => {
  const d = diagnosticar([
    ...repetir(12, () => conPuntaje("postulada", 85)),
    conPuntaje("rechazada", 85),
  ]);
  assert.ok(
    d.veredictos.some((t) => /lo que falla está antes de la entrevista/.test(t)),
    `veredictos: ${JSON.stringify(d.veredictos)}`
  );
});

test("compara fuentes solo cuando las dos tienen muestra", () => {
  const d = diagnosticar([
    ...repetir(6, () => v("postulada", { fuente: "adzuna" })),
    ...repetir(3, () => v("postulada", { fuente: "referido" })),
    ...repetir(3, () => v("entrevista", { fuente: "referido" })),
  ]);
  assert.ok(
    d.veredictos.some((t) => /referido/.test(t) && /adzuna/.test(t)),
    `veredictos: ${JSON.stringify(d.veredictos)}`
  );
});

test("una fuente con dos envíos no genera veredicto", () => {
  const d = diagnosticar([
    ...repetir(10, () => v("postulada", { fuente: "adzuna" })),
    v("entrevista", { fuente: "referido" }),
    v("oferta", { fuente: "referido" }),
  ]);
  assert.ok(
    !d.veredictos.some((t) => /referido/.test(t)),
    "dos envíos al 100% no son una tendencia"
  );
});

test("avisa cuando el proceso se cae después de la primera respuesta", () => {
  const d = diagnosticar([
    ...repetir(10, () => v("postulada")),
    ...repetir(6, () => v("screening")),
    v("entrevista"),
  ]);
  assert.ok(
    d.veredictos.some((t) => /se cae en el screening/.test(t)),
    `veredictos: ${JSON.stringify(d.veredictos)}`
  );
});

test("avisa de los envíos que salieron sin analizar", () => {
  const d = diagnosticar([
    ...repetir(6, () => v("postulada")),
    ...repetir(4, () => conPuntaje("postulada", 80)),
  ]);
  assert.ok(d.avisos.some((t) => /sin analizar/.test(t)));
});

test("cuando ningún corte destaca, lo dice en vez de inventar una conclusión", () => {
  const d = diagnosticar([
    ...repetir(8, () => conPuntaje("postulada", 70)),
    ...repetir(2, () => conPuntaje("screening", 70)),
    ...repetir(2, () => conPuntaje("entrevista", 70)),
  ]);
  assert.equal(d.veredictos.length, 0);
  assert.ok(d.avisos.some((t) => /Ningún corte se separa/.test(t)));
});

test("los cortes salen ordenados por volumen", () => {
  const d = diagnosticar([
    ...repetir(3, () => v("postulada", { fuente: "jooble" })),
    ...repetir(9, () => v("postulada", { fuente: "adzuna" })),
  ]);
  assert.equal(d.porFuente[0].etiqueta, "adzuna");
  assert.equal(d.porFuente[0].enviadas, 9);
});

test("el tramo de encaje se nombra por su rango", () => {
  const d = diagnosticar([
    conPuntaje("postulada", 30),
    conPuntaje("postulada", 65),
    conPuntaje("postulada", 90),
    v("postulada"),
  ]);
  const etiquetas = d.porEncaje.map((c) => c.etiqueta).sort();
  assert.deepEqual(etiquetas, [
    "Encaje alto (75+)",
    "Encaje bajo (menos de 60)",
    "Encaje medio (60-74)",
    "Sin analizar",
  ]);
});

test("sin vacantes no revienta", () => {
  const d = diagnosticar([]);
  assert.equal(d.global.enviadas, 0);
  assert.deepEqual(d.porFuente, []);
});
