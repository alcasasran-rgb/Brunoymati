/* =====================================================================
   Entrenos — cuarto módulo: el diario de entrenamientos del portero.
   Cada sesión guarda qué objetivos se trabajaron (juego aéreo, juego de
   pies, blocaje…), con quién, cuánto y con qué intensidad. El informe y
   el PDF se acotan por fechas y muestran cuánto hace que no se trabaja
   cada objetivo.
   ===================================================================== */
window.ENT = (function () {
'use strict';

var A = window.APP;
var esc = A.esc, $ = A.$, $$ = A.$$, CFG = A.CFG;

var TIPOS = ['Entreno', 'Activación pre-partido', 'Recuperación', 'Individual'];
var INTENSIDADES = ['Baja', 'Media', 'Alta'];
var OBJETIVOS_BASE = CFG.OBJETIVOS_ENTRENO || [
  'Juego aéreo', 'Juego de pies', 'Blocaje', 'Desvíos', '1x1', 'Posicionamiento', 'Reflejos / reacción',
  'Balón parado', 'Saques / distribución', 'Caídas', 'Físico / fuerza', 'Velocidad / coordinación', 'Táctico / lectura', 'Vídeo / análisis'];
var COLOR_TIPO = { 'Entreno': '#1B5FA3', 'Activación pre-partido': '#8AC3EE', 'Recuperación': '#1E7D55', 'Individual': '#B97A00' };
var ALERTA_DIAS = 14;   /* a partir de aquí un objetivo se marca como «hace mucho» */

var D = { entrenos: [], extra: [], filtro: { portero: '', desde: '', hasta: '' }, borrador: null, volverA: '#/ent', pendientes: [] };
var MAX_ADJUNTO_MB = 600;

function cargar() {
  return A.almacen.todosDe('entrenos').then(function (r) { D.entrenos = r || []; return A.almacen.ajuste('objetivosExtra'); })
    .then(function (x) { D.extra = Array.isArray(x) ? x : []; });
}

function objetivos() {
  var l = OBJETIVOS_BASE.slice();
  D.extra.forEach(function (o) { if (l.indexOf(o) < 0) l.push(o); });
  /* También los que aparezcan en sesiones antiguas aunque se hayan quitado de la lista */
  D.entrenos.forEach(function (e) { (e.objetivos || []).forEach(function (o) { if (l.indexOf(o) < 0) l.push(o); }); });
  return l;
}

/* ------------------------------ Fechas ------------------------------ */

function hoy() { return A.hoyISO(); }
function sumaDias(iso, n) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function diasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
function inicioTemporada() { var d = new Date(); var y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; return y + '-07-01'; }
function lunesDe(iso) { var d = new Date(iso + 'T12:00:00'); var w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toISOString().slice(0, 10); }
function mesDe(iso) { return (iso || '').slice(0, 7); }
function nombreMes(ym) {
  var m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var p = ym.split('-'); return m[parseInt(p[1], 10) - 1] + ' ' + p[0].slice(2);
}

var ATAJOS = [['todo', 'Todo'], ['30', '30 días'], ['90', '90 días'], ['temp', 'Temporada']];
function atajoActivo() {
  var f = D.filtro;
  if (!f.desde && !f.hasta) return 'todo';
  if (f.hasta && f.hasta !== hoy()) return '';
  if (f.desde === sumaDias(hoy(), -30)) return '30';
  if (f.desde === sumaDias(hoy(), -90)) return '90';
  if (f.desde === inicioTemporada()) return 'temp';
  return '';
}
function aplicarAtajo(a) {
  if (a === 'todo') { D.filtro.desde = ''; D.filtro.hasta = ''; }
  else if (a === 'temp') { D.filtro.desde = inicioTemporada(); D.filtro.hasta = hoy(); }
  else { D.filtro.desde = sumaDias(hoy(), -parseInt(a, 10)); D.filtro.hasta = hoy(); }
}

function filtrados() {
  var f = D.filtro;
  return D.entrenos.filter(function (e) {
    if (f.portero && (e.porteros || []).indexOf(f.portero) < 0) return false;
    if (f.desde && e.fecha < f.desde) return false;
    if (f.hasta && e.fecha > f.hasta) return false;
    return true;
  }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0); });
}

/* ------------------------------ Estadística ------------------------------ */

function estadisticas(es) {
  var n = es.length, min = 0, nObj = 0;
  es.forEach(function (e) { min += parseInt(e.duracion, 10) || 0; nObj += (e.objetivos || []).length; });
  return { n: n, minutos: min, horas: Math.round(min / 6) / 10, mediaObj: n ? Math.round(nObj / n * 10) / 10 : 0 };
}

