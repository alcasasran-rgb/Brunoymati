/* =====================================================================
   Finalización de delanteros — segundo módulo de la app.
   Mismo motor que los goles encajados (clip → fotogramas → zonas), pero
   mirando al rematador: qué delantero, desde dónde y por dónde remata.
   Usa la API que expone app.js en window.APP.
   ===================================================================== */
window.FIN = (function () {
'use strict';

var A = window.APP;
var esc = A.esc, $ = A.$, $$ = A.$$, Z = A.Z, CFG = A.CFG, T = A.T, G = A.G;

var RESULTADOS = ['Gol', 'Parada', 'Fuera', 'Palo', 'Bloqueado'];
var COLOR_RES = { 'Gol': '#B3261E', 'Parada': '#1E7D55', 'Fuera': '#9AA7B3', 'Palo': '#B97A00', 'Bloqueado': '#1B5FA3' };

var D = {
  remates: [],
  jugadores: {},   /* id → { id, equipo, nombre, pos, dorsal, seguido, foto } (lo que el usuario cambia) */
  equipos: {},     /* nombre → { nombre, escudo } */
  filtro: { equipo: '', jugador: '', ultimas: 0 },
  borrador: null,
  volverA: '#/fin'
};

/* ------------------------------ Datos ------------------------------ */

function cargar() {
  return Promise.all([A.almacen.todosDe('finalizaciones'), A.almacen.todosDe('jugadores'), A.almacen.todosDe('equipos')])
    .then(function (r) {
      D.remates = r[0] || [];
      D.jugadores = {}; (r[1] || []).forEach(function (j) { D.jugadores[j.id] = j; });
      D.equipos = {}; (r[2] || []).forEach(function (e) { D.equipos[e.nombre] = e; });
    });
}

function equipos() {
  var lista = (CFG.RIVALES || []).slice();
  (CFG.EQUIPOS || []).forEach(function (e) { if (lista.indexOf(e) < 0) lista.unshift(e); });
  Object.keys(D.jugadores).forEach(function (id) { var e = D.jugadores[id].equipo; if (e && lista.indexOf(e) < 0) lista.push(e); });
  return lista;
}

function idJugador(equipo, nombre) { return equipo + '|' + nombre; }

/* Plantilla de un equipo: config.js + cambios del usuario (seguir, foto, añadidos). */
function plantilla(equipo) {
  var base = (CFG.POSICIONES || {})[equipo] || {};
  var seguidas = CFG.POSICIONES_SEGUIDAS || ['DEL'];
  var lista = Object.keys(base).map(function (nombre) {
    var p = String(base[nombre] || '').split('|');
    return { id: idJugador(equipo, nombre), equipo: equipo, nombre: nombre, pos: p[0] || '', dorsal: p[1] || '',
             seguido: seguidas.indexOf(p[0]) >= 0, foto: '' };
  });
  /* nombres sin posición en config (JUGADORES) */
  ((CFG.JUGADORES || {})[equipo] || []).forEach(function (nombre) {
    if (!base[nombre]) lista.push({ id: idJugador(equipo, nombre), equipo: equipo, nombre: nombre, pos: '', dorsal: '', seguido: false, foto: '' });
  });
  lista.forEach(function (j) {
    var c = D.jugadores[j.id];
    if (c) { if (c.seguido != null) j.seguido = c.seguido; if (c.foto) j.foto = c.foto; if (c.pos) j.pos = c.pos; }
  });
  Object.keys(D.jugadores).forEach(function (id) {
    var c = D.jugadores[id];
    if (c.equipo === equipo && !lista.some(function (j) { return j.id === id; })) {
      lista.push({ id: id, equipo: equipo, nombre: c.nombre, pos: c.pos || '', dorsal: c.dorsal || '', seguido: c.seguido !== false, foto: c.foto || '' });
    }
  });
  var orden = { DEL: 0, CEN: 1, DEF: 2, POR: 3, '': 4 };
  return lista.sort(function (a, b) { return (orden[a.pos] - orden[b.pos]) || (parseInt(a.dorsal || 99, 10) - parseInt(b.dorsal || 99, 10)); });
}

function seguidos(equipo) { return plantilla(equipo).filter(function (j) { return j.seguido; }); }

function jugador(id) {
  if (!id) return null;
  var equipo = id.split('|')[0];
  return plantilla(equipo).filter(function (j) { return j.id === id; })[0] || null;
}

function guardarJugador(j) {
  var c = D.jugadores[j.id] || { id: j.id, equipo: j.equipo, nombre: j.nombre };
  ['pos', 'dorsal', 'seguido', 'foto'].forEach(function (k) { if (j[k] !== undefined) c[k] = j[k]; });
  D.jugadores[j.id] = c;
  return A.almacen.guardarEn('jugadores', c);
}

function rematesDe(fn) { return D.remates.filter(fn); }

function iniciales(nombre) {
  return String(nombre || '?').split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
}

function aPuerta(r) { return typeof r.zonaPorteria === 'number' && r.resultado !== 'Bloqueado'; }

/* Reduce una imagen a maxPx de lado y la devuelve como data URL. */
function leerImagen(file, maxPx) {
  return new Promise(function (res, rej) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var esc_ = Math.min(1, maxPx / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * esc_); c.height = Math.round(img.height * esc_);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('No es una imagen')); };
    img.src = url;
  });
}

/* ------------------------------ Componentes ------------------------------ */

/* Escudo: el subido desde la app; si no, assets/escudos/<equipo>.png;
   si tampoco, las iniciales. */
function escudoHtml(equipo) {
  var e = D.equipos[equipo];
  if (e && e.escudo) return '<img class="escudo" src="' + e.escudo + '" alt="' + esc(equipo) + '">';
  return A.imagenConReserva('assets/escudos/' + A.slug(equipo) + '.png', 'escudo', equipo, iniciales(equipo));
}

function avatarHtml(j) {
  if (j.foto) return '<img class="avatar" src="' + j.foto + '" alt="' + esc(j.nombre) + '">';
  return A.imagenConReserva('assets/fotos/' + A.slug(j.equipo) + '/' + A.slug(j.nombre) + '.jpg', 'avatar', j.nombre, iniciales(j.nombre));
}

