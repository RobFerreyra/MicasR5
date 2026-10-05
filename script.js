
const ALGOLIA_URL = "https://1pqi6j7xnc-dsn.algolia.net/1/indexes/*/queries";
const ALGOLIA_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  "x-algolia-application-id": "1PQI6J7XNC",
  "x-algolia-api-key": "fd30299f673cd3e16f69bffb681bed90"
};
const CAC_URL = "https://default391f73b7a59043ad98f08b05098acc.c8.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/22/workflows/0bddd937a38c47a6a5293948dfecfd59/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pOadBxSfPGzXAGUQXDW-ziJ3FlA2EjnVvPtKPIFzbyY";
const ASESOR_URL = "https://default391f73b7a59043ad98f08b05098acc.c8.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/10/workflows/fdede76d302a4c3c8ab2a838422c1038/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=8Mn9OZZ_y63PYuEnnju7GftOhME09Fi4rsim3sdfMVQ";
const CAC_HEADERS = {
  accept: "application/json",
  "content-type": "application/json"
};
const MINIMUM_SEARCH_LENGTH = 2;
const CAC_STORAGE_KEY = "micas-cac-seleccionado";
const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='42' height='48' viewBox='0 0 42 48'%3E%3Crect width='42' height='48' rx='5' fill='%23eef3ef'/%3E%3Cpath d='M13 35h16M16 13h10v22H16z' fill='none' stroke='%232d765d' stroke-width='2'/%3E%3C/svg%3E";

async function buscarEquipo(terminoBusqueda) {
  const termino = terminoBusqueda.trim();

  if (termino.length < MINIMUM_SEARCH_LENGTH) {
    return [];
  }

  const respuesta = await fetch(ALGOLIA_URL, {
    method: "POST",
    headers: ALGOLIA_HEADERS,
    body: JSON.stringify({
      requests: [{
        indexName: "prod_telcel_tienda",
        params: `query=${encodeURIComponent(termino)}&hitsPerPage=5`
      }]
    })
  });

  if (!respuesta.ok) {
    throw new Error(`La búsqueda no está disponible (${respuesta.status}).`);
  }

  const datos = await respuesta.json();
  const hits = datos?.results?.[0]?.hits;

  if (!Array.isArray(hits)) {
    throw new Error("La respuesta de búsqueda no tiene un formato válido.");
  }

  return hits.slice(0, 5).map(normalizarProducto);
}

async function cargarDatosCAC() {
  const respuesta = await fetch(CAC_URL, {
    method: "POST",
    headers: CAC_HEADERS,
    body: JSON.stringify({ cacs: {} })
  });

  if (!respuesta.ok) {
    throw new Error(`No fue posible cargar los CAC (${respuesta.status}).`);
  }

  const datos = await respuesta.json();
  const registros = Array.isArray(datos?.CACs)
    ? datos.CACs.filter(esRegistroCAC)
    : extraerRegistrosCAC(datos);

  if (registros.length === 0) {
    throw new Error("La respuesta no contiene registros de CAC válidos.");
  }

  return {
    cacs: registros.map(normalizarCAC),
    catalogos: datos?.Catalogos ?? {}
  };
}

async function cargarAsesores(cac) {
  const respuesta = await fetch(ASESOR_URL, {
    method: "POST",
    headers: CAC_HEADERS,
    body: JSON.stringify({ tabla: `Tabla${cac}` })
  });

  if (!respuesta.ok) {
    throw new Error(`No fue posible cargar los asesores (${respuesta.status}).`);
  }

  const datos = await respuesta.json();
  const codigoRespuesta = Number(datos?.statusCode);

  if (datos?.statusCode !== undefined && (codigoRespuesta < 200 || codigoRespuesta >= 300)) {
    throw new Error(`El flujo no pudo cargar los asesores (${datos.statusCode}).`);
  }

  let cuerpo = datos?.body ?? datos;
  if (typeof cuerpo === "string") {
    try {
      cuerpo = JSON.parse(cuerpo);
    } catch {
      throw new Error("La respuesta de validación de asesores no contiene JSON válido.");
    }
  }

  while (cuerpo && typeof cuerpo === "object" && !Array.isArray(cuerpo) && !("Numero" in cuerpo)) {
    if (cuerpo.data !== undefined) {
      cuerpo = cuerpo.data;
    } else if (cuerpo.value !== undefined) {
      cuerpo = cuerpo.value;
    } else {
      break;
    }
  }

  const registros = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  if (!Array.isArray(cuerpo) && (!cuerpo || typeof cuerpo !== "object" || !("Numero" in cuerpo))) {
    throw new Error("La respuesta de validación de asesores no tiene un formato válido.");
  }

  return registros.map((registro) => {
    if (!registro || typeof registro !== "object" || Array.isArray(registro) || !("Numero" in registro)) {
      throw new Error("La respuesta de validación de asesores no tiene un formato válido.");
    }

    return {
      numero: String(registro.Numero ?? "").trim(),
      nombre: String(registro.Nombre ?? "").trim()
    };
  });
}

