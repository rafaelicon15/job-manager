import type { Vacante } from "./types";

/**
 * Diagnóstico del embudo: no cuántas, sino DÓNDE se rompe.
 *
 * "Tasa de respuesta: 12%" no le dice a nadie qué arreglar. Lo que cambia la
 * conducta es el corte: si de treinta envíos con encaje bajo sale una respuesta
 * y de nueve con encaje alto salen cinco, el problema no es el CV, es a qué te
 * postulas. Y si con encaje alto tampoco contestan, entonces sí es el CV o el
 * titular.
 *
 * Los veredictos se calculan aquí, sin IA. Son aritmética sobre tus propios
 * datos, y que salgan siempre iguales con las mismas cifras vale más que una
 * redacción bonita. Cada uno exige una muestra mínima: con cuatro envíos no hay
 * nada que concluir, y decir lo contrario sería inventar una tendencia.
 */

/** Por debajo de esto no se saca ninguna conclusión. */
export const MUESTRA_MINIMA = 8;

const ENVIADAS = ["postulada", "screening", "entrevista", "oferta", "rechazada"];
const RESPONDIDAS = ["screening", "entrevista", "oferta"];
const ENTREVISTADAS = ["entrevista", "oferta"];

export interface Corte {
  etiqueta: string;
  enviadas: number;
  respuestas: number;
  entrevistas: number;
  /** Porcentaje de respuesta, redondeado. */
  tasa: number;
}

export interface Diagnostico {
  global: Corte;
  porFuente: Corte[];
  porEncaje: Corte[];
  porAngulo: Corte[];
  /** Conclusiones en frases, solo las que la muestra sostiene. */
  veredictos: string[];
  /** Lo que falta para poder concluir algo. */
  avisos: string[];
}

function corte(etiqueta: string, vacantes: Vacante[]): Corte {
  const enviadas = vacantes.filter((v) => ENVIADAS.includes(v.estado)).length;
  const respuestas = vacantes.filter((v) => RESPONDIDAS.includes(v.estado)).length;
  const entrevistas = vacantes.filter((v) => ENTREVISTADAS.includes(v.estado)).length;
  return {
    etiqueta,
    enviadas,
    respuestas,
    entrevistas,
    tasa: enviadas ? Math.round((respuestas / enviadas) * 100) : 0,
  };
}

function agrupar(
  vacantes: Vacante[],
  clave: (v: Vacante) => string | undefined
): Corte[] {
  const grupos = new Map<string, Vacante[]>();
  for (const v of vacantes) {
    const k = (clave(v) ?? "").trim();
    if (!k) continue;
    const lista = grupos.get(k);
    if (lista) lista.push(v);
    else grupos.set(k, [v]);
  }
  return [...grupos.entries()]
    .map(([k, vs]) => corte(k, vs))
    .filter((c) => c.enviadas > 0)
    .sort((a, b) => b.enviadas - a.enviadas);
}

/** Tramos de encaje. El corte en 60 y 75 sale de los veredictos del analizador. */
function tramoEncaje(v: Vacante): string {
  const p = v.analisis?.puntaje;
  if (p === undefined) return "Sin analizar";
  if (p >= 75) return "Encaje alto (75+)";
  if (p >= 60) return "Encaje medio (60-74)";
  return "Encaje bajo (menos de 60)";
}

