"use client";

import { Type } from "@google/genai";
import type {
  Analisis,
  AnalisisDocumento,
  Conversacion,
  Idioma,
  Incoherencia,
  PerfilMaestro,
  Reunion,
  ResumenReunion,
  Vacante,
} from "./types";
import {
  promptAnalizar,
  promptCV,
  promptParsearVacante,
  promptRespuesta,
  promptTriaje,
  promptParsearConversacion,
  promptHilo,
  promptCarta,
  promptEntrevista,
  promptReunion,
  promptDocumento,
} from "./prompts";

/**
 * Modelo al que se cae cuando el elegido está saturado. Medido contra la API
 * con una clave del plan gratuito: con prompts de 12KB y 36KB, Flash Lite
 * respondió 6 de 6 veces, mientras que gemini-flash-latest fallaba con 503
 * entre 2 y 3 de cada 3 intentos con cualquier tamaño de prompt.
 */
export const MODELO_RESPALDO = "gemini-flash-lite-latest";

// Verificados contra la API con una clave del plan gratuito. Ojo al añadir:
// que un modelo aparezca en /models NO garantiza que responda a generateContent
// (gemini-2.5-flash sale listado y devuelve 404).
export const MODELOS = [
  {
    id: "gemini-flash-lite-latest",
    label: "Gemini Flash Lite — recomendado, el más fiable en el plan gratuito",
  },
  {
    id: "gemini-flash-latest",
    label: "Gemini Flash — mejor calidad, pero suele estar saturado",
  },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash — versión fija" },
  {
    id: "gemini-pro-latest",
    label: "Gemini Pro — sin cuota en el plan gratuito",
  },
];

export class ErrorGemini extends Error {
  readonly causa?: unknown;

  constructor(mensaje: string, causa?: unknown) {
    super(mensaje);
    this.name = "ErrorGemini";
    this.causa = causa;
  }
}

function verificarClave(apiKey: string) {
  if (!apiKey.trim()) {
    throw new ErrorGemini(
      "Falta tu API key de Gemini. Ve a Ajustes y pégala para activar el motor."
    );
  }
}

/** Traduce los errores crudos de la API a algo accionable. */
function traducirError(e: unknown): ErrorGemini {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API key not valid|API_KEY_INVALID|400.*key/i.test(msg))
    return new ErrorGemini("Tu API key de Gemini no es válida. Revísala en Ajustes.");
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg))
    return new ErrorGemini(
      /per ?day|PerDay|daily/i.test(msg)
        ? "Agotaste la cuota diaria de Gemini del plan gratuito. Se renueva mañana; hasta entonces prueba con Flash Lite en Ajustes."
        : "Gemini te está limitando por exceso de peticiones por minuto. Ya se reintentó solo un par de veces sin éxito: espera un minuto y vuelve a darle."
    );
  if (
    /503|UNAVAILABLE|overloaded/i.test(msg) ||
    /high demand|spikes? in demand|try again later/i.test(msg)
  )
    return new ErrorGemini(
      "Gemini está saturado ahora mismo. La app ya reintentó varias veces sola; espera un minuto y vuelve a darle, o cambia a otro modelo en Ajustes."
    );
  if (/FAILED_PRECONDITION|location is not supported/i.test(msg))
    return new ErrorGemini(
      "Google rechaza esta API key por restricción geográfica («User location is not supported»). La clave autentica, pero el proyecto de Google en el que la creaste está marcado en un país sin acceso a la API de Gemini. Crea la clave en un proyecto nuevo desde aistudio.google.com y comprueba el país de la cuenta."
    );
  if (/SAFETY|blocked/i.test(msg))
    return new ErrorGemini("Gemini bloqueó la respuesta por filtros de seguridad. Prueba a reformular el texto de entrada.");
  return new ErrorGemini(`Fallo al llamar a Gemini: ${msg}`, e);
}

/**
 * Eventos del motor para que la interfaz no se quede muda. Los reintentos por
 * saturación pueden sumar 45 segundos de espera; sin esto el usuario solo ve un
 * spinner quieto y da por hecho que la app se colgó.
 */
