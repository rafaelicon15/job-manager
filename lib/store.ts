"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Ajustes,
  Conversacion,
  DocumentoGenerado,
  EstadoApp,
  EstadoVacante,
  Mensaje,
  PerfilMaestro,
  Vacante,
} from "./types";
import { ESTADO_INICIAL } from "./seed";

const CLAVE = "rjm:estado:v1";

/** Fusiona el estado guardado con el inicial para que campos nuevos no rompan datos viejos. */
function hidratar(crudo: string | null): EstadoApp {
  if (!crudo) return ESTADO_INICIAL;
  try {
    const guardado = JSON.parse(crudo) as Partial<EstadoApp>;
    return {
      version: ESTADO_INICIAL.version,
      perfil: { ...ESTADO_INICIAL.perfil, ...(guardado.perfil ?? {}) },
      // Los campos nuevos se rellenan al leer: un estado guardado antes de
      // que existieran los adjuntos traeria `undefined` y el primer .map()
      // sobre el reventaria la app al abrirla.
      vacantes: (guardado.vacantes ?? []).map((v) => ({
        ...v,
        documentos: v.documentos ?? [],
        notas: v.notas ?? [],
        adjuntos: v.adjuntos ?? [],
      })),
      conversaciones: (guardado.conversaciones ?? []).map((c) => ({
        ...c,
        mensajes: c.mensajes ?? [],
        pendientes: c.pendientes ?? [],
        preguntasSinResponder: c.preguntasSinResponder ?? [],
        incoherencias: c.incoherencias ?? [],
        adjuntos: c.adjuntos ?? [],
      })),
      ajustes: { ...ESTADO_INICIAL.ajustes, ...(guardado.ajustes ?? {}) },
    };
  } catch {
    return ESTADO_INICIAL;
  }
}

