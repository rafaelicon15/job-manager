import { test } from "node:test";
import assert from "node:assert/strict";
import { analizarSilencios, etiquetaSilencio } from "../lib/silencios";
import type { Conversacion, EstadoVacante, Vacante } from "../lib/types";

/**
 * El radar de silencios.
 *
 * Lo que protegen estas pruebas es que no llame muerto a un proceso vivo ni al
 * revés. Los dos errores cuestan: el primero te hace abandonar algo que todavía
 * se podía salvar, y el segundo te tiene tres meses esperando un correo que no
 * va a llegar.
 */

const AHORA = new Date("2026-09-15T12:00:00.000Z");
const haceDias = (n: number) =>
  new Date(AHORA.getTime() - n * 86400000).toISOString();

function vacante(parcial: Partial<Vacante> = {}): Vacante {
  return {
    id: "vac-1",
    titulo: "Growth Manager",
    empresa: "Empresa Ejemplo",
    ubicacion: "Remoto",
    modalidad: "Remoto",
    fuente: "adzuna",
    descripcion: "x",
    estado: "postulada" as EstadoVacante,
    favorito: false,
    creadaEn: haceDias(40),
    actualizadaEn: haceDias(1),
    fechaPostulacion: haceDias(30),
    toques: [],
    documentos: [],
    reuniones: [],
    adjuntos: [],
    notas: [],
    ...parcial,
  };
}

function hilo(parcial: Partial<Conversacion> = {}): Conversacion {
  return {
    id: "con-1",
    canal: "linkedin",
    asunto: "Growth Manager",
    contacto: { nombre: "Marta Ruiz" },
    mensajes: [],
    vacanteId: "vac-1",
    archivada: false,
    pendientes: [],
    preguntasSinResponder: [],
    incoherencias: [],
    adjuntos: [],
    creadaEn: haceDias(30),
    actualizadaEn: haceDias(30),
    ...parcial,
  };
}

test("una postulación reciente no aparece: todavía no es silencio", () => {
  const r = analizarSilencios([vacante({ fechaPostulacion: haceDias(3) })], [], AHORA);
  assert.equal(r.length, 0);
});

test("a los diez días de postularte se marca como enfriándose", () => {
  const r = analizarSilencios([vacante({ fechaPostulacion: haceDias(10) })], [], AHORA);
  assert.equal(r.length, 1);
  assert.equal(r[0].estado, "enfriandose");
  assert.equal(r[0].dias, 10);
  assert.match(r[0].queFue, /te postulaste/);
});

test("a las tres semanas se da por muerta", () => {
  const r = analizarSilencios([vacante({ fechaPostulacion: haceDias(25) })], [], AHORA);
  assert.equal(r[0].estado, "muerta");
  assert.equal(r[0].sugiereCerrar, false, "sin toques dados todavía queda margen");
});

test("dos toques y tres semanas: toca cerrarla", () => {
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: haceDias(40), toques: [haceDias(30), haceDias(25)] })],
    [],
    AHORA
  );
  assert.equal(r[0].sugiereCerrar, true);
  assert.equal(r[0].toques, 2);
  assert.equal(etiquetaSilencio(r[0]), "Dala por perdida");
});

test("el reloj corre más rápido después de una entrevista", () => {
  // Diez días tras una postulación son normales; tras una entrevista final
  // significan que están cerrando con otro.
  const postulada = analizarSilencios(
    [vacante({ estado: "postulada", fechaPostulacion: haceDias(6) })],
    [],
    AHORA
  );
  const entrevista = analizarSilencios(
    [vacante({ estado: "entrevista", fechaPostulacion: haceDias(6) })],
    [],
    AHORA
  );
  assert.equal(postulada.length, 0, "seis días tras postularte no es nada");
  assert.equal(entrevista[0].estado, "enfriandose");
});