function tarjetaRemate(r) {
  var zc = Z.campo(r.zonaDisparo), zp = Z.porteriaOFuera(r.zonaPorteria), j = jugador(r.jugadorId);
  return '<article class="gol remate" data-id="' + esc(r.id) + '">' +
    '<div class="gol-min res-' + esc((r.resultado || '').toLowerCase()) + '">' + (r.minuto != null && r.minuto !== '' ? esc(r.minuto) + '\'' : '—') + '</div>' +
    '<div class="gol-cuerpo">' +
      '<div class="gol-tit">' + esc(r.resultado || 'Sin resultado') + (r.tipo ? ' <span class="muted">· ' + esc(r.tipo) + (r.subtipo ? ' · ' + esc(r.subtipo) : '') + '</span>' : '') + '</div>' +
      '<div class="gol-meta">' + (j ? esc(j.nombre) + ' (' + esc(j.equipo) + ') · ' : '') +
        (r.rival ? 'vs ' + esc(r.rival) + ' · ' : '') +
        'Disparo <strong>' + (zc ? zc.n : '?') + '</strong> ' + (zc ? '<span class="muted">' + esc(zc.corto) + '</span>' : '') +
        ' · Final <strong>' + (zp ? zp.n : '?') + '</strong> ' + (zp ? '<span class="muted">' + esc(zp.corto) + '</span>' : '') +
        (r.golpeo ? ' · ' + esc(r.golpeo) : '') + '</div>' +
      '<div class="gol-pie">' + (r.fecha ? '<span class="badge">' + esc(A.fechaCorta(r.fecha)) + '</span>' : '') +
        (r.videoId ? '<span class="badge video">🎬 clip</span>' : '') + '</div>' +
    '</div>' +
    ((r.fotoRemate || r.fotoGol) ? '<div class="gol-fotos">' + (r.fotoRemate ? '<img src="' + r.fotoRemate + '" alt="Remate">' : '') + (r.fotoGol ? '<img src="' + r.fotoGol + '" alt="Final">' : '') + '</div>' : '') +
    '<a class="gol-editar" href="#/fin-editar/' + encodeURIComponent(r.id) + '" aria-label="Editar">›</a>' +
  '</article>';
}

function estadisticas(rs) {
  var n = rs.length, goles = rs.filter(function (r) { return r.resultado === 'Gol'; }).length;
  var puerta = rs.filter(aPuerta).length;
  return { n: n, goles: goles, puerta: puerta, pctPuerta: A.pct(puerta, n), pctGol: A.pct(goles, n) };
}

/* ------------------------------ Vista: equipos ------------------------------ */

function vistaEquipos(app) {
  app.onclick = null;
  var lista = equipos();
  var tarjetas = lista.map(function (e) {
    var rs = rematesDe(function (r) { return r.equipo === e; }), st = estadisticas(rs);
    return '<a class="equipo-card" href="#/fin-equipo/' + encodeURIComponent(e) + '">' + escudoHtml(e) +
      '<span class="equipo-nombre">' + esc(e) + '</span>' +
      '<span class="equipo-sub">' + seguidos(e).length + ' jugadores · ' + st.n + ' remates' + (st.goles ? ' · ' + st.goles + ' goles' : '') + '</span></a>';
  }).join('');
  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Finalización</h1><a class="btn primary" href="#/fin-nuevo">+ Nuevo remate</a></div>' +
    '<p class="nota">Elige un equipo para ver a sus rematadores. Toca el escudo o la foto de un jugador para subir la imagen.</p>' +
    '<div class="equipos-grid">' + tarjetas + '</div></div>';
}

/* ------------------------------ Vista: equipo ------------------------------ */

function vistaEquipo(app, equipo, modoGestion) {
  var js = plantilla(equipo), sig = js.filter(function (j) { return j.seguido; });
  var rs = rematesDe(function (r) { return r.equipo === equipo; }), st = estadisticas(rs);

  var cards = sig.map(function (j) {
    var rj = rs.filter(function (r) { return r.jugadorId === j.id; }), s = estadisticas(rj);
    return '<a class="jugador-card" href="#/fin-jugador/' + encodeURIComponent(j.id) + '">' + avatarHtml(j) +
      '<span class="jug-nombre">' + esc(j.nombre) + '</span>' +
      '<span class="jug-sub">' + esc(j.pos || '') + (j.dorsal ? ' · ' + esc(j.dorsal) : '') + '</span>' +
      '<span class="jug-stats">' + s.n + ' remates · ' + s.goles + ' goles' + (s.n ? ' · ' + s.pctPuerta + '% a puerta' : '') + '</span></a>';
  }).join('');

  var gestion = modoGestion
    ? '<section class="bloque"><h2>Plantilla completa <small>· marca a quién seguir</small></h2>' +
      '<div class="lista-plantilla">' + js.map(function (j) {
        return '<label class="fila-jug"><input type="checkbox" data-seguir="' + esc(j.id) + '"' + (j.seguido ? ' checked' : '') + '>' +
          '<span class="fj-pos">' + esc(j.pos || '—') + '</span><span class="fj-dorsal">' + esc(j.dorsal || '') + '</span><span class="fj-nombre">' + esc(j.nombre) + '</span></label>';
      }).join('') + '</div>' +
      '<div class="acciones"><label class="campo"><span>Añadir jugador que no está en la lista</span><input type="text" id="in-nuevo-jugador" placeholder="Nombre"></label>' +
      '<button type="button" class="btn" id="btn-anadir-jugador">Añadir</button></div></section>'
    : '';

  app.innerHTML = '<div class="vista">' +
    '<div class="vista-cab"><a class="btn" href="#/fin">← Equipos</a><div class="cab-acciones">' + (rs.length ? '<a class="btn" href="#/fin-pdf/' + encodeURIComponent(equipo) + '">PDF</a>' : '') +
      '<a class="btn primary" href="#/fin-nuevo/' + encodeURIComponent(equipo) + '">+ Nuevo remate</a></div></div>' +
    '<div class="equipo-cab"><label class="escudo-sel" title="Subir escudo">' + escudoHtml(equipo) + '<input type="file" accept="image/*" id="in-escudo" hidden></label>' +
      '<div><h1>' + esc(equipo) + '</h1><p class="nota">' + st.n + ' remates · ' + st.goles + ' goles' + (st.n ? ' · ' + st.pctPuerta + '% a puerta' : '') + ' · <a href="#/fin-equipo/' + encodeURIComponent(equipo) + '/gestion">' + (modoGestion ? 'cerrar plantilla' : 'gestionar jugadores') + '</a></p></div></div>' +
    gestion +
    (sig.length ? '<div class="jugadores-grid">' + cards + '</div>' : '<p class="vacio">Ningún jugador seguido. Pulsa «gestionar jugadores».</p>') +
    '</div>';

  $('#in-escudo', app).addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    leerImagen(f, 160).then(function (d) {
      D.equipos[equipo] = { nombre: equipo, escudo: d };
      return A.almacen.guardarEn('equipos', D.equipos[equipo]);
    }).then(function () { A.aviso('Escudo guardado.', 'ok'); A.pintar(); })
      .catch(function () { A.aviso('No se pudo leer la imagen.', 'error'); });
  });

  app.onclick = function (e) {
    var cb = e.target.closest('input[data-seguir]');
    if (cb) {
      var j = jugador(cb.getAttribute('data-seguir'));
      if (j) { j.seguido = cb.checked; guardarJugador(j); }
      return;
    }
    if (e.target.closest('#btn-anadir-jugador')) {
      var nombre = ($('#in-nuevo-jugador', app).value || '').trim();
      if (!nombre) return;
      var nj = { id: idJugador(equipo, nombre), equipo: equipo, nombre: nombre, pos: 'DEL', dorsal: '', seguido: true };
      guardarJugador(nj).then(function () { A.aviso('Jugador añadido.', 'ok'); A.pintar(); });
    }
  };
}

