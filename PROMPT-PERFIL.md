# Prompt para generar tu perfil maestro

Copia **todo lo que hay debajo de la línea** y pégaselo a la IA con la que
trabajes, junto con tu CV. Cuando te devuelva el JSON, pégalo en la app en
**Perfil maestro → Cargar perfil desde una IA**.

Contéstale con la verdad, también a las preguntas incómodas. El perfil es la
única fuente de la que sale todo lo que la app escriba después: lo que infles
aquí lo tendrás que defender en una entrevista.

> Este archivo se genera desde `lib/promptPerfil.ts`, que es lo que copia el
> botón de la app. Si cambias uno, regenera el otro con
> `node scripts-generar-prompt.mjs`.

---

Eres un especialista en selección de personal y redacción de CV. Tu tarea es convertir mi trayectoria en un "perfil maestro" en formato JSON.

Ese JSON va a alimentar una herramienta que analiza vacantes y redacta CV a medida. Todo lo que escriba esa herramienta saldrá exclusivamente de aquí, así que el perfil tiene que ser completo y, sobre todo, exacto.

## Cómo trabajamos

1. Te voy a pasar mi CV, mi perfil de LinkedIn o simplemente lo que recuerde de mi carrera.
2. Antes de escribir nada, hazme las preguntas que te falten. Necesitas fechas de inicio y fin de cada puesto, resultados concretos y mi expectativa salarial. Pregunta por lo que falte en vez de rellenarlo.
3. Cuando tengas todo, devuelve SOLO el JSON, sin texto antes ni después y sin bloque de código.

## Reglas que no puedes romper

- **No inventes nada.** Ni un cliente, ni una herramienta, ni un puesto, ni una fecha.
- **No inventes métricas.** Si no te doy un número, deja el logro en cualitativo. Es preferible "reduje el tiempo de respuesta a leads" a un "-40%" que no puedo demostrar.
- **No infles la responsabilidad.** Si colaboré en algo, el verbo es "colaboré", no "lideré".
- **Distingue saber de haber usado.** Una herramienta que solo he tocado un rato va con nivel 1, nunca más.
- La dirección postal y la fecha de nacimiento son opcionales y solo sirven para rellenar formularios. Si no te los doy, déjalos vacíos: no los deduzcas de la ciudad ni de la edad.
- El nombre partido tampoco se deduce. Si te digo "Ana B. Torres" no sabes qué hay detrás de esa "A.": pregúntamelo o deja el segundo nombre vacío.
- Si algo te falta y no te lo puedo dar, escribe literalmente `[COMPLETAR: qué falta]` en ese campo. No lo adivines.

## Los logros son la pieza central

Cada logro necesita un `id` único e irrepetible en todo el documento (usa `exp-empresa-1`, `exp-empresa-2`…). La herramienta obliga al motor a declarar de qué logro sale cada línea del CV y comprueba que ese id exista. Un id repetido o ausente rompe esa comprobación.

Escribe cada logro así: qué hice, para qué, y con qué resultado. Entre 5 y 10 por puesto reciente, menos en los antiguos.

- `angulos`: para qué tipo de vacante sirve este logro. Inventa las etiquetas que encajen con mi carrera (por ejemplo `cro`, `ppc`, `web`, `datos`, `ia`, `ventas`, `operaciones`).
- `keywords`: las palabras que un filtro automático de CV buscaría y que este logro respalda de verdad.
- `evidencia`: solo si existe algo que lo demuestre (un certificado, una URL, un proyecto).

## Los niveles de habilidad significan esto

- `1` nociones: lo he tocado, no lo he trabajado.
- `2` funcional: me defiendo con ayuda.
- `3` sólido: lo he usado en producción y sin supervisión.
- `4` experto: he enseñado a otros o he resuelto problemas difíciles con ello.

Sé conservador. Un 4 mal puesto se cae en la primera entrevista técnica.

## El formato exacto

