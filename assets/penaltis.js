/* =====================================================================
   Penaltis — tercer módulo: todos los lanzamientos contra el portero
   (gol, parada, fuera, palo), con lanzador, lado del portero y zonas.
   Un penalti que acaba en gol crea automáticamente su gol en el módulo
   de goles encajados (enlazado por id), para no registrarlo dos veces.
   ===================================================================== */
window.PEN = (function () {
'use strict';

var A = window.APP;
var esc = A.esc, $ = A.$, $$ = A.$$, Z = A.Z, CFG = A.CFG, T = A.T;

var RESULTADOS = ['Gol', 'Parada', 'Fuera', 'Palo'];
var LADOS = ['Izquierda', 'Centro', 'Derecha', 'No se lanza'];
var ALTURAS = ['Raso', 'Media altura', 'Alto'];
var CARRERAS = ['Carrera continua', 'Con parada', 'Paradinha / amago'];
var COLOR_RES = { 'Gol': '#E4002B', 'Parada': '#2ED47A', 'Fuera': '#9DB0C4', 'Palo': '#FFB020' };

var D = { penaltis: [], filtro: { portero: '', rival: '', ultimas: 0 }, borrador: null, volverA: '#/pen' };

function cargar() {
  return A.almacen.todosDe('penaltis').then(function (r) { D.penaltis = r || []; });
}

function ladoBalon(zp) {
  if (zp === 'FI') return 'Izquierda'; if (zp === 'FD') return 'Derecha'; if (zp === 'FA') return 'Centro';
  var z = Z.porteria(zp);
  if (!z) return '';
  return z.col <= 1 ? 'Izquierda' : 'Derecha';
}

function acierta(p) {
  if (!p.ladoPortero || p.ladoPortero === 'No se lanza') return false;
  var lb = ladoBalon(p.zonaPorteria);
  return !!lb && lb === p.ladoPortero;
}

function estadisticas(ps) {
  var n = ps.length;
  var c = function (r) { return ps.filter(function (p) { return p.resultado === r; }).length; };
  var aciertos = ps.filter(acierta).length;
  return { n: n, goles: c('Gol'), paradas: c('Parada'), fuera: c('Fuera'), palo: c('Palo'),
           pctParadas: A.pct(c('Parada'), n), pctGol: A.pct(c('Gol'), n), pctAcierto: A.pct(aciertos, n), aciertos: aciertos };
}

function filtrados() {
  return A.filtrarUltimas(D.penaltis, D.filtro.ultimas).filter(function (p) {
    return (!D.filtro.portero || p.portero === D.filtro.portero) && (!D.filtro.rival || p.rival === D.filtro.rival);
  }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0); });
}

/* ------------------------------ Gol enlazado ------------------------------ */

function golDesdePenalti(p, existente) {
  var g = existente || { id: 'pen-' + p.id, creado: p.creado || Date.now(), errores: [], aciertos: [] };
  g.desdePenalti = p.id;
  g.fecha = p.fecha; g.jornada = p.jornada; g.rival = p.rival; g.campo = p.campo; g.vuelta = p.vuelta || A.vueltaDeJornada(p.jornada);
  g.resultado = p.resultadoFinal || g.resultado || ''; g.equipo = 'Rival'; g.portero = p.portero; g.equipoPropio = (CFG.EQUIPOS || [])[0] || '';
  g.minuto = p.minuto; g.periodo = A.periodoDeMinuto(p.minuto); g.parte = p.minuto !== '' && p.minuto != null ? (parseInt(p.minuto, 10) <= 45 ? 'Primera Parte' : 'Segunda Parte') : g.parte || '';
  g.status = p.status || g.status || '';
  g.tipo = 'Acción a balón parado'; g.subtipo = 'PENALTY'; g.golpeo = p.pie === 'Pierna izquierda' ? 'Pierna izquierda' : p.pie === 'Pierna derecha' ? 'Pierna derecha' : g.golpeo || '';
  g.goleador = p.lanzador || ''; g.zonaDisparo = 2; g.area = 'Dentro del Area'; g.banda = 'Centro';
  g.zonaPorteria = typeof p.zonaPorteria === 'number' ? p.zonaPorteria : g.zonaPorteria || '';
  g.observaciones = [p.notas, p.ladoPortero ? 'Portero: ' + p.ladoPortero : ''].filter(Boolean).join(' · ');
  g.videoId = p.videoId || g.videoId || ''; g.videoNombre = p.videoNombre || g.videoNombre || ''; g.videoTam = p.videoTam || 0; g.link = p.link || '';
  g.fotoRemate = p.fotoRemate || ''; g.fotoGol = p.fotoGol || ''; g.instanteRemate = p.instanteRemate; g.instanteGol = p.instanteGol;
  g.driveVideoId = p.driveVideoId || g.driveVideoId || '';
  return g;
}

