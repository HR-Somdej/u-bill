/* SOMDEJ U-Bill — pages-master.js : ทะเบียนห้อง · มิเตอร์ · ผู้พัก (ย้ายเข้า/ย้ายออก) */
PAGES.master = function () {
  var pg = shell('มิเตอร์ · ผู้จ่าย', 'ฝ่ายอาคารจัดการย้ายเข้า/ออกได้เอง · ค้นได้ทั้งชื่อและรหัส · ผู้จ่ายรหัส 7 หลักตรวจชื่อกับระบบบุคลากรอัตโนมัติ',
    helpBtn('master') + '<button class="btn" id="m-api">' + ic('refresh') + ' ปรับชื่อทางการ (HRMi)</button><button class="btn" id="m-exp">' + ic('download') + ' ส่งออกทะเบียน</button><button class="btn" id="m-imp">' + ic('upload') + ' นำเข้าทะเบียนจากแม่แบบ</button><button class="btn primary" id="m-add">' + ic('plus') + ' เพิ่มมิเตอร์</button>');
  pg.innerHTML = loadingHtml();
  $('#m-imp').onclick = function () { importReadingsDialog('MASTER'); };
  $('#m-exp').onclick = function () { exportFile('MASTER', this); };
  $('#m-add').onclick = function () { meterDialog(null); };
  $('#m-api').onclick = function () { refreshNamesDialog(this); };
  Promise.all([loadMaster(true), loadRound('')]).then(function () { bindReadings(); renderMaster(pg); }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
};
function roomsOf(bld) {
  var map = {}, order = [];
  S.master.meters.forEach(function (m) {
    if (bld !== '*' && m.bld !== bld) return;
    var k = m.bld + '|' + m.room;
    if (!map[k]) { map[k] = { key: k, bld: m.bld, room: m.room, floor: m.floor, newRoom: m.newRoom, meters: [] }; order.push(map[k]); }
    map[k].meters.push(m);
  });
  return order;
}
function staffTag(code) {
  var s = S.master.staff[code];
  if (!s) return '<span class="tag" title="ยังไม่ตรวจกับ API">?</span>';
  return s[0] ? '<span class="dot ok" title="พบในระบบบุคลากร · ' + esc(s[2] || '') + '"></span>' : '<span class="tag danger" title="ไม่พบในระบบบุคลากร/พ้นสภาพ">ไม่พบ</span>';
}
function renderMaster(pg) {
  var P = readPrefs(); P.mbld = P.mbld || (S.boot.buildings[0] || {}).id || '*';
  var draw = function () {
    savePrefs(P);
    var rooms = roomsOf(P.mbld), q = (P.mq || '').trim();
    var nq = q.replace(/\s+/g, '');
    if (q) rooms = rooms.filter(function (r) { return String(r.room).indexOf(q) >= 0 || r.meters.some(function (m) { return m.curPayers.some(function (a) { return String(a.name).replace(/\s+/g, '').indexOf(nq) >= 0 || String(a.empCode).indexOf(q) >= 0 || String(a.rid).indexOf(q) >= 0; }); }); });
    if (P.mf === 'EMPTY') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.status === 'OCC' && !m.curPayers.length; }); });
    if (P.mf === 'NC') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.status !== 'OCC'; }); });
    if (P.mf === 'CASH') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.curPayers.some(function (a) { return a.payType === 'CASH'; }); }); });
    if (P.mf === 'PEND') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.curPayers.some(function (a) { return a.payType === 'PENDING'; }); }); });
    if (P.mf === 'NF') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.curPayers.some(function (a) { var s = S.master.staff[a.empCode]; return a.payType === 'EMP' && s && !s[0]; }); }); });
    var all = roomsOf(P.mbld), people = {}, cash = {};
    all.forEach(function (r) { r.meters.forEach(function (m) { m.curPayers.forEach(function (a) { if (a.payType === 'EMP') people[a.empCode] = 1; else cash[a.rid || a.name] = 1; }); }); });
    var shown = rooms.slice(0, P.mall ? 5000 : 300);
    pg.innerHTML = '<div class="grid g4">' + kpi('ห้อง/บ้าน', nf(all.length), '', 'มิเตอร์ ' + nf(all.reduce(function (s, r) { return s + r.meters.length; }, 0)) + ' ตัว', 'var(--water-soft)', 'building') +
      kpi('ผู้พัก (หักเงินเดือน)', nf(Object.keys(people).length), 'คน', 'รหัส 7 หลัก', 'var(--ok-soft)', 'users') + kpi('ผู้พักชำระเงินสด', nf(Object.keys(cash).length), 'คน', 'นิสิตแพทย์ / แพทย์ฝึกหัด', 'var(--elec-soft)', 'cash') +
      kpi('ไม่เรียกเก็บ', nf(all.filter(function (r) { return r.meters.some(function (m) { return m.status !== 'OCC'; }); }).length), 'ห้อง', 'ห้องเวร · ว่าง · นานาชาติ · ส่วนกลาง', 'var(--violet-soft)', 'info') + '</div>' +
      '<div class="card flat mt12"><div class="row"><select class="inp" id="mb" style="width:auto">' + S.boot.buildings.map(function (b) { return '<option value="' + b.id + '"' + (b.id === P.mbld ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '<option value="*"' + (P.mbld === '*' ? ' selected' : '') + '>ทุกที่พัก</option></select>' +
      '<input class="inp" id="mq" placeholder="ค้นห้อง / ชื่อ-นามสกุล / รหัส" style="max-width:260px" value="' + esc(P.mq || '') + '">' +
      '<div class="seg" id="mf">' + [['', 'ทั้งหมด'], ['EMPTY', 'ไม่มีผู้จ่าย'], ['NC', 'ไม่เรียกเก็บ'], ['CASH', 'เงินสด'], ['PEND', 'รอรหัส'], ['NF', 'ไม่พบใน API']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + ((P.mf || '') === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<span class="grow"></span><span class="small muted">' + nf(rooms.length) + ' ห้อง</span></div></div>' +
      '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>ห้อง</th><th>ชั้น</th><th>มิเตอร์</th><th>ผู้จ่ายปัจจุบัน</th><th></th></tr></thead><tbody>' +
      shown.map(function (r) {
        var pay = {}; r.meters.forEach(function (m) { m.curPayers.forEach(function (a) { var k = a.rid || (a.payType + (a.empCode || a.name)); pay[k] = pay[k] || { a: a, kinds: [] }; pay[k].kinds.push(m.kind); }); });
        return '<tr><td class="nowrap"><b style="font-size:15px">' + esc(r.room) + '</b>' + (r.newRoom ? ' <span class="muted small">(' + esc(r.newRoom) + ')</span>' : '') + (P.mbld === '*' ? '<div class="tiny muted">' + esc(bldOf(r.bld).short) + '</div>' : '') + '</td><td>' + esc(r.floor || '-') + '</td>' +
          '<td>' + r.meters.map(function (m) { return '<span class="tag ' + (m.kind === 'W' ? 'water' : 'elec') + '" title="' + esc(m.id) + '">' + KIND_SHORT[m.kind] + (m.label !== '1' ? ' ' + esc(m.label === 'ห้องโถง' ? 'โถง' : m.label) : '') + (m.status !== 'OCC' ? ' · ' + MST_TH[m.status] : '') + '</span> '; }).join('') + '</td>' +
          '<td>' + (Object.keys(pay).length ? Object.keys(pay).map(function (k) { var x = pay[k], a = x.a; return '<span class="payer">' + (a.payType === 'EMP' ? staffTag(a.empCode) : a.payType === 'PENDING' ? '<span class="tag warn">รอรหัส</span>' : '<span class="tag elec">สด</span>') + ' ' + esc(a.name) + ' <span class="c">' + esc(a.empCode) + '</span>' + (x.kinds.length < r.meters.length ? ' <span class="tiny muted">(' + x.kinds.map(function (k2) { return KIND_SHORT[k2]; }).join('/') + ')</span>' : '') + '</span>'; }).join('<br>') : '<span class="muted small">—</span>') + '</td>' +
          '<td class="nowrap"><button class="btn sm" data-room="' + esc(r.key) + '">' + ic('edit') + ' จัดการ</button></td></tr>';
      }).join('') + '</tbody></table></div>' + (rooms.length > shown.length ? '<div class="center mt12"><button class="btn" id="m-more">แสดงทั้งหมด ' + nf(rooms.length) + ' ห้อง</button></div>' : '') +
      (!all.length ? '<div class="mt12">' + emptyHtml('ยังไม่มีทะเบียน — กด "นำเข้าทะเบียนจากแม่แบบ"', 'building') + '</div>' : '');
    $('#mb').onchange = function () { P.mbld = this.value; draw(); };
    $('#mq').oninput = debounce(function () { P.mq = $('#mq').value; draw(); var el = $('#mq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 350);
    $$('#mf button').forEach(function (b) { b.onclick = function () { P.mf = b.dataset.f; draw(); }; });
    if ($('#m-more')) $('#m-more').onclick = function () { P.mall = true; draw(); P.mall = false; };
    $$('[data-room]').forEach(function (b) { b.onclick = function () { roomDialog(b.dataset.room, draw); }; });
  };
  draw();
}
/** จัดการห้อง: ข้อมูลห้อง · ผู้พักปัจจุบัน (ย้ายออก/พักการเรียกเก็บ/ข้อมูลติดต่อ/ใส่รหัส) · มิเตอร์และผู้จ่าย · ประวัติผู้พัก */
function roomDialog(key, redraw) {
  var RM = roomModel(), room = RM.byId[key];
  if (!room) return toast('ไม่พบห้อง', 'warn');
  var st = RSTATE[room.state], held = S.master.held || {};
  var html = '<div class="row between"><div class="small muted">' + esc(bldOf(room.bld).name) + ' · ชั้น ' + esc(room.floor || '-') + (room.zone ? ' · ' + esc(room.zone) : '') + ' · <span class="tag ' + st.s + '">' + st.t + '</span>' + (room.statusReason ? ' <span class="small">(' + esc(room.statusReason) + ')</span>' : '') + '</div>' +
    '<div class="row">' + helpBtn('room') + (room.meters.length ? '<button class="btn sm primary" id="rm-in">' + ic('login') + ' ย้ายเข้า</button>' : '') + '<button class="btn sm" id="rm-edit">' + ic('settings') + ' ข้อมูลห้อง</button><button class="btn sm" id="rm-addm">' + ic('plus') + ' เพิ่มมิเตอร์</button></div></div>' +
    '<dl class="kv mt8 small"><dt>ประเภทห้อง</dt><dd>' + esc(room.type || '-') + '</dd><dt>จำนวนเตียง</dt><dd>' + (room.beds != null && room.beds !== '' ? room.beds + ' เตียง · ว่าง ' + room.freeBeds : '-') + '</dd><dt>ห้องสำหรับ</dt><dd>' + ROOMGENDER_TH[room.gender || ''] + '</dd>' + (room.note ? '<dt>หมายเหตุ</dt><dd>' + esc(room.note) + '</dd>' : '') + '</dl>';
  html += '<h4 class="mt16">' + ic('users') + ' ผู้พักปัจจุบัน (' + room.people.length + ')</h4>' + (room.people.length ? room.people.map(function (p) {
    return '<div class="card flat mt8" style="padding:10px 12px"><div class="row between"><div><b>' + esc(p.name) + '</b> <span class="tiny muted">' + esc(p.rid || '') + '</span> ' +
      (p.rtype === 'EMP' ? '<span class="tag ok">หักเงินเดือน ' + esc(p.empCode) + '</span>' : p.rtype === 'PENDING' ? '<span class="tag warn">รอรหัสพนักงาน</span>' : '<span class="tag elec">ชำระเงินสด' + (p.group ? ' · ' + esc(p.group) : '') + '</span>') +
      (p.leave ? ' <span class="tag violet">' + ic('calendar') + ' ' + esc(p.leave.reason) + ' ' + thDate(p.leave.from, false) + ' – ' + (p.leave.to ? thDate(p.leave.to, false) : 'ไม่กำหนด') + '</span>' : '') +
      (held[p.rid] ? ' <span class="tag warn" title="ยอดพักไว้ (หักย้อนหลังเมื่อได้รหัส)">ยอดพักไว้ ' + baht(held[p.rid]) + '</span>' : '') +
      '<div class="tiny muted">' + [GENDER_TH[p.gender] || '', p.position, p.division].filter(Boolean).map(esc).join(' · ') + ' · เข้าพัก ' + thDate(p.start, false) + '</div></div>' +
      '<div class="row"><button class="btn sm ghost" data-pii="' + esc(p.rid) + '" title="ข้อมูลติดต่อ (ข้อมูลส่วนบุคคล)">' + ic('eye') + ((p.cf & 1) ? '' : ' <span class="tag">ไม่มีเบอร์</span>') + ((p.cf & 2) ? '' : ' <span class="tag">ไม่มีอีเมล</span>') + '</button>' +
      (p.rtype !== 'EMP' ? '<button class="btn sm amber" data-code="' + esc(p.rid) + '" title="' + (p.rtype === 'PENDING' ? 'ได้รหัสพนักงานแล้ว' : 'บันทึกผิดเป็นเงินสด แต่เป็นบุคลากร → เปลี่ยนเป็นหักเงินเดือน') + '">' + ic('key') + ' ใส่รหัส</button>' : '') +
      (p.rtype !== 'EMP' ? '<button class="btn sm" data-act="' + esc(p.rid) + '" title="ออกรหัสให้ผู้พักเข้าดูยอดของตนเอง">' + ic('link') + ' รหัสดูยอด' + (p.acct === 'SET' ? ' ✓' : '') + '</button>' : '') +
      '<button class="btn sm" data-leave="' + esc(p.rid) + '">' + ic('calendar') + ' พักการเรียกเก็บ</button><button class="btn sm" data-res="' + esc(p.rid) + '">' + ic('user') + '</button>' +
      '<button class="btn sm warn" data-outp="' + esc(p.rid) + '">' + ic('out') + ' ย้ายออก</button></div></div></div>';
  }).join('') : '<div class="muted small mt8">ไม่มีผู้พัก</div>');
  html += '<h4 class="mt16">' + ic('gauge') + ' มิเตอร์และผู้จ่าย</h4>';
  room.meters.forEach(function (m) {
    html += '<div class="card flat mt8" style="padding:12px"><div class="row between"><div>' + kindIc(m.kind) + ' <b>' + KIND_TH[m.kind] + (m.label !== '1' ? ' · ' + esc(m.label === 'ห้องโถง' ? 'มิเตอร์ห้องโถง' : 'มิเตอร์ ' + m.label) : '') + '</b> <span class="tag ' + (m.status === 'OCC' ? 'ok' : 'warn') + '">' + MST_TH[m.status] + '</span> <span class="tiny muted">' + esc(m.id) + '</span></div>' +
      '<div class="row"><span class="small muted">เลขล่าสุด <b>' + (m.lastReading != null ? nf(m.lastReading) : '-') + '</b>' + (m.avgUsage ? ' · เฉลี่ย ' + nf(m.avgUsage) : '') + '</span><button class="btn sm ghost" data-em="' + esc(m.id) + '">' + ic('settings') + ' แก้มิเตอร์</button></div></div>' +
      '<table class="t mt8"><thead><tr><th>ผู้จ่าย</th><th>ประเภท</th><th>ย้ายเข้า</th><th>ย้ายออก</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' +
      (m.payers.length ? m.payers.map(function (a) {
        var ended = a.endDate && a.endDate < today();
        return '<tr style="' + (ended ? 'opacity:.55' : '') + '"><td>' + (a.payType === 'EMP' ? staffTag(a.empCode) + ' ' : '') + esc(a.name) + ' <span class="muted small">' + esc(a.payType === 'EMP' ? a.empCode : '') + '</span></td><td>' + (a.payType === 'EMP' ? '<span class="tag ok">หักเงินเดือน</span>' : a.payType === 'PENDING' ? '<span class="tag warn">รอรหัส</span>' : '<span class="tag elec">เงินสด</span>') + '</td>' +
          '<td>' + thDate(a.startDate) + '</td><td>' + (a.endDate ? thDate(a.endDate) : '<span class="muted">พักอยู่</span>') + '</td><td class="small">' + esc(a.note || '') + '</td>' +
          '<td class="nowrap">' + (!a.endDate ? '<button class="btn sm" data-out="' + a.id + '">' + ic('out') + '</button> ' : '') + '<button class="btn sm ghost icon" data-ea="' + a.id + '" title="แก้วันที่">' + ic('edit') + '</button><button class="btn sm ghost icon" data-da="' + a.id + '" title="ลบ (บันทึกผิด)">' + ic('trash') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted small">ยังไม่มีผู้จ่าย</td></tr>') + '</tbody></table></div>';
  });
  if (!room.meters.length) html += '<div class="muted small mt8">ห้องนี้ยังไม่มีมิเตอร์ในระบบ (กด "เพิ่มมิเตอร์" เพื่อเริ่มคิดค่าน้ำ–ค่าไฟ)</div>';
  html += '<h4 class="mt16">' + ic('history') + ' ประวัติผู้พัก (ย้อนหลัง 13 เดือน)</h4><div class="tbl-wrap mt8" style="max-height:220px"><table class="t"><thead><tr><th>ชื่อ</th><th>ประเภท</th><th>เข้า</th><th>ออก</th></tr></thead><tbody>' +
    (room.history.length ? room.history.map(function (h) { return '<tr><td>' + esc(h.name) + ' <span class="tiny muted">' + esc(h.payType === 'EMP' ? h.empCode : h.rid || '') + '</span></td><td class="small">' + (RTYPE_TH[h.payType] || '') + '</td><td>' + thDate(h.start, false) + '</td><td>' + (h.end ? thDate(h.end, false) : '<span class="tag ok">พักอยู่</span>') + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted small">—</td></tr>') + '</tbody></table></div>';
  return modal({ title: 'ห้อง ' + esc(room.room), body: html, wide: true, buttons: [{ label: 'ปิด' }], noFocus: true,
    onOpen: function (el, close) {
      var after = function (d) { if (d && d.master) setMaster(d.master); bindReadings(); close(); if (redraw) redraw(); roomDialog(key, redraw); };
      if ($('#rm-in', el)) $('#rm-in', el).onclick = function () { moveInDialog(room, after); };
      $('#rm-edit', el).onclick = function () { roomEditDialog(room, after); };
      $('#rm-addm', el).onclick = function () { close(); meterDialog(null, room); };
      $$('[data-em]', el).forEach(function (b) { b.onclick = function () { close(); meterDialog(S.master.byId[b.dataset.em]); }; });
      $$('[data-out]', el).forEach(function (b) { b.onclick = function () { moveOutDialog(b.dataset.out, room, after); }; });
      $$('[data-outp]', el).forEach(function (b) { b.onclick = function () { var a = S.master.assigns.filter(function (x) { return x.rid === b.dataset.outp && !x.endDate && room.meters.some(function (m) { return m.id === x.meterId; }); })[0]; if (a) moveOutDialog(a.id, room, after); }; });
      $$('[data-ea]', el).forEach(function (b) { b.onclick = function () { editAssignDialog(b.dataset.ea, after); }; });
      $$('[data-da]', el).forEach(function (b) { b.onclick = function () { confirmBox('ลบรายการผู้จ่าย', 'ใช้กรณีบันทึกผิดเท่านั้น (ถ้าย้ายออกจริง ให้กด "ย้ายออก" เพื่อเก็บประวัติ)', 'ลบ', 'danger').then(function (y) { if (y) api('deleteAssign', { assignIds: [b.dataset.da] }).then(after).catch(errToast); }); }; });
      $$('[data-leave]', el).forEach(function (b) { b.onclick = function () { leaveDialog(b.dataset.leave, after); }; });
      $$('[data-res]', el).forEach(function (b) { b.onclick = function () { residentDialog(b.dataset.res, after); }; });
      $$('[data-code]', el).forEach(function (b) { b.onclick = function () { assignCodeDialog(b.dataset.code, after); }; });
      $$('[data-act]', el).forEach(function (b) { b.onclick = function () { activationDialog(b.dataset.act); }; });
      $$('[data-pii]', el).forEach(function (b) { b.onclick = function () { contactDialog(b.dataset.pii, after); }; });
    } });
}
/** ตัดคำนำหน้า (นาย/นาง/น.ส./พญ./นพ./แพทย์หญิง ฯลฯ) และวงเล็บ เพื่อค้น/เทียบชื่อ */
function stripTitle(n) { return String(n || '').replace(/[\(\[].*?[\)\]]/g, ' ').replace(/^\s*(นางสาว|นาง|นาย|น\.ส\.|ว่าที่\s*ร\.?ต\.?\s*(หญิง)?|แพทย์หญิง|นายแพทย์|ทันตแพทย์หญิง|ทันตแพทย์|เภสัชกรหญิง|เภสัชกร|พญ\.|นพ\.|ทพญ\.|ทพ\.|ภญ\.|ภก\.|ดร\.|Mr\.?|Mrs\.?|Ms\.?|Miss)\s*/i, '').replace(/\s+/g, ' ').trim(); }
function nameKey(n) { return stripTitle(n).replace(/\s+/g, ''); }
function resOf(rid) { return (S.master.residents || []).filter(function (r) { return r.rid === rid; })[0] || { rid: rid, name: rid }; }
function roomEditDialog(room, after) {
  var ms = room.meters.filter(function (m) { return m.status !== 'OCC'; })[0];
  modal({ title: 'ข้อมูลห้อง ' + esc(room.room),
    body: '<div class="grid g2"><div class="field"><label class="f">ประเภทห้อง</label><input class="inp" id="re-t" list="re-tl" value="' + esc(room.type || '') + '"><datalist id="re-tl">' + ['Studio', '1 bedroom', '2 bedroom', '3 bedroom', 'บ้าน', 'ห้องเล็ก'].map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</datalist></div>' +
      '<div class="field"><label class="f">จำนวนเตียง</label><input class="inp" id="re-b" inputmode="numeric" value="' + (room.beds != null ? esc(room.beds) : '') + '"></div>' +
      '<div class="field"><label class="f">ชั้น</label><input class="inp" id="re-f" value="' + esc(room.floor || '') + '"></div><div class="field"><label class="f">ฝั่ง / โซน</label><input class="inp" id="re-z" value="' + esc(room.zone || '') + '"><div class="help">เช่น ฝ่ายการพยาบาล / เจ้าหน้าที่ทั่วไป</div></div>' +
      '<div class="field"><label class="f">ห้องสำหรับ</label><select class="inp" id="re-g">' + Object.keys(ROOMGENDER_TH).map(function (k) { return '<option value="' + k + '"' + ((room.gender || '') === k ? ' selected' : '') + '>' + ROOMGENDER_TH[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="f">สถานะห้อง</label><select class="inp" id="re-s"><option value="">ปกติ (ระบบดูจากผู้พัก: มีผู้พัก / ว่าง)</option><option value="RESERVED"' + (room.status === 'RESERVED' ? ' selected' : '') + '>จองแล้ว</option><option value="REPAIR"' + (room.status === 'REPAIR' ? ' selected' : '') + '>ห้องเสีย / ซ่อมแซม</option><option value="CLOSED"' + (room.status === 'CLOSED' ? ' selected' : '') + '>ปิดใช้งาน</option></select></div></div>' +
      '<div class="grid g2" id="re-rep"><div class="field"><label class="f">สาเหตุ / รายละเอียด</label><input class="inp" id="re-r" value="' + esc(room.statusReason || '') + '" placeholder="เช่น ท่อน้ำรั่ว รอช่าง"></div><div class="field"><label class="f">ตั้งแต่ – คาดว่าเสร็จ</label><div class="row"><input class="inp" type="date" id="re-sf" value="' + esc(room.statusFrom || '') + '" style="max-width:160px"><input class="inp" type="date" id="re-st" value="' + esc(room.statusTo || '') + '" style="max-width:160px"></div></div></div>' +
      '<div class="field"><label class="f">การใช้ห้อง (ผลต่อการเรียกเก็บค่าน้ำ–ค่าไฟ)</label><select class="inp" id="re-m"><option value="">ไม่เปลี่ยน (ปัจจุบัน: ' + (ms ? MST_TH[ms.status] : 'มีผู้พัก/เรียกเก็บ') + ')</option>' + Object.keys(MST_TH).map(function (k) { return '<option value="' + k + '">' + MST_TH[k] + (k === 'OCC' ? ' (เรียกเก็บ)' : ' (ไม่เรียกเก็บ)') + '</option>'; }).join('') + '</select><div class="help">ห้องเวร / นานาชาติ / ส่วนกลาง = ยังจดมิเตอร์ แต่ไม่เรียกเก็บ · ใช้กับมิเตอร์ทุกตัวของห้อง</div></div>' +
      '<div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="re-n" value="' + esc(room.note || '') + '"></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      return api('saveRoom', { room: { bld: room.bld, room: room.room, type: $('#re-t').value, beds: $('#re-b').value, floor: $('#re-f').value, zone: $('#re-z').value, gender: $('#re-g').value, status: $('#re-s').value, statusReason: $('#re-r').value, statusFrom: $('#re-sf').value, statusTo: $('#re-st').value, note: $('#re-n').value, meterStatus: $('#re-m').value } })
        .then(function (d) { toast('บันทึกข้อมูลห้องแล้ว', 'ok'); after(d); });
    } }] });
}
/** ค้นบุคลากร: ชื่อ / นามสกุล / รหัส (ทะเบียนบุคลากรจาก HRMi + ผู้พักในระบบ) */
function loadStaffIndex() {
  if (S.staffIdx) return Promise.resolve(S.staffIdx);
  return api('getStaffIndex').then(function (d) { S.staffIdx = d; return d; });
}
function searchPeople(q, opt) {
  q = String(q || '').trim(); if (q.length < 2) return [];
  var nq = nameKey(q) || q.replace(/\s+/g, ''), out = [], seen = {};
  var hit = function (name, code) { var n = String(name || '').replace(/\s+/g, ''); return (code && String(code).indexOf(q) === 0) || n.indexOf(nq) >= 0; };
  ((S.staffIdx && S.staffIdx.list) || []).forEach(function (x) { if (out.length < 30 && hit(x[1], x[0])) { seen[x[0]] = 1; out.push({ src: 'STAFF', empCode: x[0], name: x[1], position: x[2], division: x[3], gender: x[4], status: x[5] }); } });
  if (!opt || opt.residents !== false) (S.master.residents || []).forEach(function (r) { if (out.length < 40 && !seen[r.empCode || '-'] && hit(r.name, r.empCode || r.rid)) out.push({ src: 'RES', rid: r.rid, empCode: r.empCode, name: r.name, rtype: r.rtype, position: r.position, division: r.division, gender: r.gender, group: r.group }); });
  return out;
}
function moveInDialog(room, after) {
  var groups = uniq((S.master.residents || []).map(function (r) { return r.group; }).concat(['นศพ.นานาชาติ', 'นิสิตแพทย์', 'แพทย์ฝึกหัด (พฝห.)']));
  var pick = null;
  modal({ title: 'ย้ายเข้า · ห้อง ' + esc(room.room), wide: true,
    body: '<div class="seg" id="mi-t"><button data-t="EMP" class="on">' + ic('shield') + ' หักเงินเดือน (มีรหัส 7 หลัก)</button><button data-t="PENDING">' + ic('key') + ' รอรหัส (พนักงานใหม่)</button><button data-t="CASH">' + ic('cash') + ' ชำระเงินสด (นศพ./พฝห.)</button></div>' +
      '<div class="field mt12" id="mi-emp"><label class="f">ค้นหาด้วยชื่อ นามสกุล หรือรหัสพนักงาน ' + helpTip('พิมพ์อย่างน้อย 2 ตัวอักษร เช่น "สมใจ" หรือ "5660" — ระบบค้นจากทะเบียนบุคลากร HRMi') + '</label><input class="inp" id="mi-q" autocomplete="off" placeholder="พิมพ์ชื่อ หรือ รหัส"><div id="mi-res" class="pick"></div><div id="mi-info" class="small mt8"></div></div>' +
      '<div class="hide" id="mi-man"><div class="note info mt12" id="mi-man-note"></div><div class="grid g2"><div class="field"><label class="f">ชื่อ-สกุล (ตามบัตร/ทางการ)</label><input class="inp" id="mi-name" placeholder="คำนำหน้า ชื่อ นามสกุล"></div>' +
      '<div class="field"><label class="f">เพศ</label><select class="inp" id="mi-g"><option value="">-</option><option value="F">หญิง</option><option value="M">ชาย</option></select></div>' +
      '<div class="field"><label class="f">ตำแหน่ง</label><input class="inp" id="mi-pos"></div><div class="field"><label class="f">ฝ่าย / สังกัด</label><input class="inp" id="mi-div"></div>' +
      '<div class="field" id="mi-grp-f"><label class="f">กลุ่ม</label><input class="inp" id="mi-grp" list="mi-grpl"><datalist id="mi-grpl">' + groups.map(function (g) { return '<option>' + esc(g) + '</option>'; }).join('') + '</datalist></div><div class="field" id="mi-ref-f"><label class="f">รหัสนิสิต/อ้างอิง (ถ้ามี)</label><input class="inp" id="mi-ref"></div></div></div>' +
      '<div class="field"><label class="f">มิเตอร์ที่ต้องจ่าย</label>' + room.meters.map(function (m) { return '<label class="check" style="margin-right:14px"><input type="checkbox" class="mi-m" value="' + esc(m.id) + '" ' + (m.label !== 'ห้องโถง' ? 'checked' : '') + '> ' + kindIc(m.kind) + ' ' + KIND_TH[m.kind] + (m.label !== '1' ? ' (' + esc(m.label) + ')' : '') + '</label>'; }).join('') + '</div>' +
      '<div class="grid g2"><div class="field"><label class="f">วันที่ย้ายเข้า (วันแรกที่พัก)</label><input class="inp" type="date" id="mi-start" value="' + today() + '"><div class="help">ค่าน้ำ/ไฟเดือนแรกคิดตามจำนวนวันที่พัก</div></div><div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="mi-note"></div></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('login') + ' บันทึกย้ายเข้า', cls: 'primary', onClick: function () {
      var t = $('#mi-t .on').dataset.t, ids = $$('.mi-m').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      var p = { meterIds: ids, payType: t, startDate: $('#mi-start').value, note: $('#mi-note').value.trim() };
      if (t === 'EMP') { if (!pick) { toast('กรุณาค้นและเลือกบุคลากร', 'warn'); return false; } if (pick.rid) p.rid = pick.rid; p.empCode = pick.empCode; }
      else if (pick && pick.rid && pick.rtype === t) p.rid = pick.rid;
      else { p.name = $('#mi-name').value.trim(); p.gender = $('#mi-g').value; p.position = $('#mi-pos').value.trim(); p.division = $('#mi-div').value.trim(); p.group = $('#mi-grp').value.trim(); p.empCode = t === 'CASH' ? $('#mi-ref').value.trim() : ''; }
      return api('moveIn', p).then(function (d) { toast('บันทึกย้ายเข้าแล้ว' + (t === 'PENDING' ? ' · ติดธง "รอรหัส" ไว้แล้ว' : ''), 'ok'); after(d); });
    } }],
    onOpen: function (el) {
      var type = 'EMP';
      var setType = function (t) {
        type = t; pick = null; $('#mi-info', el).innerHTML = ''; $('#mi-res', el).innerHTML = '';
        $$('#mi-t button', el).forEach(function (x) { x.classList.toggle('on', x.dataset.t === t); });
        $('#mi-man', el).classList.toggle('hide', t === 'EMP');
        $('#mi-grp-f', el).classList.toggle('hide', t !== 'CASH'); $('#mi-ref-f', el).classList.toggle('hide', t !== 'CASH');
        $('#mi-man-note', el).innerHTML = t === 'PENDING' ? ic('info') + '<div>พนักงานใหม่ที่ยังไม่มีรหัสใน HRMi: <b>นับเป็นคนหาร</b> แต่ยอดจะ <b>พักไว้</b> · เมื่อได้รหัสแล้ว กด "ใส่รหัส" ในห้อง ระบบจะหักย้อนหลังให้ในรอบถัดไป</div>' : ic('info') + '<div>ผู้ชำระเงินสด: นับเป็นคนหาร · ไม่อยู่ในไฟล์ HRMi · อยู่ใน "รายงานเงินสด" สำหรับเจ้าหน้าที่เรียกเก็บ</div>';
        $('#mi-q', el).placeholder = t === 'EMP' ? 'พิมพ์ชื่อ หรือ รหัส' : 'ค้นผู้พักเดิม (ถ้าเคยพัก) หรือกรอกข้อมูลด้านล่าง';
      };
      $$('#mi-t button', el).forEach(function (b) { b.onclick = function () { setType(b.dataset.t); }; });
      loadStaffIndex().catch(function () { });
      var show = function (x) {
        pick = x;
        $('#mi-res', el).innerHTML = '';
        $('#mi-q', el).value = x.name;
        if (type === 'EMP' && x.empCode) {
          $('#mi-info', el).innerHTML = '<span class="spin" style="width:14px;height:14px;border-width:2px"></span> กำลังตรวจกับระบบบุคลากร…';
          api('lookupEmp', { codes: [x.empCode] }).then(function (d) {
            var y = d.list[0];
            $('#mi-info', el).innerHTML = y && y.found ? '<div class="note ok">' + ic('check') + '<div><b>' + esc(y.name) + '</b> · ' + esc(x.empCode) + '<br>' + esc(y.position || '') + ' · ' + esc(y.division || '') + (y.empGroup ? '<br><span class="tag">' + esc(y.empGroup) + '</span>' : '') + (y.status ? ' <span class="tag">' + esc(y.status) + '</span>' : '') + '</div></div>' : '<div class="note danger">' + ic('alert') + '<div>ไม่พบรหัสนี้ในระบบบุคลากร หรือพ้นสภาพแล้ว</div></div>';
          }).catch(function (e) { $('#mi-info', el).innerHTML = '<span style="color:var(--danger)">' + esc(e.message) + '</span>'; });
        } else if (x.rid) $('#mi-info', el).innerHTML = '<div class="note info">' + ic('user') + '<div>ผู้พักเดิม ' + esc(x.rid) + ' · ' + esc(RTYPE_TH[x.rtype] || '') + (x.group ? ' · ' + esc(x.group) : '') + '</div></div>';
      };
      $('#mi-q', el).oninput = debounce(function () {
        var q = $('#mi-q', el).value.trim(); pick = null;
        if (type === 'EMP' && /^\d{7}$/.test(q)) return show({ empCode: q, name: q });
        var L = searchPeople(q).filter(function (x) { return type === 'EMP' ? (x.src === 'STAFF' || x.rtype === 'EMP') : x.src === 'RES' && x.rtype === type; });
        $('#mi-res', el).innerHTML = L.length ? L.map(function (x, i) { return '<button type="button" data-i="' + i + '"><b>' + esc(x.name) + '</b> <span class="muted">' + esc(x.empCode || x.rid || '') + '</span><div class="tiny muted">' + [x.position, x.division, x.group, x.status].filter(Boolean).map(esc).join(' · ') + (x.src === 'RES' ? ' · ผู้พักในระบบ' : '') + '</div></button>'; }).join('') :
          (q.length >= 2 ? '<div class="tiny muted" style="padding:8px">' + (type === 'EMP' ? (S.staffIdx && S.staffIdx.n ? 'ไม่พบชื่อนี้ — ลองพิมพ์รหัส 7 หลัก' : 'ยังไม่มีทะเบียนบุคลากรสำหรับค้นชื่อ (HR นำเข้าได้ที่ ตั้งค่า › ทะเบียนบุคลากร) — พิมพ์รหัส 7 หลักแทน') : 'ไม่พบผู้พักเดิม — กรอกข้อมูลด้านล่าง') + '</div>' : '');
        $$('#mi-res button', el).forEach(function (b) { b.onclick = function () { show(L[+b.dataset.i]); }; });
      }, 220);
    } });
}
function moveOutDialog(assignId, room, after) {
  var a = S.master.assigns.filter(function (x) { return x.id === assignId; })[0];
  var same = []; room.meters.forEach(function (m) { m.payers.forEach(function (x) { if (!x.endDate && (x.id === a.id || (a.rid && x.rid === a.rid) || (!a.rid && a.payType === 'EMP' && x.empCode === a.empCode))) same.push({ x: x, m: m }); }); });
  modal({ title: 'ย้ายออก · ' + esc(a.name),
    body: '<div class="field"><label class="f">วันที่ย้ายออก (วันสุดท้ายที่พัก)</label><input class="inp" type="date" id="mo-end" value="' + today() + '"></div>' +
      '<div class="field"><label class="f">มิเตอร์</label>' + same.map(function (s) { return '<label class="check" style="margin-right:14px"><input type="checkbox" class="mo-a" value="' + s.x.id + '" checked> ' + kindIc(s.m.kind) + ' ' + KIND_TH[s.m.kind] + (s.m.label !== '1' ? ' (' + esc(s.m.label) + ')' : '') + '</label>'; }).join('') + '</div><div class="field"><label class="f">เหตุผล / หมายเหตุ</label><input class="inp" id="mo-note" list="mo-nl" placeholder="เช่น ลาออก / ย้ายไปหอเทพฯ"><datalist id="mo-nl"><option>ลาออก</option><option>ย้ายห้อง</option><option>ย้ายไปพักนอก รพ.</option><option>ครบกำหนดฝึก/ศึกษา</option><option>เกษียณ</option></datalist></div>' +
      '<p class="tiny muted">ถ้า "ลาศึกษา / ลาไม่รับเงินเดือน" แต่ยังมีชื่อในห้อง ไม่ต้องย้ายออก — ใช้ปุ่ม "พักการเรียกเก็บ" แทน</p>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('out') + ' บันทึกย้ายออก', cls: 'warn', onClick: function () {
      return api('moveOut', { assignIds: $$('.mo-a').filter(function (x) { return x.checked; }).map(function (x) { return x.value; }), endDate: $('#mo-end').value, note: $('#mo-note').value.trim() }).then(function (d) { toast('บันทึกย้ายออกแล้ว', 'ok'); after(d); });
    } }] });
}
function leaveDialog(rid, after) {
  var r = resOf(rid), L = (S.master.leaves || []).filter(function (l) { return l.rid === rid; });
  modal({ title: 'พักการเรียกเก็บ · ' + esc(r.name),
    body: '<div class="note info">' + ic('info') + '<div>ใช้เมื่อผู้พัก <b>ลาศึกษา / ลากิจไม่รับเงินเดือน / ไปปฏิบัติงานที่อื่น</b> แต่ยังมีชื่อในห้อง — วันในช่วงนี้จะ <b>ไม่ถูกนับหาร</b> ผู้พักคนอื่นในห้องรับยอดไป (ถ้าทุกคนพัก ระบบจะเตือนว่าไม่มีผู้รับผิดชอบ)</div></div>' +
      (L.length ? '<table class="t mt12"><thead><tr><th>ช่วง</th><th>เหตุผล</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' + L.map(function (l) { return '<tr><td>' + thDate(l.from, false) + ' – ' + (l.to ? thDate(l.to, false) : 'ไม่กำหนด') + '</td><td>' + esc(l.reason) + '</td><td class="small">' + esc(l.note) + '</td><td><button class="btn sm ghost icon" data-dl="' + l.id + '">' + ic('trash') + '</button></td></tr>'; }).join('') + '</tbody></table>' : '') +
      '<div class="grid g2 mt12"><div class="field"><label class="f">ตั้งแต่วันที่</label><input class="inp" type="date" id="lv-f" value="' + today().slice(0, 8) + '01"></div><div class="field"><label class="f">ถึงวันที่ (ว่าง = ยังไม่กำหนด)</label><input class="inp" type="date" id="lv-t"></div>' +
      '<div class="field"><label class="f">เหตุผล</label><select class="inp" id="lv-r"><option>ลาศึกษา</option><option>ลากิจไม่รับเงินเดือน</option><option>ลาคลอด/ลาเลี้ยงดูบุตร</option><option>ไปปฏิบัติงาน/ฝึกอบรมที่อื่น</option><option>อื่น ๆ</option></select></div><div class="field"><label class="f">หมายเหตุ / เลขหนังสือ</label><input class="inp" id="lv-n"></div></div>',
    buttons: [{ label: 'ปิด' }, { label: 'บันทึกช่วงพักการเรียกเก็บ', cls: 'primary', onClick: function () {
      return api('saveLeave', { leave: { rid: rid, from: $('#lv-f').value, to: $('#lv-t').value, reason: $('#lv-r').value, note: $('#lv-n').value } }).then(function (d) { toast('บันทึกแล้ว — มีผลกับรอบที่ยังไม่ล็อก', 'ok'); after(d); });
    } }],
    onOpen: function (el, close) { $$('[data-dl]', el).forEach(function (b) { b.onclick = function () { api('deleteLeave', { id: b.dataset.dl }).then(function (d) { close(); after(d); }).catch(errToast); }; }); } });
}
function residentDialog(rid, after) {
  var r = resOf(rid), emp = r.rtype === 'EMP';
  modal({ title: 'ข้อมูลผู้พัก · ' + esc(r.rid),
    body: (emp ? '<div class="note info">' + ic('info') + '<div>ชื่อ ตำแหน่ง ฝ่าย ของผู้มีรหัสพนักงาน ปรับตาม HRMi (SmartAPI) อัตโนมัติทุกคืน</div></div>' : '') +
      '<div class="grid g2"><div class="field"><label class="f">ชื่อ-สกุล</label><input class="inp" id="rs-n" value="' + esc(r.name) + '" ' + (emp ? 'disabled' : '') + '></div><div class="field"><label class="f">เพศ</label><select class="inp" id="rs-g"><option value="">-</option><option value="F"' + (r.gender === 'F' ? ' selected' : '') + '>หญิง</option><option value="M"' + (r.gender === 'M' ? ' selected' : '') + '>ชาย</option></select></div>' +
      '<div class="field"><label class="f">ตำแหน่ง</label><input class="inp" id="rs-p" value="' + esc(r.position || '') + '"></div><div class="field"><label class="f">ฝ่าย / สังกัด</label><input class="inp" id="rs-d" value="' + esc(r.division || '') + '"></div>' +
      (!emp ? '<div class="field"><label class="f">ประเภท</label><select class="inp" id="rs-t"><option value="CASH"' + (r.rtype === 'CASH' ? ' selected' : '') + '>ชำระเงินสด</option><option value="PENDING"' + (r.rtype === 'PENDING' ? ' selected' : '') + '>รอรหัสพนักงาน</option></select></div><div class="field"><label class="f">กลุ่ม</label><input class="inp" id="rs-gr" value="' + esc(r.group || '') + '"></div>' : '') +
      '</div><div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="rs-no" value="' + esc(r.note || '') + '"></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      return api('saveResident', { resident: { rid: rid, name: emp ? null : $('#rs-n').value, gender: $('#rs-g').value, position: $('#rs-p').value, division: $('#rs-d').value, rtype: $('#rs-t') ? $('#rs-t').value : null, group: $('#rs-gr') ? $('#rs-gr').value : null, note: $('#rs-no').value } }).then(function (d) { toast('บันทึกแล้ว', 'ok'); after(d); });
    } }] });
}
function assignCodeDialog(rid, after) {
  var r = resOf(rid), held = (S.master.held || {})[rid] || 0;
  modal({ title: 'ใส่รหัสพนักงาน · ' + esc(r.name),
    body: '<p class="small">' + (r.rtype === 'CASH' ? 'ใช้เมื่อผู้พักคนนี้<b>เป็นบุคลากร</b> แต่ถูกบันทึกเป็น "ชำระเงินสด" — เลือกชื่อจากทะเบียนบุคลากร (หรือพิมพ์รหัส 7 หลัก) ' : 'เมื่อพนักงานใหม่ได้รหัสใน HRMi แล้ว ใส่รหัสที่นี่ ') + 'ระบบจะตรวจกับ SmartAPI เปลี่ยนชื่อเป็นชื่อทางการ และเปลี่ยนเป็น "หักเงินเดือน" ทุกมิเตอร์ · ประวัติการพักเดิมยังอยู่ · มีผลกับรอบที่ยังไม่ล็อก</p>' +
      (held ? '<div class="note warn">' + ic('cash') + '<div>มียอดที่พักไว้ระหว่างรอรหัส <b>' + baht(held) + ' บาท</b> — จะรวมหักย้อนหลังในรอบถัดไปที่ HR ล็อก</div></div>' : '') +
      '<div class="field mt12"><label class="f">ค้นชื่อ หรือ รหัส 7 หลัก</label><input class="inp" id="ac-q" value="' + esc(stripTitle(r.name)) + '"><div id="ac-res" class="pick"></div></div><div class="field"><label class="f">รหัสพนักงาน</label><input class="inp" id="ac-c" inputmode="numeric" maxlength="7" style="max-width:180px"></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('check') + ' ตรวจและบันทึก', cls: 'primary', onClick: function () {
      return api('assignCode', { rid: rid, empCode: $('#ac-c').value.trim() }).then(function (d) { toast('บันทึกรหัสแล้ว: ' + d.name + (d.held ? ' · ยอดพักไว้ ' + baht(d.held) + ' บาท จะหักในรอบถัดไป' : ''), 'ok', 7000); after(d); });
    } }],
    onOpen: function (el) {
      var run = function () { var L = searchPeople($('#ac-q', el).value, { residents: false }); $('#ac-res', el).innerHTML = L.slice(0, 10).map(function (x) { return '<button type="button" data-c="' + x.empCode + '"><b>' + esc(x.name) + '</b> <span class="muted">' + x.empCode + '</span><div class="tiny muted">' + [x.position, x.division].filter(Boolean).map(esc).join(' · ') + '</div></button>'; }).join(''); $$('#ac-res button', el).forEach(function (b) { b.onclick = function () { $('#ac-c', el).value = b.dataset.c; $('#ac-res', el).innerHTML = ''; }; }); };
      loadStaffIndex().then(run).catch(function () { });
      $('#ac-q', el).oninput = debounce(run, 220);
    } });
}
function activationDialog(rid) {
  var r = resOf(rid);
  confirmBox('ออกรหัสดูยอดให้ ' + esc(r.name), 'ระบบจะสุ่ม <b>รหัสเปิดใช้</b> 8 ตัว (ใช้ครั้งเดียว อายุ 7 วัน) ให้ผู้พักนำไปตั้งรหัสผ่านเองที่หน้า "ค่าน้ำไฟของฉัน"' + (r.acct === 'SET' ? '<div class="note warn mt8">' + ic('alert') + '<div>ผู้พักตั้งรหัสผ่านไว้แล้ว — ออกรหัสใหม่ = รหัสผ่านเดิมใช้ไม่ได้ทันที (ใช้กรณีลืมรหัส)</div></div>' : ''), 'ออกรหัส').then(function (y) {
    if (!y) return;
    api('issueActivation', { rid: rid }).then(function (d) {
      var msg = 'SOMDEJ U-Bill · ดูค่าน้ำ–ค่าไฟที่พักของฉัน\n' + d.url + '\nเลขผู้พัก: ' + d.rid + '\nรหัสเปิดใช้: ' + d.code + '\n(ใช้ครั้งเดียว ภายใน ' + thDate(d.expiresAt) + ' แล้วตั้งรหัสผ่านของท่านเอง)';
      modal({ title: 'รหัสเปิดใช้ของ ' + esc(d.name), body: '<div class="note ok">' + ic('check') + '<div>ส่งข้อความนี้ให้ผู้พัก <b>ทางช่องทางส่วนตัว</b> (LINE / พิมพ์ใบให้) · ระบบไม่แสดงรหัสนี้อีก</div></div><pre class="mt12" style="white-space:pre-wrap;background:var(--surface-2);padding:12px;border-radius:10px;font-size:15px" id="ac-msg">' + esc(msg) + '</pre>',
        buttons: [{ label: 'ปิด' }, { label: ic('printer') + ' พิมพ์ใบ', onClick: function () { var w = window.open('', '_blank'); w.document.write('<html><body style="font-family:sans-serif;padding:24px"><h2>SOMDEJ U-Bill · ค่าน้ำ–ค่าไฟของฉัน</h2><p>' + esc(d.name) + '</p><pre style="font-size:18px">' + esc(msg) + '</pre><p style="color:#666">เก็บเป็นความลับ · ' + esc(S.me.name || '') + ' ออกให้เมื่อ ' + thDate(new Date().toISOString()) + '</p></body></html>'); w.document.close(); w.print(); return false; } },
          { label: ic('file') + ' คัดลอก', cls: 'primary', onClick: function () { try { navigator.clipboard.writeText(msg); toast('คัดลอกแล้ว', 'ok'); } catch (e) { } return false; } }] });
    }).catch(errToast);
  });
}
/** ข้อมูลติดต่อ (PDPA) — ต้องยืนยันรหัสผ่านก่อน (เปิดได้ 10 นาที) · ระบบบันทึกทุกครั้ง */
function piiReady() { return S.pii && S.pii.exp > Date.now(); }
function piiUnlock() {
  if (piiReady()) return Promise.resolve(S.pii.t);
  return new Promise(function (res, rej) {
    var done = false;
    modal({ title: ic('lock') + ' ยืนยันตัวตนเพื่อเปิดดูข้อมูลส่วนบุคคล',
      body: '<div class="note warn">' + ic('shield') + '<div><b>ข้อมูลส่วนบุคคลตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</b><br>ใช้เพื่อติดต่อเรื่องที่พักเท่านั้น ห้ามคัดลอก/เผยแพร่ · ระบบบันทึกชื่อผู้เปิดดูและเวลาทุกครั้ง</div></div><div class="field mt12"><label class="f">รหัสผ่าน U-Bill ของท่าน</label><input class="inp" type="password" id="pii-pw" autocomplete="current-password"></div>',
      buttons: [{ label: 'ยกเลิก' }, { label: ic('eye') + ' ยืนยันและเปิดดู', cls: 'primary', onClick: function () {
        return api('piiUnlock', { password: $('#pii-pw').value }).then(function (d) { S.pii = { t: d.pii, exp: Date.now() + d.minutes * 60000 - 15000 }; done = true; res(d.pii); });
      } }], onClose: function () { if (!done) rej(new Error('ยกเลิก')); } });
  });
}
function contactDialog(rid, after) {
  var r = resOf(rid);
  piiUnlock().then(function (pii) {
    return api('revealContact', { pii: pii, rid: rid }).then(function (d) {
      var c = d.contacts[rid] || {}, src = { API: 'จาก HRMi/SmartAPI', MANUAL: 'เจ้าหน้าที่กรอก' };
      modal({ title: ic('eye') + ' ข้อมูลติดต่อ · ' + esc(r.name),
        body: '<div class="note warn">' + ic('shield') + '<div>ข้อมูลส่วนบุคคล (PDPA) · การเปิดดูครั้งนี้ถูกบันทึกแล้ว · ปิดหน้าต่างเมื่อใช้เสร็จ</div></div>' +
          '<div class="grid g2 mt12"><div class="field"><label class="f">เบอร์โทร ' + (c.phoneSrc ? '<span class="tiny muted">(' + (src[c.phoneSrc] || c.phoneSrc) + ')</span>' : '') + '</label><input class="inp" id="ct-p" value="' + esc(c.phone || '') + '" placeholder="ไม่มีข้อมูล — กรอกเพิ่มได้"></div>' +
          '<div class="field"><label class="f">อีเมล ' + (c.emailSrc ? '<span class="tiny muted">(' + (src[c.emailSrc] || c.emailSrc) + ')</span>' : '') + '</label><input class="inp" id="ct-e" value="' + esc(c.email || '') + '" placeholder="ไม่มีข้อมูล — กรอกเพิ่มได้"></div></div>' +
          (c.phone ? '<a class="btn sm" href="tel:' + esc(String(c.phone).split(/[,\s]/)[0]) + '">' + ic('send') + ' โทร</a>' : ''),
        buttons: [{ label: 'ปิด' }, { label: 'บันทึกข้อมูลติดต่อ', cls: 'primary', onClick: function () {
          return api('saveContact', { pii: S.pii.t, contact: { rid: rid, phone: $('#ct-p').value.trim(), email: $('#ct-e').value.trim() } }).then(function (d2) { toast('บันทึกแล้ว', 'ok'); if (after) after(d2); });
        } }] });
    });
  }).catch(function (e) { if (e && e.message === 'PII_LOCKED') { S.pii = null; return contactDialog(rid, after); } if (e && e.message !== 'ยกเลิก') errToast(e); });
}
function editAssignDialog(id, after) {
  var a = S.master.assigns.filter(function (x) { return x.id === id; })[0];
  modal({ title: 'แก้ไขผู้จ่าย · ' + esc(a.name),
    body: (a.payType === 'CASH' ? '<div class="field"><label class="f">ชื่อ</label><input class="inp" id="ea-name" value="' + esc(a.name) + '"></div>' : '') +
      '<div class="grid g2"><div class="field"><label class="f">ย้ายเข้า</label><input class="inp" type="date" id="ea-s" value="' + esc(a.startDate) + '"></div><div class="field"><label class="f">ย้ายออก (ว่าง = ยังพักอยู่)</label><input class="inp" type="date" id="ea-e" value="' + esc(a.endDate || '') + '"></div></div><div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="ea-n" value="' + esc(a.note || '') + '"></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      return api('saveAssign', { assign: { id: id, startDate: $('#ea-s').value, endDate: $('#ea-e').value, note: $('#ea-n').value, name: $('#ea-name') ? $('#ea-name').value : null } }).then(function (d) { toast('บันทึกแล้ว', 'ok'); after(d); });
    } }] });
}
function meterDialog(m, room) {
  var isNew = !m; m = m || { kind: 'E', bld: room ? room.bld : (S.boot.buildings[0] || {}).id, floor: room ? room.floor : '', room: room ? room.room : '', newRoom: room ? room.newRoom : '', label: room ? String(room.meters.filter(function (x) { return x.kind === 'E'; }).length + 1) : '1', status: 'OCC' };
  modal({ title: isNew ? 'เพิ่มมิเตอร์' : 'แก้ไขมิเตอร์ ' + esc(m.id),
    body: '<div class="grid g2"><div class="field"><label class="f">ประเภท</label><select class="inp" id="me-k" ' + (isNew ? '' : 'disabled') + '><option value="E"' + (m.kind === 'E' ? ' selected' : '') + '>ค่าไฟ</option><option value="W"' + (m.kind === 'W' ? ' selected' : '') + '>ค่าน้ำ</option></select></div>' +
      '<div class="field"><label class="f">ที่พัก</label><select class="inp" id="me-b" ' + (isNew ? '' : 'disabled') + '>' + S.boot.buildings.map(function (b) { return '<option value="' + b.id + '"' + (b.id === m.bld ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="f">ห้อง / บ้านเลขที่</label><input class="inp" id="me-r" value="' + esc(m.room) + '"></div><div class="field"><label class="f">ชั้น</label><input class="inp" id="me-f" value="' + esc(m.floor || '') + '"></div>' +
      '<div class="field"><label class="f">เลขห้องใหม่ (ถ้ามี)</label><input class="inp" id="me-n" value="' + esc(m.newRoom || '') + '"></div><div class="field"><label class="f">ชื่อมิเตอร์</label><input class="inp" id="me-l" value="' + esc(m.label) + '"><div class="help">1, 2, 3 … หรือ "ห้องโถง" (มิเตอร์ใช้ร่วม)</div></div>' +
      '<div class="field"><label class="f">สถานะห้อง</label><select class="inp" id="me-s">' + Object.keys(MST_TH).map(function (k) { return '<option value="' + k + '"' + (k === m.status ? ' selected' : '') + '>' + MST_TH[k] + (k === 'OCC' ? ' (เรียกเก็บ)' : ' (ไม่เรียกเก็บ)') + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label class="f">เลขมิเตอร์ล่าสุด' + (isNew ? ' (เลขตั้งต้น)' : '') + '</label><input class="inp" id="me-lr" inputmode="decimal" value="' + (m.lastReading != null ? m.lastReading : '') + '"><div class="help">ใช้เป็น "เลขครั้งก่อน" ของรอบถัดไป</div></div></div>' +
      '<div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="me-no" value="' + esc(m.note || '') + '"></div>' + (!isNew ? '<label class="check"><input type="checkbox" id="me-a" ' + (m.active !== false ? 'checked' : '') + '> ใช้งานอยู่ (ไม่ติ๊ก = ยกเลิกมิเตอร์)</label>' : ''),
    buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      return api('saveMeter', { meter: { id: isNew ? '' : m.id, kind: $('#me-k').value, bld: $('#me-b').value, room: $('#me-r').value, floor: $('#me-f').value, newRoom: $('#me-n').value, label: $('#me-l').value, status: $('#me-s').value, lastReading: $('#me-lr').value, note: $('#me-no').value, active: $('#me-a') ? $('#me-a').checked : true } })
        .then(function () { toast('บันทึกมิเตอร์แล้ว', 'ok'); S.master = null; route(); });
    } }] });
}
function refreshNamesDialog(btn) {
  busy(btn, true, 'กำลังตรวจ…');
  api('refreshNames', { apply: false }).then(function (d) {
    busy(btn, false);
    modal({ title: 'ผลตรวจชื่อกับระบบบุคลากร', wide: true,
      body: '<dl class="kv"><dt>ตรวจแล้ว</dt><dd>' + nf(d.checked) + ' คน</dd><dt>ชื่อไม่ตรง</dt><dd>' + d.diffs.length + '</dd><dt>ไม่พบ / พ้นสภาพ</dt><dd>' + d.notFound.length + (d.notFound.length ? ' <span class="small muted">(' + d.notFound.join(', ') + ')</span>' : '') + '</dd></dl>' +
        (d.diffs.length ? '<div class="tbl-wrap mt12" style="max-height:340px"><table class="t"><thead><tr><th>รหัส</th><th>ชื่อในทะเบียน</th><th>ชื่อจากระบบบุคลากร</th></tr></thead><tbody>' + d.diffs.map(function (x) { return '<tr><td>' + esc(x.empCode) + '</td><td>' + esc(x.old) + '</td><td><b>' + esc(x.api) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' : ''),
      buttons: d.diffs.length ? [{ label: 'ปิด' }, { label: 'ปรับเป็นชื่อทางการทั้งหมด (หมายเหตุในวงเล็บย้ายไปช่องหมายเหตุ)', cls: 'primary', onClick: function () { return api('refreshNames', { apply: true }).then(function () { toast('แก้ชื่อแล้ว', 'ok'); S.master = null; route(); }); } }] : [{ label: 'ปิด', cls: 'primary', onClick: function () { S.master = null; route(); } }] });
  }).catch(function (e) { busy(btn, false); errToast(e); });
}
