import { test } from "node:test";
import assert from "node:assert/strict";
import { buscarDuplicada, claveVacante, normalizarUrl } from "../lib/duplicados.ts";
import type { Vacante } from "../lib/types.ts";

const v = (id: string, titulo: string, empresa: string, url?: string) =>
  ({ id, titulo, empresa, url }) as Vacante;

const guardadas = [
  v("1", "GoHighLevel Marketing Operations Specialist", "Pavago", "https://www.adzuna.com.mx/details/5236019813"),
  v("2", "Especialista en CRO", "Acme"),
  v("3", "Paid Media Specialist", "Latam Business School", "https://ejemplo.com/jobs/99?jk=abc"),
];

const id = (c: Parameters<typeof buscarDuplicada>[1]) =>
  buscarDuplicada(guardadas, c)?.id ?? null;

test("la misma URL se reconoce pese al rastreo, el www y la barra final", () => {
  assert.equal(id({ titulo: "X", url: "https://adzuna.com.mx/details/5236019813?utm_source=mail&ref=x" }), "1");
  assert.equal(id({ titulo: "X", url: "https://www.adzuna.com.mx/details/5236019813/" }), "1");
  assert.equal(id({ titulo: "X", url: "https://www.adzuna.com.mx/details/5236019813#apply" }), "1");
  assert.equal(id({ titulo: "X", url: "http://www.adzuna.com.mx/details/5236019813" }), "1");
});

test("dos ofertas distintas del mismo portal NO se funden", () => {
  assert.equal(id({ titulo: "X", url: "https://www.adzuna.com.mx/details/9999999" }), null);
});

test("conserva el identificador que viaja en la query", () => {
  // Tirar la query entera fundiría ofertas distintas del mismo sitio.
  assert.equal(id({ titulo: "X", url: "https://ejemplo.com/jobs/99?jk=zzz" }), null);
  assert.equal(id({ titulo: "X", url: "https://ejemplo.com/jobs/99?utm_medium=cpc&jk=abc" }), "3");
});

test("sin URL reconoce por empresa y puesto, ignorando acentos y mayúsculas", () => {
  assert.equal(id({ titulo: "Especialista en CRO", empresa: "Acme" }), "2");
  assert.equal(id({ titulo: "ESPECIALISTA EN CRO ", empresa: "ácme" }), "2");
});

test("el mismo puesto en otra empresa es otra oferta", () => {
  assert.equal(id({ titulo: "Especialista en CRO", empresa: "Otra" }), null);
});

test("sin título no inventa una coincidencia", () => {
  assert.equal(id({ titulo: "", empresa: "Acme" }), null);
  assert.equal(id({ titulo: "   ", empresa: "Acme" }), null);
});

test("una URL nueva no impide reconocer por puesto y empresa", () => {
  assert.equal(id({ titulo: "Especialista en CRO", empresa: "Acme", url: "https://nuevo.com/x" }), "2");
});

test("normalizarUrl aguanta basura sin lanzar", () => {
  assert.equal(normalizarUrl(undefined), "");
  assert.equal(normalizarUrl(""), "");
  assert.equal(normalizarUrl("no es una url"), "no es una url");
});

test("la clave empresa+puesto es estable", () => {
  assert.equal(
    claveVacante("Especialista en CRO", "Acme"),
    claveVacante("  especialista  en   cro ", "ACME")
  );
  assert.notEqual(claveVacante("CRO", "Acme"), claveVacante("CRO", "Otra"));
});