function sincronizarGol(p) {
  var idGol = 'pen-' + p.id;
  var existente = A.state.goles.filter(function (g) { return g.id === idGol; })[0] || null;
  if (p.resultado === 'Gol') {
    var g = golDesdePenalti(p, existente);
    return A.almacen.guardar(g).then(function () {
      var i = A.state.goles.findIndex(function (x) { return x.id === idGol; });
      if (i >= 0) A.state.goles[i] = g; else A.state.goles.push(g);
    });
  }
  if (existente) {
    return A.almacen.borrar(idGol).then(function () {
      A.state.goles = A.state.goles.filter(function (x) { return x.id !== idGol; });
    });
  }
  return Promise.resolve();
}

/* ------------------------------ Componentes ------------------------------ */

function tarjeta(p) {
  var zp = Z.porteriaOFuera(p.zonaPorteria);
  return '<article class="gol remate" data-id="' + esc(p.id) + '">' +
    '<div class="gol-min res-' + esc((p.resultado || '').toLowerCase()) + '">' + (p.minuto != null && p.minuto !== '' ? esc(p.minuto) + '\'' : '—') + '</div>' +
    '<div class="gol-cuerpo"><div class="gol-tit">' + esc(p.resultado || 'Sin resultado') + (p.lanzador ? ' <span class="muted">· ' + esc(p.lanzador) + '</span>' : '') + '</div>' +
      '<div class="gol-meta">' + (p.portero ? esc(p.portero) + ' · ' : '') + (p.rival ? 'vs ' + esc(p.rival) + ' · ' : '') +
        'Balón <strong>' + (zp ? zp.n : '?') + '</strong> ' + (zp ? '<span class="muted">' + esc(zp.corto) + '</span>' : '') +
        (p.ladoPortero ? ' · Portero: ' + esc(p.ladoPortero) + (acierta(p) ? ' ✓' : '') : '') + (p.pie ? ' · ' + esc(p.pie) : '') + '</div>' +
      '<div class="gol-pie">' + (p.fecha ? '<span class="badge">' + esc(A.fechaCorta(p.fecha)) + (p.jornada ? ' · J' + esc(p.jornada) : '') + '</span>' : '') +
        (p.videoId ? '<span class="badge video">🎬 clip</span>' : '') + (p.driveVideoId ? '<a class="badge link" href="https://drive.google.com/file/d/' + esc(p.driveVideoId) + '/view" target="_blank" rel="noopener">Drive</a>' : '') + '</div></div>' +
    ((p.fotoRemate || p.fotoGol) ? '<div class="gol-fotos">' + (p.fotoRemate ? '<img src="' + p.fotoRemate + '" alt="Lanzamiento">' : '') + (p.fotoGol ? '<img src="' + p.fotoGol + '" alt="Final">' : '') + '</div>' : '') +
    '<a class="gol-editar" href="#/pen-editar/' + encodeURIComponent(p.id) + '" aria-label="Editar">›</a></article>';
}

function filtrosHtml() {
  var ps = A.CFG.PORTEROS || [], rs = [];
  D.penaltis.forEach(function (p) { if (p.rival && rs.indexOf(p.rival) < 0) rs.push(p.rival); });
  return '<div class="filtros">' +
    (ps.length > 1 ? A.campoSelect('f-portero', 'Portero', ps, D.filtro.portero, 'Todos los porteros') : '') +
    (rs.length > 1 ? A.campoSelect('f-rival', 'Rival', rs.sort(), D.filtro.rival, 'Todos los rivales') : '') +
    '</div>' + A.chipsUltimas(D.filtro.ultimas);
}

