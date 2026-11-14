/* Casa María Madre – app de gestión de ocupación (v1) */
(function () {
  'use strict';
  var C = window.CONFIG || {};
  var DEMO = !C.API_URL;
  var VERSION = '1.0.0';
  var S = { clave: null, gestor: null, datos: null, mes: null, sinConexion: false, filtro: 'proximas', verCanceladas: false };
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var vista = $('#vista');

  // ---------------- Almacenamiento local (con protección) ----------------
  function lsGet(k) { try { return JSON.parse(localStorage.getItem('mm:' + k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('mm:' + k, JSON.stringify(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem('mm:' + k); } catch (e) {} }

  // ---------------- Utilidades ----------------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function aFecha(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function aTexto(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoyTxt() { return aTexto(new Date()); }
  function legible(s) { var p = String(s).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function sumaDias(s, n) { var d = aFecha(s); d.setDate(d.getDate() + n); return aTexto(d); }
  function noches(r) { return Math.round((aFecha(r.salida) - aFecha(r.entrada)) / 864e5); }
  function momento(f, h) { return f + 'T' + h; }
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function nombreMes(d) { var t = d.toLocaleDateString('es-ES', { month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1) + ' ' + d.getFullYear(); }
  function diaSemana(s) { return aFecha(s).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); }

  function toast(msg, error) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (error ? ' error' : ''); t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, error ? 5000 : 2600);
  }
  function cargando(on) { $('#cargando').hidden = !on; }
  function confirmar(texto, boton, peligro) {
    return new Promise(function (ok) {
      var m = $('#modal');
      m.innerHTML = '<div class="caja"><p>' + texto + '</p><div class="fila-btns">' +
        '<button class="btn borde" data-r="0">Volver</button>' +
        '<button class="btn ' + (peligro ? 'peligro' : '') + '" data-r="1">' + esc(boton) + '</button></div></div>';
      m.hidden = false;
      m.onclick = function (e) {
        var b = e.target.closest('[data-r]');
        if (b || e.target === m) { m.hidden = true; ok(b && b.dataset.r === '1'); }
      };
    });
  }

  // ---------------- Comunicación con Google (o demostración) ----------------
  var demoListo = null;
  function cargarScript(src) {
    return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { ko(new Error('No se encuentra el archivo ' + src + '. ¿Se subió la carpeta «demo» a GitHub?')); }; document.head.appendChild(s); });
  }
  function prepararDemo() {
    if (!demoListo) {
      demoListo = cargarScript('demo/gas-mock.js').then(function () { return cargarScript('demo/codigo.js'); }).then(function () {
        window.CLAVE_ACCESO = 'demo';
        if (!lsGet('demoIniciada')) {
          window.configurar();
          var e1 = sumaDias(hoyTxt(), 5);
          var p = function (d) { return window.atender({ clave: 'demo', gestor: 'Demo', accion: 'guardarReserva', datos: d }); };
          p({ reserva: { grupo: 'Retiro parroquial (ejemplo)', responsable: 'Ana López', telefono: '600 000 000', entrada: e1, salida: sumaDias(e1, 2) },
            asignaciones: [{ habitacion: 16, personas: 3 }, { habitacion: 17, personas: 3 }, { habitacion: 18, personas: 3 }, { habitacion: 19, personas: 5 }, { habitacion: 11, personas: 2 }, { habitacion: 12, personas: 2 }] });
          var e2 = sumaDias(e1, 16);
          p({ reserva: { grupo: 'Ejercicios espirituales (ejemplo)', responsable: 'Luis Pérez', telefono: '611 111 111', entrada: e2, salida: sumaDias(e2, 4), estado: 'Provisional' },
            asignaciones: [{ habitacion: 23, personas: 4 }, { habitacion: 24, personas: 4 }, { habitacion: 25, personas: 3 }] });
          lsSet('demoIniciada', true);
        }
      });
    }
    return demoListo;
  }

  function api(accion, datos) {
    var pet = { clave: S.clave, gestor: S.gestor, accion: accion, datos: datos || {} };
    var p = DEMO
      ? prepararDemo().then(function () { return new Promise(function (ok) { setTimeout(function () { ok(window.atender(JSON.parse(JSON.stringify(pet)))); }, 250); }); })
      : fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(pet), redirect: 'follow' })
          .then(function (r) { if (!r.ok) throw new Error('El servidor respondió ' + r.status); return r.json(); })
          .catch(function (e) { if (e instanceof TypeError) { var x = new Error(navigator.onLine === false ? 'Sin conexión. Revisa la cobertura e inténtalo de nuevo.' : 'No se pudo conectar con Google. Revisa que API_URL termine en /exec y que el script esté implementado para «Cualquier usuario».'); x.red = true; throw x; } if (e instanceof SyntaxError) throw new Error('Google no devolvió datos válidos. Revisa la implementación del script.'); throw e; });
    return p.then(function (r) {
      if (!r || !r.ok) {
        var err = new Error((r && r.error) || 'Error desconocido');
        err.codigo = r && r.codigo;
        throw err;
      }
      if (r.datos && r.datos.estado) fijarDatos(r.datos.estado);
      if (accion === 'inicial') fijarDatos(r.datos);
      return r.datos;
    });
  }

  function fijarDatos(d) {
    S.datos = d; S.sinConexion = false;
    lsSet('cache', { datos: d, cuando: Date.now() });
    avisoConexion();
  }

  function avisoConexion() {
    var a = $('#aviso');
    if (S.sinConexion) {
      var c = lsGet('cache');
      a.className = 'aviso';
      a.textContent = 'Sin conexión: datos del ' + (c ? new Date(c.cuando).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—') + '. No se pueden guardar cambios.';
      a.hidden = false;
    } else if (DEMO) {
      a.className = 'aviso demo';
      a.textContent = 'MODO DEMOSTRACIÓN · los datos solo se guardan en este dispositivo';
      a.hidden = false;
    } else a.hidden = true;
  }

  function recargar(silencioso) {
    if (!silencioso) cargando(true);
    return api('inicial').then(function () { pintar(); })
      .catch(function (e) {
        if (e.codigo === 'CLAVE') return salir('La clave ya no es válida. Vuelve a entrar.');
        var c = lsGet('cache');
        if (e.red && c) { S.datos = c.datos; S.sinConexion = true; avisoConexion(); pintar(); }
        else toast(e.message, true);
      })
      .then(function () { cargando(false); });
  }

  // ---------------- Datos derivados ----------------
  function habitaciones() { return (S.datos && S.datos.habitaciones) || []; }
  function hab(n) { return habitaciones().filter(function (h) { return h.numero === n; })[0]; }
  function capacidadDisponible() { return habitaciones().reduce(function (s, h) { return s + (h.estado === 'Disponible' ? h.capacidad : 0); }, 0); }
  function reservas() { return (S.datos && S.datos.reservas) || []; }
  function reserva(id) { return reservas().filter(function (r) { return r.id === id; })[0]; }
  function activas() { return reservas().filter(function (r) { return r.estado !== 'Cancelada'; }); }
  function ordenar(a) { return a.slice().sort(function (x, y) { return (x.entrada + x.horaEntrada).localeCompare(y.entrada + y.horaEntrada); }); }
  function claseEstado(r) { return r.estado === 'Provisional' ? 'provisional' : r.estado === 'Cancelada' ? 'cancelada' : ''; }

  // ---------------- Navegación ----------------
  var TITULOS = { calendario: 'Calendario', reservas: 'Reservas', nueva: 'Nueva reserva', editar: 'Editar reserva', reserva: 'Reserva', ajustes: 'Ajustes' };
  function ruta() {
    var h = location.hash.replace(/^#\/?/, '');
    var q = {}, partes = h.split('?');
    (partes[1] || '').split('&').forEach(function (kv) { if (kv) { var p = kv.split('='); q[p[0]] = decodeURIComponent(p[1] || ''); } });
    var seg = partes[0].split('/');
    return { vista: seg[0] || 'calendario', id: seg[1] ? decodeURIComponent(seg[1]) : null, q: q };
  }
  function ir(h) { if (location.hash === '#/' + h) pintar(); else location.hash = '/' + h; }

  function pintar() {
    if (!S.clave) return pintarLogin();
    if (!S.datos) return;
    var r = ruta();
    $('#menu').hidden = false; $('#btnRecargar').hidden = false;
    $('#tituloVista').textContent = TITULOS[r.vista] || '';
    Array.prototype.forEach.call(document.querySelectorAll('.menu button'), function (b) {
      b.classList.toggle('activo', b.dataset.ir === r.vista || (b.dataset.ir === 'reservas' && r.vista === 'reserva'));
    });
    window.scrollTo(0, 0);
    switch (r.vista) {
      case 'reservas': return pintarLista();
      case 'reserva': return pintarDetalle(r.id);
      case 'nueva': return pintarFormulario(null, r.q.fecha);
      case 'editar': return pintarFormulario(r.id);
      case 'ajustes': return pintarAjustes();
      default: return pintarCalendario();
    }
  }

  // ---------------- Login ----------------
  function pintarLogin(msg) {
    $('#menu').hidden = true; $('#btnRecargar').hidden = true;
    $('#tituloVista').textContent = 'Acceso';
    var gestores = C.GESTORES || [];
    var elegido = lsGet('gestor') || '';
    vista.innerHTML =
      '<div class="login">' +
      '<img class="logo" src="icons/icon-192.png" alt="">' +
      '<h1>' + esc(C.NOMBRE_CASA || 'Casa') + '</h1><p class="sub">' + esc(C.SUBTITULO || '') + ' · Gestión de ocupación</p>' +
      '<div class="tarjeta">' +
      '<label class="campo"><span>Clave de acceso</span><input class="entrada" id="lClave" type="password" autocomplete="current-password" placeholder="' + (DEMO ? 'En demostración: demo' : 'Clave compartida') + '"></label>' +
      '<label class="campo"><span>¿Quién eres?</span></label><div class="chips" id="lGestores">' +
      gestores.map(function (g) { return '<button type="button" class="chip' + (g === elegido ? ' activo' : '') + '">' + esc(g) + '</button>'; }).join('') +
      '</div><p class="error-txt" id="lError">' + esc(msg || '') + '</p>' +
      '<button class="btn ancho" id="lEntrar" style="margin-top:14px">Entrar</button></div></div>';
    $('#lGestores').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      Array.prototype.forEach.call(this.children, function (c) { c.classList.remove('activo'); });
      b.classList.add('activo'); elegido = b.textContent;
    };
    if (DEMO) $('#lClave').value = 'demo';
    function entrar() {
      var clave = $('#lClave').value.trim();
      if (!clave) return ($('#lError').textContent = 'Escribe la clave.');
      if (!elegido) return ($('#lError').textContent = 'Indica quién eres.');
      S.clave = clave; S.gestor = elegido;
      cargando(true);
      api('inicial').then(function () {
        lsSet('clave', clave); lsSet('gestor', elegido);
        if (!location.hash || location.hash === '#/') location.hash = '/calendario'; else pintar();
      }).catch(function (e) {
        S.clave = null;
        $('#lError').textContent = e.codigo === 'CLAVE' ? 'Clave incorrecta.' : (e.message || 'No se pudo conectar. Revisa la dirección API_URL de config.js.');
      }).then(function () { cargando(false); });
    }
    $('#lEntrar').onclick = entrar;
    $('#lClave').onkeydown = function (e) { if (e.key === 'Enter') entrar(); };
  }

  function salir(msg) {
    lsDel('clave'); lsDel('cache'); S.clave = null; S.datos = null;
    pintarLogin(msg);
  }

  // ---------------- Calendario ----------------
  function pintarCalendario() {
    var hoy = new Date();
    if (!S.mes) S.mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    var m = S.mes, primero = new Date(m.getFullYear(), m.getMonth(), 1);
    var inicio = new Date(primero); inicio.setDate(1 - ((primero.getDay() + 6) % 7));
    var acts = ordenar(activas());
    var celdas = '';
    for (var i = 0; i < 42; i++) {
      var d = new Date(inicio); d.setDate(inicio.getDate() + i);
      var t = aTexto(d);
      if (i >= 35 && d.getMonth() !== m.getMonth()) break;
      var occ = acts.filter(function (r) { return t >= r.entrada && t <= r.salida; });
      var r0 = occ.filter(function (r) { return r.entrada === t; })[0] || occ[0];
      var cls = 'dia' + (d.getMonth() !== m.getMonth() ? ' fuera' : '') + (t === hoyTxt() ? ' hoy' : '');
      var et = '';
      if (r0) {
        cls += ' ocupado ' + claseEstado(r0) + (r0.entrada === t ? ' inicio' : '') + (r0.salida === t ? ' fin' : '');
        if (r0.entrada === t || d.getDay() === 1) et = '<span class="et">' + esc(r0.grupo.split(' ').slice(0, 2).join(' ')) + '</span>';
        if (occ.length > 1) cls = cls.replace(' inicio', '').replace(' fin', '');
      }
      celdas += '<button class="' + cls + '" data-f="' + t + '" data-id="' + (r0 ? esc(r0.id) : '') + '"><span class="n">' + d.getDate() + '</span>' + et + (r0 ? '<span class="marca"></span>' : '') + '</button>';
    }
    var finMes = aTexto(new Date(m.getFullYear(), m.getMonth() + 1, 0)), iniMes = aTexto(primero);
    var delMes = acts.filter(function (r) { return r.entrada <= finMes && r.salida >= iniMes; });
    var diasOcup = {};
    delMes.forEach(function (r) { for (var f = r.entrada; f <= r.salida; f = sumaDias(f, 1)) if (f >= iniMes && f <= finMes) diasOcup[f] = 1; });
    vista.innerHTML =
      '<div class="tarjeta">' +
      '<div class="mes-cab"><button class="icono" id="cAnt" aria-label="Mes anterior">‹</button><h2>' + esc(nombreMes(m)) + '</h2><button class="icono" id="cSig" aria-label="Mes siguiente">›</button></div>' +
      '<div class="dias-sem"><div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div><div>D</div></div>' +
      '<div class="rejilla" id="rejilla">' + celdas + '</div>' +
      '<div class="leyenda"><span><i style="background:var(--ok)"></i>Confirmada</span><span><i style="background:var(--prov)"></i>Provisional</span><span>Toca un día libre para reservar</span></div>' +
      '</div>' +
      '<div class="kpis"><div class="kpi"><b>' + delMes.length + '</b><span>reservas en el mes</span></div>' +
      '<div class="kpi"><b>' + Object.keys(diasOcup).length + '</b><span>días ocupados</span></div>' +
      '<div class="kpi"><b>' + capacidadDisponible() + '</b><span>plazas disponibles</span></div></div>' +
      (delMes.length ? '<h3>Este mes</h3>' + delMes.map(tarjetaReserva).join('') : '<div class="vacio">Sin reservas este mes.</div>') +
      (m.getFullYear() !== hoy.getFullYear() || m.getMonth() !== hoy.getMonth() ? '<button class="btn sec ancho" id="cHoy">Volver a hoy</button>' : '');
    $('#cAnt').onclick = function () { S.mes = new Date(m.getFullYear(), m.getMonth() - 1, 1); pintarCalendario(); };
    $('#cSig').onclick = function () { S.mes = new Date(m.getFullYear(), m.getMonth() + 1, 1); pintarCalendario(); };
    if ($('#cHoy')) $('#cHoy').onclick = function () { S.mes = null; pintarCalendario(); };
    $('#rejilla').onclick = function (e) {
      var b = e.target.closest('.dia'); if (!b) return;
      if (b.dataset.id) ir('reserva/' + encodeURIComponent(b.dataset.id));
      else if (b.dataset.f >= hoyTxt()) ir('nueva?fecha=' + b.dataset.f);
      else toast('Ese día ya ha pasado.');
    };
    enlazarTarjetas();
  }

  function tarjetaReserva(r) {
    var f = aFecha(r.entrada);
    return '<button class="reserva ' + claseEstado(r) + '" data-id="' + esc(r.id) + '">' +
      '<div class="fecha"><span class="d">' + f.getDate() + '</span><span class="m">' + MESES[f.getMonth()] + '</span></div>' +
      '<div class="info"><b>' + esc(r.grupo) + '</b>' +
      '<span class="sub">' + legible(r.entrada) + ' → ' + legible(r.salida) + ' · ' + noches(r) + ' noche' + (noches(r) === 1 ? '' : 's') + '</span><br>' +
      '<span class="sub">' + r.personas + ' personas</span> ' +
      (r.estado !== 'Confirmada' ? '<span class="etiqueta ' + claseEstado(r) + '">' + esc(r.estado) + '</span>' : '') +
      '</div></button>';
  }
  function enlazarTarjetas() {
    Array.prototype.forEach.call(document.querySelectorAll('.reserva[data-id]'), function (b) {
      b.onclick = function () { ir('reserva/' + encodeURIComponent(b.dataset.id)); };
    });
  }

  // ---------------- Lista ----------------
  function pintarLista() {
    var hoy = hoyTxt();
    var lista = reservas().filter(function (r) {
      if (r.estado === 'Cancelada' && !S.verCanceladas) return false;
      return S.filtro === 'proximas' ? r.salida >= hoy : r.salida < hoy;
    });
    lista = ordenar(lista); if (S.filtro === 'pasadas') lista.reverse();
    vista.innerHTML =
      '<div class="segmento" id="lFiltro" style="margin-bottom:12px"><button data-f="proximas" class="' + (S.filtro === 'proximas' ? 'activo' : '') + '">Próximas</button><button data-f="pasadas" class="' + (S.filtro === 'pasadas' ? 'activo' : '') + '">Pasadas</button></div>' +
      '<label class="sub" style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" id="lCanc"' + (S.verCanceladas ? ' checked' : '') + '> Mostrar canceladas</label>' +
      (lista.length ? lista.map(tarjetaReserva).join('') : '<div class="vacio">No hay reservas ' + (S.filtro === 'proximas' ? 'próximas' : 'pasadas') + '.</div>');
    $('#lFiltro').onclick = function (e) { var b = e.target.closest('button'); if (b) { S.filtro = b.dataset.f; pintarLista(); } };
    $('#lCanc').onchange = function () { S.verCanceladas = this.checked; pintarLista(); };
    enlazarTarjetas();
  }

  // ---------------- Plano ----------------
  var PLANO_SUP = [11, 12, 'ESCALERAS', 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  var PLANO_INF = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 'ESC. / ASC.', 25, 24, 23];
  function plano(asig) {
    var map = {}; (asig || []).forEach(function (a) { map[a.habitacion] = a.personas; });
    function celda(x) {
      if (typeof x === 'string') return '<div class="hab esc"' + (x === 'ESCALERAS' ? ' style="grid-column:span 2"' : '') + '>' + x + '</div>';
      var h = hab(x); if (!h) return '<div class="hab"></div>';
      var p = map[x] || 0;
      var cls = h.estado !== 'Disponible' ? 'cerrada' : p >= h.capacidad ? 'llena' : p > 0 ? 'usada' : '';
      return '<div class="hab ' + cls + '"><b>' + x + '</b>' + (h.estado !== 'Disponible' ? '—' : p + '/' + h.capacidad) + '</div>';
    }
    return '<div class="plano"><div class="plano-fila">' + PLANO_SUP.map(celda).join('') + '</div>' +
      '<div class="pasillo">PASILLO</div><div class="plano-fila">' + PLANO_INF.map(celda).join('') + '</div></div>' +
      '<div class="leyenda"><span><i style="background:var(--ok-suave);border:1.5px solid var(--ok)"></i>Completa</span><span><i style="background:var(--pri-suave);border:1.5px solid var(--pri-2)"></i>Parcial</span><span><i style="background:#e6e6e6"></i>Cerrada</span></div>';
  }

  // ---------------- Detalle ----------------
  function pintarDetalle(id) {
    var r = reserva(id);
    if (!r) { vista.innerHTML = '<div class="vacio">La reserva no existe.</div>'; return; }
    $('#tituloVista').textContent = r.grupo;
    var cap = capacidadDisponible();
    var tel = String(r.telefono || '').replace(/[^\d+]/g, '');
    vista.innerHTML =
      '<div class="tarjeta"><span class="etiqueta ' + claseEstado(r) + '">' + esc(r.estado) + '</span>' +
      '<h2 style="margin-top:8px">' + esc(r.grupo) + '</h2>' +
      '<div class="dato"><span>Entrada</span><span>' + esc(diaSemana(r.entrada)) + ' · ' + esc(r.horaEntrada) + '</span></div>' +
      '<div class="dato"><span>Salida</span><span>' + esc(diaSemana(r.salida)) + ' · ' + esc(r.horaSalida) + '</span></div>' +
      '<div class="dato"><span>Noches</span><span>' + noches(r) + '</span></div>' +
      '<div class="dato"><span>Responsable</span><span>' + esc(r.responsable || '—') + '</span></div>' +
      '<div class="dato"><span>Teléfono</span><span>' + (tel ? '<a href="tel:' + esc(tel) + '">' + esc(r.telefono) + '</a>' : '—') + '</span></div>' +
      (r.email ? '<div class="dato"><span>Email</span><span>' + esc(r.email) + '</span></div>' : '') +
      (r.observaciones ? '<div class="dato"><span>Observaciones</span><span>' + esc(r.observaciones) + '</span></div>' : '') +
      '</div>' +
      '<div class="kpis"><div class="kpi"><b>' + r.personas + '</b><span>personas</span></div>' +
      '<div class="kpi"><b>' + r.asignaciones.length + '</b><span>habitaciones</span></div>' +
      '<div class="kpi"><b>' + (cap ? Math.round(r.personas * 100 / cap) : 0) + '%</b><span>de ' + cap + ' plazas</span></div></div>' +
      '<div class="tarjeta"><h2>Habitaciones</h2>' + plano(r.asignaciones) + '</div>' +
      (r.estado !== 'Cancelada' ?
        '<div class="fila-btns">' + (tel ? '<a class="btn sec" href="tel:' + esc(tel) + '">Llamar</a>' : '') +
        '<button class="btn" id="dEditar">Editar</button></div>' +
        '<button class="btn peligro ancho" id="dCancelar" style="margin-top:10px">Cancelar reserva</button>' : '') +
      '<p class="sub" style="margin-top:16px;font-size:12px">Creada por ' + esc(r.creadoPor || '—') + ' (' + esc(r.creadoEl || '') + ')' +
      (r.modificadoEl && r.modificadoEl !== r.creadoEl ? ' · Modificada por ' + esc(r.modificadoPor) + ' (' + esc(r.modificadoEl) + ')' : '') + '</p>';
    if ($('#dEditar')) $('#dEditar').onclick = function () { ir('editar/' + encodeURIComponent(r.id)); };
    if ($('#dCancelar')) $('#dCancelar').onclick = function () {
      if (S.sinConexion) return toast('Sin conexión: no se puede cancelar ahora.', true);
      confirmar('¿Cancelar la reserva de <b>' + esc(r.grupo) + '</b>? Se quitará del calendario y las fechas quedarán libres.', 'Sí, cancelar', true).then(function (ok) {
        if (!ok) return;
        cargando(true);
        api('cancelarReserva', { id: r.id }).then(function () { toast('Reserva cancelada'); ir('calendario'); })
          .catch(function (e) { toast(e.message, true); }).then(function () { cargando(false); });
      });
    };
  }

  // ---------------- Formulario ----------------
  function pintarFormulario(id, fecha) {
    var aj = (S.datos && S.datos.ajustes) || {};
    var r = id ? reserva(id) : null;
    if (id && !r) { vista.innerHTML = '<div class="vacio">La reserva no existe.</div>'; return; }
    var f = r ? JSON.parse(JSON.stringify(r)) : {
      grupo: '', responsable: '', telefono: '', email: '', entrada: fecha || '', horaEntrada: aj.horaEntrada || '12:00',
      salida: fecha ? sumaDias(fecha, 2) : '', horaSalida: aj.horaSalida || '16:00', estado: 'Confirmada', observaciones: '', asignaciones: []
    };
    var asig = {}; (f.asignaciones || []).forEach(function (a) { asig[a.habitacion] = a.personas; });
    var habs = habitaciones().slice().sort(function (a, b) { return a.numero - b.numero; });

    function filaHab(h) {
      var p = asig[h.numero] || 0, cerrada = h.estado !== 'Disponible';
      return '<div class="item' + (cerrada ? ' cerrada' : '') + '" data-n="' + h.numero + '">' +
        '<div class="nom"><b>Hab. ' + h.numero + '</b><small>' + esc(h.tipo) + ' · ' + esc(h.camas) + (cerrada ? ' · CERRADA' : '') + '</small></div>' +
        (cerrada ? '<span class="sub">No disponible</span>' :
          '<div class="paso"><button type="button" data-d="-1" aria-label="Quitar"' + (p <= 0 ? ' disabled' : '') + '>−</button>' +
          '<output class="' + (p >= h.capacidad ? 'lleno' : '') + '">' + p + '/' + h.capacidad + '</output>' +
          '<button type="button" data-d="1" aria-label="Añadir"' + (p >= h.capacidad ? ' disabled' : '') + '>+</button></div>') +
        '</div>';
    }
    var sup = habs.filter(function (h) { return /superior/i.test(h.ubicacion); });
    var inf = habs.filter(function (h) { return !/superior/i.test(h.ubicacion); });
    vista.innerHTML =
      '<div class="tarjeta"><h2>Grupo</h2>' +
      '<label class="campo"><span>Nombre del grupo / retiro *</span><input class="entrada" id="fGrupo" value="' + esc(f.grupo) + '" maxlength="80" autocomplete="off"></label>' +
      '<label class="campo"><span>Responsable</span><input class="entrada" id="fResp" value="' + esc(f.responsable) + '" maxlength="80" autocomplete="off"></label>' +
      '<label class="campo"><span>Teléfono del responsable</span><input class="entrada" id="fTel" type="tel" inputmode="tel" value="' + esc(f.telefono) + '" maxlength="30"></label>' +
      '<label class="campo"><span>Email (opcional)</span><input class="entrada" id="fEmail" type="email" inputmode="email" value="' + esc(f.email) + '" maxlength="80"></label>' +
      '</div>' +
      '<div class="tarjeta"><h2>Fechas</h2>' +
      '<div class="dos"><label class="campo"><span>Entrada *</span><input class="entrada" id="fEnt" type="date" value="' + esc(f.entrada) + '"></label>' +
      '<label class="campo"><span>Hora</span><input class="entrada" id="fHEnt" type="time" value="' + esc(f.horaEntrada) + '"></label></div>' +
      '<div class="dos"><label class="campo"><span>Salida *</span><input class="entrada" id="fSal" type="date" value="' + esc(f.salida) + '"></label>' +
      '<label class="campo"><span>Hora</span><input class="entrada" id="fHSal" type="time" value="' + esc(f.horaSalida) + '"></label></div>' +
      '<p class="error-txt" id="fFechasErr"></p>' +
      '<label class="campo"><span>Estado</span></label><div class="segmento" id="fEstado"><button type="button" data-e="Confirmada">Confirmada</button><button type="button" data-e="Provisional">Provisional</button></div>' +
      '<label class="campo" style="margin-top:12px"><span>Observaciones</span><textarea class="entrada" id="fObs" maxlength="500">' + esc(f.observaciones) + '</textarea></label>' +
      '</div>' +
      '<div class="tarjeta"><h2>Habitaciones</h2><p class="sub" style="margin-top:-6px">Indica cuántas personas van en cada habitación.</p>' +
      '<div class="fila-btns" style="margin-bottom:6px"><button type="button" class="btn sec" id="fAuto">Repartir automáticamente</button><button type="button" class="btn borde" id="fVaciar">Vaciar</button></div>' +
      '<h3>Fila superior</h3><div class="lista-hab" id="fHabsSup">' + sup.map(filaHab).join('') + '</div>' +
      '<h3>Fila inferior</h3><div class="lista-hab" id="fHabsInf">' + inf.map(filaHab).join('') + '</div></div>' +
      '<div class="form-espacio"></div>' +
      '<div class="pie-form"><div class="total" id="fTotal"></div><button class="btn" id="fGuardar">Guardar</button></div>';

    var estado = f.estado === 'Provisional' ? 'Provisional' : 'Confirmada';
    function pintaEstado() { Array.prototype.forEach.call($('#fEstado').children, function (b) { b.classList.toggle('activo', b.dataset.e === estado); }); }
    pintaEstado();
    $('#fEstado').onclick = function (e) { var b = e.target.closest('button'); if (b) { estado = b.dataset.e; pintaEstado(); } };

    function total() { return Object.keys(asig).reduce(function (s, k) { return s + (asig[k] || 0); }, 0); }
    function pintaTotal() {
      var t = total(), cap = capacidadDisponible(), prev = C.CAPACIDAD_PREVISTA;
      $('#fTotal').innerHTML = '<b>' + t + '</b> / ' + cap + ' personas' + (prev && t > prev ? '<br><span style="color:var(--prov)">Supera la previsión de ' + prev + '</span>' : '');
    }
    function refrescaHab(n) {
      var h = hab(n), el = vista.querySelector('.item[data-n="' + n + '"]');
      if (el) el.outerHTML = filaHab(h);
      pintaTotal();
    }
    function alPulsar(e) {
      var b = e.target.closest('button[data-d]'); if (!b) return;
      var n = Number(b.closest('.item').dataset.n), h = hab(n);
      asig[n] = Math.max(0, Math.min(h.capacidad, (asig[n] || 0) + Number(b.dataset.d)));
      refrescaHab(n);
    }
    $('#fHabsSup').onclick = alPulsar; $('#fHabsInf').onclick = alPulsar;
    $('#fVaciar').onclick = function () { asig = {}; habs.forEach(function (h) { refrescaHab(h.numero); }); };
    $('#fAuto').onclick = function () {
      var m = $('#modal');
      m.innerHTML = '<div class="caja"><p><b>Repartir automáticamente</b><br><span class="sub">Rellena las habitaciones libres por orden, completando cada una.</span></p>' +
        '<label class="campo"><span>Número de personas</span><input class="entrada" id="aN" type="number" inputmode="numeric" min="1" max="' + capacidadDisponible() + '" value="' + (total() || '') + '"></label>' +
        '<div class="fila-btns"><button class="btn borde" data-r="0">Volver</button><button class="btn" data-r="1">Repartir</button></div></div>';
      m.hidden = false; setTimeout(function () { $('#aN').focus(); }, 50);
      m.onclick = function (e) {
        var b = e.target.closest('[data-r]');
        if (!b && e.target !== m) return;
        if (b && b.dataset.r === '1') {
          var n = Math.floor(Number($('#aN').value) || 0), cap = capacidadDisponible();
          if (n < 1) return;
          if (n > cap) { toast('Solo hay ' + cap + ' plazas disponibles.', true); return; }
          asig = {};
          habs.filter(function (h) { return h.estado === 'Disponible'; }).forEach(function (h) {
            if (n <= 0) return; var p = Math.min(h.capacidad, n); asig[h.numero] = p; n -= p;
          });
          habs.forEach(function (h) { refrescaHab(h.numero); });
        }
        m.hidden = true;
      };
    };
    pintaTotal();

    function leer() {
      return {
        id: r ? r.id : undefined, grupo: $('#fGrupo').value.trim(), responsable: $('#fResp').value.trim(),
        telefono: $('#fTel').value.trim(), email: $('#fEmail').value.trim(), entrada: $('#fEnt').value,
        horaEntrada: $('#fHEnt').value || '12:00', salida: $('#fSal').value, horaSalida: $('#fHSal').value || '16:00',
        estado: estado, observaciones: $('#fObs').value.trim()
      };
    }
    function revisarFechas() {
      var d = leer(), err = '';
      if (d.entrada && d.salida) {
        if (momento(d.salida, d.horaSalida) <= momento(d.entrada, d.horaEntrada)) err = 'La salida debe ser posterior a la entrada.';
        else {
          var choque = activas().filter(function (x) {
            return x.id !== d.id && momento(d.entrada, d.horaEntrada) < momento(x.salida, x.horaSalida) && momento(d.salida, d.horaSalida) > momento(x.entrada, x.horaEntrada);
          })[0];
          if (choque) err = 'Se solapa con «' + choque.grupo + '» (' + legible(choque.entrada) + ' → ' + legible(choque.salida) + ').';
        }
      }
      $('#fFechasErr').textContent = err;
      return !err;
    }
    $('#fEnt').onchange = function () {
      if (this.value && (!$('#fSal').value || $('#fSal').value <= this.value)) $('#fSal').value = sumaDias(this.value, 2);
      revisarFechas();
    };
    ['#fSal', '#fHEnt', '#fHSal'].forEach(function (s) { $(s).onchange = revisarFechas; });
    if (f.entrada) revisarFechas();

    $('#fGuardar').onclick = function () {
      if (S.sinConexion) return toast('Sin conexión: no se puede guardar ahora.', true);
      var d = leer();
      if (!d.grupo) { $('#fGrupo').focus(); return toast('Indica el nombre del grupo.', true); }
      if (!d.entrada || !d.salida) return toast('Indica las fechas de entrada y salida.', true);
      if (!revisarFechas()) { $('#fEnt').scrollIntoView({ block: 'center' }); return toast($('#fFechasErr').textContent, true); }
      var asignaciones = Object.keys(asig).filter(function (k) { return asig[k] > 0; }).map(function (k) { return { habitacion: Number(k), personas: asig[k] }; });
      var seguir = asignaciones.length ? Promise.resolve(true) : confirmar('No has asignado ninguna persona a las habitaciones. ¿Guardar igualmente?', 'Guardar');
      seguir.then(function (ok) {
        if (!ok) return;
        cargando(true);
        api('guardarReserva', { reserva: d, asignaciones: asignaciones })
          .then(function (res) { toast(r ? 'Cambios guardados' : 'Reserva creada'); location.replace('#/reserva/' + encodeURIComponent(res.id)); })
          .catch(function (e) { toast(e.message, true); })
          .then(function () { cargando(false); });
      });
    };
  }

  // ---------------- Ajustes ----------------
  function pintarAjustes() {
    var gestores = C.GESTORES || [];
    var c = lsGet('cache');
    vista.innerHTML =
      '<div class="tarjeta"><h2>¿Quién eres?</h2><div class="chips" id="aGest">' +
      gestores.map(function (g) { return '<button class="chip' + (g === S.gestor ? ' activo' : '') + '">' + esc(g) + '</button>'; }).join('') +
      '</div><p class="sub" style="margin:10px 0 0">Queda anotado en cada reserva que crees o modifiques.</p></div>' +
      '<div class="tarjeta"><h2>Datos</h2>' +
      '<p class="sub" style="margin-top:-6px">Última actualización: ' + (c ? new Date(c.cuando).toLocaleString('es-ES') : '—') + '</p>' +
      '<button class="btn sec ancho" id="aRecargar">Actualizar ahora</button></div>' +
      '<div class="tarjeta"><h2>Calendario de Google</h2>' +
      '<p class="sub" style="margin-top:-6px">Importar: convierte en reservas los eventos que se hayan creado a mano en el calendario (formato «Grupo – 25 personas»).<br>Regenerar: vuelve a crear todos los eventos a partir de las reservas.</p>' +
      '<div class="fila-btns"><button class="btn borde" id="aImportar">Importar eventos</button><button class="btn borde" id="aRegenerar">Regenerar calendario</button></div></div>' +
      '<div class="tarjeta"><h2>Casa</h2>' +
      '<div class="dato"><span>Habitaciones disponibles</span><span>' + habitaciones().filter(function (h) { return h.estado === 'Disponible'; }).length + ' de ' + habitaciones().length + '</span></div>' +
      '<div class="dato"><span>Plazas disponibles</span><span>' + capacidadDisponible() + '</span></div>' +
      '<div class="dato"><span>Horario por defecto</span><span>Entrada ' + esc((S.datos.ajustes || {}).horaEntrada || '12:00') + ' · Salida ' + esc((S.datos.ajustes || {}).horaSalida || '16:00') + '</span></div></div>' +
      (DEMO ? '<button class="btn borde ancho" id="aReiniciar" style="margin-bottom:10px">Reiniciar demostración</button>' : '') +
      '<button class="btn peligro ancho" id="aSalir">Cerrar sesión en este móvil</button>' +
      '<p class="sub" style="text-align:center;font-size:12px;margin-top:18px">Versión ' + VERSION + (DEMO ? ' · demostración' : '') + '</p>';
    $('#aGest').onclick = function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      S.gestor = b.textContent; lsSet('gestor', S.gestor); pintarAjustes(); toast('Ahora eres ' + S.gestor);
    };
    $('#aRecargar').onclick = function () { recargar().then(function () { if (!S.sinConexion) toast('Datos actualizados'); }); };
    function accion(nombre, texto, fmt) {
      return function () {
        if (S.sinConexion) return toast('Sin conexión.', true);
        confirmar(texto, 'Continuar').then(function (ok) {
          if (!ok) return;
          cargando(true);
          api(nombre).then(function (d) { toast(fmt(d)); pintarAjustes(); })
            .catch(function (e) { toast(e.message, true); }).then(function () { cargando(false); });
        });
      };
    }
    $('#aImportar').onclick = accion('importarCalendario', 'Se revisarán los eventos del calendario que no vengan de la app y se convertirán en reservas. Los que se solapen con otra reserva se omitirán.',
      function (d) { return d.importadas + ' importadas' + (d.omitidas.length ? ' · ' + d.omitidas.length + ' omitidas: ' + d.omitidas.join('; ') : ''); });
    $('#aRegenerar').onclick = accion('regenerarCalendario', 'Se borrarán los eventos creados por la app y se volverán a crear desde las reservas. Úsalo si alguien ha modificado el calendario a mano.',
      function (d) { return d.eventos + ' eventos regenerados'; });
    if ($('#aReiniciar')) $('#aReiniciar').onclick = function () {
      confirmar('Se borrarán los datos de demostración de este dispositivo.', 'Reiniciar', true).then(function (ok) {
        if (!ok) return;
        window.__GAS_RESET__ && window.__GAS_RESET__(); lsDel('demoIniciada'); lsDel('cache');
        location.reload();
      });
    };
    $('#aSalir').onclick = function () {
      confirmar('Tendrás que volver a escribir la clave para entrar.', 'Cerrar sesión', true).then(function (ok) { if (ok) salir(); });
    };
  }

  // ---------------- Arranque ----------------
  $('#tituloCasa').textContent = C.NOMBRE_CASA || 'Casa';
  $('#menu').onclick = function (e) {
    var b = e.target.closest('button[data-ir]'); if (!b) return;
    if (b.dataset.ir === 'calendario') S.mes = null;
    ir(b.dataset.ir);
  };
  $('#btnRecargar').onclick = function () { recargar(); };
  window.addEventListener('hashchange', pintar);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.clave && S.datos) recargar(true); });
  avisoConexion();

  S.clave = lsGet('clave'); S.gestor = lsGet('gestor');
  if (S.clave) {
    var c = lsGet('cache');
    if (c) { S.datos = c.datos; pintar(); }
    recargar(!!c);
  } else pintarLogin();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
