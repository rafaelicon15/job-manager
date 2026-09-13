import type { Vacante } from "./types";

/**
 * Detección de vacantes repetidas.
 *
 * La misma oferta llega por varias vías: aparece en la búsqueda, se captura
 * con la extensión desde el portal, y se vuelve a capturar al abrir el
 * formulario de postulación. Sin esto, la lista de postulaciones acaba con la
 * misma oferta tres veces y el seguimiento deja de valer.
 *
 * Se compara por dos caminos independientes, y basta con que uno acierte:
 * la URL normalizada, o la pareja empresa + puesto.
 */

/** Parámetros de seguimiento que no identifican la oferta. */
const RASTREO =
  /^(utm_|fbclid|gclid|msclkid|ref|referer|referrer|source|src|trk|trackingid|origin|from|campaign|mc_|_ga)/i;

/**
 * Normaliza una URL para poder compararla. Quita el fragmento, el `www`, la
 * barra final y los parámetros de seguimiento, pero CONSERVA el resto: en
 * varios portales el identificador de la oferta viaja en la query
 * (`?jk=`, `?currentJobId=`), y tirarla entera fundiría ofertas distintas
 * del mismo sitio en una sola.
 */
export function normalizarUrl(bruta?: string): string {
  if (!bruta) return "";
  try {
    const u = new URL(bruta);
    u.hash = "";
    u.hostname = u.hostname.replace(/^www\./, "");
    u.protocol = "https:";
    for (const clave of [...u.searchParams.keys()])
      if (RASTREO.test(clave)) u.searchParams.delete(clave);
    u.searchParams.sort();
    return (u.origin + u.pathname.replace(/\/+$/, "") + u.search).toLowerCase();
  } catch {
    return bruta.trim().toLowerCase();
  }
}

/** Texto comparable: sin acentos, sin signos y sin espacios de más. */
export function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Clave empresa + puesto, que es como se reconoce una oferta sin URL. */
export function claveVacante(titulo: string, empresa: string): string {
  return `${normalizar(empresa)}|${normalizar(titulo)}`;
}

export interface Candidata {
  titulo: string;
  empresa?: string;
  url?: string;
}

/**
 * Devuelve la vacante ya guardada que es la misma que `c`, o undefined.
 * La URL manda sobre el título: dos ofertas pueden llamarse igual en la misma
 * empresa y ser distintas, pero la misma URL es la misma oferta.
 */
export function buscarDuplicada(
  vacantes: Vacante[],
  c: Candidata
): Vacante | undefined {
  const url = normalizarUrl(c.url);
  if (url) {
    const porUrl = vacantes.find((v) => v.url && normalizarUrl(v.url) === url);
    if (porUrl) return porUrl;
  }

  const clave = claveVacante(c.titulo, c.empresa ?? "");
  // Sin título no hay nada que comparar: no se inventa una coincidencia.
  if (!normalizar(c.titulo)) return undefined;
  return vacantes.find((v) => claveVacante(v.titulo, v.empresa) === clave);
}
