# Micas R5

Formulario para capturar los datos de un equipo y preparar la información de una mica.

## Uso local

Abre el proyecto con un servidor estático local para que la consulta `fetch` funcione correctamente. Por ejemplo, desde esta carpeta:

```bash
npx serve .
```

Después visita la URL que indique el comando. Al cargar la página se consulta el flujo de Power Automate mediante `POST` con `{ "cacs": {} }`; responde con `CACs` y `Catalogos`. `CACs` contiene los registros de centros de atención y `Catalogos` incluye `Conceptos`, `Garantias` y `Micas`; los valores vacíos se omiten de las listas. Para los selectores Mica y Mica Entregada se usa `MaterialMica` como valor y `NomMica` como texto. Al elegir un CAC se muestra su nombre y se actualizan internamente almacén y región. También puedes escribir al menos dos caracteres en el campo de búsqueda para mostrar hasta cinco equipos; al seleccionar uno se completan la marca, el modelo, el identificador (`objectID` o `sku`) y el precio.

## Estructura

- `index.html`: formulario y lista emergente de resultados.
- `styles.css`: estilos responsive y estados visuales.
- `script.js`: consulta al flujo de CAC y catálogos, consulta a Algolia, normalización y selección de productos.

## Nota de seguridad

La búsqueda usa directamente desde el navegador las credenciales públicas configuradas para el índice de Algolia de Telcel. Para producción conviene mover esta consulta a un backend o proxy, aplicar restricciones de origen y controlar cuotas. Esta versión no guarda registros ni envía datos a un servidor propio. El endpoint del flujo usa una URL firmada para permitir el acceso sin autenticación; la firma `sig` debe mantenerse fuera de repositorios públicos y regenerarse si se expone.