/* Para cada objetivo: veces, % de sesiones, última fecha y días desde entonces. */
function cobertura(es) {
  var ultima = {}, veces = {}, minutos = {};
  es.forEach(function (e) {
    (e.objetivos || []).forEach(function (o) {
      veces[o] = (veces[o] || 0) + 1;
      if (!ultima[o] || e.fecha > ultima[o]) ultima[o] = e.fecha;
      minutos[o] = (minutos[o] || 0) + (parseInt(e.duracion, 10) || 0) / Math.max(1, (e.objetivos || []).length);
    });
  });
  var ref = D.filtro.hasta || hoy();
  return objetivos().map(function (o) {
    return { k: o, n: veces[o] || 0, pct: A.pct(veces[o] || 0, es.length), ultima: ultima[o] || '', hace: ultima[o] ? diasEntre(ultima[o], ref) : null, minutos: Math.round(minutos[o] || 0) };
  }).sort(function (a, b) { return b.n - a.n || a.k.localeCompare(b.k); });
}

function porSemana(es) {
  var m = {};
  es.forEach(function (e) { var l = lunesDe(e.fecha); m[l] = m[l] || {}; m[l][e.tipo || 'Entreno'] = (m[l][e.tipo || 'Entreno'] || 0) + 1; });
  var semanas = Object.keys(m).sort();
  if (semanas.length > 1) { /* rellena las semanas vacías entre la primera y la última */
    var todas = [], s = semanas[0];
    while (s <= semanas[semanas.length - 1]) { todas.push(s); s = sumaDias(s, 7); }
    semanas = todas;
  }
  return { cats: semanas.map(function (s) { return A.fechaCorta(s); }),
           series: TIPOS.filter(function (t) { return semanas.some(function (s) { return m[s] && m[s][t]; }); })
             .map(function (t) { return { nombre: t, color: COLOR_TIPO[t], valores: semanas.map(function (s) { return (m[s] && m[s][t]) || 0; }) }; }) };
}

function matrizMeses(es) {
  var meses = [], m = {};
  es.forEach(function (e) {
    var ym = mesDe(e.fecha); if (meses.indexOf(ym) < 0) meses.push(ym);
    (e.objetivos || []).forEach(function (o) { m[o] = m[o] || {}; m[o][ym] = (m[o][ym] || 0) + 1; });
  });
  meses.sort();
  return { meses: meses, filas: cobertura(es).filter(function (c) { return c.n; }).map(function (c) { return { k: c.k, n: c.n, v: meses.map(function (ym) { return (m[c.k] && m[c.k][ym]) || 0; }) }; }) };
}

/* ------------------------------ Componentes ------------------------------ */

function tarjeta(e) {
  var f = e.fecha ? new Date(e.fecha + 'T12:00:00') : null;
  var dia = f ? f.getDate() : '—', mes = f ? ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'][f.getMonth()] : '';
  return '<article class="gol entreno" data-id="' + esc(e.id) + '">' +
    '<div class="gol-min" style="background:' + (COLOR_TIPO[e.tipo] || COLOR_TIPO.Entreno) + ';color:#fff"><span>' + dia + '</span><small>' + mes + '</small></div>' +
    '<div class="gol-cuerpo"><div class="gol-tit">' + esc(e.tipo || 'Entreno') + (e.duracion ? ' <span class="muted">· ' + esc(e.duracion) + '′</span>' : '') + (e.intensidad ? ' <span class="muted">· ' + esc(e.intensidad) + '</span>' : '') + '</div>' +
      '<div class="gol-meta">' + ((e.porteros || []).length ? esc(e.porteros.join(', ')) : '<span class="muted">Sin porteros anotados</span>') + (e.jornada ? ' · pre J' + esc(e.jornada) : '') + '</div>' +
      '<div class="gol-pie">' + (e.objetivos || []).map(function (o) { return '<span class="badge' + (o === e.principal ? ' principal' : '') + '">' + esc(o) + '</span>'; }).join('') +
        (!(e.objetivos || []).length ? '<span class="badge">Sin objetivos</span>' : '') +
        (e.adjuntos || []).map(function (a) { return '<button type="button" class="badge link adj" data-adjunto="' + esc(a.id) + '" title="Abrir">📎 ' + esc(a.nombre) + '</button>'; }).join('') + '</div>' +
      (e.contenido ? '<p class="ent-txt">' + esc(e.contenido) + '</p>' : '') + '</div>' +
    '<a class="gol-editar" href="#/ent-editar/' + encodeURIComponent(e.id) + '" aria-label="Editar">›</a></article>';
}

