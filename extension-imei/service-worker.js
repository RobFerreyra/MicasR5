const URL_CONSULTA_IMEI = "http://intranet.telcel.com:8030/telcelgsm/servlet/ServletControlador";

chrome.runtime.onMessage.addListener((mensaje, remitente, responder) => {
  if (mensaje?.type !== "micas:lookup-material") {
    return false;
  }

  const urlRemitente = new URL(remitente.url || "about:blank");
  const esFormularioLocal = urlRemitente.protocol === "file:"
    && urlRemitente.pathname.endsWith("/index.html");
  const esServidorDesarrollo = urlRemitente.protocol === "http:"
    && urlRemitente.hostname === "localhost"
    && urlRemitente.port === "5500"
    && (
      urlRemitente.pathname === "/"
      || urlRemitente.pathname.endsWith("/index.html")
    );
  const esGitHubPages = urlRemitente.protocol === "https:"
    && urlRemitente.hostname === "robferreyra.github.io"
    && (
      urlRemitente.pathname === "/MicasR5/"
      || urlRemitente.pathname === "/MicasR5/index.html"
    );

  if (
    (esFormularioLocal || esServidorDesarrollo || esGitHubPages)
    && /^\d{15}$/.test(mensaje.imei)
  ) {
    consultarIMEI(mensaje.imei)
      .then(responder)
      .catch((error) => responder({
        status: "error",
        message: error.message || "No se pudo completar la consulta en la intranet."
      }));
  } else {
    responder({
      status: "error",
      message: "La consulta solo está permitida desde el formulario local y con un IMEI de 15 dígitos."
    });
  }

  return true;
});

async function consultarIMEI(imei) {
  const parametros = new URLSearchParams({
    iccidt: "",
    imeir: "on",
    txtimei: imei,
    TipoBusqueda: "imei",
    inicio: String(Date.now())
  });
  const controlador = new AbortController();
  const tiempoLimite = setTimeout(() => controlador.abort(), 25000);

  try {
    const respuesta = await fetch(URL_CONSULTA_IMEI, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: parametros.toString(),
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
      signal: controlador.signal
    });

    if (!respuesta.ok) {
      throw new Error(`La intranet respondió con HTTP ${respuesta.status}.`);
    }

    return {
      status: "response",
      html: await respuesta.text()
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La consulta a la intranet agotó el tiempo de espera.");
    }
    throw error;
  } finally {
    clearTimeout(tiempoLimite);
  }
}
