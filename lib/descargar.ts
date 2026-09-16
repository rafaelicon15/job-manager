"use client";

/**
 * Descarga un texto generado en el navegador como archivo.
 *
 * Lo hacían por su cuenta tres sitios distintos, y en uno faltaba el
 * `revokeObjectURL`, que es una fuga de memoria pequeña pero real en una app
 * que se deja abierta toda la mañana.
 */
export function descargarTexto(nombre: string, contenido: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
