import { TIPOS_REUNION, type Reunion, type ResumenReunion, type TipoReunion } from "./types";

export function etiquetaDeTipo(tipo: TipoReunion): string {
  return TIPOS_REUNION.find((t) => t.id === tipo)?.label ?? "Reunión";
}

export function fechaLegible(fecha: string): string {
  if (!fecha) return "sin fecha";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parte "Marta Ruiz, Talent Partner; Luis Gómez, Head of Growth" en personas.
 *
 * El punto y coma separa a la gente y la coma el cargo, no al revés: los cargos
 * llevan comas dentro con mucha más frecuencia que los nombres, así que usar la
 * coma como separador de personas partía "Head of Growth, EMEA" en dos.
 */
export function participantesDe(texto: string): { nombre: string; cargo?: string }[] {
  return texto
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const i = t.indexOf(",");
      const nombre = (i === -1 ? t : t.slice(0, i)).trim();
      const cargo = i === -1 ? "" : t.slice(i + 1).trim();
      return cargo ? { nombre, cargo } : { nombre };
    })
    .filter((p) => p.nombre);
}

/** Resumen en texto plano, para pegarlo en un correo o guardarlo aparte. */
export function resumenComoTexto(r: Reunion, x: ResumenReunion): string {
  const p: string[] = [
    `${x.titulo.toUpperCase()} — ${etiquetaDeTipo(r.tipo)}`,
    `${fechaLegible(r.fecha)}${r.canal ? ` · ${r.canal}` : ""}${r.duracionMin ? ` · ${r.duracionMin} min` : ""}`,
  ];
  if (r.participantes.length)
    p.push(
      `Con: ${r.participantes
        .map((q) => [q.nombre, q.cargo].filter(Boolean).join(", "))
        .join(" | ")}`
    );
  p.push("", x.resumen);

  const seccion = (titulo: string, lineas: string[]) => {
    if (!lineas.length) return;
    p.push("", titulo, ...lineas.map((l) => `- ${l}`));
  };

  seccion("LO QUE IMPORTA", x.puntosClave);
  seccion(
    "CONDICIONES QUE SALIERON",
    x.datosDelPuesto.map((d) => `${d.concepto}: ${d.valor}`)
  );
  seccion("PROMETÍ YO", x.compromisosMios);
  seccion("PROMETIERON ELLOS", x.compromisosDeEllos);
  seccion("SIGUE SIN RESPUESTA", x.preguntasSinResponder);
  seccion("SEÑALES DE ALERTA", x.senalesDeAlerta);
  seccion("VA BIEN", x.senalesBuenas);
  seccion(
    "INCOHERENCIAS CON MI PERFIL",
    x.incoherencias.map((i) => `${i.afirmacion} → ${i.problema} → ${i.comoCorregir}`)
  );
  seccion("A REFORZAR", x.aReforzar);

  if (x.preguntasQueMeHicieron.length) {
    p.push("", "LO QUE ME PREGUNTARON");
    for (const q of x.preguntasQueMeHicieron)
      p.push(
        "",
        `P: ${q.pregunta}`,
        `   Contesté: ${q.comoRespondi}`,
        `   Mejor: ${q.mejorRespuesta}`
      );
  }

  if (x.proximoPaso) p.push("", "PRÓXIMO PASO", x.proximoPaso);
  if (x.seguimiento) p.push("", "SEGUIMIENTO", x.seguimiento);
  return p.join("\n");
}