function montarFiltros(app) {
  $$('select[name^="f-"]', app).forEach(function (s) {
    s.addEventListener('change', function () { D.filtro[s.name.replace('f-', '')] = s.value; A.pintar(); });
  });
}

/* ------------------------------ Vista: lista ------------------------------ */

function vistaLista(app) {
  app.onclick = function (e) {
    var u = e.target.closest('[data-ultimas]');
    if (u) { D.filtro.ultimas = parseInt(u.getAttribute('data-ultimas'), 10) || 0; A.pintar(); return; }
    if (e.target.closest('a[href^="#/pen-editar/"]')) D.volverA = location.hash || '#/pen';
  };
  var ps = filtrados(), st = estadisticas(ps);
  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Penaltis</h1><a class="btn primary" href="#/pen-nuevo">+ Nuevo penalti</a></div>' +
    (D.penaltis.length ? filtrosHtml() : '') +
    (!D.penaltis.length ? '<div class="vacio"><h2>Sin penaltis todavía</h2><p>Registra cada lanzamiento en contra: gol, parada, fuera o palo, con el lado del portero y del balón.</p><a class="btn primary grande" href="#/pen-nuevo">+ Registrar el primero</a></div>' :
      '<div class="kpis">' + A.kpi(st.n, 'Lanzamientos') + A.kpi(st.paradas, 'Paradas', st.n ? st.pctParadas + '%' : '') + A.kpi(st.goles, 'Goles', st.n ? st.pctGol + '%' : '') +
        A.kpi(st.fuera + st.palo, 'Fuera / palo') + A.kpi(st.n ? st.pctAcierto + '%' : '—', 'Acierta el lado', st.n ? st.aciertos + ' de ' + st.n : '') + '</div>' +
      (ps.length ? ps.map(tarjeta).join('') : '<p class="vacio">Nada con ese filtro.</p>')) + '</div>';
  montarFiltros(app);
}

/* ------------------------------ Vista: formulario ------------------------------ */

function borradorNuevo() {
  var ultimoGol = A.state.goles.slice().sort(function (a, b) { return (b.creado || 0) - (a.creado || 0); })[0] || {};
  var ultimo = D.penaltis.slice().sort(function (a, b) { return (b.creado || 0) - (a.creado || 0); })[0] || {};
  var base = (ultimo.creado || 0) > (ultimoGol.creado || 0) ? ultimo : ultimoGol;
  return { id: A.idNuevo(), creado: Date.now(),
    fecha: base.fecha || A.hoyISO(), jornada: base.jornada || '', rival: base.rival || '', campo: base.campo || 'Local', vuelta: base.vuelta || '', resultadoFinal: base.resultado || base.resultadoFinal || '',
    portero: base.portero || (CFG.PORTEROS || [])[0] || '', minuto: '', status: '',
    lanzador: '', pie: '', carrera: '', altura: '', zonaPorteria: '', resultado: '', ladoPortero: '', notas: '',
    videoId: '', videoNombre: '', videoTam: 0, link: '', instanteRemate: null, instanteGol: null, fotoRemate: '', fotoGol: '' };
}

