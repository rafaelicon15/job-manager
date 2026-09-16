import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anualizar,
  avisosDeOferta,
  comparar,
  diasParaDecidir,
  formatearDinero,
} from "../lib/ofertas";
import { crearIcs, nombreIcs } from "../lib/ics";
import type { OfertaRecibida } from "../lib/types";

/**
 * El comparador de ofertas y la exportación al calendario.
 *
 * La prueba que más vale de este archivo es la de las catorce pagas: olvidarlas
 * infla una oferta española un diecisiete por ciento, y ese error se comete una
 * sola vez y se paga un año entero.
 */

function oferta(parcial: Partial<OfertaRecibida> = {}): OfertaRecibida {
  return {
    base: 1800,
    moneda: "USD",
    periodo: "mes",
    recibidaEn: "2026-09-01T00:00:00.000Z",
    ...parcial,
  };
}

// ------------------------------------------------------------- anualizar

test("un sueldo mensual se anualiza a doce pagas por defecto", () => {
  assert.equal(anualizar(oferta({ base: 1800, periodo: "mes" })), 21600);
});

test("las catorce pagas cuentan: sin ellas la oferta parece un 17% menor", () => {
  assert.equal(anualizar(oferta({ base: 2000, periodo: "mes", pagas: 14 })), 28000);
});

test("un sueldo anual se queda como está", () => {
  assert.equal(anualizar(oferta({ base: 32000, periodo: "anio" })), 32000);
});

test("una tarifa por hora se anualiza a jornada completa", () => {
  assert.equal(anualizar(oferta({ base: 25, periodo: "hora" })), 25 * 2080);
});

test("cero pagas no borra el sueldo", () => {
  // Un campo vacío que llega como 0 no puede convertir 1.800 al mes en nada.
  assert.equal(anualizar(oferta({ base: 1800, periodo: "mes", pagas: 0 })), 21600);
});

// -------------------------------------------------------------- comparar

test("convierte a la moneda base con la tasa que pusiste", () => {
  const c = comparar(oferta({ base: 2000, periodo: "mes", moneda: "EUR" }), "USD", { EUR: 1.1 });
  assert.equal(c.convertida, true);
  assert.equal(Math.round(c.fijoAnual), 26400);
  assert.equal(c.moneda, "USD");
});

test("la misma moneda no necesita tasa", () => {
  const c = comparar(oferta(), "USD", {});
  assert.equal(c.convertida, true);
  assert.equal(c.fijoAnual, 21600);
});

test("sin tasa se marca como no comparable en vez de inventarse un 1 a 1", () => {
  // Tratar 32.000 EUR como 32.000 USD es un error del 10% disfrazado de dato.
  const c = comparar(oferta({ moneda: "EUR" }), "USD", {});
  assert.equal(c.convertida, false);
  assert.equal(c.moneda, "EUR");
});

test("el variable entra en el total pero se ve aparte", () => {
  const c = comparar(oferta({ base: 1800, variable: 5000 }), "USD", {});
  assert.equal(c.fijoAnual, 21600);
  assert.equal(c.variableAnual, 5000);
  assert.equal(c.totalAnual, 26600);
});

test("la moneda se reconoce en minúsculas", () => {
  const c = comparar(oferta({ moneda: "eur" }), "usd", { EUR: 1.1 });
  assert.equal(c.convertida, true);
});

// ---------------------------------------------------------------- avisos

test("avisa cuando el total no llega a tu mínimo", () => {
  const o = oferta({ base: 1000 });
  const a = avisosDeOferta(o, comparar(o, "USD", {}), 24000);
  assert.ok(a.some((t) => /por debajo del mínimo/.test(t)));
});

test("avisa cuando solo llegas al mínimo contando el variable", () => {
  const o = oferta({ base: 1800, variable: 6000 });
  const a = avisosDeOferta(o, comparar(o, "USD", {}), 24000);
  assert.ok(a.some((t) => /El variable no siempre se cobra/.test(t)));
});

test("avisa cuando el variable pesa demasiado", () => {
  const o = oferta({ base: 1000, variable: 9000 });
  const a = avisosDeOferta(o, comparar(o, "USD", {}), null);
  assert.ok(a.some((t) => /% del total/.test(t) && /por escrito/.test(t)));
});

test("avisa del plazo que se acaba", () => {
  const o = oferta({ fechaLimite: "2026-09-16" });
  const a = avisosDeOferta(o, comparar(o, "USD", {}), null);
  assert.ok(a.some((t) => /para contestar/.test(t)));
});

