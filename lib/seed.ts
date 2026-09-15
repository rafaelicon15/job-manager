import type { Ajustes, EstadoApp, PerfilMaestro } from "./types";

/**
 * Perfil maestro vacío. Es la plantilla con la que arranca la app.
 *
 * No lo rellenes a mano si puedes evitarlo: ve a **Perfil maestro** en la app,
 * copia el prompt, pásaselo a tu IA con tu CV y pega el JSON que te devuelva.
 * Tarda dos minutos y sale mucho más completo.
 *
 * Este archivo solo se toca si quieres que la app arranque ya con tu perfil
 * cargado en cualquier navegador donde la abras. Ten en cuenta que entonces tus
 * datos viven en el repositorio: no lo hagas si el repositorio es público.
 */
export const PERFIL_INICIAL: PerfilMaestro = {
  nombre: "",
  titular: "",
  titularEn: "",
  email: "",
  usuario: "",
  telefono: "",
  ubicacion: "",
  fechaNacimiento: "",
  links: [],
  resumen: "",
  resumenEn: "",
  experiencias: [],
  educacion: [],
  certificaciones: [],
  habilidades: [],
  idiomas: [],
  psicometria: [],

  /**
   * Los límites que el motor NUNCA debe cruzar al redactar. Se inyectan en
   * todos los prompts, así que son la última defensa contra un CV que promete
   * algo que no puedes sostener en una entrevista.
   *
   * Estas son las genéricas. Añade las tuyas: si dejaste un trabajo en malos
   * términos, si hay un título a medias, si hay una herramienta que pusiste en
   * el CV hace años y ya no dominas, escríbelo aquí.
   */
  lineasRojas: [
    "Nunca inventar empleadores, cargos, fechas, títulos ni certificaciones.",
    "Nunca afirmar un nivel de idioma que no esté declarado en el perfil.",
    "Nunca inventar métricas: solo usar las que existen en los logros del perfil.",
    "Nunca afirmar experiencia con una herramienta que no esté en Habilidades.",
    "Nunca presentar como propio un logro que fue de equipo sin decir cuál fue mi parte.",
    "Si falta un requisito, decirlo y proponer cómo compensarlo, no maquillarlo.",
  ],

  preferencias: {
    modalidad: "",
    disponibilidad: "",
    salarioMin: "",
    salarioObjetivo: "",
    rolesObjetivo: [],
    keywordsBusqueda: [],
  },
};

export const AJUSTES_INICIALES: Ajustes = {
  geminiApiKey: "",
  // Flash Lite es el más fiable del plan gratuito. Los otros modelos están
  // disponibles en Ajustes; Flash suele estar saturado y Pro no tiene cuota
  // gratuita.
  modelo: "gemini-flash-lite-latest",
  modeloGeneracion: "gemini-flash-lite-latest",
  adzunaAppId: "",
  adzunaAppKey: "",
  joobleKey: "",
  careerjetKey: "",
  idiomaPorDefecto: "es",
};

export const ESTADO_INICIAL: EstadoApp = {
  version: 1,
  perfil: PERFIL_INICIAL,
  vacantes: [],
  conversaciones: [],
  ajustes: AJUSTES_INICIALES,
};
