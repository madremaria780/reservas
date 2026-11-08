/*
 * Simulación mínima de Google Apps Script para el MODO DEMOSTRACIÓN.
 * Permite ejecutar el mismo Code.gs dentro del navegador (o en Node para pruebas),
 * guardando los datos en el propio dispositivo. No se usa con la conexión real.
 */
(function (root) {
  var store = root.__GAS_STORE__ || (function () {
    var mem = {};
    try {
      if (root.localStorage) {
        return {
          get: function (k) { try { return JSON.parse(root.localStorage.getItem('demo:' + k)); } catch (e) { return null; } },
          set: function (k, v) { try { root.localStorage.setItem('demo:' + k, JSON.stringify(v)); } catch (e) {} },
          clear: function () {
            try { Object.keys(root.localStorage).forEach(function (k) { if (k.indexOf('demo:') === 0) root.localStorage.removeItem(k); }); } catch (e) {}
          }
        };
      }
    } catch (e) {}
    return { get: function (k) { return mem[k] ? JSON.parse(mem[k]) : null; },
             set: function (k, v) { mem[k] = JSON.stringify(v); }, clear: function () { mem = {}; } };
  })();

  // ---------- Fechas con zona horaria ----------
  function partes(date, tz) {
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    var o = {};
    f.formatToParts(date).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  var Utilities = {
    formatDate: function (date, tz, pat) {
      var p = partes(date, tz);
      return pat.replace('yyyy', p.year).replace('yy', p.year.slice(2)).replace('MM', p.month)
        .replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
    },
    parseDate: function (s, tz) {
      var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
      if (!m) throw new Error('Fecha no válida: ' + s);
      var guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      for (var i = 0; i < 2; i++) {
        var p = partes(new Date(guess), tz);
        var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
        guess += Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - asUtc;
      }
      return new Date(guess);
    }
  };

  // ---------- Hoja de cálculo ----------
  function cargarLibro() { return store.get('libro') || {}; }
  function guardarLibro(l) { store.set('libro', l); }

  function Rango(hoja, r, c, nr, nc) {
    this.values = function () {
      var d = cargarLibro()[hoja] || [], out = [];
      for (var i = 0; i < nr; i++) {
        var fila = [];
        for (var j = 0; j < nc; j++) {
          var v = (d[r - 1 + i] || [])[c - 1 + j];
          fila.push(v === undefined || v === null ? '' : v);
        }
        out.push(fila);
      }
      return out;
    };
    this.getValues = this.values;
    this.setValues = function (vals) {
      var l = cargarLibro(), d = l[hoja] || (l[hoja] = []);
      for (var i = 0; i < vals.length; i++) {
        var fila = d[r - 1 + i] || (d[r - 1 + i] = []);
        for (var j = 0; j < vals[i].length; j++) fila[c - 1 + j] = vals[i][j];
      }
      for (var k = 0; k < d.length; k++) if (!d[k]) d[k] = [];
      guardarLibro(l);
      return this;
    };
    this.setFontWeight = function () { return this; };
    this.setNumberFormat = function () { return this; };
  }

  function Hoja(nombre) {
    var self = this;
    function datos() { return cargarLibro()[nombre] || []; }
    this.getName = function () { return nombre; };
    this.getLastRow = function () { return datos().length; };
    this.getLastColumn = function () { return datos().reduce(function (m, f) { return Math.max(m, f.length); }, 0); };
    this.getRange = function (r, c, nr, nc) { return new Rango(nombre, r, c, nr || 1, nc || 1); };
    this.getDataRange = function () {
      return new Rango(nombre, 1, 1, Math.max(self.getLastRow(), 1), Math.max(self.getLastColumn(), 1));
    };
    this.appendRow = function (fila) {
      var l = cargarLibro();
      (l[nombre] = l[nombre] || []).push(fila.slice());
      guardarLibro(l);
      return self;
    };
    this.deleteRow = function (n) {
      var l = cargarLibro();
      (l[nombre] || []).splice(n - 1, 1);
      guardarLibro(l);
    };
    this.setFrozenRows = function () {};
  }

  var libro = {
    getSheetByName: function (n) { return cargarLibro()[n] ? new Hoja(n) : null; },
    insertSheet: function (n) { var l = cargarLibro(); l[n] = l[n] || []; guardarLibro(l); return new Hoja(n); },
    getSheets: function () { return Object.keys(cargarLibro()).map(function (n) { return new Hoja(n); }); },
    deleteSheet: function (h) { var l = cargarLibro(); delete l[h.getName()]; guardarLibro(l); }
  };
  var SpreadsheetApp = { getActiveSpreadsheet: function () { return libro; } };

  // ---------- Calendario ----------
  function cargarEventos() { return store.get('eventos') || []; }
  function guardarEventos(e) { store.set('eventos', e); }
  function Evento(id) {
    function mod(fn) {
      var es = cargarEventos(), e = es.filter(function (x) { return x.id === id; })[0];
      if (!e) throw new Error('Evento inexistente');
      var r = fn(e);
      guardarEventos(es);
      return r;
    }
    function leer(k) { return mod(function (e) { return e[k]; }); }
    this.getId = function () { return id; };
    this.getTitle = function () { return leer('titulo'); };
    this.setTitle = function (t) { mod(function (e) { e.titulo = t; }); return this; };
    this.getDescription = function () { return leer('desc'); };
    this.setDescription = function (t) { mod(function (e) { e.desc = t; }); return this; };
    this.getStartTime = function () { return new Date(leer('ini')); };
    this.getEndTime = function () { return new Date(leer('fin')); };
    this.setTime = function (a, b) { mod(function (e) { e.ini = a.getTime(); e.fin = b.getTime(); e.diaCompleto = false; }); return this; };
    this.isAllDayEvent = function () { return !!leer('diaCompleto'); };
    this.setTag = function (k, v) { mod(function (e) { e.tags = e.tags || {}; e.tags[k] = v; }); return this; };
    this.getTag = function (k) { return mod(function (e) { return (e.tags || {})[k] || null; }); };
    this.setColor = function (c) { mod(function (e) { e.color = c; }); return this; };
    this.deleteEvent = function () { guardarEventos(cargarEventos().filter(function (x) { return x.id !== id; })); };
  }
  var calendario = {
    getId: function () { return 'demo-calendario'; },
    getName: function () { return 'Calendario de demostración'; },
    getEventById: function (id) { return cargarEventos().some(function (x) { return x.id === id; }) ? new Evento(id) : null; },
    createEvent: function (t, a, b, o) {
      var es = cargarEventos(), id = 'ev' + Date.now() + Math.floor(Math.random() * 1000);
      es.push({ id: id, titulo: t, ini: a.getTime(), fin: b.getTime(), desc: (o && o.description) || '', tags: {} });
      guardarEventos(es);
      return new Evento(id);
    },
    createAllDayEvent: function (t, a, b, o) {
      var ev = calendario.createEvent(t, a, b, o);
      var es = cargarEventos(); es[es.length - 1].diaCompleto = true; guardarEventos(es);
      return ev;
    },
    getEvents: function (a, b) {
      return cargarEventos().filter(function (x) { return x.ini < b.getTime() && x.fin > a.getTime(); })
        .map(function (x) { return new Evento(x.id); });
    }
  };
  var CalendarApp = {
    EventColor: { GREEN: '10', YELLOW: '5' },
    getCalendarById: function (id) { return id === 'demo-calendario' ? calendario : null; },
    getCalendarsByName: function () { return [calendario]; },
    createCalendar: function () { return calendario; },
    _calendario: calendario
  };

  var props = {
    getProperty: function (k) { return (store.get('props') || {})[k] || null; },
    setProperty: function (k, v) { var p = store.get('props') || {}; p[k] = v; store.set('props', p); }
  };

  root.SpreadsheetApp = SpreadsheetApp;
  root.CalendarApp = CalendarApp;
  root.Utilities = Utilities;
  root.PropertiesService = { getScriptProperties: function () { return props; } };
  root.LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } };
  root.ContentService = { MimeType: { JSON: 'json' },
    createTextOutput: function (t) { return { t: t, setMimeType: function () { return t; } }; } };
  root.Logger = { log: function () {} };
  root.__GAS_RESET__ = function () { store.clear(); };
})(typeof window !== 'undefined' ? window : globalThis);
