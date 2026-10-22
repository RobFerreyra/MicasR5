const ORIGEN_FORMULARIO = "micas-form";
const ORIGEN_EXTENSION = "micas-imei-extension";

window.addEventListener("message", (event) => {
  const mensaje = event.data;
  const esPaginaLocal = window.location.protocol === "file:";
  const esServidorDesarrollo = window.location.protocol === "http:"
    && window.location.hostname === "localhost"
    && window.location.port === "5500"
    && (
      window.location.pathname === "/"
      || window.location.pathname.endsWith("/index.html")
    );
  const esGitHubPages = window.location.protocol === "https:"
    && window.location.hostname === "robferreyra.github.io"
    && (
      window.location.pathname === "/MicasR5/"
      || window.location.pathname === "/MicasR5/index.html"
    );
  if (
    event.source !== window
    || (!esPaginaLocal && !esServidorDesarrollo && !esGitHubPages)
    || (esPaginaLocal && !window.location.pathname.endsWith("/index.html"))
    || mensaje?.source !== ORIGEN_FORMULARIO
    || mensaje.type !== "lookup-material"
    || typeof mensaje.requestId !== "string"
    || !/^\d{15}$/.test(mensaje.imei)
  ) {
    return;
  }

  window.postMessage({
    source: ORIGEN_EXTENSION,
    type: "accepted",
    requestId: mensaje.requestId
  }, "*");

  chrome.runtime.sendMessage({
    type: "micas:lookup-material",
    imei: mensaje.imei
  }).then((respuesta) => {
    let resultado = respuesta;
    if (respuesta?.status === "response") {
      resultado = extraerClaveMaterial(respuesta.html, mensaje.imei);
    }

    window.postMessage({
      source: ORIGEN_EXTENSION,
      type: "result",
      requestId: mensaje.requestId,
      result: resultado
    }, "*");
  }).catch((error) => {
    window.postMessage({
      source: ORIGEN_EXTENSION,
      type: "result",
      requestId: mensaje.requestId,
      result: {
        status: "error",
        message: error.message || "No fue posible comunicarse con la extensión."
      }
    }, "*");
  });
});

function normalizarEncabezado(valor) {
  return valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-MX");
}

function extraerClaveMaterial(html, imeiConsultado) {
  const documento = new DOMParser().parseFromString(html, "text/html");
  let tablaSapEncontrada = false;

  for (const tabla of documento.querySelectorAll("table")) {
    const filas = Array.from(tabla.rows);
    const indiceEncabezado = filas.findIndex((fila) => {
      const encabezados = Array.from(fila.cells, (celda) => normalizarEncabezado(celda.textContent));
      return encabezados.includes("imei") && encabezados.includes("clave material");
    });

    if (indiceEncabezado === -1) {
      continue;
    }

    tablaSapEncontrada = true;
    const encabezados = Array.from(
      filas[indiceEncabezado].cells,
      (celda) => normalizarEncabezado(celda.textContent)
    );
    const indiceIMEI = encabezados.indexOf("imei");
    const indiceMaterial = encabezados.indexOf("clave material");

    for (const fila of filas.slice(indiceEncabezado + 1)) {
      const celdas = Array.from(fila.cells, (celda) => celda.textContent.trim());
      if (celdas[indiceIMEI] !== imeiConsultado) {
        continue;
      }

      const material = celdas[indiceMaterial];
      if (/^7\d{6,7}$/.test(material)) {
        return { status: "found", material };
      }
    }
  }

  if (tablaSapEncontrada) {
    return { status: "not-found" };
  }

  if (Array.from(documento.querySelectorAll("td")).some((celda) => {
    const texto = normalizarEncabezado(celda.textContent);
    return texto === "imeis log" || texto === "imeis cat tac";
  })) {
    return { status: "sap-table-not-found" };
  }

  return {
    status: "error",
    message: "La intranet devolvió una respuesta que no se pudo interpretar."
  };
}
