/* ------------------------------------------------------------------
   ÚNICO ARCHIVO QUE HAY QUE TOCAR PARA PERSONALIZAR LA APP.
   Todo lo demás funciona sin cambiar una línea de código.
   ------------------------------------------------------------------ */
window.CONFIG = {

  /* Nombre que aparece en la cabecera y en la primera hoja del Excel. */
  MARCA: 'Celta Fortuna · Goles encajados',

  /* Porteros que entrenas. El primero sale preseleccionado.
     Añade o quita nombres entre comillas, separados por comas.
     También se pueden añadir desde la propia app (desplegable Portero →
     «+ Añadir portero…»). Lista de partida: porteros del Celta Fortuna
     en la temporada 2025/26 según BeSoccer; confirma los de esta temporada. */
  PORTEROS: ['Coke Carrillo', 'Caio Barone', 'Quique Ribes', 'M. González'],

  /* Equipos / categorías. Si solo trabajas con uno, deja uno. */
  EQUIPOS: ['Celta Fortuna'],

  /* Rivales del desplegable. Segunda División 2026/27 (LaLiga Hypermotion):
     los 21 equipos además del Celta Fortuna. Si juega otro rival (Copa,
     amistoso), en la app hay «+ Otro rival…». */
  RIVALES: [
    'Albacete', 'Almería', 'Andorra', 'Burgos', 'Cádiz', 'Castellón', 'Ceuta',
    'Córdoba', 'Eibar', 'Eldense', 'Girona', 'Granada', 'Las Palmas', 'Leganés',
    'Mallorca', 'Real Oviedo', 'Real Sociedad B', 'Sabadell', 'Sporting de Gijón',
    'Tenerife', 'Real Valladolid'
  ],

  /* Jornadas que tiene la liga: hasta la mitad es Primera Vuelta y a partir
     de ahí Segunda Vuelta. En Segunda División son 42. */
  JORNADAS: 42,

  /* Jugadores de cada rival, para el desplegable de goleador / asistente.
     Escribe el nombre del equipo tal cual está en RIVALES y los jugadores
     entre comillas. Los nombres que el entrenador escriba en la app también
     se recuerdan para ese rival sin tocar este archivo. Ejemplo:
       'Albacete': ['Jugador 1', 'Jugador 2'],
  */
  JUGADORES: {
  },

  /* Nombre del archivo Excel que genera la app. */
  NOMBRE_EXCEL: 'goles-encajados-celta-fortuna.xlsx',

  /* Guardar el vídeo dentro del navegador (true) o solo su nombre/enlace (false).
     true = puedes volver a ver el clip desde la app, pero ocupa espacio en el
     dispositivo. false = la app no almacena vídeo, solo los datos. */
  GUARDAR_VIDEO: true,

  /* Aviso cuando el vídeo guardado supere este tamaño, en megas. */
  AVISO_VIDEO_MB: 80,

  /* Por encima de este tamaño (megas) el vídeo se reproduce pero no se
     guarda en la app: evita meter un partido entero en el navegador. */
  MAX_VIDEO_MB: 600
};
