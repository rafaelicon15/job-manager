"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chrome } from "lucide-react";
import NuevaVacante from "@/components/NuevaVacante";
import { Alerta, Vacio } from "@/components/ui";

interface Carga {
  titulo?: string;
  empresa?: string;
  url?: string;
  texto?: string;
}

/** Decodifica el base64-URL con bytes UTF-8 que manda la extensión. */
function decodificar(hash: string): Carga | null {
  try {
    const b64 = hash.replace(/^#/, "").replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Carga;
  } catch {
    return null;
  }
}

export default function Capturar() {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga | null | "vacio">("vacio");

  useEffect(() => {
    // El hash nunca llega al servidor, así que la oferta capturada no sale del
    // navegador salvo cuando el motor la manda a Gemini.
    if (!window.location.hash || window.location.hash.length < 3) {
      setCarga("vacio");
      return;
    }
    setCarga(decodificar(window.location.hash));
  }, []);

  if (carga === "vacio")
    return (
      <Vacio
        titulo="Captura desde el navegador"
        detalle="Esta pantalla recibe las ofertas que envías con la extensión de Chrome. Ábrela desde el botón de la extensión mientras estás en una vacante de LinkedIn, Computrabajo, InfoJobs o cualquier portal."
        accion={
          <Link href="/vacantes?nueva=1" className="btn btn-primario">
            Pegar una oferta a mano
          </Link>
        }
      />
    );

  if (carga === null)
    return (
      <div className="space-y-4">
        <Alerta tipo="error">
          No se pudo leer lo que envió la extensión. Vuelve a la oferta y captúrala de
          nuevo, o pega el texto a mano.
        </Alerta>
        <Link href="/vacantes?nueva=1" className="btn btn-primario">
          Pegar a mano
        </Link>
      </div>
    );

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Chrome size={22} /> Oferta capturada
        </h1>
        <p className="mt-1 text-sm text-[var(--color-suave)]">
          {carga.titulo ? `“${carga.titulo}”` : "Contenido recibido"}
          {carga.empresa ? ` · ${carga.empresa}` : ""}
        </p>
      </header>

      <div className="panel p-5">
        <NuevaVacante
          textoInicial={carga.texto ?? ""}
          urlInicial={carga.url ?? ""}
          onListo={(id) => router.push(`/vacantes/${id}`)}
        />
      </div>
    </div>
  );
}
