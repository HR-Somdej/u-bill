/* SOMDEJ U-Bill — app.js : แกนกลาง (เรียกหลังบ้าน · ล็อกอิน · โครงหน้า · เส้นทาง · UI กลาง)
 * เลขรุ่นต้องตรงกับ Config.gs และ version.json */
var UB_BUILD = '2569-11-03.1';
var UB_API_BUILD = '2569-11-03.1';
var UB_VERSION = '1.2569';

var S = { token: null, boot: null, me: null, master: null, round: null, readings: {}, route: '' };
var KIND_TH = { W: 'ค่าน้ำ', E: 'ค่าไฟ' }, KIND_SHORT = { W: 'น้ำ', E: 'ไฟ' };
var MST_TH = { OCC: 'มีผู้พัก', DUTY: 'ห้องเวร', VACANT: 'ห้องว่าง', INTL: 'ห้องนานาชาติ', COMMON: 'ห้องส่วนกลาง' };
var RST_TH = { OPEN: 'กำลังจดมิเตอร์', SUBMITTED: 'ฝ่ายอาคารส่งแล้ว · รอ HR ตรวจ', LOCKED: 'HR ล็อกรอบแล้ว' };

/* =================================================================== ตัวช่วย */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function nf(n, d) { n = +n || 0; return n.toLocaleString('th-TH', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d }); }
function baht(n) { return nf(n, 2); }
function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }
function r2(x) { return Math.round((+x || 0) * 100 + 1e-9) / 100; }
function ceil2(x) { return Math.ceil(Math.round((+x || 0) * 1e6) / 1e4) / 100; }
var TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_MONF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
function thDate(iso, withTime) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return '-';
  var s = (+m[3]) + ' ' + TH_MON[+m[2] - 1] + ' ' + String(+m[1] + 543).slice(2);
  return withTime !== false && m[4] ? s + ' ' + m[4] + ':' + m[5] : s;
}
/** '2569-11' → 'พ.ย. 69' / full */
function rTh(id, full) { var m = String(id || '').match(/^(\d{4})-(\d{2})$/); if (!m) return id || '-'; return full ? TH_MONF[+m[2] - 1] + ' ' + m[1] : TH_MON[+m[2] - 1] + ' ' + m[1].slice(2); }
/** เดือนที่ใช้ (หน่วยใช้) ของรอบ */
function usageOf(id) { var m = String(id).match(/^(\d{4})-(\d{2})$/), y = +m[1], mo = +m[2] - 1; if (mo < 1) { mo = 12; y--; } return y + '-' + ('0' + mo).slice(-2); }
function today() { var d = new Date(), z = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
function nowStamp() { var d = new Date(), z = function (n) { return ('0' + n).slice(-2); }; return (d.getFullYear() + 543) + z(d.getMonth() + 1) + z(d.getDate()) + '-' + z(d.getHours()) + z(d.getMinutes()); }
function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
function hasRole(r) { return S.me && S.me.roles.indexOf(r) >= 0; }
function isHR() { return hasRole('HR'); }
function isBLD() { return hasRole('BLD'); }
function canEdit() { return isHR() || isBLD(); }
function onlyTech() { return S.me && S.me.roles.length === 1 && S.me.roles[0] === 'TECH'; }
function onlyExec() { return S.me && !isHR() && !isBLD() && !hasRole('TECH') && hasRole('EXEC'); }
function bldOf(id) { var b = (S.boot && S.boot.buildings || []).filter(function (x) { return x.id === id; })[0]; return b || { id: id, name: id, short: id }; }
function sortNat(a, b) { return String(a).localeCompare(String(b), 'th', { numeric: true }); }

/* =================================================================== ไอคอน */
var ICONS = {
  drop: '<path d="M12 2.7s6.5 7.1 6.5 11.8A6.5 6.5 0 0 1 5.5 14.5C5.5 9.8 12 2.7 12 2.7Z"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M15 3.3A9 9 0 0 1 20.7 9H15z"/>',
  gauge: '<path d="M4.9 19A9 9 0 1 1 19 19"/><path d="m12 13 4-5"/><circle cx="12" cy="13" r="1.5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 2 5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.7"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  zip: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M10 6h1M10 9h1M10 12h1M10 15h2v3h-2z"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 12H8M12 8l-4 4 4 4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M15 8l2 2"/>',
  printer: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M16 3v3M8 3v3M3 10h18"/>',
  arrowr: '<path d="M5 12h14M13 6l6 6-6 6"/>', arrowl: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  ub: '<path d="M12 2.7s5 5.5 5 9.3a5 5 0 0 1-10 0c0-3.8 5-9.3 5-9.3Z"/><path d="m12.6 9-2.2 3.4h2.4L11.4 16"/>'
};
function ic(name, cls) { return '<svg class="i ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
function kindIc(k) { return k === 'W' ? ic('drop', 'w-ic') : ic('bolt', 'e-ic'); }

/* =================================================================== เครือข่าย (ไม่มี preflight · จำกัด 4 คำขอ · อ่านลองซ้ำ) */
var NET = { active: 0, queue: [], MAX: 4 };
function netSlot() { return new Promise(function (res) { if (NET.active < NET.MAX) { NET.active++; res(); } else NET.queue.push(res); }); }
function netDone() { var n = NET.queue.shift(); if (n) n(); else NET.active = Math.max(0, NET.active - 1); }
function isRead(a) { return /^(get|list|bootstrap|branding|ping|lookup)/.test(a); }
function fetchOnce(action, payload) {
  if (window.UB_MOCK) return window.UB_MOCK(action, S.token, payload || {});
  if (!window.API_URL || /ใส่ลิงก์/.test(window.API_URL)) return Promise.reject(new Error('ยังไม่ได้ตั้งค่า API_URL ในไฟล์ config.js'));
  return fetch(window.API_URL, { method: 'POST', redirect: 'follow', credentials: 'omit', cache: 'no-store', body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }) })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      if (String(t).trim().charAt(0) === '<') { var e = new Error('เซิร์ฟเวอร์ Google ไม่ว่างชั่วคราว กรุณาลองใหม่'); e.busy = true; throw e; }
      return JSON.parse(t);
    }, function () { var e = new Error('เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต'); e.net = true; throw e; });
}
function api(action, payload) {
  var waits = [700, 1600, 3200], tries = 0, read = isRead(action);
  var attempt = function () {
    return netSlot().then(function () { return fetchOnce(action, payload); })
      .then(function (x) { netDone(); return x; }, function (e) {
        netDone();
        if (read && tries < waits.length && (e.busy || e.net)) { var w = waits[tries++]; return new Promise(function (r) { setTimeout(r, w); }).then(attempt); }
        throw e;
      });
  };
  return attempt().then(function (res) {
    if (!res.ok) {
      if (res.error === 'SESSION_EXPIRED') { logout(true); throw new Error('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'); }
      throw new Error(res.error || 'เกิดข้อผิดพลาด');
    }
    return res.data;
  });
}

