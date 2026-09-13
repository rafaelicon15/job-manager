import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mismoPendiente,
  juntarPendientes,
  limpiarPendientes,
} from "../lib/pendientes.ts";

type P = { id: string; que: string; hecho: boolean };
const p = (que: string, hecho = false): P => ({ id: que.slice(0, 6), que, hecho });

test("reconoce la misma tarea aunque cambie el verbo", () => {
  assert.ok(mismoPendiente("Enviar el CV", "Compartir el currículum actualizado"));
  assert.ok(mismoPendiente("Enviar el portafolio", "Mandar muestras de trabajos previos"));
  assert.ok(mismoPendiente("Agendar la videollamada", "Confirmar hora de la entrevista"));
});

test("reconoce la misma tarea aunque le añadan coletillas", () => {
  assert.ok(
    mismoPendiente(
      "Enviar CV actualizado",
      "Enviar CV actualizado cuando se solicite formalmente tras conocer más detalles"
    )
  );
  assert.ok(
    mismoPendiente(
      "Compartir expectativas salariales",
      "Enviar expectativas salariales para el rol de contratista tras conocer más detalles del proyecto"
    )
  );
});

test("no confunde tareas distintas", () => {
  assert.ok(!mismoPendiente("Enviar CV actualizado", "Compartir expectativas salariales"));
  assert.ok(!mismoPendiente("Rellenar el formulario del portal", "Enviar el CV"));
  assert.ok(!mismoPendiente("Preparar la prueba técnica", "Agendar la entrevista"));
});

test("los límites de palabra evitan las coincidencias por substring", () => {
  // "conFIRMAr" contiene "firma"; "segUNDA" y "ageNDA" contienen "nda".
  assert.ok(
    !mismoPendiente("Confirmar hora de la entrevista", "Confirmar expectativa salarial"),
    "confirmar no debe caer en el asunto contrato"
  );
  assert.ok(
    !mismoPendiente("Confirmar la segunda entrevista", "Revisar la cláusula de exclusividad")
  );
  assert.ok(!mismoPendiente("Confirmar disponibilidad", "Confirmar expectativa salarial"));
});

test("colapsa la lista real de nueve entradas a dos", () => {
  const nueve = [
    "Enviar CV actualizado con el detalle de experiencia",
    "Confirmar las expectativas salariales para el compromiso basado en contratista",
    "Enviar CV actualizado",
    "Compartir expectativas salariales",
    "Enviar expectativas salariales para el contrato",
    "Enviar expectativas salariales para el rol de contratista tras conocer más detalles del proyecto",
    "Compartir el CV actualizado si el reclutador lo solicita explícitamente",
    "Enviar expectativas salariales para el puesto de contratista una vez que el reclutador aclare los detalles del cliente",
    "Enviar CV actualizado cuando se solicite formalmente tras conocer más detalles",
  ];
  assert.equal(limpiarPendientes(nueve.map((q) => p(q))).length, 2);
});

test("al colapsar sobrevive la marca de hecho de cualquiera del grupo", () => {
  const lista = [
    p("Enviar CV actualizado con el detalle de experiencia"),
    p("Enviar CV actualizado", true),
    p("Compartir el CV actualizado si el reclutador lo solicita"),
  ];
  const r = limpiarPendientes(lista);
  assert.equal(r.length, 1);
  assert.equal(r[0].hecho, true, "si ya mandó el CV, la tarea está hecha");
  assert.equal(r[0].que, "Enviar CV actualizado", "sobrevive el texto más corto");
});

test("juntar no duplica lo que ya existe y conserva el estado", () => {
  const existentes = [p("Enviar CV actualizado", true)];
  const r = juntarPendientes(
    existentes,
    ["Compartir el CV actualizado con más detalle", "Confirmar tu disponibilidad"],
    (que) => p(que)
  );
  assert.equal(r.length, 2, "el CV no se duplica, la disponibilidad es nueva");
  assert.equal(r[0].hecho, true, "no se pierde la marca de hecho");
});

test("una lista ya limpia no cambia", () => {
  const lista = [p("Enviar CV"), p("Agendar entrevista"), p("Firmar el contrato")];
  assert.equal(limpiarPendientes(lista).length, 3);
});

test("aguanta entradas vacías sin romperse", () => {
  assert.equal(limpiarPendientes([]).length, 0);
  assert.equal(juntarPendientes([], ["", "   "], (q) => p(q)).length, 0);
  assert.ok(!mismoPendiente("", "Enviar CV"));
});