function extraerRegistrosCAC(datos) {
  if (Array.isArray(datos)) {
    return datos.filter(esRegistroCAC);
  }

  if (!datos || typeof datos !== "object") {
    return [];
  }

  if (esRegistroCAC(datos)) {
    return [datos];
  }

  for (const valor of Object.values(datos)) {
    const registros = extraerRegistrosCAC(valor);

    if (registros.length > 0) {
      return registros;
    }
  }

  return [];
}

function esRegistroCAC(registro) {
  return Boolean(registro && typeof registro === "object" && !Array.isArray(registro) && "CAC" in registro);
}

function normalizarCAC(registro) {
  return {
    cac: String(registro.CAC ?? "").trim(),
    nombre: String(registro.Nombre ?? "").trim(),
    almacen: String(registro.Almacen ?? "").trim(),
    region: String(registro.Region ?? "").trim()
  };
}

function normalizarProducto(producto) {
  const nombre = String(producto.name || producto.comercialName || "Sin nombre").trim();

  return {
    original: producto,
    name: nombre,
    displayName: capitalizarPrimeraLetra(nombre),
    brand: producto.brand || "",
    model: producto.model || "",
    identifier: producto.objectID || producto.sku || "",
    productPrice: producto.productPrice ?? "",
    imageUrl: obtenerImagenUrl(producto.images ?? producto.image ?? producto.imageUrl)
  };
}

function capitalizarPrimeraLetra(texto) {
  return texto ? texto.charAt(0).toLocaleUpperCase("es-MX") + texto.slice(1) : "Sin nombre";
}

function obtenerImagenUrl(images) {
  if (typeof images === "string") {
    const valor = images.trim();

    if (!valor) {
      return "";
    }

    try {
      if (valor.startsWith("[") || valor.startsWith("{")) {
        return obtenerImagenUrl(JSON.parse(valor));
      }
    } catch {
      return "";
    }

    if (valor.startsWith("//")) {
      return `https:${valor}`;
    }

    try {
      return new URL(valor, "https://www.telcel.com/").href;
    } catch {
      return "";
    }
  }

  if (Array.isArray(images)) {
    for (const image of images) {
      const imageUrl = obtenerImagenUrl(image);

      if (imageUrl) {
        return imageUrl;
      }
    }

    return "";
  }

  if (images && typeof images === "object") {
    const imageValue = images.imageUrl || images.imageURL || images.url || images.src || images.original || images.thumbnail || images.image || images.desktop || images.mobile;
    return obtenerImagenUrl(imageValue);
  }

  return "";
}

const searchInput = document.querySelector("#terminoBusqueda");
const suggestions = document.querySelector("#sugerencias");
const searchStatus = document.querySelector("#search-status");
const selectionStatus = document.querySelector("#selection-status");
const copyDataButton = document.querySelector("#copy-data-button");
const equipmentForm = document.querySelector("#equipo-form");
const imeiInput = document.querySelector("#imei");
const imeiStatus = document.querySelector("#imei-status");
const numeroEmpleadoInput = document.querySelector("#numeroEmpleado");
const numeroEmpleadoStatus = document.querySelector("#numero-empleado-status");
const gacInput = document.querySelector("#gac");
const gacStatus = document.querySelector("#gac-status");
const nombreAsesorInput = document.querySelector("#nombreAsesor");
const advisorLookupStatus = document.querySelector("#advisor-lookup-status");
const analistaEqInput = document.querySelector("#analistaEq");
const analistaEqStatus = document.querySelector("#analista-eq-status");
const facturaInput = document.querySelector("#factura");
const codigoQRInput = document.querySelector("#codigoQR");
const operadorSelect = document.querySelector("#operador");
const cacSelect = document.querySelector("#cac");
const cacSelectWrapper = cacSelect.closest(".select-wrapper");
const cacStatus = document.querySelector("#cac-status");
const cacCountStatus = document.querySelector("#cac-count-status");
const conceptoSelect = document.querySelector("#concepto");
const garantiaSelect = document.querySelector("#garantia");
const folioInput = document.querySelector("#folio");
const micaSelect = document.querySelector("#mica");
const micaEntregadaField = document.querySelector("#mica-entregada-field");
const micaEntregadaSelect = document.querySelector("#mica-entregada");
const cacInputs = {
  nombre: document.querySelector("#nombreCAC"),
  almacen: document.querySelector("#almacen"),
  region: document.querySelector("#region")
};
const detailInputs = {
  brand: document.querySelector("#brand"),
  model: document.querySelector("#model"),
  identifier: document.querySelector("#identifier"),
  productPrice: document.querySelector("#productPrice")
};

