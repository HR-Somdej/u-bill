/* SOMDEJ U-Bill — pages-admin.js : ผู้ใช้งาน · ตั้งค่า/อัตรา · นำเข้าประวัติ · ประวัติการใช้งาน */
PAGES.users = function () {
  var pg = shell(isHR() ? 'ผู้ใช้งาน' : 'ผู้ใช้ (หน่วยช่าง)', 'เข้าระบบแบบเดียวกับ HR Connect: ครั้งแรกใช้รหัสพนักงาน + เลขบัตรประชาชน แล้วตั้งรหัสผ่านเอง', '<button class="btn primary" id="u-add">' + ic('plus') + ' เพิ่มผู้ใช้</button>');
  pg.innerHTML = loadingHtml();
  $('#u-add').onclick = function () { userDialog(null); };
  api('listUsers').then(function (L) {
    pg.innerHTML = '<div class="tbl-wrap" style="max-height:none"><table class="t"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>บทบาท</th><th>ตำแหน่ง / สังกัด</th><th>รหัสผ่าน</th><th>เข้าล่าสุด</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
      L.map(function (u) {
        var canE = isHR() || u.role === 'TECH';
        return '<tr style="' + (u.active ? '' : 'opacity:.55') + '"><td>' + esc(u.empCode) + (u.main ? ' <span class="tag navy">หลัก</span>' : '') + '</td><td><b>' + esc(u.name || '(ยังไม่เคยเข้าระบบ)') + '</b></td><td>' + esc(u.roleTh) + '</td><td class="small">' + esc(u.position || '') + '<div class="muted">' + esc(u.division || '') + '</div></td>' +
          '<td>' + (u.pw === 'SET' ? '<span class="tag ok">ตั้งแล้ว</span>' : u.pw === 'TEMP' ? '<span class="tag warn">รหัสชั่วคราว</span>' : '<span class="tag">ยังไม่ตั้ง</span>') + '</td><td class="small">' + (u.lastLoginAt ? thDate(u.lastLoginAt) : '-') + '</td><td>' + (u.active ? '<span class="tag ok">ใช้งาน</span>' : '<span class="tag">ปิด</span>') + '</td>' +
          '<td class="nowrap">' + (canE ? '<button class="btn sm" data-e="' + esc(u.empCode) + '">' + ic('edit') + '</button> ' : '') + (isHR() && u.pw && u.empCode !== S.me.empCode ? '<button class="btn sm" data-r="' + esc(u.empCode) + '">' + ic('key') + ' รีเซ็ต</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="note info mt16">' + ic('info') + '<div><b>บทบาท</b> · <b>HR</b> ทุกอย่าง (ตรวจ ล็อก ส่งออก Import HRMi ตั้งค่า) · <b>ฝ่ายอาคาร</b> ทะเบียน ย้ายเข้า/ออก จดมิเตอร์ ส่งรอบ ไฟล์ตรวจสอบ แดชบอร์ด · <b>หน่วยช่าง</b> เฉพาะหน้าเดินจดมิเตอร์ · <b>ผู้บริหาร</b> แดชบอร์ดอย่างเดียว</div></div>';
    $$('[data-e]', pg).forEach(function (b) { b.onclick = function () { userDialog(L.filter(function (u) { return u.empCode === b.dataset.e; })[0]); }; });
    $$('[data-r]', pg).forEach(function (b) {
      b.onclick = function () {
        confirmBox('รีเซ็ตรหัสผ่าน ' + b.dataset.r, 'ระบบจะออกรหัสผ่านชั่วคราว (ใช้ได้ 72 ชม.) ให้แจ้งเจ้าตัวโดยตรง เมื่อเข้าระบบจะต้องตั้งรหัสใหม่', 'รีเซ็ต', 'warn').then(function (y) {
          if (y) api('adminResetPassword', { empCode: b.dataset.r }).then(function (d) { modal({ title: 'รหัสผ่านชั่วคราว', body: '<p>รหัส ' + esc(d.empCode) + '</p><div class="bigin" style="user-select:all">' + esc(d.temp) + '</div><p class="small muted mt8">หมดอายุ ' + thDate(d.expiresAt) + ' · แสดงครั้งเดียว</p>', buttons: [{ label: 'ปิด', cls: 'primary' }] }); }).catch(errToast);
        });
      };
    });
  }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
};
function userDialog(u) {
  var isNew = !u; u = u || { empCode: '', role: isHR() ? 'BLD' : 'TECH', active: true, note: '' };
  var roles = isHR() ? [['HR', 'ผู้ดูแลระบบ (HR)'], ['BLD', 'ฝ่ายอาคาร'], ['TECH', 'หน่วยช่าง (จดมิเตอร์)'], ['EXEC', 'ผู้บริหาร (ดูแดชบอร์ด)']] : [['TECH', 'หน่วยช่าง (จดมิเตอร์)']];
  var cur = String(u.role).split(',');
  modal({ title: isNew ? 'เพิ่มผู้ใช้' : 'แก้ไขผู้ใช้ ' + esc(u.empCode),
    body: '<div class="field"><label class="f">รหัสพนักงาน (7 หลัก)</label><input class="inp" id="u-code" inputmode="numeric" maxlength="7" value="' + esc(u.empCode) + '" ' + (isNew ? '' : 'disabled') + '><div class="help">ระบบดึงชื่อ/ตำแหน่งจากระบบบุคลากรให้อัตโนมัติ</div></div>' +
      '<div class="field"><label class="f">บทบาท</label>' + roles.map(function (r) { return '<label class="check" style="display:flex;margin:4px 0"><input type="checkbox" class="u-r" value="' + r[0] + '" ' + (cur.indexOf(r[0]) >= 0 ? 'checked' : '') + '> ' + r[1] + '</label>'; }).join('') + '</div>' +
      '<div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="u-note" value="' + esc(u.note || '') + '"></div><label class="check"><input type="checkbox" id="u-act" ' + (u.active ? 'checked' : '') + '> เปิดใช้งาน</label>',
    buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      var r = $$('.u-r').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
      return api('saveUser', { user: { empCode: $('#u-code').value.trim(), role: r.join(','), note: $('#u-note').value, active: $('#u-act').checked } }).then(function () { toast('บันทึกแล้ว', 'ok'); route(); });
    } }] });
}

/* =================================================================== ตั้งค่า */
PAGES.settings = function () {
  var pg = shell('ตั้งค่า · อัตรา', 'อัตราค่าน้ำ/ค่าไฟ/ค่าเหมามิเตอร์เสีย (เก็บประวัติ) · กฎการคำนวณ · ที่พัก · การเชื่อมต่อ');
  pg.innerHTML = loadingHtml();
  api('getSettings').then(function (d) { renderSettings(pg, d); }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
};
function renderSettings(pg, d) {
  var s = d.settings, hr = d.canEdit, dis = hr ? '' : 'disabled';
  var cur = d.current;
  pg.innerHTML = '<div class="grid g3">' +
    kpi('ค่าน้ำ', nf(cur.W), 'บาท/หน่วย', esc(cur.ref.W || ''), 'var(--water-soft)', 'drop') + kpi('ค่าไฟ', nf(cur.E), 'บาท/หน่วย', esc(cur.ref.E || ''), 'var(--elec-soft)', 'bolt') + kpi('ค่าเหมามิเตอร์เสีย', nf(cur.FLAT), 'บาท', (s.brokenMode === 'PER_METER' ? 'ต่อมิเตอร์ (แล้วหาร)' : 'ต่อคน') + ' · ' + esc(cur.ref.FLAT || ''), 'var(--violet-soft)', 'tool') + '</div>' +
    '<div class="card mt16"><div class="ch"><h3>' + ic('history') + ' ประวัติอัตรา</h3>' + (hr ? '<button class="btn primary sm" id="st-rate">' + ic('plus') + ' ปรับอัตรา</button>' : '') + '</div>' +
    '<div class="tbl-wrap" style="max-height:none"><table class="t"><thead><tr><th>ประเภท</th><th class="n">อัตรา</th><th>มีผลตั้งแต่รอบ</th><th>เอกสารอ้างอิง</th><th>หมายเหตุ</th><th>บันทึกโดย</th></tr></thead><tbody>' +
    d.rates.map(function (r) { return '<tr><td>' + ({ W: kindIc('W') + ' ค่าน้ำ', E: kindIc('E') + ' ค่าไฟ', FLAT: ic('tool') + ' มิเตอร์เสีย' }[r.kind]) + '</td><td class="n"><b>' + nf(r.rate) + '</b></td><td>' + rTh(r.from, true) + ' <span class="muted small">' + esc(r.from) + '</span></td><td class="small">' + esc(r.ref) + '</td><td class="small">' + esc(r.note) + '</td><td class="small">' + esc(r.by) + ' · ' + thDate(r.at) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="tiny muted mt8">อัตราที่ใช้กับรอบ = อัตราล่าสุดที่ "มีผลตั้งแต่รอบ" ไม่เกินรอบนั้น · รอบที่ล็อกแล้วไม่เปลี่ยนตาม</p></div>' +
    '<div class="grid g2 mt16"><div class="card"><h3>' + ic('settings') + ' กฎการคำนวณ / แจ้งเตือน</h3>' +
    '<div class="field"><label class="f">ค่าเหมามิเตอร์เสีย คิดแบบ</label><select class="inp" id="st-bm" ' + dis + '><option value="PER_PERSON"' + (s.brokenMode === 'PER_PERSON' ? ' selected' : '') + '>ต่อคน (ตามไฟล์เดิม: 2 คนในห้อง = คนละ 15)</option><option value="PER_METER"' + (s.brokenMode === 'PER_METER' ? ' selected' : '') + '>ต่อมิเตอร์ แล้วหารตามจำนวนคน</option></select></div>' +
    '<div class="grid g2"><div class="field"><label class="f">เตือนเมื่อหน่วยใช้เกินค่าเฉลี่ย × </label><input class="inp" id="st-af" value="' + esc(s.alertFactor) + '" ' + dis + '></div><div class="field"><label class="f">ไม่เตือนถ้าใช้น้อยกว่า (หน่วย)</label><input class="inp" id="st-am" value="' + esc(s.alertMinUnits) + '" ' + dis + '></div></div>' +
    '<div class="field"><label class="f">กลุ่มการจ้าง/สถานะที่ HRMi มักถอยรายการ (คั่นด้วย ,)</label><input class="inp" id="st-wg" value="' + esc(s.warnGroups) + '" ' + dis + '></div>' +
    '<div class="grid g2"><div class="field"><label class="f">รหัสรายหัก HRMi ค่าน้ำ</label><input class="inp" id="st-cw" value="' + esc(s.hrmiCodeW) + '" ' + dis + '></div><div class="field"><label class="f">รหัสรายหัก HRMi ค่าไฟ</label><input class="inp" id="st-ce" value="' + esc(s.hrmiCodeE) + '" ' + dis + '></div></div></div>' +
    '<div class="card"><h3>' + ic('link') + ' ระบบ / การเชื่อมต่อ</h3>' +
    '<div class="field"><label class="f">SmartAPI base</label><input class="inp" id="st-ab" value="' + esc(s.apiBase) + '" ' + dis + '></div><div class="field"><label class="f">path ข้อมูลพนักงาน</label><input class="inp" id="st-ap" value="' + esc(s.apiEmpPath) + '" ' + dis + '><div class="help">ปัจจุบันใช้ /uat/ — เมื่อ IT เปิด production ให้แก้ที่นี่</div></div>' +
    '<div class="field"><label class="f">ลิงก์หน้าเว็บ</label><input class="inp" id="st-web" value="' + esc(s.webUrl) + '" ' + dis + '></div><div class="field"><label class="f">เบอร์ติดต่อ HR</label><input class="inp" id="st-ph" value="' + esc(s.supportPhone) + '" ' + dis + '></div>' +
    '<div class="field"><label class="f">ประกาศบนหน้าระบบ</label><input class="inp" id="st-an" value="' + esc(s.announcement) + '" ' + dis + '></div><label class="check"><input type="checkbox" id="st-mt" ' + (s.maintenance === 'TRUE' ? 'checked' : '') + ' ' + dis + '> ปิดปรับปรุง (เข้าได้เฉพาะ HR)</label>' +
    (hr ? '<div class="row mt12"><button class="btn" id="st-test">' + ic('refresh') + ' ทดสอบ SmartAPI</button><span id="st-tr" class="small"></span></div>' : '') + '</div></div>' +
    (hr ? '<div class="stickybar row"><span class="grow"></span><button class="btn primary" id="st-save">' + ic('check') + ' บันทึกการตั้งค่า</button></div>' : '') +
    '<div class="card mt16"><div class="ch"><h3>' + ic('building') + ' ที่พัก</h3>' + (hr ? '<button class="btn sm" id="st-badd">' + ic('plus') + ' เพิ่มที่พัก</button>' : '') + '</div><div class="tbl-wrap" style="max-height:none"><table class="t"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>ชื่อย่อ</th><th>ชื่อไฟล์ Import HRMi</th><th class="n">ลำดับ</th><th></th></tr></thead><tbody>' +
    d.buildings.map(function (b) { return '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.name) + '</td><td>' + esc(b.short) + '</td><td>' + esc(b.hrmiName) + '.xls</td><td class="n">' + b.sort + '</td><td>' + (hr ? '<button class="btn sm" data-b="' + b.id + '">' + ic('edit') + '</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>' +
    (hr ? '<div class="card mt16"><h3>' + ic('upload') + ' นำเข้าประวัติจากไฟล์เดิม (แดชบอร์ด ปี 2568–2569)</h3><p class="small muted">เลือก<b>โฟลเดอร์ปี</b> (เช่น <code>03.เงินหัก 3rd party-สมเด็จฯ/2568</code> แล้วทำซ้ำกับ 2569) ระบบอ่านไฟล์ค่าน้ำ/ค่าไฟของทุกเดือนในเครื่องของท่าน (ไม่อัปโหลดไฟล์) ใช้ไฟล์ในโฟลเดอร์ "3.เงินหักสรุป…" ก่อน (มียอดนำส่งจริง) ถ้าไม่มีจะใช้ไฟล์ดิบ · นำเข้าซ้ำได้ (แทนที่เดือนเดิม) · รอบที่ล็อกในระบบแล้วใช้ข้อมูลระบบแทน</p>' +
      '<div class="row"><label class="btn">' + ic('layers') + ' เลือกโฟลเดอร์ปี<input type="file" id="st-hd" webkitdirectory directory multiple class="sr"></label><label class="btn">' + ic('file') + ' เลือกหลายไฟล์<input type="file" id="st-hf" accept=".xls,.xlsx" multiple class="sr"></label></div><div id="st-hp" class="mt12"></div></div>' : '');
  if (!hr) return;
  $('#st-save').onclick = function () {
    var btn = this; busy(btn, true);
    api('saveSettings', { settings: { brokenMode: $('#st-bm').value, alertFactor: $('#st-af').value, alertMinUnits: $('#st-am').value, warnGroups: $('#st-wg').value, hrmiCodeW: $('#st-cw').value, hrmiCodeE: $('#st-ce').value, apiBase: $('#st-ab').value, apiEmpPath: $('#st-ap').value, webUrl: $('#st-web').value, supportPhone: $('#st-ph').value, announcement: $('#st-an').value, maintenance: $('#st-mt').checked ? 'TRUE' : 'FALSE' } })
      .then(function () { busy(btn, false); toast('บันทึกการตั้งค่าแล้ว', 'ok'); return api('bootstrap'); }).then(function (b) { applyBoot(b); route(); }).catch(function (e) { busy(btn, false); errToast(e); });
  };
  $('#st-test').onclick = function () { var btn = this; busy(btn, true); api('testApi', {}).then(function (r) { busy(btn, false); $('#st-tr').innerHTML = '<span class="dot ok"></span> ตอบใน ' + r.ms + ' ms · ' + (r.sample ? esc(r.sample.name) + ' · ' + esc(r.sample.group) : 'ไม่พบข้อมูล') + '<div class="tiny muted">' + esc(r.path) + (r.sample ? '<br>ฟิลด์: ' + esc(r.sample.fields.join(', ')) : '') + '</div>'; }).catch(function (e) { busy(btn, false); $('#st-tr').innerHTML = '<span style="color:var(--danger)">' + esc(e.message) + '</span>'; }); };
  $('#st-rate').onclick = function () {
    var nx = S.round ? S.round.id : '';
    modal({ title: 'ปรับอัตรา', body: '<div class="grid g2"><div class="field"><label class="f">ประเภท</label><select class="inp" id="ra-k"><option value="E">ค่าไฟ (บาท/หน่วย)</option><option value="W">ค่าน้ำ (บาท/หน่วย)</option><option value="FLAT">ค่าเหมามิเตอร์เสีย (บาท)</option></select></div><div class="field"><label class="f">อัตราใหม่</label><input class="inp" id="ra-r" inputmode="decimal"></div></div>' +
      '<div class="field"><label class="f">มีผลตั้งแต่รอบหักเงิน (พ.ศ. ปปปป-ดด)</label><input class="inp" id="ra-f" value="' + esc(nx) + '" placeholder="2569-12"></div><div class="field"><label class="f">เอกสารอ้างอิง</label><input class="inp" id="ra-ref" placeholder="เช่น ประกาศ รพ. ที่ …/2569"></div><div class="field"><label class="f">หมายเหตุ</label><input class="inp" id="ra-n"></div>' +
      '<label class="check"><input type="checkbox" id="ra-ap" checked> ปรับรอบที่ยังไม่ล็อก (ตั้งแต่รอบนี้) ด้วย</label>',
      buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึกอัตรา', cls: 'primary', onClick: function () { return api('addRate', { kind: $('#ra-k').value, rate: $('#ra-r').value, from: $('#ra-f').value.trim(), ref: $('#ra-ref').value, note: $('#ra-n').value, applyOpen: $('#ra-ap').checked }).then(function () { toast('บันทึกอัตราแล้ว', 'ok'); return api('bootstrap').then(function (b) { applyBoot(b); S.roundData = null; route(); }); }); } }] });
  };
  var bDlg = function (b) {
    var isNew = !b; b = b || { id: '', name: '', short: '', hrmiName: '', sort: 99 };
    modal({ title: isNew ? 'เพิ่มที่พัก' : 'แก้ไข ' + esc(b.name), body: '<div class="grid g2"><div class="field"><label class="f">รหัส (A–Z 2–6 ตัว)</label><input class="inp" id="bb-id" value="' + esc(b.id) + '" ' + (isNew ? '' : 'disabled') + '></div><div class="field"><label class="f">ลำดับ</label><input class="inp" id="bb-s" value="' + b.sort + '"></div></div><div class="field"><label class="f">ชื่อเต็ม</label><input class="inp" id="bb-n" value="' + esc(b.name) + '"></div><div class="grid g2"><div class="field"><label class="f">ชื่อย่อ</label><input class="inp" id="bb-sh" value="' + esc(b.short) + '"></div><div class="field"><label class="f">ชื่อไฟล์ Import HRMi</label><input class="inp" id="bb-h" value="' + esc(b.hrmiName) + '"></div></div>',
      buttons: [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () { return api('saveBuilding', { building: { id: $('#bb-id').value.trim().toUpperCase(), name: $('#bb-n').value, short: $('#bb-sh').value, hrmiName: $('#bb-h').value, sort: $('#bb-s').value } }).then(function (L) { S.boot.buildings = L; toast('บันทึกแล้ว', 'ok'); route(); }); } }] });
  };
  if ($('#st-badd')) $('#st-badd').onclick = function () { bDlg(null); };
  $$('[data-b]', pg).forEach(function (x) { x.onclick = function () { bDlg(d.buildings.filter(function (b) { return b.id === x.dataset.b; })[0]); }; });
  var onPick = function () {
    var files = this.files; if (!files || !files.length) return;
    var box = $('#st-hp'); box.innerHTML = '<div class="loading"><span class="spin"></span><span id="st-hpg">กำลังอ่านไฟล์…</span></div>';
    XIO.readOldFiles(files, function (i, n) { var el = $('#st-hpg'); if (el) el.textContent = 'กำลังอ่านไฟล์ ' + i + ' / ' + n; }).then(function (res) {
      var R = res.rows, months = {}; R.forEach(function (r) { months[r.round] = (months[r.round] || 0) + 1; });
      if (!R.length) { box.innerHTML = '<div class="note warn">' + ic('alert') + '<div>ไม่พบไฟล์ค่าน้ำ/ค่าไฟรูปแบบเดิมในที่เลือก</div></div>'; return; }
      box.innerHTML = '<div class="note info">' + ic('info') + '<div>อ่าน ' + res.files + ' ไฟล์ → ' + R.length + ' รายการ (' + Object.keys(months).length + ' เดือน)' + (res.skipped.length ? ' · ข้าม ' + res.skipped.length + ' ไฟล์' : '') + '</div></div>' +
        '<div class="tbl-wrap mt8" style="max-height:320px"><table class="t"><thead><tr><th>รอบ</th><th>ที่พัก</th><th>ประเภท</th><th class="n">มิเตอร์</th><th class="n">หน่วย</th><th class="n">เรียกเก็บ</th><th class="n">หักเงินเดือน</th><th class="n">คน</th><th class="n">เงินสด</th><th>ไฟล์</th></tr></thead><tbody>' +
        R.map(function (r) { return '<tr><td>' + rTh(r.round, true) + '</td><td>' + esc(bldOf(r.bld).short) + '</td><td>' + kindIc(r.kind) + '</td><td class="n">' + r.meters + '</td><td class="n">' + nf(r.units) + '</td><td class="n">' + baht(r.billed) + '</td><td class="n">' + baht(r.deducted) + '</td><td class="n">' + r.persons + '</td><td class="n">' + baht(r.cash) + '</td><td class="tiny muted">' + esc(r.file) + (r.noSend ? ' (ไม่มียอดนำส่ง)' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="row mt12"><button class="btn primary" id="st-hgo">' + ic('upload') + ' นำเข้า ' + R.length + ' รายการ</button></div>';
      $('#st-hgo').onclick = function () {
        var btn = this; busy(btn, true, 'กำลังนำเข้า');
        api('importHistory', { rows: R.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { if (k !== 'file' && k !== 'prio' && k !== 'noSend') o[k] = r[k]; }); return o; }), fileName: 'ไฟล์เดิม ' + res.files + ' ไฟล์' })
          .then(function (d) { busy(btn, false); toast('นำเข้าประวัติ ' + d.imported + ' รายการแล้ว — ดูที่แดชบอร์ด', 'ok', 6000); }).catch(function (e) { busy(btn, false); errToast(e); });
      };
    }).catch(function (e) { box.innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
  };
  if ($('#st-hd')) $('#st-hd').onchange = onPick;
  if ($('#st-hf')) $('#st-hf').onchange = onPick;
}

/* =================================================================== ประวัติการใช้งาน */
PAGES.audit = function () {
  var pg = shell('ประวัติการใช้งาน', 'บันทึกทุกการเข้าระบบ · แก้ไข · นำเข้า · ล็อก · ส่งออก');
  var load = function (q) {
    $('#au-b').innerHTML = loadingHtml();
    api('listAudit', { q: q || '', limit: 500 }).then(function (L) {
      $('#au-b').innerHTML = '<div class="tbl-wrap"><table class="t"><thead><tr><th>เวลา</th><th>ผู้ทำ</th><th>การกระทำ</th><th>เป้าหมาย</th><th>รายละเอียด</th></tr></thead><tbody>' +
        L.map(function (x) { return '<tr><td class="nowrap small">' + thDate(x.ts) + '</td><td>' + esc(x.actor) + '</td><td><span class="tag">' + esc(x.action) + '</span></td><td class="small">' + esc(x.target) + '</td><td class="tiny muted" style="max-width:520px;word-break:break-all">' + esc(String(x.detail).slice(0, 300)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }).catch(function (e) { $('#au-b').innerHTML = '<div class="note danger">' + esc(e.message) + '</div>'; });
  };
  pg.innerHTML = '<div class="row"><input class="inp" id="au-q" placeholder="ค้นหา (รหัส / การกระทำ / ห้อง)" style="max-width:320px"><button class="btn" id="au-go">' + ic('search') + ' ค้นหา</button></div><div id="au-b" class="mt12"></div>';
  $('#au-go').onclick = function () { load($('#au-q').value); };
  $('#au-q').onkeydown = function (e) { if (e.key === 'Enter') load(this.value); };
  load('');
};
