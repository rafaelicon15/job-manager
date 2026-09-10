import { NextResponse } from "next/server";

// Proxy servidor->fuentes de empleo. Existe por dos razones:
//  1. Casi ninguna de estas APIs manda cabeceras CORS, así que el navegador no
//     puede llamarlas directo.
//  2. Permite normalizar siete formatos distintos a una sola forma.
// No guarda nada: las claves de Adzuna/Jooble llegan del navegador en cada
// petición y se usan solo para esa llamada.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ocho fuentes en paralelo, y Careerjet sola puede tardar ~8 s por mercado.
export const maxDuration = 60;

export interface VacanteCruda {
  id: string;
  titulo: string;
  empresa: string;
  ubicacion: string;
  modalidad: string;
  salario: string;
  url: string;
  fuente: string;
  publicada: string;
  descripcion: string;
}

const UA =
  "Mozilla/5.0 (compatible; JobManager/1.0)";

function limpiarHTML(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function traer(url: string, init?: RequestInit, msTiempoLimite = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), msTiempoLimite);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (!r.ok) {
      // El cuerpo es donde estas APIs explican QUE esta mal. Careerjet, por
      // ejemplo, distingue "no mandaste clave" de "la clave no vale"; tirarlo
      // deja al usuario con un "HTTP 401" que no le dice nada.
      const cuerpo = await r.text().catch(() => "");
      let motivo = "";
      try {
        motivo = String(JSON.parse(cuerpo)?.error ?? "");
      } catch {
        // Los 5xx de nginx llegan como HTML; sin limpiar, el usuario
        // ve una pagina entera metida en el mensaje de error.
        motivo = limpiarHTML(cuerpo).replace(/\s+/g, " ").trim().slice(0, 160);
      }
      throw new Error(`HTTP ${r.status}${motivo ? ` — ${motivo}` : ""}`);
    }
    return r;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Reintenta una vez ante fallos que no son culpa de la peticion. Medido contra
 * Careerjet desde Vercel: 1 de cada 6 llamadas devolvia un 502 de su nginx, y
 * la latencia oscilaba entre 7 y 30 s. Un 401 o un 404, en cambio, van a fallar
 * igual la segunda vez, asi que no se reintentan.
 */
async function conReintento<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const transitorio = /HTTP 5\d\d|aborted|fetch failed|network|ECONN/i.test(msg);
    if (!transitorio) throw e;
    await new Promise((r) => setTimeout(r, 800));
    return await fn();
  }
}

// ------------------------------------------------------------------ fuentes

async function remotive(q: string): Promise<VacanteCruda[]> {
  const r = await traer(
    `https://remotive.com/api/remote-jobs?limit=40${q ? `&search=${encodeURIComponent(q)}` : ""}`
  );
  const d = await r.json();
  return (d.jobs ?? []).map((j: Record<string, unknown>) => ({
    id: `remotive-${j.id}`,
    titulo: String(j.title ?? ""),
    empresa: String(j.company_name ?? ""),
    ubicacion: String(j.candidate_required_location ?? "Remoto"),
    modalidad: "Remoto",
    salario: String(j.salary ?? ""),
    url: String(j.url ?? ""),
    fuente: "Remotive",
    publicada: String(j.publication_date ?? ""),
    descripcion: limpiarHTML(String(j.description ?? "")),
  }));
}

async function remoteok(q: string): Promise<VacanteCruda[]> {
  const r = await traer("https://remoteok.com/api");
  const d = (await r.json()) as Record<string, unknown>[];
  const term = q.toLowerCase();
  return d
    .slice(1) // el primer elemento es el aviso legal de RemoteOK, no una vacante
    .filter((j) => {
      if (!term) return true;
      const heno = `${j.position ?? ""} ${j.description ?? ""} ${(j.tags as string[] ?? []).join(" ")}`.toLowerCase();
      return term.split(/\s+/).some((w) => heno.includes(w));
    })
    .slice(0, 40)
    .map((j) => ({
      id: `remoteok-${j.id}`,
      titulo: String(j.position ?? ""),
      empresa: String(j.company ?? ""),
      ubicacion: String(j.location || "Remoto"),
      modalidad: "Remoto",
      salario:
        j.salary_min && j.salary_max
          ? `${j.salary_min} - ${j.salary_max} USD`
          : "",
      url: String(j.url ?? ""),
      fuente: "RemoteOK",
      publicada: String(j.date ?? ""),
      descripcion: limpiarHTML(String(j.description ?? "")),
    }));
}