let displayedProducts = [];
let activeSuggestionIndex = -1;
let searchRequestId = 0;
let debounceTimer;
let advisorLookupTimer;
let advisorLookupRequestId = 0;
const advisorRecordsCache = new Map();
const advisorRequests = new Map();
let selectedProduct = null;
let cacRecords = [];
let garantiasCatalogo = [];
const MAXIMUM_EMPLOYEE_NUMBER = 65535;

function sincronizarGACDesdeNumeroEmpleado() {
  const numeroEmpleado = numeroEmpleadoInput.value.trim();

  if (!/^\d{1,5}$/.test(numeroEmpleado) || Number(numeroEmpleado) > MAXIMUM_EMPLOYEE_NUMBER) {
    gacInput.value = "";
  } else if (numeroEmpleado) {
    const hexadecimal = Number(numeroEmpleado).toString(16).toUpperCase().padStart(4, "0");
    gacInput.value = `GAC${hexadecimal}`;
  } else {
    gacInput.value = "";
  }

  actualizarValidacionIdentificadores();
  programarConsultaAsesor();
}

function sincronizarNumeroEmpleadoDesdeGAC() {
  const gac = gacInput.value.trim().toUpperCase();
  const coincidencia = /^GAC([0-9A-F]{4})$/.exec(gac);

  gacInput.value = gac;

  if (!coincidencia) {
    numeroEmpleadoInput.value = "";
  } else {
    const numeroEmpleado = Number.parseInt(coincidencia[1], 16);
    numeroEmpleadoInput.value = numeroEmpleado <= MAXIMUM_EMPLOYEE_NUMBER
      ? String(numeroEmpleado)
      : "";
  }

  actualizarValidacionIdentificadores();
  programarConsultaAsesor();
}

function obtenerAsesores(cac) {
  if (advisorRecordsCache.has(cac)) {
    return Promise.resolve(advisorRecordsCache.get(cac));
  }

  if (!advisorRequests.has(cac)) {
    const request = cargarAsesores(cac)
      .then((registros) => {
        advisorRecordsCache.set(cac, registros);
        return registros;
      })
      .finally(() => advisorRequests.delete(cac));
    advisorRequests.set(cac, request);
  }

  return advisorRequests.get(cac);
}

function validarAnalistaEq(registros = advisorRecordsCache.get(cacSelect.value.trim())) {
  const analista = analistaEqInput.value.trim();
  let mensaje = "";

  if (analista && !/^\d{1,5}$/.test(analista)) {
    mensaje = "El número de analista debe contener solo números y hasta 5 dígitos.";
  } else if (analista && Number(analista) > MAXIMUM_EMPLOYEE_NUMBER) {
    mensaje = "El número de analista no puede ser mayor que 65535.";
  } else if (analista && cacSelect.value.trim() && !registros) {
    mensaje = "Espera a que termine la validación del analista.";
  } else if (analista && registros && !registros.some((registro) => registro.numero === analista)) {
    mensaje = "No se encontró el número de analista en los registros de este CAC.";
  }

  analistaEqInput.setCustomValidity(mensaje);
  analistaEqInput.setAttribute("aria-invalid", String(Boolean(mensaje && !mensaje.startsWith("Espera"))));
  analistaEqStatus.textContent = mensaje;
  analistaEqStatus.classList.toggle("is-error", Boolean(mensaje && !mensaje.startsWith("Espera")));
  analistaEqStatus.classList.toggle("is-pending", Boolean(mensaje.startsWith("Espera")));
}

