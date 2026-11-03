/* SOMDEJ U-Bill — pages-round.js : หน้ารอบหักเงิน (ภาพรวม · ความคืบหน้า · ส่ง/ตีกลับ/ล็อก) */
PAGES.round = function (args) {
  var pg = shell('รอบหักเงิน', 'ภาพรวมรอบปัจจุบัน · ความคืบหน้าการจดมิเตอร์ · ขั้นตอนส่งและล็อก');
  pg.innerHTML = loadingHtml();
  Promise.all([loadMaster(), loadRound(args[0] || '', true), api('getCharges', { round: args[0] || '' }).catch(function () { return null; })]).then(function (res) {
    var rdData = res[1], ch = res[2];
    bindReadings();
    renderRound(pg, rdData.round, ch);
  }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + ic('alert') + esc(e.message) + '</div>'; });
};
function renderRound(pg, rd, ch) {
  if (!rd) {
    pg.innerHTML = '<div class="card hero"><h2>ยังไม่มีรอบหักเงิน</h2><p class="muted">เริ่มรอบแรก: หักสิ้นเดือนที่เลือก จากหน่วยใช้เดือนก่อนหน้า (รหัสรอบ = รหัสงาน HRMi)</p>' +
      '<div class="row mt12"><select class="inp" id="nr-id" style="max-width:240px">' + roundOptions() + '</select><button class="btn amber" id="nr-go">' + ic('plus') + ' สร้างรอบ</button></div></div>' + masterHint();
    $('#nr-go').onclick = function () { createRoundAct($('#nr-id').value); };
    return;
  }
  var T = ch && ch.totals, M = S.master.meters, step = rd.status === 'OPEN' ? 1 : rd.status === 'SUBMITTED' ? 2 : 3;
  var prog = {};
  M.forEach(function (m) {
    var k = m.bld + '|' + m.kind, p = prog[k] = prog[k] || { bld: m.bld, kind: m.kind, total: 0, done: 0, need: 0 };
    p.total++; var need = m.status === 'OCC' && payersInRound(m, rd).length; if (need) p.need++;
    if (m._r && (m._r.curr != null || m._r.broken)) p.done++;
  });
  var totalAll = M.length, doneAll = M.filter(function (m) { return m._r && (m._r.curr != null || m._r.broken); }).length;
  var html = '<div class="card hero"><div class="row between"><div><div class="muted small">รอบหักเงิน · รหัสงาน HRMi ' + esc(rd.id) + '</div><h2>หักสิ้นเดือน ' + esc(rTh(rd.id, true)) + '</h2>' +
    '<div class="muted">หน่วยใช้ ' + esc(rd.usageTh) + ' · อัตรา น้ำ ' + nf(rd.rates.W) + ' · ไฟ ' + nf(rd.rates.E) + ' บาท/หน่วย · มิเตอร์เสีย ' + nf(rd.rates.FLAT) + ' บาท</div></div>' +
    '<div class="right"><div style="font-family:var(--font-head);font-size:40px;font-weight:700">' + pct(doneAll, totalAll) + '%</div><div class="muted small">จดแล้ว ' + nf(doneAll) + ' / ' + nf(totalAll) + ' มิเตอร์</div></div></div>' +
    '<div class="stepper"><div class="st ' + (step > 1 ? 'done' : 'now') + '"><i>1</i>ช่าง/ฝ่ายอาคาร จดมิเตอร์</div><div class="st ' + (step > 2 ? 'done' : step === 2 ? 'now' : '') + '"><i>2</i>ฝ่ายอาคารส่ง → HR ตรวจ</div><div class="st ' + (step === 3 ? 'now' : '') + '"><i>3</i>HR ล็อก → Import HRMi</div></div>' +
    '<div class="row mt12" id="r-acts"></div></div>';
  if (rd.returnReason && rd.status === 'OPEN') html += '<div class="note warn mt12">' + ic('undo') + '<div><b>HR ตีกลับเมื่อ ' + thDate(rd.returnedAt) + '</b> — ' + esc(rd.returnReason) + '</div></div>';
  if (rd.unlockReason && rd.status !== 'LOCKED') html += '<div class="note info mt12">' + ic('unlock') + '<div>ปลดล็อกเมื่อ ' + thDate(rd.unlockedAt) + ' — ' + esc(rd.unlockReason) + '</div></div>';
  if (T) {
    var bill = T.billed.W + T.billed.E, ded = T.deducted.W + T.deducted.E;
    html += '<div class="grid g4 mt16">' +
      kpi('ยอดเรียกเก็บ (คำนวณ)', baht(bill), 'บาท', 'น้ำ ' + baht(T.billed.W) + ' · ไฟ ' + baht(T.billed.E), 'var(--water-soft)', 'cash') +
      kpi('หักเงินเดือน (HRMi)', baht(ded), 'บาท', nf(T.persons - T.personsExcluded) + ' คน · ไม่หัก ' + nf(T.personsExcluded) + ' ราย', 'var(--ok-soft)', 'check') +
      kpi('ชำระเงินสด', baht(T.cash.W + T.cash.E), 'บาท', nf(T.cashPersons) + ' คน (นิสิต/แพทย์ฝึกหัด)', 'var(--elec-soft)', 'cash') +
      kpi('ต้องตรวจ', nf(T.errors + T.alerts), 'รายการ', 'ผิดพลาด ' + T.errors + ' · แจ้งเตือน ' + T.alerts + ' · ยังไม่จด ' + T.missing, T.errors ? 'var(--danger-soft)' : 'var(--violet-soft)', 'alert') + '</div>';
  }
  // ความคืบหน้ารายที่พัก
  html += '<div class="card mt16"><div class="ch"><h3>' + ic('gauge') + ' ความคืบหน้าการจดมิเตอร์</h3><div class="row"><a class="btn sm" href="#/read">' + ic('gauge') + ' เดินจด</a><a class="btn sm" href="#/desk">' + ic('table') + ' กรอกจากสมุด</a></div></div><div class="tbl-wrap" style="max-height:none"><table class="t"><thead><tr><th>ที่พัก</th><th>' + kindIc('W') + ' ค่าน้ำ</th><th>' + kindIc('E') + ' ค่าไฟ</th></tr></thead><tbody>';
  S.boot.buildings.forEach(function (b) {
    html += '<tr><td><b>' + esc(b.name) + '</b></td>';
    ['W', 'E'].forEach(function (k) {
      var p = prog[b.id + '|' + k];
      if (!p) { html += '<td class="muted">-</td>'; return; }
      var pc = pct(p.done, p.total);
      html += '<td style="min-width:200px"><div class="row between small"><span>' + nf(p.done) + ' / ' + nf(p.total) + '</span><b>' + pc + '%</b></div><div class="bar ' + (k === 'E' ? 'e' : '') + (pc === 100 ? ' ok' : '') + '"><i style="width:' + pc + '%"></i></div></td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  // ประวัติรอบ
  html += '<div class="card mt16"><div class="ch"><h3>' + ic('history') + ' รอบทั้งหมด</h3></div><div id="r-list">' + loadingHtml() + '</div></div>';
  if (!S.master.meters.length) html = masterHint() + html;
  pg.innerHTML = html;
  roundActions($('#r-acts'), rd, T);
  api('listRounds').then(function (list) {
    $('#r-list').innerHTML = '<div class="tbl-wrap" style="max-height:none"><table class="t"><thead><tr><th>รอบ (รหัสงาน)</th><th>หน่วยใช้</th><th>สถานะ</th><th class="n">เรียกเก็บ</th><th class="n">หักเงินเดือน</th><th>ล็อกเมื่อ</th><th></th></tr></thead><tbody>' +
      list.map(function (x) {
        var s = x.summary || {}, b = s.billed ? s.billed.W + s.billed.E : null, d = s.deducted ? s.deducted.W + s.deducted.E : null;
        return '<tr><td><b>' + esc(rTh(x.id, true)) + '</b> <span class="muted small">' + esc(x.id) + '</span></td><td>' + esc(x.usageTh) + '</td><td>' + roundBadge(x) + '</td><td class="n">' + (b != null ? baht(b) : '-') + '</td><td class="n">' + (d != null ? baht(d) : '-') + '</td><td>' + (x.lockedAt ? thDate(x.lockedAt) : '-') + '</td><td><a class="btn sm" href="#/review/' + x.id + '">เปิด</a></td></tr>';
      }).join('') + '</tbody></table></div>';
  }).catch(function () { });
}
function kpi(label, val, unit, sub, color, icon) {
  return '<div class="card kpi" style="--kc:' + (color || 'var(--accent-soft)') + '"><div class="lb">' + ic(icon || 'info') + esc(label) + '</div><div class="v">' + val + '<small>' + esc(unit || '') + '</small></div><div class="d">' + sub + '</div></div>';
}
function roundOptions() {
  var d = new Date(), out = '', y = d.getFullYear() + 543, m = d.getMonth() + 1;
  for (var i = -2; i <= 2; i++) { var mm = m + i, yy = y; if (mm < 1) { mm += 12; yy--; } if (mm > 12) { mm -= 12; yy++; } var id = yy + '-' + ('0' + mm).slice(-2); out += '<option value="' + id + '"' + (i === 0 ? ' selected' : '') + '>' + id + ' · หักสิ้นเดือน ' + rTh(id, true) + ' (หน่วยใช้ ' + rTh(usageOf(id), true) + ')</option>'; }
  return out;
}
function masterHint() {
  if (S.master && S.master.meters.length) return '';
  return '<div class="note warn mt12">' + ic('info') + '<div><b>ยังไม่มีทะเบียนมิเตอร์</b> — ไปที่ <a href="#/master">ห้อง · มิเตอร์ · ผู้พัก</a> แล้วกด "นำเข้าทะเบียนจากแม่แบบ" (ไฟล์ U-Bill_แม่แบบจดมิเตอร์) ระบบจะสร้างห้อง มิเตอร์ ผู้จ่าย และเลขครั้งก่อนให้ทั้งหมด</div></div>';
}
function createRoundAct(id) {
  return api('createRound', { id: id }).then(function (d) { toast('สร้างรอบ ' + rTh(d.round.id, true) + ' แล้ว', 'ok'); S.roundData = null; S.round = d.round; location.hash = '#/round'; route(); }).catch(errToast);
}
function roundActions(box, rd, T) {
  var b = [];
  if (rd.status === 'OPEN' && canEdit()) b.push('<button class="btn amber" data-a="submit">' + ic('send') + ' ส่งรอบให้ HR</button>');
  if (rd.status === 'SUBMITTED' && isHR()) b.push('<button class="btn" data-a="return" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.3)">' + ic('undo') + ' ตีกลับ</button>');
  if (rd.status !== 'LOCKED' && isHR()) b.push('<button class="btn ok" data-a="lock">' + ic('lock') + ' ล็อกรอบ</button>');
  if (rd.status === 'LOCKED' && isHR()) b.push('<a class="btn amber" href="#/review/' + rd.id + '/export">' + ic('download') + ' ส่งออก Import HRMi</a>', '<button class="btn" data-a="unlock" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.3)">' + ic('unlock') + ' ปลดล็อก</button>');
  if (rd.status === 'LOCKED' && canEdit()) b.push('<button class="btn" data-a="new" style="background:#fff">' + ic('plus') + ' สร้างรอบถัดไป</button>');
  b.push('<a class="btn" href="#/review/' + rd.id + '" style="background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.3)">' + ic('shield') + ' ตรวจสอบรายละเอียด</a>');
  box.innerHTML = b.join('');
  $$('[data-a]', box).forEach(function (el) {
    el.onclick = function () {
      var a = el.dataset.a;
      if (a === 'new') return createRoundAct('');
      if (a === 'submit') return doSubmit(rd, false, el);
      if (a === 'return') return promptBox('ตีกลับให้ฝ่ายอาคารแก้ไข', 'เหตุผล / สิ่งที่ต้องแก้').then(function (v) { if (v) api('returnRound', { round: rd.id, reason: v }).then(function () { toast('ตีกลับแล้ว', 'ok'); route(); }).catch(errToast); });
      if (a === 'lock') return doLock(rd, false, el);
      if (a === 'unlock') return promptBox('ปลดล็อกรอบ ' + rTh(rd.id, true), 'เหตุผลที่ปลดล็อก', { html: '<div class="note warn">' + ic('alert') + '<div>ไฟล์ Import HRMi ที่ส่งออกไปแล้วจะไม่ตรงกับข้อมูลหลังแก้ไข ต้องส่งออกใหม่หลังล็อกอีกครั้ง</div></div><div class="mt12"></div>', cls: 'warn', ok: 'ปลดล็อก' })
        .then(function (v) { if (v) api('unlockRound', { round: rd.id, reason: v }).then(function () { toast('ปลดล็อกแล้ว', 'ok'); route(); }).catch(errToast); });
    };
  });
}
function doSubmit(rd, force, btn) {
  busy(btn, true);
  api('submitRound', { round: rd.id, force: force }).then(function (d) {
    busy(btn, false);
    if (d.needConfirm) return confirmBox('ส่งรอบให้ HR', '<div class="note warn">' + ic('alert') + '<div>' + esc(d.msg) + '</div></div><p>ต้องการส่งรอบหรือไม่</p>', 'ส่งรอบ', 'amber').then(function (y) { if (y) doSubmit(rd, true, btn); });
    toast('ส่งรอบให้ HR แล้ว', 'ok'); route();
  }).catch(function (e) { busy(btn, false); errToast(e); });
}
function doLock(rd, force, btn) {
  var go = function (f) {
    busy(btn, true, 'กำลังล็อก');
    return api('lockRound', { round: rd.id, force: f }).then(function (d) {
      busy(btn, false);
      if (d.needConfirm) return confirmBox('ล็อกรอบ', '<div class="note warn">' + ic('alert') + '<div>' + esc(d.msg) + '</div></div>', 'ล็อกเลย', 'ok').then(function (y) { if (y) go(true); });
      toast('ล็อกรอบ ' + rTh(rd.id, true) + ' แล้ว — ส่งออกไฟล์ Import HRMi ได้', 'ok', 5000); location.hash = '#/review/' + rd.id + '/export';
    }).catch(function (e) { busy(btn, false); errToast(e); });
  };
  confirmBox('ล็อกรอบ ' + rTh(rd.id, true), '<p>เมื่อล็อกแล้ว ฝ่ายอาคารแก้ไขเลขมิเตอร์ไม่ได้ ระบบจะบันทึกยอดรายคนถาวร และใช้เลขครั้งนี้เป็นเลขครั้งก่อนของรอบหน้า</p><p class="muted small">แนะนำ: กด "ตรวจสถานะกับ SmartAPI" ในหน้าตรวจสอบก่อนล็อก</p>', 'ล็อกรอบ', 'ok').then(function (y) { if (y) go(force); });
}