test("si el último en escribir fueron ellos, no es su silencio sino el tuyo", () => {
  // Eso ya sale en "te toca responder" del panel, y duplicarlo aquí solo
  // consigue que el radar deje de significar algo.
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: haceDias(30) })],
    [hilo({ mensajes: [{ id: "m1", de: "ellos", texto: "hola", fecha: haceDias(2) }] })],
    AHORA
  );
  assert.equal(r.length, 0);
});

test("pero si llevan tres semanas callados tras escribirte, vuelve a salir", () => {
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: haceDias(60) })],
    [hilo({ mensajes: [{ id: "m1", de: "ellos", texto: "te digo algo", fecha: haceDias(30) }] })],
    AHORA
  );
  assert.equal(r[0].estado, "muerta");
  assert.equal(r[0].ultimoEn, "ellos");
});

test("el último mensaje tuyo cuenta como señal y reinicia el reloj", () => {
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: haceDias(30) })],
    [hilo({ mensajes: [{ id: "m1", de: "yo", texto: "un toque", fecha: haceDias(2) }] })],
    AHORA
  );
  assert.equal(r.length, 0);
});

test("un borrador sin enviar NO cuenta como señal", () => {
  // Escribir la respuesta y no mandarla es justo el caso en el que el radar
  // tiene que seguir avisando.
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: haceDias(30) })],
    [
      hilo({
        mensajes: [{ id: "m1", de: "yo", texto: "sin enviar", fecha: haceDias(1), borrador: true }],
      }),
    ],
    AHORA
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].dias, 30);
});

test("una reunión reciente mantiene el proceso vivo", () => {
  const r = analizarSilencios(
    [
      vacante({
        estado: "entrevista",
        fechaPostulacion: haceDias(40),
        reuniones: [
          {
            id: "reu-1",
            tipo: "tecnica",
            fecha: haceDias(2),
            canal: "Meet",
            participantes: [],
            notasCrudas: "",
            materiales: [],
            creadaEn: haceDias(2),
            actualizadaEn: haceDias(2),
          },
        ],
      }),
    ],
    [],
    AHORA
  );
  assert.equal(r.length, 0);
});

test("editar la vacante NO la resucita", () => {
  // `actualizadaEn` cambia al corregir una errata en el título. Si contara como
  // señal, un proceso muerto hace un mes parecería vivo.
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: haceDias(30), actualizadaEn: haceDias(0) })],
    [],
    AHORA
  );
  assert.equal(r[0].dias, 30);
});

test("las rechazadas y descartadas quedan fuera", () => {
  const r = analizarSilencios(
    [
      vacante({ id: "a", estado: "rechazada", fechaPostulacion: haceDias(60) }),
      vacante({ id: "b", estado: "descartada", fechaPostulacion: haceDias(60) }),
      vacante({ id: "c", estado: "descubierta" }),
    ],
    [],
    AHORA
  );
  assert.equal(r.length, 0);
});

test("lo más urgente sale primero", () => {
  const r = analizarSilencios(
    [
      vacante({ id: "tibia", fechaPostulacion: haceDias(9) }),
      vacante({ id: "muerta", fechaPostulacion: haceDias(40) }),
      vacante({ id: "tibia2", fechaPostulacion: haceDias(14) }),
    ],
    [],
    AHORA
  );
  assert.deepEqual(
    r.map((s) => s.vacante.id),
    ["muerta", "tibia2", "tibia"]
  );
});

test("una vacante guardada antes de que existieran los toques no rompe nada", () => {
  const v = { ...vacante(), toques: undefined } as unknown as Vacante;
  assert.doesNotThrow(() => analizarSilencios([v], [], AHORA));
  assert.equal(analizarSilencios([v], [], AHORA)[0].toques, 0);
});

test("sin fecha de postulación se cuenta desde que la guardaste", () => {
  const r = analizarSilencios(
    [vacante({ fechaPostulacion: undefined, creadaEn: haceDias(30) })],
    [],
    AHORA
  );
  assert.equal(r[0].dias, 30);
  assert.match(r[0].queFue, /guardaste/);
});