function programarConsultaAsesor(actualizarNombre = true) {
  clearTimeout(advisorLookupTimer);
  const requestId = ++advisorLookupRequestId;
  const cac = cacSelect.value.trim();
  const numeroEmpleado = numeroEmpleadoInput.value.trim();
  const numeroValido = /^\d{1,5}$/.test(numeroEmpleado)
    && Number(numeroEmpleado) <= MAXIMUM_EMPLOYEE_NUMBER;
  const analista = analistaEqInput.value.trim();
  const analistaValido = /^\d{1,5}$/.test(analista)
    && Number(analista) <= MAXIMUM_EMPLOYEE_NUMBER;

  if (actualizarNombre) {
    nombreAsesorInput.value = "";
    nombreAsesorInput.setCustomValidity("");
    advisorLookupStatus.textContent = "";
    advisorLookupStatus.classList.remove("is-error", "is-visible");
  }

  validarAnalistaEq();

  if (!cac || (!numeroValido && !analistaValido)) {
    return;
  }

  if (numeroValido && actualizarNombre) {
    advisorLookupStatus.textContent = "Validando asesor...";
  }

  if (analistaValido && !advisorRecordsCache.has(cac)) {
    validarAnalistaEq();
  }

  advisorLookupTimer = setTimeout(async () => {
    try {
      const registros = await obtenerAsesores(cac);

      if (requestId !== advisorLookupRequestId) {
        return;
      }

      validarAnalistaEq(registros);
      if (numeroValido) {
        const registro = registros.find((item) => item.numero === numeroEmpleado);
        if (!registro?.nombre) {
          nombreAsesorInput.value = "";
          advisorLookupStatus.textContent = "No se encontró un asesor para este CAC y número.";
          advisorLookupStatus.classList.add("is-error", "is-visible");
          return;
        }

        nombreAsesorInput.value = registro.nombre;
        advisorLookupStatus.textContent = "Asesor validado.";
        advisorLookupStatus.classList.remove("is-error", "is-visible");
      }
    } catch (error) {
      if (requestId !== advisorLookupRequestId) {
        return;
      }

      if (numeroValido && !nombreAsesorInput.value) {
        nombreAsesorInput.value = "";
        advisorLookupStatus.textContent = error.message || "No fue posible validar al asesor.";
        advisorLookupStatus.classList.add("is-error");
      }
      if (analistaValido) {
        analistaEqInput.setCustomValidity(error.message || "No fue posible validar al analista.");
        analistaEqInput.setAttribute("aria-invalid", "true");
        analistaEqStatus.textContent = error.message || "No fue posible validar al analista.";
        analistaEqStatus.classList.add("is-error");
      }
    }
  }, 300);
}

analistaEqInput.addEventListener("input", () => {
  programarConsultaAsesor(false);
});

function actualizarValidacionIdentificadores() {
  const numeroEmpleado = numeroEmpleadoInput.value.trim();
  const gac = gacInput.value.trim();
  let mensajeNumero = "";
  let mensajeGAC = "";

  if (numeroEmpleado && !/^\d{1,5}$/.test(numeroEmpleado)) {
    mensajeNumero = "El número de empleado debe contener solo números y hasta 5 dígitos.";
  } else if (numeroEmpleado && Number(numeroEmpleado) > MAXIMUM_EMPLOYEE_NUMBER) {
    mensajeNumero = "El número de empleado no puede ser mayor que 65535.";
  }

  if (gac && !/^GAC[0-9A-F]{4}$/.test(gac)) {
    mensajeGAC = "El GAC debe tener 7 caracteres: GAC seguido de 4 dígitos hexadecimales.";
  }

  numeroEmpleadoInput.setCustomValidity(mensajeNumero);
  numeroEmpleadoInput.setAttribute("aria-invalid", String(Boolean(mensajeNumero)));
  gacInput.setCustomValidity(mensajeGAC);
  gacInput.setAttribute("aria-invalid", String(Boolean(mensajeGAC)));
  numeroEmpleadoStatus.textContent = mensajeNumero;
  numeroEmpleadoStatus.classList.toggle("is-error", Boolean(mensajeNumero));
  gacStatus.textContent = mensajeGAC;
  gacStatus.classList.toggle("is-error", Boolean(mensajeGAC));
}

numeroEmpleadoInput.addEventListener("input", sincronizarGACDesdeNumeroEmpleado);
gacInput.addEventListener("input", sincronizarNumeroEmpleadoDesdeGAC);
numeroEmpleadoInput.addEventListener("blur", actualizarValidacionIdentificadores);
gacInput.addEventListener("blur", actualizarValidacionIdentificadores);
facturaInput.addEventListener("input", actualizarValidacionFactura);
codigoQRInput.addEventListener("input", actualizarValidacionCodigoQR);

function validarDigitoIMEI(valor) {
  let suma = 0;

  for (let indice = 0; indice < valor.length - 1; indice += 1) {
    let digito = Number(valor[indice]);

    if ((indice + 1) % 2 === 0) {
      digito *= 2;

      if (digito > 9) {
        digito = Math.floor(digito / 10) + digito % 10;
      }
    }

    suma += digito;
  }

  const residuo = suma % 10;
  const digitoVerificador = residuo > 0 ? 10 - residuo : 0;

  return digitoVerificador === Number(valor.at(-1));
}

function actualizarValidacionIMEI(mostrarIncompleto = false) {
  const valor = imeiInput.value.trim();
  let mensaje = "";

  if (valor && !/^\d+$/.test(valor)) {
    mensaje = "Debe contener solo números.";
  } else if (valor && valor.length !== 15) {
    mensaje = "Debe contener 15 dígitos.";
  } else if (valor && !validarDigitoIMEI(valor)) {
    mensaje = "IMEI no es válido.";
  }

  const mostrarMensaje = !mensaje || mostrarIncompleto || valor.length === 15 || !/^\d+$/.test(valor);
  const textoEstado = mostrarMensaje ? mensaje || (valor ? "IMEI válido." : "") : "";

  imeiInput.setCustomValidity(mensaje);
  imeiInput.setAttribute("aria-invalid", String(Boolean(mensaje)));
  mostrarEstadoIMEI(textoEstado, Boolean(mensaje && mostrarMensaje));

  return mensaje === "";
}

