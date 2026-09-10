"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, ClipboardPaste, Wand2 } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { parsearVacante } from "@/lib/gemini";
import { Alerta, Cargando } from "@/components/ui";

/**
 * Alta de vacante por URL o por texto pegado. En ambos casos Gemini normaliza
 * el contenido; si no hay API key, se cae a un alta manual mínima para que la
 * app siga siendo usable sin motor.
 */
export default function NuevaVacante({
  textoInicial = "",
  urlInicial = "",
  onListo,
}: {
  textoInicial?: string;
  urlInicial?: string;
  onListo?: (id: string) => void;
}) {
  const router = useRouter();
  const { estado, agregarVacante } = useApp();
  const { ajustes } = estado;

  const [modo, setModo] = useState<"url" | "texto">(
    textoInicial ? "texto" : "url"
  );
  const [url, setUrl] = useState(urlInicial);
  const [texto, setTexto] = useState(textoInicial);
  const [cargando, setCargando] = useState("");
  const [error, setError] = useState("");

  async function traerDeUrl() {
    setCargando("Descargando la oferta…");
    setError("");
    try {
      const r = await fetch("/api/extraer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTexto(d.texto);
      setModo("texto");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando("");
    }
  }

  async function crear() {
    setError("");
    if (texto.trim().length < 60) {
      setError("Pega al menos la descripción del puesto (mínimo 60 caracteres).");
      return;
    }
    setCargando("Estructurando la oferta con Gemini…");
    try {
      let datos: {
        titulo: string;
        empresa: string;
        ubicacion?: string;
        modalidad?: string;
        salario?: string;
        descripcion: string;
      };
      if (ajustes.geminiApiKey) {
        datos = await parsearVacante(ajustes.geminiApiKey, ajustes.modelo, texto);
      } else {
        // Sin motor: primera línea como título, resto como descripción.
        const lineas = texto.trim().split("\n").filter(Boolean);
        datos = {
          titulo: lineas[0]?.slice(0, 120) ?? "Vacante sin título",
          empresa: lineas[1]?.slice(0, 80) ?? "",
          descripcion: texto,
        };
      }
      const v = agregarVacante({
        titulo: datos.titulo || "Vacante sin título",
        empresa: datos.empresa || "",
        ubicacion: datos.ubicacion ?? "",
        modalidad: datos.modalidad ?? "",
        salario: datos.salario ?? "",
        fuente: url ? new URL(url).hostname.replace(/^www\./, "") : "Pegada a mano",
        url: url || undefined,
        descripcion: datos.descripcion || texto,
      });
      if (onListo) onListo(v.id);
      else router.push(`/vacantes/${v.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        <button
          className={`chip ${modo === "url" ? "border-[var(--color-acento)] text-[var(--color-acento)]" : ""}`}
          onClick={() => setModo("url")}
        >
          <Link2 size={13} /> Desde una URL
        </button>
        <button
          className={`chip ${modo === "texto" ? "border-[var(--color-acento)] text-[var(--color-acento)]" : ""}`}
          onClick={() => setModo("texto")}
        >
          <ClipboardPaste size={13} /> Pegar el texto
        </button>
      </div>

      {modo === "url" ? (
        <div className="space-y-2">
          <label className="etiqueta" htmlFor="url-oferta">
            Enlace de la oferta
          </label>
          <div className="flex gap-2">
            <input
              id="url-oferta"
              className="campo flex-1"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <button className="btn" onClick={traerDeUrl} disabled={!url || !!cargando}>
              Traer
            </button>
          </div>
          <p className="text-xs text-[var(--color-suave)]">
            LinkedIn, Computrabajo y otros portales bloquean la descarga sin sesión
            iniciada. Si falla, usa la extensión de Chrome o pega el texto a mano.
          </p>
        </div>
      ) : (
        <div>
          <label className="etiqueta" htmlFor="texto-oferta">
            Texto de la oferta
          </label>
          <textarea
            id="texto-oferta"
            className="campo min-h-[240px] resize-y font-mono text-xs leading-relaxed"
            placeholder="Pega aquí todo el contenido de la oferta. Da igual que venga sucio con menús y basura: el motor lo limpia."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <p className="mt-1 text-xs text-[var(--color-suave)]">
            {texto.length.toLocaleString("es")} caracteres
          </p>
        </div>
      )}

      {error && <Alerta tipo="error">{error}</Alerta>}
      {!ajustes.geminiApiKey && (
        <Alerta tipo="aviso">
          Sin API key de Gemini la vacante se guardará en crudo, sin estructurar.
        </Alerta>
      )}

      <div className="flex items-center gap-3">
        <button
          className="btn btn-primario"
          onClick={crear}
          disabled={!!cargando || texto.trim().length < 60}
        >
          <Wand2 size={15} /> Crear ficha
        </button>
        {cargando && <Cargando texto={cargando} />}
      </div>
    </div>
  );
}
