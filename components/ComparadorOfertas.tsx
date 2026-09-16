"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Plus, Scale, Trash2 } from "lucide-react";
import { useApp } from "@/lib/contexto";
import {
  avisosDeOferta,
  comparar,
  diasParaDecidir,
  formatearDinero,
} from "@/lib/ofertas";
import type { OfertaRecibida, Periodo, Vacante } from "@/lib/types";
import { Alerta } from "@/components/ui";

const MONEDAS = ["USD", "EUR", "VES", "MXN", "COP", "ARS", "GBP", "CLP", "PEN", "BRL"];

/**
 * Las ofertas que tienes encima de la mesa, en la misma unidad.
 *
 * El momento en que esto hace falta es el peor posible: dos ofertas, dos días
 * para contestar y las cifras en monedas y periodos distintos. "1.800 USD al
 * mes" contra "32.000 EUR en catorce pagas" no se comparan de cabeza, y decidir
 * mal una vez cuesta un año entero.
 */
export default function ComparadorOfertas() {
  const { estado, guardarOferta, guardarAjustes } = useApp();
  const [editando, setEditando] = useState<string | null>(null);

  const monedaBase = (estado.ajustes.monedaBase || "USD").toUpperCase();
  const tasas = estado.ajustes.tasas ?? {};

  /** Vacantes donde tiene sentido registrar una oferta. */
  const candidatas = useMemo(
    () =>
      estado.vacantes.filter(
        (v) => v.oferta || ["oferta", "entrevista"].includes(v.estado)
      ),
    [estado.vacantes]
  );
  const conOferta = candidatas.filter((v) => v.oferta);

  /** El mínimo del perfil, anualizado a ojo para poder avisar. */
  const minimoAnual = useMemo(() => {
    const t = estado.perfil.preferencias.salarioMin ?? "";
    const n = Number(t.replace(/[^\d]/g, ""));
    if (!n) return null;
    // Una cifra de cuatro dígitos o menos suele ser mensual; a partir de ahí,
    // anual. Es una suposición, así que solo alimenta avisos, nunca la tabla.
    return n <= 9999 ? n * 12 : n;
  }, [estado.perfil.preferencias.salarioMin]);

  const filas = conOferta
    .map((v) => ({ v, c: comparar(v.oferta!, monedaBase, tasas) }))
    .sort((a, b) => b.c.totalAnual - a.c.totalAnual);
  const mejor = filas.find((f) => f.c.convertida);

  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Coins size={15} /> Moneda y tasas
        </h3>
        <p className="mb-3 text-xs leading-relaxed text-[var(--color-suave)]">
          Las pones tú. No se consulta ninguna API de divisas a propósito: para
          una decisión que tomas hoy, la tasa que tú fijas hoy es más honesta que
          una que se mueve sola mientras miras la tabla.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="etiqueta" htmlFor="moneda-base">
              Comparar en
            </label>
            <select
              id="moneda-base"
              className="campo w-[110px]"
              value={monedaBase}
              onChange={(e) => guardarAjustes({ monedaBase: e.target.value })}
            >
              {MONEDAS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          {[...new Set(conOferta.map((v) => v.oferta!.moneda.toUpperCase()))]
            .filter((m) => m !== monedaBase)
            .map((m) => (
              <div key={m}>
                <label className="etiqueta" htmlFor={`tasa-${m}`}>
                  1 {m} son
                </label>
                <input
                  id={`tasa-${m}`}
                  type="number"
                  step="0.0001"
                  className="campo w-[130px]"
                  placeholder={monedaBase}
                  value={tasas[m] ?? ""}
                  onChange={(e) =>
                    guardarAjustes({
                      tasas: { ...tasas, [m]: Number(e.target.value) },
                      tasasActualizadas: new Date().toISOString(),
                    })
                  }
                />
              </div>
            ))}
        </div>
        {estado.ajustes.tasasActualizadas && (
          <p className="mt-2 text-[11px] text-[var(--color-suave)]">
            Tasas puestas el{" "}
            {new Date(estado.ajustes.tasasActualizadas).toLocaleDateString("es")}.
          </p>
        )}
      </div>

      {candidatas.length === 0 && (
        <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Scale size={26} className="text-[var(--color-suave)]" />
          <p className="text-base font-semibold">Ninguna oferta que comparar</p>
          <p className="max-w-lg text-sm leading-relaxed text-[var(--color-suave)]">
            Aparecerán aquí las vacantes que estén en entrevista o en oferta. Al
            registrar sus condiciones podrás verlas todas en la misma moneda y en
            la misma unidad de tiempo.
          </p>
        </div>
      )}

      {filas.length > 1 && (
        <div className="panel overflow-x-auto p-5">
          <h3 className="mb-3 text-sm font-semibold">Lado a lado</h3>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-borde)] text-left text-xs text-[var(--color-suave)]">
                <th className="pb-2 font-semibold">Empresa</th>
                <th className="pb-2 font-semibold">Fijo al año</th>
                <th className="pb-2 font-semibold">Variable</th>
                <th className="pb-2 font-semibold">Total</th>
                <th className="pb-2 font-semibold">Oficina</th>
                <th className="pb-2 font-semibold">Vacaciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ v, c }) => (
                <tr key={v.id} className="border-b border-[var(--color-borde)] last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/vacantes/${v.id}`}
                      className="font-medium transition hover:text-[var(--color-acento)]"
                    >
                      {v.empresa}
                    </Link>
                    {mejor?.v.id === v.id && (
                      <span className="ml-1.5 text-[11px] text-emerald-300">mejor total</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">{formatearDinero(c.fijoAnual, c.moneda)}</td>
                  <td className="py-2.5 pr-3 text-[var(--color-suave)]">
                    {c.variableAnual ? formatearDinero(c.variableAnual, c.moneda) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold">
                    {c.convertida ? formatearDinero(c.totalAnual, c.moneda) : "sin tasa"}
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--color-suave)]">
                    {v.oferta?.diasOficina ?? "—"}
                    {v.oferta?.diasOficina ? " d/sem" : ""}
                  </td>
                  <td className="py-2.5 text-[var(--color-suave)]">
                    {v.oferta?.vacaciones ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-[var(--color-suave)]">
            El total es fijo más variable, anualizado y pasado a {monedaBase}. Los
            días de oficina y las vacaciones se muestran sin convertir a dinero:
            lo que valen depende de ti, no de una fórmula.
          </p>
        </div>
      )}

      {candidatas.map((v) => (
        <FichaOferta
          key={v.id}
          vacante={v}
          monedaBase={monedaBase}
          tasas={tasas}
          minimoAnual={minimoAnual}
          abierta={editando === v.id}
          onAbrir={() => setEditando(editando === v.id ? null : v.id)}
          onGuardar={(o) => {
            guardarOferta(v.id, o);
            setEditando(null);
          }}
          onBorrar={() => guardarOferta(v.id, undefined)}
        />
      ))}
    </div>
  );
}