function vistaFormulario(app, id) {
  var p;
  if (id) { p = D.penaltis.filter(function (x) { return x.id === id; })[0]; if (!p) { A.navegar('#/pen'); return; } p = JSON.parse(JSON.stringify(p)); }
  else p = borradorNuevo();
  D.borrador = p; A.state.videoArchivo = null;
  var volver = id ? (D.volverA || '#/pen') : '#/pen';
  var lanzadores = p.rival ? ((CFG.JUGADORES || {})[p.rival] || []) : [];

  app.innerHTML =
  '<form class="vista formulario" id="form-pen" autocomplete="off">' +
    '<div class="vista-cab"><h1>' + (id ? 'Editar penalti' : 'Nuevo penalti') + '</h1><a class="btn" href="' + esc(volver) + '">' + (id ? '← Volver' : 'Cancelar') + '</a></div>' +
    '<section class="bloque"><h2>1 · Clip</h2><div id="zona-video"></div>' +
      '<div class="fila"><label class="btn archivo">Elegir vídeo<input type="file" accept="video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.MP4,.MOV" id="in-video" hidden></label>' +
      A.campoTexto('link', 'o enlace', p.link, { tipo: 'url', placeholder: 'https://…' }) + '</div></section>' +
    '<section class="bloque"><h2>2 · Partido</h2><div class="rejilla">' +
      A.campoTexto('fecha', 'Fecha', p.fecha, { tipo: 'date' }) + A.campoTexto('jornada', 'Jornada', p.jornada, { inputmode: 'numeric' }) +
      '<div id="zona-rival">' + A.campoSelect('rival', 'Rival', A.rivales(), p.rival, 'Elige el rival') + '</div>' +
      A.campoSelect('portero', 'Portero', CFG.PORTEROS || [], p.portero, 'Sin portero') +
      A.campoTexto('minuto', 'Minuto', p.minuto, { tipo: 'number', min: 0, max: 130, inputmode: 'numeric' }) + '</div>' +
      '<div class="rejilla-chips"><div><span class="et">Campo</span>' + A.chips('campo', T.CAMPO, p.campo) + '</div>' +
        '<div><span class="et">Marcador en ese momento</span>' + A.chips('status', T.STATUS, p.status) + '</div>' +
        '<div><span class="et">Resultado final del partido</span>' + A.chips('resultadoFinal', T.RESULTADO, p.resultadoFinal) + '</div></div></section>' +
    '<section class="bloque"><h2>3 · Lanzador</h2><div class="rejilla"><div id="zona-lanzador">' +
      A.campoTexto('lanzador', 'Lanzador', p.lanzador, { lista: lanzadores, placeholder: p.rival ? 'Elige o escribe' : 'Elige primero el rival' }) + '</div></div>' +
      '<div class="rejilla-chips"><div><span class="et">Pie</span>' + A.chips('pie', ['Pierna derecha', 'Pierna izquierda'], p.pie) + '</div>' +
        '<div><span class="et">Carrera</span>' + A.chips('carrera', CARRERAS, p.carrera) + '</div></div></section>' +
    '<section class="bloque"><h2>4 · Dónde va el balón</h2><p class="nota">Vista frontal desde el campo. Toca por dónde va: dentro o en una franja de fuera.</p>' +
      '<div id="zona-porteria">' + A.svgPorteria(p.zonaPorteria, { fuera: true }) + '</div><p class="sel-zona" id="txt-zona-porteria">' + esc(A.etiquetaZona('porteria', p.zonaPorteria)) + '</p>' +
      '<div class="rejilla-chips"><div><span class="et">Altura</span>' + A.chips('altura', ALTURAS, p.altura) + '</div>' +
        '<div><span class="et">Resultado</span>' + A.chips('resultado', RESULTADOS, p.resultado) + '</div></div></section>' +
    '<section class="bloque"><h2>5 · El portero</h2>' +
      '<span class="et">Lado al que se lanza <small>(visto desde el campo, como el mapa)</small></span>' + A.chips('ladoPortero', LADOS, p.ladoPortero) +
      '<label class="campo" style="margin-top:12px"><span>Notas</span><textarea name="notas" rows="2" placeholder="Qué hizo el lanzador, qué leyó el portero…">' + esc(p.notas) + '</textarea></label></section>' +
    '<div class="acciones"><button type="submit" class="btn primary grande" data-accion="guardar">Guardar penalti</button>' +
      (id ? '<a class="btn grande" href="' + esc(volver) + '">← Volver</a><button type="button" class="btn peligro" id="btn-borrar">Borrar</button>' : '') + '</div>' +
  '</form>';

  var form = $('#form-pen', app); app.onclick = null;
  form.addEventListener('input', function (e) { var el = e.target; if (el.name) p[el.name] = el.value; });
  form.addEventListener('change', function (e) {
    if (e.target.name === 'rival') {
      p.rival = e.target.value; p.lanzador = '';
      $('#zona-lanzador', form).innerHTML = A.campoTexto('lanzador', 'Lanzador', '', { lista: (CFG.JUGADORES || {})[p.rival] || [], placeholder: 'Elige o escribe' });
    }
  });
  form.addEventListener('click', function (e) {
    var b = e.target.closest('[data-chip]'); if (!b) return;
    e.preventDefault();
    var campo = b.getAttribute('data-chip'), valor = b.getAttribute('data-valor');
    p[campo] = valor; A.marcarChip(form, campo, valor);
    if (campo === 'resultado' && valor !== 'Fuera' && typeof p.zonaPorteria === 'string' && p.zonaPorteria) {
      p.zonaPorteria = ''; $$('#zona-porteria [data-zona]', form).forEach(function (q) { q.classList.remove('sel'); }); $('#txt-zona-porteria').textContent = '—';
    }
  });
  $('#zona-porteria', form).addEventListener('click', function (e) {
    var el = e.target.closest('[data-zona]'); if (!el) return;
    var v = el.getAttribute('data-zona'); p.zonaPorteria = /^\d+$/.test(v) ? parseInt(v, 10) : v;
    $$('#zona-porteria [data-zona]', form).forEach(function (q) { q.classList.toggle('sel', q === el); });
    $('#txt-zona-porteria').textContent = A.etiquetaZona('porteria', p.zonaPorteria);
    if (typeof p.zonaPorteria === 'string') { p.resultado = 'Fuera'; A.marcarChip(form, 'resultado', 'Fuera'); }
    else if (p.resultado === 'Fuera') { p.resultado = ''; A.marcarChip(form, 'resultado', ''); }
  });
  A.montarVideo(form, p, { etiquetas: { remate: 'Lanzamiento', gol: 'Final' } });
  form.addEventListener('submit', function (e) { e.preventDefault(); guardar(p); });
  var borrar = $('#btn-borrar', form);
  if (borrar) borrar.addEventListener('click', function () {
    if (!confirm('¿Borrar este penalti? Si acabó en gol, también se borra el gol enlazado.')) return;
    A.almacen.borrarDe('penaltis', p.id).then(function () { p.resultado = ''; return sincronizarGol(p); })
      .then(function () { return p.videoId ? A.almacen.quitaVideo(p.videoId) : null; })
      .then(function () { D.penaltis = D.penaltis.filter(function (x) { return x.id !== p.id; }); A.aviso('Penalti borrado.'); A.navegar(D.volverA || '#/pen'); });
  });
}

