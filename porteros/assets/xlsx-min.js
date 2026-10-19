/* =====================================================================
   Generador de archivos .xlsx sin dependencias externas.
   Un .xlsx es un ZIP con varios XML dentro. Aquí se construye ese ZIP
   a mano (sin compresión: Excel lo abre igual) para que la app no
   dependa de ninguna librería descargada de internet.
   Uso:  MiniXLSX.crear([{ nombre:'Goles', filas:[[...],[...]] }])  -> Blob
   ===================================================================== */
window.MiniXLSX = (function () {
'use strict';

/* ------------------------------ ZIP ------------------------------ */

var TABLA_CRC = (function () {
  var t = new Uint32Array(256), c, n, k;
  for (n = 0; n < 256; n++) {
    c = n;
    for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function utf8(texto) { return new TextEncoder().encode(texto); }

function zip(archivos) {
  var partes = [], central = [], offset = 0, tamCentral = 0;
  var f = new Date();
  var hora = ((f.getHours() << 11) | (f.getMinutes() << 5) | Math.floor(f.getSeconds() / 2)) & 0xFFFF;
  var dia  = (((f.getFullYear() - 1980) << 9) | ((f.getMonth() + 1) << 5) | f.getDate()) & 0xFFFF;

  archivos.forEach(function (a) {
    var nombre = utf8(a.nombre), datos = a.datos, crc = crc32(datos);

    var lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);      /* versión necesaria */
    lh.setUint16(6, 0x0800, true);  /* nombres en UTF-8 */
    lh.setUint16(8, 0, true);       /* método 0 = sin comprimir */
    lh.setUint16(10, hora, true);
    lh.setUint16(12, dia, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, datos.length, true);
    lh.setUint32(22, datos.length, true);
    lh.setUint16(26, nombre.length, true);
    lh.setUint16(28, 0, true);
    partes.push(new Uint8Array(lh.buffer), nombre, datos);

    var cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, hora, true);
    cd.setUint16(14, dia, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, datos.length, true);
    cd.setUint32(24, datos.length, true);
    cd.setUint16(28, nombre.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nombre);

    offset += 30 + nombre.length + datos.length;
    tamCentral += 46 + nombre.length;
  });

  var fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, archivos.length, true);
  fin.setUint16(10, archivos.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true);

  return new Blob(partes.concat(central, [new Uint8Array(fin.buffer)]),
                  { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ------------------------------ XML ------------------------------ */

function escXml(s) {
  return String(s)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function letraCol(i) {
  var s = '';
  i += 1;
  while (i > 0) { var r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/* Un nombre de hoja no admite : \ / ? * [ ] y se queda en 31 caracteres. */
function nombreHoja(n, i) {
  n = String(n || ('Hoja' + (i + 1))).replace(/[:\\\/\?\*\[\]]/g, ' ').slice(0, 31).trim();
  return n || ('Hoja' + (i + 1));
}

function celda(ref, valor, estilo) {
  var est = estilo ? ' s="' + estilo + '"' : '';
  if (valor === null || valor === undefined || valor === '') return '<c r="' + ref + '"' + est + '/>';
  if (typeof valor === 'number' && isFinite(valor)) return '<c r="' + ref + '"' + est + '><v>' + valor + '</v></c>';
  if (typeof valor === 'boolean') return '<c r="' + ref + '" t="b"' + est + '><v>' + (valor ? 1 : 0) + '</v></c>';
  return '<c r="' + ref + '" t="inlineStr"' + est + '><is><t xml:space="preserve">' + escXml(valor) + '</t></is></c>';
}

/* Una hoja: { nombre, filas, anchos, titulos (nº de filas de cabecera) } */
function xmlHoja(hoja) {
  var filas = hoja.filas || [];
  var nCols = 0;
  filas.forEach(function (f) { if (f && f.length > nCols) nCols = f.length; });
  if (!nCols) nCols = 1;

  var cols = '';
  if (hoja.anchos && hoja.anchos.length) {
    cols = '<cols>' + hoja.anchos.map(function (a, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + a + '" customWidth="1"/>';
    }).join('') + '</cols>';
  }

  var cuerpo = filas.map(function (fila, r) {
    var celdas = (fila || []).map(function (v, c) {
      var estilo = 0;
      if (v && typeof v === 'object' && !(v instanceof Date)) { estilo = v.estilo || 0; v = v.v; }
      else if (hoja.cabecera !== false && r === 0) estilo = 2;
      return celda(letraCol(c) + (r + 1), v, estilo);
    }).join('');
    return '<row r="' + (r + 1) + '">' + celdas + '</row>';
  }).join('');

  var ref = 'A1:' + letraCol(nCols - 1) + Math.max(filas.length, 1);
  var vista = hoja.congelar
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + hoja.congelar +
      '" topLeftCell="A' + (hoja.congelar + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';
  var filtro = hoja.filtro ? '<autoFilter ref="' + ref + '"/>' : '';

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="' + ref + '"/>' + vista +
    '<sheetFormatPr defaultRowHeight="15"/>' + cols +
    '<sheetData>' + cuerpo + '</sheetData>' + filtro +
    '</worksheet>';
}

var ESTILOS = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="3">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF10343F"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="3">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function crear(hojas) {
  hojas = (hojas || []).filter(Boolean);
  if (!hojas.length) hojas = [{ nombre: 'Hoja1', filas: [[]] }];

  var archivos = [];
  var tipos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    hojas.map(function (h, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('') +
    '</Types>';

  var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  var libro = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    hojas.map(function (h, i) {
      return '<sheet name="' + escXml(nombreHoja(h.nombre, i)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('') +
    '</sheets></workbook>';

  var libroRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    hojas.map(function (h, i) {
      return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }).join('') +
    '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  archivos.push({ nombre: '[Content_Types].xml', datos: utf8(tipos) });
  archivos.push({ nombre: '_rels/.rels', datos: utf8(rels) });
  archivos.push({ nombre: 'xl/workbook.xml', datos: utf8(libro) });
  archivos.push({ nombre: 'xl/_rels/workbook.xml.rels', datos: utf8(libroRels) });
  archivos.push({ nombre: 'xl/styles.xml', datos: utf8(ESTILOS) });
  hojas.forEach(function (h, i) {
    archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: utf8(xmlHoja(h)) });
  });

  return zip(archivos);
}

return { crear: crear };
})();
