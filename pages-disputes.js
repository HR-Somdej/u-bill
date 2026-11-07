/* SOMDEJ U-Bill — pages-disputes.js : เรื่องแจ้งยอดผิดพลาดจากผู้พัก (ฝ่ายอาคาร/HR) (build 2569-11-08.1) */
var DST = { NEW: ['รับเรื่องแล้ว', 'danger'], CHECKING: ['กำลังตรวจสอบ', 'elec'], FIXED: ['แก้ไขยอดแล้ว', 'ok'], CONFIRMED: ['ยอดถูกต้อง', 'water'] };
PAGES.disputes = function () {
  var pg = shell('เรื่องแจ้งจากผู้พัก', 'ผู้พักแจ้งยอดค่าน้ำ–ค่าไฟผิดพลาดผ่านหน้า "ค่าน้ำไฟของฉัน" · ระบบอีเมลแจ้งฝ่ายอาคารทันที', '<a class="btn" href="me.html" target="_blank">' + ic('link') + ' หน้าของผู้พัก</a>');
  pg.innerHTML = loadingHtml();
  Promise.all([api('listDisputes', {}), loadMaster()]).then(function (r) { renderDisputes(pg, r[0].list); }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
};
function renderDisputes(pg, list) {
  var f = pg._f || 'OPEN';
  var draw = function () {
    var L = list.filter(function (d) { return f === 'ALL' || (f === 'OPEN' ? (d.status === 'NEW' || d.status === 'CHECKING') : d.status === f); });
    var cnt = function (s) { return list.filter(function (d) { return s === 'OPEN' ? d.status === 'NEW' || d.status === 'CHECKING' : d.status === s; }).length; };
    pg.innerHTML = '<div class="row"><div class="seg" id="ds-f">' + [['OPEN', 'รอดำเนินการ (' + cnt('OPEN') + ')'], ['FIXED', 'แก้ไขแล้ว (' + cnt('FIXED') + ')'], ['CONFIRMED', 'ยอดถูกต้อง (' + cnt('CONFIRMED') + ')'], ['ALL', 'ทั้งหมด']].map(function (x) { return '<button data-f="' + x[0] + '" class="' + (f === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      (L.length ? '<div class="tbl-wrap mt12"><table class="t"><thead><tr><th>เลขเรื่อง</th><th>รอบ</th><th>ผู้แจ้ง</th><th>เรื่อง</th><th>รายละเอียด</th><th>สถานะ</th><th>ผลตรวจ</th><th></th></tr></thead><tbody>' +
        L.map(function (d) { var s = DST[d.status] || [d.status, '']; return '<tr><td class="small">' + esc(d.id) + '<div class="tiny muted">' + thDate(d.createdAt) + '</div></td><td>' + rTh(d.round) + '</td><td><b>' + esc(d.name) + '</b><div class="tiny muted">' + esc(d.empCode || d.rid) + '</div></td><td>' + (d.kind ? kindIc(d.kind) + ' ' : '') + esc(d.reason) + (d.photo ? ' <span class="tag">📷 รูป</span>' : '') + '</td><td class="small" style="max-width:260px">' + esc(d.detail) + '</td><td><span class="tag ' + s[1] + '">' + s[0] + '</span></td><td class="small" style="max-width:240px">' + esc(d.reply || '') + (d.repliedAt ? '<div class="tiny muted">' + esc(d.repliedBy) + ' · ' + thDate(d.repliedAt) + '</div>' : '') + '</td><td><button class="btn sm primary" data-d="' + esc(d.id) + '">' + ic('check') + ' ตรวจ</button></td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="mt12">' + emptyHtml(f === 'OPEN' ? 'ไม่มีเรื่องรอดำเนินการ' : 'ไม่มีรายการ', 'check') + '</div>');
    $$('#ds-f button').forEach(function (b) { b.onclick = function () { f = pg._f = b.dataset.f; draw(); }; });
    $$('[data-d]', pg).forEach(function (b) { b.onclick = function () { disputeDialog(list.filter(function (d) { return d.id === b.dataset.d; })[0], function (L2) { list = L2; draw(); refreshBadge(); }); }; });
  };
  draw();
}
function disputeDialog(d, done) {
  var res = resOf(d.rid), rooms = roomModel().rooms.filter(function (r) { return r.people.some(function (p) { return p.rid === d.rid; }); });
  modal({ title: 'เรื่อง ' + esc(d.id) + ' · ' + esc(d.name), wide: true,
    body: '<dl class="kv small"><dt>รอบ</dt><dd>' + rTh(d.round, true) + '</dd><dt>ผู้แจ้ง</dt><dd>' + esc(d.name) + ' (' + esc(d.empCode || d.rid) + ')</dd><dt>ห้องปัจจุบัน</dt><dd>' + (rooms.map(function (r) { return '<a href="#" data-room="' + esc(r.id) + '">' + esc(bldOf(r.bld).short + ' ' + r.room) + '</a>'; }).join(', ') || '-') + '</dd><dt>เรื่อง</dt><dd>' + (d.kind ? KIND_TH[d.kind] + ' · ' : '') + esc(d.reason) + '</dd><dt>รายละเอียด</dt><dd>' + esc(d.detail || '-') + '</dd><dt>แจ้งเมื่อ</dt><dd>' + thDate(d.createdAt) + '</dd></dl>' +
      (d.photo ? '<div class="mt8" id="dp-ph"><button class="btn sm" id="dp-lp">' + ic('eye') + ' ดูรูปที่แนบ</button></div>' : '') +
      '<div class="grid g2 mt12"><div class="field"><label class="f">สถานะ</label><select class="inp" id="dp-s">' + Object.keys(DST).map(function (k) { return '<option value="' + k + '"' + (k === d.status ? ' selected' : '') + '>' + DST[k][0] + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label class="f">ผลการตรวจสอบ (ผู้พักจะเห็นข้อความนี้)</label><textarea class="inp" id="dp-r" placeholder="เช่น ตรวจมิเตอร์ซ้ำแล้ว เลขจริง 1,090 แก้ไขยอดให้แล้ว">' + esc(d.reply || '') + '</textarea></div>' +
      '<p class="tiny muted">ถ้าต้องแก้เลขมิเตอร์: ไปที่ กรอกจากสมุด / ห้อง › แก้ไข (ถ้ารอบส่ง HR แล้ว ให้ HR ตีกลับ หรือแจ้ง HR แก้ให้)</p>',
    buttons: [{ label: 'ปิด' }, { label: 'บันทึกผลตรวจ', cls: 'primary', onClick: function () { return api('updateDispute', { id: d.id, status: $('#dp-s').value, reply: $('#dp-r').value.trim() }).then(function (r) { toast('บันทึกแล้ว — ผู้พักเห็นผลตรวจในหน้าของตน', 'ok'); done(r.list); }); } }],
    onOpen: function (el, close) {
      if ($('#dp-lp', el)) $('#dp-lp', el).onclick = function () { var b = this; busy(b, true); api('getDisputePhoto', { id: d.id }).then(function (x) { $('#dp-ph', el).innerHTML = '<img src="' + x.dataUrl + '" style="max-width:100%;max-height:420px;border-radius:10px">'; }).catch(function (e) { busy(b, false); errToast(e); }); };
      $$('[data-room]', el).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); close(); roomDialog(a.dataset.room); }; });
    } });
}
function refreshBadge() { api('getMaster').then(function (m) { setMaster(m); S.boot.disputesOpen = m.disputesOpen; renderNav(); }).catch(function () { }); }
