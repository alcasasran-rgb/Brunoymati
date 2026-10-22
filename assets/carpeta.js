/* =====================================================================
   Carpeta del ordenador — copia automática en una carpeta local.
   El usuario elige una carpeta una vez (Chrome / Edge de escritorio) y la
   app escribe ahí, cada vez que guarda algo, la copia completa
   (copia-goles.json), el Excel y los clips de vídeo (clips/). Si el
   navegador pierde los datos o se cambia de ordenador, «Restaurar desde
   la carpeta» lo recupera todo, vídeos incluidos.
   ===================================================================== */
window.CARPETA = (function () {
'use strict';

var A = window.APP;
var soporta = typeof window.showDirectoryPicker === 'function';

var E = { handle: null, estado: soporta ? 'sin-carpeta' : 'no-soportado',  /* no-soportado | sin-carpeta | permiso | conectada */
          ultima: null, ocupado: false, pendiente: false, error: '' };

function guardarEstado() { return A.almacen.ponAjuste('carpeta', { handle: E.handle, ultima: E.ultima }); }

function cargar() {
  if (!soporta) return Promise.resolve();
  return A.almacen.ajuste('carpeta').then(function (c) {
    if (!c || !c.handle) { E.estado = 'sin-carpeta'; return; }
    E.handle = c.handle; E.ultima = c.ultima || null;
    return E.handle.queryPermission({ mode: 'readwrite' }).then(function (p) {
      E.estado = p === 'granted' ? 'conectada' : 'permiso';
    }).catch(function () { E.estado = 'permiso'; });
  }).catch(function () {});
}

function elegir() {
  return window.showDirectoryPicker({ mode: 'readwrite', id: 'goles-encajados', startIn: 'documents' }).then(function (h) {
    E.handle = h; E.estado = 'conectada'; E.error = '';
    return guardarEstado();
  }).then(function () { A.pintar(); return fusionar(); })
    .then(function (r) {
      /* Primero se incorpora lo que ya hubiera en la carpeta (sin borrar
         nada) y solo después se escribe: así nunca se pisa una copia buena. */
      A.aviso('Carpeta «' + E.handle.name + '» enlazada.' + (r && r.n ? ' Recuperados ' + r.n + ' registro' + (r.n === 1 ? '' : 's') + (r.clips ? ' y ' + r.clips + ' archivo' + (r.clips === 1 ? '' : 's') : '') + ' que ya había en ella.' : ' Guardando la copia…'), 'ok');
      return guardarTodo('manual');
    })
    .catch(function (e) { if (e && e.name !== 'AbortError') A.aviso('No se pudo elegir la carpeta: ' + e.message, 'error'); });
}

function reconectar() {
  if (!E.handle) return Promise.resolve(false);
  return E.handle.requestPermission({ mode: 'readwrite' }).then(function (p) {
    if (p !== 'granted') { A.aviso('Sin permiso sobre la carpeta.', 'error'); return false; }
    E.estado = 'conectada'; E.error = ''; A.pintar();
    return guardarTodo('manual').then(function () { return true; });
  }).catch(function (e) { A.aviso('No se pudo acceder a la carpeta: ' + e.message, 'error'); return false; });
}

function quitar() {
  E.handle = null; E.estado = 'sin-carpeta'; E.ultima = null;
  return A.almacen.ponAjuste('carpeta', null).then(function () { A.aviso('Carpeta desenlazada. Los datos siguen en la app y en la carpeta.', ''); A.pintar(); });
}

/* ------------------------------ Escritura ------------------------------ */

function escribir(dir, nombre, blob) {
  return dir.getFileHandle(nombre, { create: true }).then(function (fh) {
    return fh.createWritable().then(function (w) { return w.write(blob).then(function () { return w.close(); }); });
  });
}

function guardarClip(reg, archivo) {
  if (E.estado !== 'conectada' || !archivo || !reg) return Promise.resolve(false);
  return E.handle.getDirectoryHandle('clips', { create: true }).then(function (d) {
    return escribir(d, reg.id + '__' + archivo.name.replace(/[\\/:*?"<>|]/g, '_'), archivo);
  }).then(function () { return true; }).catch(function (e) { A.aviso('No se pudo copiar el clip a la carpeta: ' + e.message, 'error'); return false; });
}

/* Archivos adjuntos de una sesión de entreno: adjuntos/<id>__<nombre>. */
function guardarAdjuntos(lista) {
  if (E.estado !== 'conectada' || !lista || !lista.length) return Promise.resolve(false);
  return E.handle.getDirectoryHandle('adjuntos', { create: true }).then(function (d) {
    return lista.reduce(function (p, a) { return p.then(function () { return escribir(d, a.id + '__' + a.archivo.name.replace(/[\\/:*?"<>|]/g, '_'), a.archivo); }); }, Promise.resolve());
  }).then(function () { return true; }).catch(function (e) { A.aviso('No se pudo copiar el archivo a la carpeta: ' + e.message, 'error'); return false; });
}

/* Quita de la carpeta los archivos (clips o adjuntos) cuyo id empiece por
   alguno de los dados. Silencioso: si no están, no pasa nada. */
function borrarArchivos(sub, ids) {
  if (E.estado !== 'conectada' || !ids || !ids.length) return Promise.resolve();
  return listarDir(sub).then(function (archivos) {
    return E.handle.getDirectoryHandle(sub).then(function (d) {
      return Promise.all(ids.filter(function (id) { return archivos[id]; }).map(function (id) { return d.removeEntry(archivos[id].name).catch(function () {}); }));
    });
  }).catch(function () {});
}

/* Copia completa + Excel. Agrupa peticiones seguidas en una sola escritura. */
function guardarTodo(motivo) {
  if (E.estado !== 'conectada') return Promise.resolve(false);
  if (E.ocupado) { E.pendiente = true; return Promise.resolve(false); }
  E.ocupado = true; E.error = '';
  pintarEstado('Guardando en la carpeta…');
  var tareas = [escribir(E.handle, 'copia-goles.json', new Blob([A.copiaJSON()], { type: 'application/json' }))];
  try { tareas.push(escribir(E.handle, A.CFG.NOMBRE_EXCEL || 'goles-encajados.xlsx', A.construirExcel())); } catch (e) { /* sin datos para el Excel */ }
  return Promise.all(tareas).then(function () {
    E.ultima = new Date().toISOString(); E.ocupado = false;
    return guardarEstado();
  }).then(function () {
    pintarEstado('Copia en la carpeta actualizada.');
    if (E.pendiente) { E.pendiente = false; return guardarTodo(motivo); }
    return true;
  }).catch(function (e) {
    E.ocupado = false; E.error = e.message || String(e);
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) E.estado = 'permiso';
    pintarEstado('Carpeta: ' + E.error, 'error');
    return false;
  });
}

/* ------------------------------ Restaurar ------------------------------ */

function leerJSON() {
  return E.handle.getFileHandle('copia-goles.json').then(function (fh) { return fh.getFile(); }).then(function (f) { return f.text(); }).then(function (t) { return JSON.parse(t); });
}

/* Los clips se guardan como «<id>__<nombre>»: se vuelven a enlazar por id
   con el gol, remate o penalti al que pertenecen. */
function restaurarClips() {
  return E.handle.getDirectoryHandle('clips').then(function (d) {
    var archivos = {};
    var it = d.values();
    function paso() {
      return it.next().then(function (r) {
        if (r.done) return archivos;
        var h = r.value, i = h.name.indexOf('__');
        if (h.kind === 'file' && i > 0) archivos[h.name.slice(0, i)] = h;
        return paso();
      });
    }
    return paso();
  }).catch(function () { return {}; }).then(function (archivos) {
    var ids = Object.keys(archivos);
    if (!ids.length) return 0;
    var n = 0;
    return ['goles', 'finalizaciones', 'penaltis'].reduce(function (p, st) {
      return p.then(function () { return A.almacen.todosDe(st); }).then(function (regs) {
        return (regs || []).reduce(function (q, reg) {
          if (!archivos[reg.id] || reg.videoId) return q;
          return q.then(function () { return archivos[reg.id].getFile(); }).then(function (f) {
            var nombre = archivos[reg.id].name.slice(reg.id.length + 2);
            return A.almacen.ponVideo(reg.id, f, nombre).then(function () { reg.videoId = reg.id; reg.videoNombre = reg.videoNombre || nombre; reg.videoTam = f.size; return A.almacen.guardarEn(st, reg); }).then(function () { n++; });
          }).catch(function () {});
        }, Promise.resolve());
      });
    }, Promise.resolve()).then(function () { return n; });
  }).then(function (n) { return restaurarAdjuntos().then(function (m) { return n + m; }); });
}

function listarDir(nombre) {
  return E.handle.getDirectoryHandle(nombre).then(function (d) {
    var archivos = {}, it = d.values();
    function paso() {
      return it.next().then(function (r) {
        if (r.done) return archivos;
        var h = r.value, i = h.name.indexOf('__');
        if (h.kind === 'file' && i > 0) archivos[h.name.slice(0, i)] = h;
        return paso();
      });
    }
    return paso();
  }).catch(function () { return {}; });
}

function restaurarAdjuntos() {
  return listarDir('adjuntos').then(function (archivos) {
    if (!Object.keys(archivos).length) return 0;
    var n = 0;
    return A.almacen.todosDe('entrenos').then(function (es) {
      return (es || []).reduce(function (p, e) {
        return (e.adjuntos || []).reduce(function (q, a) {
          if (!archivos[a.id]) return q;
          return q.then(function () { return A.almacen.video(a.id); }).then(function (r) {
            if (r && r.blob) return;
            return archivos[a.id].getFile().then(function (f) { return A.almacen.ponVideo(a.id, f, a.nombre || f.name); }).then(function () { n++; });
          }).catch(function () {});
        }, p);
      }, Promise.resolve());
    }).then(function () { return n; });
  });
}

/* Mezcla en la app lo que haya en la carpeta (por id, sin borrar nada).
   Devuelve { n: registros leídos, clips: vídeos reenlazados }, o null si
   la carpeta no tiene copia. */
function fusionar() {
  var n = 0;
  return leerJSON().then(function (datos) {
    ['goles', 'finalizaciones', 'penaltis', 'entrenos'].forEach(function (k) { n += (datos[k] || []).length; });
    return A.importarCopia(datos);
  }).then(restaurarClips).then(function (clips) {
    return A.recargarTodo().then(function () { A.pintar(); return { n: n, clips: clips }; });
  }).catch(function (e) { if (e && e.name === 'NotFoundError') return null; throw e; });
}

function restaurar() {
  if (E.estado !== 'conectada') return Promise.resolve();
  if (!confirm('Se añadirán a la app los datos guardados en la carpeta «' + E.handle.name + '» (sin borrar lo que ya hay). ¿Continuar?')) return Promise.resolve();
  A.aviso('Leyendo la carpeta…');
  return fusionar().then(function (r) {
    if (!r) { A.aviso('En esa carpeta no hay ninguna copia (copia-goles.json).', 'error'); return; }
    A.aviso('Restaurado desde la carpeta: ' + r.n + ' registro' + (r.n === 1 ? '' : 's') + (r.clips ? ' y ' + r.clips + ' archivo' + (r.clips === 1 ? '' : 's') + ' (clips y adjuntos)' : '') + '.', 'ok');
  }).catch(function (e) { A.aviso('No se pudo restaurar: ' + (e && e.message || e), 'error'); });
}

/* ------------------------------ Interfaz ------------------------------ */

function pintarEstado(texto, tipo) {
  var el = document.getElementById('carpeta-estado');
  if (el) el.innerHTML = htmlEstado(texto, tipo);
  else if (tipo === 'error') A.aviso(texto, 'error');
}

function htmlEstado(texto, tipo) {
  if (E.estado === 'no-soportado') return '<p class="nota">Este navegador no permite guardar en una carpeta. Abre la app en <strong>Chrome o Edge de ordenador</strong> para activarlo.</p>';
  if (E.estado === 'sin-carpeta') return '<p class="nota">Elige una carpeta de este ordenador (por ejemplo <strong>Documentos › Goles encajados</strong>) y la app guardará ahí sola, cada vez que registres algo, la copia completa, el Excel y los clips. Si la carpeta está dentro de OneDrive, Google Drive o Dropbox, además la tendrás en la nube.</p>';
  if (E.estado === 'permiso') return '<p class="nota">Carpeta enlazada: <strong>' + A.esc(E.handle.name) + '</strong>. El navegador pide confirmar el permiso en cada sesión nueva: pulsa <strong>Reconectar</strong> para seguir guardando ahí.</p>';
  return '<p class="nota ok">Guardando en <strong>' + A.esc(E.handle.name) + '</strong>' + (E.ultima ? ' · última copia ' + new Date(E.ultima).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '.' +
    (texto ? ' <span class="' + (tipo === 'error' ? 'ent-alerta' : 'muted') + '">' + A.esc(texto) + '</span>' : '') + '</p>';
}

function htmlSeccion() {
  var c = E.estado === 'conectada';
  return '<section class="bloque"><h2>Carpeta en este ordenador</h2><div id="carpeta-estado">' + htmlEstado() + '</div>' +
    (E.estado === 'no-soportado' ? '' :
      '<div class="acciones">' +
        (E.estado === 'permiso' ? '<button type="button" class="btn primary grande" id="carpeta-reconectar">Reconectar</button>' : '') +
        (E.estado === 'sin-carpeta' ? '<button type="button" class="btn primary grande" id="carpeta-elegir">Elegir carpeta…</button>' : '') +
        (c ? '<button type="button" class="btn primary" id="carpeta-guardar">Guardar ahora</button><button type="button" class="btn" id="carpeta-restaurar">Restaurar desde la carpeta</button>' : '') +
        (E.handle ? '<button type="button" class="btn" id="carpeta-cambiar">Cambiar carpeta…</button><button type="button" class="btn" id="carpeta-quitar">Desenlazar</button>' : '') +
      '</div>' +
      (c ? '<p class="nota">En la carpeta: <strong>copia-goles.json</strong> (todo lo registrado), el Excel, <strong>clips/</strong> con los vídeos y <strong>adjuntos/</strong> con los archivos de los entrenos. Para pasar a otro ordenador, copia la carpeta y usa «Restaurar desde la carpeta».</p>' : '')) +
    '</section>';
}

function montar(app) {
  var on = function (id, fn) { var b = app.querySelector('#' + id); if (b) b.addEventListener('click', fn); };
  on('carpeta-elegir', elegir); on('carpeta-cambiar', elegir); on('carpeta-reconectar', reconectar);
  on('carpeta-guardar', function () { guardarTodo('manual'); }); on('carpeta-restaurar', restaurar); on('carpeta-quitar', quitar);
}

/* Aviso al arrancar si hay carpeta pero el navegador pide permiso de nuevo. */
function avisoArranque() {
  if (E.estado !== 'permiso') return;
  var b = document.getElementById('banner'); if (!b) return;
  b.className = 'banner'; b.hidden = false;
  b.innerHTML = 'Copia en la carpeta «' + A.esc(E.handle.name) + '»: <button type="button" class="btn-banner" id="banner-reconectar">Reconectar</button>';
  var bt = document.getElementById('banner-reconectar');
  if (bt) bt.addEventListener('click', function () { reconectar().then(function (ok) { if (ok) { b.hidden = true; A.aviso('Carpeta reconectada.', 'ok'); } }); });
}

return { cargar: cargar, elegir: elegir, reconectar: reconectar, quitar: quitar, guardarTodo: guardarTodo, guardarClip: guardarClip, guardarAdjuntos: guardarAdjuntos, borrarArchivos: borrarArchivos, restaurar: restaurar,
         htmlSeccion: htmlSeccion, montar: montar, avisoArranque: avisoArranque, estado: function () { return E.estado; }, _E: E };
})();
