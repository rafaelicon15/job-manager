import { NextResponse } from "next/server";

// Descarga una URL de oferta y devuelve su texto plano para que Gemini lo parsee.
// Muchos portales (LinkedIn entre ellos) bloquean el acceso sin sesión; en ese
// caso el cliente cae al modo "pegar texto a mano".

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOQUEADOS =
  /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

function aTextoPlano(html: string): string {
  const cuerpo =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html;
  return cuerpo
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
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

export async function POST(req: Request) {
  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }
  if (!/^https?:$/.test(destino.protocol))
    return NextResponse.json({ error: "Solo se admite http o https" }, { status: 400 });
  if (BLOQUEADOS.test(destino.hostname))
    return NextResponse.json({ error: "Destino no permitido" }, { status: 400 });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(destino.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      cache: "no-store",
    });
    if (!r.ok)
      return NextResponse.json(
        {
          error: `El sitio respondió ${r.status}. Suele pasar en LinkedIn y otros portales que exigen sesión: copia el texto de la oferta y pégalo a mano.`,
        },
        { status: 502 }
      );
    const html = await r.text();
    const texto = aTextoPlano(html);
    if (texto.length < 200)
      return NextResponse.json(
        {
          error:
            "La página se cargó pero casi no traía texto (probablemente se renderiza con JavaScript). Copia la oferta y pégala a mano.",
        },
        { status: 422 }
      );
    return NextResponse.json({ texto: texto.slice(0, 80000), url: destino.toString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error:
          msg.includes("abort")
            ? "El sitio tardó demasiado en responder."
            : `No se pudo descargar la página: ${msg}`,
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(t);
  }
}
