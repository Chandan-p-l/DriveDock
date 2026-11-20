'use strict';
/* DriveDock UI — talks to the local DriveDock service (server.py). */

const TOKEN = document.querySelector('meta[name="dd-token"]').content;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;

const ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  folder: 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z',
  cloud: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z',
  cloud_done: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17 15.18 9l1.41 1.41L10 17z',
  cloud_upload: 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z',
  cloud_off: 'M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 6.23 11.08 6 12 6c3.04 0 5.5 2.46 5.5 5.5v.5H19c1.66 0 3 1.34 3 3 0 1.13-.64 2.11-1.56 2.62l1.45 1.45C23.16 18.16 24 16.68 24 15c0-2.64-2.05-4.78-4.65-4.96zM3 5.27l2.75 2.74C2.56 8.15 0 10.77 0 14c0 3.31 2.69 6 6 6h11.73l2 2L21 20.73 4.27 4 3 5.27zM7.73 10l8 8H6c-2.21 0-4-1.79-4-4s1.79-4 4-4h1.73z',
  history: 'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4l2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  ethernet: 'M7.77 6.76L6.23 5.48.82 12l5.41 6.52 1.54-1.28L3.42 12l4.35-5.24zM7 13h2v-2H7v2zm10-2h-2v2h2v-2zm-6 2h2v-2h-2v2zm6.77-7.52l-1.54 1.28L20.58 12l-4.35 5.24 1.54 1.28L23.18 12l-5.41-6.52z',
  battery: 'M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z',
  schedule: 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z',
  storage: 'M2 20h20v-4H2v4zm2-3h2v2H4v-2zM2 4v4h20V4H2zm4 3H4V5h2v2zm-4 7h20v-4H2v4zm2-3h2v2H4v-2z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  download: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
  upload: 'M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  open: 'M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z',
  refresh: 'M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  newfolder: 'M20 6h-8l-2-2H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-1 8h-3v3h-2v-3h-3v-2h3V9h2v3h3v2z',
  file: 'M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  video: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
  audio: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  zip: 'M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2 6h-2v2h2v2h-2v2h-2v-2h2v-2h-2v-2h2v-2h-2V8h2v2h2v2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  warn: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  chevron: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
  expand: 'M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z',
  up: 'M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z',
  close: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  usb: 'M15 7v4h1v2h-3V5h2l-3-4-3 4h2v8H8v-2.07c.7-.37 1.2-1.08 1.2-1.93 0-1.21-.99-2.2-2.2-2.2S4.8 7.79 4.8 9c0 .85.5 1.56 1.2 1.93V13c0 1.11.89 2 2 2h3v3.05c-.71.37-1.2 1.1-1.2 1.95a2.2 2.2 0 0 0 4.4 0c0-.85-.49-1.58-1.2-1.95V15h3c1.11 0 2-.89 2-2v-2h1V7h-4z',
  sort: 'M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z',
  log: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM16 18H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ICONS.file}"/></svg>`;