test("una oferta holgada y sin trampas no genera avisos", () => {
  // Inventar una alarma para rellenar es tan malo aquí como en los resúmenes.
  const o = oferta({ base: 3000, vacaciones: 23 });
  assert.deepEqual(avisosDeOferta(o, comparar(o, "USD", {}), 24000), []);
});

test("avisa de que falta la tasa antes que de nada más", () => {
  const o = oferta({ moneda: "EUR" });
  const a = avisosDeOferta(o, comparar(o, "USD", {}), 24000);
  assert.match(a[0], /Falta la tasa de cambio de EUR/);
});

test("los días para decidir se cuentan hasta el final del día", () => {
  const ahora = new Date("2026-09-15T12:00:00.000Z");
  assert.equal(diasParaDecidir("2026-09-15", ahora), 1);
  assert.equal(diasParaDecidir("2026-09-20", ahora), 6);
  assert.ok((diasParaDecidir("2026-09-10", ahora) ?? 0) < 0);
  assert.equal(diasParaDecidir("", ahora), null);
});

test("una moneda desconocida se formatea igual, sin tumbar la tabla", () => {
  // En español los números de cuatro cifras no llevan separador de millar,
  // así que la comprobación usa uno de cinco.
  assert.match(formatearDinero(21600, "XYZ"), /21\.600/);
  assert.match(formatearDinero(21600, "USD"), /21\.600/);
});

test("un código de moneda con letras de más no lanza", () => {
  assert.doesNotThrow(() => formatearDinero(1000, "DOLARES"));
});

// ------------------------------------------------------------------- ics

const AHORA = new Date("2026-09-15T12:00:00.000Z");

test("un evento con hora sale con inicio y fin en UTC", () => {
  const ics = crearIcs(
    { titulo: "Entrevista técnica", inicio: "2026-09-20T15:00:00.000Z", duracionMin: 60 },
    AHORA
  );
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20260920T150000Z/);
  assert.match(ics, /DTEND:20260920T160000Z/);
  assert.match(ics, /SUMMARY:Entrevista técnica/);
});

test("solo con fecha sale como evento de día completo", () => {
  // Un seguimiento se apunta "el martes", no "el martes a las 9:03".
  const ics = crearIcs({ titulo: "Dar un toque", inicio: "2026-09-22" }, AHORA);
  assert.match(ics, /DTSTART;VALUE=DATE:20260922/);
  assert.match(ics, /DTEND;VALUE=DATE:20260923/);
});

test("las comas y los saltos se escapan, o el archivo se rompe", () => {
  const ics = crearIcs(
    { titulo: "Reunión", inicio: "2026-09-22", descripcion: "Traer: CV, portafolio\ny el plan" },
    AHORA
  );
  assert.match(ics, /DESCRIPTION:Traer: CV\\, portafolio\\ny el plan/);
});

test("las líneas largas se pliegan a 75 octetos", () => {
  // Sin plegar, Outlook rechaza el archivo sin decir por qué.
  const ics = crearIcs(
    { titulo: "Reunión", inicio: "2026-09-22", descripcion: "á".repeat(120) },
    AHORA
  );
  for (const linea of ics.split("\r\n"))
    assert.ok(
      new TextEncoder().encode(linea).length <= 75,
      `línea de ${new TextEncoder().encode(linea).length} octetos: ${linea.slice(0, 40)}`
    );
  assert.match(ics, /\r\n /, "las continuaciones llevan un espacio delante");
});

test("el aviso se traduce a un VALARM", () => {
  const ics = crearIcs(
    { titulo: "Entrevista", inicio: "2026-09-20T15:00:00.000Z", avisoMin: 30 },
    AHORA
  );
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /TRIGGER:-PT30M/);
});

test("sin aviso no se mete un VALARM vacío", () => {
  const ics = crearIcs({ titulo: "Entrevista", inicio: "2026-09-20T15:00:00.000Z" }, AHORA);
  assert.ok(!ics.includes("VALARM"));
});

test("todas las líneas acaban en CRLF", () => {
  const ics = crearIcs({ titulo: "Entrevista", inicio: "2026-09-22" }, AHORA);
  assert.ok(ics.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "no puede haber un salto suelto sin retorno");
});

test("una fecha imposible se rechaza en lugar de generar basura", () => {
  assert.throws(() => crearIcs({ titulo: "x", inicio: "el martes" }, AHORA), /No entiendo la fecha/);
});

test("el nombre del archivo pierde acentos y caracteres raros", () => {
  assert.equal(nombreIcs("Entrevista técnica: Empresa/Ejemplo"), "Entrevista-tecnica-Empresa-Ejemplo.ics");
  assert.equal(nombreIcs("¿?¡!"), "evento.ics");
});