function guardar(p) {
  var faltan = [];
  if (!p.rival) faltan.push('rival');
  if (!p.resultado) faltan.push('resultado');
  if (!p.zonaPorteria && p.resultado !== 'Palo') faltan.push('dónde va el balón');
  if (faltan.length) { A.aviso('Falta: ' + faltan.join(', ') + '.', 'error'); return; }
  if (p.minuto !== '' && p.minuto != null) p.minuto = parseInt(p.minuto, 10);
  var archivoClip = A.state.videoArchivo;
  A.persistirVideo(p).then(function () { return A.almacen.guardarEn('penaltis', p); }).then(function () {
    var i = D.penaltis.findIndex(function (x) { return x.id === p.id; });
    if (i >= 0) D.penaltis[i] = p; else D.penaltis.push(p);
    A.state.videoArchivo = null;
    return sincronizarGol(p);
  }).then(function () {
    A.respaldarEnDrive(p, archivoClip);
    A.aviso('Penalti guardado.' + (p.resultado === 'Gol' ? ' El gol se ha añadido a Goles encajados.' : ''), 'ok');
    A.navegar(D.volverA || '#/pen');
  }).catch(function (e) { A.aviso('No se ha podido guardar: ' + (e && e.message || e), 'error'); });
}

/* ------------------------------ Vista: informe ------------------------------ */

function porLanzador(ps) {
  var m = {};
  ps.forEach(function (p) { var k = (p.lanzador || '(sin nombre)') + (p.rival ? ' · ' + p.rival : ''); (m[k] = m[k] || []).push(p); });
  return Object.keys(m).map(function (k) { return { k: k, ps: m[k], st: estadisticas(m[k]) }; }).sort(function (a, b) { return b.ps.length - a.ps.length; });
}

