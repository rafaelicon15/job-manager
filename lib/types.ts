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

/**
 * Dirección postal, que casi nunca coincide con la ubicación profesional.
 *
 * `ubicacion` dice dónde trabajas y sale en el CV ("Maracay, Aragua,
 * Venezuela"). Esto es a dónde te mandan las cosas, que puede ser otra ciudad
 * y otro código postal. Solo se usa para rellenar formularios: no aparece en
 * ningún documento generado.
 */
export interface DireccionPostal {
  calle?: string;
  ciudad?: string;
  provincia?: string;
  codigoPostal?: string;
  pais?: string;
}

export interface PerfilMaestro {
  nombre: string;
  /**
   * Cómo se parte el nombre cuando un formulario lo pide por trozos.
   *
   * No se deduce de `nombre`: "Ana B. Torres" partido por espacios da
   * "Ana B." de nombre, y de la inicial "B." no hay forma de sacar
   * "Beatriz". En los nombres hispanos con dos apellidos el reparto tampoco
   * es evidente. Si están vacíos se parte lo mejor posible, pero rellenarlos
   * evita el problema.
   */
  nombrePila?: string;
  segundoNombre?: string;
  apellidos?: string;
  titular: string;
  titularEn: string;
  email: string;
  /**
   * El usuario con el que se crean las cuentas en los portales. Se guarda
   * aparte del correo porque muchos formularios piden "Email o usuario" y
   * usar siempre el mismo evita acabar con una cuenta por portal y ninguna
   * recordada.
   */
  usuario?: string;
  telefono: string;
  ubicacion: string;
  direccionPostal?: DireccionPostal;
  /** Fecha de nacimiento en AAAA-MM-DD, que es lo que espera un input date. */
  fechaNacimiento?: string;
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
  /** Las llamadas y entrevistas que ya han pasado, con su resumen. */
  reuniones: Reunion[];
  /** Material que manda el reclutador, ya analizado. */
  adjuntos: Adjunto[];
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
  /** Material que manda el reclutador en el hilo, ya analizado. */
  adjuntos: Adjunto[];
  creadaEn: string;
  actualizadaEn: string;
}

export type TipoReunion =
  | "screening"
  | "tecnica"
  | "con_manager"
  | "cultural"
  | "final"
  | "seguimiento"
  | "otra";

export const TIPOS_REUNION: { id: TipoReunion; label: string }[] = [
  { id: "screening", label: "Screening con RRHH" },
  { id: "tecnica", label: "Entrevista técnica" },
  { id: "con_manager", label: "Con el responsable" },
  { id: "cultural", label: "Encaje cultural" },
  { id: "final", label: "Ronda final" },
  { id: "seguimiento", label: "Seguimiento" },
  { id: "otra", label: "Otra" },
];

/**
 * Una reunión que ya ocurrió: la llamada de screening, la técnica, la del
 * responsable.
 *
 * Existe porque lo que se dice en una llamada no queda escrito en ningún
 * sitio. A la tercera entrevista nadie recuerda qué sueldo mencionaron de
 * pasada, qué prometiste mandar, ni qué te preguntaron y contestaste regular.
 * Eso es justo lo que decide el proceso, y se pierde.
 *
 * `notasCrudas` es lo que pegas tú: apuntes a mano, la transcripción de Meet,
 * el chat de la llamada. `resumen` es lo que saca el motor de ahí.
 */
export interface Reunion {
  id: string;
  tipo: TipoReunion;
  /** Cuándo fue, en AAAA-MM-DDTHH:MM (lo que da un input datetime-local). */
  fecha: string;
  duracionMin?: number;
  /** Zoom, Meet, Teams, teléfono, presencial. */
  canal: string;
  participantes: { nombre: string; cargo?: string }[];
  /** Apuntes, transcripción o chat de la llamada, tal cual. */
  notasCrudas: string;
  /** Lo que mandaron por escrito: la propuesta, el plan, la prueba técnica. */
  materiales: MaterialReunion[];
  resumen?: ResumenReunion;
  creadaEn: string;
  actualizadaEn: string;
}

