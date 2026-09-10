"use client";

import { useRef, useState } from "react";
import { Download, Eye, EyeOff, ShieldAlert, Upload } from "lucide-react";
import { useApp } from "@/lib/contexto";
import { MODELOS } from "@/lib/gemini";
import { Alerta, EsqueletoPaneles } from "@/components/ui";
import EstadoConfiguracion from "@/components/EstadoConfiguracion";

export default function Ajustes() {
  const { estado, listo, guardarAjustes, exportar, importar, diasSinRespaldo } = useApp();
  const { ajustes } = estado;
  const [verClave, setVerClave] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const archivoRef = useRef<HTMLInputElement>(null);

  if (!listo) return <EsqueletoPaneles />;

  async function alImportar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (
      !confirm(
        "Importar reemplaza TODO lo que tienes ahora (vacantes, perfil y ajustes) por el contenido del archivo. ¿Continuar?"
      )
    ) {
      e.target.value = "";
      return;
    }
    try {
      importar(await f.text());
      setMensaje("Respaldo importado correctamente.");
    } catch {
      setMensaje("No se pudo leer el archivo. ¿Seguro que es un respaldo de esta app?");
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Ajustes</h1>
        <p className="mt-1 text-sm text-[var(--color-suave)]">
          Todo se guarda en este navegador. Nada viaja a ningún servidor nuestro.
        </p>
      </header>

      {mensaje && <Alerta tipo="ok">{mensaje}</Alerta>}

      <EstadoConfiguracion />

      <section className="panel space-y-4 p-5">
        <h2 className="text-sm font-semibold">Motor de IA (Gemini)</h2>

        <div>
          <label className="etiqueta" htmlFor="apikey">
            API key de Google AI Studio
          </label>
          <div className="flex gap-2">
            <input
              id="apikey"
              type={verClave ? "text" : "password"}
              className="campo flex-1 font-mono"
              placeholder="AIza…"
              autoComplete="off"
              value={ajustes.geminiApiKey}
              onChange={(e) => guardarAjustes({ geminiApiKey: e.target.value.trim() })}
            />
            <button
              className="btn px-2.5"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? "Ocultar clave" : "Mostrar clave"}
            >
              {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-suave)]">
            Genérala gratis en{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-acento)] underline"
            >
              aistudio.google.com/apikey
            </a>
            .
          </p>
        </div>

        <Alerta tipo="aviso">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <ShieldAlert size={14} /> Dónde vive esta clave.
          </span>{" "}
          Se guarda solo en este navegador. Las llamadas a Gemini no salen de aquí:
          pasan por el servidor de la app, porque Google bloquea las peticiones que
          salen de Venezuela. La clave viaja en esa petición, se usa y no se guarda
          en el servidor. Aun así, ponle un límite de cuota desde Google Cloud: sigue
          siendo legible para quien abra la consola en tu equipo.
        </Alerta>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="modelo">
              Modelo para análisis y triaje
            </label>
            <select
              id="modelo"
              className="campo"
              value={ajustes.modelo}
              onChange={(e) => guardarAjustes({ modelo: e.target.value })}
            >
              {MODELOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="modelo-gen">
              Modelo para generar CV y respuestas
            </label>
            <select
              id="modelo-gen"
              className="campo"
              value={ajustes.modeloGeneracion}
              onChange={(e) => guardarAjustes({ modeloGeneracion: e.target.value })}
            >
              {MODELOS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-suave)]">
              Flash Lite es el más fiable en el plan gratuito: en pruebas
              respondió 6 de 6 veces, mientras que Flash fallaba por saturación
              casi siempre. Si eliges otro y se satura, la app cae sola a Flash
              Lite en vez de darte un error. Pro no tiene cuota gratuita.
            </p>
          </div>
        </div>

        <div>
          <label className="etiqueta" htmlFor="idioma">
            Idioma por defecto de los documentos
          </label>
          <select
            id="idioma"
            className="campo max-w-[220px]"
            value={ajustes.idiomaPorDefecto}
            onChange={(e) =>
              guardarAjustes({ idiomaPorDefecto: e.target.value as "es" | "en" })
            }
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Fuentes de vacantes con clave</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-suave)]">
            Las otras cinco fuentes (Remotive, RemoteOK, Arbeitnow, Jobicy,
            WeWorkRemotely) funcionan sin configurar nada. Estas dos son las que
            traen vacantes en español y ofertas no remotas.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="adzuna-id">
              Adzuna App ID
            </label>
            <input
              id="adzuna-id"
              className="campo font-mono"
              autoComplete="off"
              value={ajustes.adzunaAppId}
              onChange={(e) => guardarAjustes({ adzunaAppId: e.target.value.trim() })}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="adzuna-key">
              Adzuna App Key
            </label>
            <input
              id="adzuna-key"
              type="password"
              className="campo font-mono"
              autoComplete="off"
              value={ajustes.adzunaAppKey}
              onChange={(e) => guardarAjustes({ adzunaAppKey: e.target.value.trim() })}
            />
          </div>
        </div>
        <p className="text-xs text-[var(--color-suave)]">
          Regístrate gratis en{" "}
          <a
            href="https://developer.adzuna.com/signup"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-acento)] underline"
          >
            developer.adzuna.com/signup
          </a>{" "}
          — te dan App ID y App Key al instante, sin tarjeta.
        </p>

        <div>
          <label className="etiqueta" htmlFor="jooble">
            Jooble API key
          </label>
          <input
            id="jooble"
            type="password"
            className="campo font-mono"
            autoComplete="off"
            value={ajustes.joobleKey}
            onChange={(e) => guardarAjustes({ joobleKey: e.target.value.trim() })}
          />
          <p className="mt-1.5 text-xs text-[var(--color-suave)]">
            Solicítala en{" "}
            <a
              href="https://jooble.org/api/about"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-acento)] underline"
            >
              jooble.org/api/about
            </a>
            . Cubre Venezuela y LatAm, que es donde las otras fuentes flojean.
          </p>
        </div>

        <div>
          <label className="etiqueta" htmlFor="careerjet">
            Careerjet API key
          </label>
          <input
            id="careerjet"
            type="password"
            className="campo font-mono"
            autoComplete="off"
            value={ajustes.careerjetKey}
            onChange={(e) => guardarAjustes({ careerjetKey: e.target.value.trim() })}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-suave)]">
            Gratuita, 1.000 peticiones por hora. Pídela en{" "}
            <a
              href="https://www.careerjet.com/partners/api"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--color-acento)] underline"
            >
              careerjet.com/partners/api
            </a>
            . Cubre Venezuela, España y LatAm, que es tu mercado real.
          </p>
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold">Respaldo de tus datos</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-suave)]">
            Tus vacantes, análisis y documentos viven en el almacenamiento de este
            navegador. Si limpias la caché, cambias de equipo o usas otro navegador,
            no estarán ahí. Descarga un respaldo cada semana.
          </p>
        </div>

        {diasSinRespaldo !== null ? (
          <p className="text-xs text-[var(--color-suave)]">
            Último respaldo: hace {diasSinRespaldo}{" "}
            {diasSinRespaldo === 1 ? "día" : "días"}.
          </p>
        ) : (
          <p className="text-xs text-amber-300">Nunca has respaldado.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primario" onClick={exportar}>
            <Download size={15} className="icono-late" /> Descargar respaldo
          </button>
          <button className="btn" onClick={() => archivoRef.current?.click()}>
            <Upload size={15} /> Importar respaldo
          </button>
          <input
            ref={archivoRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={alImportar}
          />
        </div>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-rose-300">Zona peligrosa</h2>
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          Borra todas las vacantes, análisis, documentos y ajustes de este navegador y
          deja el perfil maestro como venía de fábrica.
        </p>
        <button
          className="btn btn-peligro"
          onClick={() => {
            if (
              confirm(
                "Esto borra TODO: vacantes, análisis, documentos, claves y cambios del perfil. ¿Descargaste un respaldo antes?"
              ) &&
              confirm("Confirmación final: no hay vuelta atrás. ¿Borrar todo?")
            ) {
              window.localStorage.removeItem("rjm:estado:v1");
              window.location.href = "/";
            }
          }}
        >
          Borrar todos mis datos
        </button>
      </section>
    </div>
  );
}
