/**
 * Casa María Madre – Puente entre la app y Google (Sheets + Calendar)
 * ---------------------------------------------------------------
 * 1. Cambia CLAVE_ACCESO por una clave propia (la que usaréis en la app).
 * 2. Ejecuta una vez la función  configurar  (menú ▶ Ejecutar) y acepta los permisos.
 * 3. Implementar ▸ Nueva implementación ▸ Aplicación web
 *      Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario
 * 4. Copia la URL que termina en /exec y pégala en config.js de la app.
 */

// ====== AJUSTES (puedes cambiarlos) ======
var CLAVE_ACCESO = 'CAMBIA-ESTA-CLAVE';
var NOMBRE_CALENDARIO = 'Casa María Madre – Ocupación';
var ZONA = 'Europe/Madrid';
var HORA_ENTRADA = '12:00';
var HORA_SALIDA = '16:00';
var VERSION = '1.0.0';

// ====== Estructura de datos ======
var HOJAS = {
  Habitaciones: ['Nº', 'Tipo', 'Camas', 'Capacidad', 'Estado', 'Ubicación'],
  Reservas: ['ID', 'Grupo', 'Responsable', 'Teléfono', 'Email', 'Entrada', 'Hora entrada',
             'Salida', 'Hora salida', 'Personas', 'Estado', 'Observaciones', 'Evento calendario',
             'Creado por', 'Creado el', 'Modificado por', 'Modificado el'],
  Asignaciones: ['ID reserva', 'Habitación', 'Personas'],
  Registro: ['Fecha', 'Gestor', 'Acción', 'ID reserva', 'Detalle']
};