function mostrarEstadoIMEI(mensaje, esError = false) {
  imeiStatus.textContent = mensaje;
  imeiStatus.classList.toggle("is-error", esError);
}

function actualizarValidacionFactura() {
  const factura = facturaInput.value.trim();
  facturaInput.setCustomValidity(
    factura && !/^8\d{9}$/.test(factura)
      ? "La factura debe tener 10 dígitos y comenzar con 8."
      : ""
  );
}

function actualizarValidacionCodigoQR() {
  const codigoQR = codigoQRInput.value;
  codigoQRInput.setCustomValidity(
    codigoQR && codigoQR.length !== 16
      ? "El código QR debe tener exactamente 16 caracteres."
      : ""
  );
}

function actualizarValidacionFolio() {
  const folio = folioInput.value;
  folioInput.setCustomValidity(
    folio && folio.length !== 13
      ? "El folio debe tener exactamente 13 caracteres."
      : ""
  );
}

imeiInput.addEventListener("input", () => actualizarValidacionIMEI());
imeiInput.addEventListener("blur", () => actualizarValidacionIMEI(true));
folioInput.addEventListener("input", actualizarValidacionFolio);
for (const input of [detailInputs.brand, detailInputs.model]) {
  input.addEventListener("input", () => {
    const cursorPosition = input.selectionStart;
    input.value = input.value.toLocaleUpperCase("es-MX");
    input.setSelectionRange(cursorPosition, cursorPosition);
  });
}

function conceptoEsGarantia() {
  const concepto = conceptoSelect.selectedOptions[0]?.textContent
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");

  return concepto === "garantia";
}

function actualizarCamposPorConcepto() {
  const esGarantia = conceptoEsGarantia();

  micaEntregadaField.hidden = !esGarantia;

  if (esGarantia) {
    poblarSelectorCatalogo(garantiaSelect, garantiasCatalogo, "Garantia");
  } else {
    garantiaSelect.replaceChildren(new Option("N/A", "N/A"));
    garantiaSelect.value = "N/A";
  }

  if (!esGarantia) {
    micaEntregadaSelect.selectedIndex = 0;
  }

  actualizarFolio();
}

function actualizarFolio() {
  const cac = cacSelect.value.trim();

  if (!cac) {
    folioInput.value = "";
    return;
  }

  const fecha = new Date();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = String(fecha.getFullYear() % 100).padStart(2, "0");
  const codigoCac = conceptoEsGarantia() ? cac : `S${cac.slice(1)}`;

  folioInput.value = `${codigoCac}${mes}${anio}00`;
}

conceptoSelect.addEventListener("change", actualizarCamposPorConcepto);
actualizarCamposPorConcepto();

function mostrarEstadoCAC(mensaje, esError = false) {
  if (!cacStatus) {
    return;
  }

  cacStatus.textContent = mensaje;
  cacStatus.classList.toggle("is-error", esError);
}

function mostrarConteoCAC(mensaje) {
  cacCountStatus.textContent = mensaje;
}

function mostrarDatosCAC(registro) {
  cacInputs.nombre.value = registro?.nombre || "";
  cacInputs.almacen.value = registro?.almacen || "";
  cacInputs.region.value = registro?.region || "";
}

function poblarSelectorCAC(registros) {
  cacSelect.replaceChildren(new Option("CAC", ""));

  registros.forEach((registro) => {
    cacSelect.add(new Option(registro.cac, registro.cac));
  });

  cacSelect.disabled = false;
}

function poblarSelectorCatalogo(select, registros, propiedadValor, propiedadTexto = propiedadValor) {
  select.replaceChildren();

  if (!Array.isArray(registros)) {
    return;
  }

  registros.forEach((registro) => {
    const valor = String(registro?.[propiedadValor] ?? "").trim();
    const texto = String(registro?.[propiedadTexto] ?? "").trim();

    if (valor && texto) {
      select.add(new Option(texto, valor));
    }
  });
}

function restaurarCACGuardado() {
  const cacGuardado = localStorage.getItem(CAC_STORAGE_KEY);
  const registro = cacRecords.find((item) => item.cac === cacGuardado);

  if (!registro) {
    localStorage.removeItem(CAC_STORAGE_KEY);
    return;
  }

  cacSelect.value = registro.cac;
  mostrarDatosCAC(registro);
  actualizarFolio();
  programarConsultaAsesor();
}

