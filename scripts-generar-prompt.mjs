// Genera PROMPT-PERFIL.md a partir de lib/promptPerfil.ts, para que el
// documento y el botón "Copiar el prompt" de la app nunca se desincronicen.
//
//   node scripts-generar-prompt.mjs
import { readFileSync, writeFileSync } from "node:fs";

const ts = readFileSync("lib/promptPerfil.ts", "utf8");
const m = ts.match(/export const PROMPT_PERFIL_MAESTRO = `([\s\S]*)`;\s*$/);
if (!m) throw new Error("No se encontró la plantilla en lib/promptPerfil.ts");

// Deshace los escapes del template literal: \` -> ` y \$ -> $
const prompt = m[1].split("\\`").join("`").split("\\$").join("$");

const cabecera = `# Prompt para generar tu perfil maestro

Copia **todo lo que hay debajo de la línea** y pégaselo a la IA con la que
trabajes, junto con tu CV. Cuando te devuelva el JSON, pégalo en la app en
**Perfil maestro → Cargar perfil desde una IA**.

Contéstale con la verdad, también a las preguntas incómodas. El perfil es la
única fuente de la que sale todo lo que la app escriba después: lo que infles
aquí lo tendrás que defender en una entrevista.

> Este archivo se genera desde \\\`lib/promptPerfil.ts\\\`, que es lo que copia el
> botón de la app. Si cambias uno, regenera el otro con
> \\\`node scripts-generar-prompt.mjs\\\`.

---

`;

writeFileSync("PROMPT-PERFIL.md", cabecera.split("\\`").join("`") + prompt + "\n", "utf8");

const vallas = (prompt.match(/```/g) || []).length;
console.log(`PROMPT-PERFIL.md generado: ${prompt.length} caracteres, ${vallas} vallas de código`);
if (vallas < 2) throw new Error("El bloque de código JSON no sobrevivió al desescapado");