export type EventoMotor =
  | { tipo: "reintento"; intento: number; tope: number; esperaMs: number; motivo: string }
  | { tipo: "respaldo"; modeloOriginal: string; modeloUsado: string }
  | { tipo: "fallo"; mensaje: string }
  | { tipo: "exito" };

const oyentes = new Set<(e: EventoMotor) => void>();

/** Suscribe a los eventos del motor. Devuelve la función para desuscribirse. */
export function escucharMotor(fn: (e: EventoMotor) => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

function emitir(e: EventoMotor) {
  for (const fn of oyentes) {
    try {
      fn(e);
    } catch {
      // Un oyente roto no debe tumbar la generación.
    }
  }
}

const MOTIVOS: Record<string, string> = {
  saturado: "Gemini está saturado",
  limitePorMinuto: "Límite de peticiones por minuto",
  cuotaDiaria: "Cuota diaria agotada",
  fatal: "Error",
};

const REINTENTOS = 4;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Clase = "saturado" | "limitePorMinuto" | "cuotaDiaria" | "fatal";

/**
 * Clasifica el fallo para decidir si reintentar y cuánto esperar. Medido contra
 * la API real con una clave del plan gratuito:
 *  - Los prompts grandes (perfil + oferta + hilo, que son los de esta app)
 *    devuelven 503 la mayor parte de las veces: 4 de cada 5 intentos fallaban
 *    y el quinto pasaba. Sin reintento la app resulta inservible.
 *  - El 429 suele ser el límite POR MINUTO, que se recupera solo. Rendirse a la
 *    primera le daba al usuario un error duro por algo que dura segundos.
 *  - El 429 por cuota DIARIA sí es definitivo: insistir solo la quema.
 */
function clasificar(e: unknown): Clase {
  const msg = e instanceof Error ? e.message : String(e);
  if (/per ?day|PerDay|daily/i.test(msg) && /429|quota|RESOURCE_EXHAUSTED/i.test(msg))
    return "cuotaDiaria";
  if (/429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) return "limitePorMinuto";
  if (
    e instanceof SyntaxError ||
    /503|UNAVAILABLE|overloaded|500|INTERNAL|fetch failed|network/i.test(msg) ||
    // Visto en producción: Google devuelve la saturación en prosa, sin código.
    /high demand|spikes? in demand|try again later|temporarily unavailable/i.test(msg)
  )
    return "saturado";
  return "fatal";
}

/** Espera antes del siguiente intento, según el tipo de fallo. */
function esperaDe(clase: Clase, intento: number): number {
  const jitter = Math.random() * 400;
  // El límite por minuto necesita esperas largas; la saturación, cortas.
  return clase === "limitePorMinuto"
    ? 12000 + intento * 12000 + jitter
    : 2 ** intento * 1000 + jitter;
}

/**
 * Una llamada a Gemini a través de la ruta /api/gemini del propio proyecto.
 * No se llama a Google desde el navegador a propósito: la API de Gemini está
 * restringida geográficamente y rechaza las peticiones que salen de Venezuela
 * con `FAILED_PRECONDITION: User location is not supported`. Pasando por el
 * servidor, la petición sale desde Vercel, que sí está en región soportada.
 */
async function llamarProxy(
  apiKey: string,
  modelo: string,
  prompt: string,
  schema: object,
  archivos?: ArchivoInline[]
): Promise<string> {
  const r = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, modelo, prompt, schema, archivos }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || d?.error) throw new Error(d?.error ?? `HTTP ${r.status}`);
  return d.texto as string;
}

/** Archivo que Gemini lee nativamente, tal como lo espera el proxy. */
export interface ArchivoInline {
  mimeType: string;
  datos: string;
}