/**
 * Un documento que acompaña a una reunión, ya convertido a Markdown.
 *
 * Se guarda el Markdown y no el archivo. Un PDF de veinte páginas son cientos
 * de KB y localStorage ronda los 5 MB; el mismo documento en Markdown ocupa
 * cuarenta y cabe de sobra, así que el material se queda con la reunión para
 * siempre y no hay que volver a subirlo cada vez que se regenera el resumen.
 *
 * `sinConvertir` es la excepción: un PDF escaneado o una captura no tienen
 * texto que extraer y tienen que ir como bytes a Gemini. De esos se guarda la
 * ficha y el motivo, pero no el contenido: para volver a resumirlos hay que
 * subirlos otra vez.
 */
export interface MaterialReunion {
  id: string;
  nombre: string;
  bytes: number;
  /** mimeType si lo trae el navegador, o la extensión. */
  tipo: string;
  /** El documento en Markdown. Vacío cuando no se pudo convertir. */
  markdown: string;
  palabras: number;
  /** true cuando el Markdown salió de extraerle el texto a un PDF. */
  extraido?: boolean;
  /** Por qué no se pudo convertir. Su presencia significa que no hay Markdown. */
  sinConvertir?: string;
  subidoEn: string;
}

export interface ResumenReunion {
  titulo: string;
  resumen: string;
  puntosClave: string[];
  /** Condiciones concretas que salieron en la llamada: sueldo, horario, plazos. */
  datosDelPuesto: { concepto: string; valor: string }[];
  /** Lo que te preguntaron y cómo lo contestaste, con una versión mejor. */
  preguntasQueMeHicieron: {
    pregunta: string;
    comoRespondi: string;
    mejorRespuesta: string;
  }[];
  /** Lo que prometiste tú. Esto es lo que más se olvida y lo que peor sienta. */
  compromisosMios: string[];
  /** Lo que prometieron ellos, con el plazo que dieron si lo dieron. */
  compromisosDeEllos: string[];
  /** Lo que preguntaste y no te contestaron, o quedó a medias. */
  preguntasSinResponder: string[];
  senalesBuenas: string[];
  senalesDeAlerta: string[];
  /** Cosas que dijiste y el perfil maestro no respalda. La misma red que en los hilos. */
  incoherencias: Incoherencia[];
  /** Qué preparar para la siguiente ronda. */
  aReforzar: string[];
  proximoPaso: string;
  /** Mensaje de seguimiento listo para enviar. */
  seguimiento: string;
  generadoEn: string;
  modelo: string;
}

/**
 * Un documento que manda el reclutador: la descripción del puesto en PDF, un
 * contrato, una propuesta económica, una prueba técnica.
 *
 * No guarda los bytes del archivo, solo su ficha y el análisis. El estado vive
 * en localStorage (unos 5 MB) y tres PDFs lo llenarían, tirando por delante
 * vacantes y conversaciones. El original sigue en el disco del usuario.
 */
export interface Adjunto {
  id: string;
  nombre: string;
  bytes: number;
  /** mimeType si lo trae el navegador, o la extensión. */
  tipo: string;
  subidoEn: string;
  analisis?: AnalisisDocumento;
}

export type ClaseDocumento =
  | "descripcion_puesto"
  | "contrato"
  | "propuesta_economica"
  | "prueba_tecnica"
  | "confidencialidad"
  | "otro";

export interface AnalisisDocumento {
  clase: ClaseDocumento;
  titulo: string;
  resumen: string;
  puntosClave: string[];
  /** Cifras concretas que aparecen: sueldo, plazos, penalizaciones, horas. */
  cifras: { concepto: string; valor: string }[];
  /** Cláusulas o condiciones que conviene mirar dos veces antes de firmar. */
  alertas: { asunto: string; porque: string; queHacer: string }[];
  /** Cómo cuadra con el perfil maestro. Vacío si el documento no lo permite. */
  encaje: string;
  /** Lo que el documento NO dice y debería. Suele ser lo más caro. */
  huecos: string[];
  preguntasQueHacer: string[];
  generadoEn: string;
  modelo: string;
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