function cuerpoInforme(ps, pdf) {
  var st = estadisticas(ps);
  var cRes = A.contar(ps, function (p) { return p.resultado; });
  var cLadoP = A.contar(ps.filter(function (p) { return p.ladoPortero; }), function (p) { return p.ladoPortero; });
  var cLadoB = A.contar(ps, function (p) { return ladoBalon(p.zonaPorteria) || '(sin dato)'; });
  var cAlt = A.contar(ps.filter(function (p) { return p.altura; }), function (p) { return p.altura; });
  var filasL = porLanzador(ps).map(function (x) {
    var top = A.ordenado(A.contar(x.ps, function (p) { return p.zonaPorteria; }))[0];
    return '<tr><td>' + esc(x.k) + '</td><td class="num">' + x.st.n + '</td><td class="num">' + x.st.goles + '</td><td class="num">' + x.st.paradas + '</td><td class="num">' + (x.st.fuera + x.st.palo) + '</td>' +
      '<td>' + (top ? esc(A.etiquetaZona('porteria', top.k)) + ' (' + top.n + ')' : '') + '</td><td>' + esc(A.ordenado(A.contar(x.ps, function (p) { return p.pie || '(sin dato)'; }))[0].k) + '</td></tr>';
  }).join('');
  var lista = ps.map(function (p) {
    var zp = Z.porteriaOFuera(p.zonaPorteria);
    return '<tr><td>' + esc(A.fechaCorta(p.fecha)) + '</td><td>' + esc(p.jornada || '') + '</td><td>' + esc(p.rival || '') + '</td><td>' + (p.minuto !== '' && p.minuto != null ? esc(p.minuto) + "'" : '') + '</td>' +
      '<td>' + esc(p.lanzador || '') + '</td><td>' + esc(p.resultado || '') + '</td><td>' + (zp ? zp.n + ' · ' + esc(zp.corto) : '') + '</td><td>' + esc(p.ladoPortero || '') + (acierta(p) ? ' ✓' : '') + '</td><td>' + esc(p.portero || '') + '</td></tr>';
  }).join('');
  var k = pdf ? 'pdf-kpis' : 'kpis';
  return '<section class="' + k + '">' + A.kpi(st.n, 'Lanzamientos') + A.kpi(st.n ? st.pctParadas + '%' : '—', 'Paradas', st.paradas + ' de ' + st.n) +
      A.kpi(st.goles, 'Goles', st.n ? st.pctGol + '%' : '') + A.kpi(st.fuera + st.palo, 'Fuera / palo') + A.kpi(st.n ? st.pctAcierto + '%' : '—', 'Acierta el lado', st.aciertos + ' de ' + st.n) + '</section>' +
    '<div class="' + (pdf ? 'pdf-fila' : 'mapas') + '"><div class="' + (pdf ? 'pdf-bloque' : 'mapa') + '"><h3>Dónde van los lanzamientos</h3>' + A.svgPorteria(null, { cuenta: A.contar(ps, function (p) { return p.zonaPorteria; }), fuera: true }) + '</div>' +
      '<div class="' + (pdf ? 'pdf-bloque' : 'tarjeta-graf') + '"><h3>Resultado</h3>' + A.svgDonut(A.ordenado(cRes, RESULTADOS), COLOR_RES) + '</div></div>' +
    '<div class="' + (pdf ? 'pdf-fila' : 'tablas') + '">' +
      '<div class="' + (pdf ? 'pdf-bloque' : '') + '">' + A.barras('Lado del balón', cLadoB, ['Izquierda', 'Centro', 'Derecha'], st.n) + '</div>' +
      '<div class="' + (pdf ? 'pdf-bloque' : '') + '">' + (A.barras('Lado del portero', cLadoP, LADOS, st.n) || '<h3>Lado del portero</h3><p class="nota">Sin datos.</p>') + '</div>' +
      '<div class="' + (pdf ? 'pdf-bloque' : '') + '">' + (A.barras('Altura', cAlt, ALTURAS, st.n) || '') + '</div>' +
      '<div class="' + (pdf ? 'pdf-bloque' : '') + '">' + A.barras('Pie del lanzador', A.contar(ps.filter(function (p) { return p.pie; }), function (p) { return p.pie; }), null, st.n) + '</div></div>' +
    '<h2 class="sub-tit">Lanzadores</h2><div class="tabla-env"><table class="tabla' + (pdf ? ' pdf-tabla' : '') + '"><thead><tr><th>Lanzador</th><th class="num">Lanz.</th><th class="num">Gol</th><th class="num">Parada</th><th class="num">Fuera/palo</th><th>Zona habitual</th><th>Pie</th></tr></thead><tbody>' + filasL + '</tbody></table></div>' +
    '<h2 class="sub-tit">Lanzamientos</h2><div class="tabla-env"><table class="tabla' + (pdf ? ' pdf-tabla' : '') + '"><thead><tr><th>Fecha</th><th>J</th><th>Rival</th><th>Min</th><th>Lanzador</th><th>Resultado</th><th>Balón</th><th>Portero</th><th>Portero (nombre)</th></tr></thead><tbody>' + lista + '</tbody></table></div>';
}

