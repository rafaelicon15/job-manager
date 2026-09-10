"use client";

import { jsPDF } from "jspdf";
import type { CVGenerado } from "./gemini";
import type { PerfilMaestro } from "./types";

/**
 * Genera un PDF pensado para atravesar filtros ATS:
 *  - Una sola columna, sin tablas, sin cajas de texto, sin imágenes.
 *  - Fuente estándar (Helvetica) con capa de texto real y seleccionable.
 *  - Sin encabezados ni pies de página (los ATS suelen ignorar esas zonas).
 *  - Secciones con nombres canónicos que los parsers reconocen.
 */

const MARGEN = 46; // ~16 mm
const ANCHO = 595.28; // A4 en puntos
const ALTO = 841.89;
const ANCHO_UTIL = ANCHO - MARGEN * 2;

interface Ctx {
  doc: jsPDF;
  y: number;
}

function nuevaPaginaSiHaceFalta(ctx: Ctx, alturaNecesaria: number) {
  if (ctx.y + alturaNecesaria > ALTO - MARGEN) {
    ctx.doc.addPage();
    ctx.y = MARGEN;
  }
}

function escribir(
  ctx: Ctx,
  texto: string,
  opciones: {
    tam?: number;
    estilo?: "normal" | "bold" | "italic";
    espacioAntes?: number;
    espacioDespues?: number;
    interlineado?: number;
    sangria?: number;
    /** Evita que el bloque se parta entre dos páginas. */
    mantenerJunto?: boolean;
  } = {}
) {
  const {
    tam = 10,
    estilo = "normal",
    espacioAntes = 0,
    espacioDespues = 0,
    interlineado = 1.32,
    sangria = 0,
  } = opciones;

  ctx.doc.setFont("helvetica", estilo);
  ctx.doc.setFontSize(tam);
  const ancho = ANCHO_UTIL - sangria;
  const lineas = ctx.doc.splitTextToSize(texto, ancho) as string[];
  const altoLinea = tam * interlineado;

  ctx.y += espacioAntes;
  // Un bullet partido a mitad de frase entre dos páginas se lee como
  // descuido, así que el bloque salta entero a la página siguiente.
  if (opciones.mantenerJunto) {
    nuevaPaginaSiHaceFalta(ctx, lineas.length * altoLinea);
  }
  for (const linea of lineas) {
    nuevaPaginaSiHaceFalta(ctx, altoLinea);
    ctx.doc.text(linea, MARGEN + sangria, ctx.y);
    ctx.y += altoLinea;
  }
  ctx.y += espacioDespues;
}

function seccion(ctx: Ctx, titulo: string) {
  nuevaPaginaSiHaceFalta(ctx, 34);
  ctx.y += 10;
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.text(titulo.toUpperCase(), MARGEN, ctx.y);
  ctx.y += 5;
  ctx.doc.setDrawColor(120);
  ctx.doc.setLineWidth(0.6);
  ctx.doc.line(MARGEN, ctx.y, ANCHO - MARGEN, ctx.y);
  ctx.y += 11;
}

