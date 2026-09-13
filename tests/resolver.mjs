/**
 * Resolvedor para las pruebas.
 *
 * El código de la app importa al estilo de Next (`./seed`, `@/lib/x`), sin
 * extensión y con alias. Node exige la extensión y no conoce el alias, así que
 * sin esto las pruebas no podrían importar los módulos reales.
 *
 * Se resuelve aquí y no cambiando los imports de la app a propósito: las
 * pruebas se adaptan al código, no al revés.
 */
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve as resolverRuta } from "node:path";

const RAIZ = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const EXTENSIONES = [".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(especificador, contexto, siguiente) {
    // Alias "@/..." tal como lo define tsconfig.
    if (especificador.startsWith("@/")) {
      const base = resolverRuta(RAIZ, especificador.slice(2));
      for (const ext of ["", ...EXTENSIONES]) {
        const ruta = base + ext;
        if (existsSync(ruta)) return { url: pathToFileURL(ruta).href, shortCircuit: true };
      }
    }

    // Rutas relativas sin extensión.
    if (especificador.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(especificador)) {
      const desde = contexto.parentURL ? dirname(fileURLToPath(contexto.parentURL)) : RAIZ;
      const base = resolverRuta(desde, especificador);
      for (const ext of EXTENSIONES) {
        const ruta = base + ext;
        if (existsSync(ruta)) return { url: pathToFileURL(ruta).href, shortCircuit: true };
      }
    }

    return siguiente(especificador, contexto);
  },
});
