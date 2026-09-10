"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { parsearConversacion } from "@/lib/gemini";
import { CANALES, type Canal } from "@/lib/types";
import { nuevoId } from "@/lib/store";
import { Alerta, Cargando } from "@/components/ui";

const EJEMPLOS: Record<Canal, string> = {
  linkedin:
    "Pega el hilo completo de LinkedIn tal cual, con las marcas de «ha enviado el siguiente mensaje a las 11:05» y todo. El motor separa quién dijo qué.",
  email:
    "Pega la cadena de correos completa, incluidas las líneas de «El día X, Fulano escribió:». No hace falta limpiarla.",
  whatsapp:
    "Exporta el chat desde WhatsApp (Ajustes del chat → Exportar chat → Sin archivos) y pega el texto, o copia los mensajes a mano.",
  otro: "Pega la conversación completa, en el orden en que ocurrió.",
};

/**
 * Alta de conversación. El motor separa el hilo en mensajes, identifica al
 * reclutador y, si el hilo contiene una oferta descrita, ofrece crear la
 * vacante enlazada de una vez.
 */
export default function NuevaConversacion({
  onListo,
}: {
  onListo?: (id: string) => void;
}) {
  const router = useRouter();
  const { estado, agregarConversacion, agregarVacante, actualizarConversacion } =
    useApp();
  const { ajustes } = estado;

  const [canal, setCanal] = useState<Canal>("linkedin");
  const [texto, setTexto] = useState("");
  const [nombre, setNombre] = useState("");
  const [crearVacante, setCrearVacante] = useState(true);
  const [cargando, setCargando] = useState("");
  const [error, setError] = useState("");

  async function crear() {
    setError("");
    setCargando("Separando el hilo con Gemini…");
    try {
      const d = await parsearConversacion(
        ajustes.geminiApiKey,
        ajustes.modelo,
        texto,
        CANALES.find((c) => c.id === canal)!.label
      );
      const conv = agregarConversacion({
        canal,
        asunto: d.asunto,
        contacto: {
          nombre: d.contacto.nombre || nombre || "Reclutador",
          cargo: d.contacto.cargo,
          empresa: d.contacto.empresa,
          handle: d.contacto.handle,
        },
        mensajes: d.mensajes.map((m) => ({ ...m, id: nuevoId("msg") })),
      });

      // Si el reclutador describió la vacante en el propio mensaje, la
      // registramos y la enlazamos: es el caso más común en LinkedIn.
      if (crearVacante && d.contieneOferta && d.ofertaDetectada?.titulo) {
        const v = agregarVacante({
          titulo: d.ofertaDetectada.titulo,
          empresa: d.ofertaDetectada.empresa || d.contacto.empresa || "",
          ubicacion: d.ofertaDetectada.ubicacion ?? "",
          modalidad: d.ofertaDetectada.modalidad ?? "",
          salario: d.ofertaDetectada.salario ?? "",
          fuente: `${CANALES.find((c) => c.id === canal)!.label} (contacto directo)`,
          descripcion: d.ofertaDetectada.descripcion,
        });
        actualizarConversacion(conv.id, { vacanteId: v.id });
      }

      if (onListo) onListo(conv.id);
      else router.push(`/conversaciones/${conv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCargando("");
    }
  }

  /** Alta sin motor: hilo vacío al que se le van pegando mensajes a mano. */
  function crearVacia() {
    const conv = agregarConversacion({
      canal,
      asunto: nombre ? `Conversación con ${nombre}` : "Conversación nueva",
      contacto: { nombre: nombre || "Reclutador" },
      mensajes: [],
    });
    if (onListo) onListo(conv.id);
    else router.push(`/conversaciones/${conv.id}`);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="etiqueta">¿Por dónde llegó?</p>
        <div className="flex flex-wrap gap-1.5">
          {CANALES.map((c) => (
            <button
              key={c.id}
              className={`chip ${
                canal === c.id
                  ? "border-[var(--color-acento)] text-[var(--color-acento)]"
                  : ""
              }`}
              onClick={() => setCanal(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="etiqueta" htmlFor="conv-nombre">
          Nombre del reclutador (opcional, el motor suele detectarlo)
        </label>
        <input
          id="conv-nombre"
          className="campo"
          placeholder="Ej.: Rocío Martínez"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      <div>
        <label className="etiqueta" htmlFor="conv-texto">
          Conversación
        </label>
        <textarea
          id="conv-texto"
          className="campo min-h-[240px] resize-y font-mono text-xs leading-relaxed"
          placeholder={EJEMPLOS[canal]}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--color-suave)]">
          {texto.length.toLocaleString("es")} caracteres · {EJEMPLOS[canal]}
        </p>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={crearVacante}
          onChange={(e) => setCrearVacante(e.target.checked)}
        />
        <span>
          Si el hilo describe una vacante, registrarla y enlazarla
          automáticamente
          <span className="block text-xs text-[var(--color-suave)]">
            Es lo normal cuando un reclutador te escribe con la oferta completa
            en el primer mensaje.
          </span>
        </span>
      </label>

      {error && <Alerta tipo="error">{error}</Alerta>}
      {!ajustes.geminiApiKey && (
        <Alerta tipo="aviso">
          Sin API key de Gemini no se puede separar el hilo automáticamente.
          Puedes crear la conversación vacía y pegar los mensajes uno a uno.
        </Alerta>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn btn-primario"
          onClick={crear}
          disabled={
            !!cargando || texto.trim().length < 40 || !ajustes.geminiApiKey
          }
        >
          <Wand2 size={15} /> Separar hilo y crear
        </button>
        <button className="btn" onClick={crearVacia} disabled={!!cargando}>
          Crear vacía
        </button>
        {cargando && <Cargando texto={cargando} />}
      </div>
    </div>
  );
}