/* ---------- formatting ---------- */
function bytes(n) {
  if (n == null || n < 0) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return (i ? n.toFixed(n < 10 ? 2 : 1) : n) + ' ' + u[i];
}
function ago(t) {
  if (!t) return 'never';
  const s = Date.now() / 1000 - t;
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.round(s / 86400) + ' days ago';
  return new Date(t * 1000).toLocaleDateString();
}
function until(t) {
  const s = t - Date.now() / 1000;
  if (s <= 60) return 'any moment';
  if (s < 3600) return 'in ' + Math.round(s / 60) + ' min';
  return 'in ' + (s / 3600).toFixed(s < 36000 ? 1 : 0) + ' h';
}
function dur(s) {
  s = Math.round(s || 0);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
  return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
}
const when = t => new Date(t * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const modDate = iso => iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/* ---------- api ---------- */
async function api(path, body) {
  const o = { headers: { 'X-DriveDock-Token': TOKEN } };
  if (body !== undefined) { o.method = 'POST'; o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api/' + path, o); } catch { throw new Error('DriveDock service is not running'); }
  const j = await r.json().catch(() => ({ error: r.statusText }));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

/* ---------- toasts & modals ---------- */
function toast(msg, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3200);
}
function openModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modal').hidden = false;
  const close = () => { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; };
  $$('[data-close]', $('#modalBox')).forEach(b => b.onclick = close);
  setTimeout(() => $('#modalBox input[type=text]')?.focus(), 30);
  return close;
}
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') { $('#modal').hidden = true; } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });

function confirmBox(title, text, ok = 'OK', danger = false) {
  return new Promise(res => {
    const close = openModal(`<header>${esc(title)}</header><div class="mbody">${text}</div>
      <footer><button class="btn" id="cNo">Cancel</button><button class="btn ${danger ? 'danger solid' : 'primary'}" id="cYes">${esc(ok)}</button></footer>`);
    $('#cNo').onclick = () => { close(); res(false); };
    $('#cYes').onclick = () => { close(); res(true); };
  });
}
function promptBox(title, label, value = '') {
  return new Promise(res => {
    const close = openModal(`<header>${esc(title)}</header><div class="mbody"><label class="field"><span>${esc(label)}</span>
      <input type="text" id="pVal" value="${esc(value)}"></label></div>
      <footer><button class="btn" id="pNo">Cancel</button><button class="btn primary" id="pYes">OK</button></footer>`);
    const done = v => { close(); res(v); };
    $('#pNo').onclick = () => done(null);
    $('#pYes').onclick = () => done($('#pVal').value.trim() || null);
    $('#pVal').onkeydown = e => { if (e.key === 'Enter') done($('#pVal').value.trim() || null); };
    const dot = value.lastIndexOf('.');
    setTimeout(() => $('#pVal')?.setSelectionRange(0, dot > 0 ? dot : value.length), 40);
  });
}

/* ---------- theme ---------- */
function applyTheme(t) {
  try { localStorage.setItem('dd-theme', t); } catch {}
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
try { applyTheme(localStorage.getItem('dd-theme') || 'system'); } catch {}

/* ---------- state & routing ---------- */
let S = null;
let view = (location.hash || '#dashboard').slice(1);
let ABOUT = null, aboutAt = 0;
const expanded = new Set();
const seenTasks = new Set();
let settingsRendered = false;

window.addEventListener('hashchange', () => { view = location.hash.slice(1) || 'dashboard'; showView(); });

function showView() {
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  $$('.view').forEach(v => v.hidden = v.id !== 'view-' + view);
  if (!S) return;
  if (view === 'drive' && !D.loaded) driveLoad('');
  if (view === 'settings') settingsRendered = false;
  if (view === 'dashboard' && Date.now() - aboutAt > 60000) loadAbout();
  render();
}

async function poll() {
  let busy = false;
  try {
    S = await api('state');
    busy = S.run || S.tasks.some(t => t.status === 'running') || S.connecting.status === 'waiting';
    checkFinishedTasks();
    render();
  } catch (e) {
    $('#sideFoot').innerHTML = `<div class="row"><span class="dot err"></span>Service offline</div>`;
  }
  setTimeout(poll, busy ? 1000 : 3000);
}

function checkFinishedTasks() {
  for (const t of S.tasks) {
    if (t.status === 'running' || seenTasks.has(t.id)) continue;
    seenTasks.add(t.id);
    if (t.started * 1000 < bootAt) continue;
    if (t.kind === 'upload' && view === 'drive' && D.mode === 'browse') driveLoad(D.path, true);
    if (t.status === 'error') toast(`${t.kind} failed: ${t.error || t.label}`, true);
  }
}
const bootAt = Date.now();

function render() {
  if (!S) return;
  const setupMode = !S.connected;
  $('#setup').hidden = !setupMode;
  $('#app').hidden = setupMode;
  if (setupMode) return renderSetup();
  renderSide();
  renderTasks();
  if (view === 'dashboard') renderDashboard();
  else if (view === 'folders') renderFolders();
  else if (view === 'activity') renderActivity();
  else if (view === 'settings' && !settingsRendered) renderSettings();
}

/* ---------- setup ---------- */
function renderSetup() {
  const c = S.connecting || {};
  const el = $('#setup');
  const key = c.status + (c.url || '') + (c.error || '');
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  let action;
  if (c.status === 'waiting') {
    action = `<div style="display:flex;gap:10px;align-items:center;justify-content:center;margin:18px 0 8px"><span class="spinner"></span>
      <b>Waiting for you to sign in with Google…</b></div>
      <p class="muted small">A Google sign-in page should have opened in your browser.${c.url ? ` If not, <a href="${esc(c.url)}" target="_blank">open it here</a>.` : ''}</p>
      <button class="btn" data-act="connect-cancel">Cancel</button>`;
  } else {
    action = `${c.status === 'error' ? `<p class="badge err" style="white-space:pre-wrap;text-align:left;display:block;padding:10px;border-radius:10px">${esc(c.error)}</p>` : ''}
      <button class="btn primary big" data-act="connect">${ic('cloud')}Connect Google Drive</button>`;
  }
  el.innerHTML = `<div class="card">
    <img src="/icon.svg" alt="">
    <h1>Welcome to DriveDock</h1>
    <p class="muted">Back up the folders you choose from this laptop to your Google Drive, automatically.</p>
    <ul>
      <li>You pick exactly which folders are backed up, never the whole computer</li>
      <li>Backs up automatically when you connect to Wi-Fi, and on a schedule</li>
      <li>Browse, download and clean up your Drive from one window</li>
    </ul>
    ${action}
    <details><summary class="small muted">Advanced: use your own Google API client ID (faster for big backups)</summary>
      <p class="small muted">Optional. Create an OAuth "Desktop app" client in Google Cloud Console and paste it here. Leave empty to use the default.</p>
      <label class="field"><span>Client ID</span><input type="text" id="cid"></label>
      <label class="field"><span>Client secret</span><input type="password" id="csec"></label>
    </details>
    <p class="small muted" style="margin-top:18px">Your Google sign-in stays on this computer only.</p>
  </div>`;
}

/* ---------- sidebar ---------- */
function netIcon(n) { return n.type === 'ethernet' ? 'ethernet' : n.online ? 'wifi' : 'cloud_off'; }
function renderSide() {
  const n = S.net || {}, r = S.run;
  const status = r ? `<span class="spinner" style="width:12px;height:12px;border-width:2px"></span>Backing up…`
    : S.auto.ok ? `<span class="dot ok"></span>Auto-backup ready` : `<span class="dot warn"></span>Auto-backup waiting`;
  $('#sideFoot').innerHTML = `
    <div class="row">${status}</div>
    <div class="row muted">${ic(netIcon(n))}<span class="ellipsis">${n.online ? esc(n.ssid || n.name || n.type) : 'Offline'}${n.metered ? ' · metered' : ''}</span></div>
    <div class="row muted">${ic('cloud_done')}Last: ${ago(S.last_success)}</div>`;
}

/* ---------- dashboard ---------- */
async function loadAbout() {
  aboutAt = Date.now();
  try { ABOUT = await api('about'); if (view === 'dashboard') renderDashboard(); } catch (e) { ABOUT = { error: e.message }; }
}

function heroHTML() {
  const r = S.run;
  if (r) {
    const p = r.progress || {};
    const pct = p.totalBytes ? Math.min(100, (p.bytes / p.totalBytes) * 100) : 0;
    const cur = r.folders.find(f => f.id === r.current);
    const xfer = (p.transferring || []).map(t => `<span class="ellipsis">${esc(t.name)}</span><span class="muted" style="text-align:right">${t.percentage}%</span>`).join('');
    const q = r.folders.map(f => `<span class="badge ${f.status === 'running' ? 'blue' : f.status === 'success' ? 'ok' : f.status === 'queued' ? '' : 'err'}">${esc(f.name)}</span>`).join('');
    return `<div class="card hero running"><div class="halo">${ic('cloud_upload')}</div><div class="body">
      <h2>Backing up ${esc(cur ? cur.name : '')}…</h2>
      <div class="muted">${esc(r.reason)} · started ${ago(r.started)}</div>
      <div class="bar" style="margin-top:14px"><div style="width:${pct.toFixed(1)}%"></div></div>
      <div class="prog-meta"><span><b>${bytes(p.bytes || 0)}</b> of ${bytes(p.totalBytes || 0)}</span>
        <span><b>${p.transfers || 0}</b> / ${p.totalTransfers || 0} files</span>
        <span>${bytes(p.speed || 0)}/s</span><span>ETA ${p.eta != null ? dur(p.eta) : '—'}</span>
        <span>${p.checks || 0} checked</span>${p.errors ? `<span class="badge err">${p.errors} errors</span>` : ''}</div>
      ${xfer ? `<div class="xfer">${xfer}</div>` : ''}
      <div class="queue">${q}</div></div>
      <div class="actions"><button class="btn danger" data-act="stop">${ic('stop')}Stop</button></div></div>`;
  }
  if (!S.folders.length) {
    return `<div class="card hero warn"><div class="halo">${ic('folder')}</div><div class="body">
      <h2>Choose what to back up</h2><div class="muted">Add the folders you care about, such as Documents, Pictures or your projects. Only those will be backed up.</div></div>
      <div class="actions"><button class="btn primary big" data-act="add-folder">${ic('add')}Add folder</button></div></div>`;
  }
  const last = S.history[0];
  const pauseBtn = S.config.paused
    ? `<button class="btn" data-act="resume">${ic('play')}Resume</button>`
    : `<button class="btn" data-act="pause">${ic('pause')}Pause</button>`;
  const nowBtn = `<button class="btn primary" data-act="backup-now">${ic('cloud_upload')}Back up now</button>`;
  let cls = 'ok', icon = 'cloud_done', title, sub;
  if (last && (last.status === 'error' || last.status === 'partial')) {
    cls = 'err'; icon = 'error'; title = 'Last backup had problems';
    sub = `${when(last.ended)} · open Activity for details`;
  } else if (!S.last_success) {
    cls = 'warn'; icon = 'cloud_upload'; title = 'Not backed up yet';
    sub = S.auto.ok ? 'First backup will start shortly, or press Back up now.' : esc(S.auto.reason);
  } else {
    title = 'Your folders are backed up';
    sub = `Last backup ${ago(S.last_success)}`;
  }
  if (!S.auto.ok && S.last_success) {
    if (cls === 'ok') cls = 'warn';
    sub += ` · Auto-backup waiting: ${esc(S.auto.reason)}`;
  } else if (S.auto.ok && S.config.auto_enabled && S.auto.next && S.last_success) {
    sub += ` · next ${until(S.auto.next)}`;
  }
  return `<div class="card hero ${cls}"><div class="halo">${ic(icon)}</div><div class="body">
    <h2>${title}</h2><div class="muted">${sub}</div></div>
    <div class="actions">${nowBtn}${pauseBtn}</div></div>`;
}

function renderDashboard() {
  const n = S.net || {}, p = S.power || {}, c = S.config;
  let storage;
  if (!ABOUT) storage = `<div class="muted"><span class="spinner"></span></div>`;
  else if (ABOUT.error) storage = `<div class="muted small">${esc(ABOUT.error)}</div>`;
  else {
    const pct = ABOUT.total ? (ABOUT.used / ABOUT.total) * 100 : 0;
    storage = `<div class="stat-big">${bytes(ABOUT.used)}</div><div class="muted small">of ${bytes(ABOUT.total)} used · ${bytes(ABOUT.free)} free</div>
      <div class="bar" style="margin:12px 0 8px"><div style="width:${Math.max(pct, 0.6)}%"></div></div>
      ${ABOUT.trashed ? `<div class="kv"><span>In trash</span><span>${bytes(ABOUT.trashed)} <a href="#" data-act="empty-trash">Empty</a></span></div>` : ''}`;
  }
  const backedUp = S.folders.reduce((a, f) => a + (f.status.local_bytes || 0), 0);
  const netBadge = !n.online ? '<span class="badge err">Offline</span>' : n.metered ? '<span class="badge warn">Metered</span>' : '<span class="badge ok">Unmetered</span>';
  const recent = S.history.slice(0, 5).map(h => `<div class="list-row">${statusIcon(h.status)}
      <div style="flex:1;min-width:0"><b>${esc(h.reason)}</b><div class="muted small">${when(h.started)} · ${h.files} files · ${bytes(h.bytes)}</div></div>
      <span class="muted small">${dur(h.ended - h.started)}</span></div>`).join('')
    || `<div class="muted small" style="padding:8px 0">No backups yet.</div>`;

  $('#view-dashboard').innerHTML = `
    <div class="view-head"><h1>Dashboard</h1><span class="muted small">${esc(S.hostname)}</span></div>
    ${heroHTML()}
    <div class="grid g4" style="margin-top:16px">
      <div class="card"><h3>${ic('storage')}Google Drive</h3>${storage}</div>
      <div class="card"><h3>${ic('folder')}Protected</h3>
        <div class="stat-big">${S.folders.filter(f => f.enabled).length} <span class="muted" style="font-size:15px">folder${S.folders.length === 1 ? '' : 's'}</span></div>
        <div class="muted small">${bytes(backedUp)} selected for backup</div>
        <div style="margin-top:12px"><a href="#folders">Manage folders →</a></div></div>
      <div class="card"><h3>${ic(netIcon(n))}Network</h3>
        <div class="stat-big ellipsis" style="font-size:20px">${n.online ? esc(n.ssid || n.name || n.type) : 'Offline'}</div>
        <div style="margin:6px 0 10px">${netBadge}</div>
        <div class="small ${S.auto.ok ? 'muted' : ''}" style="${S.auto.ok ? '' : 'color:var(--warn)'}">${S.auto.ok ? 'Auto-backup allowed here' : esc(S.auto.reason)}</div></div>
      <div class="card"><h3>${ic('schedule')}Schedule</h3>
        <div class="kv"><span>Auto-backup</span><span>${c.auto_enabled && !c.paused ? '<span class="badge ok">On</span>' : '<span class="badge warn">Off</span>'}</span></div>
        <div class="kv"><span>On Wi-Fi connect</span><span>${c.backup_on_connect ? 'Yes' : 'No'}</span></div>
        <div class="kv"><span>Every</span><span>${c.interval_hours ? c.interval_hours + ' h' : 'Off'}</span></div>
        <div class="kv"><span>Battery</span><span>${p.has_battery ? `${p.percent}%${p.plugged ? ' ⚡' : ''}` : 'AC power'}</span></div></div>
    </div>
    <div class="card" style="margin-top:16px"><h3>${ic('history')}Recent activity</h3>${recent}
      ${S.history.length > 5 ? `<div style="margin-top:10px"><a href="#activity">See all →</a></div>` : ''}</div>`;
}

function statusIcon(s) {
  const m = { success: ['check', 'ok'], partial: ['warn', 'warn'], error: ['error', 'err'], cancelled: ['stop', ''], running: ['cloud_upload', 'blue'], queued: ['schedule', ''] };
  const [i, c] = m[s] || ['file', ''];
  return `<span class="badge ${c}" style="padding:4px;border-radius:50%">${ic(i)}</span>`;
}

/* ---------- folders ---------- */
function renderFolders() {
  const runMap = {};
  if (S.run) for (const f of S.run.folders) runMap[f.id] = f;
  const cards = S.folders.map(f => {
    const st = f.status || {}, rf = runMap[f.id];
    let state;
    if (rf && rf.status === 'running') {
      const p = S.run.progress || {};
      const pct = p.totalBytes ? (p.bytes / p.totalBytes) * 100 : 0;
      state = `<span class="badge blue"><span class="spinner" style="width:10px;height:10px;border-width:2px"></span>${pct.toFixed(0)}%</span>`;
    } else if (rf && rf.status === 'queued') state = '<span class="badge">Queued</span>';
    else if (!f.exists) state = '<span class="badge err">Folder missing</span>';
    else if (!f.enabled) state = '<span class="badge">Paused</span>';
    else if (st.last_status === 'error' || st.last_status === 'partial') state = `<span class="badge err" title="${esc(st.last_error)}">Problem</span>`;
    else if (st.last_success) state = '<span class="badge ok">Backed up</span>';
    else state = '<span class="badge warn">Not backed up yet</span>';
    return `<div class="card fcard">
      <div class="ficon ${f.enabled ? '' : 'off'}">${ic(f.path.startsWith('/media/') || f.path.startsWith('/mnt/') ? 'usb' : 'folder')}</div>
      <div style="min-width:0">
        <h4>${esc(f.name)} ${state} <span class="badge ${f.mode === 'mirror' ? 'blue' : ''}">${f.mode === 'mirror' ? 'Mirror' : 'Backup'}</span></h4>
        <div class="muted small mono ellipsis">${esc(f.path)}</div>
        <div class="fmeta">
          <span>${st.local_bytes != null ? `${bytes(st.local_bytes)} · ${(st.local_count || 0).toLocaleString()} files` : 'Measuring…'}</span>
          <span>Last backup: ${ago(st.last_success)}</span>
          <span class="ellipsis">→ My Drive/${esc(f.dest)}</span>
          ${f.excludes.length ? `<span>${f.excludes.length} skip rule${f.excludes.length > 1 ? 's' : ''}</span>` : ''}
        </div>
        ${(st.last_status === 'error' || st.last_status === 'partial') && st.last_error ? `<div class="small" style="color:var(--err);margin-top:6px">${esc(st.last_error)}</div>` : ''}
      </div>
      <div class="factions">
        <label class="switch" title="Include in automatic backups"><input type="checkbox" data-act="toggle-folder" data-id="${f.id}" ${f.enabled ? 'checked' : ''}><i></i></label>
        <button class="btn ghost icon" title="Back up this folder now" data-act="backup-folder" data-id="${f.id}" ${S.run ? 'disabled' : ''}>${ic('cloud_upload')}</button>
        <button class="btn ghost icon" title="Show backup in My Drive" data-act="show-in-drive" data-id="${f.id}">${ic('cloud')}</button>
        <button class="btn ghost icon" title="Restore a copy to this computer" data-act="restore" data-id="${f.id}">${ic('download')}</button>
        <button class="btn ghost icon" title="Edit" data-act="edit-folder" data-id="${f.id}">${ic('edit')}</button>
        <button class="btn ghost icon" title="Stop backing up this folder" data-act="remove-folder" data-id="${f.id}">${ic('delete')}</button>
      </div></div>`;
  }).join('');
  $('#view-folders').innerHTML = `
    <div class="view-head"><h1>Backup folders</h1>
      ${S.folders.length ? `<button class="btn" data-act="backup-now" ${S.run ? 'disabled' : ''}>${ic('cloud_upload')}Back up all now</button>` : ''}
      <button class="btn primary" data-act="add-folder">${ic('add')}Add folder</button></div>
    ${cards ? `<div class="grid">${cards}</div>
      <p class="muted small" style="margin-top:16px">Backups go to <b>My Drive / ${esc(S.config.backup_root)}</b>. The toggle controls whether a folder is part of automatic backups.</p>`
    : `<div class="card empty">${ic('folder')}<h2>No folders yet</h2><p>Add only the folders you want protected, for example Documents, Pictures or Projects.</p>
       <button class="btn primary" data-act="add-folder">${ic('add')}Add your first folder</button></div>`}`;
}

function folderModal(f) {
  const isEdit = !!f;
  let cur = S.paths.home, hidden = false, nameTouched = isEdit;
  const close = openModal(`<header>${isEdit ? 'Edit ' + esc(f.name) : 'Add a folder to back up'}</header><div class="mbody">
    ${isEdit ? `<label class="field"><span>Folder on this computer</span><div class="mono small">${esc(f.path)}</div></label>`
      : `<div class="field"><span style="font-weight:600;display:block;margin-bottom:6px">Pick a folder</span><div class="picker">
          <div class="ppath"><button class="btn icon ghost" id="pUp" title="Up">${ic('up')}</button><input type="text" id="pPath">
          <label class="small" style="display:flex;gap:4px;align-items:center;white-space:nowrap"><input type="checkbox" id="pHidden">Hidden</label></div>
          <div class="places" id="pPlaces"></div><div class="dirs" id="pDirs"></div></div>
          <small class="muted">The folder shown in the path bar is the one that will be added.</small></div>`}
    <label class="field"><span>Name on Drive</span><input type="text" id="fName" value="${esc(f ? f.name : '')}">
      <small>Saved to My Drive / ${esc(S.config.backup_root)} / <b id="fDest">${esc(f ? f.name : '')}</b>${isEdit ? ' · renaming starts a new backup folder on Drive' : ''}</small></label>
    <div class="field"><span style="font-weight:600;display:block;margin-bottom:6px">Backup mode</span>
      <label class="mode-opt"><input type="radio" name="mode" value="copy" ${!f || f.mode !== 'mirror' ? 'checked' : ''}><div><b>Backup (recommended)</b>
        <span>New and changed files are uploaded. Deleting a file here never deletes it from Drive.</span></div></label>
      <label class="mode-opt"><input type="radio" name="mode" value="mirror" ${f && f.mode === 'mirror' ? 'checked' : ''}><div><b>Mirror</b>
        <span>Drive matches this folder exactly. Files you delete here are removed from the backup${S.config.keep_versions ? ' (an old copy is kept in .versions)' : ''}.</span></div></label></div>
    <label class="field"><span>Skip these files (one pattern per line)</span>
      <textarea id="fEx" placeholder="*.iso&#10;Temp/**&#10;*.log">${esc((f ? f.excludes : []).join('\n'))}</textarea>
      <small>Already skipped everywhere: ${esc(S.config.global_excludes.join(', '))}</small></label>
  </div><footer><button class="btn" data-close>Cancel</button><button class="btn primary" id="fSave">${isEdit ? 'Save' : 'Add folder'}</button></footer>`);

  const nameEl = $('#fName');
  nameEl.oninput = () => { nameTouched = true; $('#fDest').textContent = nameEl.value; };

  async function go(path) {
    try {
      const r = await api(`local/ls?path=${enc(path)}&hidden=${hidden ? 1 : 0}`);
      cur = r.path;
      $('#pPath').value = cur;
      $('#pUp').disabled = !r.parent;
      $('#pUp').onclick = () => r.parent && go(r.parent);
      $('#pPlaces').innerHTML = r.places.map(p => `<button class="chip" data-p="${esc(p.path)}">${p.drive ? '💽 ' : ''}${esc(p.name)}</button>`).join('');
      $('#pDirs').innerHTML = r.dirs.length ? r.dirs.map(d => `<div data-p="${esc(d.path)}">${ic('folder')}<span class="ellipsis">${esc(d.name)}</span></div>`).join('')
        : `<div class="muted small" style="cursor:default">No sub-folders</div>`;
      $$('[data-p]', $('#modalBox')).forEach(el => el.onclick = () => go(el.dataset.p));
      if (!nameTouched) { const b = cur.split('/').filter(Boolean).pop() || 'Home'; nameEl.value = b; $('#fDest').textContent = b; }
    } catch (e) { toast(e.message, true); }
  }
  if (!isEdit) {
    $('#pHidden').onchange = e => { hidden = e.target.checked; go(cur); };
    $('#pPath').onkeydown = e => { if (e.key === 'Enter') go($('#pPath').value); };
    go(cur);
  }
  $('#fSave').onclick = async () => {
    const body = { name: nameEl.value.trim(), mode: $('input[name=mode]:checked').value, excludes: $('#fEx').value.split('\n') };
    try {
      if (isEdit) { await api('folders/update', { id: f.id, ...body }); toast('Saved'); }
      else {
        if (cur === S.paths.home && !(await confirmBox('Back up your entire home folder?', '<p>That includes everything in your home folder. Usually it’s better to add specific folders like Documents or Pictures.</p>', 'Add anyway'))) return;
        await api('folders/add', { path: cur, ...body });
        toast(`Added ${body.name || cur}. Press “Back up now” or wait for the next automatic backup.`);
      }
      close(); refresh();
    } catch (e) { toast(e.message, true); }
  };
}

/* ---------- drive browser ---------- */
const D = { path: '', items: [], sort: { k: 'name', dir: 1 }, sel: new Set(), filter: '', loading: false, loaded: false, mode: 'browse', scanned: 0 };
const uploads = [];

function fileKind(it) {
  if (it.dir) return ['folder', '#8a94a6'];
  const m = it.mime || '', n = it.name.toLowerCase();
  if (m.includes('google-apps.document')) return ['file', '#4285f4'];
  if (m.includes('google-apps.spreadsheet') || /\.(xlsx?|csv|ods)$/.test(n)) return ['file', '#0f9d58'];
  if (m.includes('google-apps.presentation') || /\.(pptx?|odp)$/.test(n)) return ['file', '#f4b400'];
  if (m.startsWith('image/')) return ['image', '#d93025'];
  if (m.startsWith('video/')) return ['video', '#d93025'];
  if (m.startsWith('audio/')) return ['audio', '#9334e6'];
  if (m.includes('pdf')) return ['file', '#d93025'];
  if (/zip|compressed|tar|rar|7z|gzip/.test(m)) return ['zip', '#5f6368'];
  return ['file', '#5f6368'];
}

async function driveLoad(path, quiet = false) {
  D.path = path; D.mode = 'browse'; D.loaded = true;
  if (!quiet) { D.loading = true; D.sel.clear(); D.filter = ''; renderDrive(); }
  try { D.items = (await api('ls?path=' + enc(path))).items; }
  catch (e) { toast(e.message, true); D.items = []; }
  D.loading = false;
  if (quiet) renderDriveTable(); else renderDrive();
}

async function driveLarge() {
  D.mode = 'large'; D.loading = true; D.sel.clear(); renderDrive();
  try { const r = await api(`large?path=${enc(D.path)}&min_mb=50`); D.items = r.items; D.scanned = r.scanned; }
  catch (e) { toast(e.message, true); D.items = []; }
  D.loading = false; renderDrive();
}

function renderDrive() {
  const parts = D.path ? D.path.split('/') : [];
  let acc = '';
  const crumbs = [`<a href="#" data-act="cd" data-path="">My Drive</a>`].concat(parts.map(p => {
    acc = acc ? acc + '/' + p : p;
    return `<span class="sep">${ic('chevron')}</span><a href="#" data-act="cd" data-path="${esc(acc)}">${esc(p)}</a>`;
  })).join('');
  $('#view-drive').innerHTML = `
    <div class="view-head"><h1>My Drive</h1>
      <button class="btn" data-act="upload">${ic('upload')}Upload</button>
      <button class="btn" data-act="mkdir">${ic('newfolder')}New folder</button></div>
    <div class="toolbar">
      <input type="text" id="dFilter" placeholder="Filter this folder…" value="${esc(D.filter)}">
      <button class="btn ${D.mode === 'large' ? 'primary' : ''}" data-act="large" title="Find files bigger than 50 MB in this folder and everything inside it">${ic('sort')}Largest files</button>
      <span class="grow"></span>
      <button class="btn ghost icon" title="Refresh" data-act="refresh-drive">${ic('refresh')}</button>
      <button class="btn ghost" data-act="open-downloads" title="Open the folder downloads are saved to">${ic('folder')}Downloads</button>
    </div>
    <div class="crumbs">${crumbs}${D.mode === 'large' ? `<span class="sep">${ic('chevron')}</span><span class="badge blue">Largest files (≥ 50 MB)</span>` : ''}</div>
    <div id="dTable"></div>
    <input type="file" id="dUpload" multiple hidden>`;
  $('#dFilter').oninput = e => { D.filter = e.target.value.toLowerCase(); renderDriveTable(); };
  $('#dUpload').onchange = e => { uploadFiles([...e.target.files]); e.target.value = ''; };
  renderDriveTable();
}

function sortedItems() {
  const { k, dir } = D.sort;
  let items = D.items.filter(i => !D.filter || i.name.toLowerCase().includes(D.filter));
  items.sort((a, b) => {
    if (D.mode === 'browse' && a.dir !== b.dir) return a.dir ? -1 : 1;
    let x = a[k], y = b[k];
    if (k === 'name') return dir * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    if (k === 'mod') { x = Date.parse(x) || 0; y = Date.parse(y) || 0; }
    return dir * ((x || 0) - (y || 0));
  });
  return items;
}

function renderDriveTable() {
  const el = $('#dTable');
  if (!el) return;
  if (D.loading) {
    el.innerHTML = `<div class="card empty"><span class="spinner"></span><p>${D.mode === 'large' ? 'Scanning your Drive for big files… this can take a minute.' : 'Loading…'}</p></div>`;
    return;
  }
  const items = sortedItems();
  D.view = items;
  if (!items.length) {
    el.innerHTML = `<div class="card empty">${ic(D.mode === 'large' ? 'check' : 'cloud')}<h2>${D.filter ? 'No matches' : D.mode === 'large' ? 'No files over 50 MB here' : 'This folder is empty'}</h2>
      <p>${D.mode === 'large' ? `Scanned ${D.scanned.toLocaleString()} files.` : 'Drop files here or use Upload.'}</p></div>`;
    return;
  }
  const arrow = k => D.sort.k === k ? (D.sort.dir > 0 ? ' ↑' : ' ↓') : '';
  const selItems = items.filter(i => D.sel.has(i.path));
  const selSize = selItems.reduce((a, i) => a + Math.max(0, i.size), 0);
  const rows = items.map(it => {
    const [icon, color] = fileKind(it);
    const parent = it.path.includes('/') ? it.path.slice(0, it.path.lastIndexOf('/')) : '';
    return `<tr class="${D.sel.has(it.path) ? 'sel' : ''}" data-path="${esc(it.path)}">
      <td style="width:34px"><input type="checkbox" data-act="sel" data-path="${esc(it.path)}" ${D.sel.has(it.path) ? 'checked' : ''}></td>
      <td class="name"><div class="nm"><span class="ftype" style="background:${color}22;color:${color}">${ic(icon)}</span>
        <div style="min-width:0">${it.dir ? `<a href="#" data-act="cd" data-path="${esc(it.path)}" class="ellipsis" style="display:block">${esc(it.name)}</a>`
          : `<span class="ellipsis" style="display:block">${esc(it.name)}</span>`}
        ${D.mode === 'large' ? `<a href="#" class="muted small" data-act="cd" data-path="${esc(parent)}">My Drive/${esc(parent)}</a>` : ''}</div></div></td>
      <td class="num hide-sm muted">${modDate(it.mod)}</td>
      <td class="num">${it.dir ? `<a href="#" class="small" data-act="dirsize" data-path="${esc(it.path)}">size?</a>` : bytes(it.size)}</td>
      <td style="width:170px"><div class="row-actions">
        <button class="btn ghost icon" title="Download" data-act="dl" data-path="${esc(it.path)}">${ic('download')}</button>
        <button class="btn ghost icon" title="Rename" data-act="rename" data-path="${esc(it.path)}">${ic('edit')}</button>
        ${it.id ? `<button class="btn ghost icon" title="Open in Google Drive" data-act="gopen" data-path="${esc(it.path)}">${ic('open')}</button>` : ''}
        <button class="btn ghost icon" title="Move to trash" data-act="del" data-path="${esc(it.path)}">${ic('delete')}</button></div></td></tr>`;
  }).join('');
  const total = items.reduce((a, i) => a + Math.max(0, i.size), 0);
  el.innerHTML = `
    ${D.sel.size ? `<div class="selbar">${D.sel.size} selected · ${bytes(selSize)}<span class="grow"></span>
      <button class="btn ghost" data-act="dl-sel">${ic('download')}Download</button>
      <button class="btn ghost" data-act="del-sel" style="color:var(--err)">${ic('delete')}Move to trash</button>
      <button class="btn ghost icon" data-act="sel-clear" title="Clear selection">${ic('close')}</button></div>` : ''}
    <div class="card" style="padding:4px 8px"><table class="files"><thead><tr>
      <th><input type="checkbox" data-act="sel-all" ${selItems.length === items.length ? 'checked' : ''}></th>
      <th data-sort="name">Name${arrow('name')}</th><th data-sort="mod" class="num hide-sm">Modified${arrow('mod')}</th>
      <th data-sort="size" class="num">Size${arrow('size')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted small">${items.length} item${items.length === 1 ? '' : 's'} · ${bytes(total)} in files${D.mode === 'large' ? ` · scanned ${D.scanned.toLocaleString()} files` : ''}. Deleted items go to Google Drive’s trash for 30 days.</p>`;
  $$('th[data-sort]', el).forEach(th => th.onclick = () => {
    const k = th.dataset.sort;
    D.sort = { k, dir: D.sort.k === k ? -D.sort.dir : (k === 'name' ? 1 : -1) };
    renderDriveTable();
  });
}

const itemByPath = p => D.items.find(i => i.path === p);

async function deleteItems(items) {
  if (!items.length) return;
  const size = items.reduce((a, i) => a + Math.max(0, i.size), 0);
  const names = items.slice(0, 5).map(i => `<li>${esc(i.name)}${i.dir ? ' (folder and everything inside)' : ''}</li>`).join('');
  const ok = await confirmBox(`Move ${items.length} item${items.length > 1 ? 's' : ''} to trash?`,
    `<ul>${names}${items.length > 5 ? `<li>…and ${items.length - 5} more</li>` : ''}</ul>
     <p class="muted">${size ? bytes(size) + ' · ' : ''}You can restore them from Google Drive’s trash for 30 days. Empty the trash to free the space.</p>`,
    'Move to trash', true);
  if (!ok) return;
  toast('Moving to trash…');
  try {
    const r = await api('delete', { items: items.map(i => ({ path: i.path, dir: i.dir })) });
    if (r.errors.length) toast(r.errors[0], true); else toast(`${r.deleted} item${r.deleted > 1 ? 's' : ''} moved to trash`);
  } catch (e) { toast(e.message, true); }
  D.sel.clear(); aboutAt = 0;
  if (D.mode === 'large') { D.items = D.items.filter(i => !items.includes(i)); renderDriveTable(); } else driveLoad(D.path, true);
}

async function downloadItems(items) {
  try {
    await api('download', { items: items.map(i => ({ path: i.path, dir: i.dir })) });
    toast(`Downloading ${items.length} item${items.length > 1 ? 's' : ''} to ~/Downloads/DriveDock`);
    refresh();
  } catch (e) { toast(e.message, true); }
}

function uploadFiles(files) {
  const dir = D.path;
  for (const file of files) {
    const u = { name: file.name, loaded: 0, total: file.size, done: false };
    uploads.push(u);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/upload?path=${enc(dir)}&name=${enc(file.name)}`);
    xhr.setRequestHeader('X-DriveDock-Token', TOKEN);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = e => { u.loaded = e.loaded; renderTasks(); };
    xhr.onloadend = () => {
      u.done = true; uploads.splice(uploads.indexOf(u), 1);
      if (xhr.status !== 200) { let m = 'Upload failed'; try { m = JSON.parse(xhr.responseText).error; } catch {} toast(`${file.name}: ${m}`, true); }
      refresh();
    };
    xhr.send(file);
  }
  renderTasks();
}

/* drag & drop onto My Drive */
let dragDepth = 0;
window.addEventListener('dragenter', e => {
  if (view !== 'drive' || !e.dataTransfer.types.includes('Files')) return;
  dragDepth++;
  if (!$('.drop-hint')) { const h = document.createElement('div'); h.className = 'drop-hint'; h.textContent = `Drop to upload to My Drive/${D.path}`; document.body.append(h); }
});
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('.drop-hint')?.remove(); } });
window.addEventListener('dragover', e => { if (view === 'drive') e.preventDefault(); });
window.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0; $('.drop-hint')?.remove();
  if (view === 'drive' && e.dataTransfer.files.length) uploadFiles([...e.dataTransfer.files]);
});

/* ---------- transfers panel ---------- */
function renderTasks() {
  let el = $('#tasks');
  if (!el) { el = document.createElement('div'); el.id = 'tasks'; el.className = 'tasks'; document.body.append(el); }
  const now = Date.now() / 1000;
  const tasks = (S?.tasks || []).filter(t => t.status === 'running' || now - (t.ended || now) < 8);
  if (!tasks.length && !uploads.length) { el.innerHTML = ''; return; }
  const rows = uploads.map(u => `<div class="task"><div class="ellipsis"><b>Sending</b> ${esc(u.name)}</div>
      <div class="bar thin" style="margin-top:6px"><div style="width:${u.total ? (u.loaded / u.total) * 100 : 0}%"></div></div></div>`)
    .concat(tasks.map(t => {
      const p = t.progress || {};
      const pct = t.status === 'success' ? 100 : p.totalBytes ? (p.bytes / p.totalBytes) * 100 : 0;
      const label = { upload: 'Uploading', download: 'Downloading', restore: 'Restoring' }[t.kind] || t.kind;
      return `<div class="task"><div style="display:flex;gap:8px;align-items:center">
        ${t.status === 'running' ? '<span class="spinner" style="width:12px;height:12px;border-width:2px"></span>' : statusIcon(t.status)}
        <div class="ellipsis" style="flex:1"><b>${label}</b> ${esc(t.label)}</div><span class="muted small">${t.status === 'running' ? bytes(p.speed || 0) + '/s' : ''}</span></div>
        <div class="bar thin" style="margin-top:6px"><div style="width:${pct}%"></div></div></div>`;
    })).join('');
  el.innerHTML = `<div class="card">${rows}</div>`;
}

/* ---------- activity ---------- */
function renderActivity() {
  const rows = S.history.map(h => {
    const open = expanded.has(h.id);
    const detail = open ? `<div class="hdetail">${h.note ? `<p class="muted">${esc(h.note)}</p>` : ''}${h.folders.map(f => `<div class="list-row">${statusIcon(f.status)}
        <div style="flex:1;min-width:0"><b>${esc(f.name)}</b>${f.error ? `<div class="small" style="color:var(--err)">${esc(f.error)}</div>` : ''}</div>
        <span class="muted small">${f.files} files · ${bytes(f.bytes)}${f.deletes ? ` · ${f.deletes} removed` : ''}</span></div>`).join('')}</div>` : '';
    return `<div class="hrow" data-act="hist" data-id="${h.id}">${statusIcon(h.status)}
      <div><b>${esc(h.reason)}</b><div class="muted small">${when(h.started)}</div></div>
      <div class="muted small hide-sm ellipsis">${esc(h.folders.map(f => f.name).join(', '))}</div>
      <div class="small hide-sm">${h.files} files</div><div class="small">${bytes(h.bytes)}</div>
      <div class="muted small hide-sm">${dur(h.ended - h.started)}</div>${ic(open ? 'expand' : 'chevron')}</div>${detail}`;
  }).join('');
  const tasks = S.tasks.map(t => `<div class="list-row">${t.status === 'running' ? '<span class="spinner"></span>' : statusIcon(t.status)}
      <div style="flex:1;min-width:0"><b>${esc(t.kind[0].toUpperCase() + t.kind.slice(1))}</b> <span class="ellipsis">${esc(t.label)}</span>
      ${t.error ? `<div class="small" style="color:var(--err)">${esc(t.error)}</div>` : ''}</div>
      <span class="muted small">${ago(t.started)}</span></div>`).join('');
  $('#view-activity').innerHTML = `
    <div class="view-head"><h1>Activity</h1><button class="btn" data-act="show-log">${ic('log')}View log</button></div>
    <div class="card hist">${rows || `<div class="empty">${ic('history')}<h2>No backups yet</h2><p>Your backup history will show up here.</p></div>`}</div>
    ${tasks ? `<div class="card" style="margin-top:16px"><h3>${ic('download')}Uploads, downloads &amp; restores</h3>${tasks}</div>` : ''}`;
}

async function showLog() {
  const close = openModal(`<header>DriveDock log</header><div class="mbody"><div class="logbox mono" id="logBox"><span class="spinner"></span></div></div>
    <footer><button class="btn" data-close>Close</button></footer>`);
  try {
    const r = await api('log');
    $('#logBox').textContent = r.lines.join('\n') || 'Log is empty.';
    $('#logBox').scrollTop = 1e9;
  } catch (e) { toast(e.message, true); close(); }
}

/* ---------- settings ---------- */
function sw(key, on) { return `<label class="switch"><input type="checkbox" data-key="${key}" ${on ? 'checked' : ''}><i></i></label>`; }
function row(title, desc, ctl) { return `<div class="set-row"><div class="txt"><b>${title}</b><span>${desc}</span></div><div class="ctl" style="display:flex;justify-content:flex-end">${ctl}</div></div>`; }

function renderSettings() {
  settingsRendered = true;
  const c = S.config, n = S.net || {};
  let theme = 'system';
  try { theme = localStorage.getItem('dd-theme') || 'system'; } catch {}
  const opt = (v, cur, label) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  $('#view-settings').innerHTML = `
    <div class="view-head"><h1>Settings</h1></div>
    <div class="grid">
    <div class="card"><h3>${ic('schedule')}Automatic backup</h3>
      ${row('Automatic backups', 'Back up your selected folders without you doing anything.', sw('auto_enabled', c.auto_enabled))}
      ${row('Back up when I connect to Wi-Fi', 'Starts a backup each time the laptop joins an allowed network.', sw('backup_on_connect', c.backup_on_connect))}
      ${row('Also back up every', 'While connected, repeat on this schedule to catch new changes.',
        `<select data-key="interval_hours">${[[0, 'Never'], [1, '1 hour'], [2, '2 hours'], [3, '3 hours'], [6, '6 hours'], [12, '12 hours'], [24, '24 hours']].map(([v, l]) => opt(v, c.interval_hours, l)).join('')}</select>`)}
      ${row('Pause all backups', 'Temporarily stop automatic backups. You can still back up manually.', sw('paused', c.paused))}
    </div>
    <div class="card"><h3>${ic('wifi')}Network &amp; battery</h3>
      ${row('Only on Wi-Fi or Ethernet', 'Never back up over mobile broadband.', sw('wifi_only', c.wifi_only))}
      ${row('Skip metered connections', 'Don’t use phone hotspots or networks marked as metered, which saves your mobile data.', sw('skip_metered', c.skip_metered))}
      <div class="set-row" style="flex-wrap:wrap"><div class="txt"><b>Trusted Wi-Fi networks only</b>
        <span>Leave empty to allow any Wi-Fi. Otherwise only these network names are used, one per line.${n.ssid ? ` You’re on <b>${esc(n.ssid)}</b>.` : ''}</span></div>
        <div style="width:100%;display:flex;gap:8px;align-items:flex-start"><textarea data-key="trusted_ssids" data-list="1" style="min-height:64px" placeholder="Home WiFi&#10;Office">${esc(c.trusted_ssids.join('\n'))}</textarea>
        ${n.ssid ? `<button class="btn" data-act="trust-current">${ic('add')}Add current</button>` : ''}</div></div>
      ${row('Minimum battery', 'When unplugged, wait until the battery is above this level.', `<select data-key="min_battery">${[0, 10, 20, 30, 50, 80].map(v => opt(v, c.min_battery, v ? v + '%' : 'Any')).join('')}</select>`)}
    </div>
    <div class="card"><h3>${ic('cloud_upload')}Speed</h3>
      ${row('Upload speed limit', 'Keep some internet free for other things, for example 1M = 1 MB/s. Empty = unlimited.', `<input type="text" data-key="bwlimit" value="${esc(c.bwlimit)}" placeholder="Unlimited" style="width:130px">`)}
      ${row('Parallel uploads', 'More is faster on good connections. Google may slow down above 8.', `<select data-key="transfers">${[1, 2, 4, 6, 8, 12, 16].map(v => opt(v, c.transfers, v)).join('')}</select>`)}
    </div>
    <div class="card"><h3>${ic('cloud')}Where backups go</h3>
      ${row('Backup folder in My Drive', 'All backups are stored inside this folder. Changing it starts fresh backups in the new place.', `<input type="text" data-key="backup_root" value="${esc(c.backup_root)}" style="width:230px">`)}
      ${row('Keep old versions (Mirror mode)', 'When a mirrored file is changed or deleted, keep the previous copy in a .versions folder.', sw('keep_versions', c.keep_versions))}
      <div class="set-row" style="flex-wrap:wrap"><div class="txt"><b>Always skip</b><span>Patterns skipped in every folder, one per line. Examples: <span class="mono">*.iso</span>, <span class="mono">node_modules/**</span></span></div>
        <textarea data-key="global_excludes" data-list="1">${esc(c.global_excludes.join('\n'))}</textarea></div>
    </div>
    <div class="card"><h3>${ic('settings')}App</h3>
      ${row('Desktop notifications', 'Notify when backups finish or have problems.', sw('notifications', c.notifications))}
      ${row('Theme', 'Match your system or pick one.', `<select id="themeSel">${opt('system', theme, 'System')}${opt('light', theme, 'Light')}${opt('dark', theme, 'Dark')}</select>`)}
      ${row('Google Drive account', `Connected · engine rclone ${esc(S.rclone)}`, `<button class="btn danger" data-act="disconnect">Disconnect</button>`)}
      ${row('About', `DriveDock ${esc(S.version)} · restores go to <span class="mono">${esc(S.paths.restore)}</span>`, `<button class="btn" data-act="show-log">${ic('log')}Log</button>`)}
    </div></div>`;
  $('#themeSel').onchange = e => applyTheme(e.target.value);
  $$('[data-key]', $('#view-settings')).forEach(el => {
    el.addEventListener('change', async () => {
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.list) v = v.split('\n').map(s => s.trim()).filter(Boolean);
      else if (el.tagName === 'SELECT') v = Number(v);
      try { await api('config', { [el.dataset.key]: v }); toast('Saved'); await refresh(); }
      catch (e) { toast(e.message, true); settingsRendered = false; render(); }
    });
  });
}

/* ---------- actions ---------- */
async function refresh() { try { S = await api('state'); render(); } catch {} }
async function act(fn, okMsg) { try { await fn(); if (okMsg) toast(okMsg); refresh(); } catch (e) { toast(e.message, true); } }
const folderById = id => S.folders.find(f => f.id === id);

const ACTIONS = {
  'connect': () => act(() => api('connect', { client_id: $('#cid')?.value || '', client_secret: $('#csec')?.value || '' })),
  'connect-cancel': () => act(() => api('connect/cancel', {})),
  'disconnect': async () => {
    if (await confirmBox('Disconnect Google Drive?', '<p>DriveDock will stop backing up. Nothing on your Drive is deleted, and your folder list is kept for when you reconnect.</p>', 'Disconnect', true))
      act(() => api('disconnect', {}), 'Disconnected');
  },
  'backup-now': () => act(() => api('backup/start', {}), 'Backup started'),
  'backup-folder': d => act(() => api('backup/start', { folders: [d.id] }), 'Backup started'),
  'stop': () => act(() => api('backup/stop', {}), 'Stopping…'),
  'pause': () => act(() => api('config', { paused: true }), 'Automatic backups paused'),
  'resume': () => act(() => api('config', { paused: false }), 'Automatic backups resumed'),
  'add-folder': () => folderModal(null),
  'edit-folder': d => folderModal(folderById(d.id)),
  'toggle-folder': (d, el) => act(() => api('folders/update', { id: d.id, enabled: el.checked }), el.checked ? 'Included in automatic backups' : 'Excluded from automatic backups'),
  'remove-folder': async d => {
    const f = folderById(d.id);
    if (await confirmBox(`Stop backing up ${f.name}?`, `<p>DriveDock will stop backing up <span class="mono">${esc(f.path)}</span>.</p><p class="muted">Files already on Drive (My Drive/${esc(f.dest)}) are <b>not</b> deleted. You can remove them from My Drive if you want the space back.</p>`, 'Stop backing up', true))
      act(() => api('folders/remove', { id: d.id }), 'Folder removed');
  },
  'restore': async d => {
    const f = folderById(d.id);
    if (await confirmBox(`Restore ${f.name}?`, `<p>A copy of the backup will be downloaded to<br><span class="mono">${esc(S.paths.restore)}/${esc(f.name)}</span></p><p class="muted">Your original folder is not touched, so you can compare and copy back what you need.</p>`, 'Restore'))
      act(() => api('restore', { id: d.id }), 'Restore started');
  },
  'show-in-drive': d => { location.hash = 'drive'; driveLoad(folderById(d.id).dest); },
  'empty-trash': async () => {
    if (await confirmBox('Empty Google Drive trash?', `<p>Permanently deletes everything in your Drive trash${ABOUT?.trashed ? ` (${bytes(ABOUT.trashed)})` : ''}. This can’t be undone.</p>`, 'Empty trash', true))
      act(async () => { await api('emptytrash', {}); aboutAt = 0; loadAbout(); }, 'Trash emptied');
  },
  'cd': d => driveLoad(d.path),
  'refresh-drive': () => D.mode === 'large' ? driveLarge() : driveLoad(D.path),
  'large': () => D.mode === 'large' ? driveLoad(D.path) : driveLarge(),
  'upload': () => $('#dUpload').click(),
  'open-downloads': () => act(() => api('open', { path: 'downloads' })),
  'mkdir': async () => {
    const name = await promptBox('New folder', 'Folder name', 'Untitled folder');
    if (name) act(async () => { await api('mkdir', { path: (D.path ? D.path + '/' : '') + name }); driveLoad(D.path, true); }, 'Folder created');
  },
  'sel': (d, el) => { el.checked ? D.sel.add(d.path) : D.sel.delete(d.path); renderDriveTable(); },
  'sel-all': (d, el) => { (D.view || []).forEach(i => el.checked ? D.sel.add(i.path) : D.sel.delete(i.path)); renderDriveTable(); },
  'sel-clear': () => { D.sel.clear(); renderDriveTable(); },
  'del': d => deleteItems([itemByPath(d.path)]),
  'del-sel': () => deleteItems(D.items.filter(i => D.sel.has(i.path))),
  'dl': d => downloadItems([itemByPath(d.path)]),
  'dl-sel': () => downloadItems(D.items.filter(i => D.sel.has(i.path))),
  'gopen': d => {
    const it = itemByPath(d.path);
    window.open(it.dir ? `https://drive.google.com/drive/folders/${it.id}` : `https://drive.google.com/file/d/${it.id}/view`, '_blank');
  },
  'rename': async d => {
    const it = itemByPath(d.path);
    const name = await promptBox('Rename', 'New name', it.name);
    if (!name || name === it.name) return;
    const parent = it.path.includes('/') ? it.path.slice(0, it.path.lastIndexOf('/') + 1) : '';
    act(async () => { await api('rename', { from: it.path, to: parent + name, dir: it.dir }); D.mode === 'large' ? driveLarge() : driveLoad(D.path, true); }, 'Renamed');
  },
  'dirsize': async (d, el) => {
    el.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px"></span>';
    try { const r = await api('size?path=' + enc(d.path)); el.outerHTML = `<span title="${r.count} files">${bytes(r.bytes)}</span>`; }
    catch (e) { el.textContent = 'error'; toast(e.message, true); }
  },
  'hist': d => { expanded.has(d.id) ? expanded.delete(d.id) : expanded.add(d.id); renderActivity(); },
  'show-log': () => showLog(),
  'trust-current': async () => {
    const list = [...new Set([...S.config.trusted_ssids, S.net.ssid])];
    await act(() => api('config', { trusted_ssids: list }), `Added ${S.net.ssid}`);
    settingsRendered = false; render();
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el.dataset, el, e);
});

/* ---------- boot ---------- */
$$('[data-icon]').forEach(i => i.outerHTML = ic(i.dataset.icon));
showView();
poll().then(() => { showView(); loadAbout(); });
