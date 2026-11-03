/* SOMDEJ U-Bill — pages-read.js : เดินจดมิเตอร์ (มือถือ/แท็บเล็ต) · กรอกจากสมุด (ตาราง) · นำเข้าไฟล์ */

/* =================================================================== คิวบันทึก (กันเน็ตหลุดระหว่างเดินจด) */
var RQ = {
  key: function () { return 'ub_q:' + (S.me ? S.me.empCode : ''); },
  get: function () { try { return JSON.parse(localStorage.getItem(RQ.key()) || '[]'); } catch (e) { return []; } },
  set: function (q) { try { localStorage.setItem(RQ.key(), JSON.stringify(q)); } catch (e) { } },
  push: function (round, item) { var q = RQ.get().filter(function (x) { return !(x.round === round && x.item.meterId === item.meterId); }); q.push({ round: round, item: item }); RQ.set(q); },
  flush: function () {
    var q = RQ.get(); if (!q.length) return Promise.resolve(0);
    var round = q[0].round, items = q.filter(function (x) { return x.round === round; }).map(function (x) { return x.item; });
    return api('saveReadings', { round: round, items: items, source: 'MOBILE' }).then(function (d) {
      RQ.set(RQ.get().filter(function (x) { return x.round !== round; }));
      mergeReadings(d.readings);
      return items.length;
    });
  }
};
window.addEventListener('online', function () { RQ.flush().then(function (n) { if (n) { toast('ส่งข้อมูลที่ค้างไว้ ' + n + ' รายการแล้ว', 'ok'); if (S.route === 'read') PAGES.read([]); } }).catch(function () { }); });
function mergeReadings(rr) {
  if (!S.roundData) return;
  S.roundData.readings = S.roundData.readings || {};
  Object.keys(rr || {}).forEach(function (k) { S.roundData.readings[k] = rr[k]; });
  bindReadings();
}
function readPrefs() { try { return JSON.parse(localStorage.getItem('ub_rp') || '{}'); } catch (e) { return {}; } }
function savePrefs(p) { try { localStorage.setItem('ub_rp', JSON.stringify(p)); } catch (e) { } }