async function generarJSON<T>(
  apiKey: string,
  modelo: string,
  prompt: string,
  schema: object,
  archivos?: ArchivoInline[]
): Promise<T> {
  verificarClave(apiKey);
  // Si el modelo elegido se satura, se reintenta con el de respaldo antes de
  // rendirse: más vale una respuesta de un modelo algo más ligero que un error.
  const cola = modelo === MODELO_RESPALDO ? [modelo] : [modelo, MODELO_RESPALDO];
  let ultimo: unknown;

  for (const actual of cola) {
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      try {
        const texto = await llamarProxy(apiKey, actual, prompt, schema, archivos);
        if (actual !== modelo)
          emitir({ tipo: "respaldo", modeloOriginal: modelo, modeloUsado: actual });
        const dato = JSON.parse(texto) as T;
        emitir({ tipo: "exito" });
        return dato;
      } catch (e) {
        ultimo = e;
        const clase = clasificar(e);
        if (clase === "fatal" || clase === "cuotaDiaria") {
          const err = e instanceof ErrorGemini ? e : traducirError(e);
          emitir({ tipo: "fallo", mensaje: err.message });
          throw err;
        }
        // El límite por minuto se reintenta menos veces: cada espera es larga.
        const tope = clase === "limitePorMinuto" ? 2 : REINTENTOS;
        if (intento >= tope) break;
        const espera = esperaDe(clase, intento);
        emitir({
          tipo: "reintento",
          intento: intento + 1,
          tope,
          esperaMs: espera,
          motivo: MOTIVOS[clase] ?? clase,
        });
        await dormir(espera);
      }
    }
  }

  const fallo =
    ultimo instanceof ErrorGemini
      ? ultimo
      : ultimo instanceof SyntaxError
        ? new ErrorGemini(
            "Gemini devolvió un JSON malformado varias veces seguidas. Reintenta en un momento."
          )
        : traducirError(ultimo);
  emitir({ tipo: "fallo", mensaje: fallo.message });
  throw fallo;
}

// ---------------------------------------------------------------- esquemas

const S = Type;
const listaTexto = { type: S.ARRAY, items: { type: S.STRING } };

const esquemaVacante = {
  type: S.OBJECT,
  properties: {
    titulo: { type: S.STRING },
    empresa: { type: S.STRING },
    ubicacion: { type: S.STRING },
    modalidad: { type: S.STRING, description: "Remoto, Híbrido, Presencial o vacío" },
    salario: { type: S.STRING },
    descripcion: { type: S.STRING },
  },
  required: ["titulo", "empresa", "descripcion"],
};

const esquemaAnalisis = {
  type: S.OBJECT,
  properties: {
    puntaje: { type: S.INTEGER },
    veredicto: {
      type: S.STRING,
      enum: ["aplicar_ya", "aplicar", "dudoso", "no_aplicar"],
    },
    razonVeredicto: { type: S.STRING },
    anguloRecomendado: { type: S.STRING },
    titularSugerido: { type: S.STRING },
    requisitos: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          requisito: { type: S.STRING },
          cubierto: { type: S.STRING, enum: ["si", "parcial", "no"] },
          evidencia: { type: S.STRING },
          comoResponder: { type: S.STRING },
        },
        required: ["requisito", "cubierto", "evidencia"],
      },
    },
    fortalezas: listaTexto,
    brechas: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          brecha: { type: S.STRING },
          mitigacion: { type: S.STRING },
        },
        required: ["brecha", "mitigacion"],
      },
    },
    keywordsATS: listaTexto,
    banderasRojas: listaTexto,
    preguntasParaElReclutador: listaTexto,
  },
  required: [
    "puntaje",
    "veredicto",
    "razonVeredicto",
    "anguloRecomendado",
    "titularSugerido",
    "requisitos",
    "fortalezas",
    "brechas",
    "keywordsATS",
    "banderasRojas",
    "preguntasParaElReclutador",
  ],
};

const esquemaCV = {
  type: S.OBJECT,
  properties: {
    titular: { type: S.STRING },
    resumen: { type: S.STRING },
    experiencias: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          puesto: { type: S.STRING },
          empresa: { type: S.STRING },
          ubicacion: { type: S.STRING },
          periodo: { type: S.STRING },
          bullets: {
            type: S.ARRAY,
            items: {
              type: S.OBJECT,
              properties: {
                texto: { type: S.STRING },
                origen: { type: S.STRING },
              },
              required: ["texto", "origen"],
            },
          },
        },
        required: ["puesto", "empresa", "periodo", "bullets"],
      },
    },
    habilidades: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          categoria: { type: S.STRING },
          items: listaTexto,
        },
        required: ["categoria", "items"],
      },
    },
    certificaciones: listaTexto,
    educacion: listaTexto,
    idiomas: listaTexto,
    avisos: listaTexto,
  },
  required: [
    "titular",
    "resumen",
    "experiencias",
    "habilidades",
    "certificaciones",
    "educacion",
    "idiomas",
    "avisos",
  ],
};

