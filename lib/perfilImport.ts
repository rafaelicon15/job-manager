import type { PerfilMaestro, Experiencia, Logro, HabilidadGrupo } from "./types";
import { PERFIL_INICIAL } from "./seed";

/**
 * Valida un perfil maestro pegado como JSON, normalmente generado por una IA a
 * partir del CV de quien lo usa.
 *
 * Es deliberadamente estricto con lo que sostiene el sistema anti-invento y
 * tolerante con el resto. Cada logro NECESITA un id único, porque el motor está
 * obligado a declarar de qué logro sale cada línea del CV y la app comprueba
 * que ese id exista; si aceptáramos logros sin id, la comprobación pasaría a ser
 * decorativa. Los ids que falten se generan aquí en vez de rechazar el perfil,
 * que es lo que más se olvida una IA al redactarlo.
 *
 * Devuelve siempre los avisos: un perfil que entra "con avisos" sigue siendo
 * usable, pero quien lo pega tiene que saber qué quedó a medias.
 */

export interface ResultadoImport {
  ok: boolean;
  perfil?: PerfilMaestro;
  errores: string[];
  avisos: string[];
  resumen?: {
    experiencias: number;
    logros: number;
    certificaciones: number;
    habilidades: number;
  };
}

type Obj = Record<string, unknown>;

const esObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const textos = (v: unknown): string[] =>
  lista(v).map(txt).filter(Boolean);

/** Quita el envoltorio que suelen añadir los modelos: ```json … ``` */
function desenvolver(entrada: string): string {
  let t = entrada.trim();
  const valla = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (valla) t = valla[1].trim();
  // Algunos modelos preceden el JSON con una frase; se busca el primer objeto.
  if (!t.startsWith("{")) {
    const i = t.indexOf("{");
    const j = t.lastIndexOf("}");
    if (i !== -1 && j > i) t = t.slice(i, j + 1);
  }
  return t;
}

function normalizarLogro(crudo: unknown, idExp: string, i: number): Logro | null {
  if (!esObj(crudo)) return null;
  const texto = txt(crudo.texto);
  if (!texto) return null;
  return {
    // El id es lo que sostiene la verificación anti-invento. Si la IA no lo
    // puso, se deriva de la experiencia para que sea estable y legible.
    id: txt(crudo.id) || `${idExp}-l${i + 1}`,
    texto,
    metrica: txt(crudo.metrica) || undefined,
    angulos: textos(crudo.angulos),
    keywords: textos(crudo.keywords),
    evidencia: lista(crudo.evidencia)
      .filter(esObj)
      .map((e) => ({
        tipo: (["certificado", "url", "proyecto", "test", "referencia"].includes(
          txt(e.tipo)
        )
          ? txt(e.tipo)
          : "referencia") as "certificado" | "url" | "proyecto" | "test" | "referencia",
        descripcion: txt(e.descripcion),
        url: txt(e.url) || undefined,
      }))
      .filter((e) => e.descripcion),
  };
}

function normalizarExperiencia(crudo: unknown, i: number): Experiencia | null {
  if (!esObj(crudo)) return null;
  const puesto = txt(crudo.puesto);
  const empresa = txt(crudo.empresa);
  if (!puesto && !empresa) return null;
  const id = txt(crudo.id) || `exp-${i + 1}`;
  return {
    id,
    puesto,
    empresa,
    ubicacion: txt(crudo.ubicacion),
    modalidad: txt(crudo.modalidad),
    desde: txt(crudo.desde),
    hasta: txt(crudo.hasta),
    resumen: txt(crudo.resumen),
    logros: lista(crudo.logros)
      .map((l, j) => normalizarLogro(l, id, j))
      .filter((l): l is Logro => l !== null),
  };
}

function normalizarHabilidades(crudo: unknown): HabilidadGrupo[] {
  return lista(crudo)
    .filter(esObj)
    .map((g) => ({
      categoria: txt(g.categoria),
      items: lista(g.items)
        .filter(esObj)
        .map((it) => {
          const n = Number(it.nivel);
          return {
            nombre: txt(it.nombre),
            // Fuera de 1-4 no significa nada; se cae a 2 (funcional), que es
            // el nivel que menos promete.
            nivel: (n >= 1 && n <= 4 ? Math.round(n) : 2) as 1 | 2 | 3 | 4,
            anios: Number.isFinite(Number(it.anios)) ? Number(it.anios) : undefined,
          };
        })
        .filter((it) => it.nombre),
    }))
    .filter((g) => g.categoria && g.items.length);
}

