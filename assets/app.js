/* =====================================================================
   Goles encajados — registro en vídeo y Excel para entrenadores de
   porteros. Sin backend, sin login, sin librerías externas.
   Los datos viven en el propio dispositivo (IndexedDB) y el Excel se
   genera desde la app con assets/xlsx-min.js.
   ===================================================================== */
(function () {
'use strict';

/* ===================== Taxonomía (TABLA MAESTRA) =====================
   Los valores son exactamente los de la plantilla del entrenador, para
   que el Excel que genera la app encaje con sus tablas dinámicas. */

var T = {
  EQUIPO:   ['Rival', 'Mi equipo'],
  PARTE:    ['Primera Parte', 'Segunda Parte'],
  PERIODO:  ['1-15', '15-30', '30-45', '45-60', '60-75', '75-90', 'Añadido'],
  STATUS:   ['Ganando', 'Empatando', 'Perdiendo'],
  TIPO:     ['Ataque combinativo', 'Juego Directo', 'Acción a balón parado',
             'Contraataque', 'Robo en Inicio Rival'],
  GOLPEO:   ['Pierna derecha', 'Pierna izquierda', 'Cabeza', 'Otro'],
  BANDA:    ['Izquierda', 'Centro', 'Derecha'],
  CAMPO:    ['Local', 'Visitante'],
  VUELTA:   ['Primera Vuelta', 'Segunda Vuelta'],
  AREA:     ['Dentro del Area', 'Fuera del Area'],
  RESULTADO:['Victoria', 'Empate', 'Derrota']
};

var SUBTIPO = {
  'Ataque combinativo': ['Combinativo + 1x1', 'Combinativo + Jugada',
                         'Combinativo + Tiro lejano', 'Combinativo + Centro'],
  'Juego Directo':      ['Juego Directo +', 'Juego Directo + Caida',
                         'Juego Directo + Centro'],
  'Contraataque':       ['Contraataque + Centro', 'Contraataque + Jugada',
                         'Contraataque + Tiro Lejano', 'Contraataque + 1x1'],
  'Robo en Inicio Rival': ['Robo por dentro', 'Robo por fuera'],
  'Acción a balón parado': [
    'CORNER 1º PALO', 'CORNER 2º PALO', 'CORNER CENTRO AREA', 'CORNER RECHACE',
    'SAQUE DE BANDA', 'FALTA LATERAL', 'FALTA ESCORADA', 'FALTA FRONTAL',
    'FALTA DIRECTA', 'FALTA + RECHACE', 'PENALTY']
};

/* Capa de análisis del portero. No estaba en la plantilla: es lo que
   convierte un registro de goles en un plan de entrenamiento. */
var G = {
  EVITABILIDAD:    ['Imparable', 'Parcialmente evitable', 'Evitable'],
  RESPONSABILIDAD: ['Mérito del rival', 'Portero', 'Defensa', 'Colectiva'],
  ACCION:          ['Estirada', 'Blocaje', 'Despeje', 'Salida aérea',
                    'Salida al pie / 1x1', 'Achique', 'Sin opción de intervenir'],
  POSICION:        ['Correcta', 'Adelantado', 'Atrasado', 'Perfil incorrecto',
                    'Fuera de la portería'],
  PIE:             ['Pie natural', 'Pie cambiado'],
  ACIERTO:         ['Colocación correcta', 'Buena lectura', 'Salida a tiempo', 'Reducción del ángulo',
                    'Apoyos correctos', 'Intento de parada correcto', 'Comunicación con la defensa',
                    'Nada que destacar'],
  ERROR:           ['Sin error del portero', 'Colocación', 'Lectura / anticipación',
                    'Timing de salida', 'Técnica de manos', 'Blocaje',
                    'Despeje a zona peligrosa', 'Juego de pies',
                    'Comunicación / organización', 'Posicionamiento en ABP',
                    'Decisión salir / quedarse', 'Apoyos / caída',
                    'Error con balón jugado']
};

var CFG = window.CONFIG || {};
var Z = window.ZONAS;

/* ============================== Utilidades ============================== */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function $(sel, raiz) { return (raiz || document).querySelector(sel); }
function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }
function idNuevo() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function hoyISO() { var d = new Date(); return d.toISOString().slice(0, 10); }

function fechaCorta(iso) {
  if (!iso) return '';
  var p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

/* El periodo sale solo del minuto: una casilla menos que rellenar. */
function periodoDeMinuto(min) {
  var m = parseInt(min, 10);
  if (!isFinite(m)) return '';
  if (m > 90) return 'Añadido';
  if (m <= 15) return '1-15';
  if (m <= 30) return '15-30';
  if (m <= 45) return '30-45';
  if (m <= 60) return '45-60';
  if (m <= 75) return '60-75';
  return '75-90';
}

function megas(bytes) { return Math.round((bytes || 0) / 104857.6) / 10; }

function aviso(texto, tipo) {
  var b = $('#banner');
  if (!b) return;
  b.className = 'banner' + (tipo ? ' ' + tipo : '');
  b.innerHTML = esc(texto);
  b.hidden = !texto;
  if (texto) {
    clearTimeout(aviso._t);
    aviso._t = setTimeout(function () { b.hidden = true; }, 5000);
  }
}

/* ============================== Almacén ==============================
   IndexedDB con tres almacenes: goles (los datos), videos (los clips) y
   ajustes (preferencias y el enlace al archivo Excel). */

var DB_NOMBRE = 'porteros', DB_VERSION = 2, _db = null;

function db() {
  if (_db) return Promise.resolve(_db);
  return new Promise(function (res, rej) {
    var pet = indexedDB.open(DB_NOMBRE, DB_VERSION);
    pet.onupgradeneeded = function () {
      var d = pet.result;
      if (!d.objectStoreNames.contains('goles'))   d.createObjectStore('goles', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('videos'))  d.createObjectStore('videos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('ajustes')) d.createObjectStore('ajustes', { keyPath: 'clave' });
      /* v2: finalización de delanteros */
      if (!d.objectStoreNames.contains('finalizaciones')) d.createObjectStore('finalizaciones', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('jugadores')) d.createObjectStore('jugadores', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('equipos')) d.createObjectStore('equipos', { keyPath: 'nombre' });
    };
    pet.onsuccess = function () { _db = pet.result; res(_db); };
    pet.onerror = function () { rej(pet.error); };
  });
}

function tx(almacen, modo, fn) {
  return db().then(function (d) {
    return new Promise(function (res, rej) {
      var t = d.transaction(almacen, modo), s = t.objectStore(almacen), pet = fn(s);
      t.oncomplete = function () { res(pet && pet.result); };
      t.onerror = function () { rej(t.error); };
      t.onabort = function () { rej(t.error); };
    });
  });
}

var almacen = {
  todos:    function ()      { return tx('goles', 'readonly',  function (s) { return s.getAll(); }); },
  guardar:  function (gol)   { return tx('goles', 'readwrite', function (s) { return s.put(gol); }); },
  borrar:   function (id)    { return tx('goles', 'readwrite', function (s) { return s.delete(id); }); },
  video:    function (id)    { return tx('videos', 'readonly', function (s) { return s.get(id); }); },
  ponVideo: function (id, b, nombre) {
    return tx('videos', 'readwrite', function (s) { return s.put({ id: id, blob: b, nombre: nombre }); });
  },
  quitaVideo: function (id)  { return tx('videos', 'readwrite', function (s) { return s.delete(id); }); },
  ajuste:   function (c)     { return tx('ajustes', 'readonly', function (s) { return s.get(c); })
                                      .then(function (r) { return r ? r.valor : null; }); },
  ponAjuste: function (c, v) { return tx('ajustes', 'readwrite', function (s) { return s.put({ clave: c, valor: v }); }); },
  /* Genéricos, para los almacenes de finalización */
  todosDe:   function (st)     { return tx(st, 'readonly',  function (s) { return s.getAll(); }); },
  guardarEn: function (st, o)  { return tx(st, 'readwrite', function (s) { return s.put(o); }); },
  borrarDe:  function (st, id) { return tx(st, 'readwrite', function (s) { return s.delete(id); }); }
};

/* ============================== Estado ============================== */

var state = {
  goles: [],
  borrador: null,      /* el gol que se está editando */
  videoArchivo: null,  /* File pendiente de guardar */
  filtro: { portero: '', rival: '', equipo: '', ultimas: 0 },
  porterosExtra: [],
  informe: { tab: 'resumen', orden: 'fecha', desc: true, buscar: '', zc: '', zp: '' },
  volverA: '#/',  /* a dónde vuelve el formulario al guardar o cancelar */
  modo: (function () { try { return localStorage.getItem('porteros:modo') || 'goles'; } catch (e) { return 'goles'; } })(),
  fotosPorteros: {},
  excelHandle: null,
  vista: 'registro'
};

/* Se queda con los registros de las últimas n jornadas (o, si no hay
   jornadas anotadas, de los últimos n partidos por fecha). 0 = todo. */
function filtrarUltimas(lista, n) {
  n = parseInt(n, 10);
  if (!n) return lista;
  var jornadas = [];
  lista.forEach(function (g) { var j = parseInt(g.jornada, 10); if (isFinite(j) && jornadas.indexOf(j) < 0) jornadas.push(j); });
  if (jornadas.length) {
    jornadas.sort(function (a, b) { return b - a; });
    var ok = jornadas.slice(0, n);
    return lista.filter(function (g) { return ok.indexOf(parseInt(g.jornada, 10)) >= 0; });
  }
  var fechas = [];
  lista.forEach(function (g) { if (g.fecha && fechas.indexOf(g.fecha) < 0) fechas.push(g.fecha); });
  fechas.sort().reverse();
  var okF = fechas.slice(0, n);
  return lista.filter(function (g) { return okF.indexOf(g.fecha) >= 0; });
}

var ULTIMAS = [[0, 'Toda la temporada'], [5, 'Últimas 5 j.'], [10, 'Últimas 10 j.'], [15, 'Últimas 15 j.']];
function chipsUltimas(valor) {
  return '<div class="chips chips-ultimas">' + ULTIMAS.map(function (u) {
    return '<button type="button" class="chip' + (String(valor || 0) === String(u[0]) ? ' sel' : '') + '" data-ultimas="' + u[0] + '">' + u[1] + '</button>';
  }).join('') + '</div>';
}

function golesFiltrados() {
  return filtrarUltimas(state.goles, state.filtro.ultimas).filter(function (g) {
    if (state.filtro.equipo && g.equipo !== state.filtro.equipo) return false;
    if (state.filtro.portero && g.portero !== state.filtro.portero) return false;
    if (state.filtro.rival && g.rival !== state.filtro.rival) return false;
    return true;
  }).sort(function (a, b) {
    return (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0);
  });
}

function porteros() {
  var lista = (CFG.PORTEROS || []).slice();
  (state.porterosExtra || []).forEach(function (p) { if (lista.indexOf(p) < 0) lista.push(p); });
  state.goles.forEach(function (g) {
    if (g.portero && lista.indexOf(g.portero) < 0) lista.push(g.portero);
  });
  return lista;
}

function rivalesConGoles() {
  var lista = [];
  state.goles.forEach(function (g) { if (g.rival && lista.indexOf(g.rival) < 0) lista.push(g.rival); });
  return lista.sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

function rivales() {
  var lista = (CFG.RIVALES || []).slice();
  state.goles.forEach(function (g) {
    if (g.rival && lista.indexOf(g.rival) < 0) lista.push(g.rival);
  });
  return lista.sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

/* Jugadores conocidos de un rival: los de config.js más los que ya se han
   escrito en goles contra ese rival. */
function jugadoresDe(rival) {
  var lista = ((CFG.JUGADORES || {})[rival] || []).slice();
  state.goles.forEach(function (g) {
    if (g.rival !== rival) return;
    [g.goleador, g.asistente, g.penultimo].forEach(function (n) {
      if (n && lista.indexOf(n) < 0) lista.push(n);
    });
  });
  return lista.sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

/* Con la jornada se deduce la vuelta. */
function vueltaDeJornada(j) {
  j = parseInt(j, 10);
  if (!isFinite(j) || j < 1) return '';
  return j <= Math.ceil((CFG.JORNADAS || 42) / 2) ? 'Primera Vuelta' : 'Segunda Vuelta';
}

/* Partidos distintos, para calcular goles por partido. */
function partidos(goles) {
  var claves = {};
  goles.forEach(function (g) { claves[(g.fecha || '') + '|' + (g.rival || '')] = true; });
  return Object.keys(claves).filter(function (k) { return k !== '|'; }).length;
}

/* ============================== Router ============================== */

function ruta() {
  var h = (location.hash || '#/').replace(/^#/, '');
  var partes = h.split('/').filter(Boolean);
  var dec = function (x) { try { return decodeURIComponent(x || ''); } catch (e) { return x || ''; } };
  return { vista: partes[0] || 'registro', id: dec(partes[1]), extra: dec(partes[2]) };
}

function navegar(h) { location.hash = h; }

var TABBAR_GOLES = [
  ['#/', 'registro', 'Registro', '<path d="M4 5.5h16v13H4z"/><path d="M4 10h16M9 5.5v13"/>'],
  ['#/nuevo', 'nuevo', 'Nuevo gol', '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'],
  ['#/informe', 'informe', 'Informe', '<path d="M4 19.5V10M10 19.5V5M16 19.5v-6M21 19.5h-18"/>'],
  ['#/exportar', 'exportar', 'Exportar', '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16.5v3h16v-3"/>']
];

function htmlTabbar(pestanas, activa) {
  return pestanas.map(function (t) {
    return '<a href="' + t[0] + '" data-tab="' + t[1] + '" class="' + (activa === t[1] ? 'activa' : '') + '">' +
      '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + t[3] + '</svg>' +
      '<span>' + t[2] + '</span>' + (t[1] === 'registro' ? '<span class="pill" id="pill-total" hidden>0</span>' : '') + '</a>';
  }).join('');
}

function pintarModo() {
  $$('.modos a').forEach(function (a) { a.classList.toggle('sel', a.getAttribute('data-modo') === state.modo); });
}

function pintar() {
  var r = ruta();
  state.vista = r.vista;
  var app = $('#app');
  var esFin = r.vista.indexOf('fin') === 0;
  if (esFin) state.modo = 'fin';
  else if (r.vista !== 'exportar' && r.vista !== 'excel') state.modo = 'goles';
  try { localStorage.setItem('porteros:modo', state.modo); } catch (e) {}
  pintarModo();
  if (r.vista !== 'informe-pdf') document.body.classList.remove('imprimiendo');

  if (esFin && window.FIN) {
    window.FIN.pintar(app, r);
    $('.tabbar').innerHTML = htmlTabbar(window.FIN.pestanas(), window.FIN.pestanaActiva(r));
    actualizarBotonExcel();
    window.scrollTo(0, 0);
    return;
  }
  if (r.vista === 'exportar' && state.modo === 'fin' && window.FIN) {
    vistaExportar(app);
    $('.tabbar').innerHTML = htmlTabbar(window.FIN.pestanas(), 'exportar');
    actualizarBotonExcel();
    window.scrollTo(0, 0);
    return;
  }

  if (r.vista === 'nuevo')       vistaFormulario(app, null);
  else if (r.vista === 'editar') vistaFormulario(app, r.id);
  else if (r.vista === 'informe-pdf') vistaInformePDF(app);
  else if (r.vista === 'informe' || r.vista === 'panel') vistaInforme(app, r.id);
  else if (r.vista === 'exportar' || r.vista === 'excel') vistaExportar(app);
  else                           vistaRegistro(app);

  document.body.classList.toggle('imprimiendo', r.vista === 'informe-pdf');
  var activa = r.vista === 'editar' ? 'nuevo' : (r.vista === 'panel' || r.vista === 'informe-pdf') ? 'informe' : r.vista === 'excel' ? 'exportar' : r.vista;
  $('.tabbar').innerHTML = htmlTabbar(TABBAR_GOLES, activa);
  actualizarBotonExcel();
  var pill = $('#pill-total');
  if (pill) { pill.textContent = state.goles.length; pill.hidden = !state.goles.length; }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', pintar);

/* ============================== Arranque ============================== */

function arrancar() {
  var marca = CFG.MARCA || 'Goles encajados';
  var partes = marca.split('·');
  $('#brand-club').textContent = (partes[0] || marca).trim();
  $('#brand-sub').textContent = (partes[1] || 'Goles encajados').trim();
  document.title = marca;

  /* Almacenamiento persistente: el navegador no borrará los datos por
     falta de espacio sin que el usuario lo pida. */
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then(function (ok) {
      if (!ok) console.warn('El navegador no ha concedido almacenamiento persistente.');
    }).catch(function () {});
  }

  almacen.todos().then(function (gs) {
    state.goles = gs || [];
    return almacen.ajuste('excelHandle');
  }).then(function (h) {
    state.excelHandle = h || null;
    return almacen.ajuste('porteros');
  }).then(function (ps) {
    state.porterosExtra = Array.isArray(ps) ? ps : [];
    return almacen.ajuste('fotosPorteros');
  }).then(function (f) {
    state.fotosPorteros = f && typeof f === 'object' ? f : {};
    return window.FIN && window.FIN.cargar ? window.FIN.cargar() : null;
  }).then(function () {
    pintar();
  }).catch(function (e) {
    aviso('No se ha podido abrir el almacén del navegador: ' + e, 'error');
    pintar();
  });

  $('#btn-excel-rapido').addEventListener('click', function () { exportarExcel(); });
}

/* El botón de cabecera solo aparece cuando hay un archivo Excel enlazado:
   el Excel se genera a petición, no es el centro de la app. */
function actualizarBotonExcel() {
  var b = $('#btn-excel-rapido');
  if (b) b.hidden = !state.excelHandle;
}

/* El resto del archivo define las vistas. Se declaran con function para
   que estén disponibles aquí arriba. */

/* ============================== Componentes ============================== */

function chips(campo, opciones, valor, multi) {
  return '<div class="chips" data-campo="' + esc(campo) + '">' + opciones.map(function (o) {
    var sel = multi ? (valor || []).indexOf(o) >= 0 : valor === o;
    return '<button type="button" class="chip' + (sel ? ' sel' : '') + '" data-chip="' +
           esc(campo) + '" data-valor="' + esc(o) + '"' + (multi ? ' data-multi="1"' : '') + '>' + esc(o) + '</button>';
  }).join('') + '</div>';
}

function campoTexto(nombre, etiqueta, valor, opts) {
  opts = opts || {};
  return '<label class="campo"><span>' + esc(etiqueta) + '</span>' +
    '<input type="' + (opts.tipo || 'text') + '" name="' + esc(nombre) + '" value="' + esc(valor) + '"' +
    (opts.lista ? ' list="lista-' + esc(nombre) + '"' : '') +
    (opts.min != null ? ' min="' + opts.min + '"' : '') + (opts.max != null ? ' max="' + opts.max + '"' : '') +
    (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') +
    (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '>' +
    (opts.lista ? '<datalist id="lista-' + esc(nombre) + '">' + opts.lista.map(function (v) {
      return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>' : '') +
    '</label>';
}

function campoSelect(nombre, etiqueta, opciones, valor, vacio) {
  return '<label class="campo"><span>' + esc(etiqueta) + '</span><select name="' + esc(nombre) + '">' +
    (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') +
    opciones.map(function (o) {
      return '<option value="' + esc(o) + '"' + (o === valor ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('') + '</select></label>';
}

/* --- Dibujo del campo propio con las 20 zonas --- */
function svgCampo(sel, opts) {
  opts = opts || {};
  var M = Z.MEDIDAS, cuenta = opts.cuenta || {};
  var max = 0;
  Object.keys(cuenta).forEach(function (k) { if (cuenta[k] > max) max = cuenta[k]; });

  var zonas = Z.CAMPO.map(function (z) {
    var c = Z.centro(z.poligono), n = cuenta[z.n] || 0, esSel = String(sel) === String(z.n);
    var calor = (max && !esSel) ? ' style="fill-opacity:' + (0.12 + 0.75 * n / max) + '"' : '';
    return '<polygon class="zona' + (esSel ? ' sel' : '') + (n ? ' calor' : '') + '" ' +
           'data-zona="' + z.n + '" points="' + Z.puntos(z.poligono) + '"' + calor + '>' +
           '<title>' + z.n + ' · ' + esc(z.nombre) + (opts.cuenta ? ' · ' + n : '') + '</title></polygon>' +
           '<text class="num" x="' + c[0] + '" y="' + (c[1] + (opts.cuenta ? -6 : 8)) + '">' + z.n + '</text>' +
           (opts.cuenta ? '<text class="val" x="' + c[0] + '" y="' + (c[1] + 18) + '">' + n + '</text>' : '');
  }).join('');

  var lineas =
    '<rect class="cesped" x="0" y="0" width="' + M.ancho + '" height="' + M.fondo + '"/>' +
    '<rect class="linea" x="' + M.graIzq + '" y="0" width="' + (M.graDer - M.graIzq) + '" height="' + M.graFondo + '"/>' +
    '<rect class="linea" x="' + M.peqIzq + '" y="0" width="' + (M.peqDer - M.peqIzq) + '" height="' + M.peqFondo + '"/>' +
    '<circle class="linea" cx="340" cy="110" r="3"/>' +
    '<path class="linea" d="M 266 165 A 91.5 91.5 0 0 0 414 165"/>' +
    '<path class="linea" d="M 248.5 525 A 91.5 91.5 0 0 1 431.5 525"/>' +
    '<rect class="porteria" x="' + M.portIzq + '" y="-22" width="' + (M.portDer - M.portIzq) + '" height="22"/>';

  return '<svg class="campo" viewBox="0 -30 ' + M.ancho + ' ' + (M.fondo + 30) + '" role="img" aria-label="Campo propio">' +
         zonas + lineas + '</svg>';
}

/* --- Dibujo de la portería con las 8 zonas --- */
function svgPorteria(sel, opts) {
  opts = opts || {};
  var M = Z.MEDIDAS, cuenta = opts.cuenta || {};
  var max = 0;
  Object.keys(cuenta).forEach(function (k) { if (cuenta[k] > max) max = cuenta[k]; });

  var lista = opts.fuera ? Z.PORTERIA.concat(Z.FUERA) : Z.PORTERIA;
  var zonas = lista.map(function (z) {
    var c = Z.centro(z.poligono), n = cuenta[z.n] || 0, esSel = String(sel) === String(z.n);
    var calor = (max && !esSel) ? ' style="fill-opacity:' + (0.12 + 0.75 * n / max) + '"' : '';
    var esFuera = typeof z.n === 'string';
    return '<polygon class="zona' + (esSel ? ' sel' : '') + (n ? ' calor' : '') + (esFuera ? ' fuera' : '') + '" ' +
           'data-zona="' + z.n + '" points="' + Z.puntos(z.poligono) + '"' + calor + '>' +
           '<title>' + z.n + ' · ' + esc(z.nombre) + (opts.cuenta ? ' · ' + n : '') + '</title></polygon>' +
           '<text class="num' + (esFuera ? ' num-fuera' : '') + '" x="' + c[0] + '" y="' + (c[1] + (opts.cuenta ? -8 : 10)) + '">' + (esFuera ? 'FUERA' : z.n) + '</text>' +
           (opts.cuenta ? '<text class="val" x="' + c[0] + '" y="' + (c[1] + 24) + '">' + n + '</text>' : '');
  }).join('');

  var vb = opts.fuera ? '-200 -120 ' + (M.pAncho + 400) + ' ' + (M.pAlto + 126) : '-14 -14 ' + (M.pAncho + 28) + ' ' + (M.pAlto + 20);
  return '<svg class="porteria' + (opts.fuera ? ' con-fuera' : '') + '" viewBox="' + vb + '" role="img" aria-label="Portería">' +
         '<rect class="red" x="0" y="0" width="' + M.pAncho + '" height="' + M.pAlto + '"/>' + zonas +
         '<path class="palos" d="M -6 ' + M.pAlto + ' V -6 H ' + (M.pAncho + 6) + ' V ' + M.pAlto + '"/>' +
         '<line class="suelo" x1="' + (opts.fuera ? -200 : -14) + '" y1="' + M.pAlto + '" x2="' + (M.pAncho + (opts.fuera ? 200 : 14)) + '" y2="' + M.pAlto + '"/>' +
         '</svg>';
}

function etiquetaZona(tipo, n) {
  var z = tipo === 'campo' ? Z.campo(n) : Z.porteriaOFuera(n);
  return z ? z.n + ' · ' + z.nombre : '—';
}

/* Reduce una imagen a maxPx de lado y la devuelve como data URL. */
function leerImagen(file, maxPx) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var k = Math.min(1, maxPx / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No es una imagen')); };
    img.src = url;
  });
}

function iniciales(nombre) {
  return String(nombre || '?').split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
}

function avatarPortero(nombre) {
  var f = state.fotosPorteros[nombre];
  return f ? '<img class="avatar" src="' + f + '" alt="' + esc(nombre) + '">'
           : '<span class="avatar avatar-ini">' + esc(iniciales(nombre)) + '</span>';
}

function escudoPropio() {
  var eq = (CFG.EQUIPOS || [])[0] || '';
  var e = window.FIN && window.FIN._D && window.FIN._D.equipos[eq];
  return e && e.escudo ? '<img class="escudo" src="' + e.escudo + '" alt="' + esc(eq) + '">' : '';
}

/* Cabecera con la foto del portero (clic para subirla). */
function cabeceraPortero(app, nombre) {
  var input = $('#in-foto-portero', app);
  if (!input) return;
  input.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    leerImagen(f, 320).then(function (d) {
      state.fotosPorteros[nombre] = d;
      return almacen.ponAjuste('fotosPorteros', state.fotosPorteros);
    }).then(function () { aviso('Foto guardada.', 'ok'); pintar(); })
      .catch(function () { aviso('No se pudo leer la imagen.', 'error'); });
  });
}

/* ============================== Vista: registro ============================== */

function vistaRegistro(app) {
  app.onclick = null;
  state.volverA = '#/';
  var gs = golesFiltrados();
  var ps = porteros(), rs = rivalesConGoles();

  var filtros =
    '<div class="filtros">' +
      (ps.length > 1 ? campoSelect('f-portero', 'Portero', ps, state.filtro.portero, 'Todos los porteros') : '') +
      (rs.length ? campoSelect('f-rival', 'Rival', rs, state.filtro.rival, 'Todos los rivales') : '') +
    '</div>';

  var cuerpo;
  if (!state.goles.length) {
    cuerpo = '<div class="vacio">' +
      '<h2>Todavía no hay goles registrados</h2>' +
      '<p>Pulsa <strong>Nuevo gol</strong>, elige el clip, marca la zona de disparo y la zona de portería, y guarda. ' +
      'El Excel se genera desde la pestaña <strong>Excel</strong>.</p>' +
      '<a class="btn primary grande" href="#/nuevo">+ Registrar el primer gol</a>' +
      '</div>';
  } else if (!gs.length) {
    cuerpo = '<p class="vacio">Ningún gol coincide con el filtro.</p>';
  } else {
    /* Agrupado por partido */
    var grupos = [], idx = {};
    gs.forEach(function (g) {
      var k = (g.fecha || '') + '|' + (g.rival || '');
      if (idx[k] == null) { idx[k] = grupos.length; grupos.push({ clave: k, fecha: g.fecha, rival: g.rival, campo: g.campo, resultado: g.resultado, jornada: g.jornada, goles: [] }); }
      grupos[idx[k]].goles.push(g);
    });
    cuerpo = grupos.map(function (p) {
      var cab = [fechaCorta(p.fecha), p.jornada ? 'J' + p.jornada : '', p.rival ? 'vs ' + p.rival : '', p.campo, p.resultado].filter(Boolean).map(esc).join(' · ');
      return '<section class="partido"><h3>' + (cab || 'Sin partido') + ' <span class="cuenta">' + p.goles.length + '</span></h3>' +
        p.goles.sort(function (a, b) { return (a.minuto || 0) - (b.minuto || 0); }).map(tarjetaGol).join('') + '</section>';
    }).join('');
  }

  app.innerHTML = '<div class="vista">' +
    '<div class="vista-cab"><h1>Registro</h1><a class="btn primary" href="#/nuevo">+ Nuevo gol</a></div>' +
    (state.goles.length ? filtros : '') + cuerpo + '</div>';

  $$('select[name^="f-"]', app).forEach(function (s) {
    s.addEventListener('change', function () {
      state.filtro[s.name.replace('f-', '')] = s.value;
      pintar();
    });
  });
}

function tarjetaGol(g) {
  var zc = Z.campo(g.zonaDisparo), zp = Z.porteria(g.zonaPorteria);
  var ev = g.evitabilidad ? '<span class="badge ' + claseEvit(g.evitabilidad) + '">' + esc(g.evitabilidad) + '</span>' : '';
  var tieneVideo = !!g.videoId, tieneLink = !!g.link;
  return '<article class="gol" data-id="' + esc(g.id) + '">' +
    '<div class="gol-min">' + (g.minuto != null && g.minuto !== '' ? esc(g.minuto) + '\'' : '—') + '</div>' +
    '<div class="gol-cuerpo">' +
      '<div class="gol-tit">' + esc(g.tipo || 'Sin tipo') + (g.subtipo ? ' <span class="muted">· ' + esc(g.subtipo) + '</span>' : '') + '</div>' +
      '<div class="gol-meta">' +
        (g.portero ? esc(g.portero) + ' · ' : '') +
        'Disparo <strong>' + (zc ? zc.n : '?') + '</strong> ' + (zc ? '<span class="muted">' + esc(zc.corto) + '</span>' : '') +
        ' · Portería <strong>' + (zp ? zp.n : '?') + '</strong> ' + (zp ? '<span class="muted">' + esc(zp.corto) + '</span>' : '') +
        (g.golpeo ? ' · ' + esc(g.golpeo) : '') +
      '</div>' +
      '<div class="gol-pie">' + ev +
        (g.responsabilidad ? '<span class="badge">' + esc(g.responsabilidad) + '</span>' : '') +
        (tieneVideo ? '<span class="badge video">🎬 clip</span>' : '') +
        (tieneLink ? '<a class="badge link" href="' + esc(g.link) + '" target="_blank" rel="noopener">🔗 enlace</a>' : '') +
      '</div>' +
    '</div>' +
    ((g.fotoRemate || g.fotoGol) ? '<div class="gol-fotos">' +
      (g.fotoRemate ? '<img src="' + g.fotoRemate + '" alt="Remate" title="Remate">' : '') +
      (g.fotoGol ? '<img src="' + g.fotoGol + '" alt="Gol" title="Gol">' : '') + '</div>' : '') +
    '<a class="gol-editar" href="#/editar/' + esc(g.id) + '" aria-label="Editar">›</a>' +
  '</article>';
}

function claseEvit(v) {
  return v === 'Evitable' ? 'rojo' : v === 'Parcialmente evitable' ? 'ambar' : 'verde';
}

/* ============================== Vista: formulario ============================== */

function borradorNuevo() {
  /* Los datos del partido se copian del último gol: con tres goles del
     mismo partido solo se rellena el partido una vez. */
  var ultimo = state.goles.slice().sort(function (a, b) { return (b.creado || 0) - (a.creado || 0); })[0] || {};
  var esMismoDia = ultimo.fecha === hoyISO();
  return {
    id: idNuevo(), creado: Date.now(),
    fecha: ultimo.fecha || hoyISO(), jornada: ultimo.jornada || '', rival: ultimo.rival || '',
    campo: ultimo.campo || 'Local', vuelta: ultimo.vuelta || 'Primera Vuelta', resultado: ultimo.resultado || '',
    equipo: 'Rival', /* siempre: la app registra goles encajados */
    portero: ultimo.portero || (CFG.PORTEROS || [])[0] || '',
    equipoPropio: ultimo.equipoPropio || (CFG.EQUIPOS || [])[0] || '',
    parte: '', minuto: '', periodo: '', status: '',
    tipo: '', subtipo: '', golpeo: '', goleador: '', asistente: '', penultimo: '',
    zonaDisparo: '', area: '', banda: '', zonaPorteria: '',
    evitabilidad: '', responsabilidad: '', accion: '', posicion: '', errores: [], aciertos: [], pie: '', observaciones: '', correctivo: '',
    videoId: '', videoNombre: '', videoTam: 0, link: '',
    instanteRemate: null, instanteGol: null, fotoRemate: '', fotoGol: '',
    _mismoDia: esMismoDia
  };
}

function vistaFormulario(app, id) {
  app.onclick = null;
  var g;
  if (id) {
    g = state.goles.filter(function (x) { return x.id === id; })[0];
    if (!g) { navegar('#/'); return; }
    g = JSON.parse(JSON.stringify(g));
    if (!g.errores) g.errores = [];
    if (!g.aciertos) g.aciertos = [];
  } else {
    g = borradorNuevo();
  }
  state.borrador = g;
  state.videoArchivo = null;

  var volver = state.volverA || '#/';
  var etiquetaVolver = id ? (volver.indexOf('#/informe') === 0 ? '← Volver al informe' : '← Volver al registro') : 'Cancelar';
  var html =
  '<form class="vista formulario" id="form-gol" autocomplete="off">' +
    '<div class="vista-cab"><h1>' + (id ? 'Editar gol' : 'Nuevo gol') + '</h1>' +
      '<a class="btn" href="' + esc(volver) + '">' + etiquetaVolver + '</a></div>' +

    /* ---- Vídeo ---- */
    '<section class="bloque"><h2>1 · Clip del gol</h2>' +
      '<div id="zona-video"></div>' +
      '<div class="fila">' +
        '<label class="btn archivo">Elegir vídeo<input type="file" accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.MP4,.MOV" id="in-video" hidden></label>' +
        campoTexto('link', 'o enlace (YouTube, Drive, Veo…)', g.link, { tipo: 'url', placeholder: 'https://…' }) +
      '</div>' +
      (CFG.GUARDAR_VIDEO === false ? '<p class="nota">La app no guarda el vídeo, solo su nombre. Cambia GUARDAR_VIDEO en config.js si quieres verlo desde aquí.</p>' : '') +
    '</section>' +

    /* ---- Partido ---- */
    '<section class="bloque"><h2>2 · Partido</h2>' +
      '<div class="rejilla">' +
        campoTexto('fecha', 'Fecha', g.fecha, { tipo: 'date' }) +
        campoTexto('jornada', 'Jornada', g.jornada, { inputmode: 'numeric', placeholder: 'nº' }) +
        campoSelect('rival', 'Rival', rivales().concat(['+ Otro rival…']), g.rival, 'Elige el rival') +
        campoSelect('portero', 'Portero', porteros().concat(['+ Añadir portero…']), g.portero, 'Sin portero') +
        ((CFG.EQUIPOS || []).length > 1 ? campoSelect('equipoPropio', 'Equipo', CFG.EQUIPOS, g.equipoPropio) : '') +
      '</div>' +
      '<div class="rejilla-chips">' +
        '<div><span class="et">Campo</span>' + chips('campo', T.CAMPO, g.campo) + '</div>' +
        '<div><span class="et">Vuelta</span>' + chips('vuelta', T.VUELTA, g.vuelta) + '</div>' +
        '<div><span class="et">Resultado final</span>' + chips('resultado', T.RESULTADO, g.resultado) + '</div>' +
      '</div>' +
    '</section>' +

    /* ---- Momento ---- */
    '<section class="bloque"><h2>3 · Momento</h2>' +
      '<div class="rejilla">' +
        campoTexto('minuto', 'Minuto', g.minuto, { tipo: 'number', min: 0, max: 130, inputmode: 'numeric' }) +
        '<div class="campo"><span>Periodo</span><output id="out-periodo" class="salida">' + esc(g.periodo || periodoDeMinuto(g.minuto) || '—') + '</output></div>' +
      '</div>' +
      '<div class="rejilla-chips">' +
        '<div><span class="et">Parte</span>' + chips('parte', T.PARTE, g.parte) + '</div>' +
        '<div><span class="et">Marcador en ese momento</span>' + chips('status', T.STATUS, g.status) + '</div>' +
      '</div>' +
    '</section>' +

    /* ---- Jugada ---- */
    '<section class="bloque"><h2>4 · Jugada</h2>' +
      '<span class="et">Tipo</span>' + chips('tipo', T.TIPO, g.tipo) +
      '<div id="zona-subtipo">' + htmlSubtipo(g) + '</div>' +
      '<span class="et">Golpeo</span>' + chips('golpeo', T.GOLPEO, g.golpeo) +
      '<div class="rejilla" id="zona-jugadores">' + htmlJugadores(g) + '</div>' +
    '</section>' +

    /* ---- Zona de disparo ---- */
    '<section class="bloque"><h2>5 · Zona de disparo</h2>' +
      '<p class="nota">Toca la zona desde donde se remata. Nuestra portería está arriba. Izquierda y derecha, las del dibujo.</p>' +
      '<div id="zona-campo">' + svgCampo(g.zonaDisparo) + '</div>' +
      '<p class="sel-zona" id="txt-zona-campo">' + esc(etiquetaZona('campo', g.zonaDisparo)) + '</p>' +
      '<div class="rejilla-chips">' +
        '<div><span class="et">Área <small>(se rellena sola)</small></span>' + chips('area', T.AREA, g.area) + '</div>' +
        '<div><span class="et">Banda <small>(se rellena sola)</small></span>' + chips('banda', T.BANDA, g.banda) + '</div>' +
      '</div>' +
    '</section>' +

    /* ---- Zona de portería ---- */
    '<section class="bloque"><h2>6 · Zona de portería</h2>' +
      '<p class="nota">Vista frontal desde el campo. Toca por dónde entra el balón.</p>' +
      '<div id="zona-porteria">' + svgPorteria(g.zonaPorteria) + '</div>' +
      '<p class="sel-zona" id="txt-zona-porteria">' + esc(etiquetaZona('porteria', g.zonaPorteria)) + '</p>' +
    '</section>' +

    /* ---- Valoración ---- */
    '<section class="bloque"><h2>7 · Valoración del portero <small>(opcional)</small></h2>' +
      '<div class="rejilla-chips">' +
        '<div><span class="et">¿Era evitable?</span>' + chips('evitabilidad', G.EVITABILIDAD, g.evitabilidad) + '</div>' +
        '<div><span class="et">Responsabilidad</span>' + chips('responsabilidad', G.RESPONSABILIDAD, g.responsabilidad) + '</div>' +
        '<div><span class="et">Acción del portero</span>' + chips('accion', G.ACCION, g.accion) + '</div>' +
        '<div><span class="et">Posición de partida</span>' + chips('posicion', G.POSICION, g.posicion) + '</div>' +
        '<div><span class="et">Errores detectados <small>(varios)</small></span>' + chips('errores', G.ERROR, g.errores, true) + '</div>' +
        '<div><span class="et">Aciertos del portero <small>(varios)</small></span>' + chips('aciertos', G.ACIERTO, g.aciertos, true) + '</div>' +
      '</div>' +
      '<label class="campo"><span>Observaciones</span><textarea name="observaciones" rows="2">' + esc(g.observaciones) + '</textarea></label>' +
      '<label class="campo"><span>Trabajo correctivo propuesto</span><textarea name="correctivo" rows="2" placeholder="Ejercicio o tarea para entrenar esto">' + esc(g.correctivo) + '</textarea></label>' +
    '</section>' +

    '<div class="acciones">' +
      '<button type="submit" class="btn primary grande" data-accion="guardar">Guardar gol</button>' +
      (!id ? '<button type="submit" class="btn grande" data-accion="otro">Guardar y añadir otro</button>' : '') +
      (id ? '<a class="btn grande" href="' + esc(volver) + '">' + etiquetaVolver + '</a>' : '') +
      (id ? '<button type="button" class="btn peligro" id="btn-borrar">Borrar este gol</button>' : '') +
    '</div>' +
  '</form>';

  app.innerHTML = html;
  montarFormulario(app, g, !!id);
}

/* Goleador, asistente y penúltimo pasador: escribes o eliges de la lista
   del rival (y si es gol a favor, de la lista del equipo propio). */
function htmlJugadores(g) {
  var equipo = g.equipo === 'Mi equipo' ? g.equipoPropio : g.rival;
  var lista = equipo ? jugadoresDe(equipo) : [];
  var ph = equipo ? 'Elige o escribe' : 'Elige primero el rival';
  return campoTexto('goleador', 'Goleador', g.goleador, { lista: lista, placeholder: ph }) +
         campoTexto('asistente', 'Asistente', g.asistente, { lista: lista, placeholder: ph }) +
         campoTexto('penultimo', 'Penúltimo pasador', g.penultimo, { lista: lista, placeholder: ph });
}

function htmlSubtipo(g) {
  var lista = SUBTIPO[g.tipo];
  if (!lista) return '';
  return '<span class="et">Subtipo</span>' + chips('subtipo', lista, g.subtipo) +
    (g.tipo === 'Acción a balón parado'
      ? '<span class="et">Pie del lanzador <small>(opcional)</small></span>' + chips('pie', G.PIE, g.pie)
      : '');
}

function montarFormulario(app, g, editando) {
  var form = $('#form-gol', app);

  /* Añadir un portero nuevo sin tocar config.js */
  var selPortero = $('select[name=portero]', form);
  if (selPortero) selPortero.addEventListener('change', function () {
    if (selPortero.value !== '+ Añadir portero…') return;
    var nombre = (prompt('Nombre del portero:') || '').trim();
    if (nombre && porteros().indexOf(nombre) < 0) {
      state.porterosExtra.push(nombre);
      almacen.ponAjuste('porteros', state.porterosExtra.slice());
    }
    g.portero = nombre || g.portero || '';
    var op = document.createElement('option');
    op.value = op.textContent = g.portero;
    if (g.portero && !selPortero.querySelector('option[value="' + g.portero.replace(/"/g, '&quot;') + '"]')) selPortero.insertBefore(op, selPortero.lastElementChild);
    selPortero.value = g.portero;
  });

  /* Rival fuera de la liga (Copa, amistoso) */
  var selRival = $('select[name=rival]', form);
  if (selRival) selRival.addEventListener('change', function () {
    if (selRival.value === '+ Otro rival…') {
      var nombre = (prompt('Nombre del rival:') || '').trim();
      g.rival = nombre || g.rival || '';
      if (g.rival && !selRival.querySelector('option[value="' + g.rival.replace(/"/g, '&quot;') + '"]')) {
        var op = document.createElement('option');
        op.value = op.textContent = g.rival;
        selRival.insertBefore(op, selRival.lastElementChild);
      }
      selRival.value = g.rival;
    } else g.rival = selRival.value;
    $('#zona-jugadores', form).innerHTML = htmlJugadores(g);
  });

  /* Inputs nativos → borrador */
  form.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.name) return;
    if (el.name === 'portero' && el.value === '+ Añadir portero…') return;
    if (el.name === 'rival' && el.value === '+ Otro rival…') return;
    if (el.name === 'jornada') {
      var vu = vueltaDeJornada(el.value);
      if (vu) { g.vuelta = vu; marcarChip(form, 'vuelta', vu); }
    }
    g[el.name] = el.value;
    if (el.name === 'minuto') {
      g.periodo = periodoDeMinuto(el.value);
      $('#out-periodo').textContent = g.periodo || '—';
      if (!g.parte && g.periodo) {
        var m = parseInt(el.value, 10);
        g.parte = m <= 45 ? 'Primera Parte' : 'Segunda Parte';
        marcarChip(form, 'parte', g.parte);
      }
    }
  });

  /* Chips */
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-chip]');
    if (!b) return;
    e.preventDefault();
    var campo = b.getAttribute('data-chip'), valor = b.getAttribute('data-valor');
    if (b.getAttribute('data-multi')) {
      var i = g[campo].indexOf(valor);
      var excluyente = campo === 'errores' ? 'Sin error del portero' : 'Nada que destacar';
      if (valor === excluyente) g[campo] = i >= 0 ? [] : [valor];
      else { if (i >= 0) g[campo].splice(i, 1); else g[campo].push(valor); g[campo] = g[campo].filter(function (v) { return v !== excluyente; }); }
      $$('[data-chip="' + campo + '"]', form).forEach(function (c) {
        c.classList.toggle('sel', g[campo].indexOf(c.getAttribute('data-valor')) >= 0);
      });
      return;
    }
    /* Un chip simple no se desmarca al volver a tocarlo: con los datos
       del partido prerrellenados, un toque de más borraba el valor. */
    g[campo] = valor;
    marcarChip(form, campo, g[campo]);
    if (campo === 'tipo') { g.subtipo = ''; g.pie = ''; $('#zona-subtipo').innerHTML = htmlSubtipo(g); }
    if (campo === 'equipo') $('#zona-jugadores', form).innerHTML = htmlJugadores(g);
  });

  /* Zonas */
  $('#zona-campo', form).addEventListener('click', function (e) {
    var p = e.target.closest('[data-zona]');
    if (!p) return;
    g.zonaDisparo = parseInt(p.getAttribute('data-zona'), 10);
    var z = Z.campo(g.zonaDisparo);
    g.area = z.dentroArea ? 'Dentro del Area' : 'Fuera del Area';
    g.banda = z.banda;
    $$('#zona-campo [data-zona]', form).forEach(function (q) { q.classList.toggle('sel', q === p); });
    $('#txt-zona-campo').textContent = etiquetaZona('campo', g.zonaDisparo);
    marcarChip(form, 'area', g.area);
    marcarChip(form, 'banda', g.banda);
  });
  $('#zona-porteria', form).addEventListener('click', function (e) {
    var p = e.target.closest('[data-zona]');
    if (!p) return;
    g.zonaPorteria = parseInt(p.getAttribute('data-zona'), 10);
    $$('#zona-porteria [data-zona]', form).forEach(function (q) { q.classList.toggle('sel', q === p); });
    $('#txt-zona-porteria').textContent = etiquetaZona('porteria', g.zonaPorteria);
  });

  /* Vídeo */
  montarVideo(form, g);

  /* Guardar */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var accion = (e.submitter && e.submitter.getAttribute('data-accion')) || 'guardar';
    guardarGol(g, accion);
  });

  var borrar = $('#btn-borrar', form);
  if (borrar) borrar.addEventListener('click', function () {
    if (!confirm('¿Borrar este gol? No se puede deshacer.')) return;
    almacen.borrar(g.id).then(function () { return g.videoId ? almacen.quitaVideo(g.videoId) : null; })
      .then(function () {
        state.goles = state.goles.filter(function (x) { return x.id !== g.id; });
        aviso('Gol borrado.');
        navegar(state.volverA || '#/');
      });
  });
}

function marcarChip(form, campo, valor) {
  $$('[data-chip="' + campo + '"]', form).forEach(function (c) {
    c.classList.toggle('sel', c.getAttribute('data-valor') === valor);
  });
}

/* --- Reproductor --- */

var _urlVideo = null;
var _etqFoto = { remate: 'Remate', gol: 'Gol' };

function montarVideo(form, g, opts) {
  _etqFoto = (opts && opts.etiquetas) || { remate: 'Remate', gol: 'Gol' };
  var zona = $('#zona-video', form);
  var input = $('#in-video', form);

  function pintarVideo(src, nombre, tam) {
    /* Se libera la URL del vídeo anterior, nunca la que se va a mostrar. */
    if (_urlVideo && _urlVideo !== src) URL.revokeObjectURL(_urlVideo);
    _urlVideo = src || null;
    if (!src) {
      zona.innerHTML = g.videoNombre
        ? '<p class="nota">Clip: <strong>' + esc(g.videoNombre) + '</strong>' + (g.videoTam ? ' (' + megas(g.videoTam) + ' MB)' : '') + '</p>'
        : '<div class="sin-video"><strong>Arrastra aquí el vídeo</strong> desde una carpeta, o elige el archivo, o pega un enlace.</div>';
      return;
    }
    zona.innerHTML =
      '<video id="vid" src="' + src + '" controls playsinline preload="metadata"></video>' +
      '<div class="vid-ctl">' +
        '<button type="button" data-vel="0.25">0.25×</button>' +
        '<button type="button" data-vel="0.5">0.5×</button>' +
        '<button type="button" data-vel="1" class="sel">1×</button>' +
        '<span class="sep"></span>' +
        '<button type="button" data-paso="-1">◀ fotograma</button>' +
        '<button type="button" data-paso="1">fotograma ▶</button>' +
        '<span class="sep"></span>' +
        '<button type="button" class="foto" data-foto="remate">📸 ' + esc(_etqFoto.remate) + '</button>' +
        '<button type="button" class="foto" data-foto="gol">📸 ' + esc(_etqFoto.gol) + '</button>' +
      '</div>' +
      '<div class="fotos" id="fotos"></div>' +
      '<p class="nota">' + esc(nombre || '') + (tam ? ' · ' + megas(tam) + ' MB' : '') +
      (tam && megas(tam) > (CFG.AVISO_VIDEO_MB || 80) ? ' · <strong>Pesa bastante</strong>: recórtalo al gol para no llenar el móvil.' : '') + '</p>';

    var v = $('#vid', zona);
    v.addEventListener('error', function () {
      var c = v.error && v.error.code;
      var msg = c === 4
        ? 'Chrome/Edge no puede reproducir este vídeo. Casi siempre es un MP4 en H.265/HEVC (iPhone, algunas cámaras y plataformas de análisis). Conviértelo a H.264 (por ejemplo con HandBrake, perfil «Fast 1080p30») o pega un enlace.'
        : 'No se ha podido cargar el vídeo (código ' + c + ').';
      var p = document.createElement('p');
      p.className = 'nota error-video';
      p.textContent = msg;
      zona.appendChild(p);
    });
    v.addEventListener('loadedmetadata', function () {
      var ir = g.instanteRemate != null ? g.instanteRemate : g.instanteGol;
      if (ir != null && v.videoWidth) v.currentTime = ir;
      if (!v.videoWidth) {
        var p = document.createElement('p');
        p.className = 'nota error-video';
        p.textContent = 'El archivo se ha abierto pero el navegador no muestra imagen: el códec de vídeo no es compatible (probablemente H.265/HEVC). Conviértelo a H.264 o pega un enlace.';
        zona.appendChild(p);
      }
    });
    if (zona._conControles) return;
    zona._conControles = true;
    zona.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var v = $('#vid', zona);
      if (!v) return;
      if (b.hasAttribute('data-vel')) {
        v.playbackRate = parseFloat(b.getAttribute('data-vel'));
        $$('[data-vel]', zona).forEach(function (x) { x.classList.toggle('sel', x === b); });
      } else if (b.hasAttribute('data-paso')) {
        v.pause();
        v.currentTime = Math.max(0, v.currentTime + parseInt(b.getAttribute('data-paso'), 10) / 25);
      } else if (b.hasAttribute('data-foto')) {
        capturarFotograma(v, g, b.getAttribute('data-foto'));
        pintarFotos(g);
      } else if (b.hasAttribute('data-ir')) {
        v.pause();
        v.currentTime = parseFloat(b.getAttribute('data-ir'));
      } else if (b.hasAttribute('data-quitar')) {
        var cual = b.getAttribute('data-quitar');
        g[cual === 'remate' ? 'fotoRemate' : 'fotoGol'] = '';
        g[cual === 'remate' ? 'instanteRemate' : 'instanteGol'] = null;
        pintarFotos(g);
      }
    });
    pintarFotos(g);
  }

  function cargarArchivo(f) {
    if (!f) return;
    if (f.type && f.type.indexOf('video/') !== 0 && !/\.(mp4|m4v|mov|webm|mkv|avi)$/i.test(f.name)) {
      aviso('Eso no parece un vídeo (' + f.name + ').', 'error'); return;
    }
    g.videoNombre = f.name; g.videoTam = f.size;
    var limite = (CFG.MAX_VIDEO_MB || 600);
    if (megas(f.size) > limite) {
      state.videoArchivo = null;
      aviso('El vídeo pesa ' + megas(f.size) + ' MB: se reproduce ahora pero no se guardará en la app. Recorta el clip al gol (menos de ' + limite + ' MB) si quieres conservarlo.', 'error');
    } else {
      state.videoArchivo = f;
    }
    pintarVideo(URL.createObjectURL(f), f.name, f.size);
  }

  input.addEventListener('change', function () {
    cargarArchivo(input.files && input.files[0]);
    input.value = '';
  });

  /* Arrastrar el vídeo desde el explorador y soltarlo en cualquier parte
     del formulario. */
  ['dragenter', 'dragover'].forEach(function (ev) {
    form.addEventListener(ev, function (e) { e.preventDefault(); form.classList.add('arrastrando'); });
  });
  form.addEventListener('dragleave', function (e) { if (!form.contains(e.relatedTarget)) form.classList.remove('arrastrando'); });
  form.addEventListener('drop', function (e) {
    e.preventDefault();
    form.classList.remove('arrastrando');
    cargarArchivo(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  });

  if (g.videoId) {
    almacen.video(g.videoId).then(function (r) {
      if (r && r.blob) pintarVideo(URL.createObjectURL(r.blob), r.nombre, r.blob.size);
      else pintarVideo(null);
    });
  } else pintarVideo(null);
}

/* Guarda el fotograma actual del vídeo como imagen JPEG (máx. 800 px de
   ancho) dentro del propio gol, junto con el segundo exacto. */
function capturarFotograma(v, g, cual) {
  if (!v.videoWidth) { aviso('El vídeo aún no se ha cargado.', 'error'); return; }
  var ancho = Math.min(800, v.videoWidth), alto = Math.round(v.videoHeight * ancho / v.videoWidth);
  var c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  c.getContext('2d').drawImage(v, 0, 0, ancho, alto);
  var dataUrl;
  try { dataUrl = c.toDataURL('image/jpeg', 0.82); }
  catch (e) { aviso('No se puede capturar la imagen de un vídeo enlazado desde otra web; usa un archivo.', 'error'); return; }
  var t = Math.round(v.currentTime * 100) / 100;
  if (cual === 'remate') { g.fotoRemate = dataUrl; g.instanteRemate = t; }
  else { g.fotoGol = dataUrl; g.instanteGol = t; }
  aviso('Fotograma del ' + cual + ' guardado (' + t.toFixed(2) + ' s).', 'ok');
}

function pintarFotos(g) {
  var zona = $('#fotos');
  if (!zona) return;
  function tarjeta(cual, foto, t) {
    var et = cual === 'remate' ? _etqFoto.remate : _etqFoto.gol;
    if (!foto) return '<div class="foto-vacia">' + et + ': sin fotograma</div>';
    return '<figure class="foto-mini"><img src="' + foto + '" alt="' + et + '">' +
      '<figcaption>' + et + ' · ' + (t != null ? t.toFixed(2) + ' s' : '') +
      ' <button type="button" data-ir="' + t + '">ir</button>' +
      ' <button type="button" data-quitar="' + cual + '">quitar</button></figcaption></figure>';
  }
  zona.innerHTML = tarjeta('remate', g.fotoRemate, g.instanteRemate) + tarjeta('gol', g.fotoGol, g.instanteGol);
}

/* Guarda el vídeo pendiente (si lo hay) con el id del registro. */
function persistirVideo(obj) {
  if (!state.videoArchivo || CFG.GUARDAR_VIDEO === false) return Promise.resolve();
  var f = state.videoArchivo;
  return almacen.ponVideo(obj.id, f, f.name).then(function () { obj.videoId = obj.id; });
}

/* --- Guardar --- */

function guardarGol(g, accion) {
  var faltan = [];
  if (!g.fecha) faltan.push('fecha');
  if (!g.tipo) faltan.push('tipo de jugada');
  if (!g.zonaDisparo) faltan.push('zona de disparo');
  if (!g.zonaPorteria) faltan.push('zona de portería');
  if (faltan.length) { aviso('Falta: ' + faltan.join(', ') + '.', 'error'); return; }

  if (!g.periodo) g.periodo = periodoDeMinuto(g.minuto);
  if (g.minuto !== '' && g.minuto != null) g.minuto = parseInt(g.minuto, 10);
  delete g._mismoDia;

  persistirVideo(g).then(function () { return almacen.guardar(g); }).then(function () {
    var i = state.goles.findIndex(function (x) { return x.id === g.id; });
    if (i >= 0) state.goles[i] = g; else state.goles.push(g);
    state.videoArchivo = null;
    if (state.goles.length % 10 === 0) {
      aviso('Gol guardado. Llevas ' + state.goles.length + ' goles: descarga una copia de seguridad en la pestaña Excel.', '');
    } else aviso('Gol guardado.' + (state.excelHandle ? ' Actualizando Excel…' : ''), 'ok');
    if (state.excelHandle) exportarExcel(true);
    if (accion === 'otro') { if (ruta().vista === 'nuevo') pintar(); else navegar('#/nuevo'); }
    else navegar(state.volverA || '#/');
  }).catch(function (e) {
    aviso('No se ha podido guardar: ' + (e && e.message || e), 'error');
  });
}

/* ============================== Agregados ============================== */

function contar(goles, fn) {
  var c = {};
  goles.forEach(function (g) {
    var k = fn(g);
    if (k == null || k === '') k = '(sin dato)';
    if (Array.isArray(k)) k.forEach(function (x) { c[x] = (c[x] || 0) + 1; });
    else c[k] = (c[k] || 0) + 1;
  });
  return c;
}

function ordenado(c, orden) {
  var claves = Object.keys(c);
  if (orden) claves.sort(function (a, b) {
    var ia = orden.indexOf(a), ib = orden.indexOf(b);
    if (ia < 0) ia = 999; if (ib < 0) ib = 999;
    return ia - ib || c[b] - c[a];
  });
  else claves.sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); });
  return claves.map(function (k) { return { k: k, n: c[k] }; });
}

function pct(n, total) { return total ? Math.round(1000 * n / total) / 10 : 0; }

/* ============================== Gráficos SVG ==============================
   Sin librerías. Colores validados para daltonismo y contraste. */

var COLOR_SERIE = '#1B5FA3';
var COLOR_EVIT = { 'Evitable': '#B3261E', 'Parcialmente evitable': '#B97A00', 'Imparable': '#1E7D55', 'Sin valorar': '#9AA7B3' };

/* Columnas apiladas. series = [{ nombre, color, valores[] }], cats = etiquetas. */
function svgColumnas(cats, series, opts) {
  opts = opts || {};
  var W = 720, H = opts.alto || 280, ml = 36, mr = 12, mt = 26, mb = cats.length > 10 ? 64 : 48;
  var n = cats.length;
  if (!n) return '<p class="nota">Sin datos.</p>';
  var totales = cats.map(function (_, i) { return series.reduce(function (t, sr) { return t + (sr.valores[i] || 0); }, 0); });
  var max = Math.max.apply(null, totales.concat([1]));
  var pasos = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  var techo = Math.ceil(max / pasos) * pasos;
  var pw = W - ml - mr, ph = H - mt - mb;
  var paso = pw / n, ancho = Math.min(44, paso * 0.62);
  var y = function (v) { return mt + ph - (v / techo) * ph; };

  var rejilla = '';
  for (var v = 0; v <= techo; v += pasos) {
    rejilla += '<line class="rej" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
               '<text class="eje" x="' + (ml - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>';
  }
  var barras = cats.map(function (c, i) {
    var x = ml + paso * i + (paso - ancho) / 2, acum = 0, segs = '';
    series.forEach(function (sr) {
      var val = sr.valores[i] || 0;
      if (!val) return;
      var y1 = y(acum + val), h = y(acum) - y1;
      segs += '<rect x="' + x + '" y="' + y1 + '" width="' + ancho + '" height="' + Math.max(0, h - 2) + '" rx="3" fill="' + sr.color + '">' +
              '<title>' + esc(c) + ' · ' + esc(sr.nombre) + ': ' + val + '</title></rect>';
      acum += val;
    });
    var etiq = totales[i] ? '<text class="val" x="' + (x + ancho / 2) + '" y="' + (y(totales[i]) - 6) + '" text-anchor="middle">' + totales[i] + '</text>' : '';
    var rot = cats.length > 10 ? ' transform="rotate(-35 ' + (x + ancho / 2) + ' ' + (mt + ph + 14) + ')"' : '';
    var cat = '<text class="cat" x="' + (x + ancho / 2) + '" y="' + (mt + ph + 16) + '" text-anchor="' + (cats.length > 10 ? 'end' : 'middle') + '"' + rot + '>' + esc(String(c).length > 16 ? String(c).slice(0, 15) + '…' : c) + '</text>';
    return segs + etiq + cat;
  }).join('');

  var leyenda = series.length > 1 ? '<div class="leyenda">' + series.map(function (sr) {
    return '<span><i style="background:' + sr.color + '"></i>' + esc(sr.nombre) + '</span>';
  }).join('') + '</div>' : '';

  return '<svg class="grafico" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.titulo || '') + '">' +
         rejilla + '<line class="base" x1="' + ml + '" x2="' + (W - mr) + '" y1="' + (mt + ph) + '" y2="' + (mt + ph) + '"/>' + barras + '</svg>' + leyenda;
}

/* Donut con leyenda. items = [{ k, n }], colores por clave. */
function svgDonut(items, colores, total) {
  var suma = items.reduce(function (t, x) { return t + x.n; }, 0);
  if (!suma) return '<p class="nota">Sin datos.</p>';
  var R = 60, r = 38, cx = 70, cy = 70, ang = -Math.PI / 2, arcos = '';
  items.forEach(function (x, i) {
    if (!x.n) return;
    var a2 = ang + 2 * Math.PI * x.n / suma;
    var grande = (a2 - ang) > Math.PI ? 1 : 0;
    var p = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + ' ' + (cy + rad * Math.sin(a)).toFixed(2); };
    var d = x.n === suma
      ? 'M ' + p(R, 0) + ' A ' + R + ' ' + R + ' 0 1 1 ' + p(R, Math.PI) + ' A ' + R + ' ' + R + ' 0 1 1 ' + p(R, 0) + ' Z M ' + p(r, 0) + ' A ' + r + ' ' + r + ' 0 1 0 ' + p(r, Math.PI) + ' A ' + r + ' ' + r + ' 0 1 0 ' + p(r, 0) + ' Z'
      : 'M ' + p(R, ang) + ' A ' + R + ' ' + R + ' 0 ' + grande + ' 1 ' + p(R, a2) + ' L ' + p(r, a2) + ' A ' + r + ' ' + r + ' 0 ' + grande + ' 0 ' + p(r, ang) + ' Z';
    arcos += '<path d="' + d + '" fill="' + (colores[x.k] || COLOR_SERIE) + '" fill-rule="evenodd" stroke="#fff" stroke-width="2"><title>' + esc(x.k) + ': ' + x.n + ' (' + pct(x.n, suma) + '%)</title></path>';
    ang = a2;
  });
  var leyenda = items.map(function (x) {
    return '<div class="ley-fila"><i style="background:' + (colores[x.k] || COLOR_SERIE) + '"></i><span class="ley-k">' + esc(x.k) + '</span><span class="ley-n">' + x.n + ' <small>' + pct(x.n, suma) + '%</small></span></div>';
  }).join('');
  return '<div class="donut"><svg viewBox="0 0 140 140" role="img">' + arcos +
         '<text class="donut-total" x="70" y="76" text-anchor="middle">' + suma + '</text></svg>' +
         '<div class="ley-lista">' + leyenda + '</div></div>';
}

/* ============================== Vista: informe ============================== */

function kpi(v, et, sub) {
  return '<div class="kpi"><div class="kpi-v">' + v + '</div><div class="kpi-et">' + esc(et) + '</div>' + (sub ? '<div class="kpi-sub">' + esc(sub) + '</div>' : '') + '</div>';
}

function barras(titulo, c, orden, total) {
  /* Lo no rellenado no se pinta: la barra «(sin dato)» no dice nada. */
  var lista = ordenado(c, orden).filter(function (x) { return x.k !== '(sin dato)'; }), max = 0;
  lista.forEach(function (x) { if (x.n > max) max = x.n; });
  if (!lista.length) return '';
  return '<div class="tabla-barras"><h3>' + esc(titulo) + '</h3>' + lista.map(function (x) {
    return '<div class="fila-barra"><span class="fb-et" title="' + esc(x.k) + '">' + esc(x.k) + '</span>' +
      '<span class="fb-barra"><i style="width:' + (max ? 100 * x.n / max : 0) + '%"></i></span>' +
      '<span class="fb-n">' + x.n + ' <small>' + pct(x.n, total) + '%</small></span></div>';
  }).join('') + '</div>';
}

function agruparPartidos(gs) {
  var m = {};
  gs.forEach(function (g) {
    var k = (g.fecha || '') + '|' + (g.rival || '');
    if (!m[k]) m[k] = { clave: k, fecha: g.fecha || '', jornada: g.jornada || '', rival: g.rival || '', campo: g.campo || '', resultado: g.resultado || '', portero: g.portero || '', n: 0, ev: 0, parc: 0, imp: 0, sin: 0, abp: 0 };
    var p = m[k]; p.n++;
    if (g.evitabilidad === 'Evitable') p.ev++; else if (g.evitabilidad === 'Parcialmente evitable') p.parc++; else if (g.evitabilidad === 'Imparable') p.imp++; else p.sin++;
    if (g.tipo === 'Acción a balón parado') p.abp++;
  });
  return Object.keys(m).sort().map(function (k) { return m[k]; });
}

function vistaInforme(app, sub) {
  if (sub && ['resumen', 'goles', 'partidos', 'mapas', 'evolucion'].indexOf(sub) >= 0) state.informe.tab = sub;
  var tab = state.informe.tab;
  var gs = golesFiltrados();
  var total = gs.length;
  var ps = porteros(), rs = rivalesConGoles();

  var filtros = '<div class="filtros">' +
      (ps.length > 1 ? campoSelect('f-portero', 'Portero', ps, state.filtro.portero, 'Todos los porteros') : '') +
      (rs.length > 1 ? campoSelect('f-rival', 'Rival', rs, state.filtro.rival, 'Todos los rivales') : '') +
    '</div>' + chipsUltimas(state.filtro.ultimas);

  var subtabs = [['resumen', 'Resumen'], ['goles', 'Goles'], ['partidos', 'Partidos'], ['mapas', 'Mapas'], ['evolucion', 'Evolución']];
  var barra = '<div class="subtabs">' + subtabs.map(function (t) {
    return '<a href="#/informe/' + t[0] + '" class="' + (tab === t[0] ? 'sel' : '') + '">' + t[1] + '</a>';
  }).join('') + '</div>';

  var cuerpo;
  if (!state.goles.length) {
    cuerpo = '<div class="vacio"><h2>Sin datos todavía</h2><p>Registra el primer gol y aquí verás el informe: resumen, tabla de goles, partidos, mapas y evolución.</p>' +
             '<a class="btn primary grande" href="#/nuevo">+ Registrar gol</a></div>';
  } else if (!total) {
    cuerpo = '<p class="vacio">Ningún gol coincide con el filtro.</p>';
  } else if (tab === 'goles') cuerpo = informeGoles(gs);
  else if (tab === 'partidos') cuerpo = informePartidos(gs);
  else if (tab === 'mapas') cuerpo = informeMapas(gs);
  else if (tab === 'evolucion') cuerpo = informeEvolucion(gs);
  else cuerpo = informeResumen(gs);

  var cabPortero = state.filtro.portero
    ? '<div class="equipo-cab"><label class="avatar-sel" title="Subir foto del portero">' + avatarPortero(state.filtro.portero) + '<input type="file" accept="image/*" id="in-foto-portero" hidden></label>' +
      '<div><h2 class="portero-nombre">' + esc(state.filtro.portero) + '</h2><p class="nota">' + esc((CFG.EQUIPOS || [])[0] || '') + ' · toca la foto para cambiarla</p></div></div>'
    : '';
  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Informe</h1><div class="cab-acciones">' +
    (state.goles.length ? '<a class="btn primary" href="#/informe-pdf">PDF</a>' : '') + '<a class="btn" href="#/exportar">Exportar…</a></div></div>' +
    (state.goles.length ? filtros + cabPortero + barra : '') + cuerpo + '</div>';
  cabeceraPortero(app, state.filtro.portero);

  $$('select[name^="f-"]', app).forEach(function (s) {
    s.addEventListener('change', function () { state.filtro[s.name.replace('f-', '')] = s.value; pintar(); });
  });
  var buscar = $('#buscar-goles', app);
  if (buscar) {
    buscar.addEventListener('input', function () {
      state.informe.buscar = buscar.value;
      $('#tabla-goles', app).innerHTML = tablaGoles(gs);
    });
  }
  /* Un solo manejador por render: #app persiste entre vistas y los
     addEventListener se irían acumulando. */
  app.onclick = function (e) {
    var u = e.target.closest('[data-ultimas]');
    if (u) { state.filtro.ultimas = parseInt(u.getAttribute('data-ultimas'), 10) || 0; pintar(); return; }
    if (e.target.closest('a[href^="#/editar/"]')) { state.volverA = location.hash || '#/informe'; return; }
    var zonaCampo = e.target.closest('#mapa-campo [data-zona]');
    if (zonaCampo) { var n1 = zonaCampo.getAttribute('data-zona'); state.informe.zc = state.informe.zc === n1 ? '' : n1; pintar(); return; }
    var zonaPort = e.target.closest('#mapa-porteria [data-zona]');
    if (zonaPort) { var n2 = zonaPort.getAttribute('data-zona'); state.informe.zp = state.informe.zp === n2 ? '' : n2; pintar(); return; }
    var quitar = e.target.closest('[data-quitar-zona]');
    if (quitar) { var q = quitar.getAttribute('data-quitar-zona'); if (q === 'zc' || q === 'todo') state.informe.zc = ''; if (q === 'zp' || q === 'todo') state.informe.zp = ''; pintar(); return; }
    var th = e.target.closest('th[data-orden]');
    if (th) {
      var o = th.getAttribute('data-orden');
      if (state.informe.orden === o) state.informe.desc = !state.informe.desc; else { state.informe.orden = o; state.informe.desc = o === 'fecha'; }
      $('#tabla-goles', app).innerHTML = tablaGoles(gs);
      return;
    }
    var tr = e.target.closest('tr[data-id]');
    if (tr) { state.volverA = location.hash || '#/informe'; navegar('#/editar/' + tr.getAttribute('data-id')); }
  };
}

function informeResumen(gs) {
  var total = gs.length, nPartidos = partidos(gs);
  var valorados = gs.filter(function (g) { return g.evitabilidad; });
  var evitables = gs.filter(function (g) { return g.evitabilidad === 'Evitable'; }).length;
  var dentro = gs.filter(function (g) { return g.area === 'Dentro del Area'; }).length;
  var abp = gs.filter(function (g) { return g.tipo === 'Acción a balón parado'; }).length;
  var cEvit = contar(gs, function (g) { return g.evitabilidad || 'Sin valorar'; });
  var itemsEvit = ['Evitable', 'Parcialmente evitable', 'Imparable', 'Sin valorar'].map(function (k) { return { k: k, n: cEvit[k] || 0 }; }).filter(function (x) { return x.n; });
  var cResp = contar(gs.filter(function (g) { return g.responsabilidad; }), function (g) { return g.responsabilidad; });
  var COLOR_RESP = { 'Portero': '#B3261E', 'Defensa': '#B97A00', 'Colectiva': '#1B5FA3', 'Mérito del rival': '#1E7D55' };
  var cPeriodo = contar(gs, function (g) { return g.periodo; });

  return '<div class="kpis">' +
      kpi(total, 'Goles encajados', nPartidos ? nPartidos + ' partido' + (nPartidos > 1 ? 's' : '') : '') +
      kpi(nPartidos ? (Math.round(10 * total / nPartidos) / 10) : '—', 'Goles por partido') +
      kpi(valorados.length ? pct(evitables, valorados.length) + '%' : '—', 'Evitables', valorados.length ? evitables + ' de ' + valorados.length + ' valorados' : 'Sin valorar') +
      kpi(pct(dentro, total) + '%', 'Dentro del área') +
      kpi(pct(abp, total) + '%', 'A balón parado') +
    '</div>' +
    '<div class="tablas">' +
      '<div class="tarjeta-graf"><h3>Evitabilidad</h3>' + svgDonut(itemsEvit, COLOR_EVIT) + '</div>' +
      '<div class="tarjeta-graf"><h3>Responsabilidad</h3>' + svgDonut(ordenado(cResp, G.RESPONSABILIDAD), COLOR_RESP) + '</div>' +
      '<div class="tarjeta-graf ancha"><h3>Goles por periodo</h3>' + svgColumnas(T.PERIODO, [{ nombre: 'Goles', color: COLOR_SERIE, valores: T.PERIODO.map(function (p) { return cPeriodo[p] || 0; }) }], { alto: 220 }) + '</div>' +
      barras('Tipo de jugada', contar(gs, function (g) { return g.tipo; }), T.TIPO, total) +
      barras('Subtipo', contar(gs, function (g) { return g.subtipo; }), null, total) +
      barras('Golpeo', contar(gs, function (g) { return g.golpeo; }), T.GOLPEO, total) +
      barras('Marcador en el momento', contar(gs, function (g) { return g.status; }), T.STATUS, total) +
      barras('Errores del portero', contar(gs.filter(function (g) { return g.errores && g.errores.length; }), function (g) { return g.errores; }), G.ERROR, total) +
      barras('Aciertos del portero', contar(gs.filter(function (g) { return g.aciertos && g.aciertos.length; }), function (g) { return g.aciertos; }), G.ACIERTO, total) +
      barras('Acción del portero', contar(gs.filter(function (g) { return g.accion; }), function (g) { return g.accion; }), G.ACCION, total) +
      barras('Posición de partida', contar(gs.filter(function (g) { return g.posicion; }), function (g) { return g.posicion; }), G.POSICION, total) +
      (porteros().length > 1 && !state.filtro.portero ? barras('Por portero', contar(gs, function (g) { return g.portero; }), null, total) : '') +
      barras('Por rival', contar(gs, function (g) { return g.rival; }), null, total) +
    '</div>';
}

var COLS_GOLES = [
  ['fecha', 'Fecha', function (g) { return fechaCorta(g.fecha); }],
  ['jornada', 'J', function (g) { return g.jornada || ''; }],
  ['rival', 'Rival', function (g) { return g.rival || ''; }],
  ['minuto', 'Min', function (g) { return g.minuto != null && g.minuto !== '' ? g.minuto + "'" : ''; }],
  ['tipo', 'Tipo', function (g) { return g.tipo || ''; }],
  ['subtipo', 'Subtipo', function (g) { return g.subtipo || ''; }],
  ['zonaDisparo', 'Z. disparo', function (g) { var z = Z.campo(g.zonaDisparo); return z ? z.n + ' · ' + z.corto : ''; }],
  ['zonaPorteria', 'Z. portería', function (g) { var z = Z.porteria(g.zonaPorteria); return z ? z.n + ' · ' + z.corto : ''; }],
  ['golpeo', 'Golpeo', function (g) { return g.golpeo || ''; }],
  ['evitabilidad', 'Evitable', function (g) { return g.evitabilidad ? '<span class="badge ' + claseEvit(g.evitabilidad) + '">' + esc(g.evitabilidad) + '</span>' : ''; }, true],
  ['responsabilidad', 'Resp.', function (g) { return g.responsabilidad || ''; }],
  ['goleador', 'Goleador', function (g) { return g.goleador || ''; }],
  ['portero', 'Portero', function (g) { return g.portero || ''; }]
];

function tablaGoles(gs) {
  var q = norm(state.informe.buscar || '');
  var lista = gs.filter(function (g) {
    if (!q) return true;
    return norm([g.rival, g.tipo, g.subtipo, g.goleador, g.asistente, g.portero, g.observaciones, g.correctivo, (g.errores || []).join(' '), g.evitabilidad, g.responsabilidad].join(' ')).indexOf(q) >= 0;
  });
  var o = state.informe.orden, desc = state.informe.desc;
  lista.sort(function (a, b) {
    var va = a[o], vb = b[o];
    if (o === 'minuto' || o === 'zonaDisparo' || o === 'zonaPorteria' || o === 'jornada') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
    else { va = String(va || ''); vb = String(vb || ''); }
    var c = va < vb ? -1 : va > vb ? 1 : 0;
    return desc ? -c : c;
  });
  if (!lista.length) return '<p class="nota">Ningún gol coincide con la búsqueda.</p>';
  var cab = '<tr>' + COLS_GOLES.map(function (c) {
    return '<th data-orden="' + c[0] + '" class="' + (o === c[0] ? (desc ? 'desc' : 'asc') : '') + '">' + esc(c[1]) + '</th>';
  }).join('') + '</tr>';
  var filas = lista.map(function (g) {
    return '<tr data-id="' + esc(g.id) + '">' + COLS_GOLES.map(function (c) {
      var v = c[2](g);
      return '<td>' + (c[3] ? v : esc(v)) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="tabla-env"><table class="tabla"><thead>' + cab + '</thead><tbody>' + filas + '</tbody></table></div>' +
         '<p class="nota">' + lista.length + ' goles · pulsa una cabecera para ordenar, una fila para abrir el gol.</p>';
}

function norm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function informeGoles(gs) {
  return '<div class="buscador"><input type="search" id="buscar-goles" placeholder="Buscar por rival, tipo, goleador, error, nota…" value="' + esc(state.informe.buscar) + '"></div>' +
         '<div id="tabla-goles">' + tablaGoles(gs) + '</div>';
}

function informePartidos(gs) {
  var ps = agruparPartidos(gs);
  var filas = ps.map(function (p) {
    return '<tr><td>' + esc(fechaCorta(p.fecha)) + '</td><td>' + esc(p.jornada) + '</td><td>' + esc(p.rival) + '</td><td>' + esc(p.campo) + '</td>' +
      '<td>' + esc(p.resultado) + '</td><td class="num"><strong>' + p.n + '</strong></td>' +
      '<td class="num">' + (p.ev ? '<span class="badge rojo">' + p.ev + '</span>' : '0') + '</td>' +
      '<td class="num">' + p.abp + '</td><td>' + esc(p.portero) + '</td></tr>';
  }).join('');
  var tot = ps.reduce(function (t, p) { t.n += p.n; t.ev += p.ev; t.abp += p.abp; return t; }, { n: 0, ev: 0, abp: 0 });
  return '<div class="tabla-env"><table class="tabla"><thead><tr><th>Fecha</th><th>J</th><th>Rival</th><th>Campo</th><th>Resultado</th><th>Goles</th><th>Evitables</th><th>Balón parado</th><th>Portero</th></tr></thead>' +
         '<tbody>' + filas + '</tbody><tfoot><tr><td colspan="5">' + ps.length + ' partidos</td><td class="num"><strong>' + tot.n + '</strong></td><td class="num">' + tot.ev + '</td><td class="num">' + tot.abp + '</td><td></td></tr></tfoot></table></div>';
}

function informeMapas(gs) {
  var zc = state.informe.zc, zp = state.informe.zp, total = gs.length;
  /* Filtro cruzado: cada mapa cuenta solo los goles que pasan el filtro del otro. */
  var paraCampo = zp ? gs.filter(function (g) { return String(g.zonaPorteria) === String(zp); }) : gs;
  var paraPorteria = zc ? gs.filter(function (g) { return String(g.zonaDisparo) === String(zc); }) : gs;
  var ambos = gs.filter(function (g) {
    return (!zc || String(g.zonaDisparo) === String(zc)) && (!zp || String(g.zonaPorteria) === String(zp));
  });
  var cc = contar(paraCampo, function (g) { return g.zonaDisparo; }), cp = contar(paraPorteria, function (g) { return g.zonaPorteria; });

  function tablaZonas(zonas, c, base) {
    return '<table class="tabla compacta"><thead><tr><th>Nº</th><th>Zona</th><th class="num">Goles</th><th class="num">%</th></tr></thead><tbody>' +
      zonas.map(function (z) { var n = c[z.n] || 0; return '<tr class="' + (n ? '' : 'apagada') + '"><td><strong>' + z.n + '</strong></td><td>' + esc(z.nombre) + '</td><td class="num">' + n + '</td><td class="num">' + pct(n, base) + '%</td></tr>'; }).join('') +
      '</tbody></table>';
  }

  var zcInfo = zc ? Z.campo(zc) : null, zpInfo = zp ? Z.porteria(zp) : null;
  function goles(n) { return '<strong>' + n + '</strong> gol' + (n === 1 ? '' : 'es'); }
  var filtroHtml = (zc || zp)
    ? '<div class="filtro-zonas">' +
        (zcInfo ? '<button type="button" class="chip sel" data-quitar-zona="zc">Disparo ' + zcInfo.n + ' · ' + esc(zcInfo.corto) + ' ✕</button>' : '') +
        (zpInfo ? '<button type="button" class="chip sel" data-quitar-zona="zp">Portería ' + zpInfo.n + ' · ' + esc(zpInfo.corto) + ' ✕</button>' : '') +
        '<button type="button" class="chip" data-quitar-zona="todo">Quitar filtros</button>' +
      '</div>'
    : '<p class="nota">Toca una zona de cualquiera de los dos mapas para ver los goles implicados; con una zona de cada mapa se cruzan.</p>';

  var resumenHtml = '';
  if (zc && !zp) {
    var top = ordenado(cp)[0];
    resumenHtml = '<p class="cruce">' + goles(paraPorteria.length) + ' desde la zona ' + zc + (top ? ' · el más repetido entra por la <strong>' + top.k + '</strong> (' + pct(top.n, paraPorteria.length) + '%)' : '') + '.</p>';
  } else if (zp && !zc) {
    var topc = ordenado(cc)[0];
    resumenHtml = '<p class="cruce">' + goles(paraCampo.length) + ' por la zona ' + zp + ' de la portería' + (topc ? ' · vienen sobre todo de la zona <strong>' + topc.k + '</strong> (' + pct(topc.n, paraCampo.length) + '%)' : '') + '.</p>';
  } else if (zc && zp) {
    resumenHtml = '<p class="cruce">' + goles(ambos.length) + ' desde la zona ' + zc + ' que entra' + (ambos.length === 1 ? '' : 'n') + ' por la ' + zp + ' (' + pct(ambos.length, total) + '% del total).</p>';
  }

  var lista = '';
  if (zc || zp) {
    if (!ambos.length) lista = '<p class="vacio">Ningún gol con esa combinación.</p>';
    else {
      var grupos = [], idx = {};
      ambos.forEach(function (g) {
        var k = (g.fecha || '') + '|' + (g.rival || '');
        if (idx[k] == null) { idx[k] = grupos.length; grupos.push({ fecha: g.fecha, rival: g.rival, campo: g.campo, resultado: g.resultado, jornada: g.jornada, goles: [] }); }
        grupos[idx[k]].goles.push(g);
      });
      lista = grupos.map(function (p) {
        var cab = [fechaCorta(p.fecha), p.jornada ? 'J' + p.jornada : '', p.rival ? 'vs ' + p.rival : '', p.campo, p.resultado].filter(Boolean).map(esc).join(' · ');
        return '<section class="partido"><h3>' + (cab || 'Sin partido') + ' <span class="cuenta">' + p.goles.length + '</span></h3>' +
          p.goles.sort(function (a, b) { return (a.minuto || 0) - (b.minuto || 0); }).map(tarjetaGol).join('') + '</section>';
      }).join('');
    }
  }

  return filtroHtml + resumenHtml +
    '<div class="mapas">' +
      '<div class="mapa"><h3>Zona de disparo' + (zp ? ' <small>· solo goles por la portería ' + zp + '</small>' : '') + '</h3><div id="mapa-campo">' + svgCampo(zc, { cuenta: cc }) + '</div><details><summary>Ver tabla</summary>' + tablaZonas(Z.CAMPO, cc, paraCampo.length) + '</details></div>' +
      '<div class="mapa"><h3>Zona de portería' + (zc ? ' <small>· solo goles desde la zona ' + zc + '</small>' : '') + '</h3><div id="mapa-porteria">' + svgPorteria(zp, { cuenta: cp }) + '</div><details><summary>Ver tabla</summary>' + tablaZonas(Z.PORTERIA, cp, paraPorteria.length) + '</details></div>' +
    '</div>' +
    (lista ? '<h2 class="sub-tit">Goles implicados</h2>' + lista : '');
}

function informeEvolucion(gs) {
  var ps = agruparPartidos(gs);
  var cats = ps.map(function (p) { return (p.jornada ? 'J' + p.jornada + ' ' : '') + (p.rival || fechaCorta(p.fecha)); });
  var series = [
    { nombre: 'Evitable', color: COLOR_EVIT['Evitable'], valores: ps.map(function (p) { return p.ev; }) },
    { nombre: 'Parcialmente evitable', color: COLOR_EVIT['Parcialmente evitable'], valores: ps.map(function (p) { return p.parc; }) },
    { nombre: 'Imparable', color: COLOR_EVIT['Imparable'], valores: ps.map(function (p) { return p.imp; }) },
    { nombre: 'Sin valorar', color: COLOR_EVIT['Sin valorar'], valores: ps.map(function (p) { return p.sin; }) }
  ].filter(function (sr) { return sr.valores.some(function (v) { return v; }); });

  /* Media móvil de goles por partido (últimos 5) y % de evitables acumulado. */
  var acumG = 0, acumEv = 0, acumVal = 0, filas = ps.map(function (p, i) {
    acumG += p.n; acumEv += p.ev; acumVal += p.ev + p.parc + p.imp;
    var ult = ps.slice(Math.max(0, i - 4), i + 1), media = ult.reduce(function (t, x) { return t + x.n; }, 0) / ult.length;
    return '<tr><td>' + esc(cats[i]) + '</td><td class="num">' + p.n + '</td><td class="num">' + p.ev + '</td>' +
      '<td class="num">' + (Math.round(media * 10) / 10) + '</td><td class="num">' + (acumVal ? pct(acumEv, acumVal) : 0) + '%</td></tr>';
  }).join('');

  return '<div class="tarjeta-graf ancha"><h3>Goles encajados por partido</h3>' +
    svgColumnas(cats, series, { alto: 300, titulo: 'Goles por partido' }) + '</div>' +
    '<div class="tabla-env"><table class="tabla"><thead><tr><th>Partido</th><th class="num">Goles</th><th class="num">Evitables</th><th class="num">Media últ. 5</th><th class="num">% evitables acum.</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<p class="nota">La media de los últimos 5 partidos y el % de evitables acumulado (sobre goles valorados) sirven para ver si la tendencia mejora.</p>';
}

/* ============================== Excel ============================== */

var CABECERAS_PLANTILLA = ['ID_GOL', 'EQUIPO', 'GOLEADOR', 'ASISTENTE', 'PRENULTIMO PASADOR', 'PARTE',
  'PERIODO', 'MINUTO', 'STATUS', 'TIPO', 'SUBTIPO', 'GOLPEO', 'BANDA', 'CAMPO', 'VUELTA', 'AREA',
  'RESULTADO FINAL', 'JORNADA', 'RIVAL', 'ZONA DISPARO', 'LINK GOL', 'ZONA PORTERIA'];

var CABECERAS_PORTERO = ['FECHA', 'PORTERO', 'EQUIPO PROPIO', 'ZONA DISPARO (NOMBRE)', 'ZONA PORTERIA (NOMBRE)',
  'ALTURA', 'EVITABILIDAD', 'RESPONSABILIDAD', 'ACCION PORTERO', 'POSICION PARTIDA', 'ERRORES', 'ACIERTOS',
  'PIE LANZADOR', 'OBSERVACIONES', 'CORRECTIVO', 'CLIP (ARCHIVO)', 'INSTANTE REMATE (s)', 'INSTANTE GOL (s)', 'FOTOGRAMAS'];

function filaGol(g, i) {
  var zc = Z.campo(g.zonaDisparo), zp = Z.porteria(g.zonaPorteria);
  var num = function (v) { var n = parseInt(v, 10); return isFinite(n) ? n : (v || ''); };
  return [
    i + 1, g.equipo || '', g.goleador || '', g.asistente || '', g.penultimo || '', g.parte || '',
    g.periodo || periodoDeMinuto(g.minuto), num(g.minuto), g.status || '', g.tipo || '', g.subtipo || '',
    g.golpeo || '', g.banda || '', g.campo || '', g.vuelta || '', g.area || '', g.resultado || '',
    num(g.jornada), g.rival || '', num(g.zonaDisparo), g.link || '', num(g.zonaPorteria),
    /* capa portero */
    g.fecha || '', g.portero || '', g.equipoPropio || '', zc ? zc.nombre : '', zp ? zp.nombre : '',
    zp ? zp.altura : '', g.evitabilidad || '', g.responsabilidad || '', g.accion || '', g.posicion || '',
    (g.errores || []).join('; '), (g.aciertos || []).join('; '), g.pie || '', g.observaciones || '', g.correctivo || '',
    g.videoNombre || '', g.instanteRemate != null ? g.instanteRemate : '', g.instanteGol != null ? g.instanteGol : '',
    (g.fotoRemate ? 'remate' : '') + (g.fotoRemate && g.fotoGol ? ' + ' : '') + (g.fotoGol ? 'gol' : '')
  ];
}

function tablaResumen(titulo, c, total, orden, etiqueta) {
  var filas = [[{ v: titulo, estilo: 2 }, { v: 'GOLES', estilo: 2 }, { v: '%', estilo: 2 }]];
  ordenado(c, orden).forEach(function (x) {
    filas.push([etiqueta ? etiqueta(x.k) : x.k, x.n, pct(x.n, total)]);
  });
  filas.push([{ v: 'TOTAL', estilo: 1 }, { v: total, estilo: 1 }, { v: total ? 100 : 0, estilo: 1 }]);
  filas.push([]);
  return filas;
}

var CABECERAS_EXTRA = ['ID APP'];

/* --- Hoja INFORME: tablas a la izquierda, gráfico de cada tabla a la
   derecha, lista de trabajo correctivo y espacio para conclusiones.
   Preparada para imprimir en A4 vertical. --- */
function hojaInforme(nombre, gs, subtitulo) {
  var filas = [], graficos = [], combinar = [];
  var total = gs.length, nPartidos = partidos(gs);
  var fechas = gs.map(function (g) { return g.fecha; }).filter(Boolean).sort();
  var valorados = gs.filter(function (g) { return g.evitabilidad; });
  var evitables = gs.filter(function (g) { return g.evitabilidad === 'Evitable'; }).length;
  var dentro = gs.filter(function (g) { return g.area === 'Dentro del Area'; }).length;
  var abp = gs.filter(function (g) { return g.tipo === 'Acción a balón parado'; }).length;

  function fila(f) { filas.push(f || []); }
  function hasta(n) { while (filas.length < n) filas.push([]); }

  fila([{ v: 'INFORME DE GOLES ENCAJADOS · ' + ((CFG.EQUIPOS || [])[0] || CFG.MARCA || '').toUpperCase(), estilo: 3 }]); combinar.push('A1:L1');
  fila([{ v: (CFG.MARCA || 'Goles encajados') + ' · ' + subtitulo, estilo: 4 }]); combinar.push('A2:L2');
  fila(['Periodo', fechas.length ? fechaCorta(fechas[0]) + ' – ' + fechaCorta(fechas[fechas.length - 1]) : '—', '', 'Generado', new Date().toLocaleDateString('es-ES')]);
  fila();
  fila([{ v: 'Partidos', estilo: 1 }, { v: 'Goles', estilo: 1 }, { v: 'Por partido', estilo: 1 }, '', { v: 'Evitables', estilo: 1 }, { v: 'Dentro del área', estilo: 1 }, { v: 'Balón parado', estilo: 1 }]);
  fila([{ v: nPartidos, estilo: 5 }, { v: total, estilo: 5 }, { v: nPartidos ? Math.round(10 * total / nPartidos) / 10 : 0, estilo: 5 }, '',
        { v: (valorados.length ? pct(evitables, valorados.length) : 0) + '%', estilo: 5 }, { v: pct(dentro, total) + '%', estilo: 5 }, { v: pct(abp, total) + '%', estilo: 5 }]);
  fila([{ v: '', estilo: 0 }, '', '', '', { v: valorados.length ? evitables + ' de ' + valorados.length + ' valorados' : 'sin valorar', estilo: 0 }]);
  fila();

  /* Un bloque = tabla + gráfico al lado. */
  function bloque(titulo, c, opts) {
    opts = opts || {};
    var lista = ordenado(c, opts.orden);
    if (opts.soloConDatos) lista = lista.filter(function (x) { return x.n > 0; });
    var inicio = filas.length;
    fila([{ v: titulo, estilo: 4 }, { v: 'GOLES', estilo: 4 }, { v: '%', estilo: 4 }]);
    if (!lista.length) { fila(['Sin datos']); fila(); return; }
    lista.forEach(function (x) { fila([opts.etiqueta ? opts.etiqueta(x.k) : x.k, x.n, pct(x.n, opts.total || total)]); });
    var altoGrafico = opts.tipo === 'tarta' ? 13 : Math.max(10, Math.min(22, lista.length + 6));
    graficos.push({
      tipo: opts.tipo || 'barras', titulo: titulo, hoja: nombre, serie: 'Goles',
      cats: 'A' + (inicio + 2) + ':A' + (inicio + 1 + lista.length),
      vals: 'B' + (inicio + 2) + ':B' + (inicio + 1 + lista.length),
      desde: { col: 4, fila: inicio }, hasta: { col: 12, fila: inicio + altoGrafico },
      nPuntos: lista.length, colores: opts.colores
    });
    hasta(inicio + Math.max(lista.length + 2, altoGrafico + 1));
  }

  bloque('TIPO DE JUGADA', contar(gs, function (g) { return g.tipo; }), { orden: T.TIPO });
  bloque('ZONA DE PORTERÍA (1-8)', contar(gs, function (g) { return g.zonaPorteria; }),
    { tipo: 'columnas', orden: Z.PORTERIA.map(function (z) { return String(z.n); }), etiqueta: function (k) { return etiquetaZona('porteria', k); } });
  bloque('ZONA DE DISPARO (1-20)', contar(gs, function (g) { return g.zonaDisparo; }),
    { soloConDatos: true, etiqueta: function (k) { return etiquetaZona('campo', k); } });
  bloque('PERIODO', contar(gs, function (g) { return g.periodo; }), { tipo: 'columnas', orden: T.PERIODO });
  bloque('EVITABILIDAD', contar(valorados, function (g) { return g.evitabilidad; }),
    { tipo: 'tarta', orden: G.EVITABILIDAD, total: valorados.length, colores: ['1E7D55', 'FDB833', 'B3261E'] });
  bloque('RESPONSABILIDAD', contar(gs.filter(function (g) { return g.responsabilidad; }), function (g) { return g.responsabilidad; }),
    { tipo: 'tarta', orden: G.RESPONSABILIDAD });
  bloque('ERRORES DEL PORTERO', contar(gs.filter(function (g) { return g.errores && g.errores.length; }), function (g) { return g.errores; }), { orden: G.ERROR });
  bloque('ACIERTOS DEL PORTERO', contar(gs.filter(function (g) { return g.aciertos && g.aciertos.length; }), function (g) { return g.aciertos; }), { orden: G.ACIERTO });
  bloque('SUBTIPO', contar(gs, function (g) { return g.subtipo; }), { soloConDatos: true });
  var porPartido = contar(gs, function (g) { return (g.jornada ? 'J' + g.jornada + ' ' : '') + (g.rival || fechaCorta(g.fecha) || '—'); });
  bloque('GOLES POR PARTIDO', porPartido, { tipo: 'columnas', orden: Object.keys(porPartido).sort() });

  fila([{ v: 'TRABAJO CORRECTIVO PROPUESTO', estilo: 4 }, { v: '', estilo: 4 }, { v: '', estilo: 4 }]);
  var conTrabajo = gs.filter(function (g) { return g.correctivo; });
  if (!conTrabajo.length) fila(['— (rellena «Trabajo correctivo» en la app al valorar un gol)']);
  conTrabajo.forEach(function (g) {
    fila([fechaCorta(g.fecha) + ' · ' + (g.rival || '') + ' · ' + (g.minuto != null ? g.minuto + "'" : ''), g.correctivo]);
  });
  fila();
  fila([{ v: 'OBSERVACIONES', estilo: 4 }, { v: '', estilo: 4 }, { v: '', estilo: 4 }]);
  var conObs = gs.filter(function (g) { return g.observaciones; });
  if (!conObs.length) fila(['—']);
  conObs.forEach(function (g) {
    fila([fechaCorta(g.fecha) + ' · ' + (g.rival || '') + ' · ' + (g.minuto != null ? g.minuto + "'" : ''), g.observaciones]);
  });
  fila();
  fila([{ v: 'CONCLUSIONES DEL ENTRENADOR', estilo: 4 }, { v: '', estilo: 4 }, { v: '', estilo: 4 }]);
  fila(['(escribe aquí)']); fila(); fila(); fila();

  return { nombre: nombre, filas: filas, cabecera: false, imprimir: true, combinar: combinar, graficos: graficos,
           anchos: [32, 11, 9, 2, 12, 13, 12, 9, 9, 9, 9, 9] };
}

function construirExcel() {
  var todos = state.goles.slice().sort(function (a, b) {
    return (a.fecha || '').localeCompare(b.fecha || '') || (a.minuto || 0) - (b.minuto || 0);
  });
  var encajados = todos.filter(function (g) { return g.equipo !== 'Mi equipo'; });
  var total = encajados.length;

  /* --- TABLA MAESTRA: listas de valores (una por columna) + zonas.
     Las columnas alimentan los desplegables de LISTA GOLES. --- */
  var listas = [
    ['EQUIPO', T.EQUIPO], ['PARTE', T.PARTE], ['PERIODO', T.PERIODO], ['STATUS', T.STATUS], ['TIPO', T.TIPO],
    ['GOLPEO', T.GOLPEO], ['BANDA', T.BANDA], ['CAMPO', T.CAMPO], ['VUELTA', T.VUELTA], ['AREA', T.AREA],
    ['RESULTADO FINAL', T.RESULTADO], ['EVITABILIDAD', G.EVITABILIDAD], ['RESPONSABILIDAD', G.RESPONSABILIDAD],
    ['ACCION PORTERO', G.ACCION], ['POSICION PARTIDA', G.POSICION], ['ERRORES', G.ERROR],
    ['ACIERTOS', G.ACIERTO], ['PIE LANZADOR', G.PIE]
  ];
  var subtiposTodos = [];
  Object.keys(SUBTIPO).forEach(function (t) { listas.push(['SUBTIPO · ' + t, SUBTIPO[t]]); subtiposTodos = subtiposTodos.concat(SUBTIPO[t]); });
  listas.push(['SUBTIPO (todos)', subtiposTodos]);
  listas.push(['PORTEROS', porteros()]);
  listas.push(['RIVALES', rivales()]);
  var maxLen = 0;
  listas.forEach(function (l) { if (l[1].length > maxLen) maxLen = l[1].length; });
  var maestra = [[{ v: 'LISTAS DE VALORES (alimentan los desplegables de LISTA GOLES)', estilo: 2 }]];
  maestra.push(listas.map(function (l) { return { v: l[0], estilo: 1 }; }));
  for (var i = 0; i < maxLen; i++) maestra.push(listas.map(function (l) { return l[1][i] || ''; }));
  maestra.push([]);
  maestra.push([{ v: 'ZONAS DE DISPARO', estilo: 2 }]);
  maestra.push([{ v: 'Nº', estilo: 1 }, { v: 'NOMBRE', estilo: 1 }, { v: 'AREA', estilo: 1 }, { v: 'BANDA', estilo: 1 }]);
  Z.CAMPO.forEach(function (z) { maestra.push([z.n, z.nombre, z.dentroArea ? 'Dentro del Area' : 'Fuera del Area', z.banda]); });
  maestra.push([]);
  maestra.push([{ v: 'ZONAS DE PORTERIA', estilo: 2 }]);
  maestra.push([{ v: 'Nº', estilo: 1 }, { v: 'NOMBRE', estilo: 1 }, { v: 'ALTURA', estilo: 1 }, { v: 'LADO', estilo: 1 }, { v: 'PALO', estilo: 1 }]);
  Z.PORTERIA.forEach(function (z) { maestra.push([z.n, z.nombre, z.altura, z.lado, z.palo]); });

  function rangoLista(nombre) {
    for (var i = 0; i < listas.length; i++) if (listas[i][0] === nombre) {
      var col = MiniXLSX.letraCol(i);
      return "'TABLA MAESTRA'!$" + col + '$3:$' + col + '$' + (2 + Math.max(1, listas[i][1].length));
    }
    return null;
  }

  /* --- LISTA GOLES: la plantilla original + la capa del portero + id interno --- */
  var cabeceras = CABECERAS_PLANTILLA.concat(CABECERAS_PORTERO, CABECERAS_EXTRA);
  var lista = [cabeceras].concat(todos.map(function (g, i) { return filaGol(g, i).concat([g.id]); }));
  function colDe(cab) { return MiniXLSX.letraCol(cabeceras.indexOf(cab)); }
  var FILAS_VALID = Math.max(todos.length + 300, 1000);
  var validaciones = [];
  [['EQUIPO', 'EQUIPO'], ['PARTE', 'PARTE'], ['PERIODO', 'PERIODO'], ['STATUS', 'STATUS'], ['TIPO', 'TIPO'],
   ['SUBTIPO', 'SUBTIPO (todos)'], ['GOLPEO', 'GOLPEO'], ['BANDA', 'BANDA'], ['CAMPO', 'CAMPO'], ['VUELTA', 'VUELTA'],
   ['AREA', 'AREA'], ['RESULTADO FINAL', 'RESULTADO FINAL'], ['RIVAL', 'RIVALES'], ['PORTERO', 'PORTEROS'],
   ['EVITABILIDAD', 'EVITABILIDAD'], ['RESPONSABILIDAD', 'RESPONSABILIDAD'], ['ACCION PORTERO', 'ACCION PORTERO'],
   ['POSICION PARTIDA', 'POSICION PARTIDA'], ['PIE LANZADOR', 'PIE LANZADOR']].forEach(function (par) {
    var col = colDe(par[0]), r = rangoLista(par[1]);
    if (col && r) validaciones.push({ ref: col + '2:' + col + FILAS_VALID, lista: r });
  });
  validaciones.push({ ref: colDe('ZONA DISPARO') + '2:' + colDe('ZONA DISPARO') + FILAS_VALID, entero: [1, Z.CAMPO.length] });
  validaciones.push({ ref: colDe('ZONA PORTERIA') + '2:' + colDe('ZONA PORTERIA') + FILAS_VALID, entero: [1, Z.PORTERIA.length] });

  /* --- RESUMEN --- */
  var resumen = [
    [{ v: (CFG.MARCA || 'Goles encajados') + ' · resumen', estilo: 2 }, { v: '', estilo: 2 }, { v: '', estilo: 2 }],
    ['Generado', new Date().toLocaleString('es-ES')],
    ['Goles encajados', total],
    ['Partidos con goles encajados', partidos(encajados)],
    ['Goles encajados por partido', partidos(encajados) ? Math.round(10 * total / partidos(encajados)) / 10 : 0],
    []
  ];
  var valorados = encajados.filter(function (g) { return g.evitabilidad; });
  [
    tablaResumen('TIPO DE JUGADA', contar(encajados, function (g) { return g.tipo; }), total, T.TIPO),
    tablaResumen('SUBTIPO', contar(encajados, function (g) { return g.subtipo; }), total),
    tablaResumen('PERIODO', contar(encajados, function (g) { return g.periodo; }), total, T.PERIODO),
    tablaResumen('PARTE', contar(encajados, function (g) { return g.parte; }), total, T.PARTE),
    tablaResumen('MARCADOR EN EL MOMENTO', contar(encajados, function (g) { return g.status; }), total, T.STATUS),
    tablaResumen('GOLPEO', contar(encajados, function (g) { return g.golpeo; }), total, T.GOLPEO),
    tablaResumen('AREA', contar(encajados, function (g) { return g.area; }), total, T.AREA),
    tablaResumen('BANDA', contar(encajados, function (g) { return g.banda; }), total, T.BANDA),
    tablaResumen('CAMPO', contar(encajados, function (g) { return g.campo; }), total, T.CAMPO),
    tablaResumen('ZONA DE PORTERIA', contar(encajados, function (g) { return g.zonaPorteria; }), total,
      Z.PORTERIA.map(function (z) { return String(z.n); }), function (k) { return etiquetaZona('porteria', k); }),
    tablaResumen('ZONA DE DISPARO', contar(encajados, function (g) { return g.zonaDisparo; }), total,
      Z.CAMPO.map(function (z) { return String(z.n); }), function (k) { return etiquetaZona('campo', k); }),
    tablaResumen('EVITABILIDAD (sobre valorados)', contar(valorados, function (g) { return g.evitabilidad; }), valorados.length, G.EVITABILIDAD),
    tablaResumen('RESPONSABILIDAD', contar(encajados.filter(function (g) { return g.responsabilidad; }), function (g) { return g.responsabilidad; }), total, G.RESPONSABILIDAD),
    tablaResumen('ERRORES DEL PORTERO', contar(encajados.filter(function (g) { return g.errores && g.errores.length; }), function (g) { return g.errores; }), total, G.ERROR),
    tablaResumen('ACIERTOS DEL PORTERO', contar(encajados.filter(function (g) { return g.aciertos && g.aciertos.length; }), function (g) { return g.aciertos; }), total, G.ACIERTO),
    tablaResumen('ACCION DEL PORTERO', contar(encajados.filter(function (g) { return g.accion; }), function (g) { return g.accion; }), total, G.ACCION),
    tablaResumen('POR PORTERO', contar(encajados, function (g) { return g.portero; }), total),
    tablaResumen('POR RIVAL', contar(encajados, function (g) { return g.rival; }), total)
  ].forEach(function (t) { resumen = resumen.concat(t); });

  /* --- Mapas por portero --- */
  var mapas = [];
  var listaPorteros = porteros().filter(function (p) {
    return encajados.some(function (g) { return g.portero === p; });
  });
  (listaPorteros.length ? listaPorteros : ['(todos)']).forEach(function (p) {
    var gs = p === '(todos)' ? encajados : encajados.filter(function (g) { return g.portero === p; });
    var cp = contar(gs, function (g) { return g.zonaPorteria; });
    var cc = contar(gs, function (g) { return g.zonaDisparo; });
    mapas.push([{ v: 'PORTERO: ' + p, estilo: 2 }, { v: gs.length + ' goles', estilo: 2 }]);
    mapas.push([]);
    mapas.push([{ v: 'ZONA PORTERIA (vista frontal desde el campo)', estilo: 1 }]);
    mapas.push(['', 'Palo izq.', 'Centro izq.', 'Centro dcha.', 'Palo dcho.']);
    mapas.push(['Alta', cp[5] || 0, cp[1] || 0, cp[2] || 0, cp[6] || 0]);
    mapas.push(['Baja', cp[7] || 0, cp[3] || 0, cp[4] || 0, cp[8] || 0]);
    mapas.push(['Nº de zona', '5 / 7', '1 / 3', '2 / 4', '6 / 8']);
    mapas.push([]);
    mapas.push([{ v: 'ZONA DE DISPARO (campo propio, portería arriba)', estilo: 1 }]);
    mapas.push(['', 'Banda izq.', 'Interior izq.', 'Centro', 'Interior dcho.', 'Banda dcha.']);
    mapas.push(['Área pequeña', cc[7] || 0, cc[3] || 0, cc[1] || 0, cc[4] || 0, cc[8] || 0]);
    mapas.push(['Resto del área', cc[9] || 0, cc[5] || 0, cc[2] || 0, cc[6] || 0, cc[10] || 0]);
    mapas.push(['Franja media', cc[11] || 0, cc[13] || 0, cc[19] || 0, cc[14] || 0, cc[12] || 0]);
    mapas.push(['Franja lejana', cc[15] || 0, cc[17] || 0, cc[20] || 0, cc[18] || 0, cc[16] || 0]);
    mapas.push(['Nº de zona (fila 1)', '7', '3', '1', '4', '8']);
    mapas.push(['Nº de zona (fila 2)', '9*', '5', '2', '6', '10*']);
    mapas.push(['Nº de zona (fila 3)', '11', '13', '19', '14', '12']);
    mapas.push(['Nº de zona (fila 4)', '15', '17', '20', '18', '16']);
    mapas.push(['* 9 y 10 son las bandas a la altura del área: van fuera del área, aunque en la rejilla estén en la fila 2.']);
    mapas.push([]); mapas.push([]);
  });

  /* --- Partidos --- */
  var porPartido = {};
  encajados.forEach(function (g) {
    var k = (g.fecha || '') + '|' + (g.rival || '');
    if (!porPartido[k]) porPartido[k] = { fecha: g.fecha, jornada: g.jornada, rival: g.rival, campo: g.campo, resultado: g.resultado, portero: g.portero, n: 0, ev: 0, abp: 0 };
    porPartido[k].n++;
    if (g.evitabilidad === 'Evitable') porPartido[k].ev++;
    if (g.tipo === 'Acción a balón parado') porPartido[k].abp++;
  });
  var hojaPartidos = [['FECHA', 'JORNADA', 'RIVAL', 'CAMPO', 'RESULTADO', 'PORTERO', 'GOLES ENCAJADOS', 'EVITABLES', 'A BALON PARADO']]
    .concat(Object.keys(porPartido).sort().map(function (k) {
      var p = porPartido[k], j = parseInt(p.jornada, 10);
      return [p.fecha || '', isFinite(j) ? j : (p.jornada || ''), p.rival || '', p.campo || '', p.resultado || '', p.portero || '', p.n, p.ev, p.abp];
    }));

  /* --- Informes: uno del equipo y uno por portero --- */
  var informes = [hojaInforme('INFORME', encajados, 'Todos los porteros')];
  listaPorteros.forEach(function (p) {
    informes.push(hojaInforme(('INFORME · ' + p).slice(0, 31), encajados.filter(function (g) { return g.portero === p; }), p));
  });

  var hojasFin = (window.FIN && window.FIN.hojasExcel) ? window.FIN.hojasExcel() : [];

  return MiniXLSX.crear([
    { nombre: 'LISTA GOLES', filas: lista, congelar: 1, filtro: true, validaciones: validaciones,
      anchos: [7, 11, 16, 16, 18, 14, 9, 8, 11, 22, 30, 15, 11, 10, 14, 15, 14, 9, 18, 12, 30, 13,
               11, 16, 16, 34, 30, 8, 20, 16, 22, 18, 40, 40, 14, 40, 40, 30, 11, 11, 13, 14] }
  ].concat(informes, [
    { nombre: 'RESUMEN', filas: resumen, cabecera: false, anchos: [44, 10, 8] },
    { nombre: 'MAPAS', filas: mapas, cabecera: false, anchos: [22, 14, 14, 14, 14, 14] },
    { nombre: 'PARTIDOS', filas: hojaPartidos, congelar: 1, filtro: true, anchos: [11, 9, 20, 10, 11, 16, 16, 10, 14] },
    { nombre: 'TABLA MAESTRA', filas: maestra, cabecera: false, anchos: [12, 14, 10, 12, 22, 16, 11, 11, 15, 16, 16, 22, 18, 24, 20, 28, 26, 26, 26, 26, 32, 32, 18, 20] }
  ], hojasFin));
}

function descargar(blob, nombre) {
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

var soportaFS = typeof window.showSaveFilePicker === 'function';

function permisoHandle(h) {
  if (!h || !h.queryPermission) return Promise.resolve(false);
  return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
    if (p === 'granted') return true;
    return h.requestPermission({ mode: 'readwrite' }).then(function (q) { return q === 'granted'; });
  }).catch(function () { return false; });
}

function escribirHandle(h, blob) {
  return h.createWritable().then(function (w) {
    return w.write(blob).then(function () { return w.close(); });
  });
}

/* Actualiza el Excel: si el usuario eligió un archivo, lo sobrescribe en
   el sitio; si no, lo descarga. */
function exportarExcel(silencioso) {
  var hayFin = window.FIN && window.FIN.cuenta && window.FIN.cuenta() > 0;
  if (!state.goles.length && !hayFin) { aviso('Aún no hay nada que exportar.', 'error'); return Promise.resolve(); }
  var blob = construirExcel();
  var nombre = CFG.NOMBRE_EXCEL || 'goles-encajados.xlsx';
  if (state.excelHandle) {
    return permisoHandle(state.excelHandle).then(function (ok) {
      if (!ok) throw new Error('sin permiso');
      return escribirHandle(state.excelHandle, blob);
    }).then(function () {
      aviso('Excel actualizado: ' + state.excelHandle.name, 'ok');
    }).catch(function () {
      if (silencioso) aviso('Pulsa «Actualizar Excel» para volver a dar permiso sobre el archivo.', 'error');
      else { descargar(blob, nombre); aviso('No se pudo escribir en el archivo elegido; se ha descargado una copia.', 'error'); }
    });
  }
  descargar(blob, nombre);
  aviso('Excel descargado: ' + nombre, 'ok');
  return Promise.resolve();
}

function elegirArchivoExcel() {
  var nombre = CFG.NOMBRE_EXCEL || 'goles-encajados.xlsx';
  return window.showSaveFilePicker({
    suggestedName: nombre,
    types: [{ description: 'Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
  }).then(function (h) {
    state.excelHandle = h;
    return almacen.ponAjuste('excelHandle', h);
  }).then(function () {
    return exportarExcel();
  }).then(function () { pintar(); actualizarBotonExcel(); })
    .catch(function (e) { if (e && e.name !== 'AbortError') aviso('No se pudo elegir el archivo: ' + e.message, 'error'); });
}

/* --- Copia de seguridad en JSON (sin vídeos) --- */

function exportarJSON() {
  var extra = window.FIN && window.FIN.datosCopia ? window.FIN.datosCopia() : {};
  var datos = { version: 2, exportado: new Date().toISOString(), goles: state.goles,
                finalizaciones: extra.finalizaciones || [], jugadores: extra.jugadores || [], equipos: extra.equipos || [],
                fotosPorteros: state.fotosPorteros };
  descargar(new Blob([JSON.stringify(datos, null, 1)], { type: 'application/json' }),
            'copia-goles-' + hoyISO() + '.json');
}

function importarJSON(archivo) {
  var lector = new FileReader();
  lector.onload = function () {
    var datos;
    try { datos = JSON.parse(lector.result); } catch (e) { aviso('Ese archivo no es una copia válida.', 'error'); return; }
    var lista = datos && datos.goles;
    if (!Array.isArray(lista)) { aviso('Ese archivo no es una copia válida.', 'error'); return; }
    var nuevos = 0, actualizados = 0;
    Promise.all(lista.map(function (g) {
      if (!g || !g.id) return null;
      var existe = state.goles.some(function (x) { return x.id === g.id; });
      if (existe) actualizados++; else nuevos++;
      g.videoId = '';   /* los vídeos no viajan en la copia */
      return almacen.guardar(g);
    })).then(function () {
      if (datos.fotosPorteros && typeof datos.fotosPorteros === 'object') {
        Object.keys(datos.fotosPorteros).forEach(function (k) { state.fotosPorteros[k] = datos.fotosPorteros[k]; });
        return almacen.ponAjuste('fotosPorteros', state.fotosPorteros);
      }
    }).then(function () {
      return window.FIN && window.FIN.restaurarCopia ? window.FIN.restaurarCopia(datos) : null;
    }).then(function () { return almacen.todos(); }).then(function (gs) {
      state.goles = gs;
      aviso('Importados ' + nuevos + ' goles nuevos y ' + actualizados + ' actualizados.', 'ok');
      pintar();
    });
  };
  lector.readAsText(archivo);
}

/* ============================== Vista: informe en PDF ==============================
   Una página limpia para «Imprimir → Guardar como PDF». Usa los mismos
   filtros (portero, rival) que la pestaña Informe. */

function vistaInformePDF(app) {
  app.onclick = null;
  var gs = golesFiltrados().slice().sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || '') || (a.minuto || 0) - (b.minuto || 0); });
  var total = gs.length, nPartidos = partidos(gs);
  var portero = state.filtro.portero;
  var equipo = (CFG.EQUIPOS || [])[0] || '';
  var fechas = gs.map(function (g) { return g.fecha; }).filter(Boolean).sort();
  var valorados = gs.filter(function (g) { return g.evitabilidad; });
  var evitables = gs.filter(function (g) { return g.evitabilidad === 'Evitable'; }).length;
  var dentro = gs.filter(function (g) { return g.area === 'Dentro del Area'; }).length;
  var abp = gs.filter(function (g) { return g.tipo === 'Acción a balón parado'; }).length;
  var cEvit = contar(gs, function (g) { return g.evitabilidad || 'Sin valorar'; });
  var itemsEvit = ['Evitable', 'Parcialmente evitable', 'Imparable', 'Sin valorar'].map(function (k) { return { k: k, n: cEvit[k] || 0 }; }).filter(function (x) { return x.n; });
  var cResp = contar(gs.filter(function (g) { return g.responsabilidad; }), function (g) { return g.responsabilidad; });
  var COLOR_RESP = { 'Portero': '#B3261E', 'Defensa': '#B97A00', 'Colectiva': '#1B5FA3', 'Mérito del rival': '#1E7D55' };
  var cPeriodo = contar(gs, function (g) { return g.periodo; });
  var ps = agruparPartidos(gs);
  var cats = ps.map(function (p) { return (p.jornada ? 'J' + p.jornada + ' ' : '') + (p.rival || fechaCorta(p.fecha)); });
  var series = [
    { nombre: 'Evitable', color: COLOR_EVIT['Evitable'], valores: ps.map(function (p) { return p.ev; }) },
    { nombre: 'Parcialmente evitable', color: COLOR_EVIT['Parcialmente evitable'], valores: ps.map(function (p) { return p.parc; }) },
    { nombre: 'Imparable', color: COLOR_EVIT['Imparable'], valores: ps.map(function (p) { return p.imp; }) },
    { nombre: 'Sin valorar', color: COLOR_EVIT['Sin valorar'], valores: ps.map(function (p) { return p.sin; }) }
  ].filter(function (sr) { return sr.valores.some(function (v) { return v; }); });
  var conTrabajo = gs.filter(function (g) { return g.correctivo; });
  var conObs = gs.filter(function (g) { return g.observaciones; });

  function lista(items) {
    return '<ul class="pdf-lista">' + items.map(function (g, i) {
      return '<li><strong>' + esc(fechaCorta(g.fecha)) + (g.rival ? ' · ' + esc(g.rival) : '') + (g.minuto != null && g.minuto !== '' ? ' · ' + esc(g.minuto) + "'" : '') + '</strong> ' + esc(i === 0 ? '' : '') + esc(items === conTrabajo ? g.correctivo : g.observaciones) + '</li>';
    }).join('') + '</ul>';
  }

  app.innerHTML =
    '<div class="pdf-controles no-print">' +
      '<a class="btn" href="#/informe">← Volver al informe</a>' +
      '<button type="button" class="btn primary grande" id="btn-imprimir">Guardar como PDF</button>' +
      '<p class="nota">Se abre el diálogo de impresión del navegador: elige «Guardar como PDF». Si quieres otra foto o el escudo, se cambian en Informe y en Finalización → equipo.</p>' +
    '</div>' +
    '<div class="pdf">' +
      '<header class="pdf-cab">' +
        '<div class="pdf-foto">' + (portero ? avatarPortero(portero) : '<span class="avatar avatar-ini">' + esc(iniciales(equipo)) + '</span>') + '</div>' +
        '<div class="pdf-tit"><div class="pdf-sobre">Informe de goles encajados</div>' +
          '<h1>' + esc(portero || 'Todos los porteros') + '</h1>' +
          '<div class="pdf-sub">' + esc(equipo) + (state.filtro.rival ? ' · vs ' + esc(state.filtro.rival) : '') +
            (fechas.length ? ' · ' + fechaCorta(fechas[0]) + ' – ' + fechaCorta(fechas[fechas.length - 1]) : '') + ' · ' + nPartidos + ' partido' + (nPartidos === 1 ? '' : 's') +
            (state.filtro.ultimas ? ' · últimas ' + state.filtro.ultimas + ' jornadas' : '') + '</div></div>' +
        '<div class="pdf-escudo">' + escudoPropio() + '</div>' +
      '</header>' +
      (!total ? '<p class="vacio">No hay goles con este filtro.</p>' :
      '<section class="pdf-kpis">' +
        kpi(total, 'Goles encajados') + kpi(nPartidos ? Math.round(10 * total / nPartidos) / 10 : '—', 'Por partido') +
        kpi(valorados.length ? pct(evitables, valorados.length) + '%' : '—', 'Evitables', valorados.length ? evitables + ' de ' + valorados.length + ' valorados' : '') +
        kpi(pct(dentro, total) + '%', 'Dentro del área') + kpi(pct(abp, total) + '%', 'Balón parado') +
      '</section>' +
      '<section class="pdf-fila"><div class="pdf-bloque"><h3>Zona de disparo</h3>' + svgCampo(null, { cuenta: contar(gs, function (g) { return g.zonaDisparo; }) }) + '</div>' +
        '<div class="pdf-bloque"><h3>Zona de portería</h3>' + svgPorteria(null, { cuenta: contar(gs, function (g) { return g.zonaPorteria; }) }) + '</div></section>' +
      '<section class="pdf-fila"><div class="pdf-bloque"><h3>Evitabilidad</h3>' + svgDonut(itemsEvit, COLOR_EVIT) + '</div>' +
        '<div class="pdf-bloque"><h3>Responsabilidad</h3>' + (Object.keys(cResp).length ? svgDonut(ordenado(cResp, G.RESPONSABILIDAD), COLOR_RESP) : '<p class="nota">Sin valorar.</p>') + '</div></section>' +
      '<section class="pdf-fila"><div class="pdf-bloque">' + barras('Tipo de jugada', contar(gs, function (g) { return g.tipo; }), T.TIPO, total) + '</div>' +
        '<div class="pdf-bloque">' + barras('Golpeo', contar(gs, function (g) { return g.golpeo; }), T.GOLPEO, total) + '</div></section>' +
      '<section class="pdf-fila"><div class="pdf-bloque">' + (barras('Errores del portero', contar(gs.filter(function (g) { return g.errores && g.errores.length; }), function (g) { return g.errores; }), G.ERROR, total) || '<h3>Errores del portero</h3><p class="nota">Sin datos.</p>') + '</div>' +
        '<div class="pdf-bloque">' + (barras('Aciertos del portero', contar(gs.filter(function (g) { return g.aciertos && g.aciertos.length; }), function (g) { return g.aciertos; }), G.ACIERTO, total) || '<h3>Aciertos del portero</h3><p class="nota">Sin datos.</p>') + '</div></section>' +
      '<section class="pdf-bloque pdf-ancho"><h3>Goles por periodo</h3>' + svgColumnas(T.PERIODO, [{ nombre: 'Goles', color: COLOR_SERIE, valores: T.PERIODO.map(function (p) { return cPeriodo[p] || 0; }) }], { alto: 200 }) + '</section>' +
      (ps.length > 1 ? '<section class="pdf-bloque pdf-ancho"><h3>Evolución por partido</h3>' + svgColumnas(cats, series, { alto: 240 }) + '</section>' : '') +
      '<section class="pdf-bloque pdf-ancho"><h3>Trabajo correctivo propuesto</h3>' + (conTrabajo.length ? lista(conTrabajo) : '<p class="nota">—</p>') + '</section>' +
      (conObs.length ? '<section class="pdf-bloque pdf-ancho"><h3>Observaciones</h3>' + lista(conObs) + '</section>' : '') +
      '<section class="pdf-bloque pdf-ancho"><h3>Conclusiones</h3><div class="pdf-lineas"><span></span><span></span><span></span><span></span></div></section>' +
      '<footer class="pdf-pie">' + esc(CFG.MARCA || '') + ' · generado el ' + new Date().toLocaleDateString('es-ES') + '</footer>') +
    '</div>';

  $('#btn-imprimir', app).addEventListener('click', function () { window.print(); });
}

/* ============================== Vista: exportar ============================== */

function vistaExportar(app) {
  app.onclick = null;
  var n = state.goles.length;
  var conHandle = !!state.excelHandle;
  app.innerHTML = '<div class="vista">' +
    '<div class="vista-cab"><h1>Exportar</h1><a class="btn" href="#/informe">← Informe</a></div>' +

    '<section class="bloque">' +
      '<h2>Excel</h2>' +
      '<p>Solo cuando lo pidas. El archivo se genera entero desde los ' + n + ' goles guardados: <strong>LISTA GOLES</strong> ' +
      '(las columnas de tu plantilla más la valoración del portero, con desplegables), <strong>INFORME</strong> con gráficos (equipo y por portero), ' +
      '<strong>RESUMEN</strong>, <strong>MAPAS</strong>, <strong>PARTIDOS</strong> y <strong>TABLA MAESTRA</strong>.</p>' +
      (soportaFS
        ? (conHandle
            ? '<p class="nota ok">Archivo enlazado: <strong>' + esc(state.excelHandle.name) + '</strong>. Se actualiza solo cada vez que guardas un gol; también desde el botón de la cabecera.</p>'
            : '<p class="nota">Opcional: <strong>enlaza un archivo</strong> y la app lo sobrescribirá sola cada vez que guardes un gol. ' +
              'Si lo guardas en una carpeta de <strong>iCloud Drive, OneDrive, Google Drive o Dropbox</strong>, lo verás actualizado desde el móvil y cualquier otro sitio.</p>')
        : '<p class="nota">En este navegador el Excel se descarga como archivo nuevo cada vez. Para que se actualice solo en el sitio, abre la app en Chrome o Edge de ordenador.</p>') +
      '<div class="acciones">' +
        '<button type="button" class="btn primary grande" id="btn-excel">' + (conHandle ? 'Actualizar el Excel ahora' : 'Descargar Excel') + '</button>' +
        (soportaFS ? '<button type="button" class="btn grande" id="btn-enlazar">' + (conHandle ? 'Cambiar archivo enlazado' : 'Enlazar un archivo…') + '</button>' : '') +
      '</div>' +
      '<p class="nota">Si editas el Excel a mano, la siguiente actualización lo sobrescribe. La base de datos es la app; el Excel es la salida. ' +
      'Ten el archivo <strong>cerrado en Excel</strong> al guardar goles: si está abierto, el sistema puede bloquearlo y la app no podrá escribirlo.</p>' +
    '</section>' +

    '<section class="bloque">' +
      '<h2>Copia de seguridad</h2>' +
      '<p>Los datos viven <strong>solo en este navegador de este dispositivo</strong>; la web no tiene servidor. Para cambiar de dispositivo, pasar del archivo local a la versión con URL, o por si se borran los datos del navegador, guarda una copia (incluye los fotogramas, no los vídeos).</p>' +
      '<p class="nota" id="estado-almacen"></p>' +
      '<div class="acciones">' +
        '<button type="button" class="btn" id="btn-json">Descargar copia (.json)</button>' +
        '<label class="btn archivo">Restaurar copia…<input type="file" accept="application/json,.json" id="in-json" hidden></label>' +
      '</div>' +
    '</section>' +

    '<section class="bloque">' +
      '<h2>Zonas que usa la app</h2>' +
      '<details><summary>Ver nombres de las 20 zonas de campo y las 8 de portería</summary>' +
        '<div class="dos-col"><ul>' + Z.CAMPO.map(function (z) { return '<li><strong>' + z.n + '</strong> ' + esc(z.nombre) + '</li>'; }).join('') + '</ul>' +
        '<ul>' + Z.PORTERIA.map(function (z) { return '<li><strong>' + z.n + '</strong> ' + esc(z.nombre) + '</li>'; }).join('') + '</ul></div>' +
      '</details>' +
    '</section>' +
  '</div>';

  $('#btn-excel', app).addEventListener('click', function () { exportarExcel(); });
  var enlazar = $('#btn-enlazar', app);
  if (enlazar) enlazar.addEventListener('click', elegirArchivoExcel);
  $('#btn-json', app).addEventListener('click', exportarJSON);
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(function (e) {
      var el = $('#estado-almacen');
      if (!el) return;
      var usado = megas(e.usage || 0), libre = Math.round((e.quota || 0) / 1048576 / 1024 * 10) / 10;
      return (navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)).then(function (p) {
        el.textContent = 'Ocupado en este navegador: ' + usado + ' MB de unos ' + libre + ' GB disponibles · almacenamiento ' + (p ? 'persistente ✓' : 'no persistente: instala la app o guarda copias a menudo');
      });
    }).catch(function () {});
  }
  $('#in-json', app).addEventListener('change', function (e) {
    if (e.target.files && e.target.files[0]) importarJSON(e.target.files[0]);
  });
}

/* ============================== API para otros módulos ============================== */

window.APP = {
  esc: esc, $: $, $$: $$, idNuevo: idNuevo, hoyISO: hoyISO, fechaCorta: fechaCorta, periodoDeMinuto: periodoDeMinuto,
  megas: megas, aviso: aviso, almacen: almacen, state: state, navegar: navegar, pintar: function () { pintar(); },
  chips: chips, campoTexto: campoTexto, campoSelect: campoSelect, marcarChip: marcarChip,
  svgCampo: svgCampo, svgPorteria: svgPorteria, etiquetaZona: etiquetaZona,
  montarVideo: montarVideo, persistirVideo: persistirVideo, pintarFotos: pintarFotos,
  contar: contar, ordenado: ordenado, pct: pct, barras: barras, kpi: kpi, svgColumnas: svgColumnas, svgDonut: svgDonut,
  norm: norm, rivales: rivales, vueltaDeJornada: vueltaDeJornada, filtrarUltimas: filtrarUltimas, chipsUltimas: chipsUltimas,
  avatarPortero: avatarPortero, iniciales: iniciales,
  T: T, G: G, SUBTIPO: SUBTIPO, CFG: CFG, Z: Z, COLOR_SERIE: COLOR_SERIE, tarjetaGolHtml: tarjetaGol, claseEvit: claseEvit
};

/* ============================== Go ============================== */

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
else arrancar();

})();
