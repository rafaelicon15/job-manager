"use client";

import { useState } from "react";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { nuevoId } from "@/lib/store";
import type { Logro, PerfilMaestro, Referencia } from "@/lib/types";
import { Alerta } from "@/components/ui";

/** Una referencia quemada son tres llamadas en este plazo. */
const DIAS_QUEMADA = 60;
const USOS_QUEMADA = 3;

/**
 * La gente que puede responder por ti.
 *
 * Dos cosas que en ningún sitio se apuntan y luego hacen falta con prisa. La
 * primera, qué puede confirmar cada persona: se ata a los ids de los logros del
 * perfil, igual que los puntos del CV, para no mandar a un reclutador a
 * preguntarle a alguien por un proyecto en el que no estuvo. La segunda, a
 * quién le has dado su nombre y cuándo, porque una referencia se quema: tres
 * llamadas en dos meses y deja de coger el teléfono.
 */
export default function Referencias({
  perfil,
  onCambio,
}: {
  perfil: PerfilMaestro;
  onCambio: (r: Referencia[]) => void;
}) {
  const referencias = perfil.referencias ?? [];
  const [abierta, setAbierta] = useState<string | null>(null);

  const logros: Logro[] = perfil.experiencias.flatMap((e) => e.logros);
  const empresaDelLogro = (id: string) =>
    perfil.experiencias.find((e) => e.logros.some((l) => l.id === id))?.empresa ?? "";

  const set = (id: string, parcial: Partial<Referencia>) =>
    onCambio(referencias.map((r) => (r.id === id ? { ...r, ...parcial } : r)));

  function anadir() {
    const nueva: Referencia = {
      id: nuevoId("ref"),
      nombre: "",
      relacion: "",
      respalda: [],
      usos: [],
    };
    onCambio([...referencias, nueva]);
    setAbierta(nueva.id);
  }

  function quemada(r: Referencia): boolean {
    const limite = Date.now() - DIAS_QUEMADA * 864e5;
    return r.usos.filter((u) => new Date(u.fecha).getTime() >= limite).length >= USOS_QUEMADA;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          Te las piden siempre en el último momento. Apunta también qué vivió
          cada persona: una referencia solo sirve para confirmar lo que de verdad
          vio.
        </p>
        <button className="btn shrink-0 py-1.5 text-xs" onClick={anadir}>
          <Plus size={14} /> Añadir referencia
        </button>
      </div>

      {referencias.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--color-suave)]">
          Sin referencias apuntadas.
        </p>
      )}

      {referencias.map((r) => {
        const abierto = abierta === r.id;
        return (
          <div key={r.id} className="rounded-lg border border-[var(--color-borde)] p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => setAbierta(abierto ? null : r.id)}
              >
                <p className="text-sm font-semibold">
                  {r.nombre || "Sin nombre"}
                  {r.cargo && (
                    <span className="font-normal text-[var(--color-suave)]"> · {r.cargo}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-suave)]">
                  {r.relacion || "Sin relación anotada"}
                  {r.respalda.length > 0 &&
                    ` · confirma ${r.respalda.length} ${r.respalda.length === 1 ? "logro" : "logros"}`}
                  {r.usos.length > 0 && ` · dada ${r.usos.length} ${r.usos.length === 1 ? "vez" : "veces"}`}
                </p>
              </button>
              <button
                className="btn shrink-0 px-2 py-1 text-rose-300"
                title="Eliminar esta referencia"
                onClick={() => onCambio(referencias.filter((x) => x.id !== r.id))}
              >
                <Trash2 size={13} />
              </button>
            </div>

            {quemada(r) && (
              <div className="mt-2">
                <Alerta tipo="aviso">
                  Has dado su nombre {r.usos.length} veces en los últimos dos meses.
                  Avísale antes de volver a darlo, o usa a otra persona.
                </Alerta>
              </div>
            )}

            {abierto && (
              <div className="mt-3 space-y-3 border-t border-[var(--color-borde)] pt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo
                    label="Nombre"
                    valor={r.nombre}
                    onChange={(v) => set(r.id, { nombre: v })}
                  />
                  <Campo
                    label="Cargo"
                    valor={r.cargo ?? ""}
                    onChange={(v) => set(r.id, { cargo: v })}
                  />
                  <Campo
                    label="Empresa"
                    valor={r.empresa ?? ""}
                    onChange={(v) => set(r.id, { empresa: v })}
                  />
                  <Campo
                    label="Cómo contactarla"
                    valor={r.contacto ?? ""}
                    onChange={(v) => set(r.id, { contacto: v })}
                  />
                </div>
                <Campo
                  label="De qué te conoce"
                  valor={r.relacion}
                  placeholder="Fue mi responsable directo en…"
                  onChange={(v) => set(r.id, { relacion: v })}
                />

                <div>
                  <p className="etiqueta">Qué puede confirmar</p>
                  {logros.length === 0 ? (
                    <p className="text-xs text-[var(--color-suave)]">
                      Todavía no hay logros en tu perfil que enlazar.
                    </p>
                  ) : (
                    <ul className="max-h-48 space-y-1 overflow-auto rounded-lg border border-[var(--color-borde)] p-2">
                      {logros.map((l) => (
                        <li key={l.id}>
                          <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed">
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={r.respalda.includes(l.id)}
                              onChange={(e) =>
                                set(r.id, {
                                  respalda: e.target.checked
                                    ? [...r.respalda, l.id]
                                    : r.respalda.filter((x) => x !== l.id),
                                })
                              }
                            />
                            <span>
                              <span className="text-[var(--color-suave)]">
                                {empresaDelLogro(l.id)}:{" "}
                              </span>
                              {l.texto.slice(0, 120)}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Usos referencia={r} onCambio={(usos) => set(r.id, { usos })} />

                <Campo
                  label="Notas"
                  valor={r.notas ?? ""}
                  placeholder="Prefiere que le escriban antes por WhatsApp…"
                  onChange={(v) => set(r.id, { notas: v })}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Usos({
  referencia: r,
  onCambio,
}: {
  referencia: Referencia;
  onCambio: (u: Referencia["usos"]) => void;
}) {
  const [empresa, setEmpresa] = useState("");

  return (
    <div>
      <p className="etiqueta">A quién le has dado su nombre</p>
      <div className="flex gap-2">
        <input
          className="campo flex-1 py-1.5 text-xs"
          placeholder="Empresa a la que se la diste"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !empresa.trim()) return;
            onCambio([...r.usos, { empresa: empresa.trim(), fecha: new Date().toISOString() }]);
            setEmpresa("");
          }}
        />
        <button
          className="btn py-1.5 text-xs"
          disabled={!empresa.trim()}
          onClick={() => {
            onCambio([...r.usos, { empresa: empresa.trim(), fecha: new Date().toISOString() }]);
            setEmpresa("");
          }}
        >
          <UserCheck size={14} /> Apuntar
        </button>
      </div>
      {r.usos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {[...r.usos]
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 text-xs text-[var(--color-suave)]"
              >
                <span>
                  {u.empresa} · {new Date(u.fecha).toLocaleDateString("es")}
                </span>
                <button
                  className="text-rose-300"
                  title="Quitar"
                  onClick={() => onCambio(r.usos.filter((x) => x !== u))}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Campo({
  label,
  valor,
  placeholder,
  onChange,
}: {
  label: string;
  valor: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="etiqueta">{label}</label>
      <input
        className="campo"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