function filtrosHtml() {
  var ps = CFG.PORTEROS || [], act = atajoActivo();
  return '<div class="filtros">' +
    (ps.length > 1 ? A.campoSelect('f-portero', 'Portero', ps, D.filtro.portero, 'Todos los porteros') : '') +
    A.campoTexto('f-desde', 'Desde', D.filtro.desde, { tipo: 'date' }) + A.campoTexto('f-hasta', 'Hasta', D.filtro.hasta, { tipo: 'date' }) + '</div>' +
    '<div class="chips chips-ultimas">' + ATAJOS.map(function (a) { return '<button type="button" class="chip' + (act === a[0] ? ' sel' : '') + '" data-atajo="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</div>';
}

function montarFiltros(app) {
  $$('select[name^="f-"], input[name^="f-"]', app).forEach(function (s) {
    s.addEventListener('change', function () { D.filtro[s.name.replace('f-', '')] = s.value; A.pintar(); });
  });
}

function clickFiltros(e) {
  var a = e.target.closest('[data-atajo]');
  if (a) { aplicarAtajo(a.getAttribute('data-atajo')); A.pintar(); return true; }
  return false;
}

function textoRango() {
  var f = D.filtro;
  if (!f.desde && !f.hasta) return 'toda la temporada';
  return (f.desde ? 'del ' + A.fechaCorta(f.desde) : '') + (f.hasta ? ' al ' + A.fechaCorta(f.hasta) : '');
}

/* ------------------------------ Vista: lista ------------------------------ */

function abrirAdjunto(id) {
  A.almacen.video(id).then(function (r) {
    if (!r || !r.blob) { A.aviso('Ese archivo no está en este navegador (restáuralo desde la carpeta).', 'error'); return; }
    var url = URL.createObjectURL(r.blob), w = window.open(url, '_blank');
    if (!w) { var a = document.createElement('a'); a.href = url; a.download = r.nombre || 'archivo'; document.body.appendChild(a); a.click(); a.remove(); }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  });
}

function vistaLista(app) {
  app.onclick = function (e) {
    var adj = e.target.closest('[data-adjunto]');
    if (adj) { e.preventDefault(); abrirAdjunto(adj.getAttribute('data-adjunto')); return; }
    if (clickFiltros(e)) return;
    if (e.target.closest('a[href^="#/ent-editar/"]')) D.volverA = location.hash || '#/ent';
  };
  var es = filtrados(), st = estadisticas(es);
  var cob = cobertura(es).filter(function (c) { return c.n; });
  var olvidados = cobertura(D.entrenos).filter(function (c) { return c.hace == null || c.hace >= ALERTA_DIAS; }).filter(function (c) { return OBJETIVOS_BASE.indexOf(c.k) >= 0 || c.n; });
  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Entrenos</h1><div class="cab-acciones">' + (D.entrenos.length ? '<a class="btn" href="#/ent-informe">Informe</a>' : '') + '<a class="btn primary" href="#/ent-nuevo">+ Nueva sesión</a></div></div>' +
    (D.entrenos.length ? filtrosHtml() : '') +
    (!D.entrenos.length ? '<div class="vacio"><h2>Sin entrenos todavía</h2><p>Apunta cada sesión en un minuto: qué objetivos se trabajaron, con quién y cuánto. Con eso el informe te dice qué llevas tiempo sin tocar.</p><a class="btn primary grande" href="#/ent-nuevo">+ Registrar la primera</a></div>' :
      '<div class="kpis">' + A.kpi(st.n, 'Sesiones') + A.kpi(st.horas, 'Horas', st.minutos + ' min') + A.kpi(cob.length, 'Objetivos trabajados') + A.kpi(st.mediaObj, 'Objetivos por sesión') + '</div>' +
      (olvidados.length && D.entrenos.length >= 3 ? '<p class="nota alerta-ent"><strong>Hace más de ' + ALERTA_DIAS + ' días sin trabajar:</strong> ' + olvidados.map(function (c) { return esc(c.k) + (c.hace == null ? ' (nunca)' : ' (' + c.hace + ' d)'); }).join(' · ') + '</p>' : '') +
      (es.length ? es.map(tarjeta).join('') : '<p class="vacio">Nada en ese rango.</p>')) + '</div>';
  montarFiltros(app);
}

/* ------------------------------ Vista: formulario ------------------------------ */

function borradorNuevo() {
  var ultimo = D.entrenos.slice().sort(function (a, b) { return (b.creado || 0) - (a.creado || 0); })[0] || {};
  return { id: A.idNuevo(), creado: Date.now(), fecha: hoy(), tipo: 'Entreno', porteros: (ultimo.porteros || CFG.PORTEROS || []).slice(),
           duracion: ultimo.duracion || 90, intensidad: 'Media', objetivos: [], principal: '', jornada: '', contenido: '', notas: '', adjuntos: [] };
}

function htmlPrincipal(e) {
  return '<span class="et">Objetivo principal <small>(opcional)</small></span>' + ((e.objetivos || []).length ? A.chips('principal', e.objetivos, e.principal) : '<p class="nota">Marca primero los objetivos trabajados.</p>');
}

function vistaFormulario(app, id) {
  var e;
  if (id) { e = D.entrenos.filter(function (x) { return x.id === id; })[0]; if (!e) { A.navegar('#/ent'); return; } e = JSON.parse(JSON.stringify(e)); }
  else e = borradorNuevo();
  if (!e.objetivos) e.objetivos = []; if (!e.porteros) e.porteros = []; if (!e.adjuntos) e.adjuntos = [];
  D.borrador = e; D.pendientes = [];
  var volver = id ? (D.volverA || '#/ent') : '#/ent';

  app.innerHTML =
  '<form class="vista formulario" id="form-ent" autocomplete="off">' +
    '<div class="vista-cab"><h1>' + (id ? 'Editar sesión' : 'Nueva sesión') + '</h1><a class="btn" href="' + esc(volver) + '">' + (id ? '← Volver' : 'Cancelar') + '</a></div>' +
    '<section class="bloque"><h2>1 · Sesión</h2><div class="rejilla">' +
      A.campoTexto('fecha', 'Fecha', e.fecha, { tipo: 'date' }) +
      A.campoTexto('duracion', 'Duración (min)', e.duracion, { tipo: 'number', min: 0, max: 300, inputmode: 'numeric' }) +
      A.campoTexto('jornada', 'Previa a la jornada', e.jornada, { inputmode: 'numeric', placeholder: 'opcional' }) + '</div>' +
      '<div class="rejilla-chips"><div><span class="et">Tipo</span>' + A.chips('tipo', TIPOS, e.tipo) + '</div>' +
        '<div><span class="et">Intensidad</span>' + A.chips('intensidad', INTENSIDADES, e.intensidad) + '</div>' +
        '<div><span class="et">Porteros presentes <small>(varios)</small></span>' + A.chips('porteros', CFG.PORTEROS || [], e.porteros, true) + '</div></div></section>' +
    '<section class="bloque"><h2>2 · Objetivos trabajados</h2><p class="nota">Marca todos los que se trabajaron. Puedes añadir objetivos propios; se quedan guardados para las siguientes sesiones.</p>' +
      '<div id="zona-objetivos">' + A.chips('objetivos', objetivos(), e.objetivos, true) + '</div>' +
      '<div class="fila ent-nuevo-obj"><input type="text" id="in-objetivo" placeholder="Otro objetivo…" maxlength="40"><button type="button" class="btn" id="btn-objetivo">Añadir</button></div>' +
      '<div id="zona-principal" style="margin-top:14px">' + htmlPrincipal(e) + '</div></section>' +
    '<section class="bloque"><h2>3 · Contenido</h2>' +
      '<label class="campo"><span>Ejercicios / tareas</span><textarea name="contenido" rows="3" placeholder="Qué se hizo: tareas, series, situaciones…">' + esc(e.contenido || '') + '</textarea></label>' +
      '<label class="campo"><span>Observaciones de los porteros</span><textarea name="notas" rows="2" placeholder="Cómo lo hicieron, qué corregir la próxima vez…">' + esc(e.notas || '') + '</textarea></label></section>' +
    '<section class="bloque"><h2>4 · Archivos</h2><p class="nota">La ficha de la sesión en PDF, fotos de la pizarra, un vídeo… Se guardan en este navegador y, si hay carpeta enlazada, también en ella.</p>' +
      '<div id="zona-adjuntos" class="sin-video">Arrastra aquí los archivos<br><small class="muted">o</small><br><label class="btn archivo" style="margin-top:8px">Elegir archivos<input type="file" id="in-adjuntos" multiple hidden></label></div>' +
      '<ul class="adjuntos" id="lista-adjuntos"></ul></section>' +
    '<div class="acciones"><button type="submit" class="btn primary grande">Guardar sesión</button>' +
      (id ? '<a class="btn grande" href="' + esc(volver) + '">← Volver</a><button type="button" class="btn peligro" id="btn-borrar">Borrar</button>' : '') + '</div>' +
  '</form>';

  var form = $('#form-ent', app); app.onclick = null;
  form.addEventListener('input', function (ev) { var el = ev.target; if (el.name) e[el.name] = el.value; });
  form.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-chip]'); if (!b) return;
    ev.preventDefault();
    var campo = b.getAttribute('data-chip'), valor = b.getAttribute('data-valor');
    if (b.getAttribute('data-multi')) {
      var i = e[campo].indexOf(valor);
      if (i >= 0) e[campo].splice(i, 1); else e[campo].push(valor);
      $$('[data-chip="' + campo + '"]', form).forEach(function (c) { c.classList.toggle('sel', e[campo].indexOf(c.getAttribute('data-valor')) >= 0); });
      if (campo === 'objetivos') { if (e.objetivos.indexOf(e.principal) < 0) e.principal = ''; $('#zona-principal', form).innerHTML = htmlPrincipal(e); }
      return;
    }
    e[campo] = valor; A.marcarChip(form, campo, valor);
  });
  function anadirObjetivo() {
    var inp = $('#in-objetivo', form), v = (inp.value || '').trim();
    if (!v) return;
    var ya = objetivos().filter(function (o) { return o.toLowerCase() === v.toLowerCase(); })[0];
    v = ya || v;
    if (!ya) { D.extra.push(v); A.almacen.ponAjuste('objetivosExtra', D.extra); }
    if (e.objetivos.indexOf(v) < 0) e.objetivos.push(v);
    inp.value = '';
    $('#zona-objetivos', form).innerHTML = A.chips('objetivos', objetivos(), e.objetivos, true);
    $('#zona-principal', form).innerHTML = htmlPrincipal(e);
  }
  function pintarAdjuntos() {
    $('#lista-adjuntos', form).innerHTML = e.adjuntos.map(function (a) {
      return '<li><button type="button" class="adj-nombre" data-adjunto="' + esc(a.id) + '">📎 ' + esc(a.nombre) + '</button><span class="muted">' + A.megas(a.tam || 0) + ' MB</span><button type="button" class="adj-quitar" data-quitar="' + esc(a.id) + '" aria-label="Quitar">✕</button></li>';
    }).join('') + D.pendientes.map(function (f, i) {
      return '<li class="pendiente"><span class="adj-nombre">📎 ' + esc(f.name) + '</span><span class="muted">' + A.megas(f.size) + ' MB · nuevo</span><button type="button" class="adj-quitar" data-quitar-pend="' + i + '" aria-label="Quitar">✕</button></li>';
    }).join('');
  }
  function anadirArchivos(lista) {
    Array.prototype.forEach.call(lista || [], function (f) {
      if (f.size > MAX_ADJUNTO_MB * 1048576) { A.aviso('«' + f.name + '» pasa de ' + MAX_ADJUNTO_MB + ' MB.', 'error'); return; }
      D.pendientes.push(f);
    });
    pintarAdjuntos();
  }
  $('#in-adjuntos', form).addEventListener('change', function (ev) { anadirArchivos(ev.target.files); ev.target.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { form.addEventListener(ev, function (x) { x.preventDefault(); form.classList.add('arrastrando'); }); });
  form.addEventListener('dragleave', function (x) { if (!form.contains(x.relatedTarget)) form.classList.remove('arrastrando'); });
  form.addEventListener('drop', function (x) { x.preventDefault(); form.classList.remove('arrastrando'); anadirArchivos(x.dataTransfer && x.dataTransfer.files); });
  $('#lista-adjuntos', form).addEventListener('click', function (ev) {
    var q = ev.target.closest('[data-quitar]'), qp = ev.target.closest('[data-quitar-pend]'), ab = ev.target.closest('[data-adjunto]');
    if (q) { var id = q.getAttribute('data-quitar'); e.adjuntos = e.adjuntos.filter(function (a) { return a.id !== id; }); (e._borrar = e._borrar || []).push(id); pintarAdjuntos(); }
    else if (qp) { D.pendientes.splice(parseInt(qp.getAttribute('data-quitar-pend'), 10), 1); pintarAdjuntos(); }
    else if (ab) abrirAdjunto(ab.getAttribute('data-adjunto'));
  });
  pintarAdjuntos();
  $('#btn-objetivo', form).addEventListener('click', anadirObjetivo);
  $('#in-objetivo', form).addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); anadirObjetivo(); } });
  form.addEventListener('submit', function (ev) { ev.preventDefault(); guardar(e); });
  var borrar = $('#btn-borrar', form);
  if (borrar) borrar.addEventListener('click', function () {
    if (!confirm('¿Borrar esta sesión?')) return;
    A.almacen.borrarDe('entrenos', e.id).then(function () {
      if (window.CARPETA) window.CARPETA.borrarArchivos('adjuntos', (e.adjuntos || []).map(function (a) { return a.id; }));
      return Promise.all((e.adjuntos || []).map(function (a) { return A.almacen.quitaVideo(a.id); }));
    }).then(function () {
      D.entrenos = D.entrenos.filter(function (x) { return x.id !== e.id; });
      A.respaldar(null, null); A.aviso('Sesión borrada.'); A.navegar(D.volverA || '#/ent');
    });
  });
}