function FichaOferta({
  vacante: v,
  monedaBase,
  tasas,
  minimoAnual,
  abierta,
  onAbrir,
  onGuardar,
  onBorrar,
}: {
  vacante: Vacante;
  monedaBase: string;
  tasas: Record<string, number>;
  minimoAnual: number | null;
  abierta: boolean;
  onAbrir: () => void;
  onGuardar: (o: OfertaRecibida) => void;
  onBorrar: () => void;
}) {
  const o = v.oferta;
  const c = o ? comparar(o, monedaBase, tasas) : null;
  const avisos = o && c ? avisosDeOferta(o, c, minimoAnual) : [];
  const plazo = diasParaDecidir(o?.fechaLimite ?? "");

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/vacantes/${v.id}`}
            className="text-sm font-semibold transition hover:text-[var(--color-acento)]"
          >
            {v.empresa}
            <span className="text-[var(--color-suave)]"> · {v.titulo}</span>
          </Link>
          {o && c && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="chip">
                {c.convertida ? formatearDinero(c.totalAnual, c.moneda) : "falta la tasa"} al año
              </span>
              {o.diasOficina !== undefined && (
                <span className="chip">{o.diasOficina} días de oficina</span>
              )}
              {plazo !== null && (
                <span
                  className={`chip ${plazo <= 2 ? "border-rose-500/40 text-rose-300" : ""}`}
                >
                  {plazo < 0
                    ? "plazo vencido"
                    : `${plazo} ${plazo === 1 ? "día" : "días"} para contestar`}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button className="btn py-1.5 text-xs" onClick={onAbrir}>
            {o ? "Editar condiciones" : (
              <>
                <Plus size={14} /> Registrar oferta
              </>
            )}
          </button>
          {o && (
            <button
              className="btn px-2 py-1.5 text-rose-300"
              title="Quitar las condiciones guardadas"
              onClick={onBorrar}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {avisos.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {avisos.map((a, i) => (
            <li key={i} className="text-sm leading-relaxed text-amber-300">
              • {a}
            </li>
          ))}
        </ul>
      )}

      {abierta && <Formulario oferta={o} onGuardar={onGuardar} />}
    </div>
  );
}

function Formulario({
  oferta,
  onGuardar,
}: {
  oferta?: OfertaRecibida;
  onGuardar: (o: OfertaRecibida) => void;
}) {
  const [f, setF] = useState<OfertaRecibida>(
    oferta ?? {
      base: 0,
      moneda: "USD",
      periodo: "mes",
      pagas: 12,
      recibidaEn: new Date().toISOString(),
    }
  );
  const set = (p: Partial<OfertaRecibida>) => setF((v) => ({ ...v, ...p }));
  const num = (t: string) => (t.trim() === "" ? undefined : Number(t));

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--color-borde)] pt-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="etiqueta" htmlFor="o-base">
            Importe
          </label>
          <input
            id="o-base"
            type="number"
            className="campo"
            value={f.base || ""}
            onChange={(e) => set({ base: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="o-moneda">
            Moneda
          </label>
          <select
            id="o-moneda"
            className="campo"
            value={f.moneda}
            onChange={(e) => set({ moneda: e.target.value })}
          >
            {MONEDAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="o-periodo">
            Por
          </label>
          <select
            id="o-periodo"
            className="campo"
            value={f.periodo}
            onChange={(e) => set({ periodo: e.target.value as Periodo })}
          >
            <option value="mes">Mes</option>
            <option value="anio">Año</option>
            <option value="hora">Hora</option>
          </select>
        </div>
        {f.periodo === "mes" && (
          <div>
            <label className="etiqueta" htmlFor="o-pagas">
              Pagas al año
            </label>
            <input
              id="o-pagas"
              type="number"
              className="campo"
              placeholder="12"
              value={f.pagas ?? ""}
              onChange={(e) => set({ pagas: num(e.target.value) })}
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className="etiqueta" htmlFor="o-variable">
            Variable al año
          </label>
          <input
            id="o-variable"
            type="number"
            className="campo"
            placeholder="0"
            value={f.variable ?? ""}
            onChange={(e) => set({ variable: num(e.target.value) })}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="o-oficina">
            Días de oficina
          </label>
          <input
            id="o-oficina"
            type="number"
            min={0}
            max={7}
            className="campo"
            value={f.diasOficina ?? ""}
            onChange={(e) => set({ diasOficina: num(e.target.value) })}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="o-vacaciones">
            Vacaciones al año
          </label>
          <input
            id="o-vacaciones"
            type="number"
            className="campo"
            value={f.vacaciones ?? ""}
            onChange={(e) => set({ vacaciones: num(e.target.value) })}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="o-limite">
            Contestar antes del
          </label>
          <input
            id="o-limite"
            type="date"
            className="campo"
            value={f.fechaLimite ?? ""}
            onChange={(e) => set({ fechaLimite: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="o-contrato">
            Tipo de contrato
          </label>
          <input
            id="o-contrato"
            className="campo"
            placeholder="Indefinido, temporal, contractor…"
            value={f.tipoContrato ?? ""}
            onChange={(e) => set({ tipoContrato: e.target.value })}
          />
        </div>
        <div>
          <label className="etiqueta" htmlFor="o-inicio">
            Incorporación
          </label>
          <input
            id="o-inicio"
            type="date"
            className="campo"
            value={f.inicio ?? ""}
            onChange={(e) => set({ inicio: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="etiqueta" htmlFor="o-notas">
          Lo que no cabe en una casilla
        </label>
        <textarea
          id="o-notas"
          className="campo min-h-[70px]"
          placeholder="Stock, seguro médico, presupuesto de formación, lo que quedó por escrito y lo que solo se dijo…"
          value={f.notas ?? ""}
          onChange={(e) => set({ notas: e.target.value })}
        />
      </div>

      <div className="flex justify-end">
        <button
          className="btn btn-primario"
          disabled={!f.base}
          onClick={() => onGuardar({ ...f, recibidaEn: f.recibidaEn || new Date().toISOString() })}
        >
          Guardar condiciones
        </button>
      </div>
    </div>
  );
}