/* =================================================================== เดินจดมิเตอร์ */
PAGES.read = function () {
  var pg = shell('เดินจดมิเตอร์', 'แตะห้อง → กรอกเลขบนมิเตอร์ → บันทึก & ถัดไป');
  pg.innerHTML = loadingHtml();
  Promise.all([loadMaster(), loadRound('', true)]).then(function () {
    bindReadings();
    var rd = S.roundData.round;
    if (!rd) { pg.innerHTML = emptyHtml('ยังไม่มีรอบหักเงิน — ให้ฝ่ายอาคาร/HR สร้างรอบก่อน', 'calendar'); return; }
    renderReadPage(pg, rd);
    RQ.flush().catch(function () { });
  }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + ic('alert') + esc(e.message) + '</div>'; });
};
function renderReadPage(pg, rd) {
  var P = readPrefs(); P.kind = P.kind || 'E'; if (!P.bld || !S.boot.buildings.some(function (b) { return b.id === P.bld; })) P.bld = S.boot.buildings[0].id;
  var editable = roundEditable(rd);
  var draw = function () {
    savePrefs(P);
    var ms = S.master.meters.filter(function (m) { return m.kind === P.kind && m.bld === P.bld; });
    var floors = []; ms.forEach(function (m) { var f = m.floor || '-'; if (floors.indexOf(f) < 0) floors.push(f); });
    floors.sort(sortNat);
    if (P.floor && floors.indexOf(P.floor) < 0) P.floor = '';
    var list = ms.filter(function (m) { return !P.floor || (m.floor || '-') === P.floor; });
    var q = (P.q || '').trim();
    if (q) list = ms.filter(function (m) { return String(m.room).indexOf(q) >= 0 || String(m.newRoom).indexOf(q) >= 0 || m.curPayers.some(function (a) { return a.name.indexOf(q) >= 0 || a.empCode.indexOf(q) >= 0; }); });
    if (P.pending) list = list.filter(function (m) { return !isDone(m); });
    var done = ms.filter(isDone).length, pend = RQ.get().length;
    var cntB = {}; S.master.meters.forEach(function (m) { if (m.kind !== P.kind) return; var c = cntB[m.bld] = cntB[m.bld] || [0, 0]; c[1]++; if (isDone(m)) c[0]++; });
    pg.innerHTML = '<div class="mread">' +
      (!editable ? '<div class="note warn">' + ic('lock') + '<div>รอบ ' + esc(rTh(rd.id, true)) + ' อยู่ในสถานะ "' + RST_TH[rd.status] + '" — ดูได้อย่างเดียว</div></div>' : '') +
      (pend ? '<div class="note warn mt8">' + ic('alert') + '<div>มีข้อมูลรอส่ง ' + pend + ' รายการ (อินเทอร์เน็ตไม่เสถียร) <a href="#" id="q-retry">ส่งอีกครั้ง</a></div></div>' : '') +
      '<div class="card mt8"><div class="row between"><div class="seg" id="k-seg"><button data-k="E" class="' + (P.kind === 'E' ? 'on e' : '') + '">' + ic('bolt', 'e-ic') + ' ค่าไฟ</button><button data-k="W" class="' + (P.kind === 'W' ? 'on' : '') + '">' + ic('drop', 'w-ic') + ' ค่าน้ำ</button></div>' +
      '<div class="small muted">รอบ ' + esc(rTh(rd.id)) + ' · หน่วยใช้ ' + esc(rd.usageTh) + '</div></div>' +
      '<div class="chips mt12" id="b-chips">' + S.boot.buildings.filter(function (b) { return cntB[b.id]; }).map(function (b) { var c = cntB[b.id]; return '<button class="chip ' + (b.id === P.bld ? 'on' : '') + '" data-b="' + b.id + '">' + esc(b.short) + ' <span class="cnt">' + c[0] + '/' + c[1] + '</span></button>'; }).join('') + '</div>' +
      (floors.length > 8 ? '<div class="row mt8"><label class="small muted">ชั้น</label><select class="inp" id="f-sel" style="width:auto;min-width:160px"><option value="">ทุกชั้น (' + ms.filter(isDone).length + '/' + ms.length + ')</option>' + floors.map(function (f) { var n = ms.filter(function (m) { return (m.floor || '-') === f; }), d = n.filter(isDone).length; return '<option value="' + esc(f) + '"' + (P.floor === f ? ' selected' : '') + '>ชั้น ' + esc(f) + ' — ' + d + '/' + n.length + (d === n.length ? ' ✓' : '') + '</option>'; }).join('') + '</select>' + (P.floor ? '<button class="btn sm" id="f-next">ชั้นถัดไป ' + ic('arrowr') + '</button>' : '') + '</div>' :
      floors.length > 1 ? '<div class="chips mt8" id="f-chips"><button class="chip ' + (!P.floor ? 'on' : '') + '" data-f="">ทุกชั้น</button>' + floors.map(function (f) { var n = ms.filter(function (m) { return (m.floor || '-') === f; }), d = n.filter(isDone).length; return '<button class="chip ' + (P.floor === f ? 'on' : '') + '" data-f="' + esc(f) + '">ชั้น ' + esc(f) + ' <span class="cnt">' + d + '/' + n.length + '</span></button>'; }).join('') + '</div>' : '') +
      '<div class="row mt12"><div class="grow" style="position:relative"><input class="inp" id="r-q" placeholder="ค้นหาเลขห้อง / ชื่อ" value="' + esc(P.q || '') + '"></div><label class="check small"><input type="checkbox" id="r-pend" ' + (P.pending ? 'checked' : '') + '> เฉพาะที่ยังไม่จด</label></div>' +
      '<div class="mt12"><div class="row between small"><span>' + esc(bldOf(P.bld).name) + ' · ' + KIND_TH[P.kind] + '</span><b>' + done + ' / ' + ms.length + '</b></div><div class="bar ' + (P.kind === 'E' ? 'e' : '') + '"><i style="width:' + pct(done, ms.length) + '%"></i></div></div></div>' +
      '<div class="rooms mt12" id="rooms">' + (list.length ? list.map(roomCard).join('') : '') + '</div>' + (list.length ? '' : emptyHtml(P.pending ? 'จดครบทุกห้องในชุดนี้แล้ว 🎉' : 'ไม่พบห้อง', 'check')) + '</div>';
    $$('#k-seg button').forEach(function (b) { b.onclick = function () { P.kind = b.dataset.k; P.floor = ''; draw(); }; });
    $$('#b-chips .chip').forEach(function (b) { b.onclick = function () { P.bld = b.dataset.b; P.floor = ''; draw(); }; });
    $$('#f-chips .chip').forEach(function (b) { b.onclick = function () { P.floor = b.dataset.f; draw(); }; });
    if ($('#f-sel')) $('#f-sel').onchange = function () { P.floor = this.value; draw(); };
    if ($('#f-next')) $('#f-next').onclick = function () { var i = floors.indexOf(P.floor); P.floor = floors[(i + 1) % floors.length]; draw(); };
    $('#r-q').oninput = debounce(function () { P.q = $('#r-q').value; draw(); setTimeout(function () { var el = $('#r-q'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 0); }, 350);
    $('#r-pend').onchange = function () { P.pending = this.checked; draw(); };
    if ($('#q-retry')) $('#q-retry').onclick = function (e) { e.preventDefault(); RQ.flush().then(function (n) { toast('ส่งแล้ว ' + n + ' รายการ', 'ok'); draw(); }).catch(errToast); };
    $$('#rooms .rc').forEach(function (el) { el.onclick = function () { openReadSheet(el.dataset.id, list, rd, editable, draw); }; });
  };
  draw();
}
function isDone(m) { return !!(m._r && (m._r.curr != null || m._r.broken)); }
function roomCard(m) {
  var r = m._r, done = isDone(m), nc = m.status !== 'OCC', calc = done && !r.broken ? previewCalc(m, S.roundData.round, r.curr, false, r.reset) : null;
  var cls = 'rc' + (done ? ' done' : '') + (calc && calc.err ? ' err' : '') + (r && r.broken ? ' broken' : '') + (nc ? ' nc' : '');
  var who = nc ? MST_TH[m.status] : (m.curPayers.map(function (a) { return a.name.split(' ')[0]; }).join(', ') || 'ไม่มีผู้พัก');
  return '<button class="' + cls + '" data-id="' + esc(m.id) + '"><div class="rn">' + esc(m.room) + (m.label && m.label !== '1' ? ' <span class="tag" style="font-size:11px">' + esc(m.label === 'ห้องโถง' ? 'โถง' : 'ม.' + m.label) + '</span>' : '') + '</div>' +
    '<div class="pp">' + esc(who) + '</div><div class="vv">' + (done ? (r.broken ? '<span style="color:var(--warn)">มิเตอร์เสีย</span>' : nf(r.curr) + (calc && calc.usage != null ? ' <span class="muted">(+' + nf(calc.usage) + ')</span>' : '')) : '<span class="muted">ก่อน ' + (m._prev != null ? nf(m._prev) : '-') + '</span>') + '</div></button>';
}
function openReadSheet(id, list, rd, editable, redraw) {
  var m = S.master.byId[id], r = m._r || {};
  var idx = list.findIndex(function (x) { return x.id === id; });
  var payers = payersInRound(m, rd);
  var dlg = modal({
    title: kindIc(m.kind) + ' ' + esc(bldOf(m.bld).short) + ' · ห้อง ' + esc(m.room) + (m.label && m.label !== '1' ? ' · ' + (m.label === 'ห้องโถง' ? 'มิเตอร์ห้องโถง' : 'มิเตอร์ ' + esc(m.label)) : ''),
    body: '<div class="sheet-in">' +
      '<div class="small muted">' + (m.status !== 'OCC' ? '<span class="tag warn">' + MST_TH[m.status] + ' (ไม่เรียกเก็บ)</span> ' : '') + (payers.length ? payers.map(function (a) { return esc(a.name) + (a.payType === 'CASH' ? ' (เงินสด)' : ''); }).join(' · ') : 'ไม่มีผู้จ่าย') + '</div>' +
      '<div class="calcbox"><div><span>เลขครั้งก่อน</span><b>' + (m._prev != null ? nf(m._prev) : '-') + '</b></div><div><span>หน่วยใช้</span><b id="s-use">-</b></div><div><span>ยอด (บาท)</span><b id="s-amt">-</b></div></div>' +
      '<input class="bigin" id="s-curr" inputmode="decimal" placeholder="เลขครั้งนี้" value="' + (r.curr != null ? r.curr : '') + '" ' + (editable ? '' : 'disabled') + '>' +
      '<div id="s-msg" class="small mt8" style="min-height:20px"></div>' +
      '<div class="row mt8" style="justify-content:center"><label class="check"><input type="checkbox" id="s-broken" ' + (r.broken ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + '> มิเตอร์เสีย / จอดับ</label><a href="#" id="s-more" class="small">เปลี่ยนมิเตอร์ / หมายเหตุ</a></div>' +
      '<div id="s-adv" class="' + (r.reset != null || r.note ? '' : 'hide') + ' mt8" style="text-align:left"><div class="grid g2"><div><label class="f">เลขเริ่มใหม่ (เปลี่ยนมิเตอร์/เลขวนกลับ)</label><input class="inp" id="s-reset" inputmode="decimal" value="' + (r.reset != null ? r.reset : '') + '"></div><div><label class="f">หมายเหตุ</label><input class="inp" id="s-note" value="' + esc(r.note || '') + '"></div></div></div>' +
      (m.avgUsage ? '<div class="tiny muted mt8">ค่าเฉลี่ยหน่วยใช้ ' + nf(m.avgUsage) + ' · รอบก่อน ' + (m.lastUsage != null ? nf(m.lastUsage) : '-') + '</div>' : '') +
      (r.at ? '<div class="tiny muted">บันทึกล่าสุด ' + thDate(r.at) + ' โดย ' + esc(r.by) + '</div>' : '') + '</div>',
    buttons: editable ? [
      { label: ic('arrowl') + ' ก่อนหน้า', cls: 'ghost', onClick: function (close) { if (idx > 0) { close(); openReadSheet(list[idx - 1].id, list, rd, editable, redraw); } return false; } },
      { label: 'บันทึก', onClick: function (close) { return save(close, false); } },
      { label: 'บันทึก & ถัดไป ' + ic('arrowr'), cls: 'primary', onClick: function (close) { return save(close, true); } }
    ] : [{ label: 'ปิด' }],
    onOpen: function (el) {
      var upd = function () {
        var c = previewCalc(m, rd, $('#s-curr', el).value.trim(), $('#s-broken', el).checked, $('#s-reset', el).value.trim());
        $('#s-use', el).textContent = c.usage != null ? nf(c.usage) : '-';
        $('#s-amt', el).textContent = c.amount != null ? baht(c.amount) : '-';
        $('#s-msg', el).innerHTML = c.err ? '<span style="color:var(--danger)">' + ic('alert') + ' ' + esc(c.err) + '</span>' : c.warn ? '<span style="color:var(--warn)">' + ic('info') + ' ' + esc(c.warn) + '</span>' : '';
        $('#s-curr', el).disabled = !editable || $('#s-broken', el).checked;
      };
      ['#s-curr', '#s-reset'].forEach(function (s) { $(s, el).oninput = upd; });
      $('#s-broken', el).onchange = upd;
      $('#s-curr', el).onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); $$('.mf .btn', el).pop().click(); } };
      $('#s-more', el).onclick = function (e) { e.preventDefault(); $('#s-adv', el).classList.toggle('hide'); };
      upd();
      setTimeout(function () { var i = $('#s-curr', el); if (!i.disabled) { i.focus(); i.select(); } }, 80);
    }
  });
  function save(close, next) {
    var el = dlg.el, curr = $('#s-curr', el).value.trim(), broken = $('#s-broken', el).checked, reset = $('#s-reset', el).value.trim(), note = $('#s-note', el).value.trim();
    if (!broken && curr === '') { toast('กรุณากรอกเลขมิเตอร์ หรือติ๊ก "มิเตอร์เสีย"', 'warn'); return false; }
    var c = previewCalc(m, rd, curr, broken, reset);
    if (c.err) { toast(c.err + ' — ถ้าเปลี่ยนมิเตอร์ใหม่ ให้ใส่ "เลขเริ่มใหม่"', 'err'); $('#s-adv', el).classList.remove('hide'); return false; }
    var item = { meterId: m.id, curr: broken ? '' : curr, broken: broken, resetStart: reset, note: note };
    // บันทึกในเครื่องทันที (ไม่ต้องรอเน็ต) แล้วส่งเบื้องหลัง
    var local = {}; local[m.id] = [m._prev, broken ? null : +curr, broken ? 1 : 0, reset === '' ? null : +reset, r.exempt ? 1 : 0, r.exemptReason, note, S.me.empCode, new Date().toISOString(), 'MOBILE'];
    mergeReadings(local);
    api('saveReadings', { round: rd.id, items: [item], source: 'MOBILE' }).then(function (d) {
      if (d.errors && d.errors.length) { toast('ห้อง ' + m.room + ': ' + d.errors[0].msg, 'err'); return; }
      mergeReadings(d.readings);
    }).catch(function (e) {
      if (e.net || e.busy) { RQ.push(rd.id, item); toast('เน็ตไม่เสถียร — เก็บไว้ในเครื่องแล้ว จะส่งให้อัตโนมัติ', 'warn'); }
      else errToast(e);
    });
    close(); redraw();
    if (next) {
      var rest = list.slice(idx + 1).concat(list.slice(0, idx)).filter(function (x) { return !isDone(x); });
      if (rest.length) setTimeout(function () { openReadSheet(rest[0].id, list, rd, editable, redraw); }, 60);
      else toast('จดครบทุกห้องในชุดนี้แล้ว 🎉', 'ok');
    }
    return false;
  }
}