export function construirCVPDF(
  cv: CVGenerado,
  perfil: PerfilMaestro,
  idioma: "es" | "en"
): jsPDF {
  const t =
    idioma === "en"
      ? {
          resumen: "Professional Summary",
          experiencia: "Professional Experience",
          habilidades: "Skills",
          certificaciones: "Certifications",
          educacion: "Education",
          idiomas: "Languages",
        }
      : {
          resumen: "Resumen Profesional",
          experiencia: "Experiencia Profesional",
          habilidades: "Habilidades",
          certificaciones: "Certificaciones",
          educacion: "Educación",
          idiomas: "Idiomas",
        };

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({
    title: `${perfil.nombre} - CV`,
    author: perfil.nombre,
    subject: cv.titular,
  });
  const ctx: Ctx = { doc, y: MARGEN + 6 };

  // Cabecera: nombre, titular y datos de contacto en texto plano.
  // Los ATS parsean mejor el contacto en líneas separadas por " | ".
  escribir(ctx, perfil.nombre.toUpperCase(), { tam: 19, estilo: "bold", espacioDespues: 2 });
  escribir(ctx, cv.titular, { tam: 10.5, estilo: "bold", espacioDespues: 3 });
  escribir(
    ctx,
    [perfil.email, perfil.telefono, perfil.ubicacion].filter(Boolean).join("  |  "),
    { tam: 9.5, espacioDespues: 1 }
  );
  const enlaces = perfil.links
    .filter((l) => ["Portafolio", "LinkedIn", "Sitio web"].includes(l.etiqueta))
    .map((l) => l.url.replace(/^https?:\/\//, ""));
  if (enlaces.length) escribir(ctx, enlaces.join("  |  "), { tam: 9.5 });

  seccion(ctx, t.resumen);
  escribir(ctx, cv.resumen, { tam: 10 });

  seccion(ctx, t.experiencia);
  cv.experiencias.forEach((exp, i) => {
    if (i > 0) ctx.y += 7;
    nuevaPaginaSiHaceFalta(ctx, 46);
    escribir(ctx, exp.puesto, { tam: 10.8, estilo: "bold" });
    const linea2 = [exp.empresa, exp.ubicacion, exp.periodo]
      .filter(Boolean)
      .join(" | ");
    escribir(ctx, linea2, { tam: 9.6, estilo: "italic", espacioDespues: 3 });
    for (const b of exp.bullets) {
      escribir(ctx, `•  ${b.texto}`, {
        tam: 10,
        sangria: 10,
        espacioDespues: 1.5,
        mantenerJunto: true,
      });
    }
  });

  if (cv.habilidades.length) {
    seccion(ctx, t.habilidades);
    for (const g of cv.habilidades) {
      escribir(ctx, `${g.categoria}: ${g.items.join(", ")}`, {
        tam: 10,
        espacioDespues: 2.5,
        mantenerJunto: true,
      });
    }
  }

  if (cv.certificaciones.length) {
    seccion(ctx, t.certificaciones);
    for (const c of cv.certificaciones) {
      escribir(ctx, `•  ${c}`, {
        tam: 10,
        sangria: 10,
        espacioDespues: 1,
        mantenerJunto: true,
      });
    }
  }

  if (cv.educacion.length) {
    seccion(ctx, t.educacion);
    for (const e of cv.educacion) {
      escribir(ctx, `•  ${e}`, {
        tam: 10,
        sangria: 10,
        espacioDespues: 1,
        mantenerJunto: true,
      });
    }
  }

  if (cv.idiomas.length) {
    seccion(ctx, t.idiomas);
    escribir(ctx, cv.idiomas.join("  |  "), { tam: 10 });
  }

  return doc;
}

function nombreArchivo(perfil: PerfilMaestro, empresa: string, idioma: string) {
  // ̀-ͯ = marcas diacríticas combinantes que deja NFD al separar tildes.
  const DIACRITICOS = /[̀-ͯ]/g;
  const limpio = (s: string) =>
    s
      .normalize("NFD")
      .replace(DIACRITICOS, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return `CV_${limpio(perfil.nombre)}_${limpio(empresa)}_${idioma.toUpperCase()}.pdf`;
}

export function descargarCVPDF(
  cv: CVGenerado,
  perfil: PerfilMaestro,
  empresa: string,
  idioma: "es" | "en"
) {
  const doc = construirCVPDF(cv, perfil, idioma);
  doc.save(nombreArchivo(perfil, empresa, idioma));
}

/** URL de datos para la vista previa embebida, sin descargar nada. */
export function previsualizarCVPDF(
  cv: CVGenerado,
  perfil: PerfilMaestro,
  idioma: "es" | "en"
): string {
  return construirCVPDF(cv, perfil, idioma).output("datauristring");
}

/** Texto plano del CV, tal como lo "vería" un ATS que extrae el contenido. */
export function cvComoTextoPlano(cv: CVGenerado, perfil: PerfilMaestro): string {
  const partes: string[] = [
    perfil.nombre,
    cv.titular,
    [perfil.email, perfil.telefono, perfil.ubicacion].join(" | "),
    "",
    cv.resumen,
    "",
  ];
  for (const e of cv.experiencias) {
    partes.push(`${e.puesto} — ${e.empresa} (${e.periodo})`);
    for (const b of e.bullets) partes.push(`• ${b.texto}`);
    partes.push("");
  }
  for (const g of cv.habilidades) partes.push(`${g.categoria}: ${g.items.join(", ")}`);
  if (cv.certificaciones.length) partes.push("", ...cv.certificaciones.map((c) => `• ${c}`));
  if (cv.educacion.length) partes.push("", ...cv.educacion.map((e) => `• ${e}`));
  if (cv.idiomas.length) partes.push("", cv.idiomas.join(" | "));
  return partes.join("\n");
}
