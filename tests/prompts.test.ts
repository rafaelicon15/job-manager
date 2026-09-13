import { test } from "node:test";
import assert from "node:assert/strict";
import { promptHilo, reglasDeEstilo } from "../lib/prompts.ts";
import { PERFIL_INICIAL } from "../lib/seed.ts";
import type { Adjunto, Vacante } from "../lib/types.ts";

const perfil = {
  ...PERFIL_INICIAL,
  nombre: "Ana Torres",
  ubicacion: "Valencia, España",
  preferencias: { ...PERFIL_INICIAL.preferencias, salarioObjetivo: "38.000 EUR" },
};

const adjunto: Adjunto = {
  id: "a1",
  nombre: "JD.pdf",
  bytes: 1000,
  tipo: "application/pdf",
  subidoEn: "",
  analisis: {
    clase: "descripcion_puesto",
    titulo: "Descripción del puesto",
    resumen: "Growth para negocio de salud masculina.",
    puntosClave: ["Mercado de hombres de 35 a 60 años: golfistas y pickleball."],
    cifras: [{ concepto: "Experiencia requerida", valor: "3+ años" }],
    alertas: [],
    encaje: "Encaja con su experiencia en CRM.",
    huecos: ["No especifica el salario ofrecido."],
    preguntasQueHacer: ["¿Cuál es el rango?"],
    generadoEn: "",
    modelo: "",
  },
};

const vacante = {
  id: "v1",
  titulo: "Growth Marketing Specialist",
  empresa: "Confidencial",
  ubicacion: "Remoto",
  modalidad: "Remoto",
  descripcion: "Growth marketing.",
  documentos: [],
  notas: [],
  adjuntos: [],
} as unknown as Vacante;

const render = (
  mensajes: { de: "yo" | "ellos"; texto: string; fecha: string }[],
  adjuntos: Adjunto[] = [adjunto]
) =>
  promptHilo(
    perfil,
    "linkedin",
    "Angélica Acosta · Talent Acquisition",
    mensajes,
    vacante,
    "",
    "es",
    "Profesional y directo",
    adjuntos
  );

const abierto = render([
  { de: "ellos", texto: "Hi Ana", fecha: "" },
  { de: "yo", texto: "Hi, thanks", fecha: "" },
  { de: "ellos", texto: "Find the JD attached", fecha: "" },
]);
const nuevo = render([{ de: "ellos", texto: "Hi Ana", fecha: "" }]);

test("el análisis del adjunto llega al prompt", () => {
  assert.match(abierto, /golfistas y pickleball/);
  assert.match(abierto, /3\+ años/);
  assert.match(abierto, /No especifica el salario ofrecido/);
});

test("prohíbe preguntar por lo que ya está en el material", () => {
  assert.match(abierto, /NO preguntes por nada que ya esté/);
});

test("con la conversación abierta prohíbe volver a saludar", () => {
  assert.match(abierto, /NO vuelvas a saludar/);
  assert.doesNotMatch(abierto, /Es tu primer mensaje en este hilo/);
});

test("en el primer mensaje sí permite saludar", () => {
  assert.match(nuevo, /Es tu primer mensaje en este hilo/);
  assert.doesNotMatch(nuevo, /NO vuelvas a saludar/);
});

test("trata LinkedIn como chat y no como correo", () => {
  assert.match(abierto, /LinkedIn es un CHAT/);
  assert.match(abierto, /600 caracteres/);
});

test("prohíbe ofrecer la expectativa salarial por su cuenta", () => {
  assert.match(abierto, /NO OFREZCAS TU EXPECTATIVA SALARIAL/);
});

test("limita a dos preguntas y exige citar el material", () => {
  assert.match(abierto, /Máximo dos preguntas/);
  assert.match(abierto, /DEMUESTRA QUE LEÍSTE EL MATERIAL/);
});

test("pide avisar si el idioma del hilo no coincide", () => {
  assert.match(abierto, /idioma distinto al que has usado/);
});

test("pide pendientes cortos y sin coletillas", () => {
  assert.match(abierto, /ni le añadas condiciones/);
});

test("sin adjuntos lo dice en lugar de callar", () => {
  assert.match(render([{ de: "ellos", texto: "Hola", fecha: "" }], []), /No hay documentos adjuntos/);
});

test("las reglas de estilo prohíben los guiones largos y los superlativos", () => {
  const e = reglasDeEstilo();
  assert.match(e, /NO uses guiones largos/);
  assert.match(e, /encaja perfectamente/);
  assert.match(e, /quedo atento a tus comentarios/);
});

test("el prompt se dirige al candidato por su nombre, no a uno fijo", () => {
  // Se comprueba cambiando el perfil en lugar de buscar un nombre concreto:
  // así la prueba vale para cualquiera y no deja un nombre real escrito.
  const otro = promptHilo(
    { ...perfil, nombre: "Beatriz Serra" },
    "linkedin",
    "Contacto",
    [{ de: "ellos", texto: "Hola", fecha: "" }],
    vacante,
    "",
    "es",
    "Profesional y directo",
    []
  );
  assert.match(abierto, /Ana Torres/);
  assert.match(otro, /Beatriz Serra/);
  assert.doesNotMatch(otro, /Ana Torres/, "el nombre sale del perfil, no del código");
});