function guardar(e) {
  if (!e.fecha) { A.aviso('Falta la fecha.', 'error'); return; }
  if (!e.objetivos.length) { A.aviso('Marca al menos un objetivo trabajado.', 'error'); return; }
  e.duracion = e.duracion === '' || e.duracion == null ? '' : parseInt(e.duracion, 10);
  var nuevos = D.pendientes.slice(), borrar = e._borrar || []; delete e._borrar;
  var guardados = [];
  if (window.CARPETA && borrar.length) window.CARPETA.borrarArchivos('adjuntos', borrar);
  Promise.all(borrar.map(function (id) { return A.almacen.quitaVideo(id); })).then(function () {
    return nuevos.reduce(function (p, f) {
      return p.then(function () {
        var id = e.id + '-a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        return A.almacen.ponVideo(id, f, f.name).then(function () { e.adjuntos.push({ id: id, nombre: f.name, tipo: f.type || '', tam: f.size }); guardados.push({ id: id, archivo: f }); });
      });
    }, Promise.resolve());
  }).then(function () { return A.almacen.guardarEn('entrenos', e); }).then(function () {
    var i = D.entrenos.findIndex(function (x) { return x.id === e.id; });
    if (i >= 0) D.entrenos[i] = e; else D.entrenos.push(e);
    D.pendientes = [];
    A.respaldar(e, null, guardados);
    A.aviso('Sesión guardada.', 'ok');
    A.navegar(D.volverA || '#/ent');
  }).catch(function (err) { A.aviso('No se ha podido guardar: ' + (err && err.message || err), 'error'); });
}