/* =================================================================== UI กลาง */
function toast(msg, type, ms) {
  var box = $('#toasts'), el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.innerHTML = ic(type === 'err' ? 'alert' : type === 'ok' ? 'check' : 'info') + '<div>' + esc(msg) + '</div>';
  box.appendChild(el);
  setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 320); }, ms || (type === 'err' ? 6000 : 3200));
}
function errToast(e) { toast(e && e.message ? e.message : String(e), 'err'); }
/** popup · opts: {title, body(html), wide, buttons:[{label, cls, onClick(close) → false = ไม่ปิด}], onOpen(el)} */
function modal(opts) {
  var bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog"><div class="mh"><h3>' + (opts.title || '') + '</h3><button class="btn ghost icon sm" data-x>' + ic('x') + '</button></div><div class="mb">' + (opts.body || '') + '</div>' +
    (opts.buttons && opts.buttons.length ? '<div class="mf"></div>' : '') + '</div>';
  document.body.appendChild(bg);
  var close = function () { bg.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
  var onKey = function (e) { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('[data-x]', bg).onclick = close;
  bg.addEventListener('mousedown', function (e) { if (e.target === bg && !opts.sticky) close(); });
  var mf = $('.mf', bg);
  (opts.buttons || []).forEach(function (b) {
    var btn = document.createElement('button');
    btn.className = 'btn ' + (b.cls || ''); btn.innerHTML = b.label;
    btn.onclick = function () {
      var r = b.onClick ? b.onClick(close, bg, btn) : null;
      if (r && r.then) { btn.disabled = true; r.then(function (v) { btn.disabled = false; if (v !== false) close(); }, function (e) { btn.disabled = false; errToast(e); }); }
      else if (r !== false) close();
    };
    mf.appendChild(btn);
  });
  if (opts.onOpen) opts.onOpen(bg, close);
  var f = $('input:not([type=checkbox]),select,textarea', bg); if (f && !opts.noFocus) setTimeout(function () { f.focus(); }, 60);
  return { el: bg, close: close };
}
function confirmBox(title, body, okLabel, cls) {
  return new Promise(function (res) {
    modal({ title: title, body: '<div>' + body + '</div>', buttons: [{ label: 'ยกเลิก', onClick: function () { res(false); } }, { label: okLabel || 'ยืนยัน', cls: cls || 'primary', onClick: function () { res(true); } }], onClose: function () { res(false); } });
  });
}
function promptBox(title, label, opts) {
  opts = opts || {};
  return new Promise(function (res) {
    var done = false;
    modal({ title: title, body: (opts.html || '') + '<label class="f">' + label + '</label><textarea class="inp" id="pb-in" placeholder="' + esc(opts.placeholder || '') + '">' + esc(opts.value || '') + '</textarea>',
      buttons: [{ label: 'ยกเลิก' }, { label: opts.ok || 'ยืนยัน', cls: opts.cls || 'primary', onClick: function () { var v = $('#pb-in').value.trim(); if (opts.required !== false && !v) { toast('กรุณากรอก' + label, 'warn'); return false; } done = true; res(v); } }],
      onClose: function () { if (!done) res(null); } });
  });
}
function loadingHtml(t) { return '<div class="loading"><span class="spin"></span>' + esc(t || 'กำลังโหลด…') + '</div>'; }
function emptyHtml(t, icon) { return '<div class="empty">' + ic(icon || 'info') + '<div>' + esc(t) + '</div></div>'; }
function busy(btn, on, label) { if (!btn) return; if (on) { btn._h = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin" style="width:16px;height:16px;border-width:2px"></span>' + (label ? ' ' + label : ''); } else { btn.disabled = false; if (btn._h) btn.innerHTML = btn._h; } }

/* =================================================================== ล็อกอิน */
function saveSession() { try { localStorage.setItem('ub_token', S.token || ''); } catch (e) { } }
function logout(silent) {
  if (!silent && S.token) api('logout').catch(function () { });
  S.token = null; S.boot = null; S.me = null; S.master = null; S.round = null; S.readings = {};
  try { localStorage.removeItem('ub_token'); } catch (e) { }
  renderLogin();
}
function afterLogin(data) {
  S.token = data.token; saveSession();
  applyBoot(data.boot);
  location.hash = location.hash && location.hash.length > 2 ? location.hash : '#/' + homeRoute();
  route();
}
function applyBoot(b) { S.boot = b; S.me = b.me; S.round = b.round; }
function homeRoute() { if (onlyTech()) return 'read'; if (onlyExec()) return 'dash'; return 'round'; }

function renderLogin(mode, extra) {
  mode = mode || 'pw';
  var app = $('#app');
  var b = (S.brand || {});
  app.innerHTML = '<div class="login"><div class="art"><div class="org"><img src="logo.jpg" alt=""><div>' + esc(b.deptName || 'ฝ่ายทรัพยากรบุคคล') + '<br>' + esc(b.orgName || 'โรงพยาบาลสมเด็จพระบรมราชเทวี ณ ศรีราชา') + '</div></div>' +
    '<div><div class="row" style="gap:12px"><div class="brand" style="padding:0"><div class="logo">' + ic('ub') + '</div></div><span class="tag" style="background:rgba(255,255,255,.14);color:#fff">SOMDEJ U-Bill</span></div>' +
    '<h1>ค่าน้ำ–ค่าไฟที่พัก<br><em>จดครั้งเดียว ถึง HRMi</em></h1><p>ระบบจดมิเตอร์ คำนวณ และส่งรายการหักเงินเดือนค่าสาธารณูปโภคที่พักบุคลากร — ฝ่ายอาคารจดและส่ง · HR ตรวจ ล็อก และส่งออกไฟล์ Import HRMi</p></div>' +
    '<div class="feats"><div>' + ic('drop') + '<b>จดผ่านมือถือ</b>เดินจดหน้าห้อง หรือกรอกจากสมุด</div><div>' + ic('shield') + '<b>ตรวจกับ HR</b>ชื่อ–สถานะบุคลากรจาก SmartAPI</div><div>' + ic('chart') + '<b>แดชบอร์ด</b>สรุปผู้บริหาร รายเดือน–ปีงบ</div></div></div>' +
    '<div class="form"><div class="box" id="lbox"></div></div></div>';
  var box = $('#lbox');
  if (mode === 'pw') {
    box.innerHTML = '<h2>เข้าสู่ระบบ</h2><p class="muted">สำหรับผู้ดูแล HR · ฝ่ายอาคาร · หน่วยช่าง · ผู้บริหาร</p>' +
      '<div class="card mt16"><div class="field"><label class="f">รหัสพนักงาน</label><input class="inp" id="l-emp" inputmode="numeric" autocomplete="username" placeholder="เลข 7 หลัก"></div>' +
      '<div class="field"><label class="f">รหัสผ่าน</label><input class="inp" id="l-pw" type="password" autocomplete="current-password"></div>' +
      '<button class="btn primary block lg" id="l-go">' + ic('login') + ' เข้าสู่ระบบ</button>' +
      '<div class="row between mt12 small"><a href="#" id="l-first">เข้าครั้งแรก (เลขบัตรประชาชน)</a><a href="#" id="l-forgot">ลืมรหัสผ่าน</a></div></div>' +
      '<p class="tiny muted mt12">' + ic('info') + ' ผู้ใช้ต้องได้รับสิทธิ์จาก HR ก่อน · ติดต่อ ' + esc(b.supportPhone || '23400 - 23419') + ' · รุ่น ' + UB_BUILD + '</p><div id="l-api" class="tiny muted"></div>';
    var go = function () {
      var btn = $('#l-go'); busy(btn, true, 'กำลังตรวจสอบ');
      api('login', { empCode: $('#l-emp').value.trim(), password: $('#l-pw').value })
        .then(function (d) { if (d.setup) return renderSetup(d.setup, d.reason); afterLogin(d); })
        .catch(function (e) { busy(btn, false); errToast(e); });
    };
    $('#l-go').onclick = go;
    $('#l-pw').onkeydown = function (e) { if (e.key === 'Enter') go(); };
    $('#l-emp').onkeydown = function (e) { if (e.key === 'Enter') $('#l-pw').focus(); };
    $('#l-first').onclick = function (e) { e.preventDefault(); renderLogin('cid'); };
    $('#l-forgot').onclick = function (e) { e.preventDefault(); renderLogin('forgot'); };
    api('ping').then(function (p) { $('#l-api').innerHTML = '<span class="dot ok"></span> เชื่อมต่อระบบแล้ว (หลังบ้าน ' + esc(p.build) + ')'; }).catch(function (e) { $('#l-api').innerHTML = '<span class="dot danger"></span> ' + esc(e.message); });
  } else if (mode === 'cid' || mode === 'forgot') {
    var fg = mode === 'forgot';
    box.innerHTML = '<h2>' + (fg ? 'ลืมรหัสผ่าน' : 'เข้าครั้งแรก') + '</h2><p class="muted">' + (fg ? 'ยืนยันตัวตนด้วยเลขบัตรประชาชน ระบบจะส่งรหัสยืนยัน 6 หลักไปอีเมลของท่าน' : 'ยืนยันตัวตนกับระบบข้อมูลบุคลากรของโรงพยาบาล แล้วตั้งรหัสผ่านของตนเอง') + '</p>' +
      '<div class="card mt16"><div class="field"><label class="f">รหัสพนักงาน</label><input class="inp" id="l-emp" inputmode="numeric" placeholder="เลข 7 หลัก"></div>' +
      '<div class="field"><label class="f">เลขบัตรประชาชน 13 หลัก</label><input class="inp" id="l-cid" inputmode="numeric" autocomplete="off" maxlength="17"></div>' +
      '<button class="btn primary block lg" id="l-go">' + ic('shield') + ' ' + (fg ? 'ส่งรหัสยืนยัน' : 'ยืนยันตัวตน') + '</button>' +
      '<p class="tiny muted mt8">ระบบไม่บันทึกเลขบัตรประชาชน ใช้ตรวจกับระบบบุคลากรเท่านั้น</p><a href="#" id="l-back" class="small">' + ic('arrowl') + ' กลับ</a></div>';
    $('#l-back').onclick = function (e) { e.preventDefault(); renderLogin('pw'); };
    $('#l-go').onclick = function () {
      var btn = $('#l-go'), emp = $('#l-emp').value.trim(); busy(btn, true, 'กำลังตรวจสอบ');
      api(fg ? 'forgotStart' : 'login', { empCode: emp, cid: $('#l-cid').value })
        .then(function (d) {
          if (fg) {
            if (d.noEmail) { busy(btn, false); modal({ title: 'ไม่พบอีเมลในระบบบุคลากร', body: '<p>กรุณาติดต่อ HR โทร ' + esc(d.phone) + ' เพื่อออกรหัสผ่านชั่วคราว</p>', buttons: [{ label: 'ตกลง', cls: 'primary' }] }); return; }
            return renderLogin('otp', { emp: emp, to: d.to, minutes: d.minutes });
          }
          if (d.setup) return renderSetup(d.setup, d.reason);
          afterLogin(d);
        }).catch(function (e) { busy(btn, false); errToast(e); });
    };
  } else if (mode === 'otp') {
    box.innerHTML = '<h2>กรอกรหัสยืนยัน</h2><p class="muted">ส่งไปที่ ' + esc(extra.to) + ' (ใช้ได้ ' + extra.minutes + ' นาที)</p><div class="card mt16"><input class="inp bigin" id="l-otp" inputmode="numeric" maxlength="6" placeholder="••••••"><button class="btn primary block lg mt12" id="l-go">ยืนยัน</button></div>';
    $('#l-go').onclick = function () {
      var btn = $('#l-go'); busy(btn, true);
      api('forgotVerify', { empCode: extra.emp, otp: $('#l-otp').value }).then(function (d) { renderSetup(d.setup, 'FORGOT'); }).catch(function (e) { busy(btn, false); errToast(e); });
    };
  }
}
function renderSetup(setupToken, reason) {
  var box = $('#lbox');
  box.innerHTML = '<h2>ตั้งรหัสผ่าน</h2><p class="muted">' + (reason === 'TEMP' ? 'รหัสผ่านชั่วคราวจาก HR — กรุณาตั้งรหัสผ่านใหม่ของท่าน' : 'ตั้งรหัสผ่านสำหรับเข้าระบบครั้งต่อไป (อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข)') + '</p>' +
    '<div class="card mt16"><div class="field"><label class="f">รหัสผ่านใหม่</label><input class="inp" id="s-pw" type="password" autocomplete="new-password"></div>' +
    '<div class="field"><label class="f">ยืนยันรหัสผ่าน</label><input class="inp" id="s-pw2" type="password" autocomplete="new-password"></div>' +
    '<button class="btn primary block lg" id="s-go">' + ic('key') + ' บันทึกและเข้าสู่ระบบ</button></div>';
  $('#s-go').onclick = function () {
    var a = $('#s-pw').value, b2 = $('#s-pw2').value;
    if (a !== b2) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'warn');
    var btn = $('#s-go'); busy(btn, true);
    api('completeSetup', { setup: setupToken, password: a }).then(function (d) { toast('ตั้งรหัสผ่านเรียบร้อย', 'ok'); afterLogin(d); }).catch(function (e) { busy(btn, false); errToast(e); });
  };
}

/* =================================================================== โครงหน้า + เมนู */
function navItems() {
  var L = [];
  if (canEdit()) L.push({ sec: 'งานประจำรอบ' }, { r: 'round', t: 'รอบหักเงิน', i: 'calendar' });
  if (canEdit() || hasRole('TECH')) L.push({ r: 'read', t: 'เดินจดมิเตอร์', i: 'gauge', m: 'จดมิเตอร์' });
  if (canEdit()) L.push({ r: 'desk', t: 'กรอกจากสมุด / นำเข้า', i: 'table', m: 'กรอก' }, { r: 'review', t: 'ตรวจสอบ & ส่งออก', i: 'shield', m: 'ตรวจ' });
  if (canEdit()) L.push({ sec: 'ทะเบียน' }, { r: 'master', t: 'ห้อง · มิเตอร์ · ผู้พัก', i: 'building', m: 'ทะเบียน' });
  if (canEdit() || hasRole('EXEC')) L.push({ sec: 'สรุปผล' }, { r: 'dash', t: 'แดชบอร์ด', i: 'chart', m: 'แดชบอร์ด' });
  if (canEdit()) L.push({ sec: 'ระบบ' });
  if (canEdit()) L.push({ r: 'users', t: isHR() ? 'ผู้ใช้งาน' : 'ผู้ใช้ (หน่วยช่าง)', i: 'users' });
  if (canEdit()) L.push({ r: 'settings', t: 'ตั้งค่า · อัตรา', i: 'settings' });
  if (isHR()) L.push({ r: 'audit', t: 'ประวัติการใช้งาน', i: 'history' });
  return L;
}
function shell(title, sub, actions) {
  var app = $('#app'), r = S.route;
  if (!$('.shell', app)) {
    app.innerHTML = '<div class="shell"><aside class="side"><div class="brand"><div class="logo">' + ic('ub') + '</div><div><b>U-Bill</b><span>ค่าน้ำ–ค่าไฟที่พักบุคลากร<br>รพ.สมเด็จฯ ณ ศรีราชา</span></div></div><nav class="nav" id="nav"></nav>' +
      '<div class="me"><b>' + esc(S.me.name || S.me.empCode) + '</b>' + esc(S.me.rolesTh.join(' · ')) + '<div class="row"><button class="btn" id="b-pw">' + ic('key') + ' รหัสผ่าน</button><button class="btn" id="b-out">' + ic('logout') + ' ออก</button></div></div></aside>' +
      '<main class="main"><div class="mobile-top"><div class="logo">' + ic('ub') + '</div><b>U-Bill</b><button class="btn" id="m-out">' + ic('logout') + '</button></div><div id="topbar" class="topbar"></div><div id="page"></div></main></div><nav class="bottomnav" id="bnav"></nav>';
    $('#b-out').onclick = function () { logout(); };
    $('#m-out').onclick = function () { confirmBox('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่', 'ออกจากระบบ').then(function (y) { if (y) logout(); }); };
    $('#b-pw').onclick = changePwDialog;
  }
  var items = navItems();
  $('#nav').innerHTML = items.map(function (x) { return x.sec ? '<div class="sec">' + x.sec + '</div>' : '<a href="#/' + x.r + '" class="' + (r === x.r ? 'on' : '') + '">' + ic(x.i) + '<span>' + x.t + '</span></a>'; }).join('');
  var mob = items.filter(function (x) { return x.r && (x.m || x.r === 'round'); }).slice(0, 5);
  $('#bnav').innerHTML = mob.map(function (x) { return '<a href="#/' + x.r + '" class="' + (r === x.r ? 'on' : '') + '">' + ic(x.i) + '<span>' + (x.m || 'รอบ') + '</span></a>'; }).join('');
  $('#bnav').style.display = mob.length > 1 ? '' : 'none';
  $('#topbar').innerHTML = '<div class="grow"><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="row noprint">' + (actions || '') + '</div>';
  return $('#page');
}
function changePwDialog() {
  modal({ title: 'เปลี่ยนรหัสผ่าน', body: '<div class="field"><label class="f">รหัสผ่านปัจจุบัน</label><input class="inp" type="password" id="c-cur"></div><div class="field"><label class="f">รหัสผ่านใหม่</label><input class="inp" type="password" id="c-new"></div><div class="field"><label class="f">ยืนยันรหัสผ่านใหม่</label><input class="inp" type="password" id="c-new2"></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      if ($('#c-new').value !== $('#c-new2').value) { toast('รหัสผ่านใหม่ไม่ตรงกัน', 'warn'); return false; }
      return api('changePassword', { current: $('#c-cur').value, next: $('#c-new').value }).then(function (d) { S.token = d.token; saveSession(); toast('เปลี่ยนรหัสผ่านแล้ว (ออกจากระบบเครื่องอื่นทั้งหมด)', 'ok'); });
    } }] });
}

