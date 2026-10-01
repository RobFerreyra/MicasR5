
const ALGOLIA_URL = "https://1pqi6j7xnc-dsn.algolia.net/1/indexes/*/queries";
const ALGOLIA_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  "x-algolia-application-id": "1PQI6J7XNC",
  "x-algolia-api-key": "fd30299f673cd3e16f69bffb681bed90"
};
const CAC_URL = "https://default391f73b7a59043ad98f08b05098acc.c8.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/22/workflows/0bddd937a38c47a6a5293948dfecfd59/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pOadBxSfPGzXAGUQXDW-ziJ3FlA2EjnVvPtKPIFzbyY";
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
const equipmentForm = document.querySelector("#equipo-form");
const imeiInput = document.querySelector("#imei");
const imeiStatus = document.querySelector("#imei-status");
const numeroEmpleadoInput = document.querySelector("#numeroEmpleado");
const gacInput = document.querySelector("#gac");
const operadorSelect = document.querySelector("#operador");
const cacSelect = document.querySelector("#cac");
const cacSelectWrapper = cacSelect.closest(".select-wrapper");
const cacStatus = document.querySelector("#cac-status");
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
let cacRecords = [];
let garantiasCatalogo = [];

function sincronizarGACDesdeNumeroEmpleado() {
  const numeroEmpleado = numeroEmpleadoInput.value.trim();

  if (!/^\d{1,5}$/.test(numeroEmpleado)) {
    gacInput.value = "";
    return;
  }

  gacInput.value = `GAC${Number(numeroEmpleado).toString(16).toUpperCase()}`;
}

function sincronizarNumeroEmpleadoDesdeGAC() {
  const gac = gacInput.value.trim().toUpperCase();
  const coincidencia = /^GAC([0-9A-F]+)$/.exec(gac);

  gacInput.value = gac;

  if (!coincidencia) {
    numeroEmpleadoInput.value = "";
    return;
  }

  const numeroEmpleado = Number.parseInt(coincidencia[1], 16);
  numeroEmpleadoInput.value = Number.isSafeInteger(numeroEmpleado) && numeroEmpleado <= 99999
    ? String(numeroEmpleado)
    : "";
}

numeroEmpleadoInput.addEventListener("input", sincronizarGACDesdeNumeroEmpleado);
gacInput.addEventListener("input", sincronizarNumeroEmpleadoDesdeGAC);

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
    mensaje = "El IMEI debe contener solo números.";
  } else if (valor && valor.length !== 15) {
    mensaje = "El IMEI debe contener exactamente 15 dígitos.";
  } else if (valor && !validarDigitoIMEI(valor)) {
    mensaje = "El dígito verificador del IMEI no es válido.";
  }

  const mostrarMensaje = !mensaje || mostrarIncompleto || valor.length === 15 || !/^\d+$/.test(valor);
  const textoEstado = mostrarMensaje ? mensaje || (valor ? "IMEI válido." : "") : "";

  imeiInput.setCustomValidity(mensaje);
  imeiInput.setAttribute("aria-invalid", String(Boolean(mensaje)));
  imeiStatus.textContent = textoEstado;
  imeiStatus.classList.toggle("is-error", Boolean(mensaje && mostrarMensaje));

  return mensaje === "";
}

imeiInput.addEventListener("input", () => actualizarValidacionIMEI());
imeiInput.addEventListener("blur", () => actualizarValidacionIMEI(true));

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
    mostrarEstadoCAC(`${cacRecords.length} CAC disponibles.`);
  } catch (error) {
    cacRecords = [];
    cacSelect.replaceChildren(new Option("No disponible", ""));
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

  detailInputs.brand.value = producto.brand;
  detailInputs.model.value = producto.model;
  detailInputs.identifier.value = producto.identifier;
  detailInputs.productPrice.value = producto.productPrice === "" ? "" : `$${producto.productPrice}`;
  if (selectionStatus) {
    selectionStatus.textContent = `Equipo seleccionado: ${producto.displayName}`;
  }
  searchInput.value = producto.displayName;
  ocultarSugerencias();
  mostrarEstado("");
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
    displayedProducts = [];
    searchRequestId += 1;
    clearTimeout(debounceTimer);
    ocultarSugerencias();
    mostrarEstado("");
    if (selectionStatus) {
      selectionStatus.textContent = "Selecciona un equipo para completar sus datos.";
    }
    actualizarValidacionIMEI();
  });
});

iniciarDatosCAC();