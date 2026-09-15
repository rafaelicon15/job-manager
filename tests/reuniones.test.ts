import { test } from "node:test";
import assert from "node:assert/strict";
import { participantesDe, resumenComoTexto, etiquetaDeTipo } from "../lib/reuniones";
import {
  historialReuniones,
  materialesComoTexto,
  promptEntrevista,
  promptReunion,
} from "../lib/prompts";
import type {
  MaterialReunion,
  PerfilMaestro,
  Reunion,
  ResumenReunion,
  Vacante,
} from "../lib/types";

/**
 * El apartado de reuniones guarda lo que se dice en una llamada y no queda
 * escrito en ningún sitio. Lo que estas pruebas protegen es que el resumen
 * nunca se invente un compromiso, y que el historial que se inyecta en los
 * demás prompts no arrastre la reunión que se está resumiendo ahora mismo.
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

function resumen(parcial: Partial<ResumenReunion> = {}): ResumenReunion {
  return {
    titulo: "Screening con RRHH",
    resumen: "Llamada de media hora para encuadrar el puesto.",
    puntosClave: [],
    datosDelPuesto: [],
    preguntasQueMeHicieron: [],
    compromisosMios: [],
    compromisosDeEllos: [],
    preguntasSinResponder: [],
    senalesBuenas: [],
    senalesDeAlerta: [],
    incoherencias: [],
    aReforzar: [],
    proximoPaso: "",
    seguimiento: "",
    generadoEn: "2026-09-01T10:00:00.000Z",
    modelo: "modelo-de-prueba",
    ...parcial,
  };
}

function reunion(parcial: Partial<Reunion> = {}): Reunion {
  return {
    id: "reu-1",
    tipo: "screening",
    fecha: "2026-09-01T10:00",
    canal: "Google Meet",
    participantes: [{ nombre: "Marta Ruiz", cargo: "Talent Partner" }],
    notasCrudas: "Preguntó por disponibilidad. Dije inmediata.",
    materiales: [],
    creadaEn: "2026-09-01T11:00:00.000Z",
    actualizadaEn: "2026-09-01T11:00:00.000Z",
    ...parcial,
  };
}

function vacante(reuniones: Reunion[] = []): Vacante {
  return {
    id: "vac-1",
    titulo: "Growth Manager",
    empresa: "Empresa Ejemplo",
    ubicacion: "Remoto",
    modalidad: "Remoto",
    fuente: "manual",
    descripcion: "Descripción de la oferta.",
    estado: "entrevista",
    favorito: false,
    creadaEn: "2026-08-01T10:00:00.000Z",
    actualizadaEn: "2026-08-01T10:00:00.000Z",
    documentos: [],
    reuniones,
    adjuntos: [],
    notas: [],
  };
}

// --------------------------------------------------------- participantes

test("el punto y coma separa a la gente y la coma su cargo", () => {
  // Al revés se parte "Head of Growth, EMEA" en dos personas.
  const p = participantesDe("Marta Ruiz, Talent Partner; Luis Gómez, Head of Growth, EMEA");
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], { nombre: "Marta Ruiz", cargo: "Talent Partner" });
  assert.deepEqual(p[1], { nombre: "Luis Gómez", cargo: "Head of Growth, EMEA" });
});

test("un nombre sin cargo no inventa uno vacío", () => {
  assert.deepEqual(participantesDe("Marta Ruiz"), [{ nombre: "Marta Ruiz" }]);
  assert.deepEqual(participantesDe("Marta Ruiz,"), [{ nombre: "Marta Ruiz" }]);
});

test("un campo vacío no produce participantes fantasma", () => {
  assert.deepEqual(participantesDe(""), []);
  assert.deepEqual(participantesDe("  ;  ; "), []);
});

// -------------------------------------------------------------- historial

test("sin reuniones resumidas el historial está vacío", () => {
  assert.equal(historialReuniones([]), "");
  assert.equal(
    historialReuniones([reunion()]),
    "",
    "una reunión sin resumir no aporta nada al contexto y ocupa mucho"
  );
});

test("el historial va en orden cronológico aunque la lista llegue del revés", () => {
  // En pantalla se ven las recientes primero; el modelo necesita ver cómo
  // avanzó el proceso.
  const texto = historialReuniones([
    reunion({
      id: "reu-2",
      fecha: "2026-09-10T10:00",
      tipo: "tecnica",
      resumen: resumen({ resumen: "Prueba técnica en vivo." }),
    }),
    reunion({
      id: "reu-1",
      fecha: "2026-09-01T10:00",
      resumen: resumen({ resumen: "Primer contacto con RRHH." }),
    }),
  ]);
  assert.ok(
    texto.indexOf("Primer contacto") < texto.indexOf("Prueba técnica en vivo"),
    "la reunión más antigua debe aparecer primero"
  );
  assert.match(texto, /REUNIONES YA CELEBRADAS EN ESTE PROCESO \(2\)/);
});

test("el historial arrastra los compromisos y lo que quedó sin respuesta", () => {
  const texto = historialReuniones([
    reunion({
      resumen: resumen({
        compromisosMios: ["Mandar el portafolio el martes"],
        compromisosDeEllos: ["Confirmar la segunda ronda esta semana"],
        preguntasSinResponder: ["Quién sería mi responsable"],
        senalesDeAlerta: ["El rango está por debajo de mi mínimo"],
        aReforzar: ["Preparar un caso de atribución"],
        datosDelPuesto: [{ concepto: "Rango", valor: "1.200 a 1.400 USD" }],
      }),
    }),
  ]);
  assert.match(texto, /Mandar el portafolio el martes/);
  assert.match(texto, /Confirmar la segunda ronda esta semana/);
  assert.match(texto, /Quién sería mi responsable/);
  assert.match(texto, /1\.200 a 1\.400 USD/);
  assert.match(texto, /Preparar un caso de atribución/);
  assert.match(texto, /no se resolvió|No vuelvas a plantear/);
});

test("una reunión sin participantes no rompe el historial", () => {
  const texto = historialReuniones([reunion({ participantes: [], resumen: resumen() })]);
  assert.match(texto, /sin registrar/);
});

// ----------------------------------------------------------- promptReunion

test("el prompt lleva los apuntes tal cual y las líneas rojas", () => {
  const r = reunion({ notasCrudas: "Mencionaron 1.300 USD y tres días de oficina." });
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.match(p, /Mencionaron 1\.300 USD y tres días de oficina\./);
  assert.match(p, /Nunca inventar empleadores ni fechas\./);
  assert.match(p, /NO uses guiones largos/, "las reglas de estilo van en todos los prompts");
  assert.match(p, /2\.000 USD/, "la expectativa salarial es lo que permite ver si el rango cojea");
});

test("el prompt NO se incluye a sí mismo en el historial", () => {
  // Si la reunión que se está resumiendo ya tenía un resumen (una regeneración),
  // meterla en su propio contexto hace que el modelo copie el resumen viejo en
  // lugar de volver a leer los apuntes.
  const r = reunion({ resumen: resumen({ resumen: "RESUMEN ANTERIOR DE ESTA MISMA" }) });
  const otra = reunion({
    id: "reu-0",
    fecha: "2026-08-20T10:00",
    resumen: resumen({ resumen: "Contacto inicial por LinkedIn" }),
  });
  const p = promptReunion(PERFIL, vacante([r, otra]), r, "es");
  assert.ok(!p.includes("RESUMEN ANTERIOR DE ESTA MISMA"));
  assert.match(p, /Contacto inicial por LinkedIn/);
});

test("el prompt prohíbe rellenar lo que no esté en los apuntes", () => {
  const r = reunion();
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.match(p, /no lo completes con lo que suele pasar/);
  assert.match(p, /inventa un compromiso es peor que no tener resumen/);
  assert.match(p, /no inventes alarmas para rellenar/);
});

test("el prompt pide el idioma que se le pase", () => {
  const r = reunion();
  assert.match(promptReunion(PERFIL, vacante([r]), r, "en"), /en inglés/);
  assert.match(promptReunion(PERFIL, vacante([r]), r, "es"), /en español/);
});

test("unos apuntes enormes se recortan en lugar de reventar la petición", () => {
  const r = reunion({ notasCrudas: "x".repeat(90000) });
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.ok(p.length < 75000, `el prompt se fue a ${p.length} caracteres`);
});

// -------------------------------------------------------------- a texto

test("el resumen en texto plano omite las secciones vacías", () => {
  const texto = resumenComoTexto(
    reunion(),
    resumen({ compromisosMios: ["Mandar el portafolio"], proximoPaso: "Esperan su respuesta" })
  );
  assert.match(texto, /PROMETÍ YO/);
  assert.match(texto, /- Mandar el portafolio/);
  assert.match(texto, /PRÓXIMO PASO/);
  assert.ok(!texto.includes("SEÑALES DE ALERTA"), "una lista vacía no merece un titular");
  assert.ok(!texto.includes("SEGUIMIENTO"));
});

test("el texto plano lleva la cabecera con quién estaba y por dónde", () => {
  const texto = resumenComoTexto(reunion({ duracionMin: 30 }), resumen());
  assert.match(texto, /Marta Ruiz, Talent Partner/);
  assert.match(texto, /Google Meet/);
  assert.match(texto, /30 min/);
});

test("cada tipo de reunión tiene una etiqueta legible", () => {
  assert.equal(etiquetaDeTipo("screening"), "Screening con RRHH");
  assert.equal(etiquetaDeTipo("tecnica"), "Entrevista técnica");
  // Un tipo guardado por una versión anterior no debe dejar la tarjeta en blanco.
  assert.equal(etiquetaDeTipo("inventado" as never), "Reunión");
});

// ------------------------------------------- lo que ve el guion de entrevista

test("el guion de la siguiente ronda parte de lo ya hablado", () => {
  // Sin esto, la segunda entrevista se prepara igual que la primera y el guion
  // vuelve a plantear lo que ya se resolvió en la llamada de screening.
  const previa = reunion({
    resumen: resumen({
      compromisosMios: ["Mandar el portafolio el martes"],
      aReforzar: ["Preparar un caso de atribución"],
    }),
  });
  const p = promptEntrevista(PERFIL, vacante([previa]), "es");
  assert.match(p, /REUNIONES YA CELEBRADAS EN ESTE PROCESO/);
  assert.match(p, /Mandar el portafolio el martes/);
  assert.match(p, /Preparar un caso de atribución/);
});

test("una vacante sin reuniones deja el guion igual que antes", () => {
  const p = promptEntrevista(PERFIL, vacante(), "es");
  assert.ok(!p.includes("REUNIONES YA CELEBRADAS"));
});

test("una vacante guardada antes de que existieran las reuniones no rompe nada", () => {
  // `reuniones` llega como undefined desde localStorage de una versión anterior.
  const v = { ...vacante(), reuniones: undefined } as unknown as Vacante;
  assert.doesNotThrow(() => promptEntrevista(PERFIL, v, "es"));
  assert.equal(historialReuniones(undefined), "");
});

// --------------------------------------------------- documentos colgados

function material(parcial: Partial<MaterialReunion> = {}): MaterialReunion {
  return {
    id: "mat-1",
    nombre: "propuesta.pdf",
    bytes: 120000,
    tipo: "application/pdf",
    markdown: "# Propuesta\n\nFijo: 1.800 USD mensuales.",
    palabras: 6,
    subidoEn: "2026-09-01T12:00:00.000Z",
    ...parcial,
  };
}

test("sin documentos el bloque de material no aparece", () => {
  assert.equal(materialesComoTexto([]), "");
  assert.equal(materialesComoTexto(), "");
});

test("el Markdown del documento entra en el prompt", () => {
  const r = reunion({ materiales: [material()] });
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.match(p, /DOCUMENTOS QUE MANDARON PARA ESTA REUNIÓN \(1\)/);
  assert.match(p, /propuesta\.pdf/);
  assert.match(p, /Fijo: 1\.800 USD mensuales\./);
});

test("el prompt distingue lo escrito por la empresa de los apuntes de él", () => {
  // Cuando el documento contradice los apuntes, manda el documento, y esa
  // contradicción es lo más interesante del resumen.
  const r = reunion({ materiales: [material()] });
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.match(p, /los ha escrito la empresa; los apuntes los ha escrito él/);
  assert.match(p, /manda el documento/);
});

test("un texto extraído de un PDF se marca como tal", () => {
  // El modelo debe saber que ese texto viene de una extracción y puede traer
  // costuras, en lugar de tratarlo como si lo hubiera tecleado alguien.
  const texto = materialesComoTexto([material({ extraido: true })]);
  assert.match(texto, /texto extraído de un PDF/);
});

test("lo que no se pudo convertir se anuncia como adjunto, sin cuerpo", () => {
  const texto = materialesComoTexto([
    material({ markdown: "", palabras: 0, sinConvertir: "Es un PDF escaneado." }),
  ]);
  assert.match(texto, /Va adjunto a esta petición/);
  assert.ok(!texto.includes('"""'), "no hay contenido que encerrar");
});

test("se puede resumir una reunión con documentos y sin apuntes", () => {
  // Llega la propuesta por correo y no hubo llamada que apuntar.
  const r = reunion({ notasCrudas: "", materiales: [material()] });
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.match(p, /trabaja solo con los documentos/);
  assert.match(p, /Fijo: 1\.800 USD mensuales\./);
});

test("el prompt pide señalar de qué archivo sale cada dato", () => {
  const r = reunion({ materiales: [material()] });
  const p = promptReunion(PERFIL, vacante([r]), r, "es");
  assert.match(p, /dilo entre paréntesis con el nombre del archivo/);
});

test("una reunión guardada antes de los documentos no rompe el prompt", () => {
  const r = { ...reunion(), materiales: undefined } as unknown as Reunion;
  assert.doesNotThrow(() => promptReunion(PERFIL, vacante([r]), r, "es"));
});
