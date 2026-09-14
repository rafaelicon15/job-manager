// Popup de la extensión. No hay bots ni sesiones: solo lee el texto de la
// pestaña que el usuario ya tiene abierta y lo pasa a la app en el fragmento
// (#) de la URL, que nunca viaja al servidor.

const $app = document.getElementById("app");
const $estado = document.getElementById("estado");

function decir(texto, clase = "info") {
  $estado.textContent = texto;
  $estado.className = clase;
}

chrome.storage.sync.get(["appUrl"], ({ appUrl }) => {
  if (appUrl) $app.value = appUrl;
});

document.getElementById("guardar").addEventListener("click", () => {
  const url = $app.value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/.+/.test(url)) {
    decir("Escribe una URL válida que empiece por https://", "err");
    return;
  }
  chrome.storage.sync.set({ appUrl: url }, () => decir("URL guardada.", "ok"));
});

/**
 * Se inyecta en la pestaña activa. Debe ser autocontenida: no puede usar
 * nada del ámbito del popup.
 */
function extraerOferta() {
  const SELECTORES = [
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".description__text",
    "#job-details",
    ".job_description",
    ".box_detail",
    "[data-testid='jobDescriptionText']",
    "#jobDescriptionText",
    ".jobsearch-JobComponent",
    "#prefijo_texto_oferta",
    ".panel-canvas",
    "main",
    "article",
    "[role='main']",
  ];

  let nodo = null;
  for (const s of SELECTORES) {
    const n = document.querySelector(s);
    if (n && (n.innerText || "").trim().length > 300) {
      nodo = n;
      break;
    }
  }
  const texto = ((nodo || document.body).innerText || "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const meta = (prop) =>
    document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)
      ?.content || "";

  // Muchos portales publican la oferta como JSON-LD JobPosting: si está, es
  // la fuente más limpia de título y empresa.
  let titulo = meta("og:title") || document.title || "";
  let empresa = "";
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const bruto = JSON.parse(s.textContent);
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
      // JSON-LD malformado: lo ignoramos y seguimos con los metadatos.
    }
  }

  return {
    titulo: titulo.slice(0, 200),
    empresa: empresa.slice(0, 120),
    url: location.href,
    texto: texto.slice(0, 60000),
  };
}

function aBase64Url(objeto) {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

document.getElementById("capturar").addEventListener("click", async () => {
  const base = $app.value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/.+/.test(base)) {
    decir("Primero escribe y guarda la URL de tu Job Manager.", "err");
    return;
  }
  decir("Leyendo la página…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      decir("Abre una oferta de empleo en una pestaña normal.", "err");
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extraerOferta,
    });
    if (!result || result.texto.length < 200) {
      decir("Esta página casi no tiene texto. Copia la oferta y pégala a mano.", "err");
      return;
    }
    chrome.storage.sync.set({ appUrl: base });
    await chrome.tabs.create({ url: `${base}/capture#${aBase64Url(result)}` });
    decir(`Enviado (${result.texto.length.toLocaleString("es")} caracteres).`, "ok");
    window.close();
  } catch (e) {
    decir(`No se pudo leer la pestaña: ${e.message}`, "err");
  }
});

// ---------------------------------------------------------- autorrelleno

/**
 * Se inyecta en la pestaña de la app para sacar una ficha compacta del perfil.
 * Corre en el origen de la app, que es el único que puede leer su
 * localStorage. No se guarda el perfil entero: solo lo que hace falta para
 * rellenar un formulario, y nada de eso sale del navegador.
 */
function leerFicha() {
  let estado;
  try {
    estado = JSON.parse(localStorage.getItem("rjm:estado:v1") || "null");
  } catch {
    return { error: "No pude leer los datos guardados." };
  }
  const p = estado?.perfil;
  if (!p?.nombre) return { error: "No hay perfil cargado en esta app." };

  const partes = p.nombre.trim().split(/\s+/);
  const enlace = (patron) =>
    (p.links || []).find((l) => patron.test(l.etiqueta || "") || patron.test(l.url || ""))?.url || "";
  // "Maracay, Aragua, Venezuela" son ciudad, estado y país, en ese orden.
  // Antes se tomaba el primero como ciudad y TODO lo demás como país, así que
  // el país acababa siendo "Aragua, Venezuela" y ningún desplegable tenía una
  // opción con ese texto: por eso el país se quedaba como lo dejara el portal.
  const partes = (p.ubicacion || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const ciudad = partes[0] ?? "";
  const pais = partes.length > 1 ? partes[partes.length - 1] : "";
  const provincia = partes.length > 2 ? partes.slice(1, -1).join(", ") : "";

  return {
    ficha: {
      nombre: p.nombre,
      nombrePila: partes.slice(0, partes.length > 2 ? 2 : 1).join(" "),
      apellidos: partes.length > 2 ? partes.slice(2).join(" ") : partes.slice(1).join(" "),
      email: p.email || "",
      telefono: p.telefono || "",
      ciudad,
      provincia,
      pais,
      codigoPostal: p.codigoPostal || "",
      fechaNacimiento: p.fechaNacimiento || "",
      titular: p.titular || "",
      resumen: p.resumen || "",
      linkedin: enlace(/linkedin/i),
      web: enlace(/portafolio|portfolio|sitio|web/i),
      salario: p.preferencias?.salarioObjetivo || "",
      disponibilidad: p.preferencias?.disponibilidad || "",
    },
  };
}

document.getElementById("sincronizar").addEventListener("click", async () => {
  decir("Leyendo tu perfil…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      decir("Abre tu Job Manager en esta pestaña y vuelve a pulsar.", "err");
      return;
    }
    // No se comprueba la URL contra el campo de texto: lo que demuestra que
    // una pestaña es el Job Manager es que tenga el perfil guardado, no lo que
    // haya escrito en una caja. Comparar con el campo hacía que una URL
    // equivocada ahí dentro bloqueara la sincronización aun estando en la app,
    // que es justo el momento en que hay que poder arreglarla.
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: leerFicha,
    });
    if (result?.error) {
      decir(
        `${result.error} ¿Seguro que esta pestaña es tu Job Manager?`,
        "err"
      );
      return;
    }
    await chrome.storage.local.set({ ficha: result.ficha, fichaFecha: Date.now() });
    // La URL de la app se deduce de la propia pestaña desde la que sincronizas.
    // Pedirla aparte sobraba: si estás en la app, ya la sabemos, y tener que
    // escribirla a mano dejaba los otros botones inutilizables sin razón.
    const origen = new URL(tab.url).origin;
    $app.value = origen;
    await chrome.storage.sync.set({ appUrl: origen });
    decir(
      `Datos guardados (${result.ficha.nombre}). URL detectada: ${origen}. ` +
        `Ya puedes rellenar formularios.`,
      "ok"
    );
  } catch (e) {
    decir(`No se pudo leer: ${e.message}`, "err");
  }
});

