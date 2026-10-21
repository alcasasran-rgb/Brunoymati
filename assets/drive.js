/* =====================================================================
   Google Drive — copia de seguridad automática en la cuenta del usuario.
   Usa Google Identity Services (token en el navegador) y la API REST de
   Drive con el permiso «drive.file»: la app solo ve los archivos que ella
   misma crea, dentro de una carpeta «Goles encajados».
   Necesita CONFIG.GOOGLE_CLIENT_ID (ver README).
   ===================================================================== */
window.DRIVE = (function () {
'use strict';

var A = window.APP;
var SCOPE = 'https://www.googleapis.com/auth/drive.file';
var API = 'https://www.googleapis.com/drive/v3';
var UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
var CARPETA = 'Goles encajados';

var E = {
  token: null, caduca: 0, cliente: null,
  correo: '', carpetaId: '', ids: {},     /* nombre de archivo → id en Drive */
  ultima: null, estado: 'sin-configurar',  /* sin-configurar | desconectado | conectado | error */
  error: '', ocupado: false, pendiente: false, auto: true
};

function clientId() { return (A.CFG.GOOGLE_CLIENT_ID || '').trim(); }

/* ------------------------------ Sesión ------------------------------ */

function cargarGIS() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.defer = true;
    s.onload = res; s.onerror = function () { rej(new Error('No se pudo cargar Google (¿sin conexión?)')); };
    document.head.appendChild(s);
  });
}

function pedirToken(interactivo) {
  return cargarGIS().then(function () {
    return new Promise(function (res, rej) {
      if (!E.cliente) {
        E.cliente = google.accounts.oauth2.initTokenClient({
          client_id: clientId(), scope: SCOPE,
          callback: function (r) {
            if (r && r.access_token) {
              E.token = r.access_token; E.caduca = Date.now() + (parseInt(r.expires_in, 10) || 3600) * 1000 - 60000;
              E._res && E._res();
            } else { E._rej && E._rej(new Error((r && r.error) || 'sin token')); }
          },
          error_callback: function (e) { E._rej && E._rej(new Error(e && e.type === 'popup_closed' ? 'Ventana cerrada' : (e && e.message) || 'error')); }
        });
      }
      E._res = res; E._rej = rej;
      E.cliente.requestAccessToken({ prompt: interactivo ? 'consent' : '' });
    });
  });
}

function tokenValido() {
  if (E.token && Date.now() < E.caduca) return Promise.resolve(E.token);
  return pedirToken(false).then(function () { return E.token; });
}

function llamar(url, opts) {
  opts = opts || {};
  return tokenValido().then(function (t) {
    var h = opts.headers || {}; h.Authorization = 'Bearer ' + t;
    return fetch(url, { method: opts.method || 'GET', headers: h, body: opts.body });
  }).then(function (r) {
    if (r.status === 401) { E.token = null; throw new Error('Sesión de Google caducada: vuelve a conectar.'); }
    if (!r.ok) return r.text().then(function (t) { throw new Error('Drive ' + r.status + ': ' + t.slice(0, 200)); });
    return opts.crudo ? r : (r.status === 204 ? null : r.json());
  });
}

function conectar() {
  if (!clientId()) { E.estado = 'sin-configurar'; return Promise.reject(new Error('Falta GOOGLE_CLIENT_ID en config.js')); }
  return pedirToken(true).then(function () {
    return llamar(API + '/about?fields=user(emailAddress)');
  }).then(function (d) {
    E.correo = d && d.user ? d.user.emailAddress : '';
    E.estado = 'conectado'; E.error = '';
    return A.almacen.ponAjuste('drive', { conectado: true, correo: E.correo, auto: E.auto, ids: E.ids, carpetaId: E.carpetaId, ultima: E.ultima });
  }).then(function () { return carpeta(); });
}

function desconectar() {
  if (E.token && window.google && google.accounts) { try { google.accounts.oauth2.revoke(E.token, function () {}); } catch (e) {} }
  E.token = null; E.correo = ''; E.estado = clientId() ? 'desconectado' : 'sin-configurar';
  return A.almacen.ponAjuste('drive', { conectado: false });
}

function guardarEstado() {
  return A.almacen.ponAjuste('drive', { conectado: E.estado === 'conectado', correo: E.correo, auto: E.auto, ids: E.ids, carpetaId: E.carpetaId, ultima: E.ultima });
}

/* Al arrancar: si estaba conectado, intenta renovar el token sin preguntar. */
function cargar() {
  return A.almacen.ajuste('drive').then(function (d) {
    d = d || {};
    E.auto = d.auto !== false; E.ids = d.ids || {}; E.carpetaId = d.carpetaId || ''; E.ultima = d.ultima || null; E.correo = d.correo || '';
    if (!clientId()) { E.estado = 'sin-configurar'; return; }
    if (!d.conectado) { E.estado = 'desconectado'; return; }
    E.estado = 'conectado';
    return pedirToken(false).catch(function () { E.estado = 'reconectar'; });
  });
}

