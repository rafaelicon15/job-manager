"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Frontera de error de la app. Sin esto, cualquier excepción en un componente
 * dejaba al usuario en la pantalla de error genérica de Next, sin explicación
 * ni forma de volver, y con la duda de si había perdido sus datos.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Job Manager falló:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="panel px-6 py-10 text-center">
        <AlertTriangle size={28} className="mx-auto text-amber-400" />
        <h1 className="mt-3 text-lg font-bold">Algo se rompió en esta pantalla</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-suave)]">
          Tus datos están intactos: viven en el almacenamiento de este navegador y
          no se tocan cuando falla la interfaz.
        </p>

        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-xs text-[var(--color-suave)]">
            Detalle técnico
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-[var(--color-borde)] bg-[#0e131e] p-3 text-[11px] leading-relaxed text-[var(--color-suave)]">
            {error.message}
            {error.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
        </details>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className="btn btn-primario" onClick={reset}>
            <RotateCcw size={15} /> Reintentar
          </button>
          <Link href="/" className="btn">
            Volver al panel
          </Link>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-[var(--color-suave)]">
          Si vuelve a pasar, entra en Ajustes y descarga un respaldo antes de seguir
          tocando nada.
        </p>
      </div>
    </div>
  );
}