/* ------------------------------ Vista: jugador ------------------------------ */

function vistaJugador(app, id) {
  var j = jugador(id);
  if (!j) { A.navegar('#/fin'); return; }
  var rs = rematesDe(function (r) { return r.jugadorId === id; }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
  var st = estadisticas(rs);
  var cc = A.contar(rs, function (r) { return r.zonaDisparo; }), cp = A.contar(rs, function (r) { return r.zonaPorteria; });
  var topC = A.ordenado(cc)[0], topP = A.ordenado(cp)[0];

  app.innerHTML = '<div class="vista">' +
    '<div class="vista-cab"><a class="btn" href="#/fin-equipo/' + encodeURIComponent(j.equipo) + '">← ' + esc(j.equipo) + '</a><a class="btn primary" href="#/fin-nuevo/' + encodeURIComponent(j.equipo) + '/' + encodeURIComponent(j.id) + '">+ Nuevo remate</a></div>' +
    '<div class="equipo-cab"><label class="avatar-sel" title="Subir foto">' + avatarHtml(j) + '<input type="file" accept="image/*" id="in-foto" hidden></label>' +
      '<div><h1>' + esc(j.nombre) + '</h1><p class="nota">' + esc(j.equipo) + (j.pos ? ' · ' + esc(j.pos) : '') + (j.dorsal ? ' · dorsal ' + esc(j.dorsal) : '') + '</p></div></div>' +
    '<div class="kpis">' + A.kpi(st.n, 'Remates') + A.kpi(st.goles, 'Goles', st.n ? st.pctGol + '% de los remates' : '') +
      A.kpi(st.n ? st.pctPuerta + '%' : '—', 'A puerta', st.n ? st.puerta + ' de ' + st.n : '') +
      A.kpi(topC ? topC.k : '—', 'Zona de disparo favorita', topC ? A.pct(topC.n, st.n) + '% de sus remates' : '') +
      A.kpi(topP ? String(topP.k) : '—', 'Por dónde finaliza más', topP ? A.pct(topP.n, st.n) + '%' : '') + '</div>' +
    (st.n ? '<div class="mapas"><div class="mapa"><h3>Desde dónde remata</h3>' + A.svgCampo(null, { cuenta: cc }) + '</div>' +
      '<div class="mapa"><h3>Por dónde finaliza</h3>' + A.svgPorteria(null, { cuenta: cp, fuera: true }) + '</div></div>' +
      '<div class="tablas">' + A.barras('Resultado', A.contar(rs, function (r) { return r.resultado; }), RESULTADOS, st.n) +
        A.barras('Tipo de jugada', A.contar(rs, function (r) { return r.tipo; }), T.TIPO, st.n) +
        A.barras('Golpeo', A.contar(rs, function (r) { return r.golpeo; }), T.GOLPEO, st.n) + '</div>' : '') +
    '<h2 class="sub-tit">Remates registrados</h2>' +
    (rs.length ? rs.map(tarjetaRemate).join('') : '<p class="vacio">Todavía no hay remates de este jugador.</p>') +
    '</div>';

  $('#in-foto', app).addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    leerImagen(f, 240).then(function (d) { j.foto = d; return guardarJugador(j); })
      .then(function () { A.aviso('Foto guardada.', 'ok'); A.pintar(); })
      .catch(function () { A.aviso('No se pudo leer la imagen.', 'error'); });
  });
  app.onclick = function (e) {
    if (e.target.closest('a[href^="#/fin-editar/"]')) D.volverA = location.hash;
  };
}

/* ------------------------------ Vista: formulario de remate ------------------------------ */

function borradorNuevo(equipo, jugadorId) {
  var ultimo = D.remates.slice().sort(function (a, b) { return (b.creado || 0) - (a.creado || 0); })[0] || {};
  var mismo = ultimo.equipo === equipo ? ultimo : {};
  return {
    id: A.idNuevo(), creado: Date.now(),
    equipo: equipo || ultimo.equipo || '', jugadorId: jugadorId || '',
    fecha: mismo.fecha || A.hoyISO(), jornada: mismo.jornada || '', rival: mismo.rival || '', campo: mismo.campo || 'Local',
    minuto: '', periodo: '', tipo: '', subtipo: '', golpeo: '', pie: '',
    zonaDisparo: '', area: '', resultado: '', zonaPorteria: '', notas: '',
    videoId: '', videoNombre: '', videoTam: 0, link: '', instanteRemate: null, instanteGol: null, fotoRemate: '', fotoGol: ''
  };
}