/* ------------------------------ Archivos ------------------------------ */

function q(s) { return encodeURIComponent(s); }

function carpeta() {
  if (E.carpetaId) return Promise.resolve(E.carpetaId);
  if (E._carpetaP) return E._carpetaP;
  E._carpetaP = llamar(API + '/files?q=' + q("name='" + CARPETA + "' and mimeType='application/vnd.google-apps.folder' and trashed=false") + '&fields=files(id)')
    .then(function (d) {
      if (d.files && d.files.length) return d.files[0].id;
      return llamar(API + '/files', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: CARPETA, mimeType: 'application/vnd.google-apps.folder' }) }).then(function (f) { return f.id; });
    }).then(function (id) { E.carpetaId = id; E._carpetaP = null; return guardarEstado().then(function () { return id; }); })
    .catch(function (e) { E._carpetaP = null; throw e; });
  return E._carpetaP;
}

function buscar(nombre, padre) {
  return llamar(API + '/files?q=' + q("name='" + nombre.replace(/'/g, "\\'") + "' and '" + padre + "' in parents and trashed=false") + '&fields=files(id,modifiedTime)')
    .then(function (d) { return d.files && d.files[0] ? d.files[0] : null; });
}

/* Crea o sustituye un archivo por nombre dentro de la carpeta. Para
   archivos grandes (vídeos) usa subida reanudable. */
function subir(nombre, blob, mime, padre) {
  var padreP = padre ? Promise.resolve(padre) : carpeta();
  return padreP.then(function (p) {
    var conocido = E.ids[nombre] ? Promise.resolve({ id: E.ids[nombre] }) : buscar(nombre, p);
    return conocido.then(function (f) {
      var meta = f ? {} : { name: nombre, parents: [p] };
      var url = f ? UPLOAD + '/files/' + f.id + '?uploadType=resumable' : UPLOAD + '/files?uploadType=resumable';
      return llamar(url, { method: f ? 'PATCH' : 'POST', crudo: true,
        headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(blob.size) },
        body: JSON.stringify(meta) }).then(function (r) {
        var sesion = r.headers.get('Location');
        if (!sesion) throw new Error('Drive no devolvió sesión de subida');
        return fetch(sesion, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob });
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error('Subida ' + r.status + ': ' + t.slice(0, 200)); });
        return r.json();
      }).then(function (res) {
        if (res && res.id && !/^clips\//.test(nombre)) { E.ids[nombre] = res.id; }
        return res;
      });
    });
  });
}

function subcarpetaClips() {
  if (E.ids['__clips__']) return Promise.resolve(E.ids['__clips__']);
  if (E._clipsP) return E._clipsP;
  E._clipsP = carpeta().then(function (p) {
    return buscar('clips', p).then(function (f) {
      if (f) return f.id;
      return llamar(API + '/files', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'clips', mimeType: 'application/vnd.google-apps.folder', parents: [p] }) }).then(function (c) { return c.id; });
    });
  }).then(function (id) { E.ids['__clips__'] = id; E._clipsP = null; return id; })
    .catch(function (e) { E._clipsP = null; throw e; });
  return E._clipsP;
}

/* ------------------------------ Sincronización ------------------------------ */

function nombreClip(reg, archivo) {
  var ext = (archivo.name.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0];
  var partes = [reg.fecha || '', reg.jornada ? 'J' + reg.jornada : '', reg.rival || reg.equipo || '', reg.minuto != null && reg.minuto !== '' ? reg.minuto + 'min' : ''].filter(Boolean);
  return A.slug(partes.join(' ')) + '-' + reg.id.slice(-5) + ext;
}

/* Sube el clip de un registro recién guardado. Devuelve el id de Drive. */
function subirClip(reg, archivo) {
  if (E.estado !== 'conectado' || !archivo) return Promise.resolve(null);
  return subcarpetaClips().then(function (c) { return subir(nombreClip(reg, archivo), archivo, archivo.type || 'video/mp4', c); })
    .then(function (res) { return res && res.id ? res.id : null; });
}

/* Copia completa (json) + Excel. Se agrupa: si llegan varias peticiones
   seguidas, solo se sube una vez. */
