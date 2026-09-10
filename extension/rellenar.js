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

function rellenarFormulario(ficha) {
  /** Campos que no se tocan bajo ninguna circunstancia. */
  const PROHIBIDOS = /pass|contrase|clave|pwd|tarjeta|card|cvv|cvc|iban|cuenta|swift|dni|nif|nie|curp|rfc|seguridad social|passport|pasaporte/i;

  const marcados = [];

  /** Texto que describe un campo: su etiqueta, nombre, placeholder, aria. */
  function describir(el) {
    const partes = [];
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) partes.push(l.innerText);
    }
    const contenedor = el.closest("label");
    if (contenedor) partes.push(contenedor.innerText);
    // Algunos portales ponen la etiqueta como hermano previo sin `for`.
    const previo = el.parentElement?.previousElementSibling;
    if (previo && previo.children.length === 0) partes.push(previo.innerText || "");
    partes.push(el.name || "", el.id || "", el.placeholder || "");
    partes.push(el.getAttribute("aria-label") || "", el.getAttribute("autocomplete") || "");
    return partes.join(" ").toLowerCase().replace(/\s+/g, " ").slice(0, 300);
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

  // Orden importante: los patrones más específicos van primero, porque
  // "nombre de la empresa" no debe capturarlo la regla de "nombre".
  const REGLAS = [
    [/correo|e-?mail/, ficha.email],
    [/tel[ée]fono|celular|m[óo]vil|whatsapp|phone|movil/, ficha.telefono],
    [/linked-?in/, ficha.linkedin],
    [/portafolio|portfolio|sitio web|p[áa]gina web|website|url personal/, ficha.web],
    [
      /pretensi[óo]n|expectativa salarial|salario (deseado|pretendido|esperado)|remuneraci[óo]n (deseada|esperada)|aspiraci[óo]n salarial|expected salary/,
      ficha.salario,
    ],
    [/disponibilidad|incorporaci[óo]n|fecha de inicio|availability|notice period/, ficha.disponibilidad],
    [/ciudad|localidad|city/, ficha.ciudad],
    [/pa[íi]s|country/, ficha.pais],
    [/direcci[óo]n|address/, ficha.ciudad],
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
    const porDefecto = el instanceof HTMLSelectElement && el.selectedIndex <= 0;
    if (!porDefecto && (el.value ?? "").trim()) continue;

    let valor = "";
    for (const [patron, v] of REGLAS) {
      if (v && patron.test(desc)) {
        valor = v;
        break;
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
      const opcion =
        opciones.find((o) => o.text.toLowerCase().trim() === buscado) ||
        opciones.find((o) => o.text.toLowerCase().includes(buscado)) ||
        opciones.find((o) => buscado.includes(o.text.toLowerCase().trim()));
      if (opcion) {
        const habiaAlgo = (el.value ?? "").trim() && el.value !== opcion.value;
        escribir(el, opcion.value);
        // Si se ha cambiado una seleccion que ya mostraba algo, se marca en
        // ambar en vez de verde: el usuario tiene que verlo.
        resaltar(
          el,
          habiaAlgo ? "#fbbf24" : "#34d399",
          habiaAlgo ? "Cambiado desde el valor por defecto. Comprueba que es correcto." : ""
        );
        escritos++;
      } else {
        resaltar(el, "#fbbf24", "No encontré una opción que encaje. Elige tú.");
        pendientes++;
      }
      continue;
    }

    if (valor) {
      escribir(el, valor);
      resaltar(el, "#34d399");
      escritos++;
    } else {
      resaltar(el, "#fbbf24", "Esto no está en tu perfil: contéstalo tú.");
      marcados.push({ tipo: "sinDato", etiqueta: desc.slice(0, 60) });
      pendientes++;
    }
  }

  return {
    escritos,
    pendientes,
    total: campos.length,
    // Las etiquetas de lo que quedó sin rellenar, para poder avisar de que
    // hay preguntas de filtro esperando respuesta.
    sinDato: marcados.filter((m) => m.tipo === "sinDato").map((m) => m.etiqueta).slice(0, 8),
  };
}
