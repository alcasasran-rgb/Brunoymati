/* =====================================================================
   Camino DB — app de solo lectura sobre una Google Sheet publicada.
   Sin backend, sin login, sin dependencias. Todo cabe en este archivo.
   ===================================================================== */
(function () {
'use strict';

/* ------------------------------ Constantes ------------------------------ */

var LS_SELECCION = 'caminodb:roadbook:seleccion';
var LS_CLIENTE   = 'caminodb:roadbook:cliente';
var LS_CACHE     = 'caminodb:cache:v1';

var NIVELES = ['VIP', 'PRO', 'LOWCOST'];

/* Etiquetas bonitas para las categorías conocidas. Una categoría que no
   esté aquí se muestra igualmente, usando su propio texto: por eso añadir
   una categoría nueva a la Sheet no exige tocar código. */
var CATEGORIA_LABEL = {
  alojamiento: 'Alojamientos',
  restaurante: 'Restaurantes',
  fisioterapeuta: 'Fisioterapia',
  plan: 'Planes y experiencias',
  transporte_mochilas: 'Transporte de mochilas',
  taxi: 'Taxis y traslados',
  otro: 'Otros'
};

var state = {
  caminos: [], etapas: [], lugares: [],
  nivel: 'VIP',
  chips: {},
  query: '',
  origen: '', actualizado: null, error: null, cargando: true
};

/* ------------------------------ Utilidades ------------------------------ */

function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}
function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
/* Acepta sí / si / x / true / 1 / yes. Cualquier otra cosa (o vacío) = no. */
function esSi(v) {
  return ['si', 'sí', 'x', 'true', '1', 'yes', 'verdadero', 'ok'].indexOf(norm(v)) !== -1;
}
function num(v) { var n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

function urlConProtocolo(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^www\./i.test(u) || /\.[a-z]{2,}/i.test(u)) return 'https://' + u;
  return '';
}
function telHref(t) {
  var d = String(t || '').replace(/[^\d+]/g, '');
  return d ? 'tel:' + d : '';
}
function waHref(t) {
  var d = String(t || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9) d = '34' + d;              // móvil español sin prefijo
  d = d.replace(/^0+/, '');
  return 'https://wa.me/' + d;
}
function mapsHref(l) {
  var u = urlConProtocolo(l.google_maps_url);
  if (u) return u;
  var q = [l.nombre, l.localidad].filter(Boolean).join(' ');
  return q ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) : '';
}

/* ------------------------------ Lector de CSV ------------------------------ */

