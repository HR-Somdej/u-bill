/* SOMDEJ U-Bill — pages-rooms.js : ทะเบียนห้องพัก · แดชบอร์ดห้องพัก · ผังห้องรายชั้น · รายชื่อผู้พัก · รายงาน (build 2569-11-08.1) */
var RSTATE = {
  OCC: { t: 'มีผู้พัก (เต็ม)', c: '#0b84c6', s: 'water' }, PARTIAL: { t: 'มีผู้พัก (มีเตียงว่าง)', c: '#7cc4ea', s: 'water' },
  VACANT: { t: 'ห้องว่าง', c: '#24a46d', s: 'ok' }, RESERVED: { t: 'จองแล้ว', c: '#e89a00', s: 'elec' },
  REPAIR: { t: 'ห้องเสีย / ซ่อมแซม', c: '#d23c3c', s: 'danger' }, CLOSED: { t: 'ปิดใช้งาน', c: '#8a97a8', s: '' },
  DUTY: { t: 'ห้องเวร', c: '#6d4fd1', s: 'violet' }, INTL: { t: 'ห้องนานาชาติ', c: '#9a7be6', s: 'violet' }, COMMON: { t: 'ห้องส่วนกลาง', c: '#b9a8ef', s: 'violet' }
};
var RSTATE_ORDER = ['OCC', 'PARTIAL', 'VACANT', 'RESERVED', 'REPAIR', 'CLOSED', 'DUTY', 'INTL', 'COMMON'];
var RTYPE_TH = { EMP: 'หักเงินเดือน', CASH: 'ชำระเงินสด', PENDING: 'รอรหัสพนักงาน' };
var GENDER_TH = { M: 'ชาย', F: 'หญิง', '': 'ไม่ระบุ' };
var ROOMGENDER_TH = { '': 'ไม่กำหนด', M: 'ชาย', F: 'หญิง', MIX: 'รวม/ครอบครัว' };