function htmlJugadorSelect(g) {
  var lista = g.equipo ? plantilla(g.equipo) : [];
  var sig = lista.filter(function (j) { return j.seguido; }), resto = lista.filter(function (j) { return !j.seguido; });
  var op = function (j) { return '<option value="' + esc(j.id) + '"' + (j.id === g.jugadorId ? ' selected' : '') + '>' + esc(j.nombre) + (j.pos ? ' · ' + esc(j.pos) : '') + (j.dorsal ? ' ' + esc(j.dorsal) : '') + '</option>'; };
  return '<label class="campo"><span>Jugador</span><select name="jugadorId">' +
    '<option value="">' + (g.equipo ? 'Elige el jugador' : 'Elige primero el equipo') + '</option>' +
    (sig.length ? '<optgroup label="Seguidos">' + sig.map(op).join('') + '</optgroup>' : '') +
    (resto.length ? '<optgroup label="Resto de la plantilla">' + resto.map(op).join('') : '') +
    '</select></label>';
}

function htmlSubtipo(g) {
  var lista = A.SUBTIPO[g.tipo];
  if (!lista) return '';
  return '<span class="et">Subtipo</span>' + A.chips('subtipo', lista, g.subtipo) +
    (g.tipo === 'Acción a balón parado' ? '<span class="et">Pie del lanzador <small>(opcional)</small></span>' + A.chips('pie', G.PIE, g.pie) : '');
}

function vistaRemate(app, id, equipo, jugadorId) {
  var g;
  if (id) {
    g = D.remates.filter(function (x) { return x.id === id; })[0];
    if (!g) { A.navegar('#/fin'); return; }
    g = JSON.parse(JSON.stringify(g));
  } else g = borradorNuevo(equipo, jugadorId);
  D.borrador = g;
  A.state.videoArchivo = null;
  var volver = id ? (D.volverA || '#/fin') : (g.jugadorId ? '#/fin-jugador/' + encodeURIComponent(g.jugadorId) : (g.equipo ? '#/fin-equipo/' + encodeURIComponent(g.equipo) : '#/fin'));
  var rivalesLista = equipos().filter(function (e) { return e !== g.equipo; });

  app.innerHTML =
  '<form class="vista formulario" id="form-remate" autocomplete="off">' +
    '<div class="vista-cab"><h1>' + (id ? 'Editar remate' : 'Nuevo remate') + '</h1><a class="btn" href="' + esc(volver) + '">' + (id ? '← Volver' : 'Cancelar') + '</a></div>' +

    '<section class="bloque"><h2>1 · Clip</h2><div id="zona-video"></div>' +
      '<div class="fila"><label class="btn archivo">Elegir vídeo<input type="file" accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.MP4,.MOV" id="in-video" hidden></label>' +
      A.campoTexto('link', 'o enlace', g.link, { tipo: 'url', placeholder: 'https://…' }) + '</div></section>' +

    '<section class="bloque"><h2>2 · Jugador</h2><div class="rejilla">' +
      A.campoSelect('equipo', 'Equipo', equipos(), g.equipo, 'Elige el equipo') +
      '<div id="zona-jugador">' + htmlJugadorSelect(g) + '</div></div></section>' +

    '<section class="bloque"><h2>3 · Partido</h2><div class="rejilla">' +
      A.campoTexto('fecha', 'Fecha', g.fecha, { tipo: 'date' }) +
      A.campoTexto('jornada', 'Jornada', g.jornada, { inputmode: 'numeric' }) +
      '<div id="zona-rival">' + A.campoSelect('rival', 'Rival de su equipo', rivalesLista, g.rival, 'Elige el rival') + '</div>' +
      A.campoTexto('minuto', 'Minuto', g.minuto, { tipo: 'number', min: 0, max: 130, inputmode: 'numeric' }) + '</div>' +
      '<div class="rejilla-chips"><div><span class="et">Su equipo juega</span>' + A.chips('campo', T.CAMPO, g.campo) + '</div></div></section>' +

    '<section class="bloque"><h2>4 · Jugada</h2><span class="et">Tipo</span>' + A.chips('tipo', T.TIPO, g.tipo) +
      '<div id="zona-subtipo">' + htmlSubtipo(g) + '</div><span class="et">Golpeo</span>' + A.chips('golpeo', T.GOLPEO, g.golpeo) + '</section>' +

    '<section class="bloque"><h2>5 · Desde dónde remata</h2><p class="nota">La portería defendida está arriba.</p>' +
      '<div id="zona-campo">' + A.svgCampo(g.zonaDisparo) + '</div><p class="sel-zona" id="txt-zona-campo">' + esc(A.etiquetaZona('campo', g.zonaDisparo)) + '</p></section>' +

    '<section class="bloque"><h2>6 · Resultado y por dónde finaliza</h2>' +
      A.chips('resultado', RESULTADOS, g.resultado) +
      '<p class="nota">Toca por dónde va el balón: dentro del marco o en una de las franjas de fuera.</p>' +
      '<div id="zona-porteria">' + A.svgPorteria(g.zonaPorteria, { fuera: true }) + '</div><p class="sel-zona" id="txt-zona-porteria">' + esc(A.etiquetaZona('porteria', g.zonaPorteria)) + '</p></section>' +

    '<section class="bloque"><h2>7 · Notas <small>(opcional)</small></h2>' +
      '<label class="campo"><span>Observaciones</span><textarea name="notas" rows="2" placeholder="Tendencias, pierna, cómo lo prepara…">' + esc(g.notas) + '</textarea></label></section>' +

    '<div class="acciones"><button type="submit" class="btn primary grande" data-accion="guardar">Guardar remate</button>' +
      (!id ? '<button type="submit" class="btn grande" data-accion="otro">Guardar y añadir otro</button>' : '') +
      (id ? '<a class="btn grande" href="' + esc(volver) + '">← Volver</a><button type="button" class="btn peligro" id="btn-borrar">Borrar</button>' : '') + '</div>' +
  '</form>';

  var form = $('#form-remate', app);
  app.onclick = null;

  form.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.name) return;
    g[el.name] = el.value;
    if (el.name === 'minuto') g.periodo = A.periodoDeMinuto(el.value);
  });
  form.addEventListener('change', function (e) {
    var el = e.target;
    if (el.name === 'equipo') {
      g.equipo = el.value; g.jugadorId = ''; g.rival = '';
      $('#zona-jugador', form).innerHTML = htmlJugadorSelect(g);
      $('#zona-rival', form).innerHTML = A.campoSelect('rival', 'Rival de su equipo', equipos().filter(function (x) { return x !== g.equipo; }), '', 'Elige el rival');
    }
  });
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-chip]');
    if (!b) return;
    e.preventDefault();
    var campo = b.getAttribute('data-chip'), valor = b.getAttribute('data-valor');
    g[campo] = valor;
    A.marcarChip(form, campo, valor);
    if (campo === 'tipo') { g.subtipo = ''; g.pie = ''; $('#zona-subtipo', form).innerHTML = htmlSubtipo(g); }
    if (campo === 'resultado' && valor !== 'Fuera' && typeof g.zonaPorteria === 'string' && g.zonaPorteria) {
      g.zonaPorteria = ''; $$('#zona-porteria [data-zona]', form).forEach(function (q) { q.classList.remove('sel'); });
      $('#txt-zona-porteria').textContent = '—';
    }
  });
  $('#zona-campo', form).addEventListener('click', function (e) {
    var p = e.target.closest('[data-zona]');
    if (!p) return;
    g.zonaDisparo = parseInt(p.getAttribute('data-zona'), 10);
    g.area = Z.campo(g.zonaDisparo).dentroArea ? 'Dentro del Area' : 'Fuera del Area';
    $$('#zona-campo [data-zona]', form).forEach(function (q) { q.classList.toggle('sel', q === p); });
    $('#txt-zona-campo').textContent = A.etiquetaZona('campo', g.zonaDisparo);
  });
  $('#zona-porteria', form).addEventListener('click', function (e) {
    var p = e.target.closest('[data-zona]');
    if (!p) return;
    var v = p.getAttribute('data-zona');
    g.zonaPorteria = /^\d+$/.test(v) ? parseInt(v, 10) : v;
    $$('#zona-porteria [data-zona]', form).forEach(function (q) { q.classList.toggle('sel', q === p); });
    $('#txt-zona-porteria').textContent = A.etiquetaZona('porteria', g.zonaPorteria);
    if (typeof g.zonaPorteria === 'string') { g.resultado = 'Fuera'; A.marcarChip(form, 'resultado', 'Fuera'); }
    else if (g.resultado === 'Fuera') { g.resultado = ''; A.marcarChip(form, 'resultado', ''); }
  });

  A.montarVideo(form, g, { etiquetas: { remate: 'Remate', gol: 'Final' } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var accion = (e.submitter && e.submitter.getAttribute('data-accion')) || 'guardar';
    guardarRemate(g, accion);
  });
  var borrar = $('#btn-borrar', form);
  if (borrar) borrar.addEventListener('click', function () {
    if (!confirm('¿Borrar este remate?')) return;
    A.almacen.borrarDe('finalizaciones', g.id).then(function () { return g.videoId ? A.almacen.quitaVideo(g.videoId) : null; })
      .then(function () { D.remates = D.remates.filter(function (x) { return x.id !== g.id; }); A.aviso('Remate borrado.'); A.navegar(D.volverA || '#/fin'); });
  });
}

