/* SOMDEJ U-Bill — pages-master.js : ทะเบียนห้อง · มิเตอร์ · ผู้พัก (ย้ายเข้า/ย้ายออก) */
PAGES.master = function () {
  var pg = shell('ห้อง · มิเตอร์ · ผู้พัก', 'ฝ่ายอาคารจัดการย้ายเข้า/ออกได้เอง · ผู้จ่ายรหัส 7 หลักตรวจชื่อกับระบบบุคลากรอัตโนมัติ',
    '<button class="btn" id="m-api">' + ic('refresh') + ' ตรวจชื่อกับ API</button><button class="btn" id="m-exp">' + ic('download') + ' ส่งออกทะเบียน</button><button class="btn" id="m-imp">' + ic('upload') + ' นำเข้าทะเบียนจากแม่แบบ</button><button class="btn primary" id="m-add">' + ic('plus') + ' เพิ่มมิเตอร์</button>');
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
    if (q) rooms = rooms.filter(function (r) { return String(r.room).indexOf(q) >= 0 || r.meters.some(function (m) { return m.curPayers.some(function (a) { return a.name.indexOf(q) >= 0 || a.empCode.indexOf(q) >= 0; }); }); });
    if (P.mf === 'EMPTY') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.status === 'OCC' && !m.curPayers.length; }); });
    if (P.mf === 'NC') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.status !== 'OCC'; }); });
    if (P.mf === 'CASH') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.curPayers.some(function (a) { return a.payType === 'CASH'; }); }); });
    if (P.mf === 'NF') rooms = rooms.filter(function (r) { return r.meters.some(function (m) { return m.curPayers.some(function (a) { var s = S.master.staff[a.empCode]; return a.payType === 'EMP' && s && !s[0]; }); }); });
    var all = roomsOf(P.mbld), people = {}, cash = {};
    all.forEach(function (r) { r.meters.forEach(function (m) { m.curPayers.forEach(function (a) { if (a.payType === 'EMP') people[a.empCode] = 1; else cash[a.name] = 1; }); }); });
    var shown = rooms.slice(0, P.mall ? 5000 : 300);
    pg.innerHTML = '<div class="grid g4">' + kpi('ห้อง/บ้าน', nf(all.length), '', 'มิเตอร์ ' + nf(all.reduce(function (s, r) { return s + r.meters.length; }, 0)) + ' ตัว', 'var(--water-soft)', 'building') +
      kpi('ผู้พัก (หักเงินเดือน)', nf(Object.keys(people).length), 'คน', 'รหัส 7 หลัก', 'var(--ok-soft)', 'users') + kpi('ผู้พักชำระเงินสด', nf(Object.keys(cash).length), 'คน', 'นิสิตแพทย์ / แพทย์ฝึกหัด', 'var(--elec-soft)', 'cash') +
      kpi('ไม่เรียกเก็บ', nf(all.filter(function (r) { return r.meters.some(function (m) { return m.status !== 'OCC'; }); }).length), 'ห้อง', 'ห้องเวร · ว่าง · นานาชาติ · ส่วนกลาง', 'var(--violet-soft)', 'info') + '</div>' +
      '<div class="card flat mt12"><div class="row"><select class="inp" id="mb" style="width:auto">' + S.boot.buildings.map(function (b) { return '<option value="' + b.id + '"' + (b.id === P.mbld ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '<option value="*"' + (P.mbld === '*' ? ' selected' : '') + '>ทุกที่พัก</option></select>' +
      '<input class="inp" id="mq" placeholder="ค้นหาห้อง / ชื่อ / รหัส" style="max-width:240px" value="' + esc(P.mq || '') + '">' +
      '<div class="seg" id="mf">' + [['', 'ทั้งหมด'], ['EMPTY', 'ไม่มีผู้จ่าย'], ['NC', 'ไม่เรียกเก็บ'], ['CASH', 'เงินสด'], ['NF', 'ไม่พบใน API']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + ((P.mf || '') === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<span class="grow"></span><span class="small muted">' + nf(rooms.length) + ' ห้อง</span></div></div>' +
      '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>ห้อง</th><th>ชั้น</th><th>มิเตอร์</th><th>ผู้จ่ายปัจจุบัน</th><th></th></tr></thead><tbody>' +
      shown.map(function (r) {
        var pay = {}; r.meters.forEach(function (m) { m.curPayers.forEach(function (a) { var k = a.payType + (a.empCode || a.name); pay[k] = pay[k] || { a: a, kinds: [] }; pay[k].kinds.push(m.kind); }); });
        return '<tr><td class="nowrap"><b style="font-size:15px">' + esc(r.room) + '</b>' + (r.newRoom ? ' <span class="muted small">(' + esc(r.newRoom) + ')</span>' : '') + (P.mbld === '*' ? '<div class="tiny muted">' + esc(bldOf(r.bld).short) + '</div>' : '') + '</td><td>' + esc(r.floor || '-') + '</td>' +
          '<td>' + r.meters.map(function (m) { return '<span class="tag ' + (m.kind === 'W' ? 'water' : 'elec') + '" title="' + esc(m.id) + '">' + KIND_SHORT[m.kind] + (m.label !== '1' ? ' ' + esc(m.label === 'ห้องโถง' ? 'โถง' : m.label) : '') + (m.status !== 'OCC' ? ' · ' + MST_TH[m.status] : '') + '</span> '; }).join('') + '</td>' +
          '<td>' + (Object.keys(pay).length ? Object.keys(pay).map(function (k) { var x = pay[k], a = x.a; return '<span class="payer">' + (a.payType === 'EMP' ? staffTag(a.empCode) : '<span class="tag elec">สด</span>') + ' ' + esc(a.name) + ' <span class="c">' + esc(a.empCode) + '</span>' + (x.kinds.length < r.meters.length ? ' <span class="tiny muted">(' + x.kinds.map(function (k2) { return KIND_SHORT[k2]; }).join('/') + ')</span>' : '') + '</span>'; }).join('<br>') : '<span class="muted small">—</span>') + '</td>' +
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
/** จัดการห้อง: มิเตอร์ทั้งหมดของห้อง + ผู้จ่ายแต่ละมิเตอร์ (ย้ายเข้า / ย้ายออก / แก้วันที่ / ลบ) */
function roomDialog(key, redraw) {
  var room = roomsOf('*').filter(function (r) { return r.key === key; })[0];
  if (!room) return;
  var rd = S.round;
  var html = '<div class="row between"><div class="small muted">' + esc(bldOf(room.bld).name) + ' · ชั้น ' + esc(room.floor || '-') + '</div><div class="row"><button class="btn sm primary" id="rm-in">' + ic('login') + ' ย้ายเข้า</button><button class="btn sm" id="rm-addm">' + ic('plus') + ' เพิ่มมิเตอร์ในห้องนี้</button></div></div>';
  room.meters.forEach(function (m) {
    html += '<div class="card flat mt12" style="padding:12px"><div class="row between"><div>' + kindIc(m.kind) + ' <b>' + KIND_TH[m.kind] + (m.label !== '1' ? ' · ' + esc(m.label === 'ห้องโถง' ? 'มิเตอร์ห้องโถง' : 'มิเตอร์ ' + m.label) : '') + '</b> <span class="tag ' + (m.status === 'OCC' ? 'ok' : 'warn') + '">' + MST_TH[m.status] + '</span> <span class="tiny muted">' + esc(m.id) + '</span></div>' +
      '<div class="row"><span class="small muted">เลขล่าสุด <b>' + (m.lastReading != null ? nf(m.lastReading) : '-') + '</b>' + (m.avgUsage ? ' · เฉลี่ย ' + nf(m.avgUsage) : '') + '</span><button class="btn sm ghost" data-em="' + esc(m.id) + '">' + ic('settings') + ' แก้มิเตอร์</button></div></div>' +
      '<table class="t mt8"><thead><tr><th>ผู้จ่าย</th><th>ประเภท</th><th>ย้ายเข้า</th><th>ย้ายออก</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' +
      (m.payers.length ? m.payers.map(function (a) {
        var ended = a.endDate && a.endDate < today();
        return '<tr style="' + (ended ? 'opacity:.55' : '') + '"><td>' + (a.payType === 'EMP' ? staffTag(a.empCode) + ' ' : '') + esc(a.name) + ' <span class="muted small">' + esc(a.empCode) + '</span></td><td>' + (a.payType === 'EMP' ? '<span class="tag ok">หักเงินเดือน</span>' : '<span class="tag elec">เงินสด</span>') + '</td>' +
          '<td>' + thDate(a.startDate) + '</td><td>' + (a.endDate ? thDate(a.endDate) : '<span class="muted">พักอยู่</span>') + '</td><td class="small">' + esc(a.note || '') + '</td>' +
          '<td class="nowrap">' + (!a.endDate ? '<button class="btn sm" data-out="' + a.id + '">' + ic('out') + ' ย้ายออก</button> ' : '') + '<button class="btn sm ghost icon" data-ea="' + a.id + '" title="แก้วันที่">' + ic('edit') + '</button><button class="btn sm ghost icon" data-da="' + a.id + '" title="ลบ (บันทึกผิด)">' + ic('trash') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="muted small">ยังไม่มีผู้จ่าย</td></tr>') + '</tbody></table></div>';
  });
  var dlg = modal({ title: 'ห้อง ' + esc(room.room), body: html, wide: true, buttons: [{ label: 'ปิด' }], noFocus: true,
    onOpen: function (el, close) {
      var after = function (d) { setMaster(d.master); bindReadings(); close(); redraw(); roomDialog(key, redraw); };
      $('#rm-in', el).onclick = function () { moveInDialog(room, after); };
      $('#rm-addm', el).onclick = function () { close(); meterDialog(null, room); };
      $$('[data-em]', el).forEach(function (b) { b.onclick = function () { close(); meterDialog(S.master.byId[b.dataset.em]); }; });
      $$('[data-out]', el).forEach(function (b) { b.onclick = function () { moveOutDialog(b.dataset.out, room, after); }; });
      $$('[data-ea]', el).forEach(function (b) { b.onclick = function () { editAssignDialog(b.dataset.ea, after); }; });
      $$('[data-da]', el).forEach(function (b) { b.onclick = function () { confirmBox('ลบรายการผู้จ่าย', 'ใช้กรณีบันทึกผิดเท่านั้น (ถ้าย้ายออกจริง ให้กด "ย้ายออก" เพื่อเก็บประวัติ)', 'ลบ', 'danger').then(function (y) { if (y) api('deleteAssign', { assignIds: [b.dataset.da] }).then(after).catch(errToast); }); }; });
    } });
  return dlg;
}
function moveInDialog(room, after) {
  var rd = S.round;
  modal({ title: 'ย้ายเข้า · ห้อง ' + esc(room.room),
    body: '<div class="seg" id="mi-t"><button data-t="EMP" class="on">หักเงินเดือน (รหัส 7 หลัก)</button><button data-t="CASH">ชำระเงินสด (นิสิต/แพทย์ฝึกหัด)</button></div>' +
      '<div class="field mt12" id="mi-emp"><label class="f">รหัสพนักงาน</label><div class="row"><input class="inp" id="mi-code" inputmode="numeric" maxlength="7" style="max-width:180px"><button class="btn" id="mi-look">' + ic('search') + ' ตรวจ</button></div><div id="mi-info" class="small mt8"></div></div>' +
      '<div class="field hide" id="mi-cash"><label class="f">ชื่อ-สกุล</label><input class="inp" id="mi-name"><label class="f mt8">รหัสนิสิต/อ้างอิง (ถ้ามี)</label><input class="inp" id="mi-ref" placeholder="เช่น Class 2028"></div>' +
      '<div class="field"><label class="f">มิเตอร์ที่ต้องจ่าย</label>' + room.meters.map(function (m) { return '<label class="check" style="margin-right:14px"><input type="checkbox" class="mi-m" value="' + esc(m.id) + '" ' + (m.label !== 'ห้องโถง' ? 'checked' : '') + '> ' + kindIc(m.kind) + ' ' + KIND_TH[m.kind] + (m.label !== '1' ? ' (' + esc(m.label) + ')' : '') + '</label>'; }).join('') + '</div>' +
      '<div class="grid g2"><div class="field"><label class="f">วันที่ย้ายเข้า (วันแรกที่พัก)</label><input class="inp" type="date" id="mi-start" value="' + today() + '"><div class="help">ค่าน้ำ/ไฟเดือนแรกคิดตามจำนวนวันที่พัก</div></div><div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="mi-note"></div></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('login') + ' บันทึกย้ายเข้า', cls: 'primary', onClick: function () {
      var t = $('#mi-t .on').dataset.t, ids = $$('.mi-m').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      return api('moveIn', { meterIds: ids, payType: t, empCode: t === 'EMP' ? $('#mi-code').value.trim() : $('#mi-ref').value.trim(), name: t === 'CASH' ? $('#mi-name').value.trim() : '', startDate: $('#mi-start').value, note: $('#mi-note').value.trim() })
        .then(function (d) { toast('บันทึกย้ายเข้าแล้ว', 'ok'); after(d); });
    } }],
    onOpen: function (el) {
      $$('#mi-t button', el).forEach(function (b) { b.onclick = function () { $$('#mi-t button', el).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); $('#mi-emp', el).classList.toggle('hide', b.dataset.t !== 'EMP'); $('#mi-cash', el).classList.toggle('hide', b.dataset.t === 'EMP'); }; });
      var look = function () {
        var c = $('#mi-code', el).value.trim(); if (!/^\d{7}$/.test(c)) return;
        $('#mi-info', el).innerHTML = '<span class="spin" style="width:14px;height:14px;border-width:2px"></span> กำลังตรวจกับระบบบุคลากร…';
        api('lookupEmp', { codes: [c] }).then(function (d) {
          var x = d.list[0];
          $('#mi-info', el).innerHTML = x && x.found ? '<div class="note ok">' + ic('check') + '<div><b>' + esc(x.name) + '</b><br>' + esc(x.position || '') + ' · ' + esc(x.division || '') + (x.empGroup ? '<br><span class="tag">' + esc(x.empGroup) + '</span>' : '') + '</div></div>' : '<div class="note danger">' + ic('alert') + '<div>ไม่พบรหัสนี้ในระบบบุคลากร หรือพ้นสภาพแล้ว</div></div>';
        }).catch(function (e) { $('#mi-info', el).innerHTML = '<span style="color:var(--danger)">' + esc(e.message) + '</span>'; });
      };
      $('#mi-look', el).onclick = look; $('#mi-code', el).oninput = function () { if (this.value.trim().length === 7) look(); };
    } });
}
function moveOutDialog(assignId, room, after) {
  var a = S.master.assigns.filter(function (x) { return x.id === assignId; })[0];
  var same = []; room.meters.forEach(function (m) { m.payers.forEach(function (x) { if (!x.endDate && ((a.payType === 'EMP' && x.empCode === a.empCode) || (a.payType === 'CASH' && x.name === a.name))) same.push({ x: x, m: m }); }); });
  modal({ title: 'ย้ายออก · ' + esc(a.name),
    body: '<div class="field"><label class="f">วันที่ย้ายออก (วันสุดท้ายที่พัก)</label><input class="inp" type="date" id="mo-end" value="' + today() + '"></div>' +
      '<div class="field"><label class="f">มิเตอร์</label>' + same.map(function (s) { return '<label class="check" style="margin-right:14px"><input type="checkbox" class="mo-a" value="' + s.x.id + '" checked> ' + kindIc(s.m.kind) + ' ' + KIND_TH[s.m.kind] + (s.m.label !== '1' ? ' (' + esc(s.m.label) + ')' : '') + '</label>'; }).join('') + '</div><div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="mo-note" placeholder="เช่น ลาออก / ย้ายไปหอเทพฯ"></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('out') + ' บันทึกย้ายออก', cls: 'warn', onClick: function () {
      return api('moveOut', { assignIds: $$('.mo-a').filter(function (x) { return x.checked; }).map(function (x) { return x.value; }), endDate: $('#mo-end').value, note: $('#mo-note').value.trim() }).then(function (d) { toast('บันทึกย้ายออกแล้ว', 'ok'); after(d); });
    } }] });
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
      buttons: d.diffs.length ? [{ label: 'ปิด' }, { label: 'แก้ชื่อในทะเบียนให้ตรงระบบบุคลากร', cls: 'primary', onClick: function () { return api('refreshNames', { apply: true }).then(function () { toast('แก้ชื่อแล้ว', 'ok'); S.master = null; route(); }); } }] : [{ label: 'ปิด', cls: 'primary', onClick: function () { S.master = null; route(); } }] });
  }).catch(function (e) { busy(btn, false); errToast(e); });
}
