import { NextResponse } from "next/server";

/**
 * Proxy servidor -> Gemini.
 *
 * Existe por una razón concreta y medida: la API de Gemini aplica restricción
 * geográfica y responde `FAILED_PRECONDITION: User location is not supported`
 * a las peticiones que salen de países no soportados, Venezuela entre ellos.
 * Si el navegador llamara a Gemini directamente, la petición saldría desde la
 * IP del usuario y sería rechazada. Al pasar por esta ruta, sale desde los
 * servidores de Vercel, que sí están en una región soportada.
 *
 * La clave sigue viviendo en el navegador del usuario, tal como se decidió:
 * viaja en el cuerpo de la petición, se usa para esa única llamada y no se
 * guarda ni se registra en ningún sitio.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface Cuerpo {
  apiKey?: string;
  modelo?: string;
  prompt?: string;
  schema?: object;
  temperature?: number;
}

export async function POST(req: Request) {
  let c: Cuerpo;
  try {
    c = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }

  const apiKey = (c.apiKey ?? "").trim();
  const modelo = (c.modelo ?? "").trim();
  if (!apiKey) return NextResponse.json({ error: "Falta la API key" }, { status: 400 });
  if (!modelo) return NextResponse.json({ error: "Falta el modelo" }, { status: 400 });
  if (!c.prompt) return NextResponse.json({ error: "Falta el prompt" }, { status: 400 });
  // Evita que un modelo con caracteres raros se cuele en la ruta de la URL.
  if (!/^[a-zA-Z0-9.\-_]+$/.test(modelo))
    return NextResponse.json({ error: "Nombre de modelo inválido" }, { status: 400 });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  try {
    const r = await fetch(
      `${BASE}/${encodeURIComponent(modelo)}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: c.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            ...(c.schema ? { responseSchema: c.schema } : {}),
            temperature: c.temperature ?? 0.4,
          },
        }),
        cache: "no-store",
      }
    );

    const datos = await r.json().catch(() => null);

    if (!r.ok || datos?.error) {
      // Se devuelve el mensaje de Google tal cual: el cliente lo clasifica para
      // decidir si reintenta (saturación), espera (límite por minuto) o se rinde.
      const e = datos?.error;
      return NextResponse.json(
        {
          error: e?.message ?? `Gemini respondió ${r.status}`,
          status: e?.status ?? String(r.status),
          httpStatus: r.status,
        },
        { status: r.status === 200 ? 502 : r.status }
      );
    }

    const texto = datos?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");

    if (!texto) {
      const motivo = datos?.candidates?.[0]?.finishReason;
      return NextResponse.json(
        {
          error:
            motivo === "SAFETY"
              ? "SAFETY: Gemini bloqueó la respuesta por filtros de seguridad."
              : motivo === "MAX_TOKENS"
                ? "La respuesta se cortó por longitud. Prueba con menos texto de entrada."
                : "Gemini devolvió una respuesta vacía.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ texto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: msg.includes("abort")
          ? "Gemini tardó demasiado en responder."
          : `fetch failed: ${msg}`,
      },
      { status: 504 }
    );
  } finally {
    clearTimeout(t);
  }
}
