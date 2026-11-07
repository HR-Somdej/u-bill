/* SOMDEJ U-Bill — me.js : หน้า "ค่าน้ำ–ค่าไฟที่พักของฉัน" สำหรับผู้พัก (build 2569-11-08.1)
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
  $('#app').innerHTML = '<div class="me-wrap">' + meHead() +
    (mode === 'expired' ? '<div class="note warn mt12">' + ic('info') + '<div>หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่</div></div>' : '') + (msg ? '<div class="note warn mt12">' + ic('info') + '<div>' + esc(msg) + '</div></div>' : '') +
    '<div class="card mt16"><div class="seg block" id="ml-t"><button data-t="E" class="on">' + ic('user') + ' บุคลากร (มีรหัสพนักงาน)</button><button data-t="R">' + ic('key') + ' นศพ. / ผู้ไม่มีรหัส</button></div>' +
    '<div id="ml-e" class="mt16"><a class="btn primary block lg" href="' + esc(hrc) + '" id="ml-hrc">' + ic('login') + ' เข้าผ่าน HR Connect</a><p class="tiny muted center mt8">เข้า HR Connect แล้วกดเมนู "ค่าน้ำ–ค่าไฟที่พักของฉัน" หรือกลับมาหน้านี้ ระบบจะเข้าต่อให้เอง</p>' +
    '<div class="orline"><span>หรือกรอกที่นี่</span></div>' +
    '<div class="field"><label class="f">รหัสพนักงาน</label><input class="inp" id="ml-emp" inputmode="numeric" maxlength="7" autocomplete="username"></div>' +
    '<div class="field" id="ml-pwf"><label class="f">รหัสผ่าน HR Connect</label><input class="inp" type="password" id="ml-pw" autocomplete="current-password"></div>' +
    '<div class="field hide" id="ml-cidf"><label class="f">เลขบัตรประชาชน 13 หลัก</label><input class="inp" id="ml-cid" inputmode="numeric" maxlength="17" autocomplete="off"><div class="help">ใช้ได้เฉพาะผู้ที่ยังไม่เคยตั้งรหัสผ่านใน HR Connect · ระบบไม่บันทึกเลขบัตร</div></div>' +
    '<button class="btn primary block lg" id="ml-go">' + ic('login') + ' ดูยอดของฉัน</button><div class="row between mt12 small"><a href="#" id="ml-sw">ยังไม่เคยตั้งรหัสผ่าน HR Connect? ใช้เลขบัตรประชาชน</a></div></div>' +
    '<div id="ml-r" class="mt16 hide"><div class="seg" id="ml-rt"><button data-m="L" class="on">เข้าสู่ระบบ</button><button data-m="A">เข้าครั้งแรก (มีรหัสเปิดใช้)</button></div>' +
    '<div class="field mt12"><label class="f">เลขผู้พัก</label><input class="inp" id="ml-rid" placeholder="เช่น R00123" autocapitalize="characters"></div>' +
    '<div class="field hide" id="ml-codef"><label class="f">รหัสเปิดใช้ (8 ตัว จากฝ่ายอาคาร)</label><input class="inp" id="ml-code" autocapitalize="characters" autocomplete="off"></div>' +
    '<div class="field"><label class="f" id="ml-rpwl">รหัสผ่าน</label><input class="inp" type="password" id="ml-rpw" autocomplete="current-password"></div>' +
    '<div class="field hide" id="ml-rpw2f"><label class="f">ยืนยันรหัสผ่านใหม่</label><input class="inp" type="password" id="ml-rpw2" autocomplete="new-password"><div class="help">อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข</div></div>' +
    '<button class="btn primary block lg" id="ml-rgo">' + ic('login') + ' ดูยอดของฉัน</button><p class="tiny muted mt8">ยังไม่มีรหัส / ลืมรหัสผ่าน: ขอ "รหัสดูยอด" จากฝ่ายอาคาร</p></div></div>' +
    '<p class="tiny muted center mt16">ติดต่อ ฝ่ายทรัพยากรบุคคล ' + esc((S.brand && S.brand.supportPhone) || '23400 - 23419') + ' · เห็นเฉพาะข้อมูลของท่านเอง · รุ่น ' + UB_BUILD + '</p></div>';
  var cid = false, rmode = 'L';
  $$('#ml-t button').forEach(function (b) { b.onclick = function () { $$('#ml-t button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#ml-e').classList.toggle('hide', b.dataset.t !== 'E'); $('#ml-r').classList.toggle('hide', b.dataset.t === 'E'); }; });
  $('#ml-sw').onclick = function (e) { e.preventDefault(); cid = !cid; $('#ml-pwf').classList.toggle('hide', cid); $('#ml-cidf').classList.toggle('hide', !cid); this.textContent = cid ? 'ใช้รหัสผ่าน HR Connect' : 'ยังไม่เคยตั้งรหัสผ่าน HR Connect? ใช้เลขบัตรประชาชน'; };
  $$('#ml-rt button').forEach(function (b) { b.onclick = function () { rmode = b.dataset.m; $$('#ml-rt button').forEach(function (x) { x.classList.toggle('on', x === b); }); $('#ml-codef').classList.toggle('hide', rmode !== 'A'); $('#ml-rpw2f').classList.toggle('hide', rmode !== 'A'); $('#ml-rpwl').textContent = rmode === 'A' ? 'ตั้งรหัสผ่านใหม่' : 'รหัสผ่าน'; }; });
  var ok = function (d) { meSave(d.token); meRender(d.data); };
  $('#ml-go').onclick = function () { var b = this; busy(b, true, 'กำลังตรวจสอบ'); S.token = null; api('meLogin', cid ? { empCode: $('#ml-emp').value.trim(), cid: $('#ml-cid').value } : { empCode: $('#ml-emp').value.trim(), password: $('#ml-pw').value }).then(ok).catch(function (e) { busy(b, false); errToast(e); }); };
  $('#ml-pw').onkeydown = function (e) { if (e.key === 'Enter') $('#ml-go').click(); };
  $('#ml-rgo').onclick = function () {
    var b = this; S.token = null;
    if (rmode === 'A' && $('#ml-rpw').value !== $('#ml-rpw2').value) return toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'warn');
    busy(b, true, 'กำลังตรวจสอบ');
    (rmode === 'A' ? api('meActivate', { rid: $('#ml-rid').value.trim(), code: $('#ml-code').value.trim(), password: $('#ml-rpw').value }) : api('meLoginR', { rid: $('#ml-rid').value.trim(), password: $('#ml-rpw').value })).then(ok).catch(function (e) { busy(b, false); errToast(e); });
  };
}

/* ---------------------------------------------------------------- หน้าหลัก */
function stTotal(st) { return st ? r2((st.W || 0) + (st.E || 0)) : 0; }
function meRender(d) {
  ME.data = d; var me = d.me, R = d.rounds;
  if (!ME.sel || !R.some(function (r) { return r.id === ME.sel; })) ME.sel = R.length ? R[0].id : null;
  $('#app').innerHTML = '<div class="me-wrap">' + meHead() +
    '<div class="card mt12 me-who"><div class="grow"><b>' + esc(me.name) + '</b><div class="small muted">' + esc(me.empCode ? 'รหัส ' + me.empCode : 'เลขผู้พัก ' + me.rid) + ' · ' + esc(me.rtypeTh) + '</div><div class="small">' + (me.rooms.length ? ic('home') + ' ' + me.rooms.map(esc).join(' · ') : '<span class="muted">ไม่มีห้องที่พักอยู่ปัจจุบัน</span>') + '</div></div>' +
    '<div class="row"><button class="btn sm hide inst" id="me-inst">' + ic('download') + ' ติดตั้งแอป</button><button class="btn sm" id="me-out">' + ic('logout') + ' ออก</button></div></div>' +
    (R.length ? '<div class="me-rounds mt12" id="me-rs">' + R.map(function (r) { var t = stTotal(r.st); return '<button data-r="' + r.id + '" class="' + (r.id === ME.sel ? 'on' : '') + '"><span>' + esc(rTh(r.id)) + '</span><b>' + (r.st ? baht(t) : '—') + '</b><i class="' + (r.status === 'LOCKED' ? 'ok' : 'wait') + '"></i></button>'; }).join('') + '</div><div id="me-body"></div>' :
      '<div class="card mt12">' + emptyHtml('ยังไม่มียอดค่าน้ำ–ค่าไฟที่เผยแพร่ (ระบบแสดงเมื่อฝ่ายอาคารส่งยอดประจำเดือนแล้ว)', 'calendar') + '</div>') +
    (R.filter(function (r) { return r.st; }).length > 1 ? '<div class="card mt12"><h3>' + ic('chart') + ' ย้อนหลัง</h3><div class="chartbox short"><canvas id="me-ch"></canvas></div></div>' : '') +
    '<div class="card mt12"><h3>' + ic('alert') + ' เรื่องที่ฉันแจ้ง</h3><div id="me-ds">' + meDisputes(d.disputes) + '</div></div>' +
    '<p class="tiny muted center mt16">สอบถาม ฝ่ายอาคาร หรือ ฝ่ายทรัพยากรบุคคล ' + esc(d.app.supportPhone) + ' · รุ่น ' + esc(d.app.build) + '</p></div>';
  $('#me-out').onclick = function () { confirmBox('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่', 'ออกจากระบบ').then(function (y) { if (y) { api('meLogout').catch(function () { }); logout(); } }); };
  $('#me-inst').onclick = installApp; if (window._bip) $('#me-inst').classList.remove('hide');
  $$('#me-rs button').forEach(function (b) { b.onclick = function () { ME.sel = b.dataset.r; $$('#me-rs button').forEach(function (x) { x.classList.toggle('on', x === b); }); meRound(); }; });
  if (R.length) meRound();
  meChart(R);
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