function guardarRemate(g, accion) {
  var faltan = [];
  if (!g.equipo) faltan.push('equipo');
  if (!g.jugadorId) faltan.push('jugador');
  if (!g.zonaDisparo) faltan.push('zona de disparo');
  if (!g.resultado) faltan.push('resultado');
  if (!g.zonaPorteria && g.resultado !== 'Bloqueado') faltan.push('por dónde finaliza');
  if (faltan.length) { A.aviso('Falta: ' + faltan.join(', ') + '.', 'error'); return; }
  if (!g.periodo) g.periodo = A.periodoDeMinuto(g.minuto);
  if (g.minuto !== '' && g.minuto != null) g.minuto = parseInt(g.minuto, 10);

  var archivoClip = A.state.videoArchivo;
  A.persistirVideo(g).then(function () { return A.almacen.guardarEn('finalizaciones', g); }).then(function () {
    var i = D.remates.findIndex(function (x) { return x.id === g.id; });
    if (i >= 0) D.remates[i] = g; else D.remates.push(g);
    A.state.videoArchivo = null;
    A.respaldarEnDrive(g, archivoClip);
    A.aviso('Remate guardado.', 'ok');
    if (accion === 'otro') A.navegar('#/fin-nuevo/' + encodeURIComponent(g.equipo) + '/' + encodeURIComponent(g.jugadorId) + '/otro');
    else A.navegar('#/fin-jugador/' + encodeURIComponent(g.jugadorId));
  }).catch(function (e) { A.aviso('No se ha podido guardar: ' + (e && e.message || e), 'error'); });
}

/* ------------------------------ Vista: informe ------------------------------ */

