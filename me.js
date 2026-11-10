/* SOMDEJ U-Bill — me.js : หน้า "ค่าน้ำ–ค่าไฟที่พักของฉัน" สำหรับผู้พัก (build 2569-11-10.2)
 * เข้าได้ 3 ทาง: ต่อจาก HR Connect (เข้าไว้แล้วในเครื่องนี้) · รหัสพนักงาน + รหัสผ่าน HR Connect / เลขบัตร · เลขผู้พัก + รหัส (ผู้ไม่มีรหัส 7 หลัก) */
var ME = { data: null, sel: null, charts: [] };
var ME_KEY = 'ubme_token';
function meSave(t) { S.token = t; try { localStorage.setItem(ME_KEY, t || ''); } catch (e) { } }
/* ทับ logout ของ app.js (หมดเวลา → กลับหน้าเข้าสู่ระบบของผู้พัก) */
function logout(silent) { meSave(''); try { localStorage.removeItem(ME_KEY); } catch (e) { } ME.data = null; meLogin(silent ? 'expired' : ''); }

function meStart() {
  registerSW('sw.js');
  var t = null; try { t = localStorage.getItem(ME_KEY); } catch (e) { }
  var done = function () { var b = $('#bootsplash'); if (b) b.remove(); };
  if (t) { S.token = t; return api('meData', {}).then(function (d) { done(); meRender(d); }).catch(function () { done(); meTrySso(); }); }
  done(); meTrySso();
}
/** เข้าไว้ใน HR Connect แล้ว (โดเมนเดียวกัน) → เข้าต่อได้เลย */
function meTrySso() {
  var h = null; try { h = localStorage.getItem('hrc_token'); } catch (e) { }
  if (!h) return meLogin();
  $('#app').innerHTML = '<div class="me-wrap">' + loadingHtml('กำลังเข้าต่อจาก HR Connect…') + '</div>';
  S.token = null;
  api('meSso', { hrc: h }).then(function (d) { meSave(d.token); meRender(d.data); }).catch(function (e) { meLogin('', e.message); });
}
function meHead() {
  return '<div class="me-brand"><div class="logo">' + ic('ub') + '</div><div><b>ค่าน้ำ–ค่าไฟที่พักของฉัน</b><span>SOMDEJ U-Bill · รพ.สมเด็จพระบรมราชเทวี ณ ศรีราชา</span></div></div>';
}
function meLogin(mode, msg) {
  var hrc = (S.brand && S.brand.hrcUrl) || 'https://hr-somdej.github.io/hr-connect/';
  var inLine = /\bLine\//i.test(navigator.userAgent || ''), inApp = inLine || /FBAN|FBAV|Instagram|MicroMessenger/i.test(navigator.userAgent || '');
  var phone = esc((S.brand && S.brand.supportPhone) || '23400 - 23419');
  $('#app').innerHTML = '<div class="me-wrap">' + meHead() +
    (mode === 'expired' ? '<div class="note warn mt12">' + ic('info') + '<div>หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่</div></div>' : '') + (msg ? '<div class="note warn mt12">' + ic('info') + '<div>' + esc(msg) + '</div></div>' : '') +
    (inApp ? '<div class="note info mt12">' + ic('info') + '<div><b>เปิดจากไลน์อยู่</b> — ใช้ได้ตามปกติ แต่ถ้าอยากให้จำการเข้าสู่ระบบไว้ กด <b>⋯</b> มุมขวาบน แล้วเลือก <b>"เปิดในเบราว์เซอร์"</b> (Chrome / Safari)</div></div>' : '') +
    // ---- ขั้นที่ 1: เลือกว่าเป็นใคร
    '<div class="card mt16"><div class="me-step"><span>1</span><b>ท่านเป็นใคร</b></div>' +
    '<div class="me-who-pick mt8" id="ml-t"><button data-t="E" class="on">' + ic('user') + '<b>บุคลากร รพ.</b><small>มีรหัสพนักงาน 7 หลัก</small></button><button data-t="R">' + ic('key') + '<b>นิสิตแพทย์ / แพทย์ฝึกหัด</b><small>หรือยังไม่มีรหัสพนักงาน</small></button></div></div>' +
    // ---- บุคลากร
    '<div id="ml-e" class="card mt12"><div class="me-step"><span>2</span><b>กรอกรหัสพนักงาน</b></div>' +
    '<div class="field mt8"><input class="inp lg" id="ml-emp" inputmode="numeric" maxlength="7" autocomplete="username" placeholder="เช่น 5660101"></div>' +
    '<div class="me-step mt12"><span>3</span><b>ยืนยันตัวตนด้วย</b><small class="muted">เลือก 1 อย่าง</small></div>' +
    '<div class="seg block mt8" id="ml-how"><button data-h="P" class="on">' + ic('lock') + ' รหัสผ่าน</button><button data-h="C">' + ic('id') + ' เลขบัตรประชาชน</button></div>' +
    '<div class="field mt12" id="ml-pwf"><input class="inp lg" type="password" id="ml-pw" autocomplete="current-password" placeholder="รหัสผ่านที่ใช้เข้า HR Connect"><div class="help">รหัสเดียวกับที่ใช้เข้า <b>SOMDEJ HR Connect</b> (ไม่ใช่รหัส HIS / อีเมล)</div></div>' +
    '<div class="field mt12 hide" id="ml-cidf"><input class="inp lg" id="ml-cid" inputmode="numeric" maxlength="17" autocomplete="off" placeholder="เลขบัตรประชาชน 13 หลัก"><div class="help">ใช้ได้เมื่อ<b>ยังไม่เคยตั้งรหัสผ่าน</b>ใน HR Connect · ระบบใช้ตรวจกับทะเบียนบุคลากรเท่านั้น ไม่บันทึกเลขบัตร</div></div>' +
    '<button class="btn primary block lg mt8" id="ml-go">' + ic('login') + ' ดูค่าน้ำ–ค่าไฟของฉัน</button>' +
    '<div class="orline"><span>หรือ</span></div><a class="btn block" href="' + esc(hrc) + '" id="ml-hrc">' + ic('link') + ' เปิด HR Connect แล้วกดเมนู "ค่าน้ำ–ค่าไฟ"</a><p class="tiny muted center mt8">ถ้าเข้า HR Connect ไว้แล้วในเครื่องนี้ ระบบจะพาเข้ามาเองโดยไม่ต้องกรอกอีก</p></div>' +
    // ---- ผู้ไม่มีรหัส
    '<div id="ml-r" class="card mt12 hide"><div class="note info">' + ic('info') + '<div>ขอ <b>"รหัสดูยอด"</b> (เลขผู้พัก R + ตัวเลข และรหัสเปิดใช้ 8 ตัว) จาก<b>ฝ่ายอาคาร</b>ก่อน · ใช้ครั้งแรกเพื่อตั้งรหัสผ่านของตนเอง</div></div>' +
    '<div class="seg block mt12" id="ml-rt"><button data-m="A" class="on">เข้าครั้งแรก (มีรหัสเปิดใช้)</button><button data-m="L">เคยตั้งรหัสผ่านแล้ว</button></div>' +
    '<div class="field mt12"><label class="f">เลขผู้พัก</label><input class="inp lg" id="ml-rid" placeholder="เช่น R00123" autocapitalize="characters"></div>' +
    '<div class="field" id="ml-codef"><label class="f">รหัสเปิดใช้ (8 ตัว จากฝ่ายอาคาร)</label><input class="inp lg" id="ml-code" autocapitalize="characters" autocomplete="off"></div>' +
    '<div class="field"><label class="f" id="ml-rpwl">ตั้งรหัสผ่านใหม่</label><input class="inp lg" type="password" id="ml-rpw" autocomplete="new-password"></div>' +
    '<div class="field" id="ml-rpw2f"><label class="f">ยืนยันรหัสผ่านใหม่</label><input class="inp lg" type="password" id="ml-rpw2" autocomplete="new-password"><div class="help">อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข · จดไว้ใช้ครั้งต่อไป</div></div>' +
    '<button class="btn primary block lg" id="ml-rgo">' + ic('login') + ' ดูค่าน้ำ–ค่าไฟของฉัน</button><p class="tiny muted mt8">ลืมรหัสผ่าน / รหัสเปิดใช้หมดอายุ (7 วัน): ขอรหัสดูยอดใหม่จากฝ่ายอาคาร</p></div>' +
    // ---- ช่วยเหลือ
    '<details class="card mt12 me-help"><summary>' + ic('help') + ' เข้าไม่ได้? ดูวิธีแก้</summary><ul class="small">' +
    '<li><b>"ยังไม่เคยตั้งรหัสผ่านใน HR Connect"</b> → เลือก <b>เลขบัตรประชาชน</b> แทน</li>' +
    '<li><b>"ท่านตั้งรหัสผ่านใน HR Connect แล้ว"</b> → เลือก <b>รหัสผ่าน HR Connect</b> · ลืมรหัสผ่าน: เปิด HR Connect กด "ลืมรหัสผ่าน" (รหัสยืนยันส่งไปอีเมล)</li>' +
    '<li><b>"ไม่พบข้อมูลการพักอาศัยของท่าน"</b> → ชื่อท่านยังไม่อยู่ในทะเบียนห้องพัก ติดต่อฝ่ายอาคาร</li>' +
    '<li><b>เข้าได้แต่ยังไม่เห็นยอดเดือนล่าสุด</b> → ยอดจะแสดงหลังฝ่ายอาคารส่งยอดของเดือนนั้นแล้ว</li>' +
    '<li><b>กรอกผิดหลายครั้งแล้วถูกพักการเข้าสู่ระบบ</b> → รอ 10 นาทีแล้วลองใหม่</li>' +
    '<li>เพิ่มหน้านี้ไว้ที่หน้าจอโทรศัพท์: Safari กด <b>แชร์ → เพิ่มไปยังหน้าจอโฮม</b> · Chrome กด <b>⋮ → เพิ่มลงในหน้าจอหลัก</b></li>' +
    '</ul><p class="small">ยังไม่ได้: ฝ่ายทรัพยากรบุคคล โทร ' + phone + '</p></details>' +
    '<p class="tiny muted center mt16">เห็นเฉพาะข้อมูลของท่านเอง · รุ่น ' + UB_BUILD + '</p></div>';
  var how = 'P', rmode = 'A';
  var setHow = function (h) { how = h; $$('#ml-how button').forEach(function (x) { x.classList.toggle('on', x.dataset.h === h); }); $('#ml-pwf').classList.toggle('hide', h !== 'P'); $('#ml-cidf').classList.toggle('hide', h !== 'C'); };
  var setR = function (m) { rmode = m; $$('#ml-rt button').forEach(function (x) { x.classList.toggle('on', x.dataset.m === m); }); $('#ml-codef').classList.toggle('hide', m !== 'A'); $('#ml-rpw2f').classList.toggle('hide', m !== 'A'); $('#ml-rpwl').textContent = m === 'A' ? 'ตั้งรหัสผ่านใหม่' : 'รหัสผ่าน'; $('#ml-rpw').autocomplete = m === 'A' ? 'new-password' : 'current-password'; };
  $$('#ml-t button').forEach(function (b) { b.onclick = function () { $$('#ml-t button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#ml-e').classList.toggle('hide', b.dataset.t !== 'E'); $('#ml-r').classList.toggle('hide', b.dataset.t === 'E'); }; });
  $$('#ml-how button').forEach(function (b) { b.onclick = function () { setHow(b.dataset.h); }; });
  $$('#ml-rt button').forEach(function (b) { b.onclick = function () { setR(b.dataset.m); }; });
  var ok = function (d) { meSave(d.token); meRender(d.data); };
  $('#ml-go').onclick = function () {
    var b = this, emp = $('#ml-emp').value.replace(/\D/g, '');
    if (!/^\d{7}$/.test(emp)) { toast('กรุณากรอกรหัสพนักงาน 7 หลัก', 'warn'); $('#ml-emp').focus(); return; }
    if (how === 'P' && !$('#ml-pw').value) { toast('กรุณากรอกรหัสผ่าน HR Connect', 'warn'); $('#ml-pw').focus(); return; }
    if (how === 'C' && $('#ml-cid').value.replace(/\D/g, '').length !== 13) { toast('เลขบัตรประชาชนต้องมี 13 หลัก', 'warn'); $('#ml-cid').focus(); return; }
    busy(b, true, 'กำลังตรวจสอบ'); S.token = null;
    api('meLogin', how === 'C' ? { empCode: emp, cid: $('#ml-cid').value.replace(/\D/g, '') } : { empCode: emp, password: $('#ml-pw').value }).then(ok).catch(function (e) {
      busy(b, false);
      // สลับวิธีให้อัตโนมัติเมื่อระบบบอกว่าเลือกผิดทาง
      if (how === 'P' && /ยังไม่เคยตั้งรหัสผ่าน|ใช้เลขบัตรประชาชน/.test(e.message)) { setHow('C'); $('#ml-cid').focus(); return toast('ท่านยังไม่เคยตั้งรหัสผ่าน HR Connect — กรอกเลขบัตรประชาชนแทนได้เลย', 'warn', 7000); }
      if (how === 'C' && /ตั้งรหัสผ่าน.*แล้ว/.test(e.message)) { setHow('P'); $('#ml-pw').focus(); return toast('ท่านตั้งรหัสผ่าน HR Connect ไว้แล้ว — กรอกรหัสผ่านนั้นแทน', 'warn', 7000); }
      errToast(e);
    });
  };
  $('#ml-pw').onkeydown = $('#ml-cid').onkeydown = function (e) { if (e.key === 'Enter') $('#ml-go').click(); };
  $('#ml-rgo').onclick = function () {
    var b = this; S.token = null;
    if (!/^R\d+$/i.test($('#ml-rid').value.trim())) return toast('เลขผู้พักขึ้นต้นด้วย R ตามด้วยตัวเลข (ดูจากกระดาษที่ฝ่ายอาคารให้)', 'warn');
    if (rmode === 'A' && $('#ml-rpw').value !== $('#ml-rpw2').value) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'warn');
    busy(b, true, 'กำลังตรวจสอบ');
    (rmode === 'A' ? api('meActivate', { rid: $('#ml-rid').value.trim().toUpperCase(), code: $('#ml-code').value.trim().toUpperCase(), password: $('#ml-rpw').value }) : api('meLoginR', { rid: $('#ml-rid').value.trim().toUpperCase(), password: $('#ml-rpw').value })).then(ok).catch(function (e) { busy(b, false); errToast(e); });
  };
  try {
    var last = localStorage.getItem('ubme_emp'); if (last) $('#ml-emp').value = last;
    var lr = localStorage.getItem('ubme_rid'); if (lr) { $('#ml-rid').value = lr; setR('L'); }
  } catch (e) { }
  $('#ml-rid').onchange = function () { try { localStorage.setItem('ubme_rid', this.value.trim().toUpperCase()); } catch (e) { } };
  $('#ml-emp').onchange = function () { try { localStorage.setItem('ubme_emp', this.value.replace(/\D/g, '')); } catch (e) { } };
}

