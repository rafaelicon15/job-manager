// Función que se inyecta en la pestaña del portal para rellenar el formulario
// de postulación. Debe ser autocontenida: no puede usar nada del ámbito del
// popup, porque se ejecuta en la página.
//
// Reglas que no se cruzan, y son el motivo de que esto no sea un bot:
//  - NUNCA envía el formulario. Ni un click en "postular", ni un form.submit().
//  - NUNCA toca contraseñas, campos de pago ni subidas de archivo.
//  - NUNCA marca casillas de consentimiento ni de aceptación de condiciones.
//    Aceptar unas condiciones es una decisión de la persona, no del programa.
//  - NUNCA sobrescribe un campo que ya tenga algo escrito.
//  - Solo escribe datos que estén en la ficha del perfil. Lo que no sabe, lo
//    marca en ámbar para que lo conteste el usuario.

async function rellenarFormulario(ficha) {
  /** Campos que no se tocan bajo ninguna circunstancia. */
  const PROHIBIDOS = /pass|contrase|clave|pwd|tarjeta|card|cvv|cvc|iban|cuenta|swift|dni|nif|nie|curp|rfc|seguridad social|passport|pasaporte/i;

  const marcados = [];

  /**
   * Texto que describe un campo: su etiqueta, nombre, placeholder y aria.
   *
   * Encontrar la etiqueta es la mitad del trabajo. Medido en Adzuna: los campos
   * con `label for=` se rellenaron y las "preguntas adicionales del empleador"
   * no, aunque había patrones para ellas. Esas preguntas son frases largas con
   * formato dentro, colgadas de otro contenedor, y la versión anterior solo
   * miraba el hermano previo DEL PADRE y encima exigía que no tuviera hijos.
   *
   * Ahora se prueban seis vías, de la más fiable a la más aproximada, y se
   * acota el texto: un contenedor demasiado grande arrastraría las etiquetas de
   * los campos vecinos y provocaría coincidencias cruzadas.
   */
  function describir(el) {
    const texto = (n) => (n ? (n.innerText || n.textContent || "").trim() : "");
    const util = (t) => t && t.length >= 2 && t.length <= 300;

    // Se busca UNA etiqueta, no todas. Acumular candidatas provocaba
    // contaminación entre campos: en un formulario plano el contenedor del
    // campo "Nombre completo" es el <form> entero, cuyo texto incluye "Correo
    // electrónico", y el nombre acababa relleno con la dirección de correo.
    // Se devuelve la primera vía que acierte, de la más fiable a la más
    // aproximada, y solo se llega a la última si no hay nada mejor.
    function etiqueta() {
      // 1. La etiqueta asociada por `for`.
      if (el.id) {
        const t = texto(document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
        if (util(t)) return t;
      }

      // 2. Una etiqueta que envuelve al campo.
      const env = texto(el.closest("label"));
      if (util(env)) return env;

      // 3. aria-labelledby, que apunta a otro elemento por id.
      for (const id of (el.getAttribute("aria-labelledby") || "").split(/\s+/)) {
        if (!id) continue;
        const t = texto(document.getElementById(id));
        if (util(t)) return t;
      }

      // 4. Hermanos previos del propio campo. Aquí vive la etiqueta en la
      //    mayoría de formularios sin `for`.
      let hermano = el.previousElementSibling;
      for (let i = 0; hermano && i < 3; i++) {
        const t = texto(hermano);
        if (util(t)) return t;
        hermano = hermano.previousElementSibling;
      }

      // 5. Último recurso: subir por los contenedores. Solo se acepta uno que
      //    contenga este campo y ningún otro, para no arrastrar las etiquetas
      //    de los vecinos.
      let padre = el.parentElement;
      for (let i = 0; padre && i < 4; i++) {
        if (padre.querySelectorAll("input, textarea, select").length > 1) break;
        const propio = texto(padre);
        if (util(propio)) return propio;
        const anterior = texto(padre.previousElementSibling);
        if (util(anterior)) return anterior;
        padre = padre.parentElement;
      }
      return "";
    }

    /**
     * Descarta los identificadores generados por el framework, del tipo
     * "hxzorhfmlrbkt36hszhf". No describen nada, y una cadena larga al azar
     * acaba conteniendo "zip", "dob" o "cp" antes o después, provocando
     * coincidencias que no significan nada. Se reconocen por ser largas, sin
     * separadores, con dígitos y con una tirada larga de letras.
     */
    const legible = (t) =>
      Boolean(t) &&
      !(t.length >= 10 && !/[_\-\s.]/.test(t) && /\d/.test(t) && /[a-z]{6,}/i.test(t));

    return [
      etiqueta(),
      // Los atributos del propio campo son suyos: no pueden venir de un vecino.
      el.name || "",
      el.id || "",
      el.placeholder || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      el.getAttribute("autocomplete") || "",
    ]
      .filter(legible)
      .join(" ")
      // "firstName", "first_name" y "first-name" son lo mismo que "first
      // name". Sin separar esto, un formulario que nombra sus campos con
      // guion bajo no coincidía con ningún patrón: medido en BKX Holdings,
      // donde "first_name" y "last_name" se quedaron sin rellenar aunque
      // había reglas para los dos. El corte de camelCase va antes de pasar a
      // minúsculas, que es cuando todavía se distingue.
      .replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, "$1 $2")
      .replace(/[_\-./]+/g, " ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
  }

  /**
   * Escribe en un campo de React/Vue. Asignar `.value` a secas no funciona:
   * el framework mantiene su propio estado y sobrescribe el valor en el
   * siguiente render. Hay que usar el setter nativo y disparar los eventos.
   */
  function escribir(el, valor) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, valor);
    else el.value = valor;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function resaltar(el, color, nota) {
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = "1px";
    if (nota) el.title = nota;
  }

  /**
   * Preguntas abiertas del empleador: experiencia, motivación, resultados.
   * Ninguna se contesta con un dato de la ficha, y buscar palabras sueltas
   * dentro de ellas sale caro. Medido en Adzuna: la pregunta "What hands-on
   * experience do you have with GoHighLevel (CRM setup, workflows, EMAIL
   * automation...)" se rellenó con la dirección de correo, porque la palabra
   * "email" aparecía de pasada. Enviar eso es peor que dejarlo en blanco.
   */
  const PREGUNTA_ABIERTA =
    /experiencia|experience|descr[ií]b|explica|explain|cu[ée]ntanos|tell us|how (do|would|many) you|por qu[ée]|why do|qu[ée] resultados|what (specific )?results|motivaci[óo]n|motivation|logros|achievements|c[óo]mo (has|hiciste|manejas)/i;

  // Orden importante: los patrones más específicos van primero, porque
  // "nombre de la empresa" no debe capturarlo la regla de "nombre".
  const REGLAS = [
    // Los separadores llegan aquí ya convertidos en espacios, así que los
    // patrones tienen que contar con ellos: "E-mail" se ve como "e mail" y
    // "LinkedIn" como "linked in", porque el corte de camelCase los separa.
    [/correo|e ?-?mail/, ficha.email],
    [/tel[ée]fono|celular|m[óo]vil|whatsapp|phone|movil/, ficha.telefono],
    [/linked ?-?in/, ficha.linkedin],
    [/portafolio|portfolio|sitio web|p[áa]gina web|website|url personal/, ficha.web],
    [
      /pretensi[óo]n|expectativa salarial|salario (deseado|pretendido|esperado)|remuneraci[óo]n (deseada|esperada)|aspiraci[óo]n salarial|expected salary/,
      ficha.salario,
    ],
    [/disponibilidad|incorporaci[óo]n|fecha de inicio|availability|notice period/, ficha.disponibilidad],
    // Los límites de palabra importan: "cp" suelto coincidiría dentro de
    // "ocupación", y "dob" dentro de "doble".
    [/c[óo]digo postal|post ?code|postal code|zip ?code|\bc ?p\b|\bzip\b/, ficha.codigoPostal],
    [/fecha de nacimiento|birth ?date|date of birth|\bdob\b|cumplea[ñn]os|nacimiento/, ficha.fechaNacimiento],
    [/ciudad|localidad|city/, ficha.ciudad],
    [/pa[íi]s|country/, ficha.pais],
    // "estado" a secas también aparece en "estado civil", que no es esto.
    [
      /^(?!.*civil)(?!.*marital).*(\bestado\b|provincia|\bstate\b|\bregi[óo]n\b|departamento|\bprovince\b)/,
      ficha.provincia,
    ],
    // NO existe una regla para "dirección" o "address": el perfil no guarda la
    // calle, y la que había rellenaba esos campos con la CIUDAD. Medido en un
    // formulario real: el campo "Street" acabó diciendo "Maracay". Un dato en
    // el campo equivocado es peor que un campo vacío, porque se envía sin que
    // nadie lo mire.
    [/nombre completo|full ?name|nombre y apellido/, ficha.nombre],
    [/apellidos?|last ?name|surname/, ficha.apellidos],
    [/^(?!.*empresa)(?!.*compa[ñn])(?!.*usuario).*(nombres?|first ?name|given)/, ficha.nombrePila],
    [/titular|headline|puesto actual|cargo actual|current (title|position)/, ficha.titular],
    [/perfil profesional|sobre m[íi]|resumen|summary|about you/, ficha.resumen],
  ];

  const campos = [
    ...document.querySelectorAll("input, textarea, select"),
  ].filter((el) => {
    if (el.disabled || el.readOnly) return false;
    if (el instanceof HTMLInputElement) {
      const t = (el.type || "").toLowerCase();
      // Los de archivo se dejan al usuario a propósito: la extensión no elige
      // qué CV se sube.
      if (["password", "file", "hidden", "submit", "button", "image", "reset"].includes(t))
        return false;
    }
    // Un campo invisible suele ser una trampa antispam: rellenarlo delata.
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return true;
  });

  let escritos = 0;
  let pendientes = 0;

  for (const el of campos) {
    const desc = describir(el);

    if (PROHIBIDOS.test(desc)) {
      resaltar(el, "#f87171", "La extensión no toca este campo. Rellénalo tú.");
      marcados.push({ tipo: "prohibido", etiqueta: desc.slice(0, 60) });
      pendientes++;
      continue;
    }

    // Las casillas se dejan siempre al usuario: muchas son la aceptación de
    // condiciones o el consentimiento de datos, y eso lo decide él.
    if (el instanceof HTMLInputElement && ["checkbox", "radio"].includes(el.type)) {
      if (!el.checked) {
        resaltar(el, "#fbbf24", "Decide tú: la extensión no marca casillas.");
        pendientes++;
      }
      continue;
    }

    // Un desplegable sin opcion vacia arranca ya con la primera seleccionada,
    // asi que "tiene valor" no significa que el usuario haya elegido. Dejarlo
    // como esta es peor que rellenarlo: se enviaria "Argentina" a alguien de
    // Venezuela sin que nadie lo haya decidido. Si el indice es 0 se trata
    // como sin elegir; si es mayor, lo eligio el usuario y no se toca.
    // Los desplegables se examinan siempre. "Tener valor" no significa que lo
    // haya elegido nadie: muchos portales preseleccionan por IP. Medido en
    // HireSkys, el país venía en "Pakistan" mientras la ciudad decía "Maracay";
    // enviar eso es peor que cualquier campo en blanco. La decisión de tocarlo
    // o no se toma abajo, y solo se pisa una selección con una coincidencia
    // exacta, avisando en ámbar.
    if (!(el instanceof HTMLSelectElement) && (el.value ?? "").trim()) continue;

    let valor = "";
    // Una pregunta abierta no se contesta con un dato de la ficha, y buscarle
    // palabras sueltas dentro provoca respuestas absurdas.
    if (!PREGUNTA_ABIERTA.test(desc)) {
      for (const [patron, v] of REGLAS) {
        if (v && patron.test(desc)) {
          valor = v;
          break;
        }
      }
    }

    if (el instanceof HTMLSelectElement) {
      if (!valor) {
        resaltar(el, "#fbbf24", "Elige tú esta opción.");
        pendientes++;
        continue;
      }
      // Se descartan las opciones vacias del tipo "-- Selecciona --": su
      // texto es "" y `valor.includes("")` es cierto para cualquier valor,
      // asi que la primera opcion vacia se llevaba todas las coincidencias.
      const buscado = valor.toLowerCase().trim();
      const opciones = [...el.options].filter((o) => o.text.trim() && o.value !== "");
      const exacta = opciones.find((o) => o.text.toLowerCase().trim() === buscado);
      const aproximada =
        opciones.find((o) => o.text.toLowerCase().includes(buscado)) ||
        opciones.find((o) => buscado.includes(o.text.toLowerCase().trim()));

      // "Sin elegir" es que la opción activa no tenga valor, que es como se
      // marca un "-- Selecciona --". El índice 0 no sirve de criterio: en un
      // desplegable de países sin marcador, la primera opción es un país de
      // verdad, y tratarla como vacía dejaba pasar coincidencias aproximadas
      // que pisaban una elección real.
      //
      // Sin elegir: vale cualquier coincidencia. Ya elegido: solo se pisa con
      // una EXACTA. "Venezuela" contra "Pakistan" es exacta y hay que
      // corregirla; "Venezuela" contra "Venezuela (Bolivariana)" no lo es, y
      // ahí es mejor avisar que decidir por él.
      const sinElegir = !(el.value ?? "").trim();
      const opcion = sinElegir ? (exacta ?? aproximada) : exacta;

      if (opcion) {
        const habiaAlgo = !sinElegir && el.value !== opcion.value;
        escribir(el, opcion.value);
        // Si se ha cambiado algo que ya mostraba otra cosa, se marca en ámbar
        // en vez de verde: el usuario tiene que verlo.
        resaltar(
          el,
          habiaAlgo ? "#fbbf24" : "#34d399",
          habiaAlgo
            ? `Estaba en otra opción y se cambió a "${opcion.text.trim()}". Compruébalo.`
            : ""
        );
        escritos++;
      } else if (sinElegir) {
        resaltar(el, "#fbbf24", "No encontré una opción que encaje. Elige tú.");
        pendientes++;
      } else {
        // Ya tenía algo elegido y no hay coincidencia exacta: se deja como
        // está, pero se avisa por si lo puso el portal y no él.
        resaltar(el, "#fbbf24", "Comprueba esta opción: puede venir puesta por el portal.");
        pendientes++;
      }
      continue;
    }

    if (valor) {
      escribir(el, valor);
      resaltar(el, "#34d399");
      escritos++;
    } else {
      resaltar(
        el,
        "#fbbf24",
        PREGUNTA_ABIERTA.test(desc)
          ? "Pregunta abierta: esto lo contestas tú, con tu criterio."
          : "Esto no está en tu perfil: contéstalo tú."
      );
      marcados.push({ tipo: "sinDato", etiqueta: desc.slice(0, 60) });
      pendientes++;
    }
  }

  // ------------------------------------------------ desplegables propios
  //
  // Muchos portales no usan un <select>, sino un componente propio: un div
  // con role="combobox" que abre una lista al pulsarlo. En HireSkys el país
  // es uno de esos, con su insignia "VE" al lado del nombre, y el código de
  // arriba no lo ve siquiera.
  //
  // Se manejan aparte y con la mano muy suelta: solo se elige una opción si
  // su texto coincide EXACTAMENTE con el dato del perfil. Si hay dudas, se
  // marca en ámbar diciendo qué hay que elegir, que sigue ahorrando el
  // trabajo de recordarlo sin arriesgarse a clicar lo que no es.
  const personalizados = [
    ...document.querySelectorAll(
      '[role="combobox"], [aria-haspopup="listbox"], [role="listbox"]'
    ),
  ].filter((el) => {
    if (el.closest("select")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  });

  for (const el of personalizados) {
    const desc = describir(el);
    if (PROHIBIDOS.test(desc) || PREGUNTA_ABIERTA.test(desc)) continue;

    let valor = "";
    for (const [patron, v] of REGLAS)
      if (v && patron.test(desc)) {
        valor = v;
        break;
      }
    if (!valor) continue;

    const actual = (el.innerText || el.textContent || "").trim().toLowerCase();
    if (actual.includes(valor.toLowerCase())) {
      resaltar(el, "#34d399", "Ya estaba en el valor correcto.");
      continue;
    }

    // Se abre la lista y se busca una opción con ese texto exacto.
    let elegida = false;
    try {
      el.click();
      await new Promise((r) => setTimeout(r, 350));
      const opciones = [...document.querySelectorAll('[role="option"]')].filter((o) => {
        const r = o.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
      });
      const buscada = valor.toLowerCase().trim();
      const opcion = opciones.find(
        (o) => (o.innerText || o.textContent || "").trim().toLowerCase() === buscada
      );
      if (opcion) {
        opcion.click();
        await new Promise((r) => setTimeout(r, 200));
        elegida = true;
      } else if (opciones.length) {
        // La lista se abrió pero ninguna opción encaja exactamente. Se cierra
        // sin tocar nada: elegir "la que más se parece" es justo lo que no
        // debe hacer un autorrelleno.
        el.click();
      }
    } catch {
      // Un componente que no responde al clic no es un error: se marca y ya.
    }

    if (elegida) {
      resaltar(el, "#fbbf24", `Elegido "${valor}". Compruébalo antes de enviar.`);
      escritos++;
    } else {
      resaltar(el, "#fbbf24", `Elige "${valor}" aquí: no pude hacerlo por ti.`);
      pendientes++;
    }
  }

  return {
    escritos,
    pendientes,
    total: campos.length + personalizados.length,
    // Las etiquetas de lo que quedó sin rellenar, para poder avisar de que
    // hay preguntas de filtro esperando respuesta.
    sinDato: marcados.filter((m) => m.tipo === "sinDato").map((m) => m.etiqueta).slice(0, 8),
  };
}

/**
 * Recoge las preguntas abiertas del formulario que siguen sin contestar, para
 * mandarlas al Job Manager y que el motor redacte una respuesta con el perfil.
 *
 * Se inyecta igual que rellenarFormulario, así que también debe ser
 * autocontenida. No escribe nada: solo lee.
 *
 * El criterio de "pregunta del empleador" es el que se ve en los portales: un
 * campo vacío cuya etiqueta es una frase, no una palabra. "Nombre" no lo es;
 * "¿Qué experiencia tienes con GoHighLevel?" sí. Se incluyen también los
 * campos cortos que el autorrelleno dejó en ámbar, porque ahí caen cosas como
 * el sí/no del rango salarial.
 */
function recogerPreguntas() {
  const PROHIBIDOS =
    /pass|contrase|clave|pwd|tarjeta|card|cvv|cvc|iban|cuenta|swift|dni|nif|nie|curp|rfc|seguridad social|passport|pasaporte/i;

  function etiquetaDe(el) {
    const texto = (n) => (n ? (n.innerText || n.textContent || "").trim() : "");
    const util = (t) => t && t.length >= 2 && t.length <= 400;
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (util(texto(l))) return texto(l);
    }
    const envolvente = el.closest("label");
    if (util(texto(envolvente))) return texto(envolvente);
    for (const id of (el.getAttribute("aria-labelledby") || "").split(/\s+/)) {
      const t = texto(document.getElementById(id));
      if (util(t)) return t;
    }
    let hermano = el.previousElementSibling;
    for (let i = 0; hermano && i < 3; i++) {
      const t = texto(hermano);
      if (util(t)) return t;
      hermano = hermano.previousElementSibling;
    }
    let padre = el.parentElement;
    for (let i = 0; padre && i < 4; i++) {
      // Un contenedor con varios campos mezclaría las etiquetas de todos.
      if (padre.querySelectorAll("input, textarea, select").length > 1) break;
      const propio = texto(padre);
      if (util(propio)) return propio;
      const anterior = texto(padre.previousElementSibling);
      if (util(anterior)) return anterior;
      padre = padre.parentElement;
    }
    return el.placeholder || el.name || "";
  }

  const preguntas = [];
  const vistas = new Set();

  for (const el of document.querySelectorAll("input, textarea")) {
    if (el.disabled || el.readOnly) continue;
    if (el instanceof HTMLInputElement) {
      const t = (el.type || "").toLowerCase();
      if (!["text", "search", "url", "tel", "email", ""].includes(t)) continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if ((el.value ?? "").trim()) continue; // ya contestada

    const etiqueta = etiquetaDe(el).replace(/\s+/g, " ").trim();
    if (!etiqueta || PROHIBIDOS.test(etiqueta)) continue;

    // Una etiqueta de una o dos palabras es un campo de datos, no una
    // pregunta. Se exige una frase, o un signo de interrogación.
    const esPregunta =
      etiqueta.length >= 25 || /[?¿]/.test(etiqueta) || el instanceof HTMLTextAreaElement;
    if (!esPregunta) continue;

    const clave = etiqueta.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);

    preguntas.push({
      texto: etiqueta.slice(0, 400),
      largo: el instanceof HTMLTextAreaElement,
    });
  }

  // Contexto para reconocer de qué vacante son. En la página del formulario
  // el <title> suele ser generico ("Aplicar al trabajo"), asi que se busca en
  // varios sitios: primero el JSON-LD, que es el dato limpio cuando existe.
  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.content || "";

  let titulo = "";
  let empresa = "";
  for (const n of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const bruto = JSON.parse(n.textContent);
      const lista = Array.isArray(bruto) ? bruto : [bruto, ...(bruto["@graph"] || [])];
      for (const it of lista) {
        if (it && it["@type"] === "JobPosting") {
          titulo = it.title || titulo;
          empresa =
            (typeof it.hiringOrganization === "string"
              ? it.hiringOrganization
              : it.hiringOrganization?.name) || empresa;
        }
      }
    } catch {
      // JSON-LD roto: se sigue con el resto de vías.
    }
  }

  // El h1 de estas páginas es del tipo "Candidatura para <puesto>". Se le
  // quita ese prefijo, que no forma parte del nombre del puesto y estropearía
  // la comparación con la vacante guardada.
  if (!titulo) {
    const h1 = document.querySelector("h1");
    // innerText no existe en todos los entornos; textContent siempre está.
    const textoH1 = h1 ? (h1.innerText || h1.textContent || "") : "";
    titulo = (textoH1 || meta("og:title") || document.title || "").trim();
  }
  titulo = titulo
    .replace(/^\s*(candidatura para|postulaci[óo]n a|solicitud para|apply (to|for)|application for)\s*:?\s*/i, "")
    .trim();

  return {
    preguntas: preguntas.slice(0, 12),
    titulo: titulo.slice(0, 200),
    empresa: empresa.slice(0, 120),
    url: location.href,
    // De dónde se llegó. Cuando el formulario vive en un ATS externo
    // (Greenhouse, Workday, Lever), la URL de esta página no se parece en nada
    // a la de la oferta guardada, pero el referente suele ser justo esa oferta.
    desde: document.referrer || "",
  };
}