/* =================================================================== ข้อมูลกลาง (ทะเบียน + รอบ) */
function loadMaster(force) {
  if (S.master && !force) return Promise.resolve(S.master);
  return api('getMaster').then(function (m) { setMaster(m); return m; });
}
function setMaster(m) {
  S.master = m;
  m.byId = {}; m.meters.forEach(function (x) { m.byId[x.id] = x; x.payers = []; });
  var td = today();
  m.assigns.forEach(function (a) { var x = m.byId[a.meterId]; if (x) x.payers.push(a); });
  m.meters.forEach(function (x) { x.payers.sort(function (a, b) { return a.startDate < b.startDate ? -1 : 1; }); x.curPayers = x.payers.filter(function (a) { return !a.endDate || a.endDate >= td; }); });
  m.meters.sort(function (a, b) { return (bldOf(a.bld).sort || 99) - (bldOf(b.bld).sort || 99) || a.sort - b.sort; });
  if (m.buildings) S.boot.buildings = m.buildings;
}
function loadRound(id, force) {
  if (!force && S.roundData && S.roundData.round && (!id || S.roundData.round.id === id)) return Promise.resolve(S.roundData);
  return api('getRound', { id: id || '' }).then(function (d) { S.roundData = d; if (d.round && (!id || id === (S.round || {}).id)) S.round = d.round; return d; });
}
/** ผู้จ่ายของมิเตอร์ในช่วงหน่วยใช้ของรอบ */
function payersInRound(m, rd) {
  if (!rd) return m.curPayers;
  return m.payers.filter(function (a) { return a.startDate <= rd.usageTo && (!a.endDate || a.endDate >= rd.usageFrom); });
}
/** คำนวณตัวอย่าง (หน้าเว็บ) — ยอดจริงคำนวณที่หลังบ้าน */
function previewCalc(m, rd, curr, broken, reset) {
  var rates = rd ? rd.rates : S.boot.rates, rate = m.kind === 'W' ? +rates.W : +rates.E, prev = m._prev;
  var out = { rate: rate, prev: prev, usage: null, amount: null, err: '', warn: '' };
  if (broken) { out.amount = +rates.FLAT; out.warn = 'มิเตอร์เสีย: เหมา ' + rates.FLAT + ' บาท' + (S.boot.settings.brokenMode === 'PER_METER' ? '/มิเตอร์' : '/คน'); return out; }
  if (curr === '' || curr == null || isNaN(+curr)) return out;
  var base = reset !== '' && reset != null && !isNaN(+reset) ? +reset : prev;
  if (base == null) { out.err = 'ไม่มีเลขครั้งก่อน'; return out; }
  if (+curr < base) { out.err = 'น้อยกว่าเลข' + (reset !== '' && reset != null ? 'เริ่มใหม่' : 'ครั้งก่อน') + ' (' + nf(base) + ')'; return out; }
  out.usage = Math.round((+curr - base) * 1000) / 1000; out.amount = r2(out.usage * rate);
  var f = S.boot.settings.alertFactor || 2.5, mn = S.boot.settings.alertMinUnits || 20;
  if (m.avgUsage && out.usage >= mn && out.usage > m.avgUsage * f) out.warn = 'สูงกว่าค่าเฉลี่ย (' + nf(m.avgUsage) + ') เกิน ' + f + ' เท่า';
  return out;
}
/** ผูกเลขมิเตอร์ของรอบกับทะเบียน: m._prev / m._r */
function bindReadings() {
  var rd = S.roundData || {}, rr = rd.readings || {};
  (S.master ? S.master.meters : []).forEach(function (m) {
    var x = rr[m.id];
    m._r = x ? { prev: x[0], curr: x[1], broken: !!x[2], reset: x[3], exempt: !!x[4], exemptReason: x[5], note: x[6], by: x[7], at: x[8], src: x[9] } : null;
    m._prev = x && x[0] != null ? x[0] : m.lastReading;
  });
}
function roundEditable(rd) { if (!rd) return false; if (rd.status === 'LOCKED') return false; if (rd.status === 'SUBMITTED') return isHR(); return true; }
function roundBadge(rd) {
  if (!rd) return '<span class="tag">ยังไม่มีรอบ</span>';
  var c = rd.status === 'LOCKED' ? 'ok' : rd.status === 'SUBMITTED' ? 'violet' : 'water';
  return '<span class="tag ' + c + '">' + ic(rd.status === 'LOCKED' ? 'lock' : rd.status === 'SUBMITTED' ? 'send' : 'edit') + ' ' + RST_TH[rd.status] + '</span>';
}

