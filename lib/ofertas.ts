import type { OfertaRecibida, Periodo } from "./types";

/**
 * Pone dos ofertas en la misma unidad para poder compararlas.
 *
 * El momento en que esto hace falta es el peor posible: dos ofertas encima de
 * la mesa, dos días para contestar y las cifras en monedas y periodos
 * distintos. "1.800 USD al mes" contra "32.000 EUR en catorce pagas" no se
 * comparan de cabeza, y decidir mal una vez cuesta un año.
 *
 * Las tasas de cambio las pone el usuario a mano, a propósito. Una API de
 * divisas sería otra dependencia que se cae, y para una decisión que tomas hoy
 * la tasa que tú fijas hoy es más honesta que una que se mueve sola mientras
 * miras la tabla.
 */

/** Horas al año de una jornada completa: 40 por semana, 52 semanas. */
const HORAS_ANUALES = 2080;

export interface OfertaComparada {
  /** Total anual en la moneda base, base más variable. */
  totalAnual: number;
  /** Solo el fijo anualizado, en la moneda base. */
  fijoAnual: number;
  variableAnual: number;
  /** false cuando falta la tasa de esa moneda y el total no es comparable. */
  convertida: boolean;
  moneda: string;
}

export function anualizar(o: OfertaRecibida): number {
  const base = Number(o.base) || 0;
  const porPeriodo: Record<Periodo, number> = {
    anio: base,
    // Las pagas extra de España no son dinero de más: son el mismo año
    // repartido en más trozos, y olvidarlas infla la oferta un 17%.
    mes: base * (o.pagas && o.pagas > 0 ? o.pagas : 12),
    hora: base * HORAS_ANUALES,
  };
  return porPeriodo[o.periodo] ?? base;
}

export function comparar(
  o: OfertaRecibida,
  monedaBase: string,
  tasas: Record<string, number> = {}
): OfertaComparada {
  const misma = o.moneda.toUpperCase() === monedaBase.toUpperCase();
  const tasa = misma ? 1 : tasas[o.moneda.toUpperCase()];
  const convertida = typeof tasa === "number" && tasa > 0;
  const factor = convertida ? tasa : 1;

  const fijoAnual = anualizar(o) * factor;
  const variableAnual = (Number(o.variable) || 0) * factor;

  return {
    fijoAnual,
    variableAnual,
    totalAnual: fijoAnual + variableAnual,
    convertida,
    moneda: convertida ? monedaBase.toUpperCase() : o.moneda.toUpperCase(),
  };
}

export function formatearDinero(valor: number, moneda: string): string {
  try {
    return new Intl.NumberFormat("es", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 0,
    }).format(valor);
  } catch {
    // Una moneda que Intl no conoce no debe tumbar la tabla entera.
    return `${Math.round(valor).toLocaleString("es")} ${moneda}`;
  }
}

/** Días que quedan para contestar. Negativo si ya se pasó el plazo. */
export function diasParaDecidir(fechaLimite: string, ahora = new Date()): number | null {
  if (!fechaLimite) return null;
  const t = new Date(`${fechaLimite}T23:59:59`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - ahora.getTime()) / 86400000);
}

/**
 * Lo que hay que mirar antes de firmar, calculado sin IA.
 *
 * Son comprobaciones aritméticas contra lo que tú mismo pusiste en el perfil.
 * No sustituyen al guion de negociación, avisan de lo que salta a la vista y se
 * pasa por alto con la emoción de tener una oferta delante.
 */
export function avisosDeOferta(
  o: OfertaRecibida,
  comparada: OfertaComparada,
  salarioMinAnual: number | null
): string[] {
  const avisos: string[] = [];

  if (!comparada.convertida)
    avisos.push(
      `Falta la tasa de cambio de ${o.moneda.toUpperCase()}, así que esta oferta no entra en la comparación. Ponla arriba.`
    );

  if (salarioMinAnual && comparada.convertida) {
    if (comparada.totalAnual < salarioMinAnual)
      avisos.push(
        "El total está por debajo del mínimo que fijaste en tu perfil. Si la aceptas, que sea por una razón que puedas nombrar."
      );
    else if (comparada.fijoAnual < salarioMinAnual)
      avisos.push(
        "El fijo solo llega a tu mínimo contando el variable. El variable no siempre se cobra: negocia subiendo el fijo."
      );
  }

  if (o.variable && comparada.fijoAnual > 0) {
    const peso = (comparada.variableAnual / (comparada.fijoAnual + comparada.variableAnual)) * 100;
    if (peso >= 30)
      avisos.push(
        `El variable es el ${Math.round(peso)}% del total. Antes de aceptar, pide por escrito de qué depende y qué porcentaje del equipo lo cobró entero el año pasado.`
      );
  }

  const plazo = diasParaDecidir(o.fechaLimite ?? "");
  if (plazo !== null && plazo <= 2)
    avisos.push(
      plazo < 0
        ? "El plazo para contestar ya pasó."
        : `Te quedan ${plazo === 0 ? "horas" : `${plazo} ${plazo === 1 ? "día" : "días"}`} para contestar. Si necesitas más, pedirlo no es una falta de interés.`
    );

  if (o.vacaciones !== undefined && o.vacaciones > 0 && o.vacaciones < 20)
    avisos.push(
      `${o.vacaciones} días de vacaciones está por debajo de lo habitual. Cuenta si son naturales o laborables antes de comparar.`
    );

  return avisos;
}