const esquemaRespuesta = {
  type: S.OBJECT,
  properties: {
    respuesta: { type: S.STRING },
    variantes: listaTexto,
    avisos: listaTexto,
  },
  required: ["respuesta", "variantes", "avisos"],
};

const esquemaTriaje = {
  type: S.OBJECT,
  properties: {
    resultados: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          id: { type: S.STRING },
          puntaje: { type: S.INTEGER },
          motivo: { type: S.STRING },
        },
        required: ["id", "puntaje", "motivo"],
      },
    },
  },
  required: ["resultados"],
};

// ------------------------------------------------------------------- tipos

export interface CVGenerado {
  titular: string;
  resumen: string;
  experiencias: {
    puesto: string;
    empresa: string;
    ubicacion?: string;
    periodo: string;
    bullets: { texto: string; origen: string }[];
  }[];
  habilidades: { categoria: string; items: string[] }[];
  certificaciones: string[];
  educacion: string[];
  idiomas: string[];
  avisos: string[];
}

export interface RespuestaGenerada {
  respuesta: string;
  variantes: string[];
  avisos: string[];
}

export interface VacanteParseada {
  titulo: string;
  empresa: string;
  ubicacion?: string;
  modalidad?: string;
  salario?: string;
  descripcion: string;
}

// --------------------------------------------------------------- funciones

export function parsearVacante(
  apiKey: string,
  modelo: string,
  textoCrudo: string
) {
  return generarJSON<VacanteParseada>(
    apiKey,
    modelo,
    promptParsearVacante(textoCrudo),
    esquemaVacante
  );
}

export async function analizarVacante(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  vacante: Vacante
): Promise<Analisis> {
  const bruto = await generarJSON<Omit<Analisis, "generadoEn" | "modelo">>(
    apiKey,
    modelo,
    promptAnalizar(perfil, vacante),
    esquemaAnalisis
  );
  return {
    ...bruto,
    puntaje: Math.max(0, Math.min(100, Math.round(bruto.puntaje))),
    generadoEn: new Date().toISOString(),
    modelo,
  };
}

/**
 * Genera el CV y verifica que cada bullet cite un id de logro que exista.
 * Los bullets con origen inventado se marcan como aviso en lugar de colarse.
 */
export async function generarCV(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  vacante: Vacante,
  idioma: Idioma
): Promise<CVGenerado> {
  const cv = await generarJSON<CVGenerado>(
    apiKey,
    modelo,
    promptCV(perfil, vacante, vacante.analisis, idioma),
    esquemaCV
  );
  const idsValidos = new Set(
    perfil.experiencias.flatMap((e) => e.logros.map((l) => l.id))
  );
  const huerfanos: string[] = [];
  for (const exp of cv.experiencias) {
    for (const b of exp.bullets) {
      const ids = b.origen.split(/[,\s]+/).filter(Boolean);
      const desconocidos = ids.filter(
        (id) => id !== "perfil" && !idsValidos.has(id)
      );
      if (desconocidos.length) huerfanos.push(`"${b.texto.slice(0, 70)}…"`);
    }
  }
  if (huerfanos.length) {
    cv.avisos = [
      `Verifica a mano estos bullets: el motor no pudo rastrearlos a un logro registrado de tu perfil — ${huerfanos.join(", ")}`,
      ...cv.avisos,
    ];
  }
  return cv;
}

export function generarRespuesta(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  vacante: Vacante,
  pregunta: string,
  idioma: Idioma,
  tono: string,
  extra: string
) {
  return generarJSON<RespuestaGenerada>(
    apiKey,
    modelo,
    promptRespuesta(perfil, vacante, pregunta, idioma, tono, extra),
    esquemaRespuesta
  );
}