/** แบบจำลองห้องพักจากทะเบียน (ใช้ร่วม: แดชบอร์ด · ผังห้อง · รายงาน) */
function roomModel(M, at) {
  M = M || S.master; at = at || today();
  var res = {}; (M.residents || []).forEach(function (r) { res[r.rid] = r; });
  var leaveNow = {}; (M.leaves || []).forEach(function (l) { if (l.from <= at && (!l.to || l.to >= at)) leaveNow[l.rid] = l; });
  var rooms = {}, order = [];
  function get(bld, room) {
    var k = bld + '|' + room;
    if (!rooms[k]) { rooms[k] = { id: k, bld: bld, room: room, floor: '', zone: '', type: '', beds: null, gender: '', status: '', meters: [], occ: {}, hist: {} }; order.push(rooms[k]); }
    return rooms[k];
  }
  (M.rooms || []).forEach(function (x) { var r = get(x.bld, x.room); for (var k in x) if (k !== 'id') r[k] = x[k]; });
  var mById = {};
  M.meters.forEach(function (m) { mById[m.id] = m; var r = get(m.bld, m.room); r.meters.push(m); if (!r.floor) r.floor = m.floor; });
  (M.assigns || []).forEach(function (a) {
    var m = mById[a.meterId]; if (!m) return;
    var r = get(m.bld, m.room), key = a.rid || (a.payType + ':' + (a.empCode || a.name));
    var h = r.hist[key] = r.hist[key] || { rid: a.rid, name: a.name, empCode: a.empCode, payType: a.payType, start: a.startDate, end: a.endDate || '', kinds: {} };
    if (a.startDate < h.start) h.start = a.startDate;
    if (h.end && (!a.endDate || a.endDate > h.end)) h.end = a.endDate || '';
    h.kinds[m.kind] = 1;
    if (a.startDate <= at && (!a.endDate || a.endDate >= at)) r.occ[key] = h;
  });
  order.forEach(function (r) {
    r.people = Object.keys(r.occ).map(function (k) { var h = r.occ[k], x = res[h.rid] || {}; return { rid: h.rid, name: x.name || h.name, empCode: x.empCode || h.empCode, rtype: x.rtype || h.payType, gender: x.gender || '', position: x.position || '', division: x.division || '', group: x.group || '', start: h.start, leave: leaveNow[h.rid] || null, cf: x.cf || 0, acct: x.acct || '', flag: x.flag || '' }; });
    r.history = Object.keys(r.hist).map(function (k) { return r.hist[k]; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
    var nonOcc = r.meters.filter(function (m) { return m.status !== 'OCC' && m.status !== 'VACANT'; })[0];
    var n = r.people.length, beds = r.beds != null && r.beds !== '' ? +r.beds : null;
    r.state = r.status === 'REPAIR' ? 'REPAIR' : r.status === 'CLOSED' ? 'CLOSED' : nonOcc ? nonOcc.status : n ? (beds && n < beds ? 'PARTIAL' : 'OCC') : r.status === 'RESERVED' ? 'RESERVED' : 'VACANT';
    r.freeBeds = beds != null && ['OCC', 'PARTIAL', 'VACANT', 'RESERVED'].indexOf(r.state) >= 0 ? Math.max(0, beds - n) : 0;
    r.n = n;
  });
  order.sort(function (a, b) { return (bldOf(a.bld).sort || 99) - (bldOf(b.bld).sort || 99) || sortNat(a.floor, b.floor) || sortNat(a.room, b.room); });
  return { rooms: order, byId: rooms, residents: res, leaveNow: leaveNow };
}

PAGES.rooms = function (args) {
  var tab = args[0] || 'dash';
  var pg = shell('ห้องพัก · ผู้พัก', 'ทะเบียนห้อง สถานะห้อง ผู้เข้าพัก และแดชบอร์ด — ข้อมูลจากทะเบียนเดียวกับการคิดค่าน้ำ–ค่าไฟ',
    helpBtn('rooms') + '<button class="btn" id="ro-x">' + ic('download') + ' รายงานห้องพัก (.xlsx)</button><button class="btn" id="ro-p">' + ic('printer') + ' พิมพ์</button>');
  pg.innerHTML = loadingHtml();
  $('#ro-x').onclick = function () { exportFile('ROOMS', this); };
  $('#ro-p').onclick = function () { window.print(); };
  loadMaster(true).then(function () { renderRooms(pg, tab); }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
};
function renderRooms(pg, tab) {
  var P = readPrefs(); P.rb = P.rb || '*'; P.rz = P.rz || ''; P.rs = P.rs || '';
  var RM = roomModel();
  var tabs = [['dash', 'แดชบอร์ด', 'chart'], ['map', 'ผังห้องรายชั้น', 'layers'], ['list', 'ทะเบียนห้อง', 'table'], ['people', 'รายชื่อผู้พัก', 'users']];
  pg.innerHTML = '<div class="card flat"><div class="row"><select class="inp" id="rb" style="width:auto"><option value="*">ทุกที่พัก</option>' + S.boot.buildings.map(function (b) { return '<option value="' + b.id + '"' + (b.id === P.rb ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select>' +
    '<select class="inp" id="rz" style="width:auto"><option value="">ทุกฝั่ง/โซน</option>' + uniq(RM.rooms.map(function (r) { return r.zone; })).map(function (z) { return '<option' + (z === P.rz ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('') + '</select>' +
    '<select class="inp" id="rs" style="width:auto"><option value="">ทุกสถานะ</option>' + RSTATE_ORDER.map(function (k) { return '<option value="' + k + '"' + (k === P.rs ? ' selected' : '') + '>' + RSTATE[k].t + '</option>'; }).join('') + '</select>' +
    '<span class="grow"></span><span class="small muted">ข้อมูล ณ ' + thDate(today(), false) + '</span></div></div>' +
    '<div class="tabs mt12" id="ro-tabs">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + ic(t[2]) + ' ' + t[1] + '</button>'; }).join('') + '</div><div id="ro-body" class="mt12"></div>';
  var on = function (id, k) { $(id).onchange = function () { P[k] = this.value; savePrefs(P); body(); }; };
  on('#rb', 'rb'); on('#rz', 'rz'); on('#rs', 'rs');
  $$('#ro-tabs button').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; history.replaceState(null, '', '#/rooms/' + tab); $$('#ro-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); body(); }; });
  function filtered() { return RM.rooms.filter(function (r) { return (P.rb === '*' || r.bld === P.rb) && (!P.rz || r.zone === P.rz) && (!P.rs || r.state === P.rs); }); }
  function redraw() { loadMaster(true).then(function () { RM = roomModel(); body(); }); }
  function body() {
    DASH.charts.forEach(function (c) { try { c.destroy(); } catch (e) { } }); DASH.charts = [];
    var B = $('#ro-body'), L = filtered();
    if (tab === 'dash') return roomDash(B, L);
    if (tab === 'map') return roomMap(B, L, redraw);
    if (tab === 'list') return roomList(B, L, redraw);
    return peopleList(B, L, redraw);
  }
  body();
}
function uniq(a) { var o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o).sort(sortNat); }
function countBy(list, fn) { var o = {}; list.forEach(function (x) { var k = fn(x) || 'ไม่ระบุ'; o[k] = (o[k] || 0) + 1; }); return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }); }

function roomDash(B, L) {
  var st = {}; RSTATE_ORDER.forEach(function (k) { st[k] = 0; }); L.forEach(function (r) { st[r.state]++; });
  var people = []; L.forEach(function (r) { r.people.forEach(function (p) { people.push(Object.assign({ bld: r.bld, room: r.room }, p)); }); });
  var beds = L.reduce(function (s, r) { return s + (+r.beds || 0); }, 0), free = L.reduce(function (s, r) { return s + r.freeBeds; }, 0);
  var livable = L.filter(function (r) { return ['OCC', 'PARTIAL', 'VACANT', 'RESERVED'].indexOf(r.state) >= 0; }).length, occR = st.OCC + st.PARTIAL;
  var onLeave = people.filter(function (p) { return p.leave; }).length, pend = people.filter(function (p) { return p.rtype === 'PENDING'; }).length;
  B.innerHTML = '<div class="grid g4">' +
    kpi('ห้องทั้งหมด', nf(L.length), 'ห้อง', 'ใช้พักได้ ' + nf(livable) + ' · เตียง ' + nf(beds), 'var(--water-soft)', 'building') +
    kpi('ห้องที่มีผู้พัก', nf(occR), 'ห้อง', 'อัตราครองห้อง <b>' + pct(occR, livable) + '%</b> · มีเตียงว่าง ' + nf(st.PARTIAL) + ' ห้อง', 'var(--accent-soft)', 'home') +
    kpi('ห้องว่าง', nf(st.VACANT), 'ห้อง', 'เตียงว่างรวม ' + nf(free) + ' · จองแล้ว ' + nf(st.RESERVED), 'var(--ok-soft)', 'check') +
    kpi('ห้องเสีย / ซ่อม', nf(st.REPAIR), 'ห้อง', 'ปิดใช้ ' + nf(st.CLOSED) + ' · ห้องเวร/อื่น ๆ ' + nf(st.DUTY + st.INTL + st.COMMON), 'var(--danger-soft)', 'tool') + '</div>' +
    '<div class="grid g4 mt12">' +
    kpi('ผู้พักปัจจุบัน', nf(people.length), 'คน', 'ชาย ' + nf(people.filter(function (p) { return p.gender === 'M'; }).length) + ' · หญิง ' + nf(people.filter(function (p) { return p.gender === 'F'; }).length), 'var(--violet-soft)', 'users') +
    kpi('หักเงินเดือน', nf(people.filter(function (p) { return p.rtype === 'EMP'; }).length), 'คน', 'รหัส 7 หลัก', 'var(--ok-soft)', 'shield') +
    kpi('ชำระเงินสด', nf(people.filter(function (p) { return p.rtype === 'CASH'; }).length), 'คน', 'นศพ. / แพทย์ฝึกหัด ฯลฯ', 'var(--elec-soft)', 'cash') +
    kpi('ต้องติดตาม', nf(pend + onLeave), 'คน', 'รอรหัส ' + nf(pend) + ' · พักการเรียกเก็บ ' + nf(onLeave), 'var(--warn-soft)', 'alert') + '</div>' +
    '<div class="grid g2 mt12"><div class="card"><h3>สถานะห้องแยกตามที่พัก</h3><div class="chartbox tall"><canvas id="c-st"></canvas></div></div>' +
    '<div class="card"><h3>อัตราครองห้อง (%) แยกตามที่พัก</h3><div class="chartbox tall"><canvas id="c-oc"></canvas></div></div></div>' +
    '<div class="grid g2 mt12"><div class="card"><h3>เพศของผู้พัก</h3><div class="chartbox short"><canvas id="c-g"></canvas></div></div>' +
    '<div class="card"><h3>ประเภทผู้พัก / กลุ่ม</h3><div class="chartbox short"><canvas id="c-t"></canvas></div></div></div>' +
    '<div class="grid g2 mt12"><div class="card"><h3>ตำแหน่ง (15 อันดับ)</h3><div class="chartbox tall"><canvas id="c-p"></canvas></div></div>' +
    '<div class="card"><h3>ฝ่าย / สังกัด (15 อันดับ)</h3><div class="chartbox tall"><canvas id="c-d"></canvas></div></div></div>' +
    '<div class="grid g2 mt12"><div class="card"><h3>ย้ายเข้า – ย้ายออก รายเดือน (12 เดือน)</h3><div class="chartbox"><canvas id="c-m"></canvas></div></div>' +
    '<div class="card"><h3>ประเภทห้อง</h3><div class="chartbox"><canvas id="c-rt"></canvas></div></div></div>' +
    '<div class="card mt12"><h3>สรุปรายที่พัก</h3><div class="tbl-wrap mt8"><table class="t"><thead><tr><th>ที่พัก</th><th class="n">ห้อง</th>' + RSTATE_ORDER.map(function (k) { return '<th class="n"><span class="legend-sw" style="background:' + RSTATE[k].c + '"></span>' + RSTATE[k].t.replace(/ \(.+\)/, '') + (k === 'PARTIAL' ? ' (เตียงว่าง)' : '') + '</th>'; }).join('') + '<th class="n">ผู้พัก</th><th class="n">เตียงว่าง</th><th class="n">ครองห้อง</th></tr></thead><tbody>' +
    S.boot.buildings.map(function (b) {
      var R = L.filter(function (r) { return r.bld === b.id; }); if (!R.length) return '';
      var c = {}; R.forEach(function (r) { c[r.state] = (c[r.state] || 0) + 1; });
      var lv = R.filter(function (r) { return ['OCC', 'PARTIAL', 'VACANT', 'RESERVED'].indexOf(r.state) >= 0; }).length;
      return '<tr><td>' + esc(b.name) + '</td><td class="n">' + R.length + '</td>' + RSTATE_ORDER.map(function (k) { return '<td class="n">' + (c[k] || '') + '</td>'; }).join('') + '<td class="n"><b>' + nf(R.reduce(function (s, r) { return s + r.n; }, 0)) + '</b></td><td class="n">' + nf(R.reduce(function (s, r) { return s + r.freeBeds; }, 0)) + '</td><td class="n">' + pct((c.OCC || 0) + (c.PARTIAL || 0), lv) + '%</td></tr>';
    }).join('') + '</tbody></table></div></div>';
  var blds = S.boot.buildings.filter(function (b) { return L.some(function (r) { return r.bld === b.id; }); });
  mkChart('c-st', { type: 'bar', data: { labels: blds.map(function (b) { return b.short; }), datasets: RSTATE_ORDER.filter(function (k) { return st[k]; }).map(function (k) { return { label: RSTATE[k].t, backgroundColor: RSTATE[k].c, borderRadius: 4, data: blds.map(function (b) { return L.filter(function (r) { return r.bld === b.id && r.state === k; }).length; }) }; }) }, options: baseOpt({ stacked: true }) });
  mkChart('c-oc', { type: 'bar', data: { labels: blds.map(function (b) { return b.short; }), datasets: [{ label: 'ครองห้อง %', backgroundColor: '#0b84c6', borderRadius: 6, data: blds.map(function (b) { var R = L.filter(function (r) { return r.bld === b.id; }), lv = R.filter(function (r) { return ['OCC', 'PARTIAL', 'VACANT', 'RESERVED'].indexOf(r.state) >= 0; }).length; return pct(R.filter(function (r) { return r.state === 'OCC' || r.state === 'PARTIAL'; }).length, lv); }) }] }, options: Object.assign(baseOpt({ noLegend: true }), {}) });
  var g = countBy(people, function (p) { return GENDER_TH[p.gender || ''] || 'ไม่ระบุ'; });
  mkChart('c-g', { type: 'doughnut', data: { labels: g.map(function (x) { return x[0]; }), datasets: [{ data: g.map(function (x) { return x[1]; }), backgroundColor: g.map(function (x) { return x[0] === 'ชาย' ? '#0b84c6' : x[0] === 'หญิง' ? '#e0609a' : '#b8c3d1'; }) }] }, options: donutOpt() });
  var t = countBy(people, function (p) { return p.rtype === 'EMP' ? 'หักเงินเดือน' : p.rtype === 'PENDING' ? 'รอรหัสพนักงาน' : (p.group || 'ชำระเงินสด'); });
  var PAL = ['#0b84c6', '#e89a00', '#6d4fd1', '#24a46d', '#d23c3c', '#14a3b8', '#9a7be6', '#c2560c', '#5b6b80', '#e0609a'];
  mkChart('c-t', { type: 'doughnut', data: { labels: t.map(function (x) { return x[0]; }), datasets: [{ data: t.map(function (x) { return x[1]; }), backgroundColor: PAL }] }, options: donutOpt() });
  var hb = function (id, arr, color) { arr = arr.slice(0, 15); mkChart(id, { type: 'bar', data: { labels: arr.map(function (x) { return x[0].length > 34 ? x[0].slice(0, 33) + '…' : x[0]; }), datasets: [{ label: 'คน', data: arr.map(function (x) { return x[1]; }), backgroundColor: color, borderRadius: 4 }] }, options: Object.assign(baseOpt({ noLegend: true }), { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#eef2f7' } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } }) }); };
  hb('c-p', countBy(people, function (p) { return p.position; }), '#14a3b8');
  hb('c-d', countBy(people, function (p) { return p.division || p.group; }), '#6d4fd1');
  var months = []; var d = new Date(); for (var i = 11; i >= 0; i--) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2)); }
  var mi = {}, mo = {}; L.forEach(function (r) { r.history.forEach(function (h) { var a = String(h.start).slice(0, 7), b = String(h.end || '').slice(0, 7); mi[a] = (mi[a] || 0) + 1; if (b) mo[b] = (mo[b] || 0) + 1; }); });
  mkChart('c-m', { type: 'bar', data: { labels: months.map(function (m) { return TH_MON[+m.slice(5) - 1] + ' ' + String(+m.slice(0, 4) + 543).slice(2); }), datasets: [{ label: 'ย้ายเข้า', data: months.map(function (m) { return mi[m] || 0; }), backgroundColor: '#24a46d', borderRadius: 4 }, { label: 'ย้ายออก', data: months.map(function (m) { return mo[m] || 0; }), backgroundColor: '#e89a00', borderRadius: 4 }] }, options: baseOpt({}) });
  var rt = countBy(L, function (r) { return r.type || 'ไม่ระบุ'; });
  mkChart('c-rt', { type: 'doughnut', data: { labels: rt.map(function (x) { return x[0]; }), datasets: [{ data: rt.map(function (x) { return x[1]; }), backgroundColor: PAL }] }, options: donutOpt() });
}

function roomMap(B, L, redraw) {
  var byB = {}; L.forEach(function (r) { (byB[r.bld] = byB[r.bld] || []).push(r); });
  B.innerHTML = '<div class="card flat"><div class="row small">' + RSTATE_ORDER.map(function (k) { return '<span><span class="legend-sw" style="background:' + RSTATE[k].c + '"></span>' + RSTATE[k].t + '</span>'; }).join('') + '<span class="muted">· ตัวเลข = ผู้พัก/เตียง · ♀ ♂ = ห้องหญิง/ชาย · แตะห้องเพื่อจัดการ</span></div></div>' +
    Object.keys(byB).map(function (bid) {
      var R = byB[bid], floors = uniq(R.map(function (r) { return r.floor || '-'; })).sort(function (a, b) { return sortNat(b, a); });
      return '<div class="card mt12"><h3>' + ic('building') + ' ' + esc(bldOf(bid).name) + ' <span class="small muted">' + R.length + ' ห้อง</span></h3>' +
        floors.map(function (f) {
          var rr = R.filter(function (r) { return (r.floor || '-') === f; }).sort(function (a, b) { return sortNat(a.room, b.room); });
          return '<div class="fl"><div class="fn">ชั้น ' + esc(f) + '</div><div class="cells">' + rr.map(function (r) {
            var s = RSTATE[r.state], lv = r.people.some(function (p) { return p.leave; }), pend = r.people.some(function (p) { return p.rtype === 'PENDING'; });
            return '<button class="rcell" data-r="' + esc(r.id) + '" style="--rc:' + s.c + '" title="' + esc(r.room + ' · ' + s.t + (r.people.length ? ' · ' + r.people.map(function (p) { return p.name; }).join(', ') : '') + (r.statusReason ? ' · ' + r.statusReason : '')) + '"><b>' + esc(String(r.room).replace(/^[AB] /, '')) + '</b><span>' + (r.state === 'REPAIR' ? '🔧' : r.n + (r.beds ? '/' + r.beds : '')) + (r.gender === 'F' ? ' ♀' : r.gender === 'M' ? ' ♂' : '') + '</span>' + (lv || pend ? '<i></i>' : '') + '</button>';
          }).join('') + '</div></div>';
        }).join('') + '</div>';
    }).join('') + (!L.length ? emptyHtml('ไม่มีห้องตามตัวกรอง', 'building') : '');
  $$('[data-r]', B).forEach(function (b) { b.onclick = function () { roomDialog(b.dataset.r, redraw); }; });
}

function roomList(B, L, redraw) {
  var q = B._q || '';
  var draw = function () {
    var LL = q ? L.filter(function (r) { return (r.room + ' ' + r.people.map(function (p) { return p.name + ' ' + p.empCode + ' ' + p.division; }).join(' ') + ' ' + r.type + ' ' + r.zone).indexOf(q) >= 0; }) : L;
    $('#rl-t').innerHTML = LL.slice(0, 600).map(function (r) {
      var s = RSTATE[r.state];
      return '<tr><td class="nowrap"><b>' + esc(r.room) + '</b><div class="tiny muted">' + esc(bldOf(r.bld).short) + (r.zone ? ' · ' + esc(r.zone) : '') + '</div></td><td>' + esc(r.floor || '-') + '</td><td class="small">' + esc(r.type || '-') + '</td><td class="n">' + (r.beds != null && r.beds !== '' ? r.beds : '-') + '</td><td class="small">' + ROOMGENDER_TH[r.gender || ''] + '</td>' +
        '<td><span class="tag ' + s.s + '">' + s.t + '</span>' + (r.statusReason ? '<div class="tiny muted">' + esc(r.statusReason) + '</div>' : '') + '</td>' +
        '<td class="small">' + (r.people.length ? r.people.map(function (p) { return personChip(p); }).join('<br>') : '<span class="muted">—</span>') + '</td>' +
        '<td>' + r.meters.map(function (m) { return '<span class="tag ' + (m.kind === 'W' ? 'water' : 'elec') + '">' + KIND_SHORT[m.kind] + '</span>'; }).join(' ') + '</td><td><button class="btn sm" data-r="' + esc(r.id) + '">' + ic('edit') + ' จัดการ</button></td></tr>';
    }).join('') + (LL.length > 600 ? '<tr><td colspan="9" class="muted small">แสดง 600 จาก ' + LL.length + ' ห้อง — ใช้ตัวกรองด้านบน</td></tr>' : '');
    $$('[data-r]', B).forEach(function (b) { b.onclick = function () { roomDialog(b.dataset.r, redraw); }; });
  };
  B.innerHTML = '<div class="row"><input class="inp" id="rl-q" placeholder="ค้นห้อง / ชื่อ / รหัส / ฝ่าย / ประเภทห้อง" style="max-width:320px" value="' + esc(q) + '"><span class="small muted">' + nf(L.length) + ' ห้อง</span></div>' +
    '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>ห้อง</th><th>ชั้น</th><th>ประเภท</th><th class="n">เตียง</th><th>ห้องสำหรับ</th><th>สถานะ</th><th>ผู้พักปัจจุบัน</th><th>มิเตอร์</th><th></th></tr></thead><tbody id="rl-t"></tbody></table></div>';
  $('#rl-q').oninput = debounce(function () { q = B._q = $('#rl-q').value.trim(); draw(); }, 250);
  draw();
}
function personChip(p) {
  return (p.rtype === 'EMP' ? '<span class="dot ok"></span> ' : p.rtype === 'PENDING' ? '<span class="tag warn">รอรหัส</span> ' : '<span class="tag elec">สด</span> ') + esc(p.name) +
    (p.empCode && p.rtype === 'EMP' ? ' <span class="muted">' + esc(p.empCode) + '</span>' : '') + (p.leave ? ' <span class="tag violet" title="' + esc(p.leave.reason + ' ' + thDate(p.leave.from, false) + ' – ' + (p.leave.to ? thDate(p.leave.to, false) : 'ไม่กำหนด')) + '">' + esc(p.leave.reason) + '</span>' : '') +
    ((p.cf & 1) ? '' : ' <span class="tag" title="ยังไม่มีเบอร์โทร">ไม่มีเบอร์</span>');
}
function peopleList(B, L, redraw) {
  var q = B._q || '', f = B._f || '';
  var all = []; L.forEach(function (r) { r.people.forEach(function (p) { all.push(Object.assign({ room: r, bld: r.bld }, p)); }); });
  var draw = function () {
    var LL = all.filter(function (p) { return (!f || (f === 'LEAVE' ? p.leave : f === 'NOPHONE' ? !(p.cf & 1) : p.rtype === f)) && (!q || (p.name + ' ' + p.empCode + ' ' + p.rid + ' ' + p.room.room + ' ' + p.position + ' ' + p.division + ' ' + p.group).indexOf(q) >= 0); });
    $('#pl-n').textContent = nf(LL.length) + ' คน';
    $('#pl-t').innerHTML = LL.slice(0, 800).map(function (p) {
      return '<tr><td class="tiny muted">' + esc(p.rid) + '</td><td>' + esc(p.name) + (p.leave ? ' <span class="tag violet">' + esc(p.leave.reason) + '</span>' : '') + '</td><td>' + esc(p.rtype === 'EMP' ? p.empCode : '') + (p.rtype === 'PENDING' ? '<span class="tag warn">รอรหัส</span>' : '') + '</td><td class="small">' + (RTYPE_TH[p.rtype] || '') + (p.group ? '<div class="tiny muted">' + esc(p.group) + '</div>' : '') + '</td><td>' + (GENDER_TH[p.gender] || '-') + '</td>' +
        '<td class="small">' + esc(p.position || '-') + '</td><td class="small">' + esc(p.division || '-') + '</td><td class="nowrap"><b>' + esc(p.room.room) + '</b> <span class="tiny muted">' + esc(bldOf(p.bld).short) + '</span></td><td class="small">' + thDate(p.start, false) + '</td>' +
        '<td class="small">' + ((p.cf & 1) ? '<span class="dot ok"></span> เบอร์' : '<span class="tag">ไม่มีเบอร์</span>') + ' ' + ((p.cf & 2) ? '<span class="dot ok"></span> อีเมล' : '<span class="tag">ไม่มีอีเมล</span>') + '</td><td><button class="btn sm" data-r="' + esc(p.room.id) + '">' + ic('edit') + '</button></td></tr>';
    }).join('');
    $$('[data-r]', B).forEach(function (b) { b.onclick = function () { roomDialog(b.dataset.r, redraw); }; });
  };
  B.innerHTML = '<div class="row"><input class="inp" id="pl-q" placeholder="ค้นชื่อ / รหัส / ห้อง / ตำแหน่ง / ฝ่าย" style="max-width:300px" value="' + esc(q) + '"><div class="seg" id="pl-f">' + [['', 'ทั้งหมด'], ['EMP', 'หักเงินเดือน'], ['CASH', 'เงินสด'], ['PENDING', 'รอรหัส'], ['LEAVE', 'พักการเรียกเก็บ'], ['NOPHONE', 'ไม่มีเบอร์']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div><span class="grow"></span><span class="small muted" id="pl-n"></span></div>' +
    '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>เลขผู้พัก</th><th>ชื่อ-สกุล</th><th>รหัสพนักงาน</th><th>ประเภท</th><th>เพศ</th><th>ตำแหน่ง</th><th>ฝ่าย</th><th>ห้อง</th><th>เข้าพัก</th><th>ข้อมูลติดต่อ</th><th></th></tr></thead><tbody id="pl-t"></tbody></table></div>';
  $('#pl-q').oninput = debounce(function () { q = B._q = $('#pl-q').value.trim(); draw(); }, 250);
  $$('#pl-f button').forEach(function (b) { b.onclick = function () { f = B._f = b.dataset.f; $$('#pl-f button').forEach(function (x) { x.classList.toggle('on', x === b); }); draw(); }; });
  draw();
}
