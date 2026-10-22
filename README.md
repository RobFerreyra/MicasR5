# Micas R5

Formulario para capturar los datos de un equipo y preparar la información de una mica.

## Datos consultas Excel como backend con PowerAutomate

Después visita la URL que indique el comando. Al cargar la página se consulta el flujo de Power Automate mediante `POST` con `{ "cacs": {} }`; responde con `CACs` y `Catalogos`. `CACs` contiene los registros de centros de atención y `Catalogos` incluye `Conceptos`, `Garantias` y `Micas`; los valores vacíos se omiten de las listas. Para los selectores Mica y Mica Entregada se usa `MaterialMica` como valor y `NomMica` como texto. Al elegir un CAC se muestra su nombre y se actualizan internamente almacén y región. Cuando se captura un número de empleado o de analista válido, se consulta el flujo de Power Automate con `POST` y `{ "tabla": "Tabla" + cac }`. El flujo responde con los registros `Numero`, `GAC` y `Nombre`: se valida que ambos números existan en `Numero`, y el nombre asociado al número de empleado llena el campo de solo lectura Nombre Asesor. El número de analista acepta únicamente valores numéricos de hasta 65535. También puedes escribir al menos dos caracteres en el campo de búsqueda para mostrar hasta cinco equipos; al seleccionar uno se completan la marca, el modelo, el identificador (`objectID` o `sku`) y el precio.

## Consulta de Clave Material por IMEI

Al salir del campo IMEI con un IMEI válido, el formulario solicita la Clave Material a la intranet mediante `POST` a `ServletControlador`, enviando `iccidt`, `imeir=on`, `txtimei`, `TipoBusqueda=imei` e `inicio=Date.now()`. Para realizar la consulta desde la red corporativa se requiere la extensión Microsoft Edge ubicada en `extension-imei`.

Para instalarla, abre `edge://extensions`, activa **Modo de desarrollador**, selecciona **Cargar descomprimida** y elige la carpeta `extension-imei`. Después de cargar o actualizar la extensión, recarga la página del formulario. La extensión funciona en `https://robferreyra.github.io/MicasR5/`, así como en `http://localhost:5500/` y `http://localhost:5500/index.html` para pruebas. Si abres el formulario como archivo `file://`, activa **Permitir acceso a direcciones URL de archivo** en los detalles de la extensión; para localhost, permite que la extensión acceda a localhost desde los detalles o el menú de acceso al sitio de Edge. El equipo debe tener acceso a la intranet; si esta requiere sesión, inicia sesión en el mismo perfil de Edge. La extensión limita las consultas al host `intranet.telcel.com:8030` y a los formularios locales configurados.

La extensión localiza la tabla que contiene los encabezados **IMEI** y **Clave Material**, y solo usa el valor de la fila cuyo IMEI coincide con el consultado. Si encuentra una clave válida, el formulario busca por ese término en Algolia y verifica que `sku` u `objectID` coincidan exactamente con la clave antes de completar Marca, Modelo y Precio; la búsqueda habitual por texto y sus sugerencias se mantienen sin cambios. Si no encuentra un producto o falla esa búsqueda, conserva la Clave Material y muestra el estado debajo del campo IMEI. Si la respuesta no incluye una clave, no modifica el campo Material; si no encuentra la tabla SAP, selecciona **OTRO** en Operador cuando está disponible o, en su defecto, la segunda opción cargada. Los errores de consulta y la falta de extensión se muestran debajo del campo IMEI. La clave puede tener 7 u 8 dígitos y comenzar con 7.

## Copiar a Excel

El botón **Copiar Datos** valida que CAC, asesor, analista, equipo, IMEI, operador y datos de mica estén completos antes de copiar. El folio debe tener exactamente 13 caracteres; el folio generado automáticamente debe completarse manualmente antes de copiar. La factura debe contener exactamente 10 dígitos y comenzar con 8; el código QR debe tener exactamente 16 caracteres. Marca y modelo se convierten a mayúsculas; el material debe ser `N/A` o un número de 7 u 8 dígitos que comience con 7; el precio debe ser numérico y mayor que cero, y se muestra con `$`. La fila TSV contiene, en orden: región, CAC, nombre CAC, analista, fecha (`dd/mm/aaaa`), concepto, número de empleado, GAC, factura, código QR, folio, almacén, valor y nombre de mica, valor y nombre de mica entregada, garantía, indicador de mica, marca, identificador, modelo, precio numérico, IMEI y operador. Fuera del concepto Garantía, las columnas de mica entregada, garantía e indicador se copian como `N/A`. Para Garantía, el indicador es `SI` si los valores de Mica y Mica Entregada son distintos y `NO` si coinciden. Después de copiar, pega la fila en Excel.

## Estructura

- `index.html`: formulario y lista emergente de resultados.
- `styles.css`: estilos responsive y estados visuales.
- `script.js`: consultas a los flujos de CAC, catálogos y asesor, consulta a Algolia y comunicación con la extensión IMEI.
- `extension-imei/`: extensión Edge que consulta la intranet por POST y extrae la Clave Material.

## Nota de seguridad

La búsqueda usa directamente desde el navegador las credenciales públicas configuradas para el índice de Algolia de Telcel. Para producción conviene mover estas consultas a un backend o proxy, aplicar restricciones de origen y controlar cuotas. El CAC y el número de empleado se envían al flujo de Power Automate para validar el asesor. Los endpoints de los flujos usan URLs firmadas para permitir el acceso sin autenticación.