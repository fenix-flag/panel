/* FENIX · Panel Central
 * Single-page app sin dependencias. Habla con el Apps Script (kind:'panel').
 * Rutas: #/inicio · #/torneos · #/torneo/<id>[/<pestaña>] · #/nuevo · #/biblioteca[/equipos] · #/config
 */
'use strict';

/* =====================================================================
 *  Utilidades
 * ===================================================================== */
const view = document.getElementById('view');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const esFenix = n => norm(n) === 'fenix';
const pad2 = n => (n < 10 ? '0' : '') + n;
const iniciales = n => String(n || '').replace(/[[\]]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function isoAFecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
}

const ICON = {
  up: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/></svg>',
  x: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  img: '<svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  search: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  trash: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  ext: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
};

function toast(msg, tipo, ms) {
  const el = document.createElement('div');
  el.className = 'toast' + (tipo ? ' ' + tipo : '');
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), ms || (tipo === 'err' ? 6000 : 3500));
}

// Deshabilita el botón mientras corre fn, y muestra el error si falla.
async function conBoton(btn, textoOcupado, fn) {
  const txt = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = textoOcupado; }
  try { return await fn(); }
  catch (e) { toast(e.message || String(e), 'err'); return undefined; }
  finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = txt; } }
}

// Cartel para editar nombre y estado de un torneo. Devuelve {temporada, activa} o null.
function dialogoEditarTorneo(t) {
  return new Promise(res => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.setAttribute('aria-labelledby', 'eTit');
    d.innerHTML = `<form method="dialog" class="stack" style="gap:16px">
      <h2 class="h2" id="eTit" style="font-size:30px">Editar torneo</h2>
      <label class="field">Nombre del torneo<input class="input" id="eNom" value="${esc(t.temporada)}" required></label>
      <label class="check"><input type="checkbox" id="eAct" ${t.activa ? 'checked' : ''}> Activo: aparece en la app de stats y en el anotador</label>
      <p class="alert small" id="eErr" role="alert"></p>
      <div class="row" style="justify-content:flex-end"><button class="btn" value="no" formnovalidate>Cancelar</button><button class="btn primary" value="si">Guardar</button></div></form>`;
    document.body.appendChild(d);
    d.querySelector('form').addEventListener('submit', e => {
      if (e.submitter && e.submitter.value === 'si' && !d.querySelector('#eNom').value.trim()) { e.preventDefault(); d.querySelector('#eErr').textContent = 'Poné un nombre.'; }
    });
    d.addEventListener('close', () => {
      const ok = d.returnValue === 'si';
      const v = { temporada: d.querySelector('#eNom').value.trim(), activa: d.querySelector('#eAct').checked };
      d.remove(); res(ok ? v : null);
    });
    d.showModal();
    const i = d.querySelector('#eNom'); i.focus(); i.select();
  });
}

// Cartel de confirmación propio (no usa confirm() del navegador).
function confirmar(titulo, texto, boton) {
  return new Promise(res => {
    const d = document.createElement('dialog');
    d.className = 'modal';
    d.setAttribute('aria-labelledby', 'mTit');
    d.innerHTML = `<form method="dialog" class="stack" style="gap:16px">
      <h2 class="h2" id="mTit" style="font-size:30px">${esc(titulo)}</h2>
      <p class="muted" style="margin:0">${esc(texto)}</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" value="no">Cancelar</button><button class="btn danger-fill" value="si">${esc(boton || 'Eliminar')}</button></div></form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { res(d.returnValue === 'si'); d.remove(); });
    d.showModal();
    d.querySelector('[value="no"]').focus();
  });
}

function avatar(url, nombre, size, opts) {
  opts = opts || {};
  const cls = 'ph' + (opts.logo ? ' logo' : '') + (opts.round ? ' round' : '');
  const inner = url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<span class="ini">${esc(opts.ini || iniciales(nombre))}</span>`;
  return `<span class="${cls}" style="width:${size}px;height:${size}px">${inner}</span>`;
}

function pageHead(kicker, titulo, acciones) {
  return `<header class="page-head"><div><span class="kicker">${esc(kicker)}</span><h1 class="h1">${esc(titulo)}</h1></div>${acciones ? `<div class="row">${acciones}</div>` : ''}</header>`;
}
function tile(label, valor, acento) {
  return `<div class="tile"><span class="label-cond">${esc(label)}</span><span class="num-big${acento ? ' accent' : ''}">${esc(valor)}</span></div>`;
}

/* =====================================================================
 *  Configuración local y API
 * ===================================================================== */
const CFG_KEY = 'fenixPanel.cfg';
function loadCfg() {
  const base = { apiUrl: '', key: '', anotadorUrl: '' };
  try { return Object.assign(base, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) { return base; }
}
function saveCfg(c) { try { localStorage.setItem(CFG_KEY, JSON.stringify(c)); } catch (e) { /* sin storage */ } }

// Versión de Code.gs con la que se probó este panel.
const VERSION_ESPERADA = '2026-10-21b';
const S = { cfg: loadCfg(), estado: null, torneos: null, bib: null, torneo: {} };
const needsCfg = () => !S.cfg.apiUrl || !S.cfg.key;

async function api(op, payload) {
  if (needsCfg()) throw new Error('Configurá la URL de la API y la clave en Configuración.');
  let res;
  try {
    res = await fetch(S.cfg.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ kind: 'panel', op: op, key: S.cfg.key }, payload || {}))
    });
  } catch (e) {
    throw new Error('No hay conexión con la API. Revisá la URL en Configuración.');
  }
  if (!res.ok) throw new Error('La API respondió con error ' + res.status + '.');
  let j;
  try { j = await res.json(); } catch (e) { throw new Error('La API no devolvió datos válidos. ¿La URL termina en /exec?'); }
  if (!j.ok) {
    if (j.error === 'no autorizado') throw new Error('Clave incorrecta: la API respondió "no autorizado".');
    if (/^operacion desconocida/.test(j.error || '')) throw new Error('La implementación de Apps Script tiene una versión vieja del código (' + j.error + '). Publicá el Code.gs nuevo como "Nueva versión" en la misma implementación cuya URL está en Configuración.');
    throw new Error(j.error || 'Error desconocido');
  }
  return j;
}
async function getTorneos(force) { if (!S.torneos || force) S.torneos = (await api('torneos')).torneos; return S.torneos; }
// La primera vez que la biblioteca está vacía, se crea y se llena sola con los
// planteles y equipos de las planillas existentes.
async function getBib(force) {
  if (!S.bib || force) {
    let r = await api('biblioteca');
    if ((!r.preparada || (!r.jugadores.length && !r.equipos.length)) && !S.autoImportado) {
      S.autoImportado = true;
      toast('Armando la biblioteca con los jugadores y equipos de las planillas…');
      if (!r.preparada) await api('prepararBiblioteca');
      const imp = await api('importarBiblioteca');
      toast(`Biblioteca lista: ${imp.jugadoresNuevos} jugadores y ${imp.equiposNuevos} equipos`, 'ok');
      r = await api('biblioteca');
    }
    S.bib = { preparada: r.preparada, jugadores: r.jugadores, equipos: fenixPrimero(r.equipos, 'nombre') };
  }
  return S.bib;
}
const fenixPrimero = (lista, campo) => lista.filter(x => esFenix(x[campo])).concat(lista.filter(x => !esFenix(x[campo])));
async function getTorneo(id, force) { if (!S.torneo[id] || force) S.torneo[id] = await api('torneo', { id: id }); return S.torneo[id]; }

const cfgCard = () => `<section class="card pad-lg"><span class="kicker">Primer paso</span><h2 class="h2">Conectá el panel</h2>
  <p class="muted" style="margin:0">Cargá la URL del Apps Script y la clave de administrador. Quedan guardadas solo en este navegador.</p>
  <div><a class="btn primary" href="#/config">Ir a Configuración</a></div></section>`;

/* =====================================================================
 *  Router
 * ===================================================================== */