/* =================================================================== กรอกจากสมุด (ตาราง) */
PAGES.desk = function () {
  var pg = shell('กรอกจากสมุด / นำเข้า', 'กรอกเลขมิเตอร์แบบตาราง (Enter = ลงบรรทัดถัดไป) · ดาวน์โหลดแม่แบบ · นำเข้าไฟล์ Excel',
    '<button class="btn" id="d-tpl">' + ic('download') + ' แม่แบบรอบนี้</button><button class="btn" id="d-imp">' + ic('upload') + ' นำเข้าไฟล์</button>');
  pg.innerHTML = loadingHtml();
  $('#d-tpl').onclick = function () { exportFile('TEMPLATE', this); };
  $('#d-imp').onclick = function () { importReadingsDialog(); };
  Promise.all([loadMaster(), loadRound('', true)]).then(function () {
    bindReadings();
    var rd = S.roundData.round;
    if (!rd) { pg.innerHTML = emptyHtml('ยังไม่มีรอบหักเงิน', 'calendar'); return; }
    renderDesk(pg, rd);
  }).catch(function (e) { pg.innerHTML = '<div class="note danger">' + ic('alert') + esc(e.message) + '</div>'; });
};
function renderDesk(pg, rd) {
  var P = readPrefs(); P.dkind = P.dkind || 'E'; P.dbld = P.dbld || S.boot.buildings[0].id;
  var editable = roundEditable(rd), dirty = {};
  var draw = function () {
    savePrefs(P);
    var ms = S.master.meters.filter(function (m) { return m.kind === P.dkind && (P.dbld === '*' || m.bld === P.dbld); });
    var floors = []; ms.forEach(function (m) { var f = m.floor || '-'; if (floors.indexOf(f) < 0) floors.push(f); }); floors.sort(sortNat);
    if (P.dfloor && floors.indexOf(P.dfloor) < 0) P.dfloor = '';
    var list = ms.filter(function (m) { return (!P.dfloor || (m.floor || '-') === P.dfloor) && (!P.dpend || !isDone(m)); });
    var q = (P.dq || '').trim(); if (q) list = list.filter(function (m) { return String(m.room).indexOf(q) >= 0 || m.curPayers.some(function (a) { return a.name.indexOf(q) >= 0 || a.empCode.indexOf(q) >= 0; }); });
    var done = ms.filter(isDone).length;
    pg.innerHTML = (!editable ? '<div class="note warn">' + ic('lock') + '<div>รอบ ' + esc(rTh(rd.id, true)) + ' "' + RST_TH[rd.status] + '" — ดูได้อย่างเดียว</div></div>' : '') +
      '<div class="card flat mt8"><div class="row"><div class="seg" id="dk"><button data-k="E" class="' + (P.dkind === 'E' ? 'on e' : '') + '">' + ic('bolt', 'e-ic') + ' ค่าไฟ</button><button data-k="W" class="' + (P.dkind === 'W' ? 'on' : '') + '">' + ic('drop', 'w-ic') + ' ค่าน้ำ</button></div>' +
      '<select class="inp" id="db" style="width:auto">' + S.boot.buildings.map(function (b) { return '<option value="' + b.id + '"' + (b.id === P.dbld ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '<option value="*"' + (P.dbld === '*' ? ' selected' : '') + '>ทุกที่พัก</option></select>' +
      '<select class="inp" id="df" style="width:auto"><option value="">ทุกชั้น</option>' + floors.map(function (f) { return '<option' + (P.dfloor === f ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select>' +
      '<input class="inp" id="dq" placeholder="ค้นหาห้อง/ชื่อ/รหัส" style="max-width:200px" value="' + esc(P.dq || '') + '"><label class="check small"><input type="checkbox" id="dp" ' + (P.dpend ? 'checked' : '') + '> เฉพาะยังไม่กรอก</label>' +
      '<label class="check small"><input type="checkbox" id="dr" ' + (P.dreset ? 'checked' : '') + '> แสดงช่องเปลี่ยนมิเตอร์</label><span class="grow"></span><span class="small"><b>' + done + '</b> / ' + ms.length + ' กรอกแล้ว</span></div></div>' +
      '<div class="tbl-wrap mt12" style="max-height:calc(100vh - 290px)"><table class="t" id="dt"><thead><tr><th>ห้อง</th><th>ผู้จ่าย</th><th class="n">ครั้งก่อน</th><th class="n">ครั้งนี้</th><th class="center">เสีย</th>' + (P.dreset ? '<th class="n">เลขเริ่มใหม่</th>' : '') + '<th class="n">หน่วย</th><th class="n">ยอด (บาท)</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' +
      list.map(function (m, i) { return deskRow(m, rd, P, editable, i); }).join('') + '</tbody></table></div>' +
      (list.length ? '' : emptyHtml('ไม่พบรายการ', 'search')) +
      (editable ? '<div class="stickybar row"><span id="d-dirty" class="small muted">ยังไม่มีการแก้ไข</span><span class="grow"></span><button class="btn primary" id="d-save" disabled>' + ic('check') + ' บันทึก</button></div>' : '');
    $$('#dk button').forEach(function (b) { b.onclick = function () { if (confirmLeave()) { P.dkind = b.dataset.k; draw(); } }; });
    $('#db').onchange = function () { if (confirmLeave()) { P.dbld = this.value; P.dfloor = ''; draw(); } else this.value = P.dbld; };
    $('#df').onchange = function () { P.dfloor = this.value; draw(); };
    $('#dq').oninput = debounce(function () { P.dq = $('#dq').value; draw(); var el = $('#dq'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); }, 400);
    $('#dp').onchange = function () { P.dpend = this.checked; draw(); };
    $('#dr').onchange = function () { P.dreset = this.checked; draw(); };
    var tb = $('#dt tbody');
    var ins = $$('input.cell[data-f="curr"]', tb);
    tb.addEventListener('input', function (e) { var t = e.target; if (!t.dataset.id) return; markDirty(t.dataset.id); });
    tb.addEventListener('change', function (e) { var t = e.target; if (t.type === 'checkbox' && t.dataset.id) markDirty(t.dataset.id); });
    tb.addEventListener('keydown', function (e) {
      var t = e.target; if (!t.classList.contains('cell')) return;
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var col = $$('input.cell[data-f="' + t.dataset.f + '"]', tb), i = col.indexOf(t), nx = col[i + (e.key === 'ArrowUp' ? -1 : 1)];
        if (nx) { nx.focus(); nx.select(); }
      }
    });
    $$('[data-more]', tb).forEach(function (b) { b.onclick = function () { readingMoreDialog(S.master.byId[b.dataset.more], rd, draw); }; });
    if ($('#d-save')) $('#d-save').onclick = function () { saveDesk(this); };
    function markDirty(id) {
      var row = $('tr[data-id="' + CSS.escape(id) + '"]', tb), m = S.master.byId[id];
      var curr = $('[data-f="curr"]', row).value.trim(), broken = $('[data-f="broken"]', row).checked, reset = $('[data-f="reset"]', row) ? $('[data-f="reset"]', row).value.trim() : (m._r && m._r.reset != null ? String(m._r.reset) : ''), note = $('[data-f="note"]', row).value.trim();
      dirty[id] = { meterId: id, curr: broken ? '' : curr, broken: broken, resetStart: reset, note: note };
      $('[data-f="curr"]', row).classList.add('dirty');
      var c = previewCalc(m, rd, curr, broken, reset);
      $('[data-c="use"]', row).textContent = c.usage != null ? nf(c.usage) : '';
      $('[data-c="amt"]', row).textContent = c.amount != null ? baht(c.amount) : '';
      $('[data-f="curr"]', row).classList.toggle('bad', !!c.err);
      $('[data-f="curr"]', row).title = c.err || c.warn || '';
      $('[data-f="curr"]', row).disabled = broken;
      var n = Object.keys(dirty).length; $('#d-dirty').innerHTML = '<b style="color:var(--elec-2)">แก้ไข ' + n + ' รายการ ยังไม่บันทึก</b>'; $('#d-save').disabled = !n;
    }
  };
  function confirmLeave() { return !Object.keys(dirty).length || window.confirm('มีรายการที่ยังไม่บันทึก ต้องการทิ้งการแก้ไขหรือไม่'); }
  function saveDesk(btn) {
    var items = Object.keys(dirty).map(function (k) { return dirty[k]; });
    var bad = items.filter(function (it) { var c = previewCalc(S.master.byId[it.meterId], rd, it.curr, it.broken, it.resetStart); return c.err; });
    if (bad.length) return toast('มี ' + bad.length + ' รายการที่เลขครั้งนี้น้อยกว่าครั้งก่อน (กรอบแดง) — แก้ไขหรือใส่เลขเริ่มใหม่ก่อน', 'err');
    busy(btn, true, 'กำลังบันทึก');
    var chunks = []; for (var i = 0; i < items.length; i += 400) chunks.push(items.slice(i, i + 400));
    var errs = [];
    chunks.reduce(function (p, ch) { return p.then(function () { return api('saveReadings', { round: rd.id, items: ch, source: 'DESK' }).then(function (d) { mergeReadings(d.readings); errs = errs.concat(d.errors || []); }); }); }, Promise.resolve())
      .then(function () { busy(btn, false); dirty = {}; toast('บันทึกแล้ว ' + items.length + ' รายการ' + (errs.length ? ' · ไม่สำเร็จ ' + errs.length : ''), errs.length ? 'warn' : 'ok'); draw(); })
      .catch(function (e) { busy(btn, false); errToast(e); });
  }
  window.onbeforeunload = function () { return Object.keys(dirty).length ? 'unsaved' : undefined; };
  draw();
}
function deskRow(m, rd, P, editable, i) {
  var r = m._r || {}, pay = payersInRound(m, rd), nc = m.status !== 'OCC';
  var c = r.curr != null || r.broken ? previewCalc(m, rd, r.curr, r.broken, r.reset) : {};
  var dis = editable ? '' : 'disabled';
  return '<tr data-id="' + esc(m.id) + '" class="' + (isDone(m) ? 'done' : '') + (c.err ? ' err' : '') + '"><td class="nowrap"><b>' + esc(m.room) + '</b>' + (m.label && m.label !== '1' ? ' <span class="tag">' + esc(m.label === 'ห้องโถง' ? 'โถง' : 'ม.' + m.label) + '</span>' : '') + (P.dbld === '*' ? '<div class="tiny muted">' + esc(bldOf(m.bld).short) + '</div>' : '') + '</td>' +
    '<td style="min-width:180px">' + (nc ? '<span class="tag warn">' + MST_TH[m.status] + '</span>' : '') + (pay.length ? pay.map(function (a) { return '<span class="payer">' + esc(a.name) + (a.payType === 'CASH' ? ' <span class="tag elec">สด</span>' : ' <span class="c">' + esc(a.empCode) + '</span>') + '</span>'; }).join('<br>') : (nc ? '' : '<span class="tag danger">ไม่มีผู้จ่าย</span>')) + '</td>' +
    '<td class="n">' + (m._prev != null ? nf(m._prev) : '<span class="muted">-</span>') + '</td>' +
    '<td class="n"><input class="cell" data-f="curr" data-id="' + esc(m.id) + '" inputmode="decimal" value="' + (r.curr != null ? r.curr : '') + '" ' + dis + (r.broken ? ' disabled' : '') + ' title="' + esc(c.err || c.warn || '') + '"></td>' +
    '<td class="center"><input type="checkbox" data-f="broken" data-id="' + esc(m.id) + '" ' + (r.broken ? 'checked' : '') + ' ' + dis + '></td>' +
    (P.dreset ? '<td class="n"><input class="cell" data-f="reset" data-id="' + esc(m.id) + '" inputmode="decimal" style="width:90px" value="' + (r.reset != null ? r.reset : '') + '" ' + dis + '></td>' : '') +
    '<td class="n" data-c="use">' + (c.usage != null ? nf(c.usage) : '') + '</td><td class="n" data-c="amt">' + (c.amount != null ? baht(c.amount) : '') + '</td>' +
    '<td><input class="cell note" data-f="note" data-id="' + esc(m.id) + '" value="' + esc(r.note || '') + '" ' + dis + '>' + (r.exempt ? ' <span class="tag violet" title="' + esc(r.exemptReason) + '">ยกเว้น</span>' : '') + '</td>' +
    '<td>' + (canEdit() ? '<button class="btn ghost icon sm" data-more="' + esc(m.id) + '" title="เพิ่มเติม">' + ic('settings') + '</button>' : '') + '</td></tr>';
}
/** ตัวเลือกเพิ่มเติมของเลขมิเตอร์: แก้เลขครั้งก่อน · ยกเว้นการเรียกเก็บ · ประวัติ */
function readingMoreDialog(m, rd, redraw) {
  var r = m._r || {}, editable = roundEditable(rd);
  modal({ title: 'ห้อง ' + esc(m.room) + ' · ' + KIND_TH[m.kind] + (m.label !== '1' ? ' (' + esc(m.label) + ')' : ''),
    body: '<div class="grid g2"><div class="field"><label class="f">เลขครั้งก่อน (แก้เฉพาะกรณีผิด)</label><input class="inp" id="x-prev" inputmode="decimal" value="' + (m._prev != null ? m._prev : '') + '" ' + (editable ? '' : 'disabled') + '></div>' +
      '<div class="field"><label class="f">เลขครั้งนี้</label><input class="inp" id="x-curr" inputmode="decimal" value="' + (r.curr != null ? r.curr : '') + '" ' + (editable ? '' : 'disabled') + '></div></div>' +
      '<label class="check"><input type="checkbox" id="x-ex" ' + (r.exempt ? 'checked' : '') + ' ' + (editable ? '' : 'disabled') + '> ยกเว้นการเรียกเก็บมิเตอร์นี้ในรอบนี้</label>' +
      '<div class="field mt8"><label class="f">เหตุผลที่ยกเว้น</label><input class="inp" id="x-exr" value="' + esc(r.exemptReason || '') + '" ' + (editable ? '' : 'disabled') + '></div>' +
      '<div class="small muted">' + (r.at ? 'บันทึกล่าสุด ' + thDate(r.at) + ' โดย ' + esc(r.by) + ' (' + esc(r.src || '') + ')' : 'ยังไม่บันทึกในรอบนี้') + '</div><div id="x-hist" class="mt12">' + loadingHtml('โหลดประวัติ…') + '</div>',
    buttons: editable ? [{ label: 'ยกเลิก' }, { label: 'บันทึก', cls: 'primary', onClick: function () {
      var ex = $('#x-ex').checked, it = { meterId: m.id, curr: $('#x-curr').value.trim(), broken: r.broken, resetStart: r.reset != null ? r.reset : '', note: r.note || '', prev: $('#x-prev').value.trim(), exempt: ex, exemptReason: $('#x-exr').value.trim() };
      return api('saveReadings', { round: rd.id, items: [it], source: 'DESK' }).then(function (d) { if (d.errors.length) throw new Error(d.errors[0].msg); mergeReadings(d.readings); toast('บันทึกแล้ว', 'ok'); redraw(); });
    } }] : [{ label: 'ปิด' }],
    onOpen: function () {
      api('getMeterHistory', { meterId: m.id }).then(function (h) {
        $('#x-hist').innerHTML = h.length ? '<div class="small"><b>ประวัติในระบบ</b></div><div class="tbl-wrap" style="max-height:200px"><table class="t"><thead><tr><th>รอบ</th><th class="n">ก่อน</th><th class="n">หลัง</th><th class="n">หน่วย</th></tr></thead><tbody>' + h.map(function (x) { return '<tr><td>' + rTh(x.round) + '</td><td class="n">' + nf(x.prev) + '</td><td class="n">' + (x.broken ? 'เสีย' : nf(x.curr)) + '</td><td class="n">' + (x.usage != null ? nf(x.usage) : '-') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="small muted">ยังไม่มีประวัติในระบบ</div>';
      }).catch(function () { $('#x-hist').innerHTML = ''; });
    } });
}

/* =================================================================== นำเข้าไฟล์ (เลขมิเตอร์ / ทะเบียน) */
function importReadingsDialog(mode) {
  mode = mode || 'READINGS';
  var master = mode !== 'READINGS';
  var dlg = modal({ title: master ? 'นำเข้าทะเบียนจากแม่แบบ' : 'นำเข้าเลขมิเตอร์จากไฟล์', wide: true,
    body: '<div class="note info">' + ic('info') + '<div>' + (master ? 'ใช้ไฟล์ <b>U-Bill_แม่แบบจดมิเตอร์</b> (ชีท ค่าน้ำ / ค่าไฟ) ระบบจะสร้าง/ปรับ <b>ห้อง · มิเตอร์ · ผู้จ่าย · เลขครั้งก่อน</b> ตามไฟล์ (ผู้จ่ายเดิมของมิเตอร์ในไฟล์จะถูกแทนที่) และถ้ามี "เลขครั้งนี้" จะบันทึกลงรอบปัจจุบันด้วย' :
      'ใช้ไฟล์แม่แบบของรอบนี้ (ปุ่ม "แม่แบบรอบนี้") ระบบอ่านคอลัมน์ <b>รหัสมิเตอร์ · เลขครั้งนี้ · มิเตอร์เสีย · เลขเริ่มใหม่ · หมายเหตุ</b> — แถวที่ไม่มีเลขครั้งนี้จะข้าม') + '</div></div>' +
      '<div class="mt12"><input type="file" id="i-file" accept=".xlsx,.xls" class="inp"></div><div id="i-prev" class="mt12"></div>' +
      (master ? '<div class="field mt12"><label class="f">วันที่เริ่มพักของผู้จ่ายที่นำเข้า</label><input class="inp" type="date" id="i-start" style="max-width:220px" value="' + (S.round ? S.round.usageFrom : today()) + '"><div class="help">ค่าเริ่ม = วันแรกของเดือนที่ใช้ของรอบปัจจุบัน (ทุกคนอยู่ครบเดือน)</div></div>' : ''),
    buttons: [{ label: 'ยกเลิก' }, { label: ic('upload') + ' นำเข้า', cls: 'primary', onClick: function (close, el, btn) {
      if (!dlg.rows) { toast('กรุณาเลือกไฟล์', 'warn'); return false; }
      var rows = master ? dlg.rows : dlg.rows.filter(function (r) { return r.curr !== '' || r.broken || r.resetStart !== ''; });
      if (!rows.length) { toast('ไม่มีแถวที่มีเลขครั้งนี้', 'warn'); return false; }
      var res = { meters: 0, created: 0, assigns: 0, readings: 0, skipped: [], warnings: [] }, chunks = [];
      for (var i = 0; i < rows.length; i += 450) chunks.push(rows.slice(i, i + 450));
      var n = 0;
      busy(btn, true, 'กำลังนำเข้า 0/' + rows.length);
      return chunks.reduce(function (p, ch) {
        return p.then(function () {
          return api('importMaster', { mode: master ? (dlg.hasCurr ? 'BOTH' : 'MASTER') : 'READINGS', rows: ch, round: S.round ? S.round.id : '', startDate: master ? $('#i-start').value : '', prevRound: S.round ? usageOf(S.round.id) : '', fileName: dlg.fileName })
            .then(function (d) { n += ch.length; btn.innerHTML = 'กำลังนำเข้า ' + n + '/' + rows.length; ['meters', 'created', 'assigns', 'readings'].forEach(function (k) { res[k] += d[k]; }); res.skipped = res.skipped.concat(d.skipped); res.warnings = res.warnings.concat(d.warnings); });
        });
      }, Promise.resolve()).then(function () {
        S.master = null; S.roundData = null;
        modal({ title: 'นำเข้าเรียบร้อย', body: '<dl class="kv">' + (master ? '<dt>มิเตอร์</dt><dd>' + nf(res.meters) + ' (ใหม่ ' + nf(res.created) + ')</dd><dt>ผู้จ่าย</dt><dd>' + nf(res.assigns) + '</dd>' : '') + '<dt>เลขมิเตอร์รอบนี้</dt><dd>' + nf(res.readings) + '</dd><dt>ข้าม</dt><dd>' + res.skipped.length + '</dd></dl>' +
          (res.skipped.length || res.warnings.length ? '<div class="tbl-wrap mt12" style="max-height:260px"><table class="t"><tbody>' + res.skipped.map(function (s) { return '<tr><td>แถว ' + s.row + '</td><td>' + esc(s.reason) + '</td></tr>'; }).join('') + res.warnings.map(function (s) { return '<tr><td>แถว ' + s.row + '</td><td>' + esc(s.msg) + '</td></tr>'; }).join('') + '</tbody></table></div>' : ''),
          buttons: [{ label: 'ตกลง', cls: 'primary', onClick: function () { route(); } }] });
      });
    } }],
    onOpen: function (el) {
      $('#i-file', el).onchange = function () {
        var f = this.files[0]; if (!f) return;
        $('#i-prev', el).innerHTML = loadingHtml('กำลังอ่านไฟล์…');
        XIO.readTemplate(f).then(function (rows) {
          dlg.rows = rows; dlg.fileName = f.name; dlg.hasCurr = rows.some(function (r) { return r.curr !== '' || r.broken; });
          var known = S.master ? rows.filter(function (r) { return r.meterId && S.master.byId[r.meterId]; }).length : 0;
          var withCurr = rows.filter(function (r) { return r.curr !== '' || r.broken; }).length;
          var k = { W: 0, E: 0 }; rows.forEach(function (r) { k[r.kind] = (k[r.kind] || 0) + 1; });
          $('#i-prev', el).innerHTML = '<div class="grid g4">' + kpi('แถวในไฟล์', nf(rows.length), 'แถว', 'น้ำ ' + nf(k.W) + ' · ไฟ ' + nf(k.E), 'var(--water-soft)', 'file') + kpi('มีเลขครั้งนี้', nf(withCurr), 'แถว', 'จะบันทึกลงรอบ ' + (S.round ? rTh(S.round.id) : '-'), 'var(--ok-soft)', 'check') +
            kpi('ตรงกับทะเบียน', nf(known), 'มิเตอร์', master ? 'ไม่ตรง = สร้างใหม่' : 'ไม่ตรง = ข้าม', 'var(--violet-soft)', 'building') + kpi('มิเตอร์เสีย', nf(rows.filter(function (r) { return r.broken; }).length), 'ตัว', '', 'var(--elec-soft)', 'alert') + '</div>';
        }).catch(function (e) { $('#i-prev', el).innerHTML = '<div class="note danger">' + ic('alert') + esc(e.message) + '</div>'; dlg.rows = null; });
      };
    } });
}