function parseCSV(text) {
  var rows = [], row = [], field = '', i = 0, enComillas = false;
  text = String(text || '').replace(/^\ufeff/, '');
  while (i < text.length) {
    var c = text[i];
    if (enComillas) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        enComillas = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { enComillas = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* Convierte el CSV en objetos, normalizando las cabeceras: da igual que en
   la Sheet ponga "Teléfono", "telefono" o " TELEFONO ". */
function csvAObjetos(text) {
  var rows = parseCSV(text);
  if (!rows.length) return [];
  var cab = rows[0].map(slug);
  var out = [];
  for (var r = 1; r < rows.length; r++) {
    var fila = rows[r];
    if (!fila.length || fila.join('').trim() === '') continue;
    var o = {};
    for (var c = 0; c < cab.length; c++) {
      if (!cab[c]) continue;
      o[cab[c]] = (fila[c] == null ? '' : String(fila[c]).trim());
    }
    out.push(o);
  }
  return out;
}

/* ------------------------------ Origen de datos ------------------------------ */

function idDeSheet(v) {
  v = String(v || '').trim();
  if (!v) return '';
  var m = v.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(v)) return v;
  return '';
}

function fuentes() {
  var C = window.CONFIG || {};
  var u = C.CSV_URLS || {};
  if (u.caminos && u.etapas && u.lugares) {
    return { caminos: u.caminos, etapas: u.etapas, lugares: u.lugares, origen: 'CSV publicados' };
  }
  var id = idDeSheet(C.SHEET_URL || C.SHEET_ID);
  if (id) {
    var g = function (n) {
      return 'https://docs.google.com/spreadsheets/d/' + id +
             '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(n);
    };
    return { caminos: g('caminos'), etapas: g('etapas'), lugares: g('lugares'), origen: 'Google Sheet' };
  }
  return { caminos: 'data/caminos.csv', etapas: 'data/etapas.csv', lugares: 'data/lugares.csv',
           origen: 'datos de ejemplo locales' };
}

function traer(url) {
  var sep = url.indexOf('?') === -1 ? '?' : '&';
  return fetch(url + sep + 'cb=' + Date.now(), { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
}

function cargarDatos(forzar) {
  var f = fuentes();
  state.origen = f.origen;

  if (!forzar) {
    try {
      var cache = JSON.parse(localStorage.getItem(LS_CACHE) || 'null');
      if (cache && cache.caminos) {
        aplicar(cache.caminos, cache.etapas, cache.lugares, cache.ts);
        render();
      }
    } catch (e) { /* caché ilegible: se ignora */ }
  }

  return Promise.all([traer(f.caminos), traer(f.etapas), traer(f.lugares)])
    .then(function (t) {
      var ts = Date.now();
      aplicar(t[0], t[1], t[2], ts);
      state.error = null;
      try {
        localStorage.setItem(LS_CACHE, JSON.stringify({ caminos: t[0], etapas: t[1], lugares: t[2], ts: ts }));
      } catch (e) { /* sin espacio: no pasa nada */ }
    })
    .catch(function (err) {
      if (state.caminos.length) {
        state.error = 'Sin conexión con la Sheet. Estás viendo la última copia descargada.';
        return;
      }
      /* Último recurso: los CSV locales del repositorio. */
      return Promise.all([traer('data/caminos.csv'), traer('data/etapas.csv'), traer('data/lugares.csv')])
        .then(function (t) {
          aplicar(t[0], t[1], t[2], Date.now());
          state.origen = 'datos de ejemplo locales';
          state.error = 'No se pudo leer la Sheet (' + err.message + '). Mostrando los datos de ejemplo.';
        })
        .catch(function () {
          state.error = 'No se pudieron cargar los datos: ' + err.message;
        });
    })
    .then(function () { state.cargando = false; render(); });
}

function aplicar(csvCaminos, csvEtapas, csvLugares, ts) {
  state.caminos = csvAObjetos(csvCaminos)
    .filter(function (c) { return c.id; })
    .map(function (c) { c._orden = num(c.orden) || 0; c._activo = esSi(c.activo); return c; })
    .sort(function (a, b) { return a._orden - b._orden; });

  state.etapas = csvAObjetos(csvEtapas)
    .filter(function (e) { return e.id; })
    .map(function (e) { e._orden = num(e.orden) || 0; return e; })
    .sort(function (a, b) { return a._orden - b._orden; });

  state.lugares = csvAObjetos(csvLugares)
    .filter(function (l) { return l.id && l.nombre; })
    .map(function (l) {
      l._activo = esSi(l.activo);
      l._cat = slug(l.categoria) || 'otro';
      l._catTexto = String(l.categoria || '').trim();
      l._nivel = nivelDe(l.nivel);
      l._partner = esSi(l.partner_freshlegs);
      l._orden = num(l.orden);
      l._ejemplo = /^ejemplo/.test(norm(l.nombre));
      l._buscar = norm(l.nombre) + ' ' + norm(l.localidad);
      return l;
    })
    .filter(function (l) { return l._activo; })
    .sort(function (a, b) {
      if (a._orden != null && b._orden != null && a._orden !== b._orden) return a._orden - b._orden;
      if (a._orden != null && b._orden == null) return -1;
      if (a._orden == null && b._orden != null) return 1;
      return a.nombre.localeCompare(b.nombre, 'es');
    });

  state.actualizado = ts;
}

function nivelDe(v) {
  var n = norm(v).replace(/[\s\-_]/g, '');
  if (n === 'vip') return 'VIP';
  if (n === 'pro') return 'PRO';
  if (n === 'lowcost' || n === 'economico' || n === 'low') return 'LOWCOST';
  return '';
}

/* ------------------------------ Consultas ------------------------------ */

function camino(id) { return state.caminos.filter(function (c) { return c.id === id; })[0]; }
function etapa(id) { return state.etapas.filter(function (e) { return e.id === id; })[0]; }
function etapasDe(cid) { return state.etapas.filter(function (e) { return e.camino_id === cid; }); }
function lugaresDeEtapa(eid) { return state.lugares.filter(function (l) { return l.etapa_id === eid; }); }
function lugar(id) { return state.lugares.filter(function (l) { return l.id === id; })[0]; }

function alojamientos(eid, nivel) {
  return lugaresDeEtapa(eid).filter(function (l) {
    return l._cat === 'alojamiento' && l._nivel === nivel;
  });
}
/* La cobertura mide datos REALES: las filas de ejemplo no cuentan. */
function alojamientosReales(eid, nivel) {
  return alojamientos(eid, nivel).filter(function (l) { return !l._ejemplo; });
}
/* Etiqueta conocida si existe; si no, el texto tal cual lo escribiste en la
   Sheet (con sus acentos). Así una categoría nueva se ve bien sin tocar código. */
function etiquetaCategoria(cat, texto) {
  if (CATEGORIA_LABEL[cat]) return CATEGORIA_LABEL[cat];
  if (texto) return texto.charAt(0).toUpperCase() + texto.slice(1);
  if (!cat) return 'Otros';
  return cat.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
}
/* Busca el texto original de una categoría entre los lugares cargados. */
function textoCategoria(cat) {
  for (var i = 0; i < state.lugares.length; i++) {
    if (state.lugares[i]._cat === cat && state.lugares[i]._catTexto) return state.lugares[i]._catTexto;
  }
  return '';
}

/* ------------------------------ Roadbook ------------------------------ */

function seleccion() {
  try { return JSON.parse(localStorage.getItem(LS_SELECCION) || '{}') || {}; }
  catch (e) { return {}; }
}
function guardarSeleccion(s) {
  try { localStorage.setItem(LS_SELECCION, JSON.stringify(s)); } catch (e) {}
}
function estaSeleccionado(id) { return !!seleccion()[id]; }

function alternarSeleccion(id) {
  var s = seleccion(), l = lugar(id);
  if (!l) return;
  if (s[id]) { delete s[id]; }
  else {
    /* Un alojamiento por etapa y nivel: el nuevo sustituye al anterior. */
    if (l._cat === 'alojamiento' && l._nivel) {
      Object.keys(s).forEach(function (k) {
        var o = lugar(k);
        if (o && o._cat === 'alojamiento' && o.etapa_id === l.etapa_id && o._nivel === l._nivel) delete s[k];
      });
    }
    s[id] = true;
  }
  guardarSeleccion(s);
  actualizarContador();
}

function seleccionados() {
  var s = seleccion();
  return Object.keys(s).map(lugar).filter(Boolean);
}

function actualizarContador() {
  var n = Object.keys(seleccion()).length;
  var pill = document.getElementById('pill-roadbook');
  if (!pill) return;
  pill.textContent = n;
  pill.hidden = n === 0;
}

/* ------------------------------ Fechas ------------------------------ */

function parseFecha(v) {
  v = String(v || '').trim();
  if (!v) return null;
  var m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function mesesDesde(d) {
  var hoy = new Date();
  return (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth());
}
function fechaCorta(d) {
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}

/* ------------------------------ Componentes ------------------------------ */

function tarjetaLugar(l, opts) {
  opts = opts || {};
  var acciones = [];
  if (l.telefono) acciones.push('<a class="btn primary" href="' + esc(telHref(l.telefono)) + '">Llamar</a>');
  if (l.whatsapp) acciones.push('<a class="btn" href="' + esc(waHref(l.whatsapp)) + '" target="_blank" rel="noopener">WhatsApp</a>');
  var web = urlConProtocolo(l.web);
  if (web) acciones.push('<a class="btn" href="' + esc(web) + '" target="_blank" rel="noopener">Web</a>');
  var res = urlConProtocolo(l.enlace_reserva);
  if (res) acciones.push('<a class="btn accent" href="' + esc(res) + '" target="_blank" rel="noopener">Reservar</a>');
  var mapa = mapsHref(l);
  if (mapa) acciones.push('<a class="btn" href="' + esc(mapa) + '" target="_blank" rel="noopener">Mapa</a>');

  var meta = [l.tipo, l.localidad].filter(Boolean).map(esc).join(' · ');

  var badges = '';
  if (l._nivel) badges += '<span class="badge nivel">' + l._nivel + '</span> ';
  if (l._partner) badges += '<span class="badge partner">Partner Freshlegs</span> ';
  if (l._ejemplo) badges += '<span class="badge ej">EJEMPLO</span>';

  var val = num(l.valoracion_propia);
  var estrellas = '';
  if (val) {
    var n = Math.max(0, Math.min(5, Math.round(val)));
    estrellas = '<span class="stars">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>';
  }

  /* Aviso de verificación */
  var meses = (window.CONFIG && window.CONFIG.MESES_VERIFICACION) || 12;
  var f = parseFecha(l.verificado_fecha), verif;
  if (!f) verif = '<span class="verif none">Sin verificar</span>';
  else if (mesesDesde(f) >= meses) verif = '<span class="verif old">⚠ Verificar — ' + fechaCorta(f) + '</span>';
  else verif = '<span class="verif">Verificado ' + fechaCorta(f) + '</span>';

  var interno = [];
  if (l.contacto_persona) interno.push('Contacto: ' + esc(l.contacto_persona));
  if (l.acuerdo && norm(l.acuerdo) !== 'ninguno') interno.push('Acuerdo: ' + esc(l.acuerdo));
  if (l.email) interno.push('<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + '</a>');

  var sel = estaSeleccionado(l.id);

  return '' +
  '<article class="card' + (l._ejemplo ? ' ejemplo' : '') + '">' +
    (opts.crumb ? '<p class="crumb">' + esc(opts.crumb) + '</p>' : '') +
    '<div class="card-head">' +
      '<h3>' + esc(l.nombre) + '</h3>' +
      '<div>' + badges + '</div>' +
    '</div>' +
    (meta ? '<p class="card-meta">' + meta + ' ' + estrellas + '</p>' : (estrellas ? '<p class="card-meta">' + estrellas + '</p>' : '')) +
    (l.precio_orientativo ? '<p class="card-price">' + esc(l.precio_orientativo) + '</p>' : '') +
    (acciones.length ? '<div class="actions">' + acciones.join('') + '</div>' : '') +
    (l.notas ? '<p class="card-notes">' + esc(l.notas) + '</p>' : '') +
    (interno.length ? '<p class="card-internal">' + interno.join(' · ') + '</p>' : '') +
    '<div class="card-foot">' + verif +
      '<button class="pick" data-act="pick" data-id="' + esc(l.id) + '" aria-pressed="' + sel + '">' +
        (sel ? '✓ En el roadbook' : '+ Roadbook') +
      '</button>' +
    '</div>' +
  '</article>';
}

function vacio(txt) { return '<div class="empty">' + txt + '</div>'; }

/* ------------------------------ Pantallas ------------------------------ */

function pantallaInicio() {
  var h = '<h1 class="page-title">Caminos</h1>' +
          '<p class="page-sub">Elige un camino para ver sus etapas.</p>';

  var activos = state.caminos.filter(function (c) { return c._activo; });
  var inactivos = state.caminos.filter(function (c) { return !c._activo; });

  if (!activos.length) h += vacio('No hay caminos activos en la Sheet.');

  activos.forEach(function (c) {
    var n = etapasDe(c.id).length;
    h += '<a class="camino-card" href="#/camino/' + esc(c.id) + '">' +
           '<h2>' + esc(c.nombre) + '</h2>' +
           (c.descripcion ? '<p>' + esc(c.descripcion) + '</p>' : '') +
           '<span class="count">' + n + (n === 1 ? ' etapa' : ' etapas') + '</span>' +
         '</a>';
  });

  if (inactivos.length) {
    h += '<h2 class="section-title">Inactivos</h2>';
    inactivos.forEach(function (c) {
      h += '<div class="camino-card off">' +
             '<h2>' + esc(c.nombre) + '</h2>' +
             (c.descripcion ? '<p>' + esc(c.descripcion) + '</p>' : '') +
             '<span class="count">Inactivo</span>' +
           '</div>';
    });
  }

  h += infoDatos();
  return h;
}

function pantallaCamino(id) {
  var c = camino(id);
  if (!c) return vacio('No existe ese camino.');
  var es = etapasDe(id);
  var h = '<a class="back" href="#/">← Caminos</a>' +
          '<h1 class="page-title">' + esc(c.nombre) + '</h1>' +
          '<p class="page-sub">' + es.length + ' etapas · ' +
            es.reduce(function (a, e) { return a + (num(e.km) || 0); }, 0) + ' km aprox.</p>';
  if (!es.length) return h + vacio('Este camino todavía no tiene etapas en la Sheet.');
  es.forEach(function (e) {
    h += '<a class="etapa-row" href="#/etapa/' + esc(e.id) + '">' +
           '<span class="etapa-num">' + esc(e.orden || '·') + '</span>' +
           '<span class="etapa-body">' +
             '<strong>' + esc(e.origen) + ' → ' + esc(e.destino) + '</strong>' +
             '<span>' + (e.km ? esc(e.km) + ' km' : '') + (e.notas ? ' · ' + esc(e.notas) : '') + '</span>' +
           '</span>' +
           '<span class="etapa-chev">›</span>' +
         '</a>';
  });
  return h;
}

function pantallaEtapa(id) {
  var e = etapa(id);
  if (!e) return vacio('No existe esa etapa.');
  var c = camino(e.camino_id);

  var h = '<a class="back" href="#/camino/' + esc(e.camino_id) + '">← ' + esc(c ? c.nombre : 'Camino') + '</a>' +
          '<h1 class="page-title">' + esc(e.origen) + ' → ' + esc(e.destino) + '</h1>' +
          '<p class="page-sub">Etapa ' + esc(e.orden) + (e.km ? ' · ' + esc(e.km) + ' km' : '') +
            (e.notas ? ' · ' + esc(e.notas) : '') + '</p>';

  /* Pestañas de nivel */
  h += '<div class="tabs" role="tablist">';
  NIVELES.forEach(function (n) {
    h += '<button role="tab" data-act="nivel" data-nivel="' + n + '" aria-selected="' +
         (state.nivel === n ? 'true' : 'false') + '">' + n + '</button>';
  });
  h += '</div>';

  var lista = alojamientos(id, state.nivel);
  if (!lista.length) {
    h += vacio('Sin alojamientos <strong>' + state.nivel + '</strong> en esta etapa.<br>Añádelos en la Sheet, pestaña <em>lugares</em>.');
  } else {
    h += '<div class="grid2">' + lista.map(function (l) { return tarjetaLugar(l); }).join('') + '</div>';
  }

  /* Chips del resto de categorías con datos en esta etapa */
  var resto = {};
  lugaresDeEtapa(id).forEach(function (l) {
    if (l._cat === 'alojamiento') return;
    resto[l._cat] = (resto[l._cat] || 0) + 1;
  });
  var cats = Object.keys(resto).sort();
  if (cats.length) {
    h += '<h2 class="section-title">Otros servicios en la etapa</h2><div class="chips">';
    cats.forEach(function (cat) {
      var on = !!state.chips[cat];
      h += '<button class="chip" data-act="chip" data-cat="' + esc(cat) + '" aria-pressed="' + on + '">' +
           esc(etiquetaCategoria(cat, textoCategoria(cat))) + '<span class="n">' + resto[cat] + '</span></button>';
    });
    h += '</div>';

    var abiertas = cats.filter(function (cat) { return state.chips[cat]; });
    if (!abiertas.length) {
      h += '<p class="page-sub">Toca una categoría para ver sus fichas.</p>';
    }
    abiertas.forEach(function (cat) {
      h += '<h3 class="section-title">' + esc(etiquetaCategoria(cat, textoCategoria(cat))) + '</h3><div class="grid2">' +
           lugaresDeEtapa(id).filter(function (l) { return l._cat === cat; })
             .map(function (l) { return tarjetaLugar(l); }).join('') + '</div>';
    });
  }

  return h;
}

function pantallaBuscar() {
  var h = '<h1 class="page-title">Buscar</h1>' +
          '<p class="page-sub">Por nombre de proveedor o localidad.</p>' +
          '<div class="search-box"><input id="q" type="search" inputmode="search" ' +
          'placeholder="Ej. Portomarín, Pazo…" value="' + esc(state.query) + '" autocomplete="off"></div>';

  var q = norm(state.query);
  if (!q) return h + vacio('Escribe al menos dos letras.');
  if (q.length < 2) return h + vacio('Escribe al menos dos letras.');

  var res = state.lugares.filter(function (l) { return l._buscar.indexOf(q) !== -1; });
  if (!res.length) return h + vacio('Sin resultados para “' + esc(state.query) + '”.');

  h += '<p class="page-sub">' + res.length + (res.length === 1 ? ' resultado' : ' resultados') + '</p>';
  h += '<div class="grid2">' + res.map(function (l) {
    var e = etapa(l.etapa_id), c = camino(l.camino_id);
    var crumb = [c ? c.nombre : '', e ? (e.origen + ' → ' + e.destino) : '', etiquetaCategoria(l._cat, l._catTexto)]
      .filter(Boolean).join(' · ');
    return tarjetaLugar(l, { crumb: crumb });
  }).join('') + '</div>';
  return h;
}

function pantallaRoadbook() {
  var sel = seleccionados();
  var cliente = '';
  try { cliente = localStorage.getItem(LS_CLIENTE) || ''; } catch (e) {}

  var h = '<div class="no-print">' +
            '<h1 class="page-title">Roadbook</h1>' +
            '<p class="page-sub">Marca un alojamiento por etapa y nivel desde las fichas. Aquí lo imprimes o lo guardas en PDF.</p>' +
            '<div class="rb-toolbar">' +
              '<input id="cliente" type="text" placeholder="Nombre del cliente o grupo" value="' + esc(cliente) + '">' +
              '<button class="btn primary" data-act="print">Imprimir / Guardar PDF</button>' +
              '<button class="btn" data-act="clear">Vaciar selección</button>' +
            '</div>' +
          '</div>';

  if (!sel.length) {
    return h + vacio('Todavía no has seleccionado nada.<br>Entra en una etapa y pulsa <strong>+ Roadbook</strong> en las fichas.');
  }

  /* Agrupar por etapa, respetando el orden camino → etapa */
  var porEtapa = {};
  sel.forEach(function (l) { (porEtapa[l.etapa_id] = porEtapa[l.etapa_id] || []).push(l); });

  var etapasOrdenadas = state.etapas.filter(function (e) { return porEtapa[e.id]; });
  var sueltos = sel.filter(function (l) { return !etapa(l.etapa_id); });

  h += '<div class="rb-head">' +
         '<h2>' + (cliente ? esc(cliente) : 'Roadbook del Camino') + '</h2>' +
         '<p>' + esc((window.CONFIG && window.CONFIG.MARCA) || 'Camino DB') +
         ' · ' + etapasOrdenadas.length + ' etapas · generado el ' + fechaCorta(new Date()) + '</p>' +
       '</div>';

  etapasOrdenadas.forEach(function (e) {
    var c = camino(e.camino_id);
    h += '<section class="rb-etapa">' +
           '<h3>Etapa ' + esc(e.orden) + ' · ' + esc(e.origen) + ' → ' + esc(e.destino) + '</h3>' +
           '<p class="rb-km">' + (c ? esc(c.nombre) + ' · ' : '') + (e.km ? esc(e.km) + ' km' : '') +
             (e.notas ? ' · ' + esc(e.notas) : '') + '</p>';

    porEtapa[e.id].sort(function (a, b) {
      if (a._cat === 'alojamiento' && b._cat !== 'alojamiento') return -1;
      if (b._cat === 'alojamiento' && a._cat !== 'alojamiento') return 1;
      return 0;
    }).forEach(function (l) { h += itemRoadbook(l); });

    h += '</section>';
  });

  if (sueltos.length) {
    h += '<section class="rb-etapa"><h3>Sin etapa asignada</h3>' +
         sueltos.map(itemRoadbook).join('') + '</section>';
  }
  return h;
}

function itemRoadbook(l) {
  var lineas = [];
  if (l.telefono) lineas.push('Tel. ' + esc(l.telefono));
  if (l.whatsapp && norm(l.whatsapp) !== norm(l.telefono)) lineas.push('WhatsApp ' + esc(l.whatsapp));
  if (l.localidad) lineas.push(esc(l.localidad));
  if (l.precio_orientativo) lineas.push(esc(l.precio_orientativo));
  var web = urlConProtocolo(l.web);
  var etq = l._cat === 'alojamiento' && l._nivel ? l._nivel : etiquetaCategoria(l._cat, l._catTexto);
  return '<div class="rb-item">' +
           '<span class="lbl">' + esc(etq) + '</span>' +
           '<strong>' + esc(l.nombre) + (l.tipo ? ' <span class="line">· ' + esc(l.tipo) + '</span>' : '') + '</strong>' +
           (lineas.length ? '<p class="line">' + lineas.join(' · ') + '</p>' : '') +
           (web ? '<p class="line">' + esc(web.replace(/^https?:\/\//, '')) + '</p>' : '') +
           (l.notas ? '<p class="line">' + esc(l.notas) + '</p>' : '') +
         '</div>';
}

function pantallaCobertura() {
  var h = '<h1 class="page-title">Cobertura</h1>' +
          '<p class="page-sub">Alojamientos reales por etapa y nivel. En rojo, lo que falta por conseguir. ' +
          'Las filas de ejemplo no cuentan.</p>';

  var totalCeldas = 0, vacias = 0;
  var cuerpo = '';

  state.caminos.forEach(function (c) {
    var es = etapasDe(c.id);
    cuerpo += '<h2 class="section-title">' + esc(c.nombre) + (c._activo ? '' : ' · inactivo') + '</h2>';
    if (!es.length) { cuerpo += vacio('Sin etapas cargadas en la Sheet.'); return; }

    var filas = '';
    es.forEach(function (e) {
      filas += '<tr><td class="cov-etapa"><strong>' + esc(e.orden) + '</strong> ' +
               esc(e.origen) + ' → ' + esc(e.destino) +
               '<small>' + (e.km ? esc(e.km) + ' km' : '') + '</small></td>';
      NIVELES.forEach(function (n) {
        var k = alojamientosReales(e.id, n).length;
        totalCeldas++; if (!k) vacias++;
        filas += '<td class="cell ' + (k ? 'ok' : 'ko') + '">' +
                 '<a href="#/etapa/' + esc(e.id) + '">' + (k ? k : '—') + '</a></td>';
      });
      filas += '</tr>';
    });

    cuerpo += '<div class="table-wrap"><table class="cov"><thead><tr>' +
              '<th>Etapa</th><th>VIP</th><th>PRO</th><th>LOWCOST</th>' +
              '</tr></thead><tbody>' + filas + '</tbody></table></div>';
  });

  h += '<div class="cov-summary"><strong>' + vacias + ' de ' + totalCeldas +
       '</strong> casillas vacías (' + (totalCeldas - vacias) + ' con datos).</div>' + cuerpo;
  return h;
}

function infoDatos() {
  var f = fuentes();
  var act = state.actualizado ? new Date(state.actualizado) : null;
  var reales = state.lugares.filter(function (l) { return !l._ejemplo; }).length;
  var ejemplos = state.lugares.length - reales;
  return '<div class="datainfo">' +
    'Origen de los datos: <strong>' + esc(state.origen) + '</strong><br>' +
    'Última descarga: ' + (act ? fechaCorta(act) + ' ' + ('0' + act.getHours()).slice(-2) + ':' + ('0' + act.getMinutes()).slice(-2) : '—') + '<br>' +
    state.caminos.length + ' caminos · ' + state.etapas.length + ' etapas · ' +
    reales + ' proveedores reales' + (ejemplos ? ' + ' + ejemplos + ' de ejemplo' : '') + '<br>' +
    (f.origen === 'datos de ejemplo locales'
      ? 'Para conectar tu Sheet, pega su enlace en <code>config.js</code>.'
      : '') +
    '</div>';
}

/* ------------------------------ Router ------------------------------ */

function ruta() {
  var h = location.hash.replace(/^#\/?/, '');
  var p = h.split('/').filter(Boolean);
  return { vista: p[0] || 'inicio', id: p[1] ? decodeURIComponent(p[1]) : '' };
}

function render() {
  var app = document.getElementById('app');
  var r = ruta();

  if (state.cargando && !state.caminos.length) {
    app.innerHTML = vacio('Cargando datos…');
    return;
  }

  var html;
  if (r.vista === 'camino') html = pantallaCamino(r.id);
  else if (r.vista === 'etapa') html = pantallaEtapa(r.id);
  else if (r.vista === 'buscar') html = pantallaBuscar();
  else if (r.vista === 'roadbook') html = pantallaRoadbook();
  else if (r.vista === 'cobertura') html = pantallaCobertura();
  else html = pantallaInicio();

  app.innerHTML = html;
  window.scrollTo(0, 0);

  /* Pestaña activa en la barra inferior */
  var mapaTab = { inicio: 'inicio', camino: 'inicio', etapa: 'inicio',
                  buscar: 'buscar', roadbook: 'roadbook', cobertura: 'cobertura' };
  var activa = mapaTab[r.vista] || 'inicio';
  Array.prototype.forEach.call(document.querySelectorAll('.tabbar a'), function (a) {
    if (a.getAttribute('data-tab') === activa) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  /* Banner de estado */
  var b = document.getElementById('banner');
  if (state.error) { b.hidden = false; b.textContent = state.error; b.className = 'banner error'; }
  else { b.hidden = true; b.className = 'banner'; }

  /* Foco y eventos del buscador */
  var q = document.getElementById('q');
  if (q) {
    q.addEventListener('input', function () {
      state.query = q.value;
      var pos = q.selectionStart;
      render();
      var nq = document.getElementById('q');
      if (nq) { nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} }
    });
  }
  var cl = document.getElementById('cliente');
  if (cl) {
    cl.addEventListener('input', function () {
      try { localStorage.setItem(LS_CLIENTE, cl.value); } catch (e) {}
      var head = document.querySelector('.rb-head h2');
      if (head) head.textContent = cl.value || 'Roadbook del Camino';
    });
  }

  actualizarContador();
}

/* ------------------------------ Eventos ------------------------------ */

document.addEventListener('click', function (ev) {
  var t = ev.target.closest ? ev.target.closest('[data-act]') : null;
  if (!t) return;
  var act = t.getAttribute('data-act');

  if (act === 'nivel') {
    state.nivel = t.getAttribute('data-nivel');
    render();
  } else if (act === 'chip') {
    var cat = t.getAttribute('data-cat');
    state.chips[cat] = !state.chips[cat];
    render();
  } else if (act === 'pick') {
    alternarSeleccion(t.getAttribute('data-id'));
    var on = estaSeleccionado(t.getAttribute('data-id'));
    t.setAttribute('aria-pressed', on);
    t.textContent = on ? '✓ En el roadbook' : '+ Roadbook';
  } else if (act === 'print') {
    window.print();
  } else if (act === 'clear') {
    if (confirm('¿Vaciar la selección del roadbook?')) { guardarSeleccion({}); render(); }
  }
});

document.getElementById('btn-refresh').addEventListener('click', function () {
  var b = this;
  b.classList.add('spin');
  cargarDatos(true).then(function () { b.classList.remove('spin'); });
});

window.addEventListener('hashchange', render);

/* Marca configurable en la cabecera */
if (window.CONFIG && window.CONFIG.MARCA) {
  document.getElementById('brand').textContent = window.CONFIG.MARCA;
}

render();
cargarDatos(false);

})();