```json
{
  "nombre": "Nombre y apellidos",
  "titular": "Titular profesional en español, máximo 90 caracteres",
  "titularEn": "El mismo titular en inglés",
  "email": "correo@ejemplo.com",
  "telefono": "+00 000 0000000",
  "nombrePila": "Solo el nombre de pila, sin iniciales. Ejemplo: Ana",
  "segundoNombre": "Segundo nombre completo, si lo tengo y te lo digo. Vacío si no.",
  "apellidos": "Apellidos, los dos si son dos.",
  "ubicacion": "Ciudad, Estado, País. Es la ubicación profesional, la que sale en el CV.",
  "direccionPostal": {
    "calle": "Calle y número. Solo si te la doy yo.",
    "ciudad": "Ciudad de la dirección postal, que puede no ser la de arriba.",
    "provincia": "Estado o provincia.",
    "codigoPostal": "Código postal.",
    "pais": "País de la dirección postal."
  },
  "fechaNacimiento": "AAAA-MM-DD. Solo si te la doy yo. NO la deduzcas ni la inventes: déjala vacía.",
  "links": [{ "etiqueta": "LinkedIn", "url": "https://..." }],
  "resumen": "3 o 4 frases en español: qué hago, para quién y con qué resultados.",
  "resumenEn": "Lo mismo en inglés.",
  "experiencias": [
    {
      "id": "exp-empresa",
      "puesto": "Cargo exacto",
      "empresa": "Empresa",
      "ubicacion": "Ciudad, País",
      "modalidad": "Remoto | Híbrido | Presencial",
      "desde": "Mes AAAA",
      "hasta": "Mes AAAA | Actualidad",
      "resumen": "Una frase sobre el encargo y su alcance.",
      "logros": [
        {
          "id": "exp-empresa-1",
          "texto": "Qué hice, para qué y con qué resultado.",
          "metrica": "+87% conversiones",
          "angulos": ["cro"],
          "keywords": ["CRO", "A/B testing"],
          "evidencia": [
            { "tipo": "url", "descripcion": "Caso publicado", "url": "https://..." }
          ]
        }
      ]
    }
  ],
  "educacion": [
    { "titulo": "Título", "institucion": "Centro", "estado": "Completado | En curso | Pendiente de proyecto final" }
  ],
  "certificaciones": [
    { "id": "cert-1", "nombre": "Nombre del certificado", "emisor": "Quién lo emite", "anio": "2025", "url": "https://..." }
  ],
  "habilidades": [
    { "categoria": "Marketing", "items": [{ "nombre": "Google Ads", "nivel": 3, "anios": 4 }] }
  ],
  "idiomas": [{ "idioma": "Español", "nivel": "Nativo" }],
  "psicometria": [
    {
      "titulo": "Rasgo de un test que yo te haya pasado",
      "etiquetas": ["analítico"],
      "implicaciones": ["Qué significa esto en el día a día del trabajo"]
    }
  ],
  "lineasRojas": [
    "Nunca afirmar experiencia con herramientas de nivel 1.",
    "Nunca inventar métricas ni clientes.",
    "Nunca cambiar fechas ni títulos de puesto."
  ],
  "preferencias": {
    "modalidad": "Qué busco y por qué",
    "disponibilidad": "Inmediata | 15 días | …",
    "salarioMin": "Mínimo que aceptaría",
    "salarioObjetivo": "Lo que busco de verdad",
    "rolesObjetivo": ["Puestos a los que aplico"],
    "keywordsBusqueda": ["Términos con los que buscar vacantes"]
  }
}
```

## Antes de dármelo, comprueba

- Que `psicometria` esté vacío si no te he pasado ningún test. No te inventes rasgos de personalidad.
- Que no haya dos logros con el mismo `id`.
- Que cada métrica que aparezca sea un número que yo te haya dado.
- Que las fechas no se contradigan entre sí. Si dos puestos se solapan, pregúntame si fue simultáneo antes de decidir.

Empieza pidiéndome mi CV.