async function arbeitnow(q: string): Promise<VacanteCruda[]> {
  const r = await traer("https://www.arbeitnow.com/api/job-board-api");
  const d = await r.json();
  const term = q.toLowerCase();
  return (d.data ?? [])
    .filter((j: Record<string, unknown>) => {
      if (!term) return true;
      const heno = `${j.title ?? ""} ${j.description ?? ""} ${(j.tags as string[] ?? []).join(" ")}`.toLowerCase();
      return term.split(/\s+/).some((w) => heno.includes(w));
    })
    .slice(0, 40)
    .map((j: Record<string, unknown>) => ({
      id: `arbeitnow-${j.slug}`,
      titulo: String(j.title ?? ""),
      empresa: String(j.company_name ?? ""),
      ubicacion: String(j.location ?? ""),
      modalidad: j.remote ? "Remoto" : "",
      salario: "",
      url: String(j.url ?? ""),
      fuente: "Arbeitnow",
      publicada: j.created_at ? new Date(Number(j.created_at) * 1000).toISOString() : "",
      descripcion: limpiarHTML(String(j.description ?? "")),
    }));
}

async function jobicy(q: string): Promise<VacanteCruda[]> {
  const r = await traer(
    `https://jobicy.com/api/v2/remote-jobs?count=40${q ? `&tag=${encodeURIComponent(q)}` : ""}`
  );
  const d = await r.json();
  return (d.jobs ?? []).map((j: Record<string, unknown>) => ({
    id: `jobicy-${j.id}`,
    titulo: String(j.jobTitle ?? ""),
    empresa: String(j.companyName ?? ""),
    ubicacion: String(j.jobGeo ?? "Remoto"),
    modalidad: "Remoto",
    salario:
      j.annualSalaryMin && j.annualSalaryMax
        ? `${j.annualSalaryMin} - ${j.annualSalaryMax} ${j.salaryCurrency ?? ""}`
        : "",
    url: String(j.url ?? ""),
    fuente: "Jobicy",
    publicada: String(j.pubDate ?? ""),
    descripcion: limpiarHTML(String(j.jobDescription ?? j.jobExcerpt ?? "")),
  }));
}