function vistaInforme(app) {
  var f = D.filtro;
  var rs = A.filtrarUltimas(D.remates, f.ultimas).filter(function (r) { return (!f.equipo || r.equipo === f.equipo) && (!f.jugador || r.jugadorId === f.jugador); });
  var st = estadisticas(rs);
  var eqs = equipos().filter(function (e) { return D.remates.some(function (r) { return r.equipo === e; }); });
  var jugs = f.equipo ? plantilla(f.equipo).filter(function (j) { return D.remates.some(function (r) { return r.jugadorId === j.id; }); }) : [];

  var porJugador = {};
  rs.forEach(function (r) { var j = jugador(r.jugadorId); var k = j ? j.nombre + ' (' + j.equipo + ')' : r.jugadorId; porJugador[k] = (porJugador[k] || 0) + 1; });

  var cuerpo = !D.remates.length
    ? '<div class="vacio"><h2>Sin remates todavía</h2><p>Entra en un equipo, elige un jugador y registra su primer remate.</p><a class="btn primary grande" href="#/fin">Ver equipos</a></div>'
    : !rs.length ? '<p class="vacio">Nada con ese filtro.</p>'
    : '<div class="kpis">' + A.kpi(st.n, 'Remates') + A.kpi(st.goles, 'Goles', st.n ? st.pctGol + '% de los remates' : '') +
        A.kpi(st.pctPuerta + '%', 'A puerta', st.puerta + ' de ' + st.n) + '</div>' +
      '<div class="mapas"><div class="mapa"><h3>Desde dónde</h3>' + A.svgCampo(null, { cuenta: A.contar(rs, function (r) { return r.zonaDisparo; }) }) + '</div>' +
        '<div class="mapa"><h3>Por dónde finaliza</h3>' + A.svgPorteria(null, { cuenta: A.contar(rs, function (r) { return r.zonaPorteria; }), fuera: true }) + '</div></div>' +
      '<div class="tablas">' +
        '<div class="tarjeta-graf"><h3>Resultado</h3>' + A.svgDonut(A.ordenado(A.contar(rs, function (r) { return r.resultado; }), RESULTADOS), COLOR_RES) + '</div>' +
        A.barras('Rematadores', porJugador, null, st.n) +
        A.barras('Tipo de jugada', A.contar(rs, function (r) { return r.tipo; }), T.TIPO, st.n) +
        A.barras('Golpeo', A.contar(rs, function (r) { return r.golpeo; }), T.GOLPEO, st.n) +
        A.barras('Periodo', A.contar(rs, function (r) { return r.periodo; }), T.PERIODO, st.n) +
      '</div>' +
      '<h2 class="sub-tit">Remates</h2>' + rs.slice().sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); }).map(tarjetaRemate).join('');

  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Informe · Finalización</h1><div class="cab-acciones">' +
    (f.equipo ? '<a class="btn primary" href="#/fin-pdf/' + encodeURIComponent(f.equipo) + '">PDF del rival</a>' : '') +
    '<a class="btn" href="#/exportar">Exportar…</a></div></div>' +
    (D.remates.length ? '<div class="filtros">' + A.campoSelect('f-equipo', 'Equipo', eqs, f.equipo, 'Todos los equipos') +
      (jugs.length ? '<label class="campo"><span>Jugador</span><select name="f-jugador"><option value="">Todos</option>' + jugs.map(function (j) { return '<option value="' + esc(j.id) + '"' + (j.id === f.jugador ? ' selected' : '') + '>' + esc(j.nombre) + '</option>'; }).join('') + '</select></label>' : '') + '</div>' +
      A.chipsUltimas(f.ultimas) : '') +
    cuerpo + '</div>';

  $$('select[name^="f-"]', app).forEach(function (s) {
    s.addEventListener('change', function () {
      if (s.name === 'f-equipo') { f.equipo = s.value; f.jugador = ''; } else f.jugador = s.value;
      A.pintar();
    });
  });
  app.onclick = function (e) {
    var u = e.target.closest('[data-ultimas]');
    if (u) { f.ultimas = parseInt(u.getAttribute('data-ultimas'), 10) || 0; A.pintar(); return; }
    if (e.target.closest('a[href^="#/fin-editar/"]')) D.volverA = location.hash;
  };
}

/* ------------------------------ Vista: ficha PDF del rival ------------------------------
   Para preparar el partido: los rematadores del rival y sus tendencias. */

function tendencias(rs) {
  var out = [];
  var tc = A.ordenado(A.contar(rs, function (r) { return r.zonaDisparo; }))[0];
  var tp = A.ordenado(A.contar(rs, function (r) { return r.zonaPorteria; }))[0];
  var tg = A.ordenado(A.contar(rs.filter(function (r) { return r.golpeo; }), function (r) { return r.golpeo; }))[0];
  var tt = A.ordenado(A.contar(rs.filter(function (r) { return r.tipo; }), function (r) { return r.tipo; }))[0];
  if (tc) out.push('Remata sobre todo desde <strong>' + esc(A.etiquetaZona('campo', tc.k)) + '</strong> (' + A.pct(tc.n, rs.length) + '%)');
  if (tp) out.push('Finaliza más por <strong>' + esc(A.etiquetaZona('porteria', tp.k)) + '</strong> (' + A.pct(tp.n, rs.length) + '%)');
  if (tg) out.push('Golpeo dominante: <strong>' + esc(tg.k) + '</strong> (' + A.pct(tg.n, rs.length) + '%)');
  if (tt) out.push('Jugada más frecuente: <strong>' + esc(tt.k) + '</strong>');
  return out;
}

