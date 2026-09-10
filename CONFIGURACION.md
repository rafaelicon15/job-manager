# Configuración

Dos partes: **las claves** (obligatorio solo la de Gemini) y **el despliegue**
(solo si quieres el tuyo propio).

Todas las claves de esta guía son gratuitas.

---

## Parte 1 — Las claves

Se pegan en **Ajustes** dentro de la app. Se guardan en tu navegador, nunca en
el servidor. En **Ajustes → Estado de la configuración** hay un botón *Probar*
para cada una que hace una llamada real y te dice el error exacto si falla.

### Gemini — obligatoria

Sin ella no hay análisis, ni CV, ni cartas, ni respuestas.

1. Entra en [aistudio.google.com/apikey](https://aistudio.google.com/apikey) con
   tu cuenta de Google.
2. **Create API key** → crea un proyecto nuevo si te lo pide.
3. Cópiala y pégala en **Ajustes → Clave de Gemini**.
4. **Probar clave**.

**Deja el modelo en Flash Lite.** Está medido: en el plan gratuito es el único
fiable. Flash da mejor calidad pero suele estar saturado y falla la mayoría de
las veces; Pro directamente no tiene cuota gratuita. La app reintenta sola y se
cae a un modelo de respaldo si hace falta, avisándote por pantalla.

> Si al probar sale `User location is not supported`, espera unos minutos: en
> proyectos recién creados suele ser temporal.

### Adzuna — opcional

Añade España y México, incluidas vacantes presenciales.

1. [developer.adzuna.com](https://developer.adzuna.com) → **Sign up**.
2. En **Dashboard → API Access Details** copia el **Application ID** y crea una
   **Application Key**.
3. Pégalos en **Ajustes**.

Cobertura real, comprobada país por país: **no tiene Venezuela, Colombia,
Argentina, Chile ni Perú**. De Latinoamérica solo México y Brasil. Si buscas en
esos otros países, esta clave no te aporta nada.

### Jooble — opcional

1. [jooble.org/api/about](https://jooble.org/api/about) → rellena el formulario.
2. La clave llega por correo en unos minutos.
3. Pégala en **Ajustes**.

Dos límites que conviene saber, medidos contra su API:

- La clave queda atada al índice global de `jooble.org`. Los subdominios por
  país (`es.`, `mx.`…) la rechazan: cada país emite la suya. Si te interesa un
  país concreto, pide la clave desde el sitio de ese país.
- Sobre el índice global, filtrar por país solo devuelve resultados reales con
  `Spain` y `Mexico`. Y **no uses nombres de ciudad**: buscar `Madrid` devuelve
  vacantes de Nuevo México, y `Peru` de Massachusetts.

### Careerjet — opcional, y la mejor para Latinoamérica

Es la única de las tres que cubre Venezuela.

1. [careerjet.com/partners/api](https://www.careerjet.com/partners/api) → crea
   una cuenta de **Publisher**.
2. **Registra la URL de tu despliegue.** Careerjet autoriza por sitio, así que
   este paso no es opcional.
3. Entra en el enlace **Access API** de ese sitio. **La clave está ahí dentro**
   — lo que se ve en la lista de sitios no es la clave. Cada sitio registrado
   tiene la suya.
4. Pégala en **Ajustes**.

> **Si te da `Invalid API key`**, casi seguro pegaste el identificador que
> aparece en la lista en vez de entrar en *Access API*.
>
> **Detalle técnico**, por si algún día deja de funcionar: Careerjet tiene dos
> APIs. La moderna (v4) autoriza por lista blanca de IPs y devuelve
> `Unauthorized access from IP …` desde Vercel, que sale por IPs dinámicas. La
> app usa la clásica, que autoriza por la cabecera `Referer` de tu sitio
> registrado y acepta la misma clave. Esa API solo escucha en HTTP: la llamada
> sale del servidor y lleva la búsqueda y el identificador de afiliado, ningún
> dato personal tuyo.

### Las que no necesitan clave

Remotive, RemoteOK, Arbeitnow, Jobicy y WeWorkRemotely funcionan desde el primer
minuto. Son remoto internacional y casi todo en inglés.

---

## Parte 2 — Desplegar el tuyo

Solo si quieres tu propia instalación. Si alguien ya te pasó una URL, sáltate
esto: tus datos son tuyos igualmente.

Necesitas una cuenta de [GitHub](https://github.com) y otra de
[Vercel](https://vercel.com). Las dos gratis.

### 1. Copia el repositorio

En GitHub, botón **Fork** (o **Use this template**). Te deja una copia en tu
cuenta.

### 2. Conéctalo a Vercel

1. Entra en Vercel con tu cuenta de GitHub.
2. **Add New… → Project**.
3. Busca tu copia y dale a **Import**.
4. **No cambies nada** de la configuración. Vercel detecta Next.js solo, y este
   proyecto no necesita ni una variable de entorno: las claves se meten desde la
   app.
5. **Deploy**. Tarda uno o dos minutos.

Al terminar tienes una URL tipo `https://tu-proyecto.vercel.app`.

> Si tu repositorio es privado y Vercel dice `repo_not_found`, es que la app de
> GitHub no tiene acceso. En GitHub: **Settings → Applications → Vercel →
> Configure**, y dale acceso a ese repositorio.

### 3. Registra la URL en Careerjet

Si vas a usar Careerjet, ahora es cuando registras esa URL en tu cuenta de
Publisher. Sin registrarla, esa fuente no funcionará en tu despliegue.

### 4. Instala la extensión de Chrome (opcional)

Lee la vacante que tengas abierta en cualquier portal y la manda a tu app.

1. `chrome://extensions` → activa **Modo de desarrollador**.
2. **Cargar descomprimida** → selecciona la carpeta `extension/` del proyecto.
3. Abre la extensión y pon la URL de tu despliegue.

No pide contraseñas ni entra en tu cuenta de ningún portal: solo lee el texto de
la pestaña que tú tengas abierta.

---

## Desarrollo local

```bash
npm install
npm run dev
```

En [localhost:3000](http://localhost:3000). Funciona todo salvo Careerjet, que
necesita un dominio registrado y en local no lo hay.
