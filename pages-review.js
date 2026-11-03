/* SOMDEJ U-Bill — pages-review.js : ตรวจสอบรอบ (สรุป · แจ้งเตือน · รายคน · ไม่หัก/เงินสด) และศูนย์ส่งออกไฟล์ */
PAGES.review = function (args) {
  var rid = args[0] || '', tab = args[1] || 'sum';
  var pg = shell('ตรวจสอบ & ส่งออก', 'ผลคำนวณจากหลังบ้าน (แหล่งเดียวกับไฟล์ Import HRMi)');
  pg.innerHTML = loadingHtml('กำลังคำนวณ…');
  Promise.all([api('getCharges', { round: rid }), loadMaster()]).then(function (res) {
    var ch = res[0];
    if (!ch.round) { pg.innerHTML = emptyHtml('ยังไม่มีรอบ', 'calendar'); return; }
    ch.M = ch.meters.map(function (a) { return { id: a[0], kind: a[1], bld: a[2], floor: a[3], room: a[4], label: a[5], status: a[6], prev: a[7], curr: a[8], reset: a[9], broken: a[10], usage: a[11], amount: a[12], unalloc: a[13], occDays: a[14], exempt: a[15], exemptReason: a[16], alerts: a[17], payers: a[18], note: a[19], avg: a[20], newRoom: a[21], by: a[22], at: a[23], src: a[24] }; });
    ch.P = ch.persons.map(function (a) { return { kind: a[0], bld: a[1], empCode: a[2], name: a[3], payType: a[4], amount: a[5], include: a[6], reason: a[7], api: a[8], apiName: a[9], group: a[10], warn: a[11], rooms: a[12], ovr: a[13], days: a[14], cashCode: a[15] }; });
    renderReview(pg, ch, tab);
  }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + ic('alert') + esc(e.message) + '</div>'; });
};
function renderReview(pg, ch, tab) {
  var rd = ch.round, T = ch.totals;
  var alerts = []; ch.M.forEach(function (m) { m.alerts.forEach(function (a) { alerts.push({ m: m, a: a }); }); });
  var errN = alerts.filter(function (x) { return x.a.t === 'ERR'; }).length, alN = alerts.filter(function (x) { return x.a.t !== 'MISS'; }).length;
  var exc = ch.P.filter(function (p) { return p.payType === 'EMP' && !p.include; }), cash = ch.P.filter(function (p) { return p.payType === 'CASH'; });
  var warnP = ch.P.filter(function (p) { return p.payType === 'EMP' && (p.warn || p.api === 'UNCHECKED'); });
  var tabs = [['sum', 'สรุป', ''], ['alerts', 'แจ้งเตือน', alN ? '<span class="cnt ' + (errN ? 'r' : '') + '">' + alN + '</span>' : ''], ['people', 'รายคน (หักเงินเดือน)', '<span class="cnt">' + ch.P.filter(function (p) { return p.payType === 'EMP'; }).length + '</span>'],
    ['excl', 'ไม่หัก / เงินสด', '<span class="cnt">' + (exc.length + cash.length) + '</span>'], ['meters', 'รายมิเตอร์', ''], ['export', 'ส่งออกไฟล์', '']];
  pg.innerHTML = '<div class="card flat"><div class="row between"><div><b style="font-family:var(--font-head);font-size:18px">รอบ ' + esc(rTh(rd.id, true)) + '</b> <span class="muted small">รหัสงาน ' + esc(rd.id) + ' · หน่วยใช้ ' + esc(rd.usageTh) + '</span><div class="mt8">' + roundBadge(rd) + (rd.apiCheckedAt ? ' <span class="tag ok">' + ic('shield') + ' ตรวจ API ' + thDate(rd.apiCheckedAt) + '</span>' : ' <span class="tag warn">ยังไม่ตรวจกับ SmartAPI</span>') + '</div></div>' +
    '<div class="row"><select class="inp" id="rv-r" style="width:auto">' + S.boot.rounds.map(function (x) { return '<option value="' + x.id + '"' + (x.id === rd.id ? ' selected' : '') + '>' + rTh(x.id, true) + '</option>'; }).join('') + '</select>' +
    (rd.status !== 'LOCKED' ? '<button class="btn" id="rv-api">' + ic('refresh') + ' ตรวจสถานะกับ SmartAPI</button>' : '') + '<button class="btn" id="rv-re">' + ic('refresh') + ' คำนวณใหม่</button>' +
    (isHR() && rd.status !== 'LOCKED' ? '<button class="btn ok" id="rv-lock">' + ic('lock') + ' ล็อกรอบ</button>' : '') + '</div></div></div>' +
    '<div class="tabs mt12" id="rv-tabs">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + ' ' + t[2] + '</button>'; }).join('') + '</div><div id="rv-body"></div>';
  $('#rv-r').onchange = function () { location.hash = '#/review/' + this.value + '/' + tab; };
  $$('#rv-tabs button').forEach(function (b) { b.onclick = function () { tab = b.dataset.t; history.replaceState(null, '', '#/review/' + rd.id + '/' + tab); $$('#rv-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); body(); }; });
  $('#rv-re').onclick = function () { route(); };
  if ($('#rv-api')) $('#rv-api').onclick = function () { var btn = this; busy(btn, true, 'กำลังตรวจ…'); api('checkApi', { round: rd.id }).then(function (d) { toast('ตรวจแล้ว ' + d.checked + ' คน · ไม่พบ/พ้นสภาพ ' + d.notFound.length + ' คน', d.notFound.length ? 'warn' : 'ok', 6000); route(); }).catch(function (e) { busy(btn, false); errToast(e); }); };
  if ($('#rv-lock')) $('#rv-lock').onclick = function () { doLock(rd, false, this); };
  var B = $('#rv-body');
  function body() {
    if (tab === 'sum') return sumTab();
    if (tab === 'alerts') return alertTab();
    if (tab === 'people') return peopleTab(ch.P.filter(function (p) { return p.payType === 'EMP'; }), true);
    if (tab === 'excl') return exclTab();
    if (tab === 'meters') return meterTab();
    if (tab === 'export') return exportTab(B, rd, T);
  }
  function sumTab() {
    var by = {};
    ch.M.forEach(function (m) {
      var k = m.bld + '|' + m.kind, s = by[k] = by[k] || { bld: m.bld, kind: m.kind, meters: 0, read: 0, units: 0, billed: 0, nonCharge: 0, unalloc: 0, broken: 0 };
      s.meters++; if (m.curr != null || m.broken) s.read++; if (m.usage != null) s.units += m.usage; if (m.broken) s.broken++;
      if (m.status === 'OCC' && !m.exempt) { s.billed += m.amount; s.unalloc += m.unalloc; } else s.nonCharge += m.amount;
    });
    ch.P.forEach(function (p) { var s = by[p.bld + '|' + p.kind]; if (!s) return; s.ded = (s.ded || 0) + (p.payType === 'EMP' && p.include ? p.amount : 0); s.exc = (s.exc || 0) + (p.payType === 'EMP' && !p.include ? p.amount : 0); s.cash = (s.cash || 0) + (p.payType === 'CASH' ? p.amount : 0); s.n = (s.n || 0) + (p.payType === 'EMP' && p.include ? 1 : 0); });
    var rows = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return (bldOf(a.bld).sort - bldOf(b.bld).sort) || (a.kind < b.kind ? 1 : -1); });
    var tot = rows.reduce(function (t, s) { ['meters', 'read', 'units', 'billed', 'ded', 'exc', 'cash', 'unalloc', 'nonCharge', 'n', 'broken'].forEach(function (f) { t[f] = (t[f] || 0) + (s[f] || 0); }); return t; }, {});
    B.innerHTML = '<div class="grid g4">' + kpi('ยอดเรียกเก็บรวม', baht(T.billed.W + T.billed.E), 'บาท', ic('drop', 'w-ic') + ' ' + baht(T.billed.W) + ' · ' + ic('bolt', 'e-ic') + ' ' + baht(T.billed.E), 'var(--water-soft)', 'cash') +
      kpi('ส่ง HRMi (หักเงินเดือน)', baht(T.deducted.W + T.deducted.E), 'บาท', nf(T.persons - T.personsExcluded) + ' คน', 'var(--ok-soft)', 'check') +
      kpi('ไม่หัก / เงินสด', baht(T.excluded.W + T.excluded.E + T.cash.W + T.cash.E), 'บาท', 'ไม่หัก ' + baht(T.excluded.W + T.excluded.E) + ' · สด ' + baht(T.cash.W + T.cash.E), 'var(--elec-soft)', 'cash') +
      kpi('ไม่มีผู้รับผิดชอบ', baht(T.unallocated.W + T.unallocated.E), 'บาท', 'ห้องว่างบางช่วง/ไม่มีผู้จ่าย · ไม่เรียกเก็บ ' + baht(T.nonCharge.W + T.nonCharge.E), 'var(--danger-soft)', 'alert') + '</div>' +
      '<div class="tbl-wrap mt16" style="max-height:none"><table class="t"><thead><tr><th>ที่พัก</th><th>ประเภท</th><th class="n">จด/ทั้งหมด</th><th class="n">หน่วยใช้</th><th class="n">ยอดเรียกเก็บ</th><th class="n">หัก HRMi</th><th class="n">คน</th><th class="n">ไม่หัก</th><th class="n">เงินสด</th><th class="n">ไม่มีผู้รับผิดชอบ</th><th class="n">ไม่เรียกเก็บ</th></tr></thead><tbody>' +
      rows.map(function (s) { return '<tr><td>' + esc(bldOf(s.bld).name) + '</td><td>' + kindIc(s.kind) + ' ' + KIND_TH[s.kind] + '</td><td class="n">' + s.read + '/' + s.meters + '</td><td class="n">' + nf(s.units) + '</td><td class="n">' + baht(s.billed) + '</td><td class="n"><b>' + baht(s.ded || 0) + '</b></td><td class="n">' + nf(s.n || 0) + '</td><td class="n">' + baht(s.exc || 0) + '</td><td class="n">' + baht(s.cash || 0) + '</td><td class="n">' + (s.unalloc ? '<span style="color:var(--danger)">' + baht(s.unalloc) + '</span>' : '0.00') + '</td><td class="n">' + baht(s.nonCharge) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="2">รวม</td><td class="n">' + tot.read + '/' + tot.meters + '</td><td class="n">' + nf(tot.units) + '</td><td class="n">' + baht(tot.billed) + '</td><td class="n">' + baht(tot.ded) + '</td><td class="n">' + nf(tot.n) + '</td><td class="n">' + baht(tot.exc) + '</td><td class="n">' + baht(tot.cash) + '</td><td class="n">' + baht(tot.unalloc) + '</td><td class="n">' + baht(tot.nonCharge) + '</td></tr></tfoot></table></div>' +
      '<p class="tiny muted mt8">อัตรา น้ำ ' + nf(ch.rates.W) + ' · ไฟ ' + nf(ch.rates.E) + ' บาท/หน่วย · มิเตอร์เสีย ' + nf(ch.rates.FLAT) + ' บาท · ' + ch.D + ' วัน · หารตามคน×วันที่พัก ปัดขึ้น 2 ตำแหน่ง · คำนวณเมื่อ ' + thDate(ch.at) + '</p>' +
      (warnP.length ? '<div class="note warn mt12">' + ic('alert') + '<div>มี ' + warnP.length + ' รายการที่ควรตรวจ (ยังไม่ตรวจกับ API / กลุ่มที่ HRMi มักถอยรายการ) — ดูแท็บ "รายคน" ตัวกรอง "ควรตรวจ"</div></div>' : '');
  }
  function alertTab() {
    var f = B._f || 'ALL';
    var L = alerts.filter(function (x) { return f === 'ALL' ? x.a.t !== 'MISS' : x.a.t === f; });
    var cnt = function (t) { return alerts.filter(function (x) { return x.a.t === t; }).length; };
    B.innerHTML = '<div class="seg" id="al-f">' + [['ALL', 'ทั้งหมด'], ['ERR', 'ผิดพลาด (' + cnt('ERR') + ')'], ['UNASSIGNED', 'ไม่มีผู้รับผิดชอบ (' + cnt('UNASSIGNED') + ')'], ['HIGH', 'ใช้สูงผิดปกติ (' + cnt('HIGH') + ')'], ['ZERO', 'ใช้ 0 (' + cnt('ZERO') + ')'], ['MISS', 'ยังไม่จด (' + cnt('MISS') + ')']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (L.length ? '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>ที่พัก</th><th>ห้อง</th><th>ประเภท</th><th>รายการ</th><th class="n">ก่อน</th><th class="n">หลัง</th><th class="n">หน่วย</th><th class="n">ยอด</th><th></th></tr></thead><tbody>' +
        L.map(function (x) { var m = x.m, t = x.a.t; return '<tr class="' + (t === 'ERR' ? 'err' : '') + '"><td>' + esc(bldOf(m.bld).short) + '</td><td><b>' + esc(m.room) + '</b>' + (m.label !== '1' ? ' <span class="tag">' + esc(m.label) + '</span>' : '') + '</td><td>' + kindIc(m.kind) + '</td><td><span class="tag ' + (t === 'ERR' ? 'danger' : t === 'HIGH' ? 'warn' : t === 'UNASSIGNED' ? 'violet' : '') + '">' + ({ ERR: 'ผิดพลาด', UNASSIGNED: 'ผู้รับผิดชอบ', HIGH: 'สูงผิดปกติ', ZERO: 'ใช้ 0', MISS: 'ยังไม่จด' }[t]) + '</span> ' + esc(x.a.m) + '</td><td class="n">' + (m.prev != null ? nf(m.prev) : '-') + '</td><td class="n">' + (m.broken ? 'เสีย' : m.curr != null ? nf(m.curr) : '-') + '</td><td class="n">' + (m.usage != null ? nf(m.usage) : '-') + '</td><td class="n">' + baht(m.amount) + '</td>' +
          '<td class="nowrap">' + (canEdit() ? '<button class="btn sm" data-fix="' + esc(m.id) + '">แก้เลข</button> <button class="btn sm ghost" data-room="' + esc(m.bld + '|' + m.room) + '">ผู้พัก</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="mt12">' + emptyHtml('ไม่มีรายการ', 'check') + '</div>');
    $$('#al-f button').forEach(function (b) { b.onclick = function () { B._f = b.dataset.f; alertTab(); }; });
    $$('[data-fix]', B).forEach(function (b) { b.onclick = function () { loadRound(rd.id, true).then(function () { bindReadings(); readingMoreDialog(S.master.byId[b.dataset.fix], rd, function () { route(); }); }); }; });
    $$('[data-room]', B).forEach(function (b) { b.onclick = function () { roomDialog(b.dataset.room, function () { }); }; });
  }
  function peopleTab(list, emp) {
    var f = B._pf || 'ALL', q = B._pq || '';
    var L = list.filter(function (p) { return f === 'ALL' || (f === 'INC' && p.include) || (f === 'EXC' && !p.include) || (f === 'WARN' && (p.warn || p.api === 'UNCHECKED')) || (f === 'OVR' && p.ovr); });
    if (q) L = L.filter(function (p) { return p.name.indexOf(q) >= 0 || p.empCode.indexOf(q) >= 0 || String(p.rooms).indexOf(q) >= 0; });
    var sum = L.reduce(function (s, p) { return s + (p.include ? p.amount : 0); }, 0);
    B.innerHTML = '<div class="row"><div class="seg" id="pf">' + [['ALL', 'ทั้งหมด'], ['INC', 'หัก'], ['EXC', 'ไม่หัก'], ['WARN', 'ควรตรวจ'], ['OVR', 'HR กำหนดเอง']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div><input class="inp" id="pq" placeholder="ค้นหาชื่อ / รหัส / ห้อง" style="max-width:240px" value="' + esc(q) + '"><span class="grow"></span><span class="small">' + nf(L.length) + ' รายการ · หัก ' + baht(sum) + ' บาท</span></div>' +
      '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ที่พัก</th><th>ประเภท</th><th>ห้อง</th><th class="n">วัน</th><th class="n">ยอด</th><th>สถานะ API</th><th>ผล</th>' + (isHR() && rd.status !== 'LOCKED' ? '<th></th>' : '') + '</tr></thead><tbody>' +
      L.slice(0, 1500).map(function (p) {
        var apiT = p.api === 'ACTIVE' ? '<span class="tag ok">ปฏิบัติงาน</span>' : p.api === 'NOT_FOUND' ? '<span class="tag danger">ไม่พบ/พ้นสภาพ</span>' : '<span class="tag">ยังไม่ตรวจ</span>';
        var nameDiff = p.apiName && p.apiName.replace(/\s+/g, '') !== p.name.replace(/\s+/g, '');
        return '<tr class="' + (p.include ? '' : 'err') + '"><td>' + esc(p.empCode) + '</td><td>' + esc(p.name) + (nameDiff ? '<div class="tiny" style="color:var(--warn)">API: ' + esc(p.apiName) + '</div>' : '') + (p.group ? '<div class="tiny muted">' + esc(p.group) + '</div>' : '') + '</td><td>' + esc(bldOf(p.bld).short) + '</td><td>' + kindIc(p.kind) + '</td><td class="small">' + esc(p.rooms) + '</td><td class="n">' + p.days + '</td><td class="n"><b>' + baht(p.amount) + '</b></td><td>' + apiT + (p.warn ? '<div class="tiny" style="color:var(--warn)">' + esc(p.warn) + '</div>' : '') + '</td>' +
          '<td>' + (p.include ? '<span class="tag ok">หัก</span>' : '<span class="tag danger">ไม่หัก</span>') + (p.reason ? '<div class="tiny muted">' + esc(p.reason) + '</div>' : '') + '</td>' +
          (isHR() && rd.status !== 'LOCKED' ? '<td class="nowrap"><button class="btn sm" data-ov="' + esc(p.empCode) + '" data-inc="' + (p.include ? 0 : 1) + '">' + (p.include ? 'ไม่หัก' : 'ให้หัก') + '</button>' + (p.ovr ? ' <button class="btn sm ghost" data-clr="' + esc(p.empCode) + '" title="ล้างค่าที่ HR กำหนด">' + ic('undo') + '</button>' : '') + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
    $$('#pf button').forEach(function (b) { b.onclick = function () { B._pf = b.dataset.f; peopleTab(list, emp); }; });
    $('#pq').oninput = debounce(function () { B._pq = $('#pq').value; peopleTab(list, emp); var el = $('#pq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 350);
    $$('[data-ov]', B).forEach(function (b) {
      b.onclick = function () {
        var inc = b.dataset.inc === '1';
        promptBox(inc ? 'ให้หักเงินเดือน รหัส ' + b.dataset.ov : 'ไม่หักเงินเดือน รหัส ' + b.dataset.ov, 'เหตุผล (บันทึกในไฟล์ตรวจสอบ)', { placeholder: inc ? 'เช่น ตรวจแล้วยังปฏิบัติงาน' : 'เช่น ลาออก 1 ต.ค. 69 / ลาศึกษา' })
          .then(function (v) { if (v) api('setOverride', { round: rd.id, empCode: b.dataset.ov, include: inc, reason: v }).then(function () { toast('บันทึกแล้ว', 'ok'); route(); }).catch(errToast); });
      };
    });
    $$('[data-clr]', B).forEach(function (b) { b.onclick = function () { api('setOverride', { round: rd.id, empCode: b.dataset.clr, include: null }).then(function () { route(); }).catch(errToast); }; });
  }
  function exclTab() {
    var cs = cash.reduce(function (s, p) { return s + p.amount; }, 0), es = exc.reduce(function (s, p) { return s + p.amount; }, 0);
    B.innerHTML = '<h3 style="margin:4px 0 10px">' + ic('alert') + ' ไม่หักเงินเดือน (' + exc.length + ' รายการ · ' + baht(es) + ' บาท)</h3>' + simpleTable(exc, true) +
      '<h3 style="margin:22px 0 10px">' + ic('cash') + ' ชำระเงินสด — นิสิตแพทย์/แพทย์ฝึกหัด (' + cash.length + ' รายการ · ' + baht(cs) + ' บาท)</h3>' + simpleTable(cash, false) +
      '<p class="tiny muted mt8">รายการเหล่านี้ไม่อยู่ในไฟล์ Import HRMi · อยู่ในไฟล์ตรวจสอบ ชีท "ไม่หัก" และ "เงินสด" สำหรับตามเก็บ</p>';
  }
  function simpleTable(L, emp) {
    if (!L.length) return emptyHtml('ไม่มีรายการ', 'check');
    return '<div class="tbl-wrap" style="max-height:340px"><table class="t"><thead><tr><th>' + (emp ? 'รหัส' : 'อ้างอิง') + '</th><th>ชื่อ</th><th>ที่พัก</th><th>ประเภท</th><th>ห้อง</th><th class="n">ยอด</th><th>เหตุผล</th></tr></thead><tbody>' +
      L.map(function (p) { return '<tr><td>' + esc(p.empCode || p.cashCode || '') + '</td><td>' + esc(p.name) + '</td><td>' + esc(bldOf(p.bld).short) + '</td><td>' + kindIc(p.kind) + '</td><td class="small">' + esc(p.rooms) + '</td><td class="n">' + baht(p.amount) + '</td><td class="small">' + esc(p.reason) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function meterTab() {
    var b = B._mb || (S.boot.buildings[0] || {}).id, k = B._mk || 'E';
    var L = ch.M.filter(function (m) { return m.bld === b && m.kind === k; });
    B.innerHTML = '<div class="row"><select class="inp" id="mt-b" style="width:auto">' + S.boot.buildings.map(function (x) { return '<option value="' + x.id + '"' + (x.id === b ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select><div class="seg" id="mt-k"><button data-k="E" class="' + (k === 'E' ? 'on e' : '') + '">ค่าไฟ</button><button data-k="W" class="' + (k === 'W' ? 'on' : '') + '">ค่าน้ำ</button></div></div>' +
      '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>ห้อง</th><th>สถานะ</th><th class="n">ก่อน</th><th class="n">หลัง</th><th class="n">หน่วย</th><th class="n">ยอด</th><th>ผู้จ่าย (วัน · บาท)</th><th class="n">ไม่มีผู้รับผิดชอบ</th><th>บันทึกโดย</th></tr></thead><tbody>' +
      L.map(function (m) { return '<tr class="' + (m.alerts.some(function (a) { return a.t === 'ERR'; }) ? 'err' : '') + '"><td><b>' + esc(m.room) + '</b>' + (m.label !== '1' ? ' <span class="tag">' + esc(m.label) + '</span>' : '') + '</td><td>' + (m.status !== 'OCC' ? '<span class="tag warn">' + MST_TH[m.status] + '</span>' : m.exempt ? '<span class="tag violet" title="' + esc(m.exemptReason) + '">ยกเว้น</span>' : '') + '</td><td class="n">' + (m.prev != null ? nf(m.prev) : '-') + '</td><td class="n">' + (m.broken ? '<span class="tag warn">เสีย</span>' : m.curr != null ? nf(m.curr) : '<span class="muted">-</span>') + '</td><td class="n">' + (m.usage != null ? nf(m.usage) : '') + '</td><td class="n">' + baht(m.amount) + '</td>' +
        '<td class="small">' + m.payers.map(function (x) { return esc(x[1]) + ' <span class="muted">' + x[3] + 'ว · ' + baht(x[4]) + (x[2] === 'CASH' ? ' สด' : '') + '</span>'; }).join('<br>') + '</td><td class="n">' + (m.unalloc ? baht(m.unalloc) : '') + '</td><td class="tiny muted">' + (m.at ? thDate(m.at) + '<br>' + esc(m.by) + ' · ' + esc(m.src) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    $('#mt-b').onchange = function () { B._mb = this.value; meterTab(); };
    $$('#mt-k button').forEach(function (x) { x.onclick = function () { B._mk = x.dataset.k; meterTab(); }; });
  }
  body();
}
function exportTab(B, rd, T) {
  var locked = rd.status === 'LOCKED';
  B.innerHTML = '<div class="grid g2">' +
    '<div class="card"><h3>' + ic('zip') + ' ไฟล์ Import HRMi</h3><p class="small muted">ตามรูปแบบเดิม (ชีท Import · 7 คอลัมน์) · ค่าน้ำ ' + esc(S.boot.settings.hrmiCodeW) + ' · ค่าไฟ ' + esc(S.boot.settings.hrmiCodeE) + ' · รหัสงาน ' + esc(rd.id) + '<br>แยกไฟล์รายหอ (คนเดียวหลายห้องในหอเดียว = รวม 1 แถว) + ไฟล์รวมทุกหอ · ประทับเวลาในชื่อไฟล์</p>' +
    (locked ? '' : '<div class="note warn">' + ic('lock') + '<div>ต้องล็อกรอบก่อน จึงส่งออกไฟล์ Import HRMi ได้' + (isHR() ? '' : ' (เฉพาะ HR)') + '</div></div>') +
    '<div class="row mt12"><button class="btn amber" data-x="HRMI" ' + (locked && isHR() ? '' : 'disabled') + '>' + ic('download') + ' ดาวน์โหลดชุด Import HRMi (.zip)</button></div></div>' +
    '<div class="card"><h3>' + ic('file') + ' ไฟล์ตรวจสอบ / หลักฐาน</h3><p class="small muted">สรุป · รายละเอียดรายมิเตอร์ · รายคน · ไม่หัก · เงินสด · แจ้งเตือน · สรุปแยกหอ (รูปแบบเดิมของฝ่ายอาคาร) · ส่งออกได้ทุกเวลา ' + (locked ? '' : '(<b>ฉบับร่าง</b> จนกว่าจะล็อก)') + ' · ประทับวันเวลา/ผู้ส่งออก/ฉบับที่ ทุกครั้ง</p>' +
    '<div class="row mt12"><button class="btn primary" data-x="CHECK">' + ic('download') + ' ไฟล์ตรวจสอบ (.xlsx)</button><button class="btn" data-x="TEMPLATE">' + ic('download') + ' แม่แบบจดมิเตอร์รอบนี้</button></div></div></div>' +
    '<div class="card mt16"><h3>' + ic('history') + ' ประวัติการส่งออกของรอบนี้</h3><div id="ex-log">' + loadingHtml() + '</div></div>';
  $$('[data-x]', B).forEach(function (b) { b.onclick = function () { exportFile(b.dataset.x, b, rd.id).then(function () { loadLog(); }); }; });
  function loadLog() {
    api('listExports', { round: rd.id }).then(function (L) {
      $('#ex-log').innerHTML = L.length ? '<div class="tbl-wrap" style="max-height:300px"><table class="t"><thead><tr><th>ฉบับ</th><th>ชนิด</th><th>ไฟล์</th><th class="n">แถว</th><th class="n">ยอด</th><th>สถานะรอบ</th><th>โดย</th><th>เวลา</th></tr></thead><tbody>' +
        L.map(function (x) { return '<tr><td>' + x.version + '</td><td>' + ({ HRMI: '<span class="tag elec">Import HRMi</span>', CHECK: '<span class="tag water">ตรวจสอบ</span>', TEMPLATE: '<span class="tag">แม่แบบ</span>', MASTER: '<span class="tag">ทะเบียน</span>' }[x.type] || x.type) + '</td><td class="small">' + esc(x.file) + '</td><td class="n">' + esc(x.rows) + '</td><td class="n">' + (x.amount ? baht(x.amount) : '') + '</td><td>' + (x.locked === 'TRUE' ? '<span class="tag ok">ล็อก</span>' : '<span class="tag">ร่าง</span>') + '</td><td>' + esc(x.by) + '</td><td>' + thDate(x.at) + '</td></tr>'; }).join('') + '</tbody></table></div>' : emptyHtml('ยังไม่มีการส่งออก', 'file');
    }).catch(function () { });
  }
  loadLog();
}
/** ส่งออกไฟล์ (ทุกชนิด) — ขอข้อมูล + ประทับเลขฉบับจากหลังบ้าน แล้วสร้างไฟล์ในเบราว์เซอร์ */
function exportFile(type, btn, roundId) {
  busy(btn, true, 'กำลังสร้างไฟล์…');
  return api('getExportData', { type: type, round: roundId || (S.round ? S.round.id : '') }).then(function (d) {
    return XIO.build(d).then(function (info) {
      busy(btn, false);
      api('logExport', { round: d.round ? d.round.id : '', version: d.stamp.version, file: info.file, rows: info.rows, amount: info.amount }).catch(function () { });
      toast('ส่งออก ' + info.file + ' แล้ว (ฉบับที่ ' + d.stamp.version + ')', 'ok', 5000);
    });
  }).catch(function (e) { busy(btn, false); errToast(e); });
}
