/* =====================================================================
   Generador de archivos .xlsx sin dependencias externas.
   Un .xlsx es un ZIP con varios XML dentro. Aquí se construye ese ZIP
   a mano (sin compresión: Excel lo abre igual) para que la app no
   dependa de ninguna librería descargada de internet.

   Uso:  MiniXLSX.crear([hoja, hoja, ...]) -> Blob
   Hoja: { nombre, filas, anchos, congelar, filtro, cabecera,
           combinar: ['A1:F1'], imprimir: true,
           validaciones: [{ ref:'B2:B999', lista:"'TABLA MAESTRA'!$A$3:$A$4" }
                          { ref:'T2:T999', entero:[1, 20] }],
           graficos: [{ tipo:'barras'|'columnas'|'tarta', titulo, hoja,
                        cats:'A9:A11', vals:'B9:B11',
                        desde:{col,fila}, hasta:{col,fila}, colores:[] }] }
   Celda: valor simple, o { v, estilo } (0 normal, 1 negrita, 2 cabecera,
          3 título, 4 subtítulo, 5 número grande).
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
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true);
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

var XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

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

function nombreHoja(n, i) {
  n = String(n || ('Hoja' + (i + 1))).replace(/[:\\\/\?\*\[\]]/g, ' ').slice(0, 31).trim();
  return n || ('Hoja' + (i + 1));
}

function celda(ref, valor, estilo) {
  var est = estilo ? ' s="' + estilo + '"' : '';
  if (valor === null || valor === undefined || valor === '') return est ? '<c r="' + ref + '"' + est + '/>' : '';
  if (typeof valor === 'number' && isFinite(valor)) return '<c r="' + ref + '"' + est + '><v>' + valor + '</v></c>';
  if (typeof valor === 'boolean') return '<c r="' + ref + '" t="b"' + est + '><v>' + (valor ? 1 : 0) + '</v></c>';
  return '<c r="' + ref + '" t="inlineStr"' + est + '><is><t xml:space="preserve">' + escXml(valor) + '</t></is></c>';
}

function xmlHoja(hoja, idDibujo) {
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
      if (v && typeof v === 'object') { estilo = v.estilo || 0; v = v.v; }
      else if (hoja.cabecera !== false && r === 0) estilo = 2;
      return celda(letraCol(c) + (r + 1), v, estilo);
    }).join('');
    var alto = (fila && fila.some(function (v) { return v && typeof v === 'object' && v.estilo === 3; })) ? ' ht="26" customHeight="1"' : '';
    return '<row r="' + (r + 1) + '"' + alto + '>' + celdas + '</row>';
  }).join('');

  var ref = 'A1:' + letraCol(nCols - 1) + Math.max(filas.length, 1);
  var vista = hoja.congelar
    ? '<sheetViews><sheetView workbookViewId="0"' + (hoja.imprimir ? ' showGridLines="0"' : '') + '><pane ySplit="' + hoja.congelar +
      '" topLeftCell="A' + (hoja.congelar + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : (hoja.imprimir ? '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' : '');
  var filtro = hoja.filtro ? '<autoFilter ref="' + ref + '"/>' : '';

  var combinar = (hoja.combinar && hoja.combinar.length)
    ? '<mergeCells count="' + hoja.combinar.length + '">' + hoja.combinar.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>'
    : '';

  var validaciones = '';
  if (hoja.validaciones && hoja.validaciones.length) {
    validaciones = '<dataValidations count="' + hoja.validaciones.length + '">' + hoja.validaciones.map(function (v) {
      if (v.entero) {
        return '<dataValidation type="whole" allowBlank="1" showErrorMessage="1" errorTitle="Valor no válido" error="Escribe un número entre ' + v.entero[0] + ' y ' + v.entero[1] + '." sqref="' + v.ref + '">' +
               '<formula1>' + v.entero[0] + '</formula1><formula2>' + v.entero[1] + '</formula2></dataValidation>';
      }
      return '<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Valor no válido" error="Elige un valor de la lista." sqref="' + v.ref + '">' +
             '<formula1>' + escXml(v.lista) + '</formula1></dataValidation>';
    }).join('') + '</dataValidations>';
  }

  var impresion = hoja.imprimir
    ? '<printOptions horizontalCentered="1"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>'
    : '';
  var sheetPr = hoja.imprimir ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '';
  var dibujo = idDibujo ? '<drawing r:id="rIdDib"/>' : '';

  return XML +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    sheetPr + '<dimension ref="' + ref + '"/>' + vista +
    '<sheetFormatPr defaultRowHeight="15"/>' + cols +
    '<sheetData>' + cuerpo + '</sheetData>' + filtro + combinar + validaciones + impresion + dibujo +
    '</worksheet>';
}

/* ------------------------------ Gráficos ------------------------------ */

