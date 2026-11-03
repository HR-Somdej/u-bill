/* SOMDEJ U-Bill — pages-dash.js : แดชบอร์ดผู้บริหาร (อินเทอร์แอคทีฟ · เดือน/ไตรมาส/ปีงบ/ปีปฏิทิน/ช่วงเวลา) */
var DASH = { data: null, charts: [] };
var PAL = ['#0b84c6', '#e89a00', '#158a5a', '#6d4fd1', '#c8202e', '#0f9fb5', '#8a6d3b', '#d14f9a'];
var C_W = '#0b84c6', C_E = '#e89a00';
PAGES.dash = function () {
  var pg = shell('แดชบอร์ด', 'สรุปค่าน้ำ–ค่าไฟที่พักบุคลากร · เลือกช่วงเวลา/ที่พัก/ประเภทได้ · ข้อมูลรายรอบหักเงิน',
    '<button class="btn" id="d-xls">' + ic('download') + ' Excel</button><button class="btn" id="d-print">' + ic('printer') + ' พิมพ์ / PDF</button>');
  pg.innerHTML = loadingHtml('กำลังรวบรวมข้อมูล…');
  $('#d-print').onclick = function () { window.print(); };
  api('getDashboard', {}).then(function (d) { DASH.data = d; renderDash(pg); }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + ic('alert') + esc(e.message) + '</div>'; });
};
/* ---------- ตัวช่วยช่วงเวลา (รอบ = เดือนที่หัก พ.ศ. 'YYYY-MM') */
function fyOf(id) { var y = +id.slice(0, 4), m = +id.slice(5, 7); return m >= 10 ? y + 1 : y; }
function qOf(id) { var m = +id.slice(5, 7); return m >= 10 ? 1 : m <= 3 ? 2 : m <= 6 ? 3 : 4; }
function addM(id, n) { var y = +id.slice(0, 4), m = +id.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + ('0' + (m + 1)).slice(-2); }
function monthsBetween(a, b) { var out = [], x = a; while (x <= b && out.length < 240) { out.push(x); x = addM(x, 1); } return out; }
function periodRange(F) {
  if (F.mode === 'month') return [F.month, F.month];
  if (F.mode === 'quarter') { var fy = +F.fy, q = +F.q, start = (fy - 1) + '-10'; var s = addM(start, (q - 1) * 3); return [s, addM(s, 2)]; }
  if (F.mode === 'fy') return [(+F.fy - 1) + '-10', F.fy + '-09'];
  if (F.mode === 'year') return [F.year + '-01', F.year + '-12'];
  return [F.from, F.to];
}
function periodLabel(F) {
  if (F.mode === 'month') return 'รอบ ' + rTh(F.month, true);
  if (F.mode === 'quarter') return 'ไตรมาส ' + F.q + ' ปีงบประมาณ ' + F.fy;
  if (F.mode === 'fy') return 'ปีงบประมาณ ' + F.fy + ' (ต.ค. ' + (+F.fy - 1) + ' – ก.ย. ' + F.fy + ')';
  if (F.mode === 'year') return 'ปี พ.ศ. ' + F.year;
  return rTh(F.from) + ' – ' + rTh(F.to);
}
function renderDash(pg) {
  var d = DASH.data, rows = d.rows.slice();
  if (d.live && d.live.rows) rows = rows.filter(function (r) { return r.round !== d.live.round.id; }).concat(d.live.rows.map(function (r) { r.persons = +r.persons || 0; return r; }));
  var rounds = {}; rows.forEach(function (r) { rounds[r.round] = 1; });
  var RL = Object.keys(rounds).sort();
  if (!RL.length) { pg.innerHTML = emptyHtml('ยังไม่มีข้อมูลสำหรับแดชบอร์ด — ข้อมูลจะปรากฏเมื่อมีรอบในระบบ หรือนำเข้าประวัติปี 2568–2569 (เมนู ตั้งค่า)', 'chart'); return; }
  var last = RL[RL.length - 1], fys = {}, years = {};
  RL.forEach(function (r) { fys[fyOf(r)] = 1; years[r.slice(0, 4)] = 1; });
  var F = DASH.F || (DASH.F = { mode: 'fy', month: last, fy: String(fyOf(last)), q: String(qOf(last)), year: last.slice(0, 4), from: RL[Math.max(0, RL.length - 12)], to: last, kind: '*', blds: {}, live: true });
  var draw = function () {
    DASH.charts.forEach(function (c) { try { c.destroy(); } catch (e) { } }); DASH.charts = [];
    var rng = periodRange(F), len = monthsBetween(rng[0], rng[1]).length;
    var prevRng = [addM(rng[0], -len), addM(rng[0], -1)];
    var useRows = rows.filter(function (r) { return (F.live || r.source !== 'LIVE') && (F.kind === '*' || r.kind === F.kind) && (!Object.keys(F.blds).length || F.blds[r.bld]); });
    var inR = function (r, a) { return r.round >= a[0] && r.round <= a[1]; };
    var cur = useRows.filter(function (r) { return inR(r, rng); }), prv = useRows.filter(function (r) { return inR(r, prevRng); });
    var agg = function (L) { var o = { billed: 0, deducted: 0, cash: 0, unallocated: 0, nonCharge: 0, excluded: 0, uW: 0, uE: 0, aW: 0, aE: 0, broken: 0, persons: 0, rounds: {} };
      L.forEach(function (r) { o.billed += r.billed; o.deducted += r.deducted; o.cash += r.cash; o.unallocated += r.unallocated; o.nonCharge += r.nonCharge; o.excluded += r.excluded; o.broken += r.broken; if (r.kind === 'W') { o.uW += r.units; o.aW += r.billed; } else { o.uE += r.units; o.aE += r.billed; } o.rounds[r.round] = 1; });
      var per = {}; L.forEach(function (r) { per[r.round] = per[r.round] || {}; per[r.round][r.bld + r.kind] = r.persons; });
      var pr = Object.keys(per).map(function (k) { var mx = {}; Object.keys(per[k]).forEach(function (x) { var b = x.slice(0, -1); mx[b] = Math.max(mx[b] || 0, per[k][x]); }); return Object.keys(mx).reduce(function (s, b) { return s + mx[b]; }, 0); });
      o.persons = pr.length ? Math.round(pr.reduce(function (s, v) { return s + v; }, 0) / pr.length) : 0; o.nRounds = Object.keys(o.rounds).length; return o; };
    var A = agg(cur), B = agg(prv);
    var delta = function (a, b, inv) { if (!b) return '<span class="muted">ไม่มีข้อมูลช่วงก่อนหน้า</span>'; var p = (a - b) / b * 100; return '<span class="' + (p > 0 ? 'up' : 'down') + '">' + (p > 0 ? '▲' : '▼') + ' ' + Math.abs(p).toFixed(1) + '%</span> เทียบช่วงก่อนหน้า'; };
    var bldIds = S.boot.buildings.map(function (b) { return b.id; });
    var html = '<div class="dash-filter"><div class="seg" id="df-mode">' + [['month', 'เดือน'], ['quarter', 'ไตรมาส'], ['fy', 'ปีงบ'], ['year', 'ปีปฏิทิน'], ['range', 'ช่วงเวลา']].map(function (x) { return '<button data-m="' + x[0] + '" class="' + (F.mode === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<span id="df-sel" class="row"></span><span class="grow"></span>' +
      '<div class="seg" id="df-kind"><button data-k="*" class="' + (F.kind === '*' ? 'on' : '') + '">ทั้งหมด</button><button data-k="W" class="' + (F.kind === 'W' ? 'on' : '') + '">' + ic('drop', 'w-ic') + ' น้ำ</button><button data-k="E" class="' + (F.kind === 'E' ? 'on e' : '') + '">' + ic('bolt', 'e-ic') + ' ไฟ</button></div>' +
      (d.live && d.live.round ? '<label class="check small noprint" title="รวมรอบที่ยังไม่ล็อก (คำนวณสด)"><input type="checkbox" id="df-live" ' + (F.live ? 'checked' : '') + '> รวมรอบปัจจุบัน</label>' : '') +
      '<div class="chips" style="width:100%">' + S.boot.buildings.map(function (b, i) { return '<button class="chip ' + (F.blds[b.id] ? 'on' : '') + '" data-b="' + b.id + '"><span class="legend-sw" style="background:' + PAL[i % PAL.length] + '"></span>' + esc(b.short) + '</button>'; }).join('') + (Object.keys(F.blds).length ? '<button class="chip" data-b="*">' + ic('x') + ' ล้าง</button>' : '') + '</div></div>' +
      '<div class="row between mt16"><div><h2 style="font-size:21px">' + esc(periodLabel(F)) + '</h2><div class="muted small">' + (F.kind === '*' ? 'ค่าน้ำ + ค่าไฟ' : KIND_TH[F.kind]) + ' · ' + (Object.keys(F.blds).length ? Object.keys(F.blds).map(function (b) { return bldOf(b).short; }).join(', ') : 'ทุกที่พัก') + ' · ' + A.nRounds + ' รอบ' + (cur.some(function (r) { return r.source === 'LIVE'; }) ? ' · <span class="tag water">รวมรอบปัจจุบัน (ยังไม่ล็อก)</span>' : '') + (cur.some(function (r) { return r.source === 'HISTORY'; }) ? ' · <span class="tag">มีข้อมูลประวัติจากไฟล์เดิม</span>' : '') + '</div></div></div>';
    if (!cur.length) { html += '<div class="mt16">' + emptyHtml('ไม่มีข้อมูลในช่วงที่เลือก', 'chart') + '</div>'; pg.innerHTML = html; bind(); return; }
    html += '<div class="grid g4 mt12">' +
      kpi('ยอดเรียกเก็บรวม', baht(A.billed), 'บาท', delta(A.billed, B.billed), 'var(--water-soft)', 'cash') +
      kpi('หักเงินเดือนผ่าน HRMi', baht(A.deducted), 'บาท', pct(A.deducted, A.billed) + '% ของยอดเรียกเก็บ', 'var(--ok-soft)', 'check') +
      kpi('หน่วยน้ำ · หน่วยไฟ', nf(A.uW) + ' · ' + nf(A.uE), 'หน่วย', 'น้ำ ' + baht(A.aW) + ' · ไฟ ' + baht(A.aE) + ' บาท', 'var(--elec-soft)', 'gauge') +
      kpi('ผู้ถูกหักเฉลี่ย/รอบ', nf(A.persons), 'คน', 'เฉลี่ย ' + baht(A.persons && A.nRounds ? A.deducted / A.nRounds / A.persons : 0) + ' บาท/คน/รอบ', 'var(--violet-soft)', 'users') + '</div>' +
      '<div class="grid g4 mt12">' +
      kpi('ชำระเงินสด', baht(A.cash), 'บาท', 'นิสิตแพทย์ / แพทย์ฝึกหัด', 'var(--elec-soft)', 'cash') +
      kpi('ไม่หัก (พ้นสภาพ/ยกเว้น)', baht(A.excluded), 'บาท', 'ต้องติดตามแยก', 'var(--danger-soft)', 'alert') +
      kpi('ไม่เรียกเก็บ', baht(A.nonCharge), 'บาท', 'ห้องเวร · ว่าง · นานาชาติ · ส่วนกลาง', 'var(--violet-soft)', 'building') +
      kpi('ไม่มีผู้รับผิดชอบ · มิเตอร์เสีย', baht(A.unallocated), 'บาท', 'มิเตอร์เสีย ' + nf(A.broken) + ' ครั้ง', 'var(--danger-soft)', 'tool') + '</div>' +
      '<div class="card exec mt16" id="d-exec"></div>' +
      '<div class="grid g2 mt16"><div class="card"><div class="ch"><h3>' + ic('chart') + ' แนวโน้มยอดเรียกเก็บรายรอบ</h3><span class="small muted" id="t-note"></span></div><div class="chartbox tall"><canvas id="c-trend"></canvas></div></div>' +
      '<div class="card"><div class="ch"><h3>' + ic('gauge') + ' หน่วยใช้รายรอบ</h3></div><div class="chartbox tall"><canvas id="c-units"></canvas></div></div></div>' +
      '<div class="grid g2 mt16"><div class="card"><div class="ch"><h3>' + ic('building') + ' ยอดตามที่พัก</h3></div><div class="chartbox"><canvas id="c-bld"></canvas></div></div>' +
      '<div class="grid g2" style="gap:14px"><div class="card"><div class="ch"><h3>' + ic('pie') + ' สัดส่วนตามที่พัก</h3></div><div class="chartbox short"><canvas id="c-share"></canvas></div></div><div class="card"><div class="ch"><h3>' + ic('pie') + ' การเรียกเก็บ</h3></div><div class="chartbox short"><canvas id="c-coll"></canvas></div></div></div></div>' +
      '<div class="grid g2 mt16"><div class="card"><div class="ch"><h3>' + ic('users') + ' ค่าเฉลี่ยต่อคนต่อรอบ</h3></div><div class="chartbox short"><canvas id="c-per"></canvas></div></div><div class="card"><div class="ch"><h3>' + ic('alert') + ' ห้องที่ใช้หน่วยสูงสุด <span class="muted small" id="top-r"></span></h3><div class="seg" id="top-k"><button data-k="E" class="on e">ไฟ</button><button data-k="W">น้ำ</button></div></div><div id="d-top"></div></div></div>' +
      '<div class="card mt16"><div class="ch"><h3>' + ic('table') + ' ตารางยอดเรียกเก็บ ที่พัก × รอบ (บาท)</h3></div><div id="d-heat" class="tbl-wrap" style="max-height:none"></div></div>' +
      '<div class="card mt16"><div class="ch"><h3>' + ic('history') + ' ประวัติอัตรา</h3></div>' + rateTable(d.rates) + '</div>';
    pg.innerHTML = html; bind();
    // ---------- กราฟ
    var trendR = F.mode === 'month' || F.mode === 'quarter' ? monthsBetween(addM(rng[1], -11), rng[1]) : monthsBetween(rng[0], rng[1]);
    trendR = trendR.filter(function (r) { return rounds[r] || (r >= RL[0] && r <= last); });
    $('#t-note').textContent = F.mode === 'month' || F.mode === 'quarter' ? '12 รอบล่าสุดถึงช่วงที่เลือก' : '';
    var byRK = function (r, k, f) { var L = useRows.filter(function (x) { return x.round === r && x.kind === k; }); return L.length ? L.reduce(function (s, x) { return s + x[f]; }, 0) : null; };
    var labels = trendR.map(function (r) { return rTh(r); });
    var ds = [];
    if (F.kind !== 'E') ds.push({ label: 'ค่าน้ำ', data: trendR.map(function (r) { var v = byRK(r, 'W', 'billed'); return v == null ? null : r2(v); }), backgroundColor: C_W, borderRadius: 6, stack: 's' });
    if (F.kind !== 'W') ds.push({ label: 'ค่าไฟ', data: trendR.map(function (r) { var v = byRK(r, 'E', 'billed'); return v == null ? null : r2(v); }), backgroundColor: C_E, borderRadius: 6, stack: 's' });
    mkChart('c-trend', { type: 'bar', data: { labels: labels, datasets: ds.concat([{ type: 'line', label: 'หักเงินเดือน', data: trendR.map(function (r) { var a = byRK(r, 'W', 'deducted'), b2 = byRK(r, 'E', 'deducted'); return a == null && b2 == null ? null : r2((a || 0) + (b2 || 0)); }), borderColor: '#0d2340', backgroundColor: '#0d2340', tension: .35, pointRadius: 3, spanGaps: false }]) },
      options: baseOpt({ money: true, stacked: true, hl: trendR.map(function (r) { return r >= rng[0] && r <= rng[1]; }) }) });
    var uds = [];
    if (F.kind !== 'E') uds.push({ label: 'หน่วยน้ำ', data: trendR.map(function (r) { return byRK(r, 'W', 'units'); }), borderColor: C_W, backgroundColor: 'rgba(11,132,198,.12)', fill: true, tension: .35, yAxisID: 'y' });
    if (F.kind !== 'W') uds.push({ label: 'หน่วยไฟ', data: trendR.map(function (r) { return byRK(r, 'E', 'units'); }), borderColor: C_E, backgroundColor: 'rgba(232,154,0,.12)', fill: true, tension: .35, yAxisID: F.kind === '*' ? 'y1' : 'y' });
    var uo = baseOpt({}); if (F.kind === '*') uo.scales.y1 = { position: 'right', grid: { display: false }, ticks: { callback: function (v) { return nf(v); } }, title: { display: true, text: 'หน่วยไฟ' } }; if (F.kind === '*') uo.scales.y.title = { display: true, text: 'หน่วยน้ำ' };
    mkChart('c-units', { type: 'line', data: { labels: labels, datasets: uds }, options: uo });
    var bs = S.boot.buildings.filter(function (b) { return cur.some(function (r) { return r.bld === b.id; }); });
    var bsum = function (b, k) { return cur.filter(function (r) { return r.bld === b.id && (!k || r.kind === k); }).reduce(function (s, r) { return s + r.billed; }, 0); };
    var bds = []; if (F.kind !== 'E') bds.push({ label: 'ค่าน้ำ', data: bs.map(function (b) { return r2(bsum(b, 'W')); }), backgroundColor: C_W, borderRadius: 5 }); if (F.kind !== 'W') bds.push({ label: 'ค่าไฟ', data: bs.map(function (b) { return r2(bsum(b, 'E')); }), backgroundColor: C_E, borderRadius: 5 });
    var bo = baseOpt({ money: true, stacked: true }); bo.indexAxis = 'y'; bo.scales = { x: { stacked: true, ticks: { callback: function (v) { return nf(v / 1000) + 'k'; } } }, y: { stacked: true, grid: { display: false } } };
    mkChart('c-bld', { type: 'bar', data: { labels: bs.map(function (b) { return b.short; }), datasets: bds }, options: bo });
    mkChart('c-share', { type: 'doughnut', data: { labels: bs.map(function (b) { return b.short; }), datasets: [{ data: bs.map(function (b) { return r2(bsum(b)); }), backgroundColor: bs.map(function (b) { return PAL[bldIds.indexOf(b.id) % PAL.length]; }), borderWidth: 2, borderColor: '#fff' }] }, options: donutOpt() });
    mkChart('c-coll', { type: 'doughnut', data: { labels: ['หักเงินเดือน', 'เงินสด', 'ไม่หัก', 'ไม่มีผู้รับผิดชอบ', 'ไม่เรียกเก็บ'], datasets: [{ data: [A.deducted, A.cash, A.excluded, A.unallocated, A.nonCharge].map(r2), backgroundColor: ['#158a5a', '#e89a00', '#c8202e', '#9aa7b8', '#6d4fd1'], borderWidth: 2, borderColor: '#fff' }] }, options: donutOpt() });
    var perData = trendR.map(function (r) { var L = useRows.filter(function (x) { return x.round === r; }), ded = L.reduce(function (s, x) { return s + x.deducted; }, 0), mx = {}; L.forEach(function (x) { mx[x.bld] = Math.max(mx[x.bld] || 0, x.persons); }); var p = Object.keys(mx).reduce(function (s, b) { return s + mx[b]; }, 0); return p ? r2(ded / p) : null; });
    mkChart('c-per', { type: 'line', data: { labels: labels, datasets: [{ label: 'บาท/คน', data: perData, borderColor: '#6d4fd1', backgroundColor: 'rgba(109,79,209,.12)', fill: true, tension: .35, pointRadius: 3 }] }, options: baseOpt({ money: true, noLegend: true }) });
    // ห้องใช้สูงสุด
    var topK = 'E', lastR = cur.reduce(function (m, r) { return r.round > m ? r.round : m; }, '');
    var drawTop = function () {
      var L = []; cur.filter(function (r) { return r.round === lastR && r.kind === topK; }).forEach(function (r) { (r.top || []).forEach(function (t) { L.push({ bld: r.bld, room: t[0], units: +t[1], amt: +t[2], st: t[3] }); }); });
      L.sort(function (a, b) { return b.units - a.units; }); L = L.slice(0, 10);
      var mx = L.length ? L[0].units : 1;
      $('#top-r').textContent = '· รอบ ' + rTh(lastR);
      $('#d-top').innerHTML = L.length ? L.map(function (x, i) { return '<div style="margin:7px 0"><div class="row between small"><span><b>' + (i + 1) + '.</b> ' + esc(bldOf(x.bld).short) + ' ห้อง ' + esc(x.room) + (x.st && x.st !== 'OCC' ? ' <span class="tag warn">' + MST_TH[x.st] + '</span>' : '') + '</span><span><b>' + nf(x.units) + '</b> หน่วย · ' + baht(x.amt) + ' บาท</span></div><div class="bar ' + (topK === 'E' ? 'e' : '') + '"><i style="width:' + pct(x.units, mx) + '%"></i></div></div>'; }).join('') : emptyHtml('ไม่มีข้อมูลรายห้อง (ข้อมูลประวัติจากไฟล์เดิมไม่มีรายละเอียดรายห้อง)', 'info');
    };
    $$('#top-k button').forEach(function (b) { b.onclick = function () { topK = b.dataset.k; $$('#top-k button').forEach(function (x) { x.className = x === b ? 'on' + (topK === 'E' ? ' e' : '') : ''; }); drawTop(); }; });
    drawTop();
    // ตาราง heat
    var hr = monthsBetween(rng[0], rng[1]).filter(function (r) { return rounds[r]; });
    var mxv = 0, cell = {}; bs.forEach(function (b) { hr.forEach(function (r) { var v = useRows.filter(function (x) { return x.bld === b.id && x.round === r; }).reduce(function (s, x) { return s + x.billed; }, 0); cell[b.id + r] = v; mxv = Math.max(mxv, v); }); });
    $('#d-heat').innerHTML = '<table class="t heat"><thead><tr><th>ที่พัก</th>' + hr.map(function (r) { return '<th class="n">' + rTh(r) + '</th>'; }).join('') + '<th class="n">รวม</th></tr></thead><tbody>' +
      bs.map(function (b) { var tot = 0; return '<tr><td><b>' + esc(b.short) + '</b></td>' + hr.map(function (r) { var v = cell[b.id + r]; tot += v; var a = mxv ? v / mxv : 0; return '<td class="h" style="background:rgba(11,132,198,' + (0.06 + a * 0.5).toFixed(2) + ')">' + (v ? nf(Math.round(v)) : '-') + '</td>'; }).join('') + '<td class="h"><b>' + nf(Math.round(tot)) + '</b></td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td>รวม</td>' + hr.map(function (r) { return '<td class="n">' + nf(Math.round(bs.reduce(function (s, b) { return s + cell[b.id + r]; }, 0))) + '</td>'; }).join('') + '<td class="n">' + nf(Math.round(A.billed)) + '</td></tr></tfoot></table>';
    // สรุปผู้บริหาร
    var topB = bs.slice().sort(function (a, b) { return bsum(b) - bsum(a); })[0];
    var ex = [];
    ex.push('ยอดเรียกเก็บค่าน้ำ–ค่าไฟรวม <b>' + baht(A.billed) + ' บาท</b> ใน ' + A.nRounds + ' รอบ' + (B.billed ? ' (' + (A.billed >= B.billed ? 'เพิ่มขึ้น ' : 'ลดลง ') + Math.abs((A.billed - B.billed) / B.billed * 100).toFixed(1) + '% จากช่วงก่อนหน้า)' : ''));
    if (F.kind === '*') ex.push('แบ่งเป็นค่าไฟ <b>' + baht(A.aE) + '</b> บาท (' + pct(A.aE, A.aE + A.aW) + '%) และค่าน้ำ <b>' + baht(A.aW) + '</b> บาท (' + pct(A.aW, A.aE + A.aW) + '%)');
    ex.push('หักผ่านเงินเดือน (HRMi) <b>' + baht(A.deducted) + ' บาท</b> คิดเป็น ' + pct(A.deducted, A.billed) + '% · ชำระเงินสด ' + baht(A.cash) + ' บาท · ไม่หัก ' + baht(A.excluded) + ' บาท');
    if (topB) ex.push('ที่พักที่มียอดสูงสุดคือ <b>' + esc(topB.name) + '</b> ' + baht(bsum(topB)) + ' บาท (' + pct(bsum(topB), A.billed) + '% ของทั้งหมด)');
    if (A.nonCharge + A.unallocated > 0) ex.push('ค่าใช้จ่ายที่โรงพยาบาลรับภาระ (ห้องเวร/ห้องว่าง/ส่วนกลาง และยอดไม่มีผู้รับผิดชอบ) <b>' + baht(A.nonCharge + A.unallocated) + ' บาท</b>');
    $('#d-exec').innerHTML = '<h3>' + ic('sparkle') + ' สรุปสำหรับผู้บริหาร — ' + esc(periodLabel(F)) + '</h3><ul>' + ex.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    $('#d-xls').onclick = function () { dashExcel(F, useRows, rng); };
  };
  function bind() {
    var sel = $('#df-sel'), opt = function (L, v, f) { return L.map(function (x) { return '<option value="' + x + '"' + (String(x) === String(v) ? ' selected' : '') + '>' + f(x) + '</option>'; }).join(''); };
    var fyL = Object.keys(fys).sort().reverse(), yL = Object.keys(years).sort().reverse(), rL = RL.slice().reverse();
    if (F.mode === 'month') sel.innerHTML = '<select class="inp" id="s-m" style="width:auto">' + opt(rL, F.month, function (x) { return rTh(x, true); }) + '</select>';
    if (F.mode === 'quarter') sel.innerHTML = '<select class="inp" id="s-fy" style="width:auto">' + opt(fyL, F.fy, function (x) { return 'ปีงบ ' + x; }) + '</select><select class="inp" id="s-q" style="width:auto">' + opt([1, 2, 3, 4], F.q, function (x) { return 'ไตรมาส ' + x + ' (' + ['ต.ค.–ธ.ค.', 'ม.ค.–มี.ค.', 'เม.ย.–มิ.ย.', 'ก.ค.–ก.ย.'][x - 1] + ')'; }) + '</select>';
    if (F.mode === 'fy') sel.innerHTML = '<select class="inp" id="s-fy" style="width:auto">' + opt(fyL, F.fy, function (x) { return 'ปีงบประมาณ ' + x; }) + '</select>';
    if (F.mode === 'year') sel.innerHTML = '<select class="inp" id="s-y" style="width:auto">' + opt(yL, F.year, function (x) { return 'ปี ' + x; }) + '</select>';
    if (F.mode === 'range') sel.innerHTML = '<select class="inp" id="s-f" style="width:auto">' + opt(RL, F.from, function (x) { return rTh(x, true); }) + '</select> ถึง <select class="inp" id="s-t" style="width:auto">' + opt(RL, F.to, function (x) { return rTh(x, true); }) + '</select>';
    var on = function (id, k) { var el = $(id); if (el) el.onchange = function () { F[k] = this.value; if (F.from > F.to) { var t = F.from; F.from = F.to; F.to = t; } draw(); }; };
    on('#s-m', 'month'); on('#s-fy', 'fy'); on('#s-q', 'q'); on('#s-y', 'year'); on('#s-f', 'from'); on('#s-t', 'to');
    $$('#df-mode button').forEach(function (b) { b.onclick = function () { F.mode = b.dataset.m; draw(); }; });
    $$('#df-kind button').forEach(function (b) { b.onclick = function () { F.kind = b.dataset.k; draw(); }; });
    $$('.dash-filter .chip').forEach(function (b) { b.onclick = function () { var k = b.dataset.b; if (k === '*') F.blds = {}; else if (F.blds[k]) delete F.blds[k]; else F.blds[k] = 1; draw(); }; });
    if ($('#df-live')) $('#df-live').onchange = function () { F.live = this.checked; draw(); };
  }
  draw();
}
function mkChart(id, cfg) { var el = document.getElementById(id); if (!el || !window.Chart) return; DASH.charts.push(new Chart(el, cfg)); }
function baseOpt(o) {
  Chart.defaults.font.family = "'IBM Plex Sans Thai', sans-serif"; Chart.defaults.color = '#3b4a5e';
  return { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: !o.noLegend, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + (o.money ? baht(c.parsed.y != null && c.chart.options.indexAxis !== 'y' ? c.parsed.y : c.parsed.x) + ' บาท' : nf(c.parsed.y) + ' หน่วย'); } } } },
    scales: { x: { stacked: !!o.stacked, grid: { display: false }, ticks: { color: function (c) { return o.hl && o.hl[c.index] === false ? '#9aa7b8' : '#3b4a5e'; } } }, y: { stacked: !!o.stacked, beginAtZero: true, grid: { color: '#eef2f7' }, ticks: { callback: function (v) { return o.money ? nf(v / 1000) + 'k' : nf(v); } } } } };
}
function donutOpt() { return { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } }, tooltip: { callbacks: { label: function (c) { var t = c.dataset.data.reduce(function (s, v) { return s + v; }, 0); return c.label + ': ' + baht(c.parsed) + ' บาท (' + pct(c.parsed, t) + '%)'; } } } } }; }
function rateTable(rates) {
  if (!rates || !rates.length) return emptyHtml('ยังไม่มีประวัติอัตรา', 'info');
  return '<div class="tbl-wrap" style="max-height:none"><table class="t"><thead><tr><th>ประเภท</th><th class="n">อัตรา</th><th>มีผลตั้งแต่รอบ</th><th>อ้างอิง</th></tr></thead><tbody>' + rates.slice().reverse().map(function (r) { return '<tr><td>' + (r.kind === 'W' ? kindIc('W') + ' ค่าน้ำ' : r.kind === 'E' ? kindIc('E') + ' ค่าไฟ' : ic('tool') + ' ค่าเหมามิเตอร์เสีย') + '</td><td class="n"><b>' + nf(r.rate) + '</b> บาท' + (r.kind === 'FLAT' ? '' : '/หน่วย') + '</td><td>' + rTh(r.from, true) + '</td><td class="small">' + esc(r.ref) + '</td></tr>'; }).join('') + '</tbody></table></div>';
}
function dashExcel(F, rows, rng) {
  var L = rows.filter(function (r) { return r.round >= rng[0] && r.round <= rng[1]; }).sort(function (a, b) { return a.round < b.round ? -1 : a.round > b.round ? 1 : (bldOf(a.bld).sort - bldOf(b.bld).sort); });
  var a = [['SOMDEJ U-Bill · สรุปแดชบอร์ด ' + periodLabel(F)], ['ส่งออกเมื่อ ' + thDate(new Date().toISOString()) + ' โดย ' + (S.me.name || S.me.empCode)], [],
    ['รอบ (เดือนที่หัก)', 'ประเภท', 'ที่พัก', 'มิเตอร์', 'หน่วยใช้', 'ยอดเรียกเก็บ', 'หักเงินเดือน', 'จำนวนคน', 'เงินสด', 'ไม่หัก', 'ไม่มีผู้รับผิดชอบ', 'ไม่เรียกเก็บ', 'มิเตอร์เสีย', 'แหล่งข้อมูล']];
  L.forEach(function (r) { a.push([r.round, KIND_TH[r.kind], bldOf(r.bld).name, r.meters, r2(r.units), r2(r.billed), r2(r.deducted), r.persons, r2(r.cash), r2(r.excluded), r2(r.unallocated), r2(r.nonCharge), r.broken, { SYSTEM: 'ระบบ (ล็อกแล้ว)', HISTORY: 'ไฟล์เดิม', LIVE: 'รอบปัจจุบัน (ยังไม่ล็อก)' }[r.source] || r.source]); });
  var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XIO.sheet(a, [14, 8, 24, 8, 11, 14, 14, 9, 12, 12, 14, 14, 10, 20]), 'สรุป');
  XIO.save(wb, 'U-Bill_แดชบอร์ด_' + nowStamp() + '.xlsx');
}