async function iniciarDatosCAC() {
  cacSelect.disabled = true;
  mostrarEstadoCAC("Cargando CAC...");

  try {
    const datos = await cargarDatosCAC();
    cacRecords = datos.cacs;
    garantiasCatalogo = datos.catalogos.Garantias ?? [];
    poblarSelectorCAC(cacRecords);
    poblarSelectorCatalogo(operadorSelect, datos.catalogos.Operadores, "Operador");
    poblarSelectorCatalogo(conceptoSelect, datos.catalogos.Conceptos, "Concepto");
    if (conceptoSelect.options.length > 0) {
      conceptoSelect.selectedIndex = 0;
    }
    actualizarCamposPorConcepto();
    poblarSelectorCatalogo(micaSelect, datos.catalogos.Micas, "MaterialMica", "NomMica");
    poblarSelectorCatalogo(micaEntregadaSelect, datos.catalogos.Micas, "MaterialMica", "NomMica");
    restaurarCACGuardado();
    mostrarConteoCAC(`${cacRecords.length} CAC disponibles.`);
    mostrarEstadoCAC("");
  } catch (error) {
    cacRecords = [];
    cacSelect.replaceChildren(new Option("No disponible", ""));
    mostrarConteoCAC("");
    mostrarEstadoCAC(error.message || "No fue posible cargar los CAC.", true);
  }
}

function mostrarEstado(mensaje, esError = false) {
  searchStatus.textContent = mensaje;
  searchStatus.classList.toggle("is-error", esError);
}

function ocultarSugerencias() {
  suggestions.replaceChildren();
  suggestions.classList.remove("is-visible");
  searchInput.setAttribute("aria-expanded", "false");
  activeSuggestionIndex = -1;
}

function mostrarSugerencias(productos) {
  displayedProducts = productos;
  suggestions.replaceChildren();

  productos.forEach((producto, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const image = document.createElement("img");
    const copy = document.createElement("span");
    const name = document.createElement("span");
    const meta = document.createElement("span");

    item.id = `suggestion-${index}`;
    item.className = "suggestion-item";
    item.setAttribute("role", "option");
    button.type = "button";
    button.className = "suggestion-button";
    button.setAttribute("aria-label", `Seleccionar ${producto.displayName}`);
    image.className = "suggestion-image";
    image.alt = "";
    image.src = producto.imageUrl || FALLBACK_IMAGE;
    image.addEventListener("error", () => {
      image.src = FALLBACK_IMAGE;
    }, { once: true });
    copy.className = "suggestion-copy";
    name.className = "suggestion-name";
    name.textContent = producto.displayName;
    meta.className = "suggestion-meta";
    meta.textContent = producto.brand || producto.model || "Equipo Telcel";
    copy.append(name, meta);
    button.append(image, copy);
    item.append(button);
    button.addEventListener("click", () => seleccionarProducto(index));
    suggestions.append(item);
  });

  if (productos.length > 0) {
    suggestions.classList.add("is-visible");
    searchInput.setAttribute("aria-expanded", "true");
  }
}

function seleccionarProducto(index) {
  const producto = displayedProducts[index];

  if (!producto) {
    return;
  }

  selectedProduct = producto;
  searchInput.setCustomValidity("");
  detailInputs.brand.value = producto.brand.toLocaleUpperCase("es-MX");
  detailInputs.model.value = producto.model.toLocaleUpperCase("es-MX");
  detailInputs.identifier.value = producto.identifier;
  const precio = String(producto.productPrice ?? "").trim();
  detailInputs.productPrice.value = precio && !precio.startsWith("$") ? `$${precio}` : precio;
  searchInput.value = producto.displayName;
  ocultarSugerencias();
  mostrarEstado(`Equipo seleccionado: ${producto.displayName}`);
}

function limpiarProductoSeleccionado() {
  selectedProduct = null;
  Object.values(detailInputs).forEach((input) => {
    input.value = "";
  });
}

function validarDatosProducto() {
  detailInputs.brand.value = detailInputs.brand.value.trim().toLocaleUpperCase("es-MX");
  detailInputs.model.value = detailInputs.model.value.trim().toLocaleUpperCase("es-MX");
  detailInputs.identifier.value = detailInputs.identifier.value.trim();
  if (detailInputs.identifier.value.toLocaleUpperCase("es-MX") === "N/A") {
    detailInputs.identifier.value = "N/A";
  }

  const identificadorValido = /^7\d{6}$/.test(detailInputs.identifier.value)
    || detailInputs.identifier.value.toLocaleUpperCase("es-MX") === "N/A";
  detailInputs.identifier.setCustomValidity(
    identificadorValido
      ? ""
      : "El material debe tener 7 dígitos y comenzar con 7, o ser N/A."
  );

  const precioTexto = detailInputs.productPrice.value.trim();
  const precio = Number(precioTexto.replace(/[$,\s]/g, ""));
  const precioValido = precioTexto !== "" && Number.isFinite(precio) && precio > 0;
  detailInputs.productPrice.setCustomValidity(
    precioValido ? "" : "El precio debe ser un valor numérico mayor que 0."
  );
  if (precioValido && !precioTexto.startsWith("$")) {
    detailInputs.productPrice.value = `$${precioTexto}`;
  }
}