export async function triarLote(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  lote: { id: string; titulo: string; empresa: string; extracto: string }[]
) {
  const r = await generarJSON<{
    resultados: { id: string; puntaje: number; motivo: string }[];
  }>(apiKey, modelo, promptTriaje(perfil, lote), esquemaTriaje);
  return r.resultados;
}

// ------------------------------------------------------- conversaciones

const esquemaConversacion = {
  type: S.OBJECT,
  properties: {
    asunto: { type: S.STRING },
    contacto: {
      type: S.OBJECT,
      properties: {
        nombre: { type: S.STRING },
        cargo: { type: S.STRING },
        empresa: { type: S.STRING },
        handle: { type: S.STRING },
      },
      required: ["nombre"],
    },
    mensajes: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          de: { type: S.STRING, enum: ["ellos", "yo"] },
          texto: { type: S.STRING },
          fecha: { type: S.STRING },
        },
        required: ["de", "texto", "fecha"],
      },
    },
    contieneOferta: { type: S.BOOLEAN },
    ofertaDetectada: {
      type: S.OBJECT,
      properties: {
        titulo: { type: S.STRING },
        empresa: { type: S.STRING },
        ubicacion: { type: S.STRING },
        modalidad: { type: S.STRING },
        salario: { type: S.STRING },
        descripcion: { type: S.STRING },
      },
      required: ["titulo", "empresa", "descripcion"],
    },
  },
  required: ["asunto", "contacto", "mensajes", "contieneOferta", "ofertaDetectada"],
};

const esquemaHilo = {
  type: S.OBJECT,
  properties: {
    respuesta: { type: S.STRING },
    asunto: { type: S.STRING },
    variantes: listaTexto,
    pendientes: listaTexto,
    preguntasSinResponder: listaTexto,
    incoherencias: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          afirmacion: { type: S.STRING },
          problema: { type: S.STRING },
          comoCorregir: { type: S.STRING },
        },
        required: ["afirmacion", "problema", "comoCorregir"],
      },
    },
    avisos: listaTexto,
  },
  required: [
    "respuesta",
    "asunto",
    "variantes",
    "pendientes",
    "preguntasSinResponder",
    "incoherencias",
    "avisos",
  ],
};

export interface ConversacionParseada {
  asunto: string;
  contacto: { nombre: string; cargo?: string; empresa?: string; handle?: string };
  mensajes: { de: "ellos" | "yo"; texto: string; fecha: string }[];
  contieneOferta: boolean;
  ofertaDetectada: VacanteParseada & {
    ubicacion?: string;
    modalidad?: string;
    salario?: string;
  };
}

export interface RespuestaHilo {
  respuesta: string;
  asunto: string;
  variantes: string[];
  pendientes: string[];
  preguntasSinResponder: string[];
  incoherencias: Incoherencia[];
  avisos: string[];
}

export function parsearConversacion(
  apiKey: string,
  modelo: string,
  textoCrudo: string,
  canal: string
) {
  return generarJSON<ConversacionParseada>(
    apiKey,
    modelo,
    promptParsearConversacion(textoCrudo, canal),
    esquemaConversacion
  );
}

export function redactarEnHilo(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  conversacion: Conversacion,
  vacante: Vacante | undefined,
  instrucciones: string,
  idioma: Idioma,
  tono: string
) {
  const contacto = [
    conversacion.contacto.nombre,
    conversacion.contacto.cargo,
    conversacion.contacto.empresa,
  ]
    .filter(Boolean)
    .join(" — ");
  return generarJSON<RespuestaHilo>(
    apiKey,
    modelo,
    promptHilo(
      perfil,
      conversacion.canal,
      contacto || "Reclutador",
      // Los borradores sin enviar no son parte del hilo real.
      conversacion.mensajes
        .filter((m) => !m.borrador)
        .map((m) => ({ de: m.de, texto: m.texto, fecha: m.fecha })),
      vacante,
      instrucciones,
      idioma,
      tono,
      // El material del reclutador se junta de los dos sitios donde puede
      // estar: el hilo y la ficha de la vacante. Sin esto el motor ignoraba
      // el PDF que acababan de mandar y había que pegarle a mano lo que decía.
      [...conversacion.adjuntos, ...(vacante?.adjuntos ?? [])]
    ),
    esquemaHilo
  );
}

