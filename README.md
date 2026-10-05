# Micas R5

Formulario para capturar los datos de un equipo y preparar la información de una mica.

## Datos consultas Excel como backend con PowerAutomate

Después visita la URL que indique el comando. Al cargar la página se consulta el flujo de Power Automate mediante `POST` con `{ "cacs": {} }`; responde con `CACs` y `Catalogos`. `CACs` contiene los registros de centros de atención y `Catalogos` incluye `Conceptos`, `Garantias` y `Micas`; los valores vacíos se omiten de las listas. Para los selectores Mica y Mica Entregada se usa `MaterialMica` como valor y `NomMica` como texto. Al elegir un CAC se muestra su nombre y se actualizan internamente almacén y región. Cuando se captura un número de empleado o de analista válido, se consulta el flujo de Power Automate con `POST` y `{ "tabla": "Tabla" + cac }`. El flujo responde con los registros `Numero`, `GAC` y `Nombre`: se valida que ambos números existan en `Numero`, y el nombre asociado al número de empleado llena el campo de solo lectura Nombre Asesor. El número de analista acepta únicamente valores numéricos de hasta 65535. También puedes escribir al menos dos caracteres en el campo de búsqueda para mostrar hasta cinco equipos; al seleccionar uno se completan la marca, el modelo, el identificador (`objectID` o `sku`) y el precio.

## Copiar a Excel

El botón **Copiar Datos** valida que CAC, asesor, analista, equipo, IMEI, operador y datos de mica estén completos antes de copiar. El folio debe tener exactamente 13 caracteres; el folio generado automáticamente debe completarse manualmente antes de copiar. La factura debe contener exactamente 10 dígitos y comenzar con 8; el código QR debe tener exactamente 16 caracteres. Marca y modelo se convierten a mayúsculas; el material debe ser `N/A` o un número de 7 dígitos que comience con 7; el precio debe ser numérico y mayor que cero, y se muestra con `$`. La fila TSV contiene, en orden: región, CAC, nombre CAC, analista, fecha (`dd/mm/aaaa`), concepto, número de empleado, GAC, factura, código QR, folio, almacén, valor y nombre de mica, valor y nombre de mica entregada, garantía, indicador de mica, marca, identificador, modelo, precio numérico, IMEI y operador. Fuera del concepto Garantía, las columnas de mica entregada, garantía e indicador se copian como `N/A`. Para Garantía, el indicador es `SI` si los valores de Mica y Mica Entregada son distintos y `NO` si coinciden. Después de copiar, pega la fila en Excel.

## Estructura

- `index.html`: formulario y lista emergente de resultados.
- `styles.css`: estilos responsive y estados visuales.
- `script.js`: consultas a los flujos de CAC, catálogos y asesor, consulta a Algolia, normalización y selección de productos.

## Nota de seguridad

La búsqueda usa directamente desde el navegador las credenciales públicas configuradas para el índice de Algolia de Telcel. Para producción conviene mover estas consultas a un backend o proxy, aplicar restricciones de origen y controlar cuotas. El CAC y el número de empleado se envían al flujo de Power Automate para validar el asesor. Los endpoints de los flujos usan URLs firmadas para permitir el acceso sin autenticación.