# Job Manager

Buscador y gestor de postulaciones. Encuentra vacantes en ocho agregadores a la
vez, las analiza contra tu perfil, y redacta CV en formato ATS, cartas y
respuestas a reclutadores con IA.

Lo que lo diferencia de pedirle un CV a ChatGPT: **el motor tiene prohibido
inventar**. Tu perfil maestro es la única fuente de verdad, cada logro tiene un
identificador, y cada línea del CV que genera declara de qué logro sale. La app
comprueba que ese logro exista. Si te falta un requisito, lo dice y propone cómo
compensarlo, en vez de maquillarlo.

Porque el CV lo defiendes tú en la entrevista, no la IA.

---

## Empezar en 10 minutos

### 1. Abre la app

Tienes dos caminos:

- **Usar un despliegue existente.** Alguien te pasó una URL: ábrela y ya está.
  Tus datos se guardan en tu navegador, no en su servidor. Nadie más los ve.
- **Desplegar el tuyo.** Ver [CONFIGURACION.md](CONFIGURACION.md). Son unos 15
  minutos y es gratis.

### 2. Carga tu perfil

Ve a **Perfil maestro** → *Cargar perfil desde una IA* → **Copiar el prompt**.

Pégaselo a la IA con la que trabajes (ChatGPT, Claude, Gemini, la que sea) junto
con tu CV. Te va a hacer preguntas: contéstalas con la verdad, incluidas las
incómodas. Cuando te devuelva el JSON, pégalo en la app y dale a **Revisar**.

Verás qué entendió y qué huecos quedan antes de guardar nada. Repásalo. Es el
único momento en que corregir sale barato.

### 3. Pon la clave de Gemini

**Ajustes** → *Motor de IA*. La clave se saca gratis en
[aistudio.google.com/apikey](https://aistudio.google.com/apikey). Dale a **Probar
clave**: si algo falla te dice exactamente qué.

Sin esta clave la app busca vacantes, pero no analiza ni escribe nada.

### 4. Busca

**Buscar vacantes**. Cinco agregadores funcionan sin ninguna clave. Los otros
tres necesitan claves gratuitas y añaden España, México y Venezuela: ver
[CONFIGURACION.md](CONFIGURACION.md).

---

## Qué hace

| | |
|---|---|
| **Buscar** | Ocho agregadores en paralelo, sin duplicados, con cuota por fuente para que ninguna tape a las demás |
| **Analizar** | Puntúa el encaje, desglosa requisito por requisito qué cubres y qué no, y te da cómo responder si preguntan por lo que falta |
| **CV a medida** | PDF con capa de texto real, una columna, sin tablas ni imágenes — legible por los filtros automáticos |
| **Carta y mensajes** | Carta de presentación y mensaje de contacto, en español o inglés |
| **Conversaciones** | Pega un hilo de LinkedIn, correo o WhatsApp y lo estructura. Detecta lo que prometiste y tu perfil no respalda |
| **Entrevista** | Preguntas probables con tu respuesta preparada, y las que conviene hacer tú |
| **Extensión Chrome** | Lee el texto de la vacante que tengas abierta y la manda a la app |

## Qué NO hace, a propósito

- **No se postula sola.** No hay bots ni logins automáticos. La extensión solo
  lee el texto de la pestaña que tú abras. Automatizar postulaciones en LinkedIn
  es la mejor forma de perder la cuenta que te está dando entrevistas.
- **No inventa.** Ni una métrica, ni un cliente, ni un año de experiencia.
- **No manda tus datos a ningún sitio.** Ver abajo.

## Dónde viven tus datos

En el `localStorage` de tu navegador. No hay base de datos, ni cuentas, ni
servidor que guarde nada.

Consecuencias que conviene tener claras:

- Si borras los datos del navegador, **pierdes todo**. Usa **Ajustes → Descargar
  respaldo** cada semana; la app te avisa a los 7 días.
- No se sincroniza entre dispositivos. Para pasarlo al móvil, exporta e importa.
- Tu clave de Gemini se guarda en el navegador, no en el servidor. Es tu clave y
  tu cuota; si compartes el ordenador, tenlo en cuenta.
- Las búsquedas pasan por el servidor del despliegue (los agregadores no aceptan
  llamadas directas desde el navegador), pero solo viaja el término de búsqueda.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Google Gemini · jsPDF

Sin base de datos y sin backend con estado: se despliega en el plan gratuito de
Vercel sin tocar nada.

## Licencia

MIT. Úsalo, cámbialo, quédatelo.

## Pruebas

```bash
npm test
```

70 pruebas sobre los módulos que deciden algo: deduplicación de tareas y de
vacantes, validación del perfil pegado, lectura de .docx y PDF, las reglas de
los prompts, el autorrelleno de formularios (en un DOM simulado) y el viaje de
datos entre la extensión y la app.

Las del autorrelleno son las que más importan: comprueban que no toca
contraseñas ni documentos de identidad, que no marca casillas, que no
sobrescribe lo ya escrito y que no mete un dato en el campo equivocado.
