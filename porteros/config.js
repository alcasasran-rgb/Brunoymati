/* ------------------------------------------------------------------
   ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA PERSONALIZAR LA APP.
   Todo lo demás funciona sin cambiar una línea de código.
   ------------------------------------------------------------------ */
window.CONFIG = {

  /* Nombre que aparece en la cabecera y en la primera hoja del Excel. */
  MARCA: 'Análisis de goles encajados',

  /* Porteros que entrenas. El primero sale preseleccionado.
     Añade o quita nombres entre comillas, separados por comas. */
  PORTEROS: ['Portero 1', 'Portero 2'],

  /* Equipos / categorías. Si solo trabajas con uno, deja uno. */
  EQUIPOS: ['Primer equipo'],

  /* Competiciones que vas a usar en el desplegable. */
  COMPETICIONES: ['Liga', 'Copa', 'Amistoso', 'Entrenamiento'],

  /* Nombre del archivo Excel que genera la app. */
  NOMBRE_EXCEL: 'goles-encajados.xlsx',

  /* Guardar el vídeo dentro del navegador (true) o solo su nombre/enlace (false).
     true = puedes volver a ver el clip desde la app, pero ocupa espacio en el
     dispositivo. false = la app no almacena vídeo, solo los datos. */
  GUARDAR_VIDEO: true,

  /* Aviso cuando el vídeo guardado supere este tamaño, en megas. */
  AVISO_VIDEO_MB: 80
};
