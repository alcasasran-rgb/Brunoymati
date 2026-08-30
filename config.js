/* ------------------------------------------------------------------
   ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA CONECTAR LA BASE DE DATOS.
   Pega aquí el enlace de tu Google Sheet entre las comillas.
   Mientras esté vacío, la app funciona con los datos de ejemplo
   de la carpeta /data.
   ------------------------------------------------------------------ */
window.CONFIG = {

  // Pega aquí el enlace completo de tu Google Sheet (o solo su ID).
  // Ejemplo: "https://docs.google.com/spreadsheets/d/1AbC...XyZ/edit"
  SHEET_URL: "",

  // Nombre del negocio que aparece en la cabecera y en el roadbook.
  MARCA: "Freshlegs · Camino DB",

  // Meses tras los que un proveedor se marca como "pendiente de verificar".
  MESES_VERIFICACION: 12,

  // Opcional y solo para casos raros: si en vez del enlace de arriba
  // prefieres publicar cada pestaña por separado (Archivo > Compartir >
  // Publicar en la web > formato CSV), pega aquí las tres URLs.
  CSV_URLS: {
    caminos: "",
    etapas: "",
    lugares: ""
  }
};