/* ---------------------------------------------------------------- หน้าหลัก */
function stTotal(st) { return st ? r2((st.W || 0) + (st.E || 0)) : 0; }
function meRender(d) {
  ME.data = d; var me = d.me, R = d.rounds;
  if (!ME.sel || !R.some(function (r) { return r.id === ME.sel; })) ME.sel = R.length ? R[0].id : null;
  $('#app').innerHTML = '<div class="me-wrap">' + meHead() +
    '<div class="card mt12 me-who"><div class="grow"><b>' + esc(me.name) + '</b><div class="small muted">' + esc(me.empCode ? 'รหัส ' + me.empCode : 'เลขผู้พัก ' + me.rid) + ' · ' + esc(me.rtypeTh) + '</div><div class="small">' + (me.rooms.length ? ic('home') + ' ' + me.rooms.map(esc).join(' · ') : '<span class="muted">ไม่มีห้องที่พักอยู่ปัจจุบัน</span>') + '</div></div>' +
    '<div class="row"><button class="btn sm hide inst" id="me-inst">' + ic('download') + ' ติดตั้งแอป</button><button class="btn sm" id="me-out">' + ic('logout') + ' ออก</button></div></div>' +
    meNotifyPromptHtml(d.notify) +
    (R.length ? '<div class="me-rounds mt12" id="me-rs">' + R.map(function (r) { var t = stTotal(r.st); return '<button data-r="' + r.id + '" class="' + (r.id === ME.sel ? 'on' : '') + '"><span>' + esc(rTh(r.id)) + '</span><b>' + (r.st ? baht(t) : '—') + '</b><i class="' + (r.status === 'LOCKED' ? 'ok' : 'wait') + '"></i></button>'; }).join('') + '</div><div id="me-body"></div>' :
      '<div class="card mt12">' + emptyHtml('ยังไม่มียอดค่าน้ำ–ค่าไฟที่เผยแพร่ (ระบบแสดงเมื่อฝ่ายอาคารส่งยอดประจำเดือนแล้ว)', 'calendar') + '</div>') +
    (R.filter(function (r) { return r.st; }).length > 1 ? '<div class="card mt12"><h3>' + ic('chart') + ' ย้อนหลัง</h3><div class="chartbox short"><canvas id="me-ch"></canvas></div></div>' : '') +
    '<div class="card mt12"><h3>' + ic('alert') + ' เรื่องที่ฉันแจ้ง</h3><div id="me-ds">' + meDisputes(d.disputes) + '</div></div>' +
    meNotifyCardHtml(d.notify) +
    '<p class="tiny muted center mt16">สอบถาม ฝ่ายอาคาร หรือ ฝ่ายทรัพยากรบุคคล ' + esc(d.app.supportPhone) + ' · รุ่น ' + esc(d.app.build) + '</p></div>';
  $('#me-out').onclick = function () { confirmBox('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่', 'ออกจากระบบ').then(function (y) { if (y) { api('meLogout').catch(function () { }); logout(); } }); };
  $('#me-inst').onclick = installApp; if (window._bip) $('#me-inst').classList.remove('hide');
  $$('#me-rs button').forEach(function (b) { b.onclick = function () { ME.sel = b.dataset.r; $$('#me-rs button').forEach(function (x) { x.classList.toggle('on', x === b); }); meRound(); }; });
  if (R.length) meRound();
  meChart(R);
  meNotifyBind(d.notify);
}
function meRound() {
  var r = ME.data.rounds.filter(function (x) { return x.id === ME.sel; })[0], st = r.st, B = $('#me-body'), tl = r.timeline;
  var html = '<div class="card mt12 me-total"><div class="small muted">รอบหักเงิน ' + esc(rTh(r.id, true)) + ' · หน่วยใช้ ' + esc(r.usageTh) + '</div>' +
    (st ? '<div class="me-sum"><div><span>' + ic('drop', 'w-ic') + ' ค่าน้ำ</span><b>' + baht(st.W) + '</b></div><div><span>' + ic('bolt', 'e-ic') + ' ค่าไฟ</span><b>' + baht(st.E) + '</b></div><div class="t"><span>รวม</span><b>' + baht(stTotal(st)) + ' <small>บาท</small></b></div></div>' +
      (st.back ? '<div class="note warn">' + ic('info') + '<div>รวมยอดย้อนหลังช่วงรอรหัสพนักงาน ' + baht(st.back) + ' บาท</div></div>' : '') +
      (st.payType === 'EMP' && st.include === false ? '<div class="note info">' + ic('info') + '<div>รอบนี้ไม่หักเงินเดือน: ' + esc(st.reason || '') + '</div></div>' : '') :
      '<div class="muted mt8">ไม่มียอดของท่านในรอบนี้</div>') + '</div>';
  html += '<div class="card mt12"><h3>' + ic('send') + ' สถานะ</h3><ol class="me-tl">' + tl.steps.map(function (s) { return '<li class="' + (s.done ? 'done' : '') + '"><b>' + esc(s.t) + '</b>' + (s.at ? '<span>' + thDate(s.at) + '</span>' : '') + '</li>'; }).join('') + '</ol>' +
    (tl.canDispute ? '<button class="btn warn block mt8" id="me-dsp">' + ic('alert') + ' ยอดไม่ถูกต้อง? แจ้งฝ่ายอาคาร</button><p class="tiny muted center mt8">แจ้งได้ถึง ' + thDate(tl.disputeUntil) + '</p>' : (st && r.status !== 'LOCKED' ? '' : '')) + '</div>';
  if (st) html += st.items.map(function (it) {
    var usage = it.broken ? 'มิเตอร์เสีย (คิดเหมา)' : it.usage != null ? nf(it.usage) + ' หน่วย' : '-';
    return '<div class="card mt12 me-item"><div class="row between"><div>' + kindIc(it.kind) + ' <b>' + KIND_TH[it.kind] + '</b> <span class="small muted">' + esc(it.bldName) + ' ห้อง ' + esc(it.room) + (it.label !== '1' ? ' · ' + esc(it.label) : '') + '</span></div><b class="me-share">' + baht(it.share) + ' ฿</b></div>' +
      '<dl class="kv small mt8"><dt>เลขมิเตอร์</dt><dd>' + (it.prev != null ? nf(it.prev) : '-') + ' → ' + (it.broken ? 'เสีย' : it.curr != null ? nf(it.curr) : '-') + (it.reset != null ? ' (เริ่มใหม่ ' + nf(it.reset) + ')' : '') + '</dd><dt>หน่วยใช้</dt><dd>' + usage + '</dd>' +
      (!it.broken ? '<dt>ยอดทั้งห้อง</dt><dd>' + (it.usage != null ? nf(it.usage) + ' × ' + it.rate + ' = ' : '') + '<b>' + baht(it.amount) + '</b> บาท</dd>' : '<dt>ค่าเหมา</dt><dd>' + baht(it.amount) + ' บาท</dd>') +
      '<dt>ส่วนของท่าน</dt><dd>' + it.days + ' วัน' + (it.leaveDays ? ' (พักการเรียกเก็บ ' + it.leaveDays + ' วัน)' : '') + ' → <b>' + baht(it.share) + '</b> บาท</dd></dl>' +
      (it.mates.length > 1 ? '<div class="small mt8"><b>ผู้พักร่วม</b> (หารตามคน × วันที่พักจริง ปัดขึ้น 2 ตำแหน่ง)<table class="t mt8"><thead><tr><th>ชื่อ</th><th class="n">วัน</th><th class="n">บาท</th></tr></thead><tbody>' + it.mates.map(function (m) { return '<tr><td>' + esc(m[0]) + (m[3] ? ' <span class="tag violet">' + esc(m[4] || 'พักการเรียกเก็บ') + ' ' + m[3] + ' วัน</span>' : '') + '</td><td class="n">' + m[1] + '</td><td class="n">' + baht(m[2]) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
      (it.unallocated ? '<p class="tiny muted">ช่วงที่ห้องว่าง ' + baht(it.unallocated) + ' บาท ไม่ได้คิดกับท่าน</p>' : '') + '</div>';
  }).join('');
  html += '<p class="tiny muted mt12">วิธีคิด: หน่วยใช้ = เลขครั้งนี้ − เลขครั้งก่อน · ยอด = หน่วย × อัตรา (น้ำ/ไฟ บาทต่อหน่วย ตามประกาศโรงพยาบาล) · หลายคนในห้อง หารตามคน × จำนวนวันที่พักจริง · ' + (ME.data.me.rtype === 'EMP' ? 'หักจากเงินเดือนผ่านระบบ HRMi รหัสรายหัก น้ำ ' + esc(ME.data.app.codes.W) + ' · ไฟ ' + esc(ME.data.app.codes.E) : 'ชำระเงินสดกับเจ้าหน้าที่ผู้เรียกเก็บ') + '</p>';
  B.innerHTML = html;
  if ($('#me-dsp')) $('#me-dsp').onclick = function () { meDisputeDialog(r); };
}
function meDisputes(L) {
  if (!L.length) return '<div class="small muted">ยังไม่มี</div>';
  var cls = { NEW: 'danger', CHECKING: 'elec', FIXED: 'ok', CONFIRMED: 'water' };
  return L.map(function (d) { return '<div class="me-d"><div class="row between"><b>' + esc(d.reason) + '</b><span class="tag ' + (cls[d.status] || '') + '">' + esc(d.statusTh) + '</span></div><div class="tiny muted">รอบ ' + esc(rTh(d.round)) + ' · แจ้ง ' + thDate(d.createdAt) + ' · ' + esc(d.id) + '</div>' + (d.detail ? '<div class="small">' + esc(d.detail) + '</div>' : '') + (d.reply ? '<div class="note ok mt8">' + ic('check') + '<div><b>ผลตรวจ:</b> ' + esc(d.reply) + '</div></div>' : '') + '</div>'; }).join('');
}
function meDisputeDialog(r) {
  var photo = '';
  modal({ title: 'แจ้งยอดไม่ถูกต้อง · รอบ ' + esc(rTh(r.id)),
    body: '<div class="field"><label class="f">ประเภท</label><select class="inp" id="dp-k"><option value="">ทั้งค่าน้ำและค่าไฟ</option><option value="W">ค่าน้ำ</option><option value="E">ค่าไฟ</option></select></div>' +
      '<div class="field"><label class="f">เรื่อง</label><select class="inp" id="dp-r"><option>เลขมิเตอร์ไม่ตรงกับที่เห็นจริง</option><option>ย้ายออกแล้ว แต่ยังถูกเรียกเก็บ</option><option>จำนวนผู้พักร่วมไม่ถูกต้อง</option><option>ลาศึกษา / ไม่ได้พักในเดือนนี้</option><option>ยอดสูงผิดปกติ</option><option>ชื่อหรือห้องไม่ถูกต้อง</option><option>อื่น ๆ</option></select></div>' +
      '<div class="field"><label class="f">รายละเอียด</label><textarea class="inp" id="dp-d" placeholder="เช่น เลขบนมิเตอร์วันที่ 1 คือ 1,090"></textarea></div>' +
      '<div class="field"><label class="f">แนบรูปมิเตอร์ (ถ้ามี)</label><input type="file" accept="image/*" capture="environment" id="dp-p" class="inp"><div id="dp-pv" class="mt8"></div></div>' +
      '<p class="tiny muted">ฝ่ายอาคารได้รับแจ้งทันที และจะตอบผลในหน้านี้</p>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('send') + ' ส่งเรื่อง', cls: 'primary', onClick: function () {
      return api('meDispute', { round: r.id, kind: $('#dp-k').value, reason: $('#dp-r').value, detail: $('#dp-d').value.trim(), photo: photo }).then(function (d) { toast('ส่งเรื่องแล้ว เลขที่ ' + d.id + ' — ฝ่ายอาคารจะตรวจสอบและตอบในหน้านี้', 'ok', 7000); meRender(d.data); });
    } }],
    onOpen: function (el) {
      $('#dp-p', el).onchange = function () {
        var f = this.files[0]; if (!f) return;
        var img = new Image(), url = URL.createObjectURL(f);
        img.onload = function () { var k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); photo = c.toDataURL('image/jpeg', 0.72); $('#dp-pv', el).innerHTML = '<img src="' + photo + '" style="max-width:100%;max-height:220px;border-radius:10px">'; URL.revokeObjectURL(url); };
        img.src = url;
      };
    } });
}
function meChart(R) {
  var L = R.filter(function (r) { return r.st; }).slice().reverse(); if (L.length < 2 || !window.Chart || !$('#me-ch')) return;
  ME.charts.forEach(function (c) { c.destroy(); }); ME.charts = [];
  Chart.defaults.font.family = "'IBM Plex Sans Thai', sans-serif";
  ME.charts.push(new Chart($('#me-ch'), { type: 'bar', data: { labels: L.map(function (r) { return rTh(r.id); }), datasets: [{ label: 'ค่าน้ำ', data: L.map(function (r) { return r.st.W; }), backgroundColor: '#0b84c6', borderRadius: 4 }, { label: 'ค่าไฟ', data: L.map(function (r) { return r.st.E; }), backgroundColor: '#e89a00', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true } } } }));
}
document.addEventListener('DOMContentLoaded', function () { api('branding').then(function (b) { S.brand = b; }).catch(function () { }).then(meStart); });

