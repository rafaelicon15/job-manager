import { test } from "node:test";
import assert from "node:assert/strict";
import { promptCoherencia, promptSeguimiento } from "../lib/prompts";
import type { PerfilMaestro, Vacante } from "../lib/types";

/**
 * Los dos prompts de la pantalla de revisión.
 *
 * El del seguimiento tiene un trabajo concreto: que el último toque sea un
 * cierre digno y no una súplica. El de coherencia tiene el contrario: no
 * inventarse una contradicción para parecer útil.
 */

const PERFIL: PerfilMaestro = {
  nombre: "Ana B. Torres",
  titular: "Growth",
  titularEn: "Growth",
  email: "correo@ejemplo.com",
  telefono: "+00 000 0000000",
  ubicacion: "Villa de Cura, Aragua, Venezuela",
  links: [],
  resumen: "Perfil de crecimiento.",
  resumenEn: "Growth profile.",
  experiencias: [],
  educacion: [],
  certificaciones: [],
  habilidades: [],
  idiomas: [],
  psicometria: [],
  lineasRojas: ["Nunca inventar empleadores ni fechas."],
  preferencias: {
    modalidad: "Remoto",
    disponibilidad: "Inmediata",
    salarioMin: "1.500 USD",
    salarioObjetivo: "2.000 USD",
    rolesObjetivo: [],
    keywordsBusqueda: [],
  },
};

function vacante(parcial: Partial<Vacante> = {}): Vacante {
  return {
    id: "vac-1",
    titulo: "Growth Manager",
    empresa: "Empresa Ejemplo",
    ubicacion: "Remoto",
    modalidad: "Remoto",
    fuente: "adzuna",
    descripcion: "Descripción de la oferta.",
    estado: "postulada",
    favorito: false,
    creadaEn: "2026-08-01T00:00:00.000Z",
    actualizadaEn: "2026-08-01T00:00:00.000Z",
    toques: [],
    documentos: [],
    reuniones: [],
    adjuntos: [],
    notas: [],
    ...parcial,
  };
}

// ------------------------------------------------------------- seguimiento

test("el primer toque no se plantea como cierre", () => {
  const p = promptSeguimiento(PERFIL, vacante(), 10, 0, "te postulaste", "es");
  assert.ok(!p.includes("ÚLTIMO toque"));
  assert.match(p, /hace 10 días/);
});

test("el segundo toque se plantea como cierre digno", () => {
  // Insistir por tercera vez no consigue nada; cerrar bien te deja en su lista
  // para la próxima vacante.
  const p = promptSeguimiento(PERFIL, vacante(), 30, 1, "diste un toque", "es");
  assert.match(p, /ÚLTIMO toque/);
  assert.match(p, /sin reproche y sin drama/);
});

test("el toque tiene tope de palabras y prohibiciones concretas", () => {
  const p = promptSeguimiento(PERFIL, vacante(), 10, 0, "te postulaste", "es");
  assert.match(p, /Entre 45 y 90 palabras/);
  assert.match(p, /Nada de disculpas por escribir/);
  assert.match(p, /razón para escribir HOY/);
  assert.match(p, /NO uses guiones largos/);
});

test("sin contacto con nombre se avisa en vez de inventar uno", () => {
  const p = promptSeguimiento(PERFIL, vacante(), 10, 0, "te postulaste", "es");
  assert.match(p, /Sin contacto con nombre/);

  const conNombre = promptSeguimiento(
    PERFIL,
    vacante({ contacto: { nombre: "Marta Ruiz", cargo: "Talent Partner" } }),
    10,
    0,
    "te postulaste",
    "es"
  );
  assert.match(conNombre, /Marta Ruiz, Talent Partner/);
});

test("el seguimiento arrastra lo que ya se habló en las reuniones", () => {
  const p = promptSeguimiento(
    PERFIL,
    vacante({
      reuniones: [
        {
          id: "reu-1",
          tipo: "screening",
          fecha: "2026-08-20T10:00",
          canal: "Meet",
          participantes: [],
          notasCrudas: "",
          materiales: [],
          creadaEn: "2026-08-20T10:00:00.000Z",
          actualizadaEn: "2026-08-20T10:00:00.000Z",
          resumen: {
            titulo: "Screening",
            resumen: "Hablamos del equipo de growth.",
            puntosClave: [],
            datosDelPuesto: [],
            preguntasQueMeHicieron: [],
            compromisosMios: [],
            compromisosDeEllos: ["Contestar en una semana"],
            preguntasSinResponder: [],
            senalesBuenas: [],
            senalesDeAlerta: [],
            incoherencias: [],
            aReforzar: [],
            proximoPaso: "",
            seguimiento: "",
            generadoEn: "2026-08-20T12:00:00.000Z",
            modelo: "x",
          },
        },
      ],
    }),
    20,
    0,
    "hubo una reunión",
    "es"
  );
  assert.match(p, /Contestar en una semana/);
});

test("el idioma se respeta", () => {
  assert.match(promptSeguimiento(PERFIL, vacante(), 9, 0, "x", "en"), /en inglés/);
  assert.match(promptSeguimiento(PERFIL, vacante(), 9, 0, "x", "es"), /en español/);
});

// -------------------------------------------------------------- coherencia

const DICHOS = [
  { donde: "Empresa A, por linkedin", cuando: "2026-08-10", texto: "Mi disponibilidad es inmediata." },
  { donde: "Empresa B, en reunión", cuando: "2026-09-01", texto: "Necesito treinta días de preaviso." },
];

test("el prompt lleva cada frase con su sitio y su fecha", () => {
  const p = promptCoherencia(PERFIL, DICHOS);
  assert.match(p, /Empresa A, por linkedin · 2026-08-10/);
  assert.match(p, /Necesito treinta días de preaviso/);
  assert.match(p, /2 fragmentos/);
});

test("prohíbe expresamente inventarse una contradicción", () => {
  // Es el peor resultado posible de esta revisión: te manda a corregir algo que
  // nunca dijiste.
  const p = promptCoherencia(PERFIL, DICHOS);
  assert.match(p, /Inventar una contradicción para parecer útil/);
  assert.match(p, /devuelve la lista vacía y limpio en true/);
});

test("distingue un matiz de una contradicción", () => {
  const p = promptCoherencia(PERFIL, DICHOS);
  assert.match(p, /Una diferencia de matiz NO es una contradicción/);
  assert.match(p, /pueden ser una evolución legítima/);
});

test("pide citar las palabras, no parafrasearlas", () => {
  const p = promptCoherencia(PERFIL, DICHOS);
  assert.match(p, /Cita las palabras, no las parafrasees/);
});

test("un fragmento larguísimo se recorta", () => {
  const p = promptCoherencia(PERFIL, [
    { donde: "Empresa A", cuando: "2026-08-10", texto: "x".repeat(5000) },
  ]);
  assert.ok(p.length < 12000, `el prompt se fue a ${p.length} caracteres`);
});

test("sin fragmentos no revienta", () => {
  assert.doesNotThrow(() => promptCoherencia(PERFIL, []));
});