function vistaPDFRival(app, equipo) {
  app.onclick = null;
  var f = D.filtro;
  var rs = A.filtrarUltimas(D.remates, f.ultimas).filter(function (r) { return r.equipo === equipo; });
  var st = estadisticas(rs);
  var fechas = rs.map(function (r) { return r.fecha; }).filter(Boolean).sort();
  var porJug = {};
  rs.forEach(function (r) { (porJug[r.jugadorId] = porJug[r.jugadorId] || []).push(r); });
  var jugs = Object.keys(porJug).map(function (id) { return { j: jugador(id) || { id: id, nombre: id, equipo: equipo }, rs: porJug[id] }; })
    .sort(function (a, b) { return b.rs.length - a.rs.length; });
  var notas = rs.filter(function (r) { return r.notas; });

  var fichas = jugs.map(function (x) {
    var s = estadisticas(x.rs);
    return '<section class="pdf-bloque pdf-ancho pdf-jugador">' +
      '<div class="pdf-jug-cab">' + avatarHtml(x.j) + '<div><h3>' + esc(x.j.nombre) + '</h3><p class="nota">' + esc(x.j.pos || '') + (x.j.dorsal ? ' · dorsal ' + esc(x.j.dorsal) : '') +
        ' · ' + s.n + ' remate' + (s.n === 1 ? '' : 's') + ' · ' + s.goles + ' gol' + (s.goles === 1 ? '' : 'es') + ' · ' + s.pctPuerta + '% a puerta</p>' +
        '<ul class="pdf-lista">' + tendencias(x.rs).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div></div>' +
      '<div class="pdf-fila"><div>' + A.svgCampo(null, { cuenta: A.contar(x.rs, function (r) { return r.zonaDisparo; }) }) + '</div>' +
        '<div>' + A.svgPorteria(null, { cuenta: A.contar(x.rs, function (r) { return r.zonaPorteria; }), fuera: true }) + '</div></div>' +
      '</section>';
  }).join('');

  app.innerHTML =
    '<div class="pdf-controles no-print"><a class="btn" href="#/fin-equipo/' + encodeURIComponent(equipo) + '">← Volver</a>' +
      '<button type="button" class="btn primary grande" id="btn-imprimir">Guardar como PDF</button>' +
      A.chipsUltimas(f.ultimas) +
      '<p class="nota">Se abre el diálogo de impresión del navegador: elige «Guardar como PDF».</p></div>' +
    '<div class="pdf">' +
      '<header class="pdf-cab"><div class="pdf-foto">' + escudoHtml(equipo) + '</div>' +
        '<div class="pdf-tit"><div class="pdf-sobre">Ficha de finalización del rival</div><h1>' + esc(equipo) + '</h1>' +
          '<div class="pdf-sub">' + (fechas.length ? A.fechaCorta(fechas[0]) + ' – ' + A.fechaCorta(fechas[fechas.length - 1]) + ' · ' : '') +
          st.n + ' remates registrados' + (f.ultimas ? ' · últimas ' + f.ultimas + ' jornadas' : ' · toda la temporada') + '</div></div>' +
        '<div class="pdf-escudo">' + escudoPropioFin() + '</div></header>' +
      (!st.n ? '<p class="vacio">No hay remates de este equipo en el periodo elegido.</p>' :
        '<section class="pdf-kpis"><div class="kpi"><div class="kpi-v">' + st.n + '</div><div class="kpi-et">Remates</div></div>' +
          '<div class="kpi"><div class="kpi-v">' + st.goles + '</div><div class="kpi-et">Goles</div></div>' +
          '<div class="kpi"><div class="kpi-v">' + st.pctPuerta + '%</div><div class="kpi-et">A puerta</div></div>' +
          '<div class="kpi"><div class="kpi-v">' + st.pctGol + '%</div><div class="kpi-et">Gol por remate</div></div>' +
          '<div class="kpi"><div class="kpi-v">' + jugs.length + '</div><div class="kpi-et">Rematadores</div></div></section>' +
        '<section class="pdf-fila"><div class="pdf-bloque"><h3>Desde dónde remata el equipo</h3>' + A.svgCampo(null, { cuenta: A.contar(rs, function (r) { return r.zonaDisparo; }) }) + '</div>' +
          '<div class="pdf-bloque"><h3>Por dónde finaliza</h3>' + A.svgPorteria(null, { cuenta: A.contar(rs, function (r) { return r.zonaPorteria; }), fuera: true }) + '</div></section>' +
        '<section class="pdf-fila"><div class="pdf-bloque">' + A.barras('Resultado', A.contar(rs, function (r) { return r.resultado; }), RESULTADOS, st.n) + '</div>' +
          '<div class="pdf-bloque">' + (A.barras('Tipo de jugada', A.contar(rs.filter(function (r) { return r.tipo; }), function (r) { return r.tipo; }), T.TIPO, st.n) || '<h3>Tipo de jugada</h3><p class="nota">Sin datos.</p>') + '</div></section>' +
        '<h2 class="sub-tit">Rematadores</h2>' + fichas +
        (notas.length ? '<section class="pdf-bloque pdf-ancho"><h3>Notas</h3><ul class="pdf-lista">' + notas.map(function (r) {
          var j = jugador(r.jugadorId); return '<li><strong>' + esc(j ? j.nombre : '') + (r.fecha ? ' · ' + esc(A.fechaCorta(r.fecha)) : '') + '</strong> ' + esc(r.notas) + '</li>'; }).join('') + '</ul></section>' : '') +
        '<section class="pdf-bloque pdf-ancho"><h3>Plan para el portero</h3><div class="pdf-lineas"><span></span><span></span><span></span><span></span></div></section>' +
        '<footer class="pdf-pie">' + esc(CFG.MARCA || '') + ' · generado el ' + new Date().toLocaleDateString('es-ES') + '</footer>') +
    '</div>';

  $('#btn-imprimir', app).addEventListener('click', function () { window.print(); });
  app.onclick = function (e) {
    var u = e.target.closest('[data-ultimas]');
    if (u) { f.ultimas = parseInt(u.getAttribute('data-ultimas'), 10) || 0; A.pintar(); }
  };
}

function escudoPropioFin() {
  var eq = (CFG.EQUIPOS || [])[0] || '';
  return eq ? escudoHtml(eq) : '';
}

/* ------------------------------ Excel y copia ------------------------------ */