/* =================================================================== เส้นทาง */
var PAGES = {};
function route() {
  if (!S.token || !S.me) return renderLogin();
  var h = (location.hash || '').replace(/^#\/?/, ''), parts = h.split('/'), name = parts[0] || homeRoute();
  var allowed = navItems().filter(function (x) { return x.r; }).map(function (x) { return x.r; });
  if (allowed.indexOf(name) < 0) name = homeRoute();
  S.route = name;
  window.scrollTo(0, 0);
  try { (PAGES[name] || PAGES[homeRoute()])(parts.slice(1)); } catch (e) { console.error(e); errToast(e); }
}
window.addEventListener('hashchange', route);

/* =================================================================== เริ่มระบบ */
function checkVersion() {
  fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
    if (v.build && v.build !== UB_BUILD && !$('#vbar')) {
      var d = document.createElement('div'); d.id = 'vbar'; d.className = 'note info'; d.style.cssText = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:150;box-shadow:var(--shadow-lg)';
      d.innerHTML = ic('refresh') + '<div>มี U-Bill รุ่นใหม่ (' + esc(v.build) + ') <a href="#" onclick="location.reload(true);return false">กดเพื่อโหลดใหม่</a></div>'; document.body.appendChild(d);
    }
  }).catch(function () { });
}
function start() {
  try { S.token = localStorage.getItem('ub_token') || null; } catch (e) { }
  api('branding').then(function (b) { S.brand = b; }).catch(function () { }).then(function () {
    if (!S.token) { $('#bootsplash') && $('#bootsplash').remove(); return renderLogin(); }
    return api('bootstrap').then(function (b) {
      applyBoot(b);
      if (b.app && b.app.build !== UB_API_BUILD && isHR()) setTimeout(function () { toast('หลังบ้านเป็นรุ่น ' + b.app.build + ' แต่หน้าเว็บต้องการรุ่น ' + UB_API_BUILD + ' — กรุณา Deploy Apps Script รุ่นใหม่', 'warn', 9000); }, 800);
      route();
    }).catch(function () { renderLogin(); });
  }).then(function () { var bs = $('#bootsplash'); if (bs) bs.remove(); });
  setInterval(checkVersion, 600000);
}
document.addEventListener('DOMContentLoaded', start);
