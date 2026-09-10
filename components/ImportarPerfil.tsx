"use client";

import { useState } from "react";
import { Check, ClipboardPaste, TriangleAlert, X } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { validarPerfilPegado, type ResultadoImport } from "@/lib/perfilImport";
import { BotonCopiar } from "@/components/ui";
import { PROMPT_PERFIL_MAESTRO } from "@/lib/promptPerfil";

/**
 * Entrada para el perfil maestro generado con una IA a partir del CV. Nunca
 * escribe directo: valida, enseña lo que entendió y solo entonces deja
 * confirmar. Sobrescribir el perfil sin ver antes qué entra es la forma más
 * rápida de perder un perfil bueno por un JSON a medias.
 */
export default function ImportarPerfil() {
  const { guardarPerfil } = useApp();
  const [texto, setTexto] = useState("");
  const [res, setRes] = useState<ResultadoImport | null>(null);
  const [hecho, setHecho] = useState(false);

  function revisar() {
    setHecho(false);
    setRes(validarPerfilPegado(texto));
  }

  function aplicar() {
    if (!res?.perfil) return;
    if (
      !confirm(
        "Esto reemplaza tu perfil maestro completo. Tus vacantes y conversaciones no se tocan. ¿Seguir?"
      )
    )
      return;
    guardarPerfil(res.perfil);
    setHecho(true);
    setTexto("");
    setRes(null);
  }

  return (
    <section className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ClipboardPaste size={15} /> Cargar perfil desde una IA
        </h2>
        <BotonCopiar texto={PROMPT_PERFIL_MAESTRO} etiqueta="Copiar el prompt" />
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-suave)]">
        Copia el prompt, pásaselo a la IA con la que trabajes junto a tu CV, y
        pega aquí el JSON que te devuelva. Se revisa antes de guardar nada.
      </p>

      <textarea
        className="campo h-40 font-mono text-xs"
        placeholder='Pega aquí el JSON del perfil, empezando por {'
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button className="btn" onClick={revisar} disabled={!texto.trim()}>
          Revisar
        </button>
        {res?.ok && (
          <button className="btn btn-primario" onClick={aplicar}>
            Reemplazar mi perfil
          </button>
        )}
      </div>

      {hecho && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-300">
          <Check size={13} /> Perfil cargado. Revísalo abajo antes de generar nada.
        </p>
      )}

      {res && !res.ok && (
        <ul className="space-y-1">
          {res.errores.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-rose-300">
              <X size={13} className="mt-0.5 shrink-0" />
              {e}
            </li>
          ))}
        </ul>
      )}

      {res?.ok && res.resumen && (
        <div className="space-y-2 rounded-lg border border-[var(--color-borde)] p-3">
          <p className="text-xs font-medium">
            Entendido: {res.resumen.experiencias} experiencias ·{" "}
            {res.resumen.logros} logros · {res.resumen.certificaciones}{" "}
            certificaciones · {res.resumen.habilidades} habilidades
          </p>
          {res.avisos.map((a, i) => (
            <p
              key={i}
              className="flex items-start gap-1.5 text-xs leading-relaxed text-amber-300"
            >
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              {a}
            </p>
          ))}
          {!res.avisos.length && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-300">
              <Check size={13} /> Sin huecos.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