export function nuevoId(prefijo = "id"): string {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function useEstado() {
  const [estado, setEstado] = useState<EstadoApp>(ESTADO_INICIAL);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    setEstado(hidratar(window.localStorage.getItem(CLAVE)));
    setListo(true);
  }, []);

  // Persiste en cada cambio, pero solo después de hidratar para no pisar
  // los datos guardados con el estado inicial durante el primer render.
  useEffect(() => {
    if (!listo) return;
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      console.error("No se pudo guardar en localStorage", e);
    }
  }, [estado, listo]);

  // Mantiene sincronizadas varias pestañas abiertas a la vez.
  useEffect(() => {
    function alCambiar(e: StorageEvent) {
      if (e.key === CLAVE) setEstado(hidratar(e.newValue));
    }
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const guardarPerfil = useCallback((perfil: PerfilMaestro) => {
    setEstado((s) => ({ ...s, perfil }));
  }, []);

  const guardarAjustes = useCallback((parcial: Partial<Ajustes>) => {
    setEstado((s) => ({ ...s, ajustes: { ...s.ajustes, ...parcial } }));
  }, []);

  const agregarVacante = useCallback(
    (v: Omit<Vacante, "id" | "creadaEn" | "actualizadaEn" | "documentos" | "notas" | "adjuntos" | "favorito" | "estado"> &
      Partial<Pick<Vacante, "estado" | "favorito">>) => {
      const ahora = new Date().toISOString();
      const vacante: Vacante = {
        id: nuevoId("vac"),
        estado: v.estado ?? "descubierta",
        favorito: v.favorito ?? false,
        creadaEn: ahora,
        actualizadaEn: ahora,
        documentos: [],
        notas: [],
        adjuntos: [],
        ...v,
      } as Vacante;
      setEstado((s) => ({ ...s, vacantes: [vacante, ...s.vacantes] }));
      return vacante;
    },
    []
  );

  const actualizarVacante = useCallback(
    (id: string, parcial: Partial<Vacante>) => {
      setEstado((s) => ({
        ...s,
        vacantes: s.vacantes.map((v) =>
          v.id === id
            ? { ...v, ...parcial, actualizadaEn: new Date().toISOString() }
            : v
        ),
      }));
    },
    []
  );

  const borrarVacante = useCallback((id: string) => {
    setEstado((s) => ({ ...s, vacantes: s.vacantes.filter((v) => v.id !== id) }));
  }, []);

  const cambiarEstadoVacante = useCallback(
    (id: string, nuevo: EstadoVacante) => {
      setEstado((s) => ({
        ...s,
        vacantes: s.vacantes.map((v) => {
          if (v.id !== id) return v;
          const parche: Partial<Vacante> = {
            estado: nuevo,
            actualizadaEn: new Date().toISOString(),
          };
          if (nuevo === "postulada" && !v.fechaPostulacion) {
            parche.fechaPostulacion = new Date().toISOString();
            parche.proximaAccion = {
              que: "Hacer seguimiento con el reclutador",
              cuando: new Date(Date.now() + 6 * 864e5).toISOString().slice(0, 10),
            };
          }
          return { ...v, ...parche };
        }),
      }));
    },
    []
  );

  const agregarDocumento = useCallback(
    (idVacante: string, doc: Omit<DocumentoGenerado, "id" | "creadoEn">) => {
      const completo: DocumentoGenerado = {
        ...doc,
        id: nuevoId("doc"),
        creadoEn: new Date().toISOString(),
      };
      setEstado((s) => ({
        ...s,
        vacantes: s.vacantes.map((v) =>
          v.id === idVacante
            ? {
                ...v,
                documentos: [completo, ...v.documentos],
                actualizadaEn: new Date().toISOString(),
              }
            : v
        ),
      }));
      return completo;
    },
    []
  );

  const borrarDocumento = useCallback((idVacante: string, idDoc: string) => {
    setEstado((s) => ({
      ...s,
      vacantes: s.vacantes.map((v) =>
        v.id === idVacante
          ? { ...v, documentos: v.documentos.filter((d) => d.id !== idDoc) }
          : v
      ),
    }));
  }, []);

  // ------------------------------------------------------- conversaciones

  const agregarConversacion = useCallback(
    (
      c: Partial<Conversacion> &
        Pick<Conversacion, "canal" | "contacto" | "mensajes">
    ) => {
      const ahora = new Date().toISOString();
      const conv: Conversacion = {
        id: nuevoId("conv"),
        asunto: "",
        archivada: false,
        pendientes: [],
        preguntasSinResponder: [],
        incoherencias: [],
        adjuntos: [],
        creadaEn: ahora,
        actualizadaEn: ahora,
        ...c,
      };
      setEstado((s) => ({ ...s, conversaciones: [conv, ...s.conversaciones] }));
      return conv;
    },
    []
  );

  const actualizarConversacion = useCallback(
    (id: string, parcial: Partial<Conversacion>) => {
      setEstado((s) => ({
        ...s,
        conversaciones: s.conversaciones.map((c) =>
          c.id === id
            ? { ...c, ...parcial, actualizadaEn: new Date().toISOString() }
            : c
        ),
      }));
    },
    []
  );

  const borrarConversacion = useCallback((id: string) => {
    setEstado((s) => ({
      ...s,
      conversaciones: s.conversaciones.filter((c) => c.id !== id),
    }));
  }, []);

  const agregarMensaje = useCallback(
    (idConv: string, m: Omit<Mensaje, "id">) => {
      const mensaje: Mensaje = { ...m, id: nuevoId("msg") };
      setEstado((s) => ({
        ...s,
        conversaciones: s.conversaciones.map((c) =>
          c.id === idConv
            ? {
                ...c,
                mensajes: [...c.mensajes, mensaje],
                actualizadaEn: new Date().toISOString(),
              }
            : c
        ),
      }));
      return mensaje;
    },
    []
  );

  const actualizarMensaje = useCallback(
    (idConv: string, idMsg: string, parcial: Partial<Mensaje>) => {
      setEstado((s) => ({
        ...s,
        conversaciones: s.conversaciones.map((c) =>
          c.id === idConv
            ? {
                ...c,
                mensajes: c.mensajes.map((m) =>
                  m.id === idMsg ? { ...m, ...parcial } : m
                ),
                actualizadaEn: new Date().toISOString(),
              }
            : c
        ),
      }));
    },
    []
  );

  const borrarMensaje = useCallback((idConv: string, idMsg: string) => {
    setEstado((s) => ({
      ...s,
      conversaciones: s.conversaciones.map((c) =>
        c.id === idConv
          ? { ...c, mensajes: c.mensajes.filter((m) => m.id !== idMsg) }
          : c
      ),
    }));
  }, []);

  const exportar = useCallback(() => {
    const blob = new Blob([JSON.stringify(estado, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-manager-respaldo-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setEstado((s) => ({
      ...s,
      ajustes: { ...s.ajustes, ultimoRespaldo: new Date().toISOString() },
    }));
  }, [estado]);

  const importar = useCallback((texto: string) => {
    const nuevo = hidratar(texto);
    setEstado(nuevo);
  }, []);

  /** Días desde el último respaldo, o null si nunca respaldó. */
  const diasSinRespaldo = useMemo(() => {
    if (!estado.ajustes.ultimoRespaldo) return null;
    const ms = Date.now() - new Date(estado.ajustes.ultimoRespaldo).getTime();
    return Math.floor(ms / 864e5);
  }, [estado.ajustes.ultimoRespaldo]);

  return {
    estado,
    listo,
    guardarPerfil,
    guardarAjustes,
    agregarVacante,
    actualizarVacante,
    borrarVacante,
    cambiarEstadoVacante,
    agregarDocumento,
    borrarDocumento,
    agregarConversacion,
    actualizarConversacion,
    borrarConversacion,
    agregarMensaje,
    actualizarMensaje,
    borrarMensaje,
    exportar,
    importar,
    diasSinRespaldo,
  };
}

export type Store = ReturnType<typeof useEstado>;