const ROUTES = [
  [/^#\/(inicio)?$/, 'inicio', () => pageInicio()],
  [/^#\/torneos$/, 'torneos', () => pageTorneos()],
  [/^#\/torneo\/([^/]+)(?:\/([a-z]+))?$/, 'torneos', (m) => pageTorneo(decodeURIComponent(m[1]), m[2])],
  [/^#\/nuevo$/, 'nuevo', () => pageNuevo()],
  [/^#\/biblioteca(?:\/([a-z]+))?$/, 'biblioteca', (m) => pageBiblioteca(m[1])],
  [/^#\/config$/, 'config', () => pageConfig()]
];
let rutaActual = 0;
async function router() {
  const h = location.hash || '#/inicio';
  const ruta = ROUTES.find(r => r[0].test(h));
  if (!ruta) { location.hash = '#/inicio'; return; }
  document.querySelectorAll('[data-nav]').forEach(a => {
    if (a.dataset.nav === ruta[1]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const yo = ++rutaActual;
  view.onclick = view.oninput = view.onchange = view.onkeydown = null;
  view.innerHTML = '<div class="loading"><span class="spin"></span>Cargando…</div>';
  try {
    await ruta[2](h.match(ruta[0]));
  } catch (e) {
    if (yo !== rutaActual) return;
    view.innerHTML = `<section class="card pad-lg"><span class="kicker">Error</span><h2 class="h2">No se pudo cargar</h2>
      <p class="alert">${esc(e.message || e)}</p><div class="row"><button class="btn" type="button" onclick="router()">Reintentar</button><a class="btn" href="#/config">Configuración</a></div></section>`;
  }
}
window.addEventListener('hashchange', router);
window.addEventListener('beforeunload', e => { if (hayCambiosSinGuardar()) { e.preventDefault(); e.returnValue = ''; } });

// Delegación de eventos por página: elementos con data-act="nombre".
function bind(acciones) {
  view.onclick = e => {
    const el = e.target.closest('[data-act]');
    if (!el || !view.contains(el)) return;
    const fn = acciones[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  };
}

/* =====================================================================
 *  INICIO
 * ===================================================================== */
function pendientes(bib) {
  const out = [];
  if (!bib || !bib.preparada) {
    out.push({ txt: 'Preparar la biblioteca', sub: 'Configuración', href: '#/config' });
    return out;
  }
  const jSin = bib.jugadores.filter(j => j.activo && !j.foto).length;
  const eSin = bib.equipos.filter(e => !e.logo).length;
  if (jSin) out.push({ txt: `Subir ${jSin} ${jSin === 1 ? 'foto' : 'fotos'} de jugadores`, sub: 'Biblioteca', href: '#/biblioteca' });
  if (eSin) out.push({ txt: `Subir ${eSin} ${eSin === 1 ? 'logo' : 'logos'} de equipos`, sub: 'Biblioteca · Equipos', href: '#/biblioteca/equipos' });
  if (!bib.jugadores.some(j => j.activo && norm(j.genero).startsWith('f'))) out.push({ txt: 'Cargar plantel femenino', sub: 'Biblioteca', href: '#/biblioteca' });
  if (!bib.jugadores.length) out.push({ txt: 'Importar jugadores y equipos actuales', sub: 'Configuración', href: '#/config' });
  return out;
}

function tablaTorneos(lista) {
  if (!lista.length) return '<p class="empty">Todavía no hay torneos.</p>';
  return `<div class="table-wrap"><table class="t" style="min-width:640px">
    <thead><tr><th>Torneo</th><th>Género</th><th>Tipo</th><th>Estado</th><th><span class="sr">Eliminar</span></th></tr></thead><tbody>
    ${lista.map(t => `<tr class="click" data-act="abrirTorneo" data-id="${esc(t.id)}">
      <td><a href="#/torneo/${encodeURIComponent(t.id)}" style="color:var(--ink);font-weight:600;text-decoration:none">${esc(t.temporada || '(sin nombre)')}</a></td>
      <td>${esc(t.genero)}</td><td class="muted">${esc(t.tipo || '—')}</td>
      <td>${t.activa ? '<span class="badge ok">● ACTIVO</span>' : '<span class="badge off">○ INACTIVO</span>'}</td>
      <td class="r"><button class="btn icon" type="button" data-act="eliminarTorneo" data-id="${esc(t.id)}" data-nombre="${esc(t.temporada + ' · ' + t.genero)}" aria-label="Eliminar torneo ${esc(t.temporada)} ${esc(t.genero)}" title="Eliminar torneo">${ICON.trash}</button></td></tr>`).join('')}
    </tbody></table></div>`;
}
const accionesTablaTorneos = {
  abrirTorneo: el => { location.hash = '#/torneo/' + encodeURIComponent(el.dataset.id); },
  eliminarTorneo: async el => {
    const ok = await confirmar('¿Eliminar el torneo?', `¿Estás seguro de que querés eliminar "${el.dataset.nombre}"? Se saca del índice (deja de aparecer en la app y en el anotador) y la planilla va a la papelera de Drive, donde se puede recuperar durante 30 días.`, 'Eliminar torneo');
    if (!ok) return;
    await conBoton(el, '…', async () => {
      const r = await api('eliminarTorneo', { id: el.dataset.id });
      S.torneos = null; delete S.torneo[el.dataset.id];
      toast(r.papelera ? 'Torneo eliminado. La planilla quedó en la papelera de Drive.' : 'Torneo sacado del índice. La planilla no se borró porque es una de las principales.', 'ok', 6000);
      router();
    });
  }
};

async function pageInicio() {
  if (needsCfg()) { view.innerHTML = pageHead('FENIX // Panel Central', 'Centro de mando') + cfgCard(); return; }
  const [torneos, bib] = await Promise.all([getTorneos(), getBib().catch(() => null)]);
  const activos = torneos.filter(t => t.activa);
  const pend = pendientes(bib);
  view.innerHTML = `
    ${pageHead('FENIX // Panel Central', 'Centro de mando', '<a class="btn primary" href="#/nuevo">+ Nuevo torneo</a>')}
    <section class="tiles" aria-label="Resumen">
      ${tile('Torneos activos', pad2(activos.length))}
      ${tile('Jugadores', pad2(bib ? bib.jugadores.filter(j => j.activo).length : 0))}
      ${tile('Equipos', pad2(bib ? bib.equipos.length : 0))}
      ${tile('Pendientes', pad2(pend.length), pend.length > 0)}
    </section>
    <div class="split">
      <section class="grow hero">
        <span class="kicker">Nuevo torneo</span>
        <h2 class="h1" style="font-size:48px">Armá el próximo<br>torneo</h2>
        <p style="margin:0;font-weight:500;max-width:520px">Tipo, convocados con su número, equipos, y después el fixture y el anotador. Se crea la planilla y queda en el índice.</p>
        <div><a class="btn dark" href="#/nuevo">Empezar</a></div>
      </section>
      <section class="side card">
        <h2 class="h3">Pendientes</h2>
        ${pend.length ? `<ol style="margin:0;padding:0;list-style:none">${pend.map((p, i) => `
          <li style="display:flex;gap:14px;padding:12px 0;${i < pend.length - 1 ? 'border-bottom:1px solid var(--line)' : ''}">
            <span class="mono accent" style="font-weight:700">${pad2(i + 1)}</span>
            <a href="${p.href}" style="color:var(--ink);text-decoration:none;display:flex;flex-direction:column">
              <span style="font-weight:600">${esc(p.txt)}</span><span class="small muted">${esc(p.sub)}</span></a></li>`).join('')}</ol>`
          : '<p class="ok-txt" style="margin:0">Todo al día.</p>'}
      </section>
    </div>
    <section class="stack">
      <div class="row between"><h2 class="h3">Torneos activos</h2><a class="link-btn" href="#/torneos">Ver todos</a></div>
      ${tablaTorneos(activos)}
    </section>`;
  bind(accionesTablaTorneos);
}

/* =====================================================================
 *  TORNEOS (lista)
 * ===================================================================== */
const TL = { filtro: 'Todos' };
async function pageTorneos() {
  if (needsCfg()) { view.innerHTML = pageHead('Temporadas', 'Torneos') + cfgCard(); return; }
  const torneos = await getTorneos();
  const render = () => {
    const lista = torneos.filter(t => TL.filtro === 'Todos' || (TL.filtro === 'Activos' ? t.activa : norm(t.genero) === norm(TL.filtro)));
    view.innerHTML = `
      ${pageHead('Temporadas', 'Torneos', '<button class="btn" type="button" data-act="recargar">Actualizar</button><a class="btn primary" href="#/nuevo">+ Nuevo torneo</a>')}
      <div class="pills" role="group" aria-label="Filtrar">
        ${['Todos', 'Activos', 'Masculino', 'Femenino'].map(f => `<button type="button" class="pill" data-act="filtro" data-f="${f}" aria-pressed="${TL.filtro === f}">${f}</button>`).join('')}
      </div>
      ${tablaTorneos(lista)}`;
  };
  render();
  bind(Object.assign({
    filtro: el => { TL.filtro = el.dataset.f; render(); },
    recargar: async el => { await conBoton(el, 'Actualizando…', async () => { await getTorneos(true); router(); }); }
  }, accionesTablaTorneos));
}

/* =====================================================================
 *  Imágenes: achicar al subir y recortar según el encuadre
 * ===================================================================== */
function cargarImagen(src) {
  return new Promise((ok, ko) => {
    const im = new Image();
    if (!/^(data|blob):/.test(src)) im.crossOrigin = 'anonymous';
    im.onload = () => ok(im);
    im.onerror = () => ko(new Error('No se pudo cargar la imagen.'));
    im.src = src;
  });
}
async function achicar(file, max, mime) {
  const url = URL.createObjectURL(file);
  try {
    const im = await cargarImagen(url);
    const k = Math.min(1, max / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const ctx = c.getContext('2d');
    if (mime === 'image/jpeg') { ctx.fillStyle = '#16171B'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL(mime, 0.88);
  } finally { URL.revokeObjectURL(url); }
}
// Reproduce en un canvas lo mismo que muestra el editor: object-fit + translate(x%,y%) scale(z).
async function exportarRecorte(src, enc, fit, size, mime) {
  const im = await cargarImagen(src);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (mime === 'image/jpeg') { ctx.fillStyle = '#16171B'; ctx.fillRect(0, 0, size, size); }
  const base = fit === 'cover' ? Math.max(size / im.width, size / im.height) : Math.min(size / im.width, size / im.height);
  const w = im.width * base * enc.z, h = im.height * base * enc.z;
  const cx = size / 2 + enc.x / 100 * size, cy = size / 2 + enc.y / 100 * size;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  return c.toDataURL(mime, 0.9); // tira SecurityError si la imagen remota no permite CORS
}

/* =====================================================================
 *  BIBLIOTECA
 * ===================================================================== */
const B = { tab: 'jugadores', filtro: 'Todos', q: '', draft: null, pendiente: null, orden: 'numero', asc: true, ascEq: true };
const ORDEN_JUG = [['numero', 'Número'], ['nombre', 'Nombre'], ['posicion', 'Posición']];
// Ordena la lista visible. En equipos, FENIX va siempre primero.
function ordenarBib(lista) {
  const jug = esJugTab();
  const campo = jug ? B.orden : 'nombre';
  const dir = (jug ? B.asc : B.ascEq) ? 1 : -1;
  const cmpTxt = (a, b) => String(a || '').localeCompare(String(b || ''), 'es', { sensitivity: 'base' });
  const vacio = v => v === '' || v == null;
  const out = lista.slice().sort((a, b) => {
    if (campo === 'numero') {
      const na = parseInt(a.numero, 10), nb = parseInt(b.numero, 10);
      if (isNaN(na) !== isNaN(nb)) return isNaN(na) ? 1 : -1; // sin número al final
      return ((na - nb) || cmpTxt(a.nombre, b.nombre)) * dir;
    }
    if (vacio(a[campo]) !== vacio(b[campo])) return vacio(a[campo]) ? 1 : -1;
    return (cmpTxt(a[campo], b[campo]) || cmpTxt(a.nombre, b.nombre)) * dir;
  });
  return jug ? out : fenixPrimero(out, 'nombre');
}
const esJugTab = () => B.tab === 'jugadores';

function draftDe(it, tipo) {
  const jug = tipo === 'jugadores';
  return Object.assign({}, it, {
    _tipo: tipo,
    encuadre: Object.assign({ x: 0, y: 0, z: 1 }, it.encuadre || {}),
    src: jug ? (it.fotoOriginal || it.foto || '') : (it.logoOriginal || it.logo || ''),
    nuevaImg: null, encCambio: false, dirty: false
  });
}
function hayCambiosSinGuardar() { return !!(B.draft && B.draft.dirty); }

async function pageBiblioteca(tab) {
  if (needsCfg()) { view.innerHTML = pageHead('Catálogo del club', 'Biblioteca') + cfgCard(); return; }
  B.tab = tab === 'equipos' ? 'equipos' : 'jugadores';
  const bib = await getBib();
  if (!bib.preparada) {
    view.innerHTML = `${pageHead('Catálogo del club', 'Biblioteca')}
      <section class="card pad-lg"><h2 class="h2">Todavía no hay biblioteca</h2>
      <p class="muted" style="margin:0">Se crean dos pestañas nuevas en la planilla Índice (Biblioteca_Jugadores y Biblioteca_Equipos). Después podés traer el plantel y los equipos de las planillas actuales.</p>
      <div class="row"><button class="btn primary" type="button" data-act="preparar">Crear biblioteca</button></div></section>`;
    bind({ preparar: el => conBoton(el, 'Creando…', async () => { await api('prepararBiblioteca'); await getBib(true); router(); }) });
    return;
  }
  if (!B.draft || B.draft._tipo !== B.tab) {
    const primero = ordenarBib(listaBib().filter(visibleBib))[0];
    B.draft = primero ? draftDe(primero, B.tab) : null;
  }
  const jug = esJugTab();
  view.innerHTML = `
    ${pageHead('Catálogo del club', 'Biblioteca', `
      <label class="row" style="min-height:48px;padding:0 14px;border:1px solid var(--line-2);border-radius:4px;background:var(--surface);min-width:240px;gap:8px">
        ${ICON.search}<span class="sr">Buscar</span>
        <input id="q" type="search" value="${esc(B.q)}" placeholder="${jug ? 'Buscar jugador' : 'Buscar equipo'}" style="border:0;outline:none;background:transparent;flex:1;min-width:0;font-size:14px">
      </label>
      <button class="btn primary" type="button" data-act="nuevo">${jug ? '+ Nuevo jugador' : '+ Nuevo equipo'}</button>`)}
    <nav class="tabs" aria-label="Catálogo">
      <a class="tab" href="#/biblioteca" aria-selected="${jug}">Jugadores <span class="small mono muted">${bib.jugadores.length}</span></a>
      <a class="tab" href="#/biblioteca/equipos" aria-selected="${!jug}">Equipos <span class="small mono muted">${bib.equipos.length}</span></a>
    </nav>
    <div class="lib">
      <section class="lib-list" aria-label="Catálogo">
        <div class="row between" style="align-items:flex-start;gap:12px">
          <div class="pills" role="group" aria-label="Filtrar" id="libFiltros"></div>
          <div class="row" style="gap:8px">
            ${jug ? `<label class="sr" for="orden">Ordenar por</label>
            <select class="select" id="orden" style="width:auto;min-height:44px">${ORDEN_JUG.map(([k, l]) => `<option value="${k}" ${B.orden === k ? 'selected' : ''}>Ordenar por ${l.toLowerCase()}</option>`).join('')}</select>`
            : '<span class="small muted">Por nombre · FENIX primero</span>'}
            <button type="button" class="btn sm" id="dir" data-act="dir" style="min-width:96px"></button>
          </div>
        </div>
        <div class="lib-grid" id="libGrid"></div>
      </section>
      <section class="editor" id="editor" aria-labelledby="edTitulo"></section>
    </div>`;
  renderFiltrosBib(); renderGridBib(); renderEditor();

  document.getElementById('q').oninput = e => { B.q = e.target.value; renderGridBib(); };
  const orden = document.getElementById('orden');
  if (orden) orden.onchange = () => { B.orden = orden.value; B.asc = true; renderGridBib(); };
  bind({
    dir: () => { if (esJugTab()) B.asc = !B.asc; else B.ascEq = !B.ascEq; renderGridBib(); },
    filtro: el => { B.filtro = el.dataset.f; renderFiltrosBib(); renderGridBib(); },
    sel: el => seleccionarBib(el.dataset.id),
    nuevo: () => {
      if (B.draft && B.draft.dirty && B.pendiente !== '__nuevo') { B.pendiente = '__nuevo'; toast('Hay cambios sin guardar. Tocá de nuevo para descartarlos.'); return; }
      B.pendiente = null;
      const base = jug
        ? { id: '', nombre: '', numero: '', posicion: '', genero: B.filtro === 'Femenino' ? 'Femenino' : 'Masculino', activo: true }
        : { id: '', nombre: '', sigla: '', genero: 'Ambos' };
      B.draft = draftDe(base, B.tab); B.draft.dirty = true;
      renderGridBib(); renderEditor();
      const n = document.querySelector('[data-f="nombre"]'); if (n) n.focus();
    },
    centrar: () => { B.draft.encuadre = { x: 0, y: 0, z: 1 }; B.draft.encCambio = B.draft.dirty = true; aplicarEncuadre(); const z = document.getElementById('zoom'); if (z) z.value = 1; },
    guardar: el => guardarDraft(el),
    eliminar: async el => {
      const d = B.draft;
      const jug = d._tipo === 'jugadores';
      const ok = await confirmar(jug ? '¿Eliminar jugador?' : '¿Eliminar equipo?',
        `¿Estás seguro de que querés eliminar a "${d.nombre}" de la biblioteca? Los torneos donde ya ${jug ? 'está convocado' : 'participa'} no cambian. Si solo dejó de jugar, podés desmarcar "Activo" en lugar de eliminarlo.`.replace(jug ? '' : ' Si solo dejó de jugar, podés desmarcar "Activo" en lugar de eliminarlo.', ''), 'Eliminar');
      if (!ok) return;
      await conBoton(el, 'Eliminando…', async () => {
        await api(jug ? 'eliminarJugador' : 'eliminarEquipo', { id: d.id });
        const lista = jug ? S.bib.jugadores : S.bib.equipos;
        const i = lista.findIndex(x => x.id === d.id);
        if (i >= 0) lista.splice(i, 1);
        const sig = ordenarBib(lista.filter(visibleBib))[0];
        B.draft = sig ? draftDe(sig, B.tab) : null;
        S.torneo = {};
        renderGridBib(); renderEditor();
        toast(`${d.nombre} eliminado de la biblioteca`, 'ok');
      });
    }
  });
}

function listaBib() { return esJugTab() ? S.bib.jugadores : S.bib.equipos; }
function visibleBib(it) {
  const q = norm(B.q);
  if (q && !norm(it.nombre).includes(q) && !norm(it.numero).includes(q) && !norm(it.sigla).includes(q)) return false;
  if (B.filtro === 'Todos') return true;
  if (B.filtro === 'Inactivos') return it.activo === false;
  const g = norm(it.genero);
  return g === norm(B.filtro) || g === 'ambos';
}
function renderFiltrosBib() {
  const f = esJugTab() ? ['Todos', 'Masculino', 'Femenino', 'Inactivos'] : ['Todos', 'Masculino', 'Femenino'];
  if (!f.includes(B.filtro)) B.filtro = 'Todos';
  document.getElementById('libFiltros').innerHTML = f.map(x => `<button type="button" class="pill" data-act="filtro" data-f="${x}" aria-pressed="${B.filtro === x}">${x}</button>`).join('');
}
function renderGridBib() {
  const jug = esJugTab();
  const items = ordenarBib(listaBib().filter(visibleBib));
  const d = B.draft;
  const asc = jug ? B.asc : B.ascEq;
  const dirBtn = document.getElementById('dir');
  if (dirBtn) {
    dirBtn.textContent = asc ? '↑ Asc' : '↓ Desc';
    dirBtn.setAttribute('aria-label', asc ? 'Orden ascendente; tocá para descendente' : 'Orden descendente; tocá para ascendente');
  }
  let html = '';
  if (d && !d.id) {
    html += `<button type="button" class="lib-card" aria-pressed="true" disabled style="opacity:1"><span class="ph${jug ? '' : ' logo'}"><span class="ini">+</span></span><span class="name">${esc(d.nombre || (jug ? 'Nuevo jugador' : 'Nuevo equipo'))}</span><span class="small muted">Sin guardar</span></button>`;
  }
  html += items.map(it => {
    const img = jug ? it.foto : it.logo;
    const sub = jug ? [it.genero, it.posicion].filter(Boolean).join(' · ') + (it.activo === false ? ' · inactivo' : '') : [it.sigla, it.genero].filter(Boolean).join(' · ');
    return `<button type="button" class="lib-card" data-act="sel" data-id="${esc(it.id)}" aria-pressed="${!!(d && d.id === it.id)}">
      <span class="ph${jug ? '' : ' logo'}${it.activo === false ? ' off' : ''}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="ini">${esc(jug ? iniciales(it.nombre) : (it.sigla || iniciales(it.nombre)))}</span>`}
      ${jug && it.numero ? `<span class="dorsal">#${esc(it.numero)}</span>` : ''}</span>
      <span class="name">${esc(it.nombre)}</span><span class="small muted">${esc(sub)}</span></button>`;
  }).join('');
  document.getElementById('libGrid').innerHTML = html || '<p class="empty" style="grid-column:1/-1">No hay resultados.</p>';
}
function seleccionarBib(id) {
  if (B.draft && B.draft.id === id) return;
  if (B.draft && B.draft.dirty && B.pendiente !== id) { B.pendiente = id; toast('Hay cambios sin guardar. Tocá de nuevo para descartarlos.'); return; }
  B.pendiente = null;
  const it = listaBib().find(x => x.id === id);
  if (!it) return;
  B.draft = draftDe(it, B.tab);
  renderGridBib(); renderEditor();
}

function renderEditor() {
  const ed = document.getElementById('editor');
  const d = B.draft;
  if (!d) { ed.innerHTML = '<p class="muted" style="margin:0">Elegí uno del catálogo o creá uno nuevo.</p>'; return; }
  const jug = d._tipo === 'jugadores';
  const src = d.nuevaImg || d.src;
  const fit = jug ? 'cover' : 'contain';
  const img = src ? `<img data-crop src="${esc(src)}" alt="" style="object-fit:${fit}">` : '';
  const genero = jug ? ['Masculino', 'Femenino'] : ['Ambos', 'Masculino', 'Femenino'];
  ed.innerHTML = `
    <div class="row between" style="align-items:baseline">
      <h2 class="h2" id="edTitulo" style="font-size:28px">${esc(d.nombre || (jug ? 'Nuevo jugador' : 'Nuevo equipo'))}</h2>
      <span class="small mono muted">${jug ? 'JUGADOR' : 'EQUIPO'}</span>
    </div>
    <div class="stack" style="align-items:center;gap:8px">
      <div class="frame${src ? ' has' : ''}${jug ? '' : ' logo'}" id="frame" ${src ? 'tabindex="0" aria-label="Encuadre: arrastrá la imagen o usá las flechas"' : ''}>
        ${src ? img : `<span class="vacio">${ICON.img}<span>${jug ? 'Subí una foto del jugador' : 'Subí el logo del equipo'}</span></span>`}
        ${src && jug ? '<span class="guide" aria-hidden="true"></span>' : ''}
      </div>
      <span class="small muted">${src ? 'Arrastrá la imagen para encuadrarla y ajustá el zoom.' : 'JPG o PNG. Después la encuadrás acá.'}</span>
    </div>
    <label class="row" style="gap:12px"><span style="font-weight:600;font-size:14px">Zoom</span>
      <input type="range" id="zoom" min="${jug ? 1 : 0.4}" max="3" step="0.01" value="${d.encuadre.z}" ${src ? '' : 'disabled'} style="flex:1"></label>
    <div class="row">
      <label class="btn light file-btn" style="flex:1 1 160px">${ICON.up} ${src ? (jug ? 'Cambiar foto' : 'Cambiar logo') : (jug ? 'Subir foto' : 'Subir logo')}
        <input type="file" id="archivo" accept="image/*" aria-label="${jug ? 'Elegir foto' : 'Elegir logo'}"></label>
      <button class="btn sm" type="button" data-act="centrar" ${src ? '' : 'disabled'}>Centrar</button>
    </div>
    <div class="previews">
      <span class="label-cond small">Vista previa</span>
      <span class="prev${jug ? '' : ' logo'}" style="width:56px;height:56px;border-radius:50%">${img}</span>
      <span class="prev${jug ? '' : ' logo'}" style="width:88px;height:88px">${img}</span>
    </div>
    ${jug ? `
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
      <label class="field" style="grid-column:1/-1">Nombre<input class="input" data-f="nombre" value="${esc(d.nombre)}" autocomplete="off"></label>
      <label class="field">Número<input class="input mono" data-f="numero" inputmode="numeric" maxlength="3" value="${esc(d.numero)}"></label>
      <label class="field">Categoría<select class="select" data-f="genero">${genero.map(g => `<option ${norm(d.genero) === norm(g) ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="field" style="grid-column:1/-1"><span>Posición <span class="opt">(opcional)</span></span><input class="input" data-f="posicion" value="${esc(d.posicion)}" placeholder="Ej: QB, WR, Rusher"></label>
      <label class="check" style="grid-column:1/-1"><input type="checkbox" data-f="activo" ${d.activo !== false ? 'checked' : ''}> Activo (aparece para convocar)</label>
    </div>` : `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
      <label class="field" style="grid-column:span 2">Nombre<input class="input" data-f="nombre" value="${esc(d.nombre)}" autocomplete="off"></label>
      <label class="field">Sigla<input class="input mono" data-f="sigla" maxlength="4" value="${esc(d.sigla)}" style="text-transform:uppercase"></label>
      <label class="field" style="grid-column:1/-1">Categoría<select class="select" data-f="genero">${genero.map(g => `<option ${norm(d.genero) === norm(g) ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    </div>`}
    <div class="row between" style="border-top:1px solid var(--line);padding-top:14px">
      <span class="small" id="edMsg" style="color:var(--accent-ink);font-weight:600">${d.dirty ? 'Cambios sin guardar' : ''}</span>
      <div class="row">${d.id && !(d._tipo === 'equipos' && esFenix(d.nombre)) ? '<button class="btn sm danger" type="button" data-act="eliminar">' + ICON.trash + ' Eliminar</button>' : ''}<button class="btn primary" type="button" data-act="guardar">Guardar</button></div>
    </div>`;
  aplicarEncuadre();

  // Campos
  ed.querySelectorAll('[data-f]').forEach(inp => {
    const ev = inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const f = inp.dataset.f;
      let v = inp.type === 'checkbox' ? inp.checked : inp.value;
      if (f === 'numero') { v = String(v).replace(/\D/g, '').slice(0, 3); inp.value = v; }
      if (f === 'sigla') v = String(v).toUpperCase();
      d[f] = v; marcarSucio();
      if (f === 'nombre') document.getElementById('edTitulo').textContent = v || (jug ? 'Nuevo jugador' : 'Nuevo equipo');
    });
  });
  // Archivo
  document.getElementById('archivo').onchange = async e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      d.nuevaImg = await achicar(file, jug ? 1600 : 1000, jug ? 'image/jpeg' : 'image/png');
      d.encuadre = { x: 0, y: 0, z: 1 }; d.encCambio = true; d.dirty = true;
      renderEditor();
    } catch (err) { toast(err.message, 'err'); }
  };
  // Zoom
  const zoom = document.getElementById('zoom');
  zoom.oninput = () => { d.encuadre.z = Number(zoom.value); d.encCambio = true; marcarSucio(); aplicarEncuadre(); };
  // Arrastre
  const frame = document.getElementById('frame');
  if (src) {
    let drag = null;
    frame.onpointerdown = e => {
      drag = { sx: e.clientX, sy: e.clientY, ox: d.encuadre.x, oy: d.encuadre.y, w: frame.getBoundingClientRect().width || 300 };
      frame.setPointerCapture(e.pointerId);
    };
    frame.onpointermove = e => {
      if (!drag) return;
      d.encuadre.x = clamp(drag.ox + (e.clientX - drag.sx) / drag.w * 100, -100, 100);
      d.encuadre.y = clamp(drag.oy + (e.clientY - drag.sy) / drag.w * 100, -100, 100);
      d.encCambio = true; marcarSucio(); aplicarEncuadre();
    };
    frame.onpointerup = frame.onpointercancel = () => { drag = null; };
    frame.onkeydown = e => {
      const paso = e.shiftKey ? 5 : 1;
      const mov = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key];
      if (!mov) return;
      e.preventDefault();
      d.encuadre.x = clamp(d.encuadre.x + mov[0], -100, 100);
      d.encuadre.y = clamp(d.encuadre.y + mov[1], -100, 100);
      d.encCambio = true; marcarSucio(); aplicarEncuadre();
    };
  }
}
function marcarSucio() {
  if (!B.draft.dirty) { B.draft.dirty = true; const m = document.getElementById('edMsg'); if (m) m.textContent = 'Cambios sin guardar'; }
}
function aplicarEncuadre() {
  const e = B.draft.encuadre;
  const t = `translate(${e.x}%, ${e.y}%) scale(${e.z})`;
  document.querySelectorAll('#editor [data-crop]').forEach(i => { i.style.transform = t; });
}

async function guardarDraft(btn) {
  const d = B.draft;
  const jug = d._tipo === 'jugadores';
  if (!String(d.nombre || '').trim()) { toast('Falta el nombre.', 'err'); return; }
  await conBoton(btn, 'Guardando…', async () => {
    const payload = jug
      ? { id: d.id || undefined, nombre: d.nombre.trim(), numero: d.numero, posicion: d.posicion, genero: d.genero, activo: d.activo !== false, encuadre: d.encuadre }
      : { id: d.id || undefined, nombre: d.nombre.trim(), sigla: d.sigla, genero: d.genero, encuadre: d.encuadre };
    const fuente = d.nuevaImg || (d.encCambio ? d.src : null);
    if (fuente) {
      try {
        payload[jug ? 'foto' : 'logo'] = await exportarRecorte(fuente, d.encuadre, jug ? 'cover' : 'contain', jug ? 600 : 512, jug ? 'image/jpeg' : 'image/png');
      } catch (e) {
        throw new Error('No se pudo recortar la imagen guardada en Drive. Volvé a subirla para encuadrarla.');
      }
      if (d.nuevaImg) payload[jug ? 'fotoOriginal' : 'logoOriginal'] = d.nuevaImg;
    }
    const r = await api(jug ? 'guardarJugador' : 'guardarEquipo', jug ? { jugador: payload } : { equipo: payload });
    const item = jug ? r.jugador : r.equipo;
    const lista = jug ? S.bib.jugadores : S.bib.equipos;
    const i = lista.findIndex(x => x.id === item.id);
    if (i >= 0) lista[i] = item; else lista.unshift(item);
    B.draft = draftDe(item, d._tipo);
    S.torneo = {};
    renderGridBib(); renderEditor();
    toast('Guardado' + (r.torneosActualizados ? ` · actualizado en ${r.torneosActualizados} ${r.torneosActualizados === 1 ? 'torneo' : 'torneos'}` : ''), 'ok');
  });
}

/* =====================================================================
 *  NUEVO TORNEO (asistente)
 * ===================================================================== */
const TIPOS = [
  { id: 'Liga', d: 'Todos contra todos, con tabla de posiciones.' },
  { id: 'Liga con Playoff', d: 'Tabla y después semifinales y final.' },
  { id: 'Copa', d: 'Fase de grupos y después eliminación.' },
  { id: 'Amistosos', d: 'Partidos sueltos, sin tabla.' }
];
const PASOS = [
  { t: 'Tipo de torneo', h: 'Liga, copa, amistosos…' },
  { t: 'Jugadores', h: 'Convocados y su número' },
  { t: 'Equipos', h: 'Quiénes participan' },
  { t: 'Fixture', h: 'Cuando esté disponible' },
  { t: 'Confirmar', h: 'Crear la planilla' }
];
let W = null;
function wizardNuevo() {
  return { paso: 0, tipo: 'Liga', temporada: '', genero: 'M', grupos: 2, activa: true, sugerencia: true, desde: '', hasta: '', sel: null, equipos: null, agregar: '' };
}
const generoNombre = g => g === 'F' ? 'Femenino' : 'Masculino';
const grupoLetras = n => 'ABCDEFGH'.slice(0, n).split('').map(l => 'Grupo ' + l);

function jugadoresGenero() {
  return S.bib.jugadores.filter(j => j.activo !== false && norm(j.genero).startsWith(W.genero === 'F' ? 'f' : 'm'))
    .sort((a, b) => (parseInt(a.numero, 10) || 999) - (parseInt(b.numero, 10) || 999) || a.nombre.localeCompare(b.nombre));
}
function equiposGenero() {
  const g = norm(generoNombre(W.genero));
  return S.bib.equipos.filter(e => norm(e.genero) === 'ambos' || norm(e.genero) === g);
}
function asegurarSeleccion() {
  if (!W.sel) {
    W.sel = {};
    jugadoresGenero().forEach(j => { W.sel[j.id] = { on: true, numero: String(j.numero || '') }; });
  }
  if (!W.equipos) {
    W.equipos = [];
    const fenix = S.bib.equipos.find(e => esFenix(e.nombre));
    W.equipos.push(fenix ? { id: fenix.id, equipo: fenix.nombre, logo: fenix.logo, categoria: '' } : { id: '', equipo: 'FENIX', logo: '', categoria: '' });
  }
}
function numerosRepetidos() {
  const c = {};
  Object.keys(W.sel).forEach(id => { const s = W.sel[id]; if (s.on && s.numero) c[s.numero] = (c[s.numero] || 0) + 1; });
  return Object.keys(c).filter(k => c[k] > 1);
}
function errorPaso(p) {
  if (p === 0 && !W.temporada.trim()) return 'Poné el nombre del torneo (ej: Apertura 2026).';
  if (p === 1) {
    const on = Object.keys(W.sel).filter(id => W.sel[id].on);
    if (!on.length) return 'Elegí al menos un jugador.';
    if (on.some(id => !W.sel[id].numero)) return 'Todos los convocados necesitan número.';
    const rep = numerosRepetidos();
    if (rep.length) return 'Hay números repetidos: #' + rep.join(', #');
  }
  if (p === 2 && W.equipos.length < 2 && W.tipo !== 'Amistosos') return 'Agregá al menos dos equipos.';
  return '';
}

async function pageNuevo() {
  if (needsCfg()) { view.innerHTML = pageHead('Torneos', 'Nuevo torneo') + cfgCard(); return; }
  await getBib();
  if (!S.bib.preparada) { view.innerHTML = pageHead('Torneos', 'Nuevo torneo') + `<section class="card pad-lg"><p style="margin:0">Primero creá la biblioteca de jugadores y equipos.</p><div><a class="btn primary" href="#/biblioteca">Ir a la Biblioteca</a></div></section>`; return; }
  if (!W) W = wizardNuevo();
  asegurarSeleccion();
  view.innerHTML = `${pageHead('Torneos', 'Nuevo torneo')}
    <div class="split" style="align-items:flex-start">
      <ol class="steps" aria-label="Pasos" id="wzPasos"></ol>
      <section class="wizard-panel card pad-lg" id="wz" aria-live="polite"></section>
    </div>`;
  renderWizard();

  view.oninput = e => {
    const k = e.target.dataset.w;
    if (k) { W[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; return; }
    const n = e.target.dataset.num;
    if (n) {
      const v = e.target.value.replace(/\D/g, '').slice(0, 3);
      e.target.value = v; W.sel[n].numero = v;
      const rep = numerosRepetidos();
      document.querySelectorAll('[data-num]').forEach(inp => {
        const s = W.sel[inp.dataset.num], j = S.bib.jugadores.find(x => x.id === inp.dataset.num);
        inp.classList.toggle('dup', s.on && rep.includes(s.numero));
        inp.classList.toggle('changed', !!j && s.numero !== String(j.numero || ''));
      });
      const msg = document.getElementById('repMsg');
      if (msg) msg.textContent = rep.length ? 'Número repetido: #' + rep.join(', #') : '';
    }
  };
  view.onchange = e => {
    if (e.target.dataset.w) { W[e.target.dataset.w] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; }
    if (e.target.dataset.on) { W.sel[e.target.dataset.on].on = e.target.checked; renderWizard(); }
    if (e.target.dataset.cat) { W.equipos[Number(e.target.dataset.cat)].categoria = e.target.value; }
    if (e.target.id === 'agregarEq') { W.agregar = e.target.value; }
  };
  bind({
    ir: el => { const p = Number(el.dataset.p); if (p > W.paso) { for (let i = W.paso; i < p; i++) { const er = errorPaso(i); if (er) { W.paso = i; renderWizard(er); return; } } } W.paso = p; renderWizard(); },
    sig: () => { const er = errorPaso(W.paso); if (er) { renderWizard(er); return; } W.paso = Math.min(4, W.paso + 1); renderWizard(); },
    atras: () => { W.paso = Math.max(0, W.paso - 1); renderWizard(); },
    tipo: el => { W.tipo = el.dataset.t; renderWizard(); },
    genero: el => { if (W.genero !== el.dataset.g) { W.genero = el.dataset.g; W.sel = null; W.equipos = null; asegurarSeleccion(); } renderWizard(); },
    todos: () => { Object.keys(W.sel).forEach(id => { W.sel[id].on = true; }); renderWizard(); },
    ninguno: () => { Object.keys(W.sel).forEach(id => { W.sel[id].on = false; }); renderWizard(); },
    agregarEq: () => {
      const e = S.bib.equipos.find(x => x.id === W.agregar);
      if (!e) { toast('Elegí un equipo de la lista.'); return; }
      W.equipos.push({ id: e.id, equipo: e.nombre, logo: e.logo, categoria: '' }); W.agregar = ''; renderWizard();
    },
    quitarEq: el => { W.equipos.splice(Number(el.dataset.i), 1); renderWizard(); },
    crear: el => crearTorneoWizard(el),
    reiniciar: () => { W = wizardNuevo(); asegurarSeleccion(); renderWizard(); }
  });
}

function renderWizard(error) {
  document.getElementById('wzPasos').innerHTML = PASOS.map((p, i) => `
    <li><button type="button" class="step-btn${i < W.paso ? ' done' : ''}" data-act="ir" data-p="${i}" ${i === W.paso ? 'aria-current="step"' : ''}>
      <span class="step-num">${i < W.paso ? '✓' : pad2(i + 1)}</span>
      <span class="stack" style="gap:0"><span class="step-title">${p.t}</span><span class="small muted">${p.h}</span></span></button></li>`).join('');
  const cab = (t, sub) => `<div class="stack" style="gap:4px"><span class="kicker" style="color:var(--accent)">Paso ${W.paso + 1} de 5</span><h2 class="h2" style="font-size:36px">${t}</h2>${sub ? `<span class="muted">${sub}</span>` : ''}</div>`;
  let html = '';
  if (W.paso === 0) {
    const sugiere = W.tipo === 'Liga con Playoff' || (W.tipo === 'Copa' && Number(W.grupos) === 2);
    html = `${cab('¿Qué tipo de torneo es?')}
      <div class="choice-grid" role="group" aria-label="Tipo de torneo">
        ${TIPOS.map(t => `<button type="button" class="choice" data-act="tipo" data-t="${t.id}" aria-pressed="${W.tipo === t.id}"><b>${t.id}</b><span>${t.d}</span></button>`).join('')}
      </div>
      <div class="grid-form">
        <label class="field" style="grid-column:span 2">Nombre del torneo<input class="input" data-w="temporada" value="${esc(W.temporada)}" placeholder="Ej: Apertura 2026"><span class="hint">La planilla se llama "${W.genero} - ${esc(W.temporada || 'Nombre')}".</span></label>
        ${W.tipo === 'Copa' ? `<label class="field">Cantidad de grupos<input class="input" type="number" min="2" max="8" data-w="grupos" value="${esc(W.grupos)}"></label>` : ''}
        <label class="field"><span>Desde <span class="opt">(opcional)</span></span><input class="input" type="date" data-w="desde" value="${esc(W.desde)}"></label>
        <label class="field"><span>Hasta <span class="opt">(opcional)</span></span><input class="input" type="date" data-w="hasta" value="${esc(W.hasta)}"></label>
      </div>
      <div class="stack" style="gap:8px"><span style="font-size:14px;font-weight:600">Categoría</span>
        <div class="pills" role="group" aria-label="Categoría">
          <button type="button" class="pill" data-act="genero" data-g="M" aria-pressed="${W.genero === 'M'}">Masculino</button>
          <button type="button" class="pill" data-act="genero" data-g="F" aria-pressed="${W.genero === 'F'}">Femenino</button>
        </div></div>
      <div class="stack" style="gap:0">
        <label class="check"><input type="checkbox" data-w="activa" ${W.activa ? 'checked' : ''}> Activo: aparece en la app de stats y en el anotador</label>
        ${sugiere ? `<label class="check"><input type="checkbox" data-w="sugerencia" ${W.sugerencia ? 'checked' : ''}> Cargar semifinales y final de ejemplo en el fixture</label>` : ''}
      </div>`;
  } else if (W.paso === 1) {
    const lista = jugadoresGenero();
    const rep = numerosRepetidos();
    const cant = Object.keys(W.sel).filter(id => W.sel[id].on).length;
    html = `<div class="row between" style="align-items:flex-end">${cab('¿Quiénes juegan?', `Elegí de la <a href="#/biblioteca">biblioteca</a> (${generoNombre(W.genero)}) los convocados.`)}
        <div class="row" style="gap:12px"><span class="mono accent" style="font-size:28px;font-weight:700">${cant}</span><span class="small muted" style="line-height:1.2">convocados<br>de ${lista.length}</span></div></div>
      <div class="row"><button type="button" class="btn sm" data-act="todos">Seleccionar todos</button><button type="button" class="btn sm" data-act="ninguno">Limpiar</button></div>
      ${lista.length ? `<div class="pick-grid">${lista.map(j => {
        const s = W.sel[j.id] || (W.sel[j.id] = { on: false, numero: String(j.numero || '') });
        const cls = 'input num' + (s.on && rep.includes(s.numero) ? ' dup' : '') + (s.numero !== String(j.numero || '') ? ' changed' : '');
        return `<div class="pick${s.on ? ' on' : ''}">
          <label class="check">${avatar(j.foto, j.nombre, 36, { round: true })}<input type="checkbox" data-on="${esc(j.id)}" ${s.on ? 'checked' : ''}><span style="font-weight:600;min-width:0">${esc(j.nombre)}</span></label>
          <label class="row mono" style="gap:4px;color:var(--muted);font-weight:700">#<input class="${cls}" data-num="${esc(j.id)}" inputmode="numeric" value="${esc(s.numero)}" aria-label="Número de ${esc(j.nombre)} en este torneo"></label></div>`;
      }).join('')}</div>` : `<p class="empty">No hay jugadores ${generoNombre(W.genero).toLowerCase()}s activos en la biblioteca. <a href="#/biblioteca">Cargalos acá</a>.</p>`}
      <div class="row small muted" style="gap:6px 20px"><span>El número de la biblioteca viene por defecto; cambialo si en este torneo usa otro.</span><span id="repMsg" class="alert small">${rep.length ? 'Número repetido: #' + rep.join(', #') : ''}</span></div>`;
  } else if (W.paso === 2) {
    const usados = W.equipos.map(e => e.id);
    const disp = equiposGenero().filter(e => !usados.includes(e.id));
    const cats = W.tipo === 'Copa' ? grupoLetras(clamp(parseInt(W.grupos, 10) || 2, 2, 8)) : null;
    html = `${cab('¿Qué equipos participan?', `${W.equipos.length} ${W.equipos.length === 1 ? 'equipo' : 'equipos'} en el torneo.`)}
      <div class="row" style="align-items:flex-end">
        <label class="field" style="flex:1 1 260px">Agregar equipo de la biblioteca
          <select class="select" id="agregarEq"><option value="">${disp.length ? 'Elegí un equipo' : 'No hay más equipos en la biblioteca'}</option>${disp.map(e => `<option value="${esc(e.id)}" ${W.agregar === e.id ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select>
          <span class="hint">¿No está? Crealo en la <a href="#/biblioteca/equipos">Biblioteca</a>.</span></label>
        <button type="button" class="btn light" data-act="agregarEq" style="margin-bottom:22px">Agregar</button>
      </div>
      ${W.equipos.length ? `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;background:var(--line);border:1px solid var(--line)">
        ${W.equipos.map((e, i) => `<li class="row" style="background:${esFenix(e.equipo) ? 'var(--fenix-row)' : 'var(--surface)'};padding:8px 8px 8px 16px;gap:14px">
          <span class="mono muted" style="font-weight:700">${pad2(i + 1)}</span>${avatar(e.logo, e.equipo, 44, { logo: true })}
          <span class="team" style="flex:1;font-size:22px">${esc(e.equipo)}</span>
          ${cats ? `<label class="sr" for="cat${i}">Grupo de ${esc(e.equipo)}</label><select class="select" id="cat${i}" data-cat="${i}" style="width:auto;min-height:44px"><option value="">Grupo…</option>${cats.map(c => `<option ${e.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}</select>` : ''}
          ${esFenix(e.equipo) ? '<span style="width:44px;flex:none"></span>' : `<button type="button" class="btn icon" data-act="quitarEq" data-i="${i}" aria-label="Quitar ${esc(e.equipo)}">${ICON.x}</button>`}</li>`).join('')}</ul>` : '<p class="empty">Todavía no agregaste equipos.</p>'}`;
  } else if (W.paso === 3) {
    html = `${cab('Fixture', 'Se carga después, desde la pantalla del torneo, cuando la organización lo publique.')}
      <p style="margin:0;padding:16px;border:1px solid var(--line-2)">Al crear el torneo vas directo a cargar los partidos uno por uno: fecha, día, hora, local, visitante y cancha. Los partidos de FENIX abren el anotador; en los demás cargás el resultado y la tabla se arma sola.</p>`;
  } else {
    const conv = Object.keys(W.sel).filter(id => W.sel[id].on).length;
    const cambiados = Object.keys(W.sel).filter(id => { const j = S.bib.jugadores.find(x => x.id === id); return W.sel[id].on && j && W.sel[id].numero !== String(j.numero || ''); }).length;
    html = `${cab('Confirmar', 'Se crea la planilla del torneo, se agrega al índice y se cargan plantel y equipos.')}
      <dl class="tiles" style="margin:0">
        ${[['Nombre', `${W.genero} - ${W.temporada}`], ['Tipo', W.tipo + (W.tipo === 'Copa' ? ` · ${W.grupos} grupos` : '')], ['Categoría', generoNombre(W.genero)], ['Jugadores', conv + (cambiados ? ` · ${cambiados} con otro número` : '')], ['Equipos', W.equipos.length], ['Estado', W.activa ? 'Activo' : 'Inactivo']]
          .map(([k, v]) => `<div class="tile" style="background:var(--bg)"><dt class="label-cond small">${k}</dt><dd style="margin:0;font:700 22px var(--display);text-transform:uppercase">${esc(v)}</dd></div>`).join('')}
      </dl>`;
  }
  const ultimo = W.paso === 4;
  html += `${error ? `<p class="alert" role="alert">${esc(error)}</p>` : ''}
    <div class="row between" style="padding-top:20px;border-top:1px solid var(--line)">
      <button type="button" class="btn" data-act="atras" ${W.paso === 0 ? 'disabled' : ''}>← Atrás</button>
      ${ultimo ? '<button type="button" class="btn primary" data-act="crear">Crear torneo</button>' : '<button type="button" class="btn primary" data-act="sig">Siguiente →</button>'}
    </div>`;
  document.getElementById('wz').innerHTML = html;
}

async function crearTorneoWizard(btn) {
  for (let i = 0; i < 4; i++) { const er = errorPaso(i); if (er) { W.paso = i; renderWizard(er); return; } }
  await conBoton(btn, 'Creando planilla…', async () => {
    const jugadores = Object.keys(W.sel).filter(id => W.sel[id].on).map(id => {
      const j = S.bib.jugadores.find(x => x.id === id);
      return { id: id, numero: W.sel[id].numero, nombre: j.nombre, posicion: j.posicion, foto: j.foto };
    }).sort((a, b) => (parseInt(a.numero, 10) || 999) - (parseInt(b.numero, 10) || 999));
    const r = await api('crearTorneo', {
      temporada: W.temporada.trim(), genero: W.genero, tipo: W.tipo, grupos: Number(W.grupos) || 2,
      activa: W.activa, sugerencia: W.sugerencia, desde: isoAFecha(W.desde), hasta: isoAFecha(W.hasta),
      jugadores: jugadores, equipos: W.equipos
    });
    toast(`Torneo creado: ${r.torneo.nombre}`, 'ok');
    W = null; S.torneos = null;
    location.hash = '#/torneo/' + encodeURIComponent(r.torneo.id) + '/fixture';
  });
}

/* =====================================================================
 *  TORNEO
 * ===================================================================== */
const T = { id: null, tab: 'resumen', form: null, editRes: null, borrar: null, plantel: null, equipos: null, agregarJ: '', agregarE: '' };
const TABS_T = [['resumen', 'Resumen'], ['fixture', 'Fixture'], ['posiciones', 'Posiciones'], ['jugadores', 'Jugadores'], ['equipos', 'Equipos']];
const JORNADAS = ['Fecha 1', 'Fecha 2', 'Fecha 3', 'Fecha 4', 'Fecha 5', 'Fecha 6', 'Fecha 7', 'Fecha 8', 'Fecha 9', 'Fecha 10', 'Cuartos de final', 'Semifinal', 'Tercer puesto', 'Final'];

function linkAnotador(data, p) {
  const tpl = S.cfg.anotadorUrl;
  if (!tpl) return '';
  const g = norm(data.torneo.genero).startsWith('f') ? 'f' : 'm';
  if (!/\{(planilla|partido|genero)\}/.test(tpl)) return tpl;
  return tpl.replace(/\{planilla\}/g, encodeURIComponent(data.torneo.id)).replace(/\{partido\}/g, encodeURIComponent(p.id)).replace(/\{genero\}/g, g);
}
const tieneResultado = p => p.gl !== '' && p.gv !== '' && p.gl != null && p.gv != null && !isNaN(Number(p.gl)) && !isNaN(Number(p.gv));

async function pageTorneo(id, tab) {
  if (needsCfg()) { view.innerHTML = pageHead('Torneo', 'Torneo') + cfgCard(); return; }
  if (T.id !== id) Object.assign(T, { id: id, form: null, editRes: null, borrar: null, plantel: null, equipos: null });
  T.tab = TABS_T.some(t => t[0] === tab) ? tab : 'resumen';
  const [data] = await Promise.all([getTorneo(id), getBib().catch(() => null)]);
  if (!T.form) T.form = { jornada: '', dia: '', hora: '', local: '', visitante: '', cancha: '', instancia: data.torneo.tipo === 'Amistosos' ? 'Amistoso' : 'Regular' };
  renderTorneo();
  bindTorneo();
}

function renderTorneo() {
  const data = S.torneo[T.id];
  const t = data.torneo;
  const jugados = data.fixture.filter(tieneResultado).length;
  const faltaFixture = !data.fixture.length;
  view.innerHTML = `
    <header class="page-head"><div>
      <a class="kicker" href="#/torneos" style="text-decoration:none;min-height:44px;display:inline-flex;align-items:center">← Torneos</a>
      <h1 class="h1">${esc(t.temporada || t.nombre)}</h1>
      <div class="row" style="gap:8px">
        ${t.tipo ? `<span class="chip">${esc(t.tipo)}</span>` : ''}<span class="chip">${esc(t.genero)}</span>
        ${t.desde || t.hasta ? `<span class="chip" style="font:500 14px var(--body);text-transform:none;color:var(--muted)">${esc([t.desde, t.hasta].filter(Boolean).join(' → '))}</span>` : ''}
        ${faltaFixture ? '<span class="badge warn">◐ FALTA FIXTURE</span>' : (t.activa ? '<span class="badge ok">● ACTIVO</span>' : '<span class="badge off">○ INACTIVO</span>')}
      </div></div>
      <div class="row"><button class="btn" type="button" data-act="editarTorneo">Editar</button><button class="btn" type="button" data-act="recargar">Actualizar</button><a class="btn" href="${esc(t.url)}" target="_blank" rel="noopener">${ICON.ext} Abrir planilla</a></div>
    </header>
    <section class="tiles" aria-label="Configuración del torneo">
      ${tile('Jugadores', pad2(data.plantel.length))}${tile('Equipos', pad2(data.equipos.length))}
      ${tile('Partidos', faltaFixture ? '—' : pad2(data.fixture.length), faltaFixture)}${tile('Jugados', pad2(jugados))}
    </section>
    <nav class="tabs" aria-label="Secciones del torneo">
      ${TABS_T.map(([k, l]) => `<a class="tab" href="#/torneo/${encodeURIComponent(T.id)}/${k}" aria-selected="${T.tab === k}">${l}</a>`).join('')}
    </nav>
    <div id="tabBody">${{ resumen: tabResumen, fixture: tabFixture, posiciones: tabPosiciones, jugadores: tabJugadores, equipos: tabEquipos }[T.tab](data)}</div>`;
}

function tabResumen(data) {
  const prox = data.fixture.find(p => (esFenix(p.local) || esFenix(p.visitante)) && !tieneResultado(p));
  const link = prox ? linkAnotador(data, prox) : '';
  const hero = !data.fixture.length
    ? `<section class="grow hero"><span class="kicker">Siguiente paso</span><h2 class="h1" style="font-size:44px">Falta el fixture</h2>
        <p style="margin:0;font-weight:500;max-width:520px">Cuando la organización lo publique, cargalo partido por partido. Con el fixture cargado se habilita el anotador.</p>
        <div><a class="btn dark" href="#/torneo/${encodeURIComponent(T.id)}/fixture">Cargar fixture</a></div></section>`
    : prox
      ? `<section class="grow hero"><span class="kicker">Próximo partido · ${esc([prox.jornada, prox.dia, prox.hora].filter(Boolean).join(' · '))}</span>
          <h2 class="h1" style="font-size:52px">${esc(prox.local)} <span style="opacity:.55">vs</span> ${esc(prox.visitante)}</h2>
          <span style="font-weight:600">${esc(prox.cancha || 'Cancha a definir')}</span>
          <div class="row">${link ? `<a class="btn dark" href="${esc(link)}" target="_blank" rel="noopener">Abrir anotador</a><button class="btn" type="button" style="border-color:var(--bg);color:var(--bg)" data-act="copiar" data-url="${esc(link)}">Copiar link</button>` : '<a class="btn dark" href="#/config">Configurar link del anotador</a>'}</div></section>`
      : `<section class="grow hero"><span class="kicker">Fixture</span><h2 class="h1" style="font-size:44px">Todos los partidos de FENIX tienen resultado</h2><div><a class="btn dark" href="#/torneo/${encodeURIComponent(T.id)}/posiciones">Ver posiciones</a></div></section>`;
  const sinFoto = data.plantel.filter(p => !p.foto).length;
  const sinLogo = data.equipos.filter(e => !e.logo).length;
  return `<div class="split">${hero}
    <section class="side card"><h2 class="h3">Estado</h2>
      <ul style="margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px">
        <li>${data.plantel.length ? '✓' : '○'} ${data.plantel.length} jugadores convocados</li>
        <li>${data.equipos.length >= 2 ? '✓' : '○'} ${data.equipos.length} equipos</li>
        <li>${data.fixture.length ? '✓' : '○'} ${data.fixture.length} partidos en el fixture</li>
        ${sinFoto ? `<li class="accent">● ${sinFoto} ${sinFoto === 1 ? 'jugador' : 'jugadores'} sin foto · <a href="#/biblioteca">Biblioteca</a></li>` : ''}
        ${sinLogo ? `<li class="accent">● ${sinLogo} ${sinLogo === 1 ? 'equipo' : 'equipos'} sin logo · <a href="#/biblioteca/equipos">Biblioteca</a></li>` : ''}
      </ul></section></div>`;
}

function tabFixture(data) {
  const f = T.form;
  const nombres = data.equipos.map(e => e.equipo);
  const canchas = [...new Set(data.fixture.map(p => p.cancha).filter(Boolean))];
  const opts = sel => `<option value="">Elegí equipo</option>${nombres.map(n => `<option ${sel === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}`;
  const filas = data.fixture.map((p, i) => {
    const fenix = esFenix(p.local) || esFenix(p.visitante);
    const link = fenix ? linkAnotador(data, p) : '';
    const editando = T.editRes === p.id;
    const res = editando
      ? `<span class="row" style="gap:6px;flex-wrap:nowrap"><input class="input score" id="rl" inputmode="numeric" value="${esc(p.gl)}" aria-label="Puntos de ${esc(p.local)}"><span class="muted">–</span><input class="input score" id="rv" inputmode="numeric" value="${esc(p.gv)}" aria-label="Puntos de ${esc(p.visitante)}">
         <button class="btn primary" type="button" style="min-height:44px;width:44px;padding:0" data-act="guardarRes" data-id="${esc(p.id)}" aria-label="Guardar resultado">${ICON.check}</button>
         <button class="btn icon" type="button" data-act="cancelarRes" aria-label="Cancelar">${ICON.x}</button></span>`
      : `<button type="button" class="${tieneResultado(p) ? 'link-btn mono' : 'btn sm'}" style="${tieneResultado(p) ? 'color:var(--ink);font-size:16px' : 'color:var(--accent-ink)'}" data-act="editarRes" data-id="${esc(p.id)}" aria-label="${tieneResultado(p) ? 'Editar' : 'Cargar'} resultado ${esc(p.local)} vs ${esc(p.visitante)}">${tieneResultado(p) ? esc(p.gl) + ' – ' + esc(p.gv) : 'Cargar'}</button>`;
    const borrar = T.borrar === p.id
      ? `<button class="btn sm danger" type="button" data-act="borrar" data-i="${i}">¿Quitar?</button>`
      : `<button class="btn icon" type="button" data-act="preBorrar" data-id="${esc(p.id)}" aria-label="Quitar ${esc(p.local)} vs ${esc(p.visitante)}">${ICON.x}</button>`;
    return `<tr class="${fenix ? 'fenix' : ''}">
      <td>${esc(p.jornada || '—')}</td><td class="mono">${esc(p.dia || '—')}</td><td class="mono muted">${esc(p.hora || '—')}</td>
      <td><span class="team">${esc(p.local)}</span><span class="vs">vs</span><span class="team">${esc(p.visitante)}</span></td>
      <td class="muted">${esc(p.cancha || '—')}</td><td class="muted small">${esc(p.instancia || '')}</td>
      <td>${res}</td>
      <td>${fenix ? (link ? `<a href="${esc(link)}" target="_blank" rel="noopener" style="font-weight:600">Abrir anotador</a>` : '<a class="small" href="#/config">Configurar</a>') : '<span style="color:#55575E">—</span>'}</td>
      <td class="r">${borrar}</td></tr>`;
  }).join('');
  return `<div class="stack-lg">
    <section class="card pad-lg" aria-labelledby="fxT">
      <div class="stack" style="gap:4px"><h2 class="h2" id="fxT">Agregar partido</h2><span class="muted">Podés cargar partidos de todos los equipos del torneo, no solo los de FENIX.</span></div>
      <div class="grid-form">
        <label class="field">Fecha <span class="hint">Jornada o instancia</span><input class="input" data-fx="jornada" list="jornadas" value="${esc(f.jornada)}" placeholder="Fecha 1"></label>
        <label class="field">Día<input class="input" type="date" data-fx="dia" value="${esc(f.dia)}"></label>
        <label class="field"><span>Hora <span class="opt">(opcional)</span></span><input class="input" type="time" data-fx="hora" value="${esc(f.hora)}"></label>
        <label class="field">Local<select class="select" data-fx="local">${opts(f.local)}</select></label>
        <label class="field">Visitante<select class="select" data-fx="visitante">${opts(f.visitante)}</select></label>
        <label class="field"><span>Cancha <span class="opt">(opcional)</span></span><input class="input" data-fx="cancha" list="canchas" value="${esc(f.cancha)}" placeholder="Ej: Cancha 2"></label>
        <label class="field">Instancia<select class="select" data-fx="instancia">${['Regular', 'Playoff', 'Amistoso'].map(x => `<option ${f.instancia === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      </div>
      <datalist id="jornadas">${JORNADAS.map(j => `<option value="${j}">`).join('')}</datalist>
      <datalist id="canchas">${canchas.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <p class="alert" id="fxErr" role="alert"></p>
      <div class="row"><button class="btn primary" type="button" data-act="agregarPartido">+ Agregar partido</button><span class="small muted">La fecha, el día y la cancha quedan cargados para el próximo.</span></div>
    </section>
    ${data.fixture.length ? `<div class="stack"><h2 class="h3">Fixture · ${data.fixture.length} partidos</h2>
      <div class="table-wrap"><table class="t" style="min-width:980px"><thead><tr><th>Fecha</th><th>Día</th><th>Hora</th><th>Partido</th><th>Cancha</th><th>Instancia</th><th>Resultado</th><th>Anotador</th><th><span class="sr">Quitar</span></th></tr></thead>
      <tbody>${filas}</tbody></table></div>
      <span class="small muted">El resultado de los partidos de FENIX lo completa el anotador; el de los demás lo cargás acá y va directo a Posiciones.</span></div>`
      : '<p class="empty">Todavía no hay partidos cargados.</p>'}
  </div>`;
}

function calcularPosiciones(data) {
  const cfg = data.config || { puntosG: 3, puntosE: 1, puntosP: 0 };
  const copa = data.torneo.tipo === 'Copa';
  const filas = {};
  const grupos = {};
  data.equipos.forEach(e => {
    const g = copa && e.categoria ? e.categoria : 'General';
    const r = { nombre: e.equipo, logo: e.logo, pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0 };
    filas[norm(e.equipo)] = r;
    (grupos[g] = grupos[g] || []).push(r);
  });
  let jugados = 0;
  data.fixture.forEach(p => {
    if (/playoff|amist/i.test(p.instancia || '') || !tieneResultado(p)) return;
    const L = filas[norm(p.local)], V = filas[norm(p.visitante)];
    if (!L || !V) return;
    const gl = Number(p.gl), gv = Number(p.gv);
    jugados++; L.pj++; V.pj++; L.pf += gl; L.pc += gv; V.pf += gv; V.pc += gl;
    if (gl > gv) { L.pg++; V.pp++; } else if (gl < gv) { V.pg++; L.pp++; } else { L.pe++; V.pe++; }
  });
  Object.keys(grupos).forEach(g => {
    grupos[g].forEach(r => { r.pts = r.pg * cfg.puntosG + r.pe * cfg.puntosE + r.pp * cfg.puntosP; r.dif = r.pf - r.pc; });
    grupos[g].sort((a, b) => (b.pts - a.pts) || (b.dif - a.dif) || (b.pf - a.pf) || a.nombre.localeCompare(b.nombre));
  });
  return { grupos: grupos, jugados: jugados, cfg: cfg };
}
function tabPosiciones(data) {
  if (data.torneo.tipo === 'Amistosos') return '<p class="empty">Los amistosos no tienen tabla de posiciones.</p>';
  const p = calcularPosiciones(data);
  const nombresG = Object.keys(p.grupos).sort();
  if (!nombresG.length) return '<p class="empty">Agregá equipos al torneo para ver la tabla.</p>';
  return `<div class="stack-lg">
    <div class="row between"><h2 class="h3">Tabla de posiciones</h2><span class="small muted">${p.jugados} ${p.jugados === 1 ? 'partido jugado' : 'partidos jugados'} · Ganado ${p.cfg.puntosG} · Empate ${p.cfg.puntosE} · Perdido ${p.cfg.puntosP}</span></div>
    ${p.jugados ? '' : '<p class="empty">La tabla se arma sola cuando cargás resultados en el Fixture (solo partidos de instancia Regular).</p>'}
    ${nombresG.map(g => `<div class="stack">${nombresG.length > 1 || g !== 'General' ? `<h3 class="h3" style="font-size:18px">${esc(g)}</h3>` : ''}
      <div class="table-wrap"><table class="t" style="min-width:720px"><thead><tr><th>#</th><th>Equipo</th>
        ${[['PJ', 'Partidos jugados'], ['G', 'Ganados'], ['E', 'Empatados'], ['P', 'Perdidos'], ['PF', 'Puntos a favor'], ['PC', 'Puntos en contra'], ['DIF', 'Diferencia']].map(([a, t]) => `<th class="r"><abbr title="${t}" style="text-decoration:none">${a}</abbr></th>`).join('')}<th class="r">PTS</th></tr></thead>
      <tbody>${p.grupos[g].map((r, i) => `<tr class="${esFenix(r.nombre) ? 'fenix' : ''}">
        <td class="mono" style="font-weight:700">${i + 1}</td>
        <td><span class="row" style="gap:10px;flex-wrap:nowrap">${avatar(r.logo, r.nombre, 32, { logo: true })}<span class="team">${esc(r.nombre)}</span></span></td>
        <td class="r mono">${r.pj}</td><td class="r mono">${r.pg}</td><td class="r mono">${r.pe}</td><td class="r mono">${r.pp}</td>
        <td class="r mono muted">${r.pf}</td><td class="r mono muted">${r.pc}</td><td class="r mono">${r.dif > 0 ? '+' + r.dif : r.dif}</td>
        <td class="r mono accent" style="font-weight:700;font-size:18px">${r.pts}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}
  </div>`;
}

function tabJugadores(data) {
  if (!T.plantel) T.plantel = data.plantel.map(p => Object.assign({}, p));
  const sucio = JSON.stringify(T.plantel) !== JSON.stringify(data.plantel);
  const cont = {};
  T.plantel.forEach(p => { if (p.numero) cont[p.numero] = (cont[p.numero] || 0) + 1; });
  const genero = norm(data.torneo.genero).startsWith('f') ? 'f' : 'm';
  const enPlantel = new Set(T.plantel.map(p => p.jugadorId || norm(p.nombre)));
  const disp = S.bib ? S.bib.jugadores.filter(j => j.activo !== false && norm(j.genero).startsWith(genero) && !enPlantel.has(j.id) && !enPlantel.has(norm(j.nombre))) : [];
  const conStats = data.fixture.some(tieneResultado);
  return `<div class="stack-lg">
    <div class="row between"><div class="stack" style="gap:2px"><h2 class="h3">${T.plantel.length} convocados</h2>
      <span class="small muted">Las fotos se cargan y encuadran en la <a href="#/biblioteca">Biblioteca</a>. Acá se elige quién juega y con qué número.</span></div>
      <div class="row">${sucio ? '<span class="small" style="color:var(--accent-ink);font-weight:600">Cambios sin guardar</span>' : ''}<button class="btn primary" type="button" data-act="guardarPlantel" ${sucio ? '' : 'disabled'}>Guardar plantel</button></div></div>
    ${conStats ? '<p class="small" style="margin:0;padding:12px 14px;border:1px solid var(--accent);color:var(--accent-ink)">Ya hay partidos jugados: si cambiás el número de alguien, las jugadas viejas quedan con el número anterior.</p>' : ''}
    <div class="row" style="align-items:flex-end">
      <label class="field" style="flex:1 1 260px">Agregar de la biblioteca<select class="select" id="agregarJ"><option value="">${disp.length ? 'Elegí un jugador' : 'No hay más jugadores ' + (genero === 'f' ? 'femeninos' : 'masculinos') + ' en la biblioteca'}</option>${disp.map(j => `<option value="${esc(j.id)}">${esc(j.nombre)}${j.numero ? ' · #' + esc(j.numero) : ''}</option>`).join('')}</select></label>
      <button class="btn light" type="button" data-act="agregarJ">Agregar</button>
    </div>
    ${T.plantel.length ? `<div class="table-wrap"><table class="t" style="min-width:560px"><thead><tr><th>Jugador</th><th>N.º en este torneo</th><th>Posición</th><th><span class="sr">Quitar</span></th></tr></thead><tbody>
      ${T.plantel.map((p, i) => `<tr><td><span class="row" style="gap:12px;flex-wrap:nowrap">${avatar(p.foto, p.nombre, 40, { round: true })}<span style="font-weight:600">${esc(p.nombre)}</span></span></td>
        <td><input class="input num${cont[p.numero] > 1 ? ' dup' : ''}" data-pn="${i}" inputmode="numeric" value="${esc(p.numero)}" aria-label="Número de ${esc(p.nombre)}"></td>
        <td class="muted">${esc(p.posicion || '—')}</td>
        <td class="r"><button class="btn icon" type="button" data-act="quitarJ" data-i="${i}" aria-label="Quitar a ${esc(p.nombre)}">${ICON.x}</button></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="empty">No hay jugadores en el plantel.</p>'}
  </div>`;
}

function tabEquipos(data) {
  if (!T.equipos) {
    T.equipos = fenixPrimero(data.equipos.map(e => Object.assign({}, e)), 'equipo');
    if (!T.equipos.some(e => esFenix(e.equipo))) {
      const f = S.bib && S.bib.equipos.find(x => esFenix(x.nombre));
      T.equipos.unshift({ equipoId: f ? f.id : '', equipo: 'FENIX', logo: f ? f.logo : '', categoria: '' });
    }
  }
  const sucio = JSON.stringify(T.equipos) !== JSON.stringify(data.equipos);
  const g = norm(data.torneo.genero);
  const en = new Set(T.equipos.map(e => norm(e.equipo)));
  const disp = S.bib ? S.bib.equipos.filter(e => (norm(e.genero) === 'ambos' || norm(e.genero) === g) && !en.has(norm(e.nombre))) : [];
  const copa = data.torneo.tipo === 'Copa';
  const cats = copa ? [...new Set(grupoLetras(4).concat(T.equipos.map(e => e.categoria).filter(Boolean)))].sort() : null;
  return `<div class="stack-lg">
    <div class="row between"><div class="stack" style="gap:2px"><h2 class="h3">${T.equipos.length} equipos</h2>
      <span class="small muted">Los logos se cargan y encuadran en la <a href="#/biblioteca/equipos">Biblioteca</a>.</span></div>
      <div class="row">${sucio ? '<span class="small" style="color:var(--accent-ink);font-weight:600">Cambios sin guardar</span>' : ''}<button class="btn primary" type="button" data-act="guardarEquipos" ${sucio ? '' : 'disabled'}>Guardar equipos</button></div></div>
    <div class="row" style="align-items:flex-end">
      <label class="field" style="flex:1 1 260px">Agregar de la biblioteca<select class="select" id="agregarE"><option value="">${disp.length ? 'Elegí un equipo' : 'No hay más equipos en la biblioteca'}</option>${disp.map(e => `<option value="${esc(e.id)}">${esc(e.nombre)}</option>`).join('')}</select></label>
      <button class="btn light" type="button" data-act="agregarE">Agregar</button>
    </div>
    ${T.equipos.length ? `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;background:var(--line);border:1px solid var(--line)">
      ${T.equipos.map((e, i) => `<li class="row" style="background:${esFenix(e.equipo) ? 'var(--fenix-row)' : 'var(--surface)'};padding:8px 8px 8px 16px;gap:14px">
        <span class="mono muted" style="font-weight:700">${pad2(i + 1)}</span>${avatar(e.logo, e.equipo, 48, { logo: true })}
        <span class="team" style="flex:1;font-size:22px">${esc(e.equipo)}</span>
        ${copa ? `<label class="sr" for="ec${i}">Grupo de ${esc(e.equipo)}</label><select class="select" id="ec${i}" data-ec="${i}" style="width:auto;min-height:44px"><option value="">Grupo…</option>${cats.map(c => `<option ${e.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : ''}
        ${esFenix(e.equipo) ? '<span style="width:44px;flex:none"></span>' : `<button class="btn icon" type="button" data-act="quitarE" data-i="${i}" aria-label="Quitar ${esc(e.equipo)}">${ICON.x}</button>`}</li>`).join('')}</ul>` : '<p class="empty">No hay equipos.</p>'}
  </div>`;
}

function bindTorneo() {
  const data = () => S.torneo[T.id];
  const rerender = () => { renderTorneo(); };
  const guardarYRefrescar = async (btn, txt, op, payload, despues) => conBoton(btn, txt, async () => {
    const r = await api(op, Object.assign({ id: T.id }, payload));
    S.torneo[T.id] = r;
    if (despues) despues(r);
    rerender();
    return r;
  });
  view.oninput = e => {
    const k = e.target.dataset.fx;
    if (k) { T.form[k] = e.target.value; return; }
    const pn = e.target.dataset.pn;
    if (pn !== undefined) {
      const v = e.target.value.replace(/\D/g, '').slice(0, 3);
      e.target.value = v; T.plantel[Number(pn)].numero = v;
    }
  };
  view.onchange = e => {
    const k = e.target.dataset.fx;
    if (k) T.form[k] = e.target.value;
    if (e.target.dataset.pn !== undefined) rerender();
    if (e.target.dataset.ec !== undefined) { T.equipos[Number(e.target.dataset.ec)].categoria = e.target.value; rerender(); }
  };
  view.onkeydown = e => {
    if (e.key === 'Enter' && (e.target.id === 'rl' || e.target.id === 'rv')) { const b = view.querySelector('[data-act="guardarRes"]'); if (b) b.click(); }
    if (e.key === 'Escape' && T.editRes) { T.editRes = null; rerender(); }
  };
  bind({
    recargar: el => conBoton(el, 'Actualizando…', async () => { await getTorneo(T.id, true); T.plantel = T.equipos = null; rerender(); }),
    editarTorneo: async el => {
      const t = data().torneo;
      const v = await dialogoEditarTorneo(t);
      if (!v || (v.temporada === t.temporada && v.activa === t.activa)) return;
      guardarYRefrescar(el, 'Guardando…', 'editarTorneo', v, () => { S.torneos = null; toast('Torneo actualizado', 'ok'); });
    },
    copiar: el => { navigator.clipboard.writeText(el.dataset.url).then(() => toast('Link copiado', 'ok'), () => toast('No se pudo copiar', 'err')); },
    agregarPartido: el => {
      const f = T.form;
      const err = document.getElementById('fxErr');
      if (!f.local || !f.visitante) { err.textContent = 'Elegí el equipo local y el visitante.'; return; }
      if (f.local === f.visitante) { err.textContent = 'Local y visitante tienen que ser equipos distintos.'; return; }
      if (!f.dia && !f.jornada.trim()) { err.textContent = 'Poné la fecha (jornada) o el día del partido.'; return; }
      const nuevo = { jornada: f.jornada.trim(), dia: isoAFecha(f.dia), hora: f.hora, local: f.local, visitante: f.visitante, cancha: f.cancha.trim(), instancia: f.instancia, gl: '', gv: '' };
      const partidos = data().fixture.map(p => Object.assign({}, p)).concat([nuevo]);
      guardarYRefrescar(el, 'Guardando…', 'guardarFixture', { partidos: partidos }, () => {
        Object.assign(T.form, { hora: '', local: '', visitante: '' });
        toast('Partido agregado', 'ok');
      });
    },
    editarRes: el => { T.editRes = el.dataset.id; rerender(); const i = document.getElementById('rl'); if (i) { i.focus(); i.select(); } },
    cancelarRes: () => { T.editRes = null; rerender(); },
    guardarRes: el => {
      const gl = document.getElementById('rl').value.trim(), gv = document.getElementById('rv').value.trim();
      if ((gl === '') !== (gv === '') || (gl !== '' && (isNaN(Number(gl)) || isNaN(Number(gv))))) { toast('Poné los puntos de los dos equipos (o dejá los dos vacíos para borrar).', 'err'); return; }
      guardarYRefrescar(el, '…', 'guardarResultado', { partido: el.dataset.id, gl: gl, gv: gv }, () => { T.editRes = null; toast('Resultado guardado', 'ok'); });
    },
    preBorrar: el => { T.borrar = el.dataset.id; rerender(); },
    borrar: el => {
      const partidos = data().fixture.filter((p, i) => i !== Number(el.dataset.i)).map(p => Object.assign({}, p));
      guardarYRefrescar(el, 'Quitando…', 'guardarFixture', { partidos: partidos }, () => { T.borrar = null; toast('Partido quitado'); });
    },
    agregarJ: () => {
      const id = document.getElementById('agregarJ').value;
      const j = S.bib && S.bib.jugadores.find(x => x.id === id);
      if (!j) { toast('Elegí un jugador de la lista.'); return; }
      T.plantel.push({ jugadorId: j.id, numero: String(j.numero || ''), nombre: j.nombre, posicion: j.posicion, foto: j.foto });
      rerender();
    },
    quitarJ: el => { T.plantel.splice(Number(el.dataset.i), 1); rerender(); },
    guardarPlantel: el => {
      const cont = {};
      T.plantel.forEach(p => { if (p.numero) cont[p.numero] = (cont[p.numero] || 0) + 1; });
      const rep = Object.keys(cont).filter(k => cont[k] > 1);
      if (rep.length) { toast('Hay números repetidos: #' + rep.join(', #'), 'err'); return; }
      if (T.plantel.some(p => !p.numero)) { toast('Todos los jugadores necesitan número.', 'err'); return; }
      guardarYRefrescar(el, 'Guardando…', 'guardarPlantel', { jugadores: T.plantel.map(p => ({ id: p.jugadorId, numero: p.numero, nombre: p.nombre, posicion: p.posicion, foto: p.foto })) },
        () => { T.plantel = null; toast('Plantel guardado', 'ok'); });
    },
    agregarE: () => {
      const id = document.getElementById('agregarE').value;
      const e = S.bib && S.bib.equipos.find(x => x.id === id);
      if (!e) { toast('Elegí un equipo de la lista.'); return; }
      T.equipos.push({ equipoId: e.id, equipo: e.nombre, logo: e.logo, categoria: '' });
      rerender();
    },
    quitarE: el => { T.equipos.splice(Number(el.dataset.i), 1); rerender(); },
    guardarEquipos: el => guardarYRefrescar(el, 'Guardando…', 'guardarEquiposTorneo',
      { equipos: T.equipos.map(e => ({ id: e.equipoId, equipo: e.equipo, logo: e.logo, categoria: e.categoria })) },
      () => { T.equipos = null; toast('Equipos guardados', 'ok'); })
  });
}

/* =====================================================================
 *  CONFIGURACIÓN
 * ===================================================================== */
async function pageConfig() {
  const c = S.cfg;
  const render = () => {
    const e = S.estado;
    const fila = (ok, txt, sub) => `<li class="row" style="background:var(--bg);padding:12px 14px;gap:10px;flex-wrap:nowrap">
      <span style="width:8px;height:8px;border-radius:50%;flex:none;background:${ok ? 'var(--ok)' : 'var(--accent)'}"></span>
      <span style="flex:1">${txt}${sub ? ` <span class="small muted">${sub}</span>` : ''}</span><span class="small" style="font-weight:600;color:${ok ? 'var(--muted)' : 'var(--accent-ink)'}">${ok ? 'OK' : 'Falta'}</span></li>`;
    const carpetas = e ? Object.keys(e.carpetas) : [];
    const todoOk = e && e.indice && e.biblioteca.jugadores && e.biblioteca.equipos && carpetas.every(k => e.carpetas[k]) && e.plantilla;
    view.innerHTML = `
      ${pageHead('Conexiones y reglas', 'Configuración', e ? `<span class="badge off">SCRIPT ${esc(e.version || 'VIEJO')}</span><span class="badge ${todoOk && e.version === VERSION_ESPERADA ? 'ok' : 'warn'}">${todoOk && e.version === VERSION_ESPERADA ? '● TODO CONECTADO' : (e.version !== VERSION_ESPERADA ? '◐ ACTUALIZÁ EL SCRIPT' : '◐ CONFIGURACIÓN PENDIENTE')}</span>` : '')}
      <section class="card pad-lg" aria-labelledby="c1">
        <div class="stack" style="gap:4px"><span class="kicker" style="color:var(--accent)">01</span><h2 class="h2" id="c1">Conexión con Apps Script</h2>
          <span class="muted">Se guarda solo en este navegador. La clave es la ADMIN_KEY de las propiedades del script.</span></div>
        <div class="grid-form" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start">
          <label class="field" style="grid-column:1/-1">URL de la API<input class="input mono" id="apiUrl" type="url" value="${esc(c.apiUrl)}" placeholder="https://script.google.com/macros/s/…/exec" spellcheck="false"><span class="hint">La URL de la implementación como aplicación web; termina en /exec.</span></label>
          <label class="field">Clave de administrador<input class="input mono" id="apiKey" type="password" value="${esc(c.key)}" autocomplete="off"><span class="hint">La ADMIN_KEY del script.</span></label>
          <label class="field"><span>Link del anotador <span class="opt">(opcional)</span></span><input class="input mono" id="anotUrl" type="url" value="${esc(c.anotadorUrl)}" placeholder="https://…/anotador.html?planilla={planilla}&partido={partido}" spellcheck="false"><span class="hint">Podés usar {planilla}, {partido} y {genero}.</span></label>
        </div>
        <div class="row"><button class="btn primary" type="button" data-act="guardarCfg">Guardar y probar</button></div>
        ${e ? `<ul style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px;background:var(--line);border:1px solid var(--line)">
          ${fila(e.indice, 'Planilla Índice', e.indiceUrl ? `<a href="${esc(e.indiceUrl)}" target="_blank" rel="noopener">abrir</a>` : '')}
          ${fila(e.biblioteca.jugadores, 'Biblioteca_Jugadores')}${fila(e.biblioteca.equipos, 'Biblioteca_Equipos')}
          ${fila(e.plantilla, 'Plantilla para torneos nuevos')}
          ${carpetas.map(k => fila(e.carpetas[k], 'Carpeta de Drive', k)).join('')}
        </ul>
        <div class="row">
          ${!(e.biblioteca.jugadores && e.biblioteca.equipos) ? '<button class="btn light" type="button" data-act="preparar">Crear hojas de biblioteca</button>' : ''}
          <button class="btn" type="button" data-act="importar">Importar plantel y equipos de las planillas actuales</button>
          <span class="small muted">No duplica: si el jugador o equipo ya está, solo completa la foto o el logo que falte.</span>
        </div>` : ''}
      </section>
      ${e ? `<section class="card pad-lg" aria-labelledby="c2">
        <div class="stack" style="gap:4px"><span class="kicker" style="color:var(--accent)">02</span><h2 class="h2" id="c2">Temporada y tabla</h2><span class="muted">Se usan para la tabla de posiciones de todos los torneos.</span></div>
        <div class="grid-form">
          <label class="field">Temporada actual<input class="input mono" id="cfTemp" value="${esc(e.config.temporada)}"></label>
          <label class="field">Puntos por victoria<input class="input mono" id="cfG" type="number" min="0" max="9" value="${esc(e.config.puntosG)}"></label>
          <label class="field">Puntos por empate<input class="input mono" id="cfE" type="number" min="0" max="9" value="${esc(e.config.puntosE)}"></label>
          <label class="field">Puntos por derrota<input class="input mono" id="cfP" type="number" min="0" max="9" value="${esc(e.config.puntosP)}"></label>
        </div>
        <span class="small muted">Desempate: diferencia de puntos, después puntos a favor.</span>
        <div class="row"><button class="btn primary" type="button" data-act="guardarReglas">Guardar reglas</button></div>
      </section>` : ''}`;
  };
  if (!needsCfg() && !S.estado) { try { S.estado = await api('estado'); } catch (e) { toast(e.message, 'err'); } }
  render();
  bind({
    guardarCfg: el => conBoton(el, 'Probando…', async () => {
      S.cfg = { apiUrl: document.getElementById('apiUrl').value.trim(), key: document.getElementById('apiKey').value.trim(), anotadorUrl: document.getElementById('anotUrl').value.trim() };
      saveCfg(S.cfg);
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(S.cfg.apiUrl)) throw new Error('La URL tiene que ser de script.google.com y terminar en /exec.');
      S.torneos = S.bib = null; S.torneo = {};
      S.estado = await api('estado');
      toast('Conexión OK', 'ok');
      render();
    }),
    preparar: el => conBoton(el, 'Creando…', async () => { await api('prepararBiblioteca'); S.estado = await api('estado'); S.bib = null; toast('Biblioteca creada', 'ok'); render(); }),
    importar: el => conBoton(el, 'Importando…', async () => {
      const r = await api('importarBiblioteca'); S.estado = await api('estado'); S.bib = null;
      toast(`Importados: ${r.jugadoresNuevos} jugadores y ${r.equiposNuevos} equipos nuevos`, 'ok'); render();
    }),
    guardarReglas: el => conBoton(el, 'Guardando…', async () => {
      const r = await api('guardarConfig', { config: { temporada: document.getElementById('cfTemp').value.trim(), puntosG: document.getElementById('cfG').value, puntosE: document.getElementById('cfE').value, puntosP: document.getElementById('cfP').value } });
      S.estado.config = r.config; S.torneo = {};
      toast('Reglas guardadas', 'ok');
    })
  });
}

// Si una foto o logo no carga (link de Drive roto), se muestran las iniciales.
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement)) return;
  const ph = img.closest('.ph, .lib-card');
  if (!ph) return;
  const ini = document.createElement('span');
  ini.className = 'ini';
  const nombre = (img.closest('.lib-card') && img.closest('.lib-card').querySelector('.name')) || (ph.parentElement && ph.parentElement.querySelector('.team'));
  ini.textContent = nombre ? iniciales(nombre.textContent) : '';
  img.replaceWith(ini);
}, true);

/* ===================================================================== */
router();
