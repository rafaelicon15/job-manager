"use client";

import { createContext, useContext } from "react";
import { useEstado, type Store } from "./store";

const Ctx = createContext<Store | null>(null);

export function ProveedorApp({ children }: { children: React.ReactNode }) {
  const store = useEstado();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useApp(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp debe usarse dentro de <ProveedorApp>");
  return ctx;
}