// ------------------------------------------------- carta y entrevista

const esquemaCarta = {
  type: S.OBJECT,
  properties: {
    asuntoEmail: { type: S.STRING },
    carta: { type: S.STRING },
    mensajeReclutador: { type: S.STRING },
    avisos: listaTexto,
  },
  required: ["asuntoEmail", "carta", "mensajeReclutador", "avisos"],
};

const esquemaEntrevista = {
  type: S.OBJECT,
  properties: {
    estrategia: { type: S.STRING },
    datosAMemorizar: listaTexto,
    preguntas: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          pregunta: { type: S.STRING },
          porQue: { type: S.STRING },
          respuesta: { type: S.STRING },
          evitar: { type: S.STRING },
        },
        required: ["pregunta", "porQue", "respuesta", "evitar"],
      },
    },
    preguntasIncomodas: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          pregunta: { type: S.STRING },
          respuesta: { type: S.STRING },
          porQueDuele: { type: S.STRING },
        },
        required: ["pregunta", "respuesta", "porQueDuele"],
      },
    },
    tuTurno: listaTexto,
    cierre: { type: S.STRING },
    avisos: listaTexto,
  },
  required: [
    "estrategia",
    "datosAMemorizar",
    "preguntas",
    "preguntasIncomodas",
    "tuTurno",
    "cierre",
    "avisos",
  ],
};

export interface CartaGenerada {
  asuntoEmail: string;
  carta: string;
  mensajeReclutador: string;
  avisos: string[];
}

export interface GuionEntrevista {
  estrategia: string;
  datosAMemorizar: string[];
  preguntas: {
    pregunta: string;
    porQue: string;
    respuesta: string;
    evitar: string;
  }[];
  preguntasIncomodas: {
    pregunta: string;
    respuesta: string;
    porQueDuele: string;
  }[];
  tuTurno: string[];
  cierre: string;
  avisos: string[];
}

export function generarCarta(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  vacante: Vacante,
  idioma: Idioma,
  tono: string
) {
  return generarJSON<CartaGenerada>(
    apiKey,
    modelo,
    promptCarta(perfil, vacante, idioma, tono),
    esquemaCarta
  );
}

export function prepararEntrevista(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  vacante: Vacante,
  idioma: Idioma
) {
  return generarJSON<GuionEntrevista>(
    apiKey,
    modelo,
    promptEntrevista(perfil, vacante, idioma),
    esquemaEntrevista
  );
}

/**
 * Comprobación en vivo de la clave. Devuelve un diagnóstico legible en vez de
 * un booleano: con la restricción geográfica de Gemini, saber POR QUÉ falla es
 * la diferencia entre arreglarlo en un minuto o pelearse una tarde.
 */
export async function probarClave(
  apiKey: string,
  modelo: string
): Promise<{ ok: boolean; mensaje: string }> {
  if (!apiKey.trim())
    return { ok: false, mensaje: "No has pegado ninguna clave todavía." };
  try {
    const r = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        modelo,
        prompt: 'Responde exactamente {"ok":true}',
        schema: {
          type: Type.OBJECT,
          properties: { ok: { type: Type.BOOLEAN } },
          required: ["ok"],
        },
      }),
    });
    const d = await r.json().catch(() => null);
    if (r.ok && d?.texto)
      return { ok: true, mensaje: `Responde correctamente con ${modelo}.` };
    return { ok: false, mensaje: traducirError(new Error(d?.error ?? `HTTP ${r.status}`)).message };
  } catch (e) {
    return {
      ok: false,
      mensaje: e instanceof Error ? e.message : "No se pudo contactar con el servidor.",
    };
  }
}