function primerErrorDeCopia() {
  actualizarValidacionIdentificadores();
  actualizarValidacionIMEI(true);
  actualizarValidacionFactura();
  actualizarValidacionCodigoQR();
  actualizarValidacionFolio();
  validarDatosProducto();

  const camposRequeridos = [
    [cacSelect, "Selecciona un CAC."],
    [cacInputs.nombre, "El CAC seleccionado no tiene nombre."],
    [cacInputs.region, "El CAC seleccionado no tiene región."],
    [cacInputs.almacen, "El CAC seleccionado no tiene almacén."],
    [analistaEqInput, "Ingresa el número de analista."],
    [numeroEmpleadoInput, "Ingresa un número de empleado válido."],
    [gacInput, "Ingresa un GAC válido."],
    [nombreAsesorInput, "Espera a que el asesor termine de validarse."],
    [imeiInput, "Ingresa un IMEI válido."],
    [operadorSelect, "Selecciona un operador."],
    [conceptoSelect, "Selecciona un concepto."],
    [facturaInput, "Ingresa una factura de 10 dígitos que comience con 8."],
    [codigoQRInput, "Ingresa un código QR de exactamente 16 caracteres."],
    [folioInput, "Ingresa un folio de exactamente 13 caracteres."],
    [micaSelect, "Selecciona una mica."]
  ];

  for (const [input, mensaje] of camposRequeridos) {
    if (!String(input.value ?? "").trim()) {
      return { input, mensaje };
    }

    if (!input.validity.valid) {
      return { input, mensaje: input.validationMessage || mensaje };
    }
  }

  if (!selectedProduct) {
    return { input: searchInput, mensaje: "Selecciona un equipo de los resultados." };
  }

  for (const [input, mensaje] of [
    [detailInputs.brand, "Ingresa la marca del equipo."],
    [detailInputs.model, "Ingresa el modelo del equipo."],
    [detailInputs.identifier, "Ingresa un material válido: 7 dígitos que comiencen con 7 o N/A."],
    [detailInputs.productPrice, "Ingresa un precio numérico mayor que 0."]
  ]) {
    if (!input.value.trim()) {
      return { input, mensaje };
    }

    if (!input.validity.valid) {
      return { input, mensaje: input.validationMessage || mensaje };
    }
  }

  if (conceptoEsGarantia()) {
    if (!garantiaSelect.value) {
      return { input: garantiaSelect, mensaje: "Selecciona una garantía." };
    }
    if (!micaEntregadaSelect.value) {
      return { input: micaEntregadaSelect, mensaje: "Selecciona la mica entregada." };
    }
  }

  return null;
}

function mostrarErrorDeCopia(error) {
  const { input, mensaje } = error;

  if (input === nombreAsesorInput) {
    selectionStatus.textContent = mensaje;
    selectionStatus.classList.add("is-error");
    advisorLookupStatus.textContent = mensaje;
    advisorLookupStatus.classList.add("is-error");
    input.focus();
    return;
  }

  if (input === imeiInput) {
    mostrarEstadoIMEI(mensaje, true);
  } else if (input === searchInput) {
    mostrarEstado(mensaje, true);
  } else {
    selectionStatus.textContent = mensaje;
    selectionStatus.classList.add("is-error");
  }

  if (input === searchInput) {
    input.setCustomValidity(mensaje);
  }

  input.focus();
  if (!input.readOnly) {
    input.reportValidity();
  }
}