/* ------------------------------ Informe ------------------------------ */

function tablaCobertura(es, pdf) {
  var cob = cobertura(es);
  if (!cob.length) return '';
  var ref = D.filtro.hasta || hoy();
  return '<div class="tabla-env"><table class="tabla compacta' + (pdf ? ' pdf-tabla' : '') + '"><thead><tr><th>Objetivo</th><th class="num">Sesiones</th><th class="num">% sesiones</th><th class="num">Min. aprox.</th><th>Última vez</th><th class="num">Hace</th></tr></thead><tbody>' +
    cob.map(function (c) {
      var alerta = c.hace == null || c.hace >= ALERTA_DIAS;
      return '<tr' + (!c.n ? ' class="apagada"' : '') + '><td>' + esc(c.k) + '</td><td class="num">' + c.n + '</td><td class="num">' + (es.length ? c.pct + '%' : '—') + '</td><td class="num">' + (c.minutos || '') + '</td>' +
        '<td>' + (c.ultima ? esc(A.fechaCorta(c.ultima)) : '—') + '</td><td class="num' + (alerta ? ' ent-alerta' : '') + '">' + (c.hace == null ? 'nunca' : c.hace + ' d') + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="nota">«Hace» se cuenta hasta ' + (D.filtro.hasta ? 'el ' + A.fechaCorta(ref) : 'hoy') + '. En rojo, más de ' + ALERTA_DIAS + ' días.</p>';
}

function tablaMeses(es, pdf) {
  var mx = matrizMeses(es);
  if (mx.meses.length < 2 || !mx.filas.length) return '';
  var max = 1; mx.filas.forEach(function (f) { f.v.forEach(function (v) { if (v > max) max = v; }); });
  return '<h2 class="sub-tit">Objetivos por mes</h2><div class="tabla-env"><table class="tabla compacta' + (pdf ? ' pdf-tabla' : '') + '"><thead><tr><th>Objetivo</th>' +
    mx.meses.map(function (m) { return '<th class="num">' + esc(nombreMes(m)) + '</th>'; }).join('') + '<th class="num">Total</th></tr></thead><tbody>' +
    mx.filas.map(function (f) {
      return '<tr><td>' + esc(f.k) + '</td>' + f.v.map(function (v) { return '<td class="num ent-celda" style="--i:' + (v / max) + '">' + (v || '') + '</td>'; }).join('') + '<td class="num"><strong>' + f.n + '</strong></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function listaSesiones(es, pdf) {
  return '<h2 class="sub-tit">Sesiones</h2><div class="tabla-env"><table class="tabla compacta' + (pdf ? ' pdf-tabla' : '') + '"><thead><tr><th>Fecha</th><th>Tipo</th><th class="num">Min</th><th>Int.</th><th>Porteros</th><th>Objetivos</th>' + (pdf ? '<th>Contenido</th>' : '') + '</tr></thead><tbody>' +
    es.map(function (e) {
      return '<tr' + (pdf ? '' : ' data-id="' + esc(e.id) + '"') + '><td>' + esc(A.fechaCorta(e.fecha)) + '</td><td>' + esc(e.tipo || '') + '</td><td class="num">' + (e.duracion || '') + '</td><td>' + esc(e.intensidad || '') + '</td>' +
        '<td>' + esc((e.porteros || []).map(function (p) { return p.split(' ')[0]; }).join(', ')) + '</td>' +
        '<td>' + (e.objetivos || []).map(function (o) { return o === e.principal ? '<strong>' + esc(o) + '</strong>' : esc(o); }).join(', ') + '</td>' +
        (pdf ? '<td class="ent-cont">' + esc(e.contenido || '') + '</td>' : '') + '</tr>';
    }).join('') + '</tbody></table></div>';
}

function cuerpoInforme(es, pdf) {
  var st = estadisticas(es), cob = cobertura(es), sem = porSemana(es);
  var cTipo = A.contar(es, function (e) { return e.tipo || 'Entreno'; });
  var cInt = A.contar(es.filter(function (e) { return e.intensidad; }), function (e) { return e.intensidad; });
  var cObj = {}; cob.forEach(function (c) { if (c.n) cObj[c.k] = c.n; });
  var k = pdf ? 'pdf-kpis' : 'kpis';
  return '<section class="' + k + '">' + A.kpi(st.n, 'Sesiones') + A.kpi(st.horas, 'Horas', st.minutos + ' min') + A.kpi(cob.filter(function (c) { return c.n; }).length, 'Objetivos trabajados', 'de ' + cob.length) +
      A.kpi(st.mediaObj, 'Objetivos por sesión') + A.kpi(cob.filter(function (c) { return c.hace == null || c.hace >= ALERTA_DIAS; }).length, 'Sin trabajar +' + ALERTA_DIAS + ' días') + '</section>' +
    '<div class="' + (pdf ? 'pdf-fila' : 'tablas') + '">' +
      '<div class="' + (pdf ? 'pdf-bloque' : '') + '">' + A.barras('Veces trabajado cada objetivo', cObj, null, st.n) + '</div>' +
      '<div class="' + (pdf ? 'pdf-bloque' : '') + '">' + (A.barras('Tipo de sesión', cTipo, TIPOS, st.n) || '') + (A.barras('Intensidad', cInt, INTENSIDADES, st.n) || '') + '</div></div>' +
    (sem.cats.length > 1 ? '<div class="' + (pdf ? 'pdf-bloque pdf-ancho' : 'tarjeta-graf ancha') + '"><h3>Sesiones por semana</h3>' + A.svgColumnas(sem.cats, sem.series, { titulo: 'Sesiones por semana', alto: 240 }) + '</div>' : '') +
    '<h2 class="sub-tit">Cobertura de objetivos</h2>' + tablaCobertura(es, pdf) +
    tablaMeses(es, pdf) +
    listaSesiones(es, pdf);
}

function vistaInforme(app) {
  app.onclick = function (e) {
    if (clickFiltros(e)) return;
    var tr = e.target.closest('tr[data-id]');
    if (tr) { D.volverA = '#/ent-informe'; A.navegar('#/ent-editar/' + encodeURIComponent(tr.getAttribute('data-id'))); }
  };
  var es = filtrados();
  app.innerHTML = '<div class="vista"><div class="vista-cab"><h1>Informe · Entrenos</h1><div class="cab-acciones">' + (es.length ? '<a class="btn primary" href="#/ent-pdf">PDF</a>' : '') + '<a class="btn" href="#/ent">← Entrenos</a></div></div>' +
    (D.entrenos.length ? filtrosHtml() : '') +
    (!es.length ? '<p class="vacio">Sin sesiones en ese rango.</p>' : cuerpoInforme(es.slice().reverse(), false)) + '</div>';
  montarFiltros(app);
}

function vistaPDF(app) {
  app.onclick = function (e) { clickFiltros(e); };
  var es = filtrados().slice().reverse(), st = estadisticas(es);
  var fechas = es.map(function (e) { return e.fecha; }).filter(Boolean).sort();
  var portero = D.filtro.portero;
  app.innerHTML = '<div class="pdf-controles no-print"><a class="btn" href="#/ent-informe">← Volver</a><button type="button" class="btn primary grande" id="btn-imprimir">Guardar como PDF</button>' +
      '<p class="nota">Acota las fechas antes de imprimir: el PDF solo incluye las sesiones del rango. Se abre el diálogo de impresión del navegador: elige «Guardar como PDF».</p>' +
      filtrosHtml() + '</div>' +
    '<div class="pdf"><header class="pdf-cab"><div class="pdf-foto">' + (portero ? A.avatarPortero(portero) : A.escudoPropio ? A.escudoPropio() : '') + '</div>' +
      '<div class="pdf-tit"><div class="pdf-sobre">Diario de entrenamientos</div><h1>' + esc(portero || 'Porteros') + '</h1>' +
      '<div class="pdf-sub">' + esc((CFG.EQUIPOS || [])[0] || '') + ' · ' + esc(textoRango()) + (fechas.length ? ' · ' + A.fechaCorta(fechas[0]) + ' – ' + A.fechaCorta(fechas[fechas.length - 1]) : '') +
      ' · ' + st.n + ' sesion' + (st.n === 1 ? '' : 'es') + '</div></div></header>' +
    (st.n ? cuerpoInforme(es, true) : '<p class="vacio">Sin sesiones.</p>') +
    '<section class="pdf-bloque pdf-ancho"><h3>Planificación / conclusiones</h3><div class="pdf-lineas"><span></span><span></span><span></span></div></section>' +
    '<footer class="pdf-pie">' + esc(CFG.MARCA || '') + ' · generado el ' + new Date().toLocaleDateString('es-ES') + '</footer></div>';
  montarFiltros(app);
  $('#btn-imprimir', app).addEventListener('click', function () { window.print(); });
}

/* ------------------------------ Excel y copia ------------------------------ */

function hojasExcel() {
  if (!D.entrenos.length) return [];
  var objs = objetivos();
  var cab = ['ID', 'FECHA', 'TIPO', 'DURACION (MIN)', 'INTENSIDAD', 'PORTEROS', 'PREVIA JORNADA', 'OBJETIVO PRINCIPAL', 'OBJETIVOS'].concat(objs).concat(['EJERCICIOS', 'OBSERVACIONES', 'ARCHIVOS', 'ID APP']);
  var filas = [cab].concat(D.entrenos.slice().sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); }).map(function (e, i) {
    return [i + 1, e.fecha || '', e.tipo || '', e.duracion === '' ? '' : (parseInt(e.duracion, 10) || ''), e.intensidad || '', (e.porteros || []).join('; '), e.jornada ? parseInt(e.jornada, 10) || e.jornada : '', e.principal || '', (e.objetivos || []).join('; ')]
      .concat(objs.map(function (o) { return (e.objetivos || []).indexOf(o) >= 0 ? 1 : ''; })).concat([e.contenido || '', e.notas || '', (e.adjuntos || []).map(function (a) { return a.nombre; }).join('; '), e.id]);
  }));
  var cob = cobertura(D.entrenos);
  var res = [[{ v: 'ENTRENOS · COBERTURA DE OBJETIVOS', estilo: 2 }], [], [{ v: 'OBJETIVO', estilo: 1 }, { v: 'SESIONES', estilo: 1 }, { v: '% SESIONES', estilo: 1 }, { v: 'MIN. APROX.', estilo: 1 }, { v: 'ULTIMA VEZ', estilo: 1 }, { v: 'HACE (DIAS)', estilo: 1 }]];
  cob.forEach(function (c) { res.push([c.k, c.n, c.pct, c.minutos, c.ultima, c.hace == null ? '' : c.hace]); });
  var n = cob.length;
  return [{ nombre: 'ENTRENOS', filas: filas, congelar: 1, filtro: true, anchos: [5, 11, 20, 9, 11, 36, 9, 22, 48].concat(objs.map(function () { return 6; })).concat([50, 50, 30, 14]) },
          { nombre: 'ENTRENOS RESUMEN', filas: res, cabecera: false, anchos: [30, 10, 11, 11, 12, 11],
            graficos: n ? [{ tipo: 'barras', titulo: 'Veces trabajado cada objetivo', hoja: 'ENTRENOS RESUMEN', serie: 'Sesiones', cats: 'A4:A' + (3 + n), vals: 'B4:B' + (3 + n), desde: { col: 7, fila: 2 }, hasta: { col: 15, fila: Math.max(14, n + 6) }, nPuntos: n }] : [] }];
}

function datosCopia() { return { entrenos: D.entrenos, objetivosExtra: D.extra }; }
function restaurarCopia(datos) {
  var ps = (datos.entrenos || []).filter(function (e) { return e && e.id; }).map(function (e) { return A.almacen.guardarEn('entrenos', e); });
  if (Array.isArray(datos.objetivosExtra)) {
    datos.objetivosExtra.forEach(function (o) { if (D.extra.indexOf(o) < 0) D.extra.push(o); });
    ps.push(A.almacen.ponAjuste('objetivosExtra', D.extra));
  }
  return Promise.all(ps).then(cargar);
}

/* ------------------------------ Router ------------------------------ */

function pestanas() {
  return [
    ['#/ent', 'ent', 'Entrenos', '<path d="M4 6.5h16v13H4z"/><path d="M4 11h16M8 4v4M16 4v4"/><path d="m8.5 15 2 2 4-4"/>'],
    ['#/ent-nuevo', 'ent-nuevo', 'Nueva sesión', '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>'],
    ['#/ent-informe', 'ent-informe', 'Informe', '<path d="M4 19.5V10M10 19.5V5M16 19.5v-6M21 19.5h-18"/>'],
    ['#/exportar', 'exportar', 'Exportar', '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16.5v3h16v-3"/>']
  ];
}
function pestanaActiva(r) { return r.vista === 'ent-editar' ? 'ent-nuevo' : r.vista === 'ent-pdf' ? 'ent-informe' : r.vista; }
function pintar(app, r) {
  if (r.vista === 'ent-nuevo') vistaFormulario(app, null);
  else if (r.vista === 'ent-editar') vistaFormulario(app, r.id);
  else if (r.vista === 'ent-informe') vistaInforme(app);
  else if (r.vista === 'ent-pdf') vistaPDF(app);
  else vistaLista(app);
  document.body.classList.toggle('imprimiendo', r.vista === 'ent-pdf');
}

return { cargar: cargar, pintar: pintar, pestanas: pestanas, pestanaActiva: pestanaActiva, hojasExcel: hojasExcel,
         cuenta: function () { return D.entrenos.length; }, datosCopia: datosCopia, restaurarCopia: restaurarCopia, _D: D };
})();