var HABITACIONES_INICIALES = [
  // Nº, Tipo, Camas, Capacidad, Estado, Ubicación
  [1, 'Triple', '3 camas', 3, 'Cerrada', 'Fila inferior'],
  [2, 'Triple', '3 camas', 3, 'Disponible', 'Fila inferior'],
  [3, 'Triple', '3 camas', 3, 'Disponible', 'Fila inferior'],
  [4, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [5, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [6, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [7, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [8, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [9, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [10, 'Doble', '2 camas', 2, 'Disponible', 'Fila inferior'],
  [11, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [12, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [13, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [14, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [15, 'Doble', '2 camas', 2, 'Disponible', 'Fila superior'],
  [16, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [17, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [18, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [19, 'Quíntuple', '2 literas + 1 cama', 5, 'Disponible', 'Fila superior'],
  [20, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [21, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [22, 'Triple', '3 camas', 3, 'Disponible', 'Fila superior'],
  [23, 'Cuádruple', '2 literas', 4, 'Disponible', 'Fila inferior'],
  [24, 'Cuádruple', '2 literas', 4, 'Disponible', 'Fila inferior'],
  [25, 'Triple', '3 camas', 3, 'Disponible', 'Fila inferior']
];

// =====================================================================
// CONFIGURACIÓN INICIAL (ejecutar una vez desde el editor)
// =====================================================================
function configurar() {
  var ss = libro_();
  Object.keys(HOJAS).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre);
    if (!sh) sh = ss.insertSheet(nombre);
    var cab = HOJAS[nombre];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    // Todo como texto: evita que Sheets convierta fechas, horas o teléfonos.
    if (nombre !== 'Habitaciones') sh.getRange(1, 1, 1000, cab.length).setNumberFormat('@');
  });
  var hab = ss.getSheetByName('Habitaciones');
  if (hab.getLastRow() < 2) {
    hab.getRange(2, 1, HABITACIONES_INICIALES.length, HABITACIONES_INICIALES[0].length)
       .setValues(HABITACIONES_INICIALES);
  }
  var hoja1 = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (hoja1 && ss.getSheets().length > 1 && hoja1.getLastRow() === 0) ss.deleteSheet(hoja1);
  var cal = calendario_();
  Logger.log('Listo. Calendario: ' + cal.getName() + ' (' + cal.getId() + ')');
  return { calendario: cal.getId() };
}

// =====================================================================
// ENTRADA DE LA APP
// =====================================================================
function doGet() {
  return json_({ ok: true, datos: { app: 'Casa María Madre', version: VERSION } });
}

function doPost(e) {
  var pet;
  try {
    pet = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Petición no válida.' });
  }
  return json_(atender(pet));
}

/** Lógica común (también la usa el modo demostración de la app). */
function atender(pet) {
  try {
    if (CLAVE_ACCESO === 'CAMBIA-ESTA-CLAVE') throw new Error('Falta configurar la clave en el script.');
    if (!pet || pet.clave !== CLAVE_ACCESO) return { ok: false, error: 'Clave incorrecta.', codigo: 'CLAVE' };
    var gestor = String(pet.gestor || 'Gestor').slice(0, 40);
    var d = pet.datos || {};
    switch (pet.accion) {
      case 'ping': return { ok: true, datos: { version: VERSION } };
      case 'inicial': return { ok: true, datos: estado_() };
      case 'guardarReserva': return conBloqueo_(function () { return guardarReserva_(d, gestor); });
      case 'cancelarReserva': return conBloqueo_(function () { return cancelarReserva_(d.id, gestor); });
      case 'regenerarCalendario': return conBloqueo_(function () { return regenerarCalendario_(gestor); });
      case 'importarCalendario': return conBloqueo_(function () { return importarCalendario_(gestor); });
      default: return { ok: false, error: 'Acción desconocida.' };
    }
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function conBloqueo_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'Otro gestor está guardando. Inténtalo de nuevo.' };
  try {
    var r = fn();
    r.datos = r.datos || {};
    r.datos.estado = estado_();
    return r;
  } finally {
    lock.releaseLock();
  }
}

// =====================================================================
// LECTURA
// =====================================================================
function estado_() {
  var habitaciones = filas_('Habitaciones').map(function (h) {
    return { numero: Number(h['Nº']), tipo: h['Tipo'], camas: h['Camas'], capacidad: Number(h['Capacidad']),
             estado: h['Estado'], ubicacion: h['Ubicación'] };
  }).filter(function (h) { return h.numero; });
  var asig = {};
  filas_('Asignaciones').forEach(function (a) {
    var id = String(a['ID reserva']);
    (asig[id] = asig[id] || []).push({ habitacion: Number(a['Habitación']), personas: Number(a['Personas']) });
  });
  var reservas = filas_('Reservas').filter(function (r) { return r['ID']; }).map(function (r) {
    var o = reservaDeFila_(r);
    o.asignaciones = asig[o.id] || [];
    return o;
  });
  return { habitaciones: habitaciones, reservas: reservas, ajustes: { horaEntrada: HORA_ENTRADA, horaSalida: HORA_SALIDA } };
}

function reservaDeFila_(r) {
  return {
    id: String(r['ID']), grupo: r['Grupo'], responsable: r['Responsable'], telefono: String(r['Teléfono'] || ''),
    email: r['Email'], entrada: fecha_(r['Entrada']), horaEntrada: hora_(r['Hora entrada']) || HORA_ENTRADA,
    salida: fecha_(r['Salida']), horaSalida: hora_(r['Hora salida']) || HORA_SALIDA,
    personas: Number(r['Personas']) || 0, estado: r['Estado'] || 'Confirmada', observaciones: r['Observaciones'],
    eventoId: r['Evento calendario'], creadoPor: r['Creado por'], creadoEl: r['Creado el'],
    modificadoPor: r['Modificado por'], modificadoEl: r['Modificado el']
  };
}

// =====================================================================
// ESCRITURA
// =====================================================================
function guardarReserva_(d, gestor) {
  var r = d.reserva || {};
  var res = {
    id: r.id ? String(r.id) : nuevoId_(),
    grupo: texto_(r.grupo, 80), responsable: texto_(r.responsable, 80), telefono: texto_(r.telefono, 30),
    email: texto_(r.email, 80), entrada: r.entrada, horaEntrada: r.horaEntrada || HORA_ENTRADA,
    salida: r.salida, horaSalida: r.horaSalida || HORA_SALIDA,
    estado: ['Confirmada', 'Provisional'].indexOf(r.estado) >= 0 ? r.estado : 'Confirmada',
    observaciones: texto_(r.observaciones, 500)
  };
  if (!res.grupo) throw new Error('Indica el nombre del grupo.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(res.entrada || '') || !/^\d{4}-\d{2}-\d{2}$/.test(res.salida || ''))
    throw new Error('Fechas de entrada y salida obligatorias.');
  if (!/^\d{2}:\d{2}$/.test(res.horaEntrada) || !/^\d{2}:\d{2}$/.test(res.horaSalida))
    throw new Error('Hora no válida (usa HH:MM).');
  var ini = momento_(res.entrada, res.horaEntrada), fin = momento_(res.salida, res.horaSalida);
  if (fin <= ini) throw new Error('La salida debe ser posterior a la entrada.');

  // Solapamientos: un solo grupo a la vez en la casa.
  var existentes = estado_().reservas;
  var previa = null;
  existentes.forEach(function (x) {
    if (x.id === res.id) { previa = x; return; }
    if (x.estado === 'Cancelada') return;
    var xi = momento_(x.entrada, x.horaEntrada), xf = momento_(x.salida, x.horaSalida);
    if (ini < xf && fin > xi) {
      throw new Error('Se solapa con «' + x.grupo + '» (' + legible_(x.entrada) + ' ' + x.horaEntrada +
                      ' → ' + legible_(x.salida) + ' ' + x.horaSalida + ').');
    }
  });
  if (r.id && !previa) throw new Error('La reserva ya no existe. Recarga los datos.');
  if (previa && previa.estado === 'Cancelada') throw new Error('Esa reserva está cancelada.');

  // Asignaciones por habitación
  var habs = {};
  estado_().habitaciones.forEach(function (h) { habs[h.numero] = h; });
  var asignaciones = [], total = 0, vistas = {};
  (d.asignaciones || []).forEach(function (a) {
    var n = Number(a.habitacion), p = Math.floor(Number(a.personas) || 0);
    if (!p) return;
    var h = habs[n];
    if (!h) throw new Error('La habitación ' + n + ' no existe.');
    if (h.estado !== 'Disponible') throw new Error('La habitación ' + n + ' está cerrada.');
    if (p < 0 || p > h.capacidad) throw new Error('La habitación ' + n + ' admite como máximo ' + h.capacidad + ' personas.');
    if (vistas[n]) throw new Error('Habitación ' + n + ' repetida.');
    vistas[n] = true;
    asignaciones.push({ habitacion: n, personas: p });
    total += p;
  });
  res.personas = total;

  var ahora = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
  res.creadoPor = previa ? previa.creadoPor : gestor;
  res.creadoEl = previa ? previa.creadoEl : ahora;
  res.modificadoPor = gestor;
  res.modificadoEl = ahora;
  res.eventoId = previa ? previa.eventoId : '';
  res.eventoId = sincronizarEvento_(res);

  escribirReserva_(res);
  borrarAsignaciones_(res.id);
  var sh = libro_().getSheetByName('Asignaciones');
  asignaciones.forEach(function (a) { sh.appendRow([res.id, String(a.habitacion), String(a.personas)]); });
  registrar_(gestor, previa ? 'Modificar' : 'Crear', res.id, res.grupo + ' · ' + res.entrada + '→' + res.salida + ' · ' + total + ' pers.');
  return { ok: true, datos: { id: res.id } };
}

function cancelarReserva_(id, gestor) {
  var fila = buscarFila_('Reservas', 'ID', String(id));
  if (!fila) throw new Error('La reserva no existe.');
  var sh = libro_().getSheetByName('Reservas');
  var cab = HOJAS.Reservas;
  var vals = sh.getRange(fila, 1, 1, cab.length).getValues()[0];
  var res = reservaDeFila_(objeto_(cab, vals));
  borrarEvento_(res.eventoId);
  res.estado = 'Cancelada';
  res.eventoId = '';
  res.modificadoPor = gestor;
  res.modificadoEl = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
  escribirReserva_(res);
  registrar_(gestor, 'Cancelar', res.id, res.grupo);
  return { ok: true, datos: { id: res.id } };
}

function escribirReserva_(r) {
  var fila = [r.id, r.grupo, r.responsable, r.telefono, r.email, r.entrada, r.horaEntrada, r.salida, r.horaSalida,
              String(r.personas || 0), r.estado, r.observaciones, r.eventoId, r.creadoPor, r.creadoEl,
              r.modificadoPor, r.modificadoEl].map(function (v) { return v == null ? '' : String(v); });
  var sh = libro_().getSheetByName('Reservas');
  var n = buscarFila_('Reservas', 'ID', r.id);
  if (n) sh.getRange(n, 1, 1, fila.length).setValues([fila]);
  else sh.appendRow(fila);
}

function borrarAsignaciones_(id) {
  var sh = libro_().getSheetByName('Asignaciones');
  var v = sh.getDataRange().getValues();
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][0]) === id) sh.deleteRow(i + 1);
}

// =====================================================================
// CALENDARIO
// =====================================================================
function calendario_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('CALENDARIO_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    var lista = CalendarApp.getCalendarsByName(NOMBRE_CALENDARIO);
    cal = lista.length ? lista[0] : CalendarApp.createCalendar(NOMBRE_CALENDARIO, { timeZone: ZONA });
    props.setProperty('CALENDARIO_ID', cal.getId());
  }
  return cal;
}

function tituloEvento_(r) {
  return (r.estado === 'Provisional' ? '[PROVISIONAL] ' : '') + r.grupo + ' – ' + r.personas + ' personas';
}

function descripcionEvento_(r) {
  var l = [
    'Responsable: ' + (r.responsable || '—'),
    'Teléfono: ' + (r.telefono || '—'),
    'Entrada: ' + legible_(r.entrada) + ' ' + r.horaEntrada,
    'Salida: ' + legible_(r.salida) + ' ' + r.horaSalida,
    'Personas: ' + r.personas
  ];
  if (r.observaciones) l.push('Observaciones: ' + r.observaciones);
  l.push('', 'Gestionado desde la app Casa María Madre. No editar aquí.', 'ID reserva: ' + r.id);
  return l.join('\n');
}

function sincronizarEvento_(r) {
  var cal = calendario_();
  var ini = momento_(r.entrada, r.horaEntrada), fin = momento_(r.salida, r.horaSalida);
  var ev = r.eventoId ? cal.getEventById(r.eventoId) : null;
  if (ev) {
    ev.setTitle(tituloEvento_(r));
    ev.setTime(ini, fin);
    ev.setDescription(descripcionEvento_(r));
  } else {
    ev = cal.createEvent(tituloEvento_(r), ini, fin, { description: descripcionEvento_(r) });
  }
  ev.setTag('reservaId', r.id);
  ev.setColor(r.estado === 'Provisional' ? CalendarApp.EventColor.YELLOW : CalendarApp.EventColor.GREEN);
  return ev.getId();
}

function borrarEvento_(eventoId) {
  if (!eventoId) return;
  var ev = calendario_().getEventById(eventoId);
  if (ev) ev.deleteEvent();
}

/** Borra todos los eventos de la app y los vuelve a crear desde la hoja. */
function regenerarCalendario_(gestor) {
  var cal = calendario_();
  var desde = new Date(2000, 0, 1), hasta = new Date(2100, 0, 1);
  cal.getEvents(desde, hasta).forEach(function (ev) { if (ev.getTag('reservaId')) ev.deleteEvent(); });
  var n = 0;
  estado_().reservas.forEach(function (r) {
    if (r.estado === 'Cancelada') return;
    r.eventoId = '';
    r.eventoId = sincronizarEvento_(r);
    escribirReserva_(r);
    n++;
  });
  registrar_(gestor, 'Regenerar calendario', '', n + ' eventos');
  return { ok: true, datos: { eventos: n } };
}

/** Crea reservas a partir de eventos añadidos a mano en el calendario (fase 1). */
function importarCalendario_(gestor) {
  var cal = calendario_();
  var hoy = new Date();
  var desde = new Date(hoy.getFullYear() - 1, 0, 1), hasta = new Date(hoy.getFullYear() + 3, 0, 1);
  var creadas = 0, omitidas = [];
  var existentes = estado_().reservas.filter(function (x) { return x.estado !== 'Cancelada'; });
  cal.getEvents(desde, hasta).forEach(function (ev) {
    if (ev.getTag('reservaId')) return;
    var t = ev.getTitle();
    var provisional = /^\s*\[?provisional\]?\s*/i.test(t);
    var limpio = t.replace(/^\s*\[?provisional\]?\s*/i, '');
    var m = limpio.match(/^(.*?)\s*[–-]\s*(\d+)\s*personas?/i);
    var ini = ev.getStartTime(), fin = ev.getEndTime();
    var r = {
      id: nuevoId_(), grupo: texto_(m ? m[1] : limpio, 80), responsable: '', telefono: '', email: '',
      entrada: Utilities.formatDate(ini, ZONA, 'yyyy-MM-dd'),
      horaEntrada: ev.isAllDayEvent() ? HORA_ENTRADA : Utilities.formatDate(ini, ZONA, 'HH:mm'),
      salida: Utilities.formatDate(ev.isAllDayEvent() ? new Date(fin.getTime() - 86400000) : fin, ZONA, 'yyyy-MM-dd'),
      horaSalida: ev.isAllDayEvent() ? HORA_SALIDA : Utilities.formatDate(fin, ZONA, 'HH:mm'),
      personas: m ? Number(m[2]) : 0, estado: provisional ? 'Provisional' : 'Confirmada', observaciones: ''
    };
    var desc = ev.getDescription() || '';
    var mr = desc.match(/Responsable:\s*(.+)/i); if (mr) r.responsable = texto_(mr[1], 80);
    var mt = desc.match(/Tel[eé]fono:\s*(.+)/i); if (mt) r.telefono = texto_(mt[1], 30);
    var mo = desc.match(/Observaciones:\s*(.+)/i); if (mo) r.observaciones = texto_(mo[1], 500);
    var ri = momento_(r.entrada, r.horaEntrada), rf = momento_(r.salida, r.horaSalida);
    if (rf <= ri) { omitidas.push(t + ' (fechas no válidas)'); return; }
    var choque = existentes.filter(function (x) {
      return ri < momento_(x.salida, x.horaSalida) && rf > momento_(x.entrada, x.horaEntrada);
    })[0];
    if (choque) { omitidas.push(t + ' (se solapa con «' + choque.grupo + '»)'); return; }
    r.creadoPor = r.modificadoPor = gestor;
    r.creadoEl = r.modificadoEl = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
    r.eventoId = ev.getId();          // se reutiliza el evento: pasa a ser de la app
    if (ev.isAllDayEvent()) { ev.deleteEvent(); r.eventoId = ''; }  // los de día completo se recrean con horas
    r.eventoId = sincronizarEvento_(r);
    escribirReserva_(r);
    existentes.push(r);
    creadas++;
  });
  registrar_(gestor, 'Importar calendario', '', creadas + ' importadas, ' + omitidas.length + ' omitidas');
  return { ok: true, datos: { importadas: creadas, omitidas: omitidas } };
}

// =====================================================================
// UTILIDADES
// =====================================================================
function libro_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function filas_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja «' + nombre + '». Ejecuta configurar().');
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return [];
  var cab = v[0];
  return v.slice(1).map(function (f) { return objeto_(cab, f); });
}

function objeto_(cab, fila) {
  var o = {};
  cab.forEach(function (c, i) { o[c] = fila[i]; });
  return o;
}

function buscarFila_(hoja, columna, valor) {
  var v = libro_().getSheetByName(hoja).getDataRange().getValues();
  var c = v[0].indexOf(columna);
  for (var i = 1; i < v.length; i++) if (String(v[i][c]) === String(valor)) return i + 1;
  return 0;
}

function registrar_(gestor, accion, id, detalle) {
  libro_().getSheetByName('Registro').appendRow([
    Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm:ss'), gestor, accion, id || '', detalle || '']);
}

function nuevoId_() {
  return 'R' + Utilities.formatDate(new Date(), ZONA, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
}

function texto_(v, max) { return v == null ? '' : String(v).trim().slice(0, max); }

function momento_(fecha, hora) {
  return Utilities.parseDate(fecha + ' ' + hora, ZONA, 'yyyy-MM-dd HH:mm');
}

function fecha_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, 'yyyy-MM-dd');
  return String(v || '');
}

function hora_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, 'HH:mm');
  var s = String(v || '');
  return /^\d:\d{2}$/.test(s) ? '0' + s : s;
}

function legible_(f) {
  var p = String(f).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : f;
}