function vistaInforme(app) {
  app.onclick = function (e) {
    var u = e.target.closest('[data-ultimas]');
    if (u) { D.filtro.ultimas = parseInt(u.getAttribute('data-ultimas'), 10) || 0; A.pintar(); }
  };
  var ps = filtrados();
  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Informe · Penaltis</h1><div class="cab-acciones">' + (ps.length ? '<a class="btn primary" href="#/pen-pdf">PDF</a>' : '') + '<a class="btn" href="#/exportar">Exportar…</a></div></div>' +
    (D.penaltis.length ? filtrosHtml() : '') +
    (!ps.length ? '<p class="vacio">Sin penaltis con ese filtro.</p>' : cuerpoInforme(ps, false)) + '</div>';
  montarFiltros(app);
}

function vistaPDF(app) {
  app.onclick = null;
  var ps = filtrados().slice().reverse(), st = estadisticas(ps);
  var fechas = ps.map(function (p) { return p.fecha; }).filter(Boolean).sort();
  var portero = D.filtro.portero;
  app.innerHTML = '<div class="pdf-controles no-print"><a class="btn" href="#/pen-informe">← Volver</a><button type="button" class="btn primary grande" id="btn-imprimir">Guardar como PDF</button>' +
      '<p class="nota">Se abre el diálogo de impresión del navegador: elige «Guardar como PDF».</p></div>' +
    '<div class="pdf"><header class="pdf-cab"><div class="pdf-foto">' + (portero ? A.avatarPortero(portero) : '') + '</div>' +
      '<div class="pdf-tit"><div class="pdf-sobre">Informe de penaltis</div><h1>' + esc(portero || 'Todos los porteros') + '</h1>' +
      '<div class="pdf-sub">' + esc((CFG.EQUIPOS || [])[0] || '') + (D.filtro.rival ? ' · vs ' + esc(D.filtro.rival) : '') + (fechas.length ? ' · ' + A.fechaCorta(fechas[0]) + ' – ' + A.fechaCorta(fechas[fechas.length - 1]) : '') +
      ' · ' + st.n + ' lanzamiento' + (st.n === 1 ? '' : 's') + (D.filtro.ultimas ? ' · últimas ' + D.filtro.ultimas + ' jornadas' : '') + '</div></div></header>' +
    (st.n ? cuerpoInforme(ps, true) : '<p class="vacio">Sin penaltis.</p>') +
    '<section class="pdf-bloque pdf-ancho"><h3>Conclusiones</h3><div class="pdf-lineas"><span></span><span></span><span></span></div></section>' +
    '<footer class="pdf-pie">' + esc(CFG.MARCA || '') + ' · generado el ' + new Date().toLocaleDateString('es-ES') + '</footer></div>';
  $('#btn-imprimir', app).addEventListener('click', function () { window.print(); });
}

/* ------------------------------ Excel y copia ------------------------------ */