function obtenerFechaExcel(fecha = new Date()) {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function textoOpcionSeleccionada(select) {
  return select.selectedOptions[0]?.textContent.trim() || "";
}

function construirFilaExcel() {
  const esGarantia = conceptoEsGarantia();
  const precio = detailInputs.productPrice.value.trim().replace(/[$,\s]/g, "");
  const columnas = [
    cacInputs.region.value,
    cacSelect.value,
    cacInputs.nombre.value,
    analistaEqInput.value,
    obtenerFechaExcel(),
    conceptoSelect.value,
    numeroEmpleadoInput.value,
    gacInput.value,
    facturaInput.value,
    codigoQRInput.value,
    folioInput.value,
    cacInputs.almacen.value,
    micaSelect.value,
    textoOpcionSeleccionada(micaSelect),
    esGarantia ? micaEntregadaSelect.value : "N/A",
    esGarantia ? textoOpcionSeleccionada(micaEntregadaSelect) : "N/A",
    esGarantia ? garantiaSelect.value : "N/A",
    esGarantia ? (micaSelect.value === micaEntregadaSelect.value ? "NO" : "SI") : "N/A",
    detailInputs.brand.value,
    detailInputs.identifier.value,
    detailInputs.model.value,
    String(Number(precio)),
    imeiInput.value,
    operadorSelect.value
  ];

  return columnas
    .map((valor) => String(valor ?? "").replace(/[\t\r\n]/g, " ").trim())
    .join("\t");
}

async function copiarDatosExcel() {
  const error = primerErrorDeCopia();

  if (error) {
    mostrarErrorDeCopia(error);
    return;
  }

  try {
    await navigator.clipboard.writeText(construirFilaExcel());
    selectionStatus.textContent = "Datos copiados. Puedes pegarlos en Excel.";
    selectionStatus.classList.remove("is-error");
  } catch {
    selectionStatus.textContent = "No fue posible acceder al portapapeles.";
    selectionStatus.classList.add("is-error");
  }
}

function actualizarSugerenciaActiva() {
  const items = suggestions.querySelectorAll(".suggestion-item");

  items.forEach((item, index) => {
    const isActive = index === activeSuggestionIndex;
    item.classList.toggle("is-active", isActive);
    item.setAttribute("aria-selected", String(isActive));
  });

  if (activeSuggestionIndex >= 0) {
    searchInput.setAttribute("aria-activedescendant", `suggestion-${activeSuggestionIndex}`);
  } else {
    searchInput.removeAttribute("aria-activedescendant");
  }
}

async function ejecutarBusqueda() {
  const termino = searchInput.value.trim();
  const requestId = ++searchRequestId;

  if (termino.length < MINIMUM_SEARCH_LENGTH) {
    displayedProducts = [];
    ocultarSugerencias();
    mostrarEstado(termino.length === 0 ? "" : "Escribe al menos 2 caracteres.");
    return;
  }

  mostrarEstado("Buscando equipos...");

  try {
    const productos = await buscarEquipo(termino);

    if (requestId !== searchRequestId) {
      return;
    }

    if (productos.length === 0) {
      ocultarSugerencias();
      mostrarEstado("No encontramos equipos con ese término.");
      return;
    }

    mostrarSugerencias(productos);
    mostrarEstado(`${productos.length} ${productos.length === 1 ? "resultado" : "resultados"}.`);
  } catch (error) {
    if (requestId !== searchRequestId) {
      return;
    }

    ocultarSugerencias();
    mostrarEstado(error.message || "No fue posible buscar equipos.", true);
  }
}

searchInput.addEventListener("input", () => {
  searchInput.setCustomValidity("");
  limpiarProductoSeleccionado();
  mostrarEstado("");
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(ejecutarBusqueda, 300);
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && displayedProducts.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % displayedProducts.length;
    actualizarSugerenciaActiva();
  }

  if (event.key === "ArrowUp" && displayedProducts.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = activeSuggestionIndex <= 0 ? displayedProducts.length - 1 : activeSuggestionIndex - 1;
    actualizarSugerenciaActiva();
  }

  if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    seleccionarProducto(activeSuggestionIndex);
  }

  if (event.key === "Escape") {
    ocultarSugerencias();
  }
});

cacSelect.addEventListener("change", () => {
  const registro = cacRecords.find((item) => item.cac === cacSelect.value);
  mostrarDatosCAC(registro);
  actualizarFolio();
  if (registro) {
    localStorage.setItem(CAC_STORAGE_KEY, registro.cac);
  } else {
    localStorage.removeItem(CAC_STORAGE_KEY);
  }
  programarConsultaAsesor();
  cacSelectWrapper.classList.remove("is-open");
});

cacSelect.addEventListener("click", () => {
  cacSelectWrapper.classList.toggle("is-open");
});

cacSelect.addEventListener("blur", () => {
  cacSelectWrapper.classList.remove("is-open");
});

cacSelect.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    cacSelectWrapper.classList.toggle("is-open");
  }

  if (event.key === "Escape") {
    cacSelectWrapper.classList.remove("is-open");
  }
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-field")) {
    ocultarSugerencias();
  }
});

equipmentForm.addEventListener("reset", () => {
  setTimeout(() => {
    limpiarProductoSeleccionado();
    displayedProducts = [];
    searchRequestId += 1;
    clearTimeout(debounceTimer);
    ocultarSugerencias();
    mostrarEstado("");
    actualizarValidacionIMEI();
  });
});

copyDataButton.addEventListener("click", copiarDatosExcel);

iniciarDatosCAC();