export function diagnosticar(vacantes: Vacante[]): Diagnostico {
  const global = corte("Todas", vacantes);
  const porFuente = agrupar(vacantes, (v) => v.fuente || "sin fuente");
  const porEncaje = agrupar(vacantes, tramoEncaje);
  const porAngulo = agrupar(vacantes, (v) => v.analisis?.anguloRecomendado);

  const veredictos: string[] = [];
  const avisos: string[] = [];

  const busca = (lista: Corte[], etiqueta: string) =>
    lista.find((c) => c.etiqueta === etiqueta);
  const alto = busca(porEncaje, "Encaje alto (75+)");
  const bajo = busca(porEncaje, "Encaje bajo (menos de 60)");
  const sinAnalizar = busca(porEncaje, "Sin analizar");

  if (global.enviadas < MUESTRA_MINIMA) {
    avisos.push(
      `Llevas ${global.enviadas} ${global.enviadas === 1 ? "postulación enviada" : "postulaciones enviadas"}. Con menos de ${MUESTRA_MINIMA} cualquier conclusión es ruido: sigue y vuelve por aquí.`
    );
    return { global, porFuente, porEncaje, porAngulo, veredictos, avisos };
  }

  // 1. ¿Estás gastando los envíos en lo que no encaja?
  if (bajo && bajo.enviadas >= MUESTRA_MINIMA) {
    const parte = Math.round((bajo.enviadas / global.enviadas) * 100);
    if (alto && alto.enviadas >= 3 && alto.tasa >= bajo.tasa * 2 + 10) {
      veredictos.push(
        `El ${parte}% de tus envíos va a ofertas con encaje bajo y ahí respondes al ${bajo.tasa}%, mientras que con encaje alto respondes al ${alto.tasa}%. El problema no es tu CV, es la selección: cada envío que quitas de abajo vale por varios.`
      );
    } else if (bajo.tasa === 0) {
      veredictos.push(
        `${bajo.enviadas} envíos a ofertas con encaje bajo y ninguna respuesta. Ese tramo no está produciendo nada: deja de gastarlo.`
      );
    }
  }

  // 2. ¿Falla el CV aunque encajes?
  if (alto && alto.enviadas >= MUESTRA_MINIMA && alto.tasa < 15) {
    veredictos.push(
      `Con encaje alto has enviado ${alto.enviadas} y solo responde el ${alto.tasa}%. Cuando el encaje es bueno y aun así no contestan, lo que falla está antes de la entrevista: el titular, el resumen o el CV que estás mandando.`
    );
  }

  // 3. ¿Hay una fuente que funciona y otra que no?
  const fuentesUtiles = porFuente.filter((f) => f.enviadas >= 5);
  if (fuentesUtiles.length >= 2) {
    const mejor = fuentesUtiles.reduce((a, b) => (b.tasa > a.tasa ? b : a));
    const peor = fuentesUtiles.reduce((a, b) => (b.tasa < a.tasa ? b : a));
    if (mejor.tasa >= peor.tasa * 2 + 10)
      veredictos.push(
        `Por ${mejor.etiqueta} te responden al ${mejor.tasa}% y por ${peor.etiqueta} al ${peor.tasa}%, con muestras parecidas. Mueve el tiempo de una a la otra.`
      );
  }

  // 4. ¿Un ángulo que vende mejor?
  const angulos = porAngulo.filter((a) => a.enviadas >= 5);
  if (angulos.length >= 2) {
    const mejor = angulos.reduce((a, b) => (b.tasa > a.tasa ? b : a));
    if (mejor.tasa >= global.tasa + 15)
      veredictos.push(
        `El ángulo "${mejor.etiqueta}" responde al ${mejor.tasa}% frente al ${global.tasa}% general. Es el que mejor te está vendiendo.`
      );
  }

  // 5. ¿Se cae el proceso después de la primera respuesta?
  if (global.respuestas >= 5 && global.entrevistas / global.respuestas < 0.34)
    veredictos.push(
      `De ${global.respuestas} respuestas solo ${global.entrevistas} han llegado a entrevista. Te abren la puerta y el proceso se cae en el screening: mira qué estás contestando en esa primera llamada.`
    );

  if (sinAnalizar && sinAnalizar.enviadas >= 5)
    avisos.push(
      `${sinAnalizar.enviadas} de tus envíos salieron sin analizar la vacante, así que quedan fuera del corte por encaje, que es el más útil de todos.`
    );

  if (!veredictos.length)
    avisos.push(
      "Ningún corte se separa lo bastante del resto como para sacar una conclusión honesta. Tus tasas son parecidas en todas partes."
    );

  return { global, porFuente, porEncaje, porAngulo, veredictos, avisos };
}
