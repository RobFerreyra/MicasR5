
async function buscarEquipo(terminoBusqueda) { 

  const url = "https://1pqi6j7xnc-dsn.algolia.net/1/indexes/*/queries";    

  // 1. Definimos las cabeceras obligatorias de Algolia 
  const headers = { 
    "accept": "application/json", 
    "content-type": "application/x-www-form-urlencoded", 
    "x-algolia-application-id": "1PQI6J7XNC", 
    "x-algolia-api-key": "fd30299f673cd3e16f69bffb681bed90" 
  };  

  // 2. Construimos el cuerpo de la petición 
  const body = JSON.stringify({ 
    requests: [ 
      { 
        indexName: "prod_telcel_tienda", 
        params: `query=${encodeURIComponent(terminoBusqueda)}`
      }
    ] 
  }); 

  try { 
    const respuesta = await fetch(url, { 
      method: "POST", 
      headers: headers, 
      body: body 
    });  

    if (!respuesta.ok) { 
      throw new Error(`Error en la petición: ${respuesta.status}`); 
    }  

    const datos = await respuesta.json(); 
    // Algolia devuelve los resultados dentro de un arreglo 'results' y luego en 'hits' 
    const productos = datos.results[0].hits; 
    console.log(`Encontrados ${productos.length} resultados para "${terminoBusqueda}":\n`);      

    // 3. Imprimimos los datos (esto dependerá de la estructura exacta que devuelva Telcel) 
    productos.forEach(producto => {         
        console.log(`- ${producto.name || producto.comercialName}`); 
        console.log(`  Precio: $${producto.productPrice}`); 
        console.log(`  Marca: ${producto.brand}`); 
        console.log(`  Modelo: ${producto.model}`); 
        console.log(`  Material: ${producto.objectID || producto.sku}`); 
        // console.log(`  imagenUrl: ${producto.images}`); 
        console.log('---'); 
    }); 

  } catch (error) { 
    console.error("Hubo un problema con la búsqueda:", error); 
  } 

} 
 
buscarEquipo("motorola edge 50"); 