/* ---------------------------------------------------------------- 10 พ.ย. 69: การแจ้งเตือนทางอีเมล */
/** การ์ดชวนใส่อีเมล (ด้านบน) — ไม่บังคับ · "ไว้ทีหลัง" ซ่อน 30 วัน */
function meNotifyPromptHtml(n) {
  if (!n || !n.prompt) return '';
  return '<div class="card mt12 me-np" id="me-np"><div class="row" style="align-items:flex-start;gap:12px;flex-wrap:nowrap"><span class="me-np-ic">' + ic('mail') + '</span><div class="grow"><b>รับแจ้งเตือนทางอีเมล (แนะนำ)</b><div class="small muted">ระบบยังไม่มีอีเมลของท่าน — ใส่อีเมลไว้เพื่อรับแจ้งเมื่อยอดประจำเดือนพร้อมตรวจ ยอดถูกปรับ หรือมีผลการแจ้งยอด · ไม่บังคับ</div>' +
    '<div class="me-np-f mt8" id="me-np-f"><input class="inp" id="me-np-e" type="email" inputmode="email" autocomplete="email" placeholder="ชื่อ@อีเมล"><button class="btn primary" id="me-np-go">' + ic('send') + ' ส่งรหัสยืนยัน</button></div>' +
    '<div class="row mt8"><button class="btn sm ghost" id="me-np-later">ไว้ทีหลัง</button></div></div></div></div>';
}
var NOTIFY_TH = { READY: 'ยอดประจำเดือนพร้อมให้ตรวจ', CHANGED: 'ยอดถูกปรับหลังฝ่ายอาคารส่งแล้ว', DISPUTE: 'ผลการแจ้งยอดผิดพลาด', STAY: 'ข้อมูลการพักของฉันเปลี่ยน (ย้ายเข้า/ออก ฯลฯ)' };
function meNotifyCardHtml(n) {
  if (!n || !n.on) return '';
  var ev = ['READY', 'CHANGED', 'DISPUTE', 'STAY'];
  return '<div class="card mt12" id="me-nc"><h3>' + ic('mail') + ' การแจ้งเตือนทางอีเมล</h3>' +
    (n.email ? '<div class="row between mt8"><div><b>' + esc(n.email) + '</b><div class="tiny muted">' + esc(n.srcTh) + '</div></div><button class="btn sm" id="me-nc-ch">' + ic('edit') + ' เปลี่ยนอีเมล</button></div>'
      : '<div class="note warn mt8">' + ic('info') + '<div>ยังไม่มีอีเมล — ระบบส่งแจ้งเตือนไม่ได้ <button class="btn sm primary" id="me-nc-ch">' + ic('plus') + ' ใส่อีเมล</button></div></div>') +
    '<div class="mt12 small"><b>เรื่องที่ต้องการรับ</b></div><div class="me-nc-list">' + ev.map(function (k) {
      var adm = n.adminOn[k];
      return '<label class="check"><input type="checkbox" class="me-nc-e" value="' + k + '"' + (n.events[k] && adm ? ' checked' : '') + (!adm || n.optOut ? ' disabled' : '') + '> ' + esc(NOTIFY_TH[k]) + (adm ? '' : ' <span class="tiny muted">(ปิดโดยผู้ดูแลระบบ)</span>') + '</label>';
    }).join('') + '</div>' +
    '<label class="check mt8"><input type="checkbox" id="me-nc-off"' + (n.optOut ? ' checked' : '') + '> ไม่รับอีเมลแจ้งเตือนใด ๆ</label>' +
    (n.emp ? '<p class="tiny muted mt8">อีเมลนี้ใช้ร่วมกับ SOMDEJ HR Connect — เปลี่ยนที่ระบบใดระบบหนึ่ง อีกระบบใช้ตาม</p>' : '') + '</div>';
}
function meNotifyBind(n) {
  var upd = function (r) { ME.data.notify = r.notify; meRender(ME.data); };
  var np = $('#me-np');
  if (np) {
    $('#me-np-later').onclick = function () { api('mePromptLater', {}).then(function (r) { toast('ซ่อนไว้ 30 วัน · ใส่อีเมลได้ทุกเมื่อที่ "การแจ้งเตือนทางอีเมล" ด้านล่าง', 'ok', 6000); upd(r); }).catch(errToast); };
    $('#me-np-go').onclick = function () { meEmailFlow($('#me-np-e').value, this, upd); };
    $('#me-np-e').onkeydown = function (e) { if (e.key === 'Enter') $('#me-np-go').click(); };
  }
  if ($('#me-nc-ch')) $('#me-nc-ch').onclick = function () { meEmailDialog(upd); };
  var save = function () {
    var ev = {}; $$('.me-nc-e').forEach(function (x) { if (!x.disabled) ev[x.value] = x.checked; else if (n.adminOn[x.value]) ev[x.value] = !!n.events[x.value]; });
    api('meNotifySave', { events: ev, optOut: $('#me-nc-off').checked }).then(function (r) { toast('บันทึกการแจ้งเตือนแล้ว', 'ok'); upd(r); }).catch(errToast);
  };
  $$('.me-nc-e').forEach(function (x) { x.onchange = save; });
  if ($('#me-nc-off')) $('#me-nc-off').onchange = save;
}
/** ขอรหัส → กรอกรหัส 6 หลัก → บันทึก */
function meEmailFlow(email, btn, done) {
  email = String(email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { toast('กรุณากรอกอีเมลให้ถูกต้อง เช่น somchai@gmail.com', 'warn'); return; }
  if (btn) busy(btn, true, 'กำลังส่ง');
  api('meEmailStart', { email: email }).then(function (r) {
    if (btn) busy(btn, false);
    modal({ title: 'ยืนยันอีเมล', body: '<p class="small">ส่งรหัส 6 หลักไปที่ <b>' + esc(r.to) + '</b> แล้ว (ใช้ได้ ' + r.minutes + ' นาที) · ไม่พบ ให้ดูในกล่อง "จดหมายขยะ/Spam"</p><div class="field"><label class="f">รหัสยืนยัน 6 หลัก</label><input class="inp lg" id="me-otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="letter-spacing:6px;text-align:center"></div>',
      buttons: [{ label: 'ยกเลิก' }, { label: ic('check') + ' ยืนยัน', cls: 'primary', onClick: function () {
        return api('meEmailVerify', { otp: $('#me-otp').value }).then(function (v) { toast('บันทึกอีเมลแล้ว' + (v.hrc ? ' · ใช้ร่วมกับ HR Connect' : '') + ' — ท่านจะได้รับแจ้งเตือนทางอีเมลนี้', 'ok', 7000); done(v); });
      } }] });
  }).catch(function (e) { if (btn) busy(btn, false); errToast(e); });
}
function meEmailDialog(done) {
  modal({ title: 'อีเมลรับแจ้งเตือน', body: '<div class="field"><label class="f">อีเมลของท่าน</label><input class="inp lg" id="me-em" type="email" inputmode="email" autocomplete="email" placeholder="ชื่อ@อีเมล"><div class="help">ระบบจะส่งรหัสยืนยันไปที่อีเมลนี้ก่อนเริ่มใช้</div></div>',
    buttons: [{ label: 'ยกเลิก' }, { label: ic('send') + ' ส่งรหัสยืนยัน', cls: 'primary', onClick: function (close) { var v = $('#me-em').value; close(); meEmailFlow(v, null, done); return false; } }] });
}
