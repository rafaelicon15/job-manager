"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "@/lib/contexto";
import ImportarPerfil from "@/components/ImportarPerfil";
import { nuevoId } from "@/lib/store";
import { PERFIL_INICIAL } from "@/lib/seed";
import type { Experiencia, Logro, PerfilMaestro } from "@/lib/types";
import { Alerta, EsqueletoPaneles } from "@/components/ui";

export default function Perfil() {
  const { estado, listo, guardarPerfil } = useApp();
  const p = estado.perfil;
  const [abierta, setAbierta] = useState<string | null>(p.experiencias[0]?.id ?? null);

  if (!listo) return <EsqueletoPaneles />;

  const set = (parcial: Partial<PerfilMaestro>) => guardarPerfil({ ...p, ...parcial });

  const setDir = (parcial: Partial<NonNullable<PerfilMaestro["direccionPostal"]>>) =>
    set({ direccionPostal: { ...(p.direccionPostal ?? {}), ...parcial } });

  const setExp = (id: string, parcial: Partial<Experiencia>) =>
    set({
      experiencias: p.experiencias.map((e) => (e.id === id ? { ...e, ...parcial } : e)),
    });

  const setLogro = (idExp: string, idLogro: string, parcial: Partial<Logro>) =>
    setExp(idExp, {
      logros: p.experiencias
        .find((e) => e.id === idExp)!
        .logros.map((l) => (l.id === idLogro ? { ...l, ...parcial } : l)),
    });

  // Campos que hacen falta para que el CV salga completo.
  const faltantes: string[] = [];
  for (const e of p.experiencias)
    if (!e.desde) faltantes.push(`Fechas de "${e.puesto}" en ${e.empresa}`);
  if (p.idiomas.some((i) => /pendiente/i.test(i.nivel)))
    faltantes.push("Tu nivel real de inglés");
  if (!p.preferencias.salarioObjetivo)
    faltantes.push("Tu expectativa salarial (para responder a los formularios)");

  return (
    <div className="max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Perfil maestro</h1>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-suave)]">
          Esta es la única fuente de verdad del sistema. El motor tiene prohibido
          afirmar nada que no esté aquí: si no lo escribes, no lo dice.
        </p>
      </header>

      {faltantes.length > 0 && (
        <Alerta tipo="aviso">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle size={14} /> Completa esto para que los CVs salgan enteros:
          </p>
          <ul className="space-y-0.5">
            {faltantes.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </Alerta>
      )}

      <ImportarPerfil />

      <Bloque titulo="Datos de contacto">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre" valor={p.nombre} onChange={(v) => set({ nombre: v })} />
          <Campo label="Email" valor={p.email} onChange={(v) => set({ email: v })} />
          <Campo
            label="Teléfono"
            valor={p.telefono}
            onChange={(v) => set({ telefono: v })}
          />
          <Campo
            label="Ubicación"
            valor={p.ubicacion}
            onChange={(v) => set({ ubicacion: v })}
          />
          <Campo
            label="Fecha de nacimiento"
            valor={p.fechaNacimiento ?? ""}
            onChange={(v) => set({ fechaNacimiento: v })}
            tipo="date"
            ayuda="Opcional. Solo para que la extensión rellene los formularios que la piden. No sale en el CV ni se manda a ningún sitio."
          />
        </div>
        <div>
          <p className="etiqueta">Nombre partido, para los formularios</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              label="Nombre"
              valor={p.nombrePila ?? ""}
              placeholder="Ana"
              onChange={(v) => set({ nombrePila: v })}
            />
            <Campo
              label="Segundo nombre"
              valor={p.segundoNombre ?? ""}
              placeholder="Beatriz"
              onChange={(v) => set({ segundoNombre: v })}
            />
            <Campo
              label="Apellidos"
              valor={p.apellidos ?? ""}
              placeholder="Torres Gil"
              onChange={(v) => set({ apellidos: v })}
            />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-suave)]">
            Muchos formularios piden el nombre en trozos. Esto no se puede
            deducir: de una inicial no hay forma de sacar el nombre que hay
            detrás. Si lo dejas vacío se parte lo mejor posible, pero
            rellenarlo lo arregla.
          </p>
        </div>

        <Campo
          label="Titular (español)"
          valor={p.titular}
          onChange={(v) => set({ titular: v })}
        />
        <Campo
          label="Titular (inglés)"
          valor={p.titularEn}
          onChange={(v) => set({ titularEn: v })}
        />
        <Area
          label="Resumen profesional (español)"
          valor={p.resumen}
          onChange={(v) => set({ resumen: v })}
        />
        <Area
          label="Resumen profesional (inglés)"
          valor={p.resumenEn}
          onChange={(v) => set({ resumenEn: v })}
        />

        <div>
          <p className="etiqueta">Enlaces</p>
          <div className="space-y-2">
            {p.links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="campo w-[170px]"
                  value={l.etiqueta}
                  onChange={(e) =>
                    set({
                      links: p.links.map((x, j) =>
                        j === i ? { ...x, etiqueta: e.target.value } : x
                      ),
                    })
                  }
                />
                <input
                  className="campo flex-1"
                  value={l.url}
                  onChange={(e) =>
                    set({
                      links: p.links.map((x, j) =>
                        j === i ? { ...x, url: e.target.value } : x
                      ),
                    })
                  }
                />
                <button
                  className="btn px-2 text-rose-300"
                  onClick={() => set({ links: p.links.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="btn"
              onClick={() => set({ links: [...p.links, { etiqueta: "", url: "" }] })}
            >
              <Plus size={15} /> Añadir enlace
            </button>
          </div>
        </div>
      </Bloque>

      <Bloque titulo="Dirección postal">
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          A dónde te mandan las cosas, que no tiene por qué ser donde trabajas.
          La <strong>ubicación</strong> de arriba es la profesional y sale en el
          CV; esto <strong>solo</strong> se usa para rellenar formularios y no
          aparece en ningún documento. Déjalo vacío si prefieres escribirlo a
          mano cada vez.
        </p>
        <Campo
          label="Calle y número"
          valor={p.direccionPostal?.calle ?? ""}
          onChange={(v) => setDir({ calle: v })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Ciudad"
            valor={p.direccionPostal?.ciudad ?? ""}
            onChange={(v) => setDir({ ciudad: v })}
          />
          <Campo
            label="Estado o provincia"
            valor={p.direccionPostal?.provincia ?? ""}
            onChange={(v) => setDir({ provincia: v })}
          />
          <Campo
            label="Código postal"
            valor={p.direccionPostal?.codigoPostal ?? ""}
            onChange={(v) => setDir({ codigoPostal: v })}
          />
          <Campo
            label="País"
            valor={p.direccionPostal?.pais ?? ""}
            onChange={(v) => setDir({ pais: v })}
          />
        </div>
      </Bloque>

      <Bloque titulo={`Experiencia (${p.experiencias.length})`}>
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          Cada logro es un ladrillo reutilizable. Cuanto más concreto y medible, mejor
          CV genera el motor. Los ángulos determinan para qué tipo de vacante se usa
          ese logro.
        </p>
        <div className="space-y-2">
          {p.experiencias.map((e) => (
            <div key={e.id} className="panel overflow-hidden">
              <button
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => setAbierta(abierta === e.id ? null : e.id)}
              >
                <ChevronDown
                  size={16}
                  className={`shrink-0 transition ${abierta === e.id ? "rotate-180" : ""}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.puesto}</span>
                  <span className="block truncate text-xs text-[var(--color-suave)]">
                    {e.empresa} · {e.logros.length} logros
                    {!e.desde && " · ⚠ sin fechas"}
                  </span>
                </span>
              </button>

              {abierta === e.id && (
                <div className="space-y-3 border-t border-[var(--color-borde)] p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Campo
                      label="Puesto"
                      valor={e.puesto}
                      onChange={(v) => setExp(e.id, { puesto: v })}
                    />
                    <Campo
                      label="Empresa"
                      valor={e.empresa}
                      onChange={(v) => setExp(e.id, { empresa: v })}
                    />
                    <Campo
                      label="Ubicación"
                      valor={e.ubicacion}
                      onChange={(v) => setExp(e.id, { ubicacion: v })}
                    />
                    <Campo
                      label="Modalidad"
                      valor={e.modalidad}
                      onChange={(v) => setExp(e.id, { modalidad: v })}
                    />
                    <Campo
                      label="Desde (ej. Ene 2023)"
                      valor={e.desde}
                      onChange={(v) => setExp(e.id, { desde: v })}
                      placeholder="Ene 2023"
                    />
                    <Campo
                      label="Hasta (o Actualidad)"
                      valor={e.hasta}
                      onChange={(v) => setExp(e.id, { hasta: v })}
                      placeholder="Actualidad"
                    />
                  </div>

                  <div>
                    <p className="etiqueta">Logros</p>
                    <div className="space-y-3">
                      {e.logros.map((l) => (
                        <div
                          key={l.id}
                          className="rounded-lg border border-[var(--color-borde)] p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <code className="text-[10px] text-[var(--color-suave)]">
                              {l.id}
                            </code>
                            <button
                              className="btn px-2 py-1 text-rose-300"
                              onClick={() =>
                                setExp(e.id, {
                                  logros: e.logros.filter((x) => x.id !== l.id),
                                })
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <textarea
                            className="campo min-h-[68px] resize-y text-sm"
                            value={l.texto}
                            onChange={(ev) =>
                              setLogro(e.id, l.id, { texto: ev.target.value })
                            }
                          />
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <input
                              className="campo text-xs"
                              placeholder="Métrica (ej. +87% conversiones)"
                              value={l.metrica ?? ""}
                              onChange={(ev) =>
                                setLogro(e.id, l.id, { metrica: ev.target.value })
                              }
                            />
                            <input
                              className="campo text-xs"
                              placeholder="Ángulos: cro, ppc, web, ti, ia, seo"
                              value={l.angulos.join(", ")}
                              onChange={(ev) =>
                                setLogro(e.id, l.id, {
                                  angulos: ev.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                            <input
                              className="campo text-xs"
                              placeholder="Keywords ATS"
                              value={l.keywords.join(", ")}
                              onChange={(ev) =>
                                setLogro(e.id, l.id, {
                                  keywords: ev.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        className="btn"
                        onClick={() =>
                          setExp(e.id, {
                            logros: [
                              ...e.logros,
                              {
                                id: nuevoId("l"),
                                texto: "",
                                angulos: [],
                                keywords: [],
                              },
                            ],
                          })
                        }
                      >
                        <Plus size={15} /> Añadir logro
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn btn-peligro"
                    onClick={() => {
                      if (confirm(`¿Eliminar la experiencia en ${e.empresa}?`))
                        set({
                          experiencias: p.experiencias.filter((x) => x.id !== e.id),
                        });
                    }}
                  >
                    <Trash2 size={15} /> Eliminar experiencia
                  </button>
                </div>
              )}
            </div>
          ))}
          <button
            className="btn"
            onClick={() => {
              const id = nuevoId("exp");
              set({
                experiencias: [
                  {
                    id,
                    puesto: "Nuevo puesto",
                    empresa: "",
                    ubicacion: "",
                    modalidad: "",
                    desde: "",
                    hasta: "",
                    resumen: "",
                    logros: [],
                  },
                  ...p.experiencias,
                ],
              });
              setAbierta(id);
            }}
          >
            <Plus size={15} /> Añadir experiencia
          </button>
        </div>
      </Bloque>

      <Bloque titulo="Habilidades">
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          El nivel importa: el motor no venderá como experto algo que marques 1 o 2.
          Formato por línea: <code>Herramienta | nivel 1-4</code>
        </p>
        {p.habilidades.map((g, i) => (
          <div key={i}>
            <div className="mb-1.5 flex gap-2">
              <input
                className="campo flex-1 font-semibold"
                value={g.categoria}
                onChange={(e) =>
                  set({
                    habilidades: p.habilidades.map((x, j) =>
                      j === i ? { ...x, categoria: e.target.value } : x
                    ),
                  })
                }
              />
              <button
                className="btn px-2 text-rose-300"
                onClick={() =>
                  set({ habilidades: p.habilidades.filter((_, j) => j !== i) })
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
            <textarea
              className="campo min-h-[92px] resize-y font-mono text-xs"
              value={g.items.map((it) => `${it.nombre} | ${it.nivel}`).join("\n")}
              onChange={(e) =>
                set({
                  habilidades: p.habilidades.map((x, j) =>
                    j === i
                      ? {
                          ...x,
                          items: e.target.value
                            .split("\n")
                            .map((linea) => {
                              const [nombre, nivel] = linea.split("|");
                              if (!nombre?.trim()) return null;
                              const n = Number(nivel?.trim());
                              return {
                                nombre: nombre.trim(),
                                nivel: ([1, 2, 3, 4].includes(n) ? n : 3) as 1 | 2 | 3 | 4,
                              };
                            })
                            .filter(Boolean) as { nombre: string; nivel: 1 | 2 | 3 | 4 }[],
                        }
                      : x
                  ),
                })
              }
            />
          </div>
        ))}
        <button
          className="btn"
          onClick={() =>
            set({
              habilidades: [...p.habilidades, { categoria: "Nueva categoría", items: [] }],
            })
          }
        >
          <Plus size={15} /> Añadir categoría
        </button>
      </Bloque>

      <Bloque titulo="Idiomas">
        {p.idiomas.map((i, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              className="campo w-[170px]"
              value={i.idioma}
              onChange={(e) =>
                set({
                  idiomas: p.idiomas.map((x, j) =>
                    j === idx ? { ...x, idioma: e.target.value } : x
                  ),
                })
              }
            />
            <input
              className="campo flex-1"
              placeholder="Ej.: B2 profesional, C1, nativo…"
              value={i.nivel}
              onChange={(e) =>
                set({
                  idiomas: p.idiomas.map((x, j) =>
                    j === idx ? { ...x, nivel: e.target.value } : x
                  ),
                })
              }
            />
            <button
              className="btn px-2 text-rose-300"
              onClick={() => set({ idiomas: p.idiomas.filter((_, j) => j !== idx) })}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          className="btn"
          onClick={() => set({ idiomas: [...p.idiomas, { idioma: "", nivel: "" }] })}
        >
          <Plus size={15} /> Añadir idioma
        </button>
      </Bloque>

      <Bloque titulo={`Certificaciones (${p.certificaciones.length})`}>
        <p className="text-xs text-[var(--color-suave)]">
          Una por línea, formato <code>Nombre | Emisor</code>
        </p>
        <textarea
          className="campo min-h-[200px] resize-y font-mono text-xs"
          value={p.certificaciones.map((c) => `${c.nombre} | ${c.emisor}`).join("\n")}
          onChange={(e) =>
            set({
              certificaciones: e.target.value
                .split("\n")
                .map((linea, i) => {
                  const [nombre, emisor] = linea.split("|");
                  if (!nombre?.trim()) return null;
                  return {
                    id: `c${i}`,
                    nombre: nombre.trim(),
                    emisor: (emisor ?? "").trim(),
                  };
                })
                .filter(Boolean) as { id: string; nombre: string; emisor: string }[],
            })
          }
        />
      </Bloque>

      <Bloque titulo="Preferencias de búsqueda">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            label="Modalidad"
            valor={p.preferencias.modalidad}
            onChange={(v) => set({ preferencias: { ...p.preferencias, modalidad: v } })}
          />
          <Campo
            label="Disponibilidad"
            valor={p.preferencias.disponibilidad}
            onChange={(v) =>
              set({ preferencias: { ...p.preferencias, disponibilidad: v } })
            }
          />
          <Campo
            label="Salario mínimo aceptable"
            valor={p.preferencias.salarioMin ?? ""}
            placeholder="Ej.: 1.200 USD/mes"
            onChange={(v) => set({ preferencias: { ...p.preferencias, salarioMin: v } })}
          />
          <Campo
            label="Salario objetivo"
            valor={p.preferencias.salarioObjetivo ?? ""}
            placeholder="Ej.: 1.800-2.200 USD/mes"
            onChange={(v) =>
              set({ preferencias: { ...p.preferencias, salarioObjetivo: v } })
            }
          />
        </div>
        <Area
          label="Roles objetivo (uno por línea)"
          valor={p.preferencias.rolesObjetivo.join("\n")}
          onChange={(v) =>
            set({
              preferencias: {
                ...p.preferencias,
                rolesObjetivo: v.split("\n").map((s) => s.trim()).filter(Boolean),
              },
            })
          }
        />
        <Area
          label="Palabras clave de búsqueda (una por línea)"
          valor={p.preferencias.keywordsBusqueda.join("\n")}
          onChange={(v) =>
            set({
              preferencias: {
                ...p.preferencias,
                keywordsBusqueda: v.split("\n").map((s) => s.trim()).filter(Boolean),
              },
            })
          }
        />
      </Bloque>

      <Bloque titulo="Líneas rojas del motor">
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          Estas reglas se inyectan en cada prompt. Son lo que impide que el sistema
          te haga quedar mal inventando algo que no puedes sostener en una entrevista.
        </p>
        <Area
          label="Una regla por línea"
          valor={p.lineasRojas.join("\n")}
          onChange={(v) =>
            set({ lineasRojas: v.split("\n").map((s) => s.trim()).filter(Boolean) })
          }
        />
      </Bloque>

      <Bloque titulo="Perfil psicométrico (Wonderlic Select)">
        <p className="text-xs leading-relaxed text-[var(--color-suave)]">
          Resultado de tu test real. El motor lo usa para que las respuestas suenen a
          ti y para respaldar soft skills con una fuente objetiva.
        </p>
        {p.psicometria.map((r, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-borde)] p-3">
            <p className="text-sm font-semibold">{r.titulo}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.etiquetas.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
            <ul className="mt-2 space-y-1">
              {r.implicaciones.map((im, j) => (
                <li key={j} className="text-xs leading-relaxed text-[var(--color-suave)]">
                  • {im}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Bloque>

      <button
        className="btn"
        onClick={() => {
          if (
            confirm(
              "Esto devuelve el perfil maestro a los datos originales de tu CV y descarta todos tus cambios. Las vacantes no se tocan. ¿Continuar?"
            )
          )
            guardarPerfil(PERFIL_INICIAL);
        }}
      >
        <RotateCcw size={15} /> Restaurar perfil original
      </button>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="panel space-y-3 p-5">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

/**
 * Escribe en un estado local y solo avisa al salir del campo.
 *
 * Antes cada tecla guardaba el perfil entero en el navegador y redibujaba la
 * página. En un campo de fecha eso rompía la escritura: el navegador mantiene
 * tres segmentos (día, mes, año) con su propio estado interno, y devolvérselos
 * reescritos a media pulsación los deja congelados en un año a medio teclear,
 * del tipo "0008". También hacía que escribir un resumen largo guardara en
 * disco una vez por letra.
 *
 * `useRef` guarda lo último que llegó de fuera: si el perfil cambia por otra
 * vía —al cargarlo desde una IA, por ejemplo— el campo se actualiza, pero sin
 * pisar lo que se esté escribiendo en ese momento.
 */
function useCampoLocal(valor: string, onChange: (v: string) => void) {
  const [texto, setTexto] = useState(valor);
  const ultimoExterno = useRef(valor);

  if (valor !== ultimoExterno.current) {
    ultimoExterno.current = valor;
    if (valor !== texto) setTexto(valor);
  }

  return {
    value: texto,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setTexto(e.target.value),
    onBlur: () => {
      if (texto !== ultimoExterno.current) {
        ultimoExterno.current = texto;
        onChange(texto);
      }
    },
  };
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  tipo = "text",
  ayuda,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
  ayuda?: string;
}) {
  const enlace = useCampoLocal(valor, onChange);
  return (
    <div>
      <label className="etiqueta">{label}</label>
      <input className="campo" type={tipo} placeholder={placeholder} {...enlace} />
      {ayuda && (
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-suave)]">{ayuda}</p>
      )}
    </div>
  );
}

function Area({
  label,
  valor,
  onChange,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
}) {
  const enlace = useCampoLocal(valor, onChange);
  return (
    <div>
      <label className="etiqueta">{label}</label>
      <textarea className="campo min-h-[110px] resize-y" {...enlace} />
    </div>
  );
}