function hojasExcel() {
  if (!D.remates.length) return [];
  var cab = ['ID', 'EQUIPO', 'JUGADOR', 'POSICION', 'DORSAL', 'FECHA', 'JORNADA', 'RIVAL', 'CAMPO', 'MINUTO', 'PERIODO',
             'TIPO', 'SUBTIPO', 'PIE LANZADOR', 'GOLPEO', 'ZONA DISPARO', 'ZONA DISPARO (NOMBRE)', 'AREA', 'RESULTADO',
             'ZONA FINAL', 'ZONA FINAL (NOMBRE)', 'A PUERTA', 'NOTAS', 'LINK', 'CLIP', 'INSTANTE REMATE (s)', 'INSTANTE FINAL (s)', 'ID APP'];
  var filas = [cab].concat(D.remates.slice().sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); }).map(function (r, i) {
    var j = jugador(r.jugadorId) || {}, zc = Z.campo(r.zonaDisparo), zp = Z.porteriaOFuera(r.zonaPorteria);
    var num = function (v) { var n = parseInt(v, 10); return isFinite(n) ? n : (v || ''); };
    return [i + 1, r.equipo || '', j.nombre || r.jugadorId, j.pos || '', num(j.dorsal), r.fecha || '', num(r.jornada), r.rival || '', r.campo || '',
            num(r.minuto), r.periodo || '', r.tipo || '', r.subtipo || '', r.pie || '', r.golpeo || '', num(r.zonaDisparo), zc ? zc.nombre : '',
            r.area || '', r.resultado || '', typeof r.zonaPorteria === 'number' ? r.zonaPorteria : (r.zonaPorteria || ''), zp ? zp.nombre : '',
            aPuerta(r) ? 'Sí' : 'No', r.notas || '', r.link || '', r.videoNombre || '',
            r.instanteRemate != null ? r.instanteRemate : '', r.instanteGol != null ? r.instanteGol : '', r.id];
  }));
  var porJug = {};
  D.remates.forEach(function (r) { (porJug[r.jugadorId] = porJug[r.jugadorId] || []).push(r); });
  var resumen = [[{ v: 'FINALIZACIÓN · RESUMEN POR JUGADOR', estilo: 2 }], [],
    [{ v: 'JUGADOR', estilo: 1 }, { v: 'EQUIPO', estilo: 1 }, { v: 'REMATES', estilo: 1 }, { v: 'GOLES', estilo: 1 }, { v: '% GOL', estilo: 1 },
     { v: 'A PUERTA', estilo: 1 }, { v: '% A PUERTA', estilo: 1 }, { v: 'ZONA DISPARO MÁS FRECUENTE', estilo: 1 }, { v: 'ZONA FINAL MÁS FRECUENTE', estilo: 1 }]];
  Object.keys(porJug).forEach(function (id) {
    var rs = porJug[id], j = jugador(id) || {}, st = estadisticas(rs);
    var tc = A.ordenado(A.contar(rs, function (r) { return r.zonaDisparo; }))[0], tp = A.ordenado(A.contar(rs, function (r) { return r.zonaPorteria; }))[0];
    resumen.push([j.nombre || id, j.equipo || '', st.n, st.goles, st.pctGol, st.puerta, st.pctPuerta,
                  tc ? A.etiquetaZona('campo', tc.k) + ' (' + tc.n + ')' : '', tp ? A.etiquetaZona('porteria', tp.k) + ' (' + tp.n + ')' : '']);
  });
  return [
    { nombre: 'FINALIZACIONES', filas: filas, congelar: 1, filtro: true, anchos: [6, 16, 22, 9, 8, 11, 9, 16, 10, 8, 9, 22, 24, 13, 15, 12, 34, 15, 11, 11, 30, 9, 40, 30, 28, 11, 11, 14] },
    { nombre: 'FINALIZACION RESUMEN', filas: resumen, cabecera: false, anchos: [24, 18, 9, 8, 8, 10, 11, 36, 36] }
  ];
}

function datosCopia() {
  return { finalizaciones: D.remates, jugadores: Object.keys(D.jugadores).map(function (k) { return D.jugadores[k]; }),
           equipos: Object.keys(D.equipos).map(function (k) { return D.equipos[k]; }) };
}

function restaurarCopia(datos) {
  var ps = [];
  (datos.finalizaciones || []).forEach(function (r) { if (r && r.id) { r.videoId = ''; ps.push(A.almacen.guardarEn('finalizaciones', r)); } });
  (datos.jugadores || []).forEach(function (j) { if (j && j.id) ps.push(A.almacen.guardarEn('jugadores', j)); });
  (datos.equipos || []).forEach(function (e) { if (e && e.nombre) ps.push(A.almacen.guardarEn('equipos', e)); });
  return Promise.all(ps).then(cargar);
}

/* ------------------------------ Router del módulo ------------------------------ */

function pestanas() {
  return [
    ['#/fin', 'fin', 'Equipos', '<path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6z"/>'],
    ['#/fin-nuevo', 'fin-nuevo', 'Nuevo remate', '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'],
    ['#/fin-informe', 'fin-informe', 'Informe', '<path d="M4 19.5V10M10 19.5V5M16 19.5v-6M21 19.5h-18"/>'],
    ['#/exportar', 'exportar', 'Exportar', '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16.5v3h16v-3"/>']
  ];
}

function pestanaActiva(r) {
  if (r.vista === 'fin-equipo' || r.vista === 'fin-jugador') return 'fin';
  if (r.vista === 'fin-editar') return 'fin-nuevo';
  if (r.vista === 'fin-pdf') return 'fin-informe';
  return r.vista;
}

function pintar(app, r) {
  if (r.vista === 'fin') vistaEquipos(app);
  else if (r.vista === 'fin-equipo') vistaEquipo(app, r.id, r.extra === 'gestion');
  else if (r.vista === 'fin-jugador') vistaJugador(app, r.id);
  else if (r.vista === 'fin-nuevo') vistaRemate(app, null, r.id, r.extra && r.extra !== 'otro' ? r.extra : (r.extra === 'otro' ? (D.borrador && D.borrador.jugadorId) : ''));
  else if (r.vista === 'fin-editar') vistaRemate(app, r.id);
  else if (r.vista === 'fin-informe') vistaInforme(app);
  else if (r.vista === 'fin-pdf') vistaPDFRival(app, r.id);
  else vistaEquipos(app);
  document.body.classList.toggle('imprimiendo', r.vista === 'fin-pdf');
}

return { cargar: cargar, pintar: pintar, pestanas: pestanas, pestanaActiva: pestanaActiva,
         hojasExcel: hojasExcel, cuenta: function () { return D.remates.length; }, datosCopia: datosCopia, restaurarCopia: restaurarCopia,
         _D: D };
})();
