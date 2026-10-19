/* =====================================================================
   Zonas del campo propio (1–20) y de la portería (1–8).
   La numeración es la de los dibujos del entrenador. Si algún día hay
   que mover una línea, se toca solo este archivo.

   Campo: media parte defensiva vista desde arriba, con NUESTRA PORTERÍA
   ARRIBA. Las coordenadas están en decímetros reales (680 x 525 = 68 x
   52,5 m), así que el dibujo está a escala.
   Portería: vista frontal desde el campo, 732 x 244 (7,32 x 2,44 m).
   Izquierda y derecha son siempre las del dibujo.
   ===================================================================== */
window.ZONAS = (function () {
'use strict';

/* Medidas reglamentarias, en decímetros. */
var ANCHO = 680, FONDO = 525;
var PORT_IZQ = 303.4, PORT_DER = 376.6;          /* palos */
var PEQ_IZQ = 248.4, PEQ_DER = 431.6, PEQ_FONDO = 55;    /* área pequeña */
var GRA_IZQ = 139.4, GRA_DER = 540.6, GRA_FONDO = 165;   /* área grande */
var MEDIA = 345;                                  /* corte entre franja media y lejana */

function rect(x1, y1, x2, y2) {
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}

/* nº → { nombre, corto, poligono, dentroArea, banda } */
var CAMPO = [
  { n: 1,  corto: 'Área pequeña centro',    nombre: 'Área pequeña · frente a portería',
    poligono: rect(PORT_IZQ, 0, PORT_DER, PEQ_FONDO), dentroArea: true, banda: 'Centro' },
  { n: 2,  corto: 'Frontal área centro',    nombre: 'Área grande · frontal centrado',
    poligono: rect(PORT_IZQ, PEQ_FONDO, PORT_DER, GRA_FONDO), dentroArea: true, banda: 'Centro' },
  { n: 3,  corto: 'Área pequeña izq.',      nombre: 'Área pequeña · izquierda',
    poligono: rect(PEQ_IZQ, 0, PORT_IZQ, PEQ_FONDO), dentroArea: true, banda: 'Izquierda' },
  { n: 4,  corto: 'Área pequeña dcha.',     nombre: 'Área pequeña · derecha',
    poligono: rect(PORT_DER, 0, PEQ_DER, PEQ_FONDO), dentroArea: true, banda: 'Derecha' },
  { n: 5,  corto: 'Área semi izq.',         nombre: 'Área grande · semi izquierda',
    poligono: [[PEQ_IZQ, PEQ_FONDO], [PORT_IZQ, PEQ_FONDO], [PORT_IZQ, GRA_FONDO], [GRA_IZQ, GRA_FONDO]],
    dentroArea: true, banda: 'Izquierda' },
  { n: 6,  corto: 'Área semi dcha.',        nombre: 'Área grande · semi derecha',
    poligono: [[PORT_DER, PEQ_FONDO], [PEQ_DER, PEQ_FONDO], [GRA_DER, GRA_FONDO], [PORT_DER, GRA_FONDO]],
    dentroArea: true, banda: 'Derecha' },
  { n: 7,  corto: 'Área lateral izq.',      nombre: 'Área grande · lateral izquierdo',
    poligono: [[GRA_IZQ, 0], [PEQ_IZQ, 0], [PEQ_IZQ, PEQ_FONDO], [GRA_IZQ, GRA_FONDO]],
    dentroArea: true, banda: 'Izquierda' },
  { n: 8,  corto: 'Área lateral dcha.',     nombre: 'Área grande · lateral derecho',
    poligono: [[PEQ_DER, 0], [GRA_DER, 0], [GRA_DER, GRA_FONDO], [PEQ_DER, PEQ_FONDO]],
    dentroArea: true, banda: 'Derecha' },
  { n: 9,  corto: 'Banda izq. área',        nombre: 'Banda izquierda · altura del área',
    poligono: rect(0, 0, GRA_IZQ, GRA_FONDO), dentroArea: false, banda: 'Izquierda' },
  { n: 10, corto: 'Banda dcha. área',       nombre: 'Banda derecha · altura del área',
    poligono: rect(GRA_DER, 0, ANCHO, GRA_FONDO), dentroArea: false, banda: 'Derecha' },
  { n: 11, corto: 'Banda izq. media',       nombre: 'Banda izquierda · franja media',
    poligono: rect(0, GRA_FONDO, GRA_IZQ, MEDIA), dentroArea: false, banda: 'Izquierda' },
  { n: 12, corto: 'Banda dcha. media',      nombre: 'Banda derecha · franja media',
    poligono: rect(GRA_DER, GRA_FONDO, ANCHO, MEDIA), dentroArea: false, banda: 'Derecha' },
  { n: 13, corto: 'Interior izq. media',    nombre: 'Interior izquierdo · franja media',
    poligono: rect(GRA_IZQ, GRA_FONDO, PORT_IZQ, MEDIA), dentroArea: false, banda: 'Izquierda' },
  { n: 14, corto: 'Interior dcho. media',   nombre: 'Interior derecho · franja media',
    poligono: rect(PORT_DER, GRA_FONDO, GRA_DER, MEDIA), dentroArea: false, banda: 'Derecha' },
  { n: 15, corto: 'Banda izq. lejana',      nombre: 'Banda izquierda · franja lejana',
    poligono: rect(0, MEDIA, GRA_IZQ, FONDO), dentroArea: false, banda: 'Izquierda' },
  { n: 16, corto: 'Banda dcha. lejana',     nombre: 'Banda derecha · franja lejana',
    poligono: rect(GRA_DER, MEDIA, ANCHO, FONDO), dentroArea: false, banda: 'Derecha' },
  { n: 17, corto: 'Interior izq. lejano',   nombre: 'Interior izquierdo · franja lejana',
    poligono: rect(GRA_IZQ, MEDIA, PORT_IZQ, FONDO), dentroArea: false, banda: 'Izquierda' },
  { n: 18, corto: 'Interior dcho. lejano',  nombre: 'Interior derecho · franja lejana',
    poligono: rect(PORT_DER, MEDIA, GRA_DER, FONDO), dentroArea: false, banda: 'Derecha' },
  { n: 19, corto: 'Centro media',           nombre: 'Centro · franja media',
    poligono: rect(PORT_IZQ, GRA_FONDO, PORT_DER, MEDIA), dentroArea: false, banda: 'Centro' },
  { n: 20, corto: 'Centro lejano',          nombre: 'Centro · franja lejana',
    poligono: rect(PORT_IZQ, MEDIA, PORT_DER, FONDO), dentroArea: false, banda: 'Centro' }
];

/* Portería: 4 columnas x 2 alturas. 732 x 244 decímetros. */
var P_ANCHO = 732, P_ALTO = 244, COL = P_ANCHO / 4, FILA = P_ALTO / 2;

var PORTERIA = [
  { n: 1, corto: 'Alta centro izq.',  nombre: 'Alta · centro izquierda',  col: 1, fila: 0 },
  { n: 2, corto: 'Alta centro dcha.', nombre: 'Alta · centro derecha',    col: 2, fila: 0 },
  { n: 3, corto: 'Baja centro izq.',  nombre: 'Baja · centro izquierda',  col: 1, fila: 1 },
  { n: 4, corto: 'Baja centro dcha.', nombre: 'Baja · centro derecha',    col: 2, fila: 1 },
  { n: 5, corto: 'Escuadra izq.',     nombre: 'Alta · junto al palo izquierdo',  col: 0, fila: 0 },
  { n: 6, corto: 'Escuadra dcha.',    nombre: 'Alta · junto al palo derecho',    col: 3, fila: 0 },
  { n: 7, corto: 'Palo izq. abajo',   nombre: 'Baja · junto al palo izquierdo',  col: 0, fila: 1 },
  { n: 8, corto: 'Palo dcho. abajo',  nombre: 'Baja · junto al palo derecho',    col: 3, fila: 1 }
];

PORTERIA.forEach(function (z) {
  z.poligono = rect(z.col * COL, z.fila * FILA, (z.col + 1) * COL, (z.fila + 1) * FILA);
  z.altura = z.fila === 0 ? 'Alta' : 'Baja';
  z.lado = z.col <= 1 ? 'Izquierda' : 'Derecha';
  z.palo = (z.col === 0 || z.col === 3) ? 'Junto al palo' : 'Centrada';
});

function buscar(lista, n) {
  n = parseInt(n, 10);
  for (var i = 0; i < lista.length; i++) if (lista[i].n === n) return lista[i];
  return null;
}

function puntos(poligono) {
  return poligono.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
}

function centro(poligono) {
  var sx = 0, sy = 0;
  poligono.forEach(function (p) { sx += p[0]; sy += p[1]; });
  return [sx / poligono.length, sy / poligono.length];
}

return {
  CAMPO: CAMPO,
  PORTERIA: PORTERIA,
  MEDIDAS: { ancho: ANCHO, fondo: FONDO, pAncho: P_ANCHO, pAlto: P_ALTO,
             portIzq: PORT_IZQ, portDer: PORT_DER,
             peqIzq: PEQ_IZQ, peqDer: PEQ_DER, peqFondo: PEQ_FONDO,
             graIzq: GRA_IZQ, graDer: GRA_DER, graFondo: GRA_FONDO },
  campo: function (n) { return buscar(CAMPO, n); },
  porteria: function (n) { return buscar(PORTERIA, n); },
  puntos: puntos,
  centro: centro
};
})();
