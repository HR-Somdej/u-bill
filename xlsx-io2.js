/* SOMDEJ U-Bill — xlsx-io2.js : รายงานเงินสด · รายงานห้องพัก · อ่านไฟล์รายชื่อบุคลากร HRMi (build 2569-11-08.1) */
var XIO2 = (function () {
  var KTH = { W: 'ค่าน้ำ', E: 'ค่าไฟ' };
  /** รวมผู้ชำระเงินสดเป็น 1 คน 1 แถว (น้ำ + ไฟ ทุกที่พัก) */
  function cashPeople(d) {
    var by = {}, out = [], rs = d.residents || {};
    d.persons.filter(function (p) { return p.payType === 'CASH' && p.amount > 0; }).forEach(function (p) {
      var k = p.rid || p.name, x = by[k];
      if (!x) { var r = rs[p.rid] || {}; x = by[k] = { rid: p.rid || '', name: p.name, ref: p.cashCode || '', group: r.group || '', position: r.position || '', division: r.division || '', blds: {}, rooms: {}, W: 0, E: 0 }; out.push(x); }
      x[p.kind] = r2(x[p.kind] + p.amount); x.blds[bldOf(p.bld).short] = 1; String(p.rooms).split(', ').forEach(function (rm) { if (rm) x.rooms[rm] = 1; });
    });
    out.forEach(function (x) { x.total = r2(x.W + x.E); x.bld = Object.keys(x.blds).join(', '); x.room = Object.keys(x.rooms).join(', '); x.group = x.group || 'ไม่ระบุกลุ่ม'; });
    out.sort(function (a, b) { return a.group.localeCompare(b.group, 'th') || sortNat(a.bld + a.room, b.bld + b.room); });
    return out;
  }
  function CASH(d, U) {
    var L = cashPeople(d), job = d.round.id, wb = XLSX.utils.book_new();
    var H = [['รายงานผู้ชำระค่าน้ำ–ค่าไฟที่พักเป็นเงินสด · รอบ ' + rTh(job, true) + ' (หน่วยใช้ ' + d.round.usageTh + ')'], [d.org + ' · อัตรา น้ำ ' + d.rates.W + ' / ไฟ ' + d.rates.E + ' บาท/หน่วย'], [U.stampLine(d)], []];
    var cols = ['ลำดับ', 'เลขผู้พัก', 'ชื่อ - สกุล', 'กลุ่ม', 'ตำแหน่ง / สังกัด', 'ที่พัก', 'ห้อง', 'ค่าน้ำ (บาท)', 'ค่าไฟ (บาท)', 'รวม (บาท)', 'วันที่ชำระ', 'เลขที่ใบเสร็จ', 'ลงชื่อผู้รับเงิน', 'หมายเหตุ'];
    var W = [6, 10, 30, 18, 28, 14, 16, 12, 12, 12, 12, 14, 18, 18];
    var row = function (x, i) { return [i + 1, x.rid, x.name, x.group, [x.position, x.division].filter(Boolean).join(' / '), x.bld, x.room, x.W, x.E, x.total, '', '', '', x.ref ? 'อ้างอิง ' + x.ref : '']; };
    var tot = function (A) { return ['', '', 'รวม ' + A.length + ' คน', '', '', '', '', r2(A.reduce(function (s, x) { return s + x.W; }, 0)), r2(A.reduce(function (s, x) { return s + x.E; }, 0)), r2(A.reduce(function (s, x) { return s + x.total; }, 0))]; };
    XLSX.utils.book_append_sheet(wb, U.sheet(H.concat([cols]).concat(L.map(row)).concat([tot(L)]), W), 'รวมทั้งหมด');
    var groups = {}; L.forEach(function (x) { (groups[x.group] = groups[x.group] || []).push(x); });
    Object.keys(groups).forEach(function (g) { XLSX.utils.book_append_sheet(wb, U.sheet(H.concat([['กลุ่ม: ' + g], cols]).concat(groups[g].map(row)).concat([tot(groups[g])]), W), U.safeSheet(g).slice(0, 28) || 'กลุ่ม'); });
    var pend = d.persons.filter(function (p) { return p.payType === 'PENDING'; });
    if (pend.length) XLSX.utils.book_append_sheet(wb, U.sheet(H.concat([['ผู้รอรหัสพนักงาน — ยอดพักไว้ ไม่ต้องเรียกเก็บเงินสด (ระบบหักย้อนหลังเมื่อได้รหัส)'], ['ประเภท', 'ที่พัก', 'ชื่อ', 'ห้อง', 'ยอด (บาท)']]).concat(pend.map(function (p) { return [KTH[p.kind], bldOf(p.bld).name, p.name, p.rooms, r2(p.amount)]; })), [8, 24, 30, 16, 12]), 'รอรหัส (ไม่เก็บเงินสด)');
    var name = 'U-Bill_รายงานเงินสด_' + U.fileStamp(d) + '.xlsx';
    U.save(wb, name);
    return Promise.resolve({ file: name, rows: L.length, amount: r2(L.reduce(function (s, x) { return s + x.total; }, 0)) });
  }
  function printCash(d, U) {
    var L = cashPeople(d), groups = {}; L.forEach(function (x) { (groups[x.group] = groups[x.group] || []).push(x); });
    var w = window.open('', '_blank'); if (!w) return toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — กรุณาอนุญาต pop-up', 'warn');
    var css = 'body{font-family:"IBM Plex Sans Thai",sans-serif;font-size:12px;color:#111;margin:18px}h2{font-size:16px;margin:0}h3{font-size:14px;margin:16px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 6px}th{background:#eef3f8}td.n{text-align:right}.s{color:#555;font-size:11px}@page{size:A4 landscape;margin:12mm}tr{page-break-inside:avoid}';
    var tbl = function (A) { return '<table><thead><tr><th>#</th><th>ชื่อ - สกุล</th><th>ตำแหน่ง / สังกัด</th><th>ที่พัก · ห้อง</th><th>ค่าน้ำ</th><th>ค่าไฟ</th><th>รวม (บาท)</th><th>วันที่ชำระ</th><th>เลขใบเสร็จ</th><th style="width:120px">ลงชื่อผู้รับเงิน</th></tr></thead><tbody>' +
      A.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.name) + '<div class="s">' + esc(x.rid) + '</div></td><td>' + esc([x.position, x.division].filter(Boolean).join(' / ')) + '</td><td>' + esc(x.bld + ' · ' + x.room) + '</td><td class="n">' + baht(x.W) + '</td><td class="n">' + baht(x.E) + '</td><td class="n"><b>' + baht(x.total) + '</b></td><td></td><td></td><td></td></tr>'; }).join('') +
      '<tr><td></td><td colspan="3"><b>รวม ' + A.length + ' คน</b></td><td class="n">' + baht(A.reduce(function (s, x) { return s + x.W; }, 0)) + '</td><td class="n">' + baht(A.reduce(function (s, x) { return s + x.E; }, 0)) + '</td><td class="n"><b>' + baht(A.reduce(function (s, x) { return s + x.total; }, 0)) + '</b></td><td colspan="3"></td></tr></tbody></table>'; };
    w.document.write('<html><head><meta charset="utf-8"><title>รายงานเงินสด ' + d.round.id + '</title><style>' + css + '</style></head><body><h2>รายงานผู้ชำระค่าน้ำ–ค่าไฟที่พักเป็นเงินสด · รอบ ' + esc(rTh(d.round.id, true)) + '</h2><div class="s">หน่วยใช้ ' + esc(d.round.usageTh) + ' · ' + esc(U.stampLine(d)) + '</div>' +
      Object.keys(groups).map(function (g) { return '<h3>' + esc(g) + '</h3>' + tbl(groups[g]); }).join('') + (L.length ? '' : '<p>ไม่มีผู้ชำระเงินสดในรอบนี้</p>') +
      '<p class="s" style="margin-top:24px">ลงชื่อ ................................................ ผู้ส่งรายงาน &nbsp;&nbsp;&nbsp; ลงชื่อ ................................................ ผู้รับรายงาน</p></body></html>');
    w.document.close(); setTimeout(function () { w.print(); }, 400);
  }
  /* ---------------------------------------------------------------- รายงานห้องพัก */
  function ROOMS(d, U) {
    var RM = roomModel(prepMaster(d.master)), wb = XLSX.utils.book_new(), H = [['SOMDEJ U-Bill · รายงานห้องพักและผู้พัก ณ ' + thDate(today(), false)], [U.stampLine(d)], []];
    var A = H.concat([['ที่พัก', 'ฝั่ง/โซน', 'ชั้น', 'ห้อง', 'ประเภทห้อง', 'เตียง', 'ห้องสำหรับ', 'สถานะ', 'สาเหตุ/รายละเอียด', 'ผู้พัก (คน)', 'เตียงว่าง', 'รายชื่อผู้พัก', 'มิเตอร์', 'หมายเหตุ']]);
    RM.rooms.forEach(function (r) { A.push([bldOf(r.bld).name, r.zone, r.floor, r.room, r.type, r.beds != null ? r.beds : '', ROOMGENDER_TH[r.gender || ''], RSTATE[r.state].t, r.statusReason || '', r.n, r.freeBeds, r.people.map(function (p) { return p.name; }).join(', '), r.meters.map(function (m) { return KTH[m.kind]; }).join(', '), r.note || '']); });
    XLSX.utils.book_append_sheet(wb, U.sheet(A, [24, 16, 6, 12, 12, 6, 10, 18, 22, 8, 8, 50, 14, 20]), 'ทะเบียนห้อง');
    var P = H.concat([['เลขผู้พัก', 'ชื่อ - สกุล', 'รหัสพนักงาน', 'ประเภท', 'กลุ่ม', 'เพศ', 'ตำแหน่ง', 'ฝ่าย', 'ที่พัก', 'ห้อง', 'วันที่เข้าพัก', 'พักการเรียกเก็บ', 'มีเบอร์', 'มีอีเมล']]);
    RM.rooms.forEach(function (r) { r.people.forEach(function (p) { P.push([p.rid, p.name, p.rtype === 'EMP' ? p.empCode : '', RTYPE_TH[p.rtype] || '', p.group, GENDER_TH[p.gender] || '', p.position, p.division, bldOf(r.bld).name, r.room, p.start, p.leave ? p.leave.reason + ' ' + p.leave.from + ' – ' + (p.leave.to || 'ไม่กำหนด') : '', (p.cf & 1) ? 'มี' : 'ไม่มี', (p.cf & 2) ? 'มี' : 'ไม่มี']); }); });
    XLSX.utils.book_append_sheet(wb, U.sheet(P, [10, 30, 12, 14, 16, 6, 24, 28, 24, 10, 12, 30, 8, 8]), 'ผู้พักปัจจุบัน');
    var V = H.concat([['ที่พัก', 'ชั้น', 'ห้อง', 'ประเภท', 'เตียง', 'เตียงว่าง', 'สถานะ', 'สาเหตุ', 'ตั้งแต่', 'คาดว่าเสร็จ']]);
    RM.rooms.filter(function (r) { return ['VACANT', 'PARTIAL', 'RESERVED', 'REPAIR', 'CLOSED'].indexOf(r.state) >= 0; }).forEach(function (r) { V.push([bldOf(r.bld).name, r.floor, r.room, r.type, r.beds != null ? r.beds : '', r.freeBeds, RSTATE[r.state].t, r.statusReason || '', r.statusFrom || '', r.statusTo || '']); });
    XLSX.utils.book_append_sheet(wb, U.sheet(V, [24, 6, 12, 12, 6, 8, 20, 26, 12, 12]), 'ห้องว่าง-ห้องเสีย');
    var Sm = H.concat([['ที่พัก', 'ห้องทั้งหมด'].concat(RSTATE_ORDER.map(function (k) { return RSTATE[k].t; })).concat(['ผู้พัก', 'ชาย', 'หญิง', 'เตียงว่าง'])]);
    S.boot.buildings.forEach(function (b) {
      var R = RM.rooms.filter(function (r) { return r.bld === b.id; }); if (!R.length) return;
      var pp = []; R.forEach(function (r) { pp = pp.concat(r.people); });
      Sm.push([b.name, R.length].concat(RSTATE_ORDER.map(function (k) { return R.filter(function (r) { return r.state === k; }).length; })).concat([pp.length, pp.filter(function (p) { return p.gender === 'M'; }).length, pp.filter(function (p) { return p.gender === 'F'; }).length, R.reduce(function (s, r) { return s + r.freeBeds; }, 0)]));
    });
    var all = []; RM.rooms.forEach(function (r) { all = all.concat(r.people); });
    Sm.push([], ['ตำแหน่ง', 'คน']); countBy(all, function (p) { return p.position; }).forEach(function (x) { Sm.push(x); });
    Sm.push([], ['ฝ่าย / สังกัด', 'คน']); countBy(all, function (p) { return p.division || p.group; }).forEach(function (x) { Sm.push(x); });
    XLSX.utils.book_append_sheet(wb, U.sheet(Sm, [30, 12, 12, 12, 10, 10, 12, 10, 10, 10, 10, 8, 8, 8, 8]), 'สรุป');
    var Hs = H.concat([['ที่พัก', 'ห้อง', 'ชื่อ', 'เลขผู้พัก/รหัส', 'ประเภท', 'เข้าพัก', 'ย้ายออก']]);
    RM.rooms.forEach(function (r) { r.history.forEach(function (h) { Hs.push([bldOf(r.bld).name, r.room, h.name, h.payType === 'EMP' ? h.empCode : h.rid, RTYPE_TH[h.payType] || '', h.start, h.end || 'พักอยู่']); }); });
    XLSX.utils.book_append_sheet(wb, U.sheet(Hs, [24, 12, 30, 12, 14, 12, 12]), 'ประวัติเข้า-ออก');
    var name = 'U-Bill_รายงานห้องพัก_' + nowStamp() + '_ฉ' + d.stamp.version + '.xlsx';
    U.save(wb, name);
    return Promise.resolve({ file: name, rows: RM.rooms.length, amount: 0 });
  }
  function prepMaster(m) {
    var o = { meters: m.meters, assigns: m.assigns, residents: m.residents, rooms: m.rooms, leaves: m.leaves, staff: m.staff, held: m.held };
    var byId = {}; o.meters.forEach(function (x) { byId[x.id] = x; x.payers = []; }); o.assigns.forEach(function (a) { if (byId[a.meterId]) byId[a.meterId].payers.push(a); });
    return o;
  }
  /* ---------------------------------------------------------------- ไฟล์รายชื่อบุคลากรจาก HRMi (ตัดเลขบัตรประชาชนทิ้งในเครื่อง) */
  function readStaff(file) {
    return file.arrayBuffer().then(function (buf) {
      var wb = XLSX.read(buf, { type: 'array' }), rows = [], seen = 0;
      wb.SheetNames.forEach(function (sn) {
        var a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' });
        for (var h = 0; h < Math.min(a.length, 15); h++) {
          var head = a[h].map(function (x) { return String(x).trim(); }), col = function (re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return -1; };
          var cE = col(/^(EmpCode|รหัสพนักงาน|รหัสประจำตัว)$/i), cN = col(/^(FullName|ชื่อ\s*-?\s*สกุล|ชื่อ-นามสกุล)$/i);
          if (cE < 0 || cN < 0) continue;
          var cP = col(/^(PositionName|ตำแหน่ง)$/i), cD = col(/^(DivisionName|ฝ่าย)$/i), cU = col(/^(WardName|emOrgUnitName|หน่วยงาน)$/i), cS = col(/^(WorkingStatus|สถานะ)$/i), cG = col(/^(HireName|ประเภทการจ้าง)$/i), cL = col(/^(LevelName|ระดับ)$/i);
          for (var i = h + 1; i < a.length; i++) {
            var r = a[i], emp = String(r[cE] || '').replace(/\D/g, '');
            if (!/^\d{7}$/.test(emp)) continue;
            var g = function (c) { return c >= 0 ? String(r[c] || '').trim() : ''; };
            rows.push({ empCode: emp, name: g(cN).replace(/\s+/g, ' '), position: g(cP), division: g(cD), unit: g(cU), status: g(cS), empGroup: g(cG), level: g(cL) });
          }
          seen++; break;
        }
      });
      if (!seen) throw new Error('ไม่พบหัวคอลัมน์ EmpCode / FullName (ไฟล์ส่งออกรายชื่อบุคลากรจาก HRMi)');
      return rows;
    });
  }
  return { CASH: CASH, ROOMS: ROOMS, printCash: printCash, readStaff: readStaff };
})();
