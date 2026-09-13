import { test } from "node:test";
import assert from "node:assert/strict";
import { validarPerfilPegado } from "../lib/perfilImport.ts";

const minimo = {
  nombre: "Ana Torres",
  experiencias: [
    { puesto: "Analista", empresa: "ACME", logros: [{ texto: "Automaticé informes" }] },
  ],
};

test("acepta el JSON envuelto en ```json y con texto delante", () => {
  const r = validarPerfilPegado(
    "Claro, aquí tienes:\n```json\n" + JSON.stringify(minimo) + "\n```"
  );
  assert.ok(r.ok, r.errores.join(" | "));
  assert.equal(r.perfil?.nombre, "Ana Torres");
});

test("acepta el perfil envuelto en una clave perfil", () => {
  const r = validarPerfilPegado(JSON.stringify({ perfil: minimo }));
  assert.ok(r.ok);
  assert.equal(r.resumen?.experiencias, 1);
});

test("genera los ids de logro que falten", () => {
  const r = validarPerfilPegado(JSON.stringify(minimo));
  const ids = r.perfil!.experiencias[0].logros.map((l) => l.id);
  assert.equal(ids.length, 1);
  assert.ok(ids[0].length > 0, "sin id la verificación anti-invento sería decorativa");
});

test("renombra los ids repetidos y lo avisa", () => {
  const r = validarPerfilPegado(
    JSON.stringify({
      nombre: "Ana",
      experiencias: [
        {
          id: "e1",
          puesto: "A",
          empresa: "B",
          logros: [
            { id: "dup", texto: "uno" },
            { id: "dup", texto: "dos" },
          ],
        },
      ],
    })
  );
  assert.ok(r.ok);
  const ids = r.perfil!.experiencias[0].logros.map((l) => l.id);
  assert.equal(new Set(ids).size, 2, "dos logros no pueden compartir id");
  assert.ok(r.avisos.some((a) => /repetido/i.test(a)));
});

test("un nivel de habilidad fuera de 1-4 cae a 2, el que menos promete", () => {
  const r = validarPerfilPegado(
    JSON.stringify({
      ...minimo,
      habilidades: [{ categoria: "Datos", items: [{ nombre: "SQL", nivel: 9 }] }],
    })
  );
  assert.equal(r.perfil!.habilidades[0].items[0].nivel, 2);
});

test("rechaza lo que no es JSON explicando qué pasa", () => {
  const r = validarPerfilPegado("Perfecto, aquí va tu perfil en texto normal.");
  assert.ok(!r.ok);
  assert.match(r.errores[0], /no es JSON válido/i);
});

test("rechaza un perfil sin experiencias", () => {
  const r = validarPerfilPegado(JSON.stringify({ nombre: "Ana", experiencias: [] }));
  assert.ok(!r.ok);
  assert.ok(r.errores.some((e) => /experiencia/i.test(e)));
});

test("rechaza un perfil sin nombre", () => {
  const r = validarPerfilPegado(JSON.stringify({ ...minimo, nombre: "" }));
  assert.ok(!r.ok);
});

test("rechaza la entrada vacía", () => {
  assert.ok(!validarPerfilPegado("").ok);
  assert.ok(!validarPerfilPegado("   ").ok);
});

test("avisa de los huecos sin bloquear el perfil", () => {
  const r = validarPerfilPegado(JSON.stringify(minimo));
  assert.ok(r.ok);
  assert.ok(r.avisos.some((a) => /idioma/i.test(a)));
  assert.ok(r.avisos.some((a) => /salarial/i.test(a)));
});

test("usa las líneas rojas por defecto si no vienen", () => {
  const r = validarPerfilPegado(JSON.stringify(minimo));
  assert.ok(r.perfil!.lineasRojas.length > 0, "nunca se queda sin límites");
});