const esquemaReunion = {
  type: S.OBJECT,
  properties: {
    titulo: { type: S.STRING },
    resumen: { type: S.STRING },
    puntosClave: listaTexto,
    datosDelPuesto: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: { concepto: { type: S.STRING }, valor: { type: S.STRING } },
        required: ["concepto", "valor"],
      },
    },
    preguntasQueMeHicieron: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          pregunta: { type: S.STRING },
          comoRespondi: { type: S.STRING },
          mejorRespuesta: { type: S.STRING },
        },
        required: ["pregunta", "comoRespondi", "mejorRespuesta"],
      },
    },
    compromisosMios: listaTexto,
    compromisosDeEllos: listaTexto,
    preguntasSinResponder: listaTexto,
    senalesBuenas: listaTexto,
    senalesDeAlerta: listaTexto,
    incoherencias: {
      type: S.ARRAY,
      items: {
        type: S.OBJECT,
        properties: {
          afirmacion: { type: S.STRING },
          problema: { type: S.STRING },
          comoCorregir: { type: S.STRING },
        },
        required: ["afirmacion", "problema", "comoCorregir"],
      },
    },
    aReforzar: listaTexto,
    proximoPaso: { type: S.STRING },
    seguimiento: { type: S.STRING },
  },
  required: [
    "titulo",
    "resumen",
    "puntosClave",
    "datosDelPuesto",
    "preguntasQueMeHicieron",
    "compromisosMios",
    "compromisosDeEllos",
    "preguntasSinResponder",
    "senalesBuenas",
    "senalesDeAlerta",
    "incoherencias",
    "aReforzar",
    "proximoPaso",
    "seguimiento",
  ],
};

const esquemaDocumento = {
  type: Type.OBJECT,
  properties: {
    clase: {
      type: Type.STRING,
      enum: [
        "descripcion_puesto",
        "contrato",
        "propuesta_economica",
        "prueba_tecnica",
        "confidencialidad",
        "otro",
      ],
    },
    titulo: { type: Type.STRING },
    resumen: { type: Type.STRING },
    puntosClave: { type: Type.ARRAY, items: { type: Type.STRING } },
    cifras: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          concepto: { type: Type.STRING },
          valor: { type: Type.STRING },
        },
        required: ["concepto", "valor"],
      },
    },
    alertas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          asunto: { type: Type.STRING },
          porque: { type: Type.STRING },
          queHacer: { type: Type.STRING },
        },
        required: ["asunto", "porque", "queHacer"],
      },
    },
    encaje: { type: Type.STRING },
    huecos: { type: Type.ARRAY, items: { type: Type.STRING } },
    preguntasQueHacer: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    "clase",
    "titulo",
    "resumen",
    "puntosClave",
    "cifras",
    "alertas",
    "encaje",
    "huecos",
    "preguntasQueHacer",
  ],
};

/**
 * Convierte los apuntes de una reunión en un resumen utilizable.
 *
 * Usa el modelo de generación, no el de análisis: el resumen incluye el mensaje
 * de seguimiento y las respuestas reescritas, que son redacción.
 */
export async function resumirReunion(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  vacante: Vacante,
  reunion: Reunion,
  idioma: Idioma
): Promise<ResumenReunion> {
  const bruto = await generarJSON<Omit<ResumenReunion, "generadoEn" | "modelo">>(
    apiKey,
    modelo,
    promptReunion(perfil, vacante, reunion, idioma),
    esquemaReunion
  );
  return { ...bruto, generadoEn: new Date().toISOString(), modelo };
}

/**
 * Analiza un documento que manda el reclutador. Los PDFs e imágenes viajan
 * como `inlineData` y los lee Gemini directamente, así que un contrato
 * escaneado también funciona. El .docx y el texto plano llegan ya extraídos
 * desde el navegador.
 */
export async function analizarDocumento(
  apiKey: string,
  modelo: string,
  perfil: PerfilMaestro,
  nombreArchivo: string,
  contexto: string,
  fuente: { via: "inline"; mimeType: string; datos: string } | { via: "texto"; texto: string }
): Promise<AnalisisDocumento> {
  const bruto = await generarJSON<Omit<AnalisisDocumento, "generadoEn" | "modelo">>(
    apiKey,
    modelo,
    promptDocumento(
      perfil,
      nombreArchivo,
      contexto,
      fuente.via === "texto" ? fuente.texto : undefined
    ),
    esquemaDocumento,
    fuente.via === "inline"
      ? [{ mimeType: fuente.mimeType, datos: fuente.datos }]
      : undefined
  );
  return { ...bruto, generadoEn: new Date().toISOString(), modelo };
}