var COLORES = ['10343F', 'E4572E', '1E7D55', '8AC3EE', 'C2661F', '6B7472', 'B3261E', 'FDB833'];

function refHoja(hoja, rango) {
  return "'" + String(hoja).replace(/'/g, "''") + "'!" + rango.replace(/([A-Z]+)(\d+)/g, '$$$1$$$2');
}

function xmlGrafico(g) {
  var esTarta = g.tipo === 'tarta', horizontal = g.tipo === 'barras';
  var titulo = '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr>' +
    '<a:r><a:rPr lang="es-ES" sz="1100" b="1"/><a:t>' + escXml(g.titulo || '') + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
  var colores = g.colores || COLORES;
  var puntos = esTarta ? (g.nPuntos ? Array.apply(null, Array(g.nPuntos)).map(function (_, i) {
    return '<c:dPt><c:idx val="' + i + '"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="' + colores[i % colores.length] + '"/></a:solidFill></c:spPr></c:dPt>';
  }).join('') : '') : '';
  var etiquetas = '<c:dLbls>' + (esTarta ? '<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/>'
                                         : '<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/>') +
                  '<c:showBubbleSize val="0"/></c:dLbls>';
  var serie = '<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>' + escXml(g.serie || 'Goles') + '</c:v></c:tx>' +
    (esTarta ? '' : '<c:spPr><a:solidFill><a:srgbClr val="' + colores[0] + '"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>') +
    puntos + etiquetas +
    '<c:cat><c:strRef><c:f>' + escXml(refHoja(g.hoja, g.cats)) + '</c:f></c:strRef></c:cat>' +
    '<c:val><c:numRef><c:f>' + escXml(refHoja(g.hoja, g.vals)) + '</c:f></c:numRef></c:val></c:ser>';

  var plot;
  if (esTarta) {
    plot = '<c:pieChart><c:varyColors val="1"/>' + serie + '<c:firstSliceAng val="0"/></c:pieChart>';
  } else {
    plot = '<c:barChart><c:barDir val="' + (horizontal ? 'bar' : 'col') + '"/><c:grouping val="clustered"/><c:varyColors val="0"/>' +
      serie + '<c:gapWidth val="60"/><c:axId val="10"/><c:axId val="20"/></c:barChart>' +
      '<c:catAx><c:axId val="10"/><c:scaling><c:orientation val="' + (horizontal ? 'maxMin' : 'minMax') + '"/></c:scaling><c:delete val="0"/>' +
      '<c:axPos val="' + (horizontal ? 'l' : 'b') + '"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"/></a:pPr><a:endParaRPr lang="es-ES"/></a:p></c:txPr>' +
      '<c:crossAx val="20"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
      '<c:valAx><c:axId val="20"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/>' +
      '<c:axPos val="' + (horizontal ? 'b' : 'l') + '"/><c:majorGridlines/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/>' +
      '<c:tickLblPos val="nextTo"/><c:crossAx val="10"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
  }

  return XML +
    '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<c:roundedCorners val="0"/><c:chart>' + titulo + '<c:autoTitleDeleted val="0"/>' +
    '<c:plotArea><c:layout/>' + plot + '</c:plotArea>' +
    (esTarta ? '<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>' : '') +
    '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}

function xmlDibujo(graficos, primerId) {
  return XML +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    graficos.map(function (g, i) {
      return '<xdr:twoCellAnchor editAs="oneCell">' +
        '<xdr:from><xdr:col>' + g.desde.col + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + g.desde.fila + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
        '<xdr:to><xdr:col>' + g.hasta.col + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + g.hasta.fila + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
        '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (i + 2) + '" name="Gráfico ' + (i + 1) + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>' +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
        '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rIdG' + (i + 1) + '"/>' +
        '</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
    }).join('') + '</xdr:wsDr>';
}

/* ------------------------------ Estilos ------------------------------ */

var ESTILOS = XML +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="6">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="18"/><color rgb="FF10343F"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="12"/><color rgb="FF10343F"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="20"/><color rgb="FF10343F"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="4">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF10343F"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE4EEF1"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FF10343F"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="5" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/* ------------------------------ Libro ------------------------------ */

var REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
var CT_HOJA = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
var CT_DIBUJO = 'application/vnd.openxmlformats-officedocument.drawing+xml';
var CT_GRAFICO = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';

function rels(lista) {
  return XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    lista.map(function (r) { return '<Relationship Id="' + r.id + '" Type="' + REL + r.tipo + '" Target="' + r.destino + '"/>'; }).join('') +
    '</Relationships>';
}

function crear(hojas) {
  hojas = (hojas || []).filter(Boolean);
  if (!hojas.length) hojas = [{ nombre: 'Hoja1', filas: [[]] }];

  var archivos = [], overrides = [], nGrafico = 0;

  hojas.forEach(function (h, i) {
    var n = i + 1, graficos = h.graficos || [];
    overrides.push('<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="' + CT_HOJA + '"/>');
    archivos.push({ nombre: 'xl/worksheets/sheet' + n + '.xml', datos: utf8(xmlHoja(h, graficos.length ? n : 0)) });
    if (!graficos.length) return;

    archivos.push({ nombre: 'xl/worksheets/_rels/sheet' + n + '.xml.rels',
                    datos: utf8(rels([{ id: 'rIdDib', tipo: 'drawing', destino: '../drawings/drawing' + n + '.xml' }])) });
    overrides.push('<Override PartName="/xl/drawings/drawing' + n + '.xml" ContentType="' + CT_DIBUJO + '"/>');
    archivos.push({ nombre: 'xl/drawings/drawing' + n + '.xml', datos: utf8(xmlDibujo(graficos)) });
    var relsDibujo = [];
    graficos.forEach(function (g, k) {
      nGrafico++;
      relsDibujo.push({ id: 'rIdG' + (k + 1), tipo: 'chart', destino: '../charts/chart' + nGrafico + '.xml' });
      overrides.push('<Override PartName="/xl/charts/chart' + nGrafico + '.xml" ContentType="' + CT_GRAFICO + '"/>');
      archivos.push({ nombre: 'xl/charts/chart' + nGrafico + '.xml', datos: utf8(xmlGrafico(g)) });
    });
    archivos.push({ nombre: 'xl/drawings/_rels/drawing' + n + '.xml.rels', datos: utf8(rels(relsDibujo)) });
  });

  var tipos = XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    overrides.join('') + '</Types>';

  var libro = XML + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    hojas.map(function (h, i) {
      return '<sheet name="' + escXml(nombreHoja(h.nombre, i)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('') + '</sheets></workbook>';

  var relsLibro = hojas.map(function (h, i) {
    return { id: 'rId' + (i + 1), tipo: 'worksheet', destino: 'worksheets/sheet' + (i + 1) + '.xml' };
  }).concat([{ id: 'rId' + (hojas.length + 1), tipo: 'styles', destino: 'styles.xml' }]);

  archivos.unshift(
    { nombre: '[Content_Types].xml', datos: utf8(tipos) },
    { nombre: '_rels/.rels', datos: utf8(rels([{ id: 'rId1', tipo: 'officeDocument', destino: 'xl/workbook.xml' }])) },
    { nombre: 'xl/workbook.xml', datos: utf8(libro) },
    { nombre: 'xl/_rels/workbook.xml.rels', datos: utf8(rels(relsLibro)) },
    { nombre: 'xl/styles.xml', datos: utf8(ESTILOS) }
  );

  return zip(archivos);
}

return { crear: crear, letraCol: letraCol };
})();
