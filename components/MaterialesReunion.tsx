"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { leerComoMarkdown, tamanoLegible } from "@/lib/archivos";
import { nuevoId } from "@/lib/store";
import type { MaterialReunion } from "@/lib/types";
import { Alerta } from "@/components/ui";

/** Los bytes de lo que no se pudo convertir, vivos solo en esta sesión. */
export type BytesSueltos = Record<string, { mimeType: string; datos: string }>;

const ACEPTA = ".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.rtf,.png,.jpg,.jpeg,.webp";

/**
 * Los documentos que acompañan a una reunión: la propuesta que mandaron, el
 * plan de los primeros noventa días, el enunciado de la prueba técnica.
 *
 * Todo se convierte a Markdown en el navegador. No es un capricho: el mismo
 * documento en Markdown pesa dos órdenes de magnitud menos que el archivo, así
 * que cabe en localStorage y se queda guardado con la reunión. Puedes regenerar
 * el resumen dentro de tres semanas sin volver a buscar el PDF.
 *
 * Lo que no se puede convertir de forma fiable (un PDF escaneado, una captura)
 * se manda nativo a Gemini, y eso solo funciona en la sesión en la que lo
 * subes. Se dice en pantalla en lugar de dejar que falle luego sin explicación.
 */
export default function MaterialesReunion({
  materiales,
  onCambio,
  bytes,
  onBytes,
}: {
  materiales: MaterialReunion[];
  onCambio: (m: MaterialReunion[]) => void;
  bytes: BytesSueltos;
  onBytes: (b: BytesSueltos) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState(false);

  async function anadir(archivos: FileList | File[]) {
    setCargando(true);
    setError("");
    const nuevos: MaterialReunion[] = [];
    const sueltos: BytesSueltos = {};
    const fallos: string[] = [];

    for (const f of Array.from(archivos)) {
      try {
        const leido = await leerComoMarkdown(f);
        const id = nuevoId("mat");
        if (leido.via === "markdown") {
          nuevos.push({
            id,
            nombre: leido.nombre,
            bytes: leido.bytes,
            tipo: leido.tipo,
            markdown: leido.markdown,
            palabras: leido.palabras,
            extraido: leido.extraido,
            subidoEn: new Date().toISOString(),
          });
        } else {
          nuevos.push({
            id,
            nombre: leido.nombre,
            bytes: leido.bytes,
            tipo: leido.tipo,
            markdown: "",
            palabras: 0,
            sinConvertir: leido.motivo,
            subidoEn: new Date().toISOString(),
          });
          sueltos[id] = { mimeType: leido.mimeType, datos: leido.datos };
        }
      } catch (e) {
        fallos.push(e instanceof Error ? e.message : String(e));
      }
    }

    if (nuevos.length) onCambio([...materiales, ...nuevos]);
    if (Object.keys(sueltos).length) onBytes({ ...bytes, ...sueltos });
    if (fallos.length) setError(fallos.join(" "));
    setCargando(false);
    if (entrada.current) entrada.current.value = "";
  }

  function quitar(id: string) {
    onCambio(materiales.filter((m) => m.id !== id));
    if (bytes[id]) {
      const resto = { ...bytes };
      delete resto[id];
      onBytes(resto);
    }
  }

  /** Descarga el Markdown, que es lo que de verdad ve la IA. */
  function descargar(m: MaterialReunion) {
    const url = URL.createObjectURL(
      new Blob([m.markdown], { type: "text/markdown;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${m.nombre.replace(/\.[^.]+$/, "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = materiales.reduce((n, m) => n + m.palabras, 0);

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="etiqueta mb-0">
          <Paperclip size={12} className="mr-1 inline" />
          Documentos de la reunión
        </p>
        {total > 0 && (
          <p className="text-[11px] text-[var(--color-suave)]">
            {materiales.length} {materiales.length === 1 ? "documento" : "documentos"} ·{" "}
            {total.toLocaleString("es")} palabras en Markdown
          </p>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (e.dataTransfer.files.length) anadir(e.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed p-4 text-center transition ${
          arrastrando
            ? "border-[var(--color-acento)] bg-[var(--color-acento)]/5"
            : "border-[var(--color-borde)]"
        }`}
      >
        <input
          ref={entrada}
          type="file"
          multiple
          accept={ACEPTA}
          className="hidden"
          onChange={(e) => e.target.files?.length && anadir(e.target.files)}
        />
        <button
          className="btn"
          disabled={cargando}
          onClick={() => entrada.current?.click()}
        >
          <Upload size={15} />
          {cargando ? "Convirtiendo…" : "Añadir documentos"}
        </button>
        <p className="mt-2 text-xs leading-relaxed text-[var(--color-suave)]">
          PDF, .docx, .txt, .md, .csv o imágenes. Se convierten a Markdown aquí
          en tu navegador, así que quedan guardados con la reunión y pesan una
          fracción del archivo original. Puedes soltarlos encima.
        </p>
      </div>

      {error && (
        <div className="mt-2">
          <Alerta tipo="error">{error}</Alerta>
        </div>
      )}

      {materiales.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {materiales.map((m) => {
            const perdido = Boolean(m.sinConvertir) && !bytes[m.id];
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-borde)] px-3 py-2"
              >
                <FileText size={14} className="shrink-0 text-[var(--color-suave)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.nombre}</p>
                  <p className="text-[11px] leading-relaxed text-[var(--color-suave)]">
                    {tamanoLegible(m.bytes)}
                    {m.palabras > 0 && ` · ${m.palabras.toLocaleString("es")} palabras`}
                    {m.extraido && " · texto extraído del PDF"}
                  </p>
                </div>
                {m.markdown && (
                  <button
                    className="btn py-1 text-xs"
                    onClick={() => descargar(m)}
                    title="Descargar el Markdown que ve la IA"
                  >
                    .md
                  </button>
                )}
                <button
                  className="btn px-2 py-1 text-rose-300"
                  title="Quitar este documento"
                  onClick={() => quitar(m.id)}
                >
                  <Trash2 size={13} />
                </button>
                {m.sinConvertir && (
                  <p
                    className={`w-full text-[11px] leading-relaxed ${perdido ? "text-rose-300" : "text-amber-300"}`}
                  >
                    {perdido
                      ? `No se pudo convertir a texto y su contenido no se guarda al recargar. Vuelve a subirlo para incluirlo en el resumen. (${m.sinConvertir})`
                      : m.sinConvertir}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
