// Modelo de datos del Job Manager. Todo vive en localStorage del navegador.

export type Idioma = "es" | "en";

/** Una prueba verificable de que algo del CV es cierto. */
export interface Evidencia {
  tipo: "certificado" | "url" | "proyecto" | "test" | "referencia";
  descripcion: string;
  url?: string;
}

/** Un logro reutilizable. El motor solo puede afirmar lo que exista aquí. */
export interface Logro {
  id: string;
  texto: string;
  /** Métrica concreta si existe (ej. "+87% conversiones"). Vacío = logro cualitativo. */
  metrica?: string;
  /** Etiquetas de perfil a las que sirve este logro: cro, ppc, web, ti, ia. */
  angulos: string[];
  /** Palabras clave ATS que este logro respalda de forma honesta. */
  keywords: string[];
  evidencia?: Evidencia[];
}

export interface Experiencia {
  id: string;
  puesto: string;
  empresa: string;
  ubicacion: string;
  modalidad: string;
  desde: string;
  hasta: string;
  resumen: string;
  logros: Logro[];
}

export interface Certificacion {
  id: string;
  nombre: string;
  emisor: string;
  anio?: string;
  url?: string;
}

export interface HabilidadGrupo {
  categoria: string;
  /** nivel: 1 = nociones, 2 = funcional, 3 = sólido, 4 = experto */
  items: { nombre: string; nivel: 1 | 2 | 3 | 4; anios?: number }[];
}

export interface RasgoPsicometrico {
  titulo: string;
  etiquetas: string[];
  implicaciones: string[];
}

export interface PerfilMaestro {
  nombre: string;
  titular: string;
  titularEn: string;
  email: string;
  telefono: string;
  ubicacion: string;
  links: { etiqueta: string; url: string }[];
  resumen: string;
  resumenEn: string;
  experiencias: Experiencia[];
  educacion: { titulo: string; institucion: string; estado: string }[];
  certificaciones: Certificacion[];
  habilidades: HabilidadGrupo[];
  idiomas: { idioma: string; nivel: string }[];
  psicometria: RasgoPsicometrico[];
  /** Límites que el motor NUNCA debe cruzar al redactar. */
  lineasRojas: string[];
  preferencias: {
    modalidad: string;
    disponibilidad: string;
    salarioMin?: string;
    salarioObjetivo?: string;
    rolesObjetivo: string[];
    keywordsBusqueda: string[];
  };
}

export type EstadoVacante =
  | "descubierta"
  | "analizada"
  | "preparada"
  | "postulada"
  | "screening"
  | "entrevista"
  | "oferta"
  | "rechazada"
  | "descartada";

export const ESTADOS: { id: EstadoVacante; label: string; color: string }[] = [
  { id: "descubierta", label: "Descubierta", color: "slate" },
  { id: "analizada", label: "Analizada", color: "sky" },
  { id: "preparada", label: "Lista para enviar", color: "violet" },
  { id: "postulada", label: "Postulada", color: "amber" },
  { id: "screening", label: "Screening", color: "orange" },
  { id: "entrevista", label: "Entrevista", color: "cyan" },
  { id: "oferta", label: "Oferta", color: "emerald" },
  { id: "rechazada", label: "Rechazada", color: "rose" },
  { id: "descartada", label: "Descartada por mí", color: "zinc" },
];

export interface RequisitoAnalizado {
  requisito: string;
  cubierto: "si" | "parcial" | "no";
  evidencia: string;
  /** Cómo responder si el reclutador pregunta por este punto. */
  comoResponder?: string;
}

export interface Analisis {
  puntaje: number;
  veredicto: "aplicar_ya" | "aplicar" | "dudoso" | "no_aplicar";
  razonVeredicto: string;
  anguloRecomendado: string;
  titularSugerido: string;
  requisitos: RequisitoAnalizado[];
  fortalezas: string[];
  brechas: { brecha: string; mitigacion: string }[];
  keywordsATS: string[];
  banderasRojas: string[];
  preguntasParaElReclutador: string[];
  generadoEn: string;
  modelo: string;
}

export interface DocumentoGenerado {
  id: string;
  tipo: "cv" | "carta" | "mensaje_reclutador" | "respuesta" | "notas_entrevista";
  titulo: string;
  contenido: string;
  idioma: Idioma;
  creadoEn: string;
}

export interface Vacante {
  id: string;
  titulo: string;
  empresa: string;
  ubicacion: string;
  modalidad: string;
  salario?: string;
  fuente: string;
  url?: string;
  descripcion: string;
  estado: EstadoVacante;
  favorito: boolean;
  creadaEn: string;
  actualizadaEn: string;
  fechaPostulacion?: string;
  proximaAccion?: { que: string; cuando: string };
  contacto?: { nombre?: string; cargo?: string; linkedin?: string; email?: string };
  analisis?: Analisis;
  documentos: DocumentoGenerado[];
  notas: { id: string; texto: string; fecha: string }[];
}

export type Canal = "linkedin" | "email" | "whatsapp" | "otro";

export const CANALES: { id: Canal; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Correo" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "otro", label: "Otro" },
];

export interface Mensaje {
  id: string;
  /** Quién habla: el reclutador o el candidato. */
  de: "ellos" | "yo";
  texto: string;
  /** Fecha en ISO, o el sello que venía en el chat si no se pudo normalizar. */
  fecha: string;
  /** true cuando el mensaje se generó con el motor y aún no se ha enviado. */
  borrador?: boolean;
}

/** Algo que el reclutador pidió y sigue sin hacerse. */
export interface Pendiente {
  id: string;
  que: string;
  hecho: boolean;
  cuando?: string;
}

/**
 * Una afirmación hecha en el hilo que el perfil maestro no respalda.
 * Es la red de seguridad contra prometer en un chat algo que no puedes
 * sostener en la entrevista.
 */
export interface Incoherencia {
  afirmacion: string;
  problema: string;
  comoCorregir: string;
}

export interface Conversacion {
  id: string;
  canal: Canal;
  asunto: string;
  contacto: {
    nombre: string;
    cargo?: string;
    empresa?: string;
    /** Perfil de LinkedIn, correo o número, según el canal. */
    handle?: string;
  };
  mensajes: Mensaje[];
  /** Vacante enlazada, si la hay. */
  vacanteId?: string;
  archivada: boolean;
  pendientes: Pendiente[];
  /** Preguntas que hiciste y que todavía no te han respondido. */
  preguntasSinResponder: string[];
  incoherencias: Incoherencia[];
  creadaEn: string;
  actualizadaEn: string;
}

export interface Ajustes {
  geminiApiKey: string;
  modelo: string;
  modeloGeneracion: string;
  adzunaAppId: string;
  adzunaAppKey: string;
  joobleKey: string;
  careerjetKey: string;
  idiomaPorDefecto: Idioma;
  ultimoRespaldo?: string;
}

export interface EstadoApp {
  version: number;
  perfil: PerfilMaestro;
  vacantes: Vacante[];
  conversaciones: Conversacion[];
  ajustes: Ajustes;
}