export function validarPerfilPegado(entrada: string): ResultadoImport {
  const errores: string[] = [];
  const avisos: string[] = [];

  if (!entrada.trim())
    return { ok: false, errores: ["No has pegado nada."], avisos };

  let crudo: unknown;
  try {
    crudo = JSON.parse(desenvolver(entrada));
  } catch (e) {
    return {
      ok: false,
      errores: [
        `Eso no es JSON válido: ${e instanceof Error ? e.message : String(e)}. ` +
          "Pega solo el bloque que empieza por { y acaba en }, sin texto alrededor.",
      ],
      avisos,
    };
  }

  if (!esObj(crudo))
    return { ok: false, errores: ["El JSON no es un objeto."], avisos };

  // Algunas IAs envuelven el perfil en { "perfil": {...} }.
  const p: Obj = esObj(crudo.perfil) ? (crudo.perfil as Obj) : crudo;

  const nombre = txt(p.nombre);
  if (!nombre) errores.push("Falta el nombre.");

  const experiencias = lista(p.experiencias)
    .map(normalizarExperiencia)
    .filter((e): e is Experiencia => e !== null);
  if (!experiencias.length)
    errores.push(
      "No hay ninguna experiencia. Sin experiencias el motor no puede escribir un CV: tiene prohibido inventarlas."
    );

  // Ids repetidos romperían la verificación en silencio, dejando que un logro
  // se haga pasar por otro.
  const vistos = new Set<string>();
  for (const exp of experiencias)
    for (const l of exp.logros) {
      if (vistos.has(l.id)) {
        const nuevo = `${l.id}-${vistos.size}`;
        avisos.push(`El logro "${l.id}" estaba repetido; se renombró a "${nuevo}".`);
        l.id = nuevo;
      }
      vistos.add(l.id);
    }

  if (errores.length) return { ok: false, errores, avisos };

  const totalLogros = experiencias.reduce((n, e) => n + e.logros.length, 0);
  if (!totalLogros)
    avisos.push(
      "Ninguna experiencia trae logros. El CV saldrá con puestos y fechas, pero sin nada que contar."
    );

  const idiomas = lista(p.idiomas)
    .filter(esObj)
    .map((i) => ({ idioma: txt(i.idioma), nivel: txt(i.nivel) }))
    .filter((i) => i.idioma);
  if (!idiomas.length)
    avisos.push("No hay idiomas. El motor dejará [COMPLETAR: …] cuando se los pidan.");

  const prefCrudo = esObj(p.preferencias) ? p.preferencias : {};
  const preferencias = {
    modalidad: txt(prefCrudo.modalidad),
    disponibilidad: txt(prefCrudo.disponibilidad),
    salarioMin: txt(prefCrudo.salarioMin) || undefined,
    salarioObjetivo: txt(prefCrudo.salarioObjetivo) || undefined,
    rolesObjetivo: textos(prefCrudo.rolesObjetivo),
    keywordsBusqueda: textos(prefCrudo.keywordsBusqueda),
  };
  if (!preferencias.salarioObjetivo)
    avisos.push(
      "Sin expectativa salarial. El motor no puede inventársela y lo dejará marcado."
    );

  const lineasRojas = textos(p.lineasRojas);
  if (!lineasRojas.length)
    avisos.push(
      "Sin líneas rojas. Se usan las de por defecto, que prohíben inventar datos, inflar métricas y prometer herramientas sin experiencia."
    );

  const perfil: PerfilMaestro = {
    nombre,
    titular: txt(p.titular),
    titularEn: txt(p.titularEn) || txt(p.titular),
    email: txt(p.email),
    telefono: txt(p.telefono),
    ubicacion: txt(p.ubicacion),
    links: lista(p.links)
      .filter(esObj)
      .map((l) => ({ etiqueta: txt(l.etiqueta), url: txt(l.url) }))
      .filter((l) => l.url),
    resumen: txt(p.resumen),
    resumenEn: txt(p.resumenEn) || txt(p.resumen),
    experiencias,
    educacion: lista(p.educacion)
      .filter(esObj)
      .map((e) => ({
        titulo: txt(e.titulo),
        institucion: txt(e.institucion),
        estado: txt(e.estado),
      }))
      .filter((e) => e.titulo),
    certificaciones: lista(p.certificaciones)
      .filter(esObj)
      .map((c, i) => ({
        id: txt(c.id) || `cert-${i + 1}`,
        nombre: txt(c.nombre),
        emisor: txt(c.emisor),
        anio: txt(c.anio) || undefined,
        url: txt(c.url) || undefined,
      }))
      .filter((c) => c.nombre),
    habilidades: normalizarHabilidades(p.habilidades),
    idiomas,
    psicometria: lista(p.psicometria)
      .filter(esObj)
      .map((r) => ({
        titulo: txt(r.titulo),
        etiquetas: textos(r.etiquetas),
        implicaciones: textos(r.implicaciones),
      }))
      .filter((r) => r.titulo),
    lineasRojas: lineasRojas.length ? lineasRojas : PERFIL_INICIAL.lineasRojas,
    preferencias,
  };

  if (!perfil.email && !perfil.telefono)
    avisos.push("Sin correo ni teléfono: el CV saldrá sin forma de contactarte.");
  if (!perfil.habilidades.length)
    avisos.push("Sin habilidades. El análisis de vacantes será mucho más pobre.");

  return {
    ok: true,
    perfil,
    errores,
    avisos,
    resumen: {
      experiencias: experiencias.length,
      logros: totalLogros,
      certificaciones: perfil.certificaciones.length,
      habilidades: perfil.habilidades.reduce((n, g) => n + g.items.length, 0),
    },
  };
}