function hojasExcel() {
  if (!D.penaltis.length) return [];
  var cab = ['ID', 'FECHA', 'JORNADA', 'RIVAL', 'CAMPO', 'PORTERO', 'MINUTO', 'MARCADOR', 'RESULTADO FINAL', 'LANZADOR', 'PIE', 'CARRERA',
             'ZONA BALON', 'ZONA BALON (NOMBRE)', 'LADO BALON', 'ALTURA', 'RESULTADO', 'LADO PORTERO', 'ACIERTA LADO', 'NOTAS', 'LINK', 'CLIP', 'ID APP'];
  var filas = [cab].concat(D.penaltis.slice().sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); }).map(function (p, i) {
    var zp = Z.porteriaOFuera(p.zonaPorteria), num = function (v) { var n = parseInt(v, 10); return isFinite(n) ? n : (v || ''); };
    return [i + 1, p.fecha || '', num(p.jornada), p.rival || '', p.campo || '', p.portero || '', num(p.minuto), p.status || '', p.resultadoFinal || '', p.lanzador || '', p.pie || '', p.carrera || '',
            typeof p.zonaPorteria === 'number' ? p.zonaPorteria : (p.zonaPorteria || ''), zp ? zp.nombre : '', ladoBalon(p.zonaPorteria), p.altura || '', p.resultado || '', p.ladoPortero || '',
            acierta(p) ? 'Sí' : 'No', p.notas || '', p.link || '', p.videoNombre || '', p.id];
  }));
  var res = [[{ v: 'PENALTIS · RESUMEN POR LANZADOR', estilo: 2 }], [], [{ v: 'LANZADOR', estilo: 1 }, { v: 'LANZAMIENTOS', estilo: 1 }, { v: 'GOLES', estilo: 1 }, { v: 'PARADAS', estilo: 1 }, { v: 'FUERA/PALO', estilo: 1 }, { v: 'ZONA HABITUAL', estilo: 1 }]];
  porLanzador(D.penaltis).forEach(function (x) {
    var top = A.ordenado(A.contar(x.ps, function (p) { return p.zonaPorteria; }))[0];
    res.push([x.k, x.st.n, x.st.goles, x.st.paradas, x.st.fuera + x.st.palo, top ? A.etiquetaZona('porteria', top.k) : '']);
  });
  return [{ nombre: 'PENALTIS', filas: filas, congelar: 1, filtro: true, anchos: [5, 11, 9, 16, 10, 16, 8, 12, 14, 22, 15, 18, 10, 30, 11, 12, 11, 13, 11, 40, 30, 28, 14] },
          { nombre: 'PENALTIS RESUMEN', filas: res, cabecera: false, anchos: [34, 13, 8, 9, 11, 34] }];
}

function datosCopia() { return { penaltis: D.penaltis }; }
function restaurarCopia(datos) {
  var ps = (datos.penaltis || []).filter(function (p) { return p && p.id; }).map(function (p) { p.videoId = ''; return A.almacen.guardarEn('penaltis', p); });
  return Promise.all(ps).then(cargar);
}

/* ------------------------------ Router ------------------------------ */

function pestanas() {
  return [
    ['#/pen', 'pen', 'Penaltis', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/>'],
    ['#/pen-nuevo', 'pen-nuevo', 'Nuevo penalti', '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'],
    ['#/pen-informe', 'pen-informe', 'Informe', '<path d="M4 19.5V10M10 19.5V5M16 19.5v-6M21 19.5h-18"/>'],
    ['#/exportar', 'exportar', 'Exportar', '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16.5v3h16v-3"/>']
  ];
}
function pestanaActiva(r) { return r.vista === 'pen-editar' ? 'pen-nuevo' : r.vista === 'pen-pdf' ? 'pen-informe' : r.vista; }
function pintar(app, r) {
  if (r.vista === 'pen-nuevo') vistaFormulario(app, null);
  else if (r.vista === 'pen-editar') vistaFormulario(app, r.id);
  else if (r.vista === 'pen-informe') vistaInforme(app);
  else if (r.vista === 'pen-pdf') vistaPDF(app);
  else vistaLista(app);
  document.body.classList.toggle('imprimiendo', r.vista === 'pen-pdf');
}

return { cargar: cargar, pintar: pintar, pestanas: pestanas, pestanaActiva: pestanaActiva, hojasExcel: hojasExcel,
         cuenta: function () { return D.penaltis.length; }, datosCopia: datosCopia, restaurarCopia: restaurarCopia, _D: D };
})();