async function weworkremotely(q: string): Promise<VacanteCruda[]> {
  const r = await traer("https://weworkremotely.com/remote-jobs.rss", {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  const xml = await r.text();
  const items = xml.split(/<item>/i).slice(1);
  const term = q.toLowerCase();
  const campo = (bloque: string, etiqueta: string) => {
    const m = bloque.match(
      new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, "i")
    );
    if (!m) return "";
    return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
  };
  return items
    .map((bloque, i) => {
      const titulo = campo(bloque, "title");
      // WWR publica el título como "Empresa: Puesto"
      const [empresa, ...resto] = titulo.split(":");
      return {
        id: `wwr-${i}-${campo(bloque, "guid").slice(-12)}`,
        titulo: resto.join(":").trim() || titulo,
        empresa: resto.length ? empresa.trim() : "",
        ubicacion: campo(bloque, "region") || "Remoto",
        modalidad: "Remoto",
        salario: "",
        url: campo(bloque, "link"),
        fuente: "WeWorkRemotely",
        publicada: campo(bloque, "pubDate"),
        descripcion: limpiarHTML(campo(bloque, "description")),
      };
    })
    .filter((j) => {
      if (!term) return true;
      const heno = `${j.titulo} ${j.descripcion}`.toLowerCase();
      return term.split(/\s+/).some((w) => heno.includes(w));
    })
    .slice(0, 40);
}

/**
 * Junta los resultados de varias consultas por país o mercado. Si TODAS fallan,
 * propaga el error en lugar de devolver una lista vacía: una clave inválida
 * tiene que verse como "tu clave está mal", no como "no hay vacantes". Si solo
 * fallan algunas, se devuelve lo que sí llegó.
 */
function juntarMercados(
  resultados: PromiseSettledResult<VacanteCruda[]>[],
  fuente: string
): VacanteCruda[] {
  const buenos = resultados.filter((r) => r.status === "fulfilled");
  if (!buenos.length && resultados.length) {
    const primero = resultados[0] as PromiseRejectedResult;
    const motivo =
      primero.reason instanceof Error ? primero.reason.message : String(primero.reason);
    throw new Error(`${fuente}: ${motivo}`);
  }
  return buenos.flatMap((r) => (r as PromiseFulfilledResult<VacanteCruda[]>).value);
}

async function adzuna(
  q: string,
  appId: string,
  appKey: string,
  paises: string[]
): Promise<VacanteCruda[]> {
  if (!appId || !appKey) return [];
  const porPais = await Promise.allSettled(
    paises.map(async (pais) => {
      const url =
        `https://api.adzuna.com/v1/api/jobs/${pais}/search/1` +
        `?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}` +
        `&results_per_page=25&content-type=application/json` +
        (q ? `&what=${encodeURIComponent(q)}` : "");
      const r = await traer(url);
      const d = await r.json();
      return (d.results ?? []).map((j: Record<string, unknown>) => {
        const sMin = j.salary_min as number | undefined;
        const sMax = j.salary_max as number | undefined;
        return {
          id: `adzuna-${pais}-${j.id}`,
          titulo: String(j.title ?? "").replace(/<[^>]+>/g, ""),
          empresa: String((j.company as Record<string, unknown>)?.display_name ?? ""),
          ubicacion:
            String((j.location as Record<string, unknown>)?.display_name ?? "") +
            ` (${pais.toUpperCase()})`,
          modalidad: "",
          salario: sMin && sMax ? `${Math.round(sMin)} - ${Math.round(sMax)}` : "",
          url: String(j.redirect_url ?? ""),
          fuente: `Adzuna ${pais.toUpperCase()}`,
          publicada: String(j.created ?? ""),
          descripcion: limpiarHTML(String(j.description ?? "")),
        };
      });
    })
  );
  return juntarMercados(porPais, "Adzuna");
}

/**
 * Jooble. Dos cosas medidas contra su API real:
 *  - La clave esta atada al indice global de jooble.org. Los subdominios por
 *    pais (es./ve./mx.jooble.org) la rechazan con 403: cada pais emite la suya.
 *  - Sobre ese indice, `location` solo devuelve algo util con nombres de pais
 *    en ingles, y solo de algunos: "Spain" y "Mexico" dan resultados reales,
 *    mientras Venezuela, Colombia, Argentina y Chile devuelven 0. Peor aun,
 *    las ciudades enganchan homonimos de EE.UU.: "Madrid" devuelve vacantes
 *    de Nuevo Mexico y "Peru" de Massachusetts.
 * Por eso se consultan los mercados que si funcionan mas la busqueda sin
 * ubicacion, que es la que trae el grueso de lo remoto, y se juntan.
 */
async function jooble(
  q: string,
  key: string,
  ubicaciones: string[]
): Promise<VacanteCruda[]> {
  if (!key) return [];
  const porMercado = await Promise.allSettled(
    ubicaciones.map(async (ubicacion) => {
      const r = await traer(`https://jooble.org/api/${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: q || "marketing digital",
          location: ubicacion,
        }),
      });
      const d = await r.json();
      return (d.jobs ?? []).slice(0, 30).map((j: Record<string, unknown>, i: number) => ({
        id: `jooble-${ubicacion || "global"}-${i}-${String(j.id ?? "")}`,
        titulo: String(j.title ?? ""),
        empresa: String(j.company ?? ""),
        ubicacion: String(j.location ?? ""),
        modalidad: "",
        salario: String(j.salary ?? ""),
        url: String(j.link ?? ""),
        fuente: "Jooble",
        publicada: String(j.updated ?? ""),
        descripcion: limpiarHTML(String(j.snippet ?? "")),
      }));
    })
  );
  return juntarMercados(porMercado, "Jooble");
}

/**
 * Careerjet. Tiene dos APIs y la moderna NO sirve aqui, medido con la clave
 * real:
 *  - La v4 (search.api, HTTPS, Basic auth) autoriza por lista blanca de IPs:
 *    responde 403 "Unauthorized access from IP ...". Vercel sale por IPs
 *    dinamicas, asi que no hay nada que poner en esa lista. Mandar Referer u
 *    Origin del sitio registrado no la convence.
 *  - La clasica (public.api) autoriza por referrer, aceptando la misma clave
 *    como `affid`, y desde cualquier IP. Es la que se usa.
 * Solo escucha en HTTP: el HTTPS de public.api no llega a conectar. La llamada
 * sale del servidor, no del navegador, y solo lleva la busqueda y el affid.
 * Cubre es_VE, que es el unico agregador con clave que trae Venezuela.
 */
async function careerjet(
  q: string,
  apiKey: string,
  locales: string[],
  ubicacion: string,
  ip: string,
  ua: string,
  referer: string
): Promise<VacanteCruda[]> {
  if (!apiKey) return [];

  const porMercado = await Promise.allSettled(
    locales.map(async (locale) => {
      const url = new URL("http://public.api.careerjet.net/search");
      url.searchParams.set("affid", apiKey);
      url.searchParams.set("locale_code", locale);
      if (q) url.searchParams.set("keywords", q);
      if (ubicacion) url.searchParams.set("location", ubicacion);
      url.searchParams.set("pagesize", "50");
      url.searchParams.set("sort", "date");
      // Obligatorios segun su documentacion: sin ellos devuelve 403.
      url.searchParams.set("user_ip", ip);
      url.searchParams.set("user_agent", ua);

      const d = await conReintento(async () => {
        const r = await traer(
          url.toString(),
          // Sin Referer rechaza la llamada: es su forma de autorizar.
          { headers: { Referer: referer } },
          30000
        );
        return await r.json();
      });

      // Responde LOCATIONS cuando la ubicacion es ambigua y ERROR si falta
      // algo. En ninguno de los dos casos hay vacantes, y no debe tumbar el
      // resto de la busqueda.
      if (d?.type !== "JOBS") return [];

      const pais = locale.split("_")[1] ?? "";
      return (d.jobs ?? []).map((j: Record<string, unknown>, i: number) => ({
        id: `careerjet-${locale}-${i}-${String(j.url ?? "").slice(-14)}`,
        titulo: String(j.title ?? ""),
        empresa: String(j.company ?? ""),
        ubicacion: `${String(j.locations ?? "")}${pais ? ` (${pais})` : ""}`,
        modalidad: "",
        salario: String(j.salary ?? ""),
        url: String(j.url ?? ""),
        fuente: `Careerjet ${pais}`,
        publicada: String(j.date ?? ""),
        descripcion: limpiarHTML(String(j.description ?? "")),
      }));
    })
  );
  return juntarMercados(porMercado, "Careerjet");
}

// -------------------------------------------------------------------- ruta

interface Cuerpo {
  query?: string;
  fuentes?: string[];
  adzunaAppId?: string;
  adzunaAppKey?: string;
  adzunaPaises?: string[];
  joobleKey?: string;
  joobleUbicaciones?: string[];
  careerjetKey?: string;
  careerjetLocales?: string[];
  careerjetUbicacion?: string;
}

export async function POST(req: Request) {
  let cuerpo: Cuerpo;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const q = (cuerpo.query ?? "").trim();
  const activas = new Set(
    cuerpo.fuentes?.length
      ? cuerpo.fuentes
      : [
          "remotive",
          "remoteok",
          "arbeitnow",
          "jobicy",
          "wwr",
          "adzuna",
          "jooble",
          "careerjet",
        ]
  );

  const tareas: { nombre: string; p: Promise<VacanteCruda[]> }[] = [];
  if (activas.has("remotive")) tareas.push({ nombre: "Remotive", p: remotive(q) });
  if (activas.has("remoteok")) tareas.push({ nombre: "RemoteOK", p: remoteok(q) });
  if (activas.has("arbeitnow")) tareas.push({ nombre: "Arbeitnow", p: arbeitnow(q) });
  if (activas.has("jobicy")) tareas.push({ nombre: "Jobicy", p: jobicy(q) });
  if (activas.has("wwr")) tareas.push({ nombre: "WeWorkRemotely", p: weworkremotely(q) });
  if (activas.has("adzuna"))
    tareas.push({
      nombre: "Adzuna",
      p: adzuna(
        q,
        cuerpo.adzunaAppId ?? "",
        cuerpo.adzunaAppKey ?? "",
        // Adzuna no cubre Venezuela, Colombia, Argentina, Chile ni Peru: de
        // LatAm solo tiene Mexico y Brasil. Se piden los dos mercados
        // hispanos que si cubre. "us" y "gb" sumaban 425.000 vacantes en
        // ingles, un mercado que con ingles basico no es realista.
        cuerpo.adzunaPaises?.length ? cuerpo.adzunaPaises : ["es", "mx"]
      ),
    });
  if (activas.has("jooble"))
    tareas.push({
      nombre: "Jooble",
      p: jooble(
        q,
        cuerpo.joobleKey ?? "",
        cuerpo.joobleUbicaciones?.length
          ? cuerpo.joobleUbicaciones
          : ["", "Spain", "Mexico"]
      ),
    });
  if (activas.has("careerjet"))
    tareas.push({
      nombre: "Careerjet",
      p: careerjet(
        q,
        cuerpo.careerjetKey ?? "",
        cuerpo.careerjetLocales?.length
          ? cuerpo.careerjetLocales
          : ["es_VE", "es_ES", "es_MX"],
        cuerpo.careerjetUbicacion ?? "",
        // Careerjet exige la IP y el navegador de quien origina la búsqueda.
        (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
          "127.0.0.1",
        req.headers.get("user-agent") ?? UA,
        // Careerjet autoriza por el sitio registrado, asi que el Referer
        // tiene que ser el del propio despliegue: cada quien registra el
        // suyo. En local no hay un dominio valido y la fuente fallara; es
        // preferible a mandar el dominio de otro.
        (() => {
          const origen = req.headers.get("origin");
          if (origen && /^https:\/\//.test(origen)) return `${origen}/`;
          const host = req.headers.get("host") ?? "";
          return host ? `https://${host}/` : "";
        })()
      ),
    });

  const acabadas = await Promise.allSettled(tareas.map((t) => t.p));

  const vacantes: VacanteCruda[] = [];
  const fallos: { fuente: string; error: string }[] = [];
  acabadas.forEach((r, i) => {
    if (r.status === "fulfilled") vacantes.push(...r.value);
    else
      fallos.push({
        fuente: tareas[i].nombre,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
  });

  // Dedupe por empresa+título normalizados: las mismas ofertas aparecen en
  // varios agregadores a la vez.
  const vistos = new Set<string>();
  const unicas = vacantes.filter((v) => {
    if (!v.titulo) return false;
    const clave = `${v.empresa}|${v.titulo}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });

  const porFecha = (a: VacanteCruda, b: VacanteCruda) =>
    new Date(b.publicada || 0).getTime() - new Date(a.publicada || 0).getTime();
  unicas.sort(porFecha);

  // El recorte a 150 se reparte por turnos entre fuentes en vez de cortar por
  // fecha a secas. Ordenar solo por fecha dejaba fuera mercados enteros: las
  // vacantes de Venezuela son mas antiguas que las de Mexico y Espana, asi que
  // caian por debajo del corte y la fuente parecia vacia aunque trajera 47.
  // Dentro de cada fuente se respeta el orden por fecha.
  const porFuente = new Map<string, VacanteCruda[]>();
  for (const v of unicas) {
    const lista = porFuente.get(v.fuente);
    if (lista) lista.push(v);
    else porFuente.set(v.fuente, [v]);
  }
  const colas = [...porFuente.values()];
  const seleccion: VacanteCruda[] = [];
  for (let i = 0; seleccion.length < 150; i++) {
    const antes = seleccion.length;
    for (const cola of colas) {
      if (i < cola.length) seleccion.push(cola[i]);
      if (seleccion.length >= 150) break;
    }
    if (seleccion.length === antes) break; // no queda nada en ninguna cola
  }
  seleccion.sort(porFecha);

  return NextResponse.json({
    total: unicas.length,
    vacantes: seleccion,
    fallos,
  });
}