document.getElementById("rellenar").addEventListener("click", async () => {
  const { ficha, fichaFecha } = await chrome.storage.local.get(["ficha", "fichaFecha"]);
  if (!ficha) {
    decir(
      'Primero abre tu Job Manager y pulsa "Sincronizar mis datos". Se hace una vez.',
      "err"
    );
    return;
  }
  decir("Rellenando…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      decir("Abre el formulario de postulación en una pestaña normal.", "err");
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: rellenarFormulario,
      args: [ficha],
    });
    if (!result || !result.total) {
      decir("No encontré ningún campo de formulario en esta página.", "err");
      return;
    }
    const dias = Math.floor((Date.now() - (fichaFecha || 0)) / 864e5);
    const aviso =
      dias > 30
        ? ` Tus datos se sincronizaron hace ${dias} días: si cambiaste el perfil, vuelve a sincronizar.`
        : "";
    // Se nombra lo que quedó sin rellenar. Sin esto, un campo en ámbar no
    // distingue "no lo sé" de "no encontré su etiqueta", y no hay forma de
    // saber si falta un dato del perfil o si hay que afinar un patrón.
    const sinDato = (result.sinDato || [])
      .map((t) => t.replace(/\s+/g, " ").trim().slice(0, 42))
      .filter(Boolean);
    const detalle = sinDato.length
      ? ` Sin rellenar: ${sinDato.join("; ")}.`
      : "";
    decir(
      `${result.escritos} campos rellenos, ${result.pendientes} en ámbar para que los contestes tú. ` +
        `Revisa TODO antes de enviar: el envío es tuyo.${detalle}${aviso}`,
      result.escritos ? "ok" : "info"
    );

    // Si quedan preguntas abiertas, se pasan al motor sin que haya que pulsar
    // otro botón: son justo las que el autorrelleno no puede contestar, y
    // dejarlas ahí obligaba a saber que existía un segundo paso.
    const base = $app.value.trim().replace(/\/+$/, "");
    if (!/^https?:\/\/.+/.test(base)) return;
    const [{ result: preg }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: recogerPreguntas,
    });
    if (!preg?.preguntas?.length) return;
    await chrome.tabs.create({
      url: `${base}/responder#${aBase64Url(preg)}`,
      active: false,
    });
    decir(
      `${result.escritos} campos rellenos y ${result.pendientes} en ámbar. ` +
        `Abrí una pestaña con ${preg.preguntas.length} preguntas para que las redacte el motor. ` +
        `Revisa TODO antes de enviar: el envío es tuyo.${aviso}`,
      "ok"
    );
  } catch (e) {
    decir(`No se pudo rellenar: ${e.message}`, "err");
  }
});

document.getElementById("preguntas").addEventListener("click", async () => {
  const base = $app.value.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/.+/.test(base)) {
    decir("Primero escribe y guarda la URL de tu Job Manager.", "err");
    return;
  }
  decir("Buscando las preguntas del formulario…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      decir("Abre el formulario de postulación en una pestaña normal.", "err");
      return;
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: recogerPreguntas,
    });
    if (!result?.preguntas?.length) {
      decir("No encontré preguntas abiertas sin contestar en esta página.", "info");
      return;
    }
    // Viajan en el fragmento de la URL, que nunca llega al servidor.
    await chrome.tabs.create({ url: `${base}/responder#${aBase64Url(result)}` });
    decir(`${result.preguntas.length} preguntas enviadas a tu Job Manager.`, "ok");
    window.close();
  } catch (e) {
    decir(`No se pudieron leer las preguntas: ${e.message}`, "err");
  }
});