function sincronizar(motivo) {
  if (E.estado !== 'conectado' || !E.auto && motivo !== 'manual') return Promise.resolve(false);
  if (E.ocupado) { E.pendiente = true; return Promise.resolve(false); }
  E.ocupado = true; E.error = '';
  pintarEstado('Subiendo a Google Drive…');
  var json = A.copiaJSON();
  var tareas = [subir('copia-goles.json', new Blob([json], { type: 'application/json' }), 'application/json')];
  try { tareas.push(subir(A.CFG.NOMBRE_EXCEL || 'goles-encajados.xlsx', A.construirExcel(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')); } catch (e) {}
  return Promise.all(tareas).then(function () {
    E.ultima = new Date().toISOString(); E.ocupado = false;
    return guardarEstado();
  }).then(function () {
    pintarEstado('Copia en Google Drive actualizada.');
    if (E.pendiente) { E.pendiente = false; return sincronizar(motivo); }
    return true;
  }).catch(function (e) {
    E.ocupado = false; E.error = e.message || String(e);
    if (/caducada/.test(E.error)) E.estado = 'reconectar';
    pintarEstado('Google Drive: ' + E.error, 'error');
    guardarEstado();
    return false;
  });
}

function pintarEstado(texto, tipo) {
  A.aviso(texto, tipo || 'ok');
  var el = document.getElementById('drive-estado');
  if (el) el.innerHTML = htmlEstado();
}

/* Lista las copias disponibles y restaura la más reciente. */
function restaurar() {
  return carpeta().then(function (p) { return buscar('copia-goles.json', p); }).then(function (f) {
    if (!f) throw new Error('No hay ninguna copia en Google Drive todavía.');
    return llamar(API + '/files/' + f.id + '?alt=media', { crudo: true }).then(function (r) { return r.text(); });
  }).then(function (txt) {
    var datos = JSON.parse(txt);
    return A.importarCopia(datos);
  });
}

/* ------------------------------ UI (pestaña Exportar) ------------------------------ */

function htmlEstado() {
  var esc = A.esc;
  if (E.estado === 'sin-configurar') {
    return '<p class="nota">Para activar Google Drive hace falta un <strong>ID de cliente de Google</strong> en <code>config.js</code> (una vez, 5 minutos). Los pasos están en el README.</p>';
  }
  if (E.estado === 'conectado') {
    return '<p class="nota ok">Conectado como <strong>' + esc(E.correo || 'tu cuenta') + '</strong>. Carpeta «' + esc(CARPETA) + '» en tu Drive.' +
      (E.ultima ? ' Última copia: ' + esc(new Date(E.ultima).toLocaleString('es-ES')) + '.' : ' Aún no se ha subido ninguna copia.') +
      (E.error ? ' <span class="rojo">Último error: ' + esc(E.error) + '</span>' : '') + '</p>' +
      '<label class="fila-check"><input type="checkbox" id="drive-auto"' + (E.auto ? ' checked' : '') + '> Subir copia y Excel automáticamente al guardar</label>';
  }
  if (E.estado === 'reconectar') return '<p class="nota">La sesión de Google ha caducado. Pulsa <strong>Conectar</strong> para renovarla; los datos no se han perdido.</p>';
  return '<p class="nota">Conecta tu cuenta de Google y la app guardará en tu Drive una copia completa (datos y fotogramas), el Excel y cada clip de vídeo. Desde otro ordenador: Conectar → Restaurar.</p>';
}

function htmlSeccion() {
  var c = E.estado === 'conectado';
  return '<section class="bloque"><h2>Google Drive</h2><div id="drive-estado">' + htmlEstado() + '</div>' +
    '<div class="acciones">' +
      (E.estado === 'sin-configurar' ? '' :
        (c ? '<button type="button" class="btn primary" id="drive-sync">Subir copia ahora</button>' +
             '<button type="button" class="btn" id="drive-restaurar">Restaurar desde Drive…</button>' +
             '<button type="button" class="btn" id="drive-off">Desconectar</button>'
           : '<button type="button" class="btn primary grande" id="drive-on">Conectar con Google</button>')) +
    '</div></section>';
}

function montar(app) {
  var on = document.getElementById('drive-on'), off = document.getElementById('drive-off'), sync = document.getElementById('drive-sync'), rest = document.getElementById('drive-restaurar');
  if (on) on.addEventListener('click', function () {
    conectar().then(function () { A.aviso('Google Drive conectado.', 'ok'); A.pintar(); return sincronizar('manual'); })
      .catch(function (e) { A.aviso('No se pudo conectar: ' + e.message, 'error'); });
  });
  if (off) off.addEventListener('click', function () { desconectar().then(function () { A.pintar(); }); });
  if (sync) sync.addEventListener('click', function () { sincronizar('manual'); });
  if (rest) rest.addEventListener('click', function () {
    if (!confirm('Se añadirán a esta app los datos de la última copia guardada en Drive. ¿Continuar?')) return;
    restaurar().then(function () { A.aviso('Datos restaurados desde Google Drive.', 'ok'); })
      .catch(function (e) { A.aviso('No se pudo restaurar: ' + e.message, 'error'); });
  });
  app.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'drive-auto') { E.auto = e.target.checked; guardarEstado(); }
  });
}

return { cargar: cargar, conectar: conectar, desconectar: desconectar, sincronizar: sincronizar, subirClip: subirClip,
         restaurar: restaurar, htmlSeccion: htmlSeccion, montar: montar, estado: function () { return E.estado; }, _E: E };
})();
