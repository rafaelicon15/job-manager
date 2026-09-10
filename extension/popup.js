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
