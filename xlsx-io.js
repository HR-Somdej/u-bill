/* SOMDEJ U-Bill — xlsx-io.js : อ่าน/สร้างไฟล์ Excel ในเบราว์เซอร์ (SheetJS + JSZip)
 * - Import HRMi: ชีท "Import" 7 คอลัมน์ ตามไฟล์เดิม (.xls) แยกหอ + รวมทุกหอ → .zip
 * - ไฟล์ตรวจสอบ: หลายชีท พร้อมแถวประทับเวลา/ผู้ส่งออก/ฉบับที่
 * - แม่แบบจดมิเตอร์ / ทะเบียน: อ่านกลับเข้าระบบได้ (จับคู่ด้วย "รหัสมิเตอร์") */
var XIO = (function () {
  var BLD_ORDER = function (id) { return (bldOf(id).sort || 99); };
  function stampLine(d) {
    return 'ส่งออกจาก SOMDEJ U-Bill เมื่อ ' + thDate(d.stamp.at) + ' น. โดย ' + (d.stamp.byName || '') + ' (' + d.stamp.by + ') · ฉบับที่ ' + d.stamp.version + (d.round ? ' · สถานะรอบ: ' + (d.stamp.locked ? 'ล็อกแล้ว (ฉบับจริง)' : 'ยังไม่ล็อก (ฉบับร่าง)') : '');
  }
  function fileStamp(d) { return (d.round ? d.round.id : '') + '_ฉ' + d.stamp.version + '_' + nowStamp(); }
  function sheet(aoa, widths) { var ws = XLSX.utils.aoa_to_sheet(aoa); if (widths) ws['!cols'] = widths.map(function (w) { return { wch: w }; }); return ws; }
  function save(wb, name, type) { XLSX.writeFile(wb, name, { bookType: type || 'xlsx', compression: true }); }
  function blob(wb, type) { return XLSX.write(wb, { bookType: type || 'xlsx', type: 'array', compression: true }); }
  function download(data, name, mime) {
    var b = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function safeSheet(n) { return String(n).replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 31); }
  var KTH = { W: 'ค่าน้ำ', E: 'ค่าไฟ' };

  /* ---------------------------------------------------------------- Import HRMi */
  function importRows(list, code, job) {
    var head = ['รหัสพนักงาน', 'เลขบัตรประชาชน', 'รหัสรายได้ - รายหัก', 'จำนวน', 'รายได้ (บาท)', 'รายหัก (บาท)', 'รหัสงาน'];
    return [head].concat(list.map(function (p) { return [+p.empCode, 0, code, 1, 0, r2(p.amount), job]; }));
  }
  function hrmiWb(list, code, job) { var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheet(importRows(list, code, job), [14, 16, 20, 8, 12, 14, 10]), 'Import'); return wb; }
  function buildHrmi(d) {
    var zip = new JSZip(), job = d.round.id, info = [['SOMDEJ U-Bill · ชุดไฟล์ Import HRMi รอบ ' + rTh(job, true) + ' (รหัสงาน ' + job + ')'], [stampLine(d)], [], ['ไฟล์', 'ประเภท', 'รหัสรายหัก', 'จำนวนแถว', 'ยอดรวม (บาท)']];
    var rowsTot = 0, amtTot = 0;
    ['W', 'E'].forEach(function (k) {
      var code = d.codes[k], inc = d.persons.filter(function (p) { return p.kind === k && p.payType === 'EMP' && p.include && p.amount > 0; });
      // แยกหอ (ในหอเดียวกัน 1 คน = 1 แถว — หลังบ้านรวมให้แล้ว)
      d.buildings.forEach(function (b) {
        var L = inc.filter(function (p) { return p.bld === b.id; }).sort(function (a, c) { return a.empCode < c.empCode ? -1 : 1; });
        if (!L.length) return;
        var fn = KTH[k] + '/' + b.hrmiName + '.xls', amt = L.reduce(function (s, p) { return s + p.amount; }, 0);
        zip.file(fn, blob(hrmiWb(L, code, job), 'biff8'));
        info.push([fn, KTH[k], code, L.length, r2(amt)]);
      });
      // รวมทุกหอ (1 คน = 1 แถวต่อรหัสรายหัก)
      var agg = {}, order = [];
      inc.forEach(function (p) { if (!agg[p.empCode]) { agg[p.empCode] = { empCode: p.empCode, amount: 0 }; order.push(agg[p.empCode]); } agg[p.empCode].amount = r2(agg[p.empCode].amount + p.amount); });
      order.sort(function (a, c) { return a.empCode < c.empCode ? -1 : 1; });
      var fnA = 'รวมทุกหอ_' + KTH[k] + '_' + job + '.xls', amtA = order.reduce(function (s, p) { return s + p.amount; }, 0);
      if (order.length) zip.file(fnA, blob(hrmiWb(order, code, job), 'biff8'));
      info.push([fnA, KTH[k] + ' (รวม)', code, order.length, r2(amtA)]);
      rowsTot += order.length; amtTot += amtA;
    });
    info.push([], ['หมายเหตุ: ใช้ไฟล์ "แยกหอ" หรือ "รวมทุกหอ" อย่างใดอย่างหนึ่งเท่านั้น (ห้ามนำเข้าทั้งสองชุด จะหักซ้ำ)']);
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, sheet(info, [44, 16, 14, 12, 16]), 'สรุปไฟล์');
    zip.file('00_สรุปไฟล์_' + job + '.xlsx', blob(wb, 'xlsx'));
    var name = 'U-Bill_ImportHRMi_' + fileStamp(d) + '.zip';
    return zip.generateAsync({ type: 'blob' }).then(function (b) { download(b, name, 'application/zip'); return { file: name, rows: rowsTot, amount: r2(amtTot) }; });
  }

  /* ---------------------------------------------------------------- ไฟล์ตรวจสอบ */
  function buildCheck(d) {
    var wb = XLSX.utils.book_new(), job = d.round.id, H = [['SOMDEJ U-Bill · ไฟล์ตรวจสอบรายการหักค่าน้ำ–ค่าไฟ รอบ ' + rTh(job, true) + ' (รหัสงาน ' + job + ')'], ['หน่วยใช้ ' + d.round.usageTh + ' · อัตรา น้ำ ' + d.rates.W + ' · ไฟ ' + d.rates.E + ' บาท/หน่วย · มิเตอร์เสีย ' + d.rates.FLAT + ' บาท'], [stampLine(d)], []];
    // 1) สรุป
    var by = {};
    d.meters.forEach(function (m) {
      var k = m.bld + '|' + m.kind, s = by[k] = by[k] || { bld: m.bld, kind: m.kind, meters: 0, read: 0, units: 0, billed: 0, ded: 0, n: 0, exc: 0, cash: 0, unalloc: 0, nonCharge: 0, broken: 0 };
      s.meters++; if (m.curr != null || m.broken) s.read++; if (m.usage != null) s.units += m.usage; if (m.broken) s.broken++;
      if (m.status === 'OCC' && !m.exempt) { s.billed += m.amount; s.unalloc += m.unallocated; } else s.nonCharge += m.amount;
    });
    d.persons.forEach(function (p) { var s = by[p.bld + '|' + p.kind]; if (!s) return; if (p.payType === 'CASH') s.cash += p.amount; else if (p.include) { s.ded += p.amount; s.n++; } else s.exc += p.amount; });
    var sum = H.concat([['ที่พัก', 'ประเภท', 'มิเตอร์', 'จดแล้ว', 'มิเตอร์เสีย', 'หน่วยใช้', 'ยอดเรียกเก็บ', 'หักเงินเดือน (HRMi)', 'จำนวนคน', 'ไม่หัก', 'เงินสด', 'ไม่มีผู้รับผิดชอบ', 'ไม่เรียกเก็บ (ห้องเวร/ว่าง/ฯลฯ)']]);
    var T = {};
    Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return BLD_ORDER(a.bld) - BLD_ORDER(b.bld) || (a.kind < b.kind ? 1 : -1); }).forEach(function (s) {
      sum.push([bldOf(s.bld).name, KTH[s.kind], s.meters, s.read, s.broken, r2(s.units), r2(s.billed), r2(s.ded), s.n, r2(s.exc), r2(s.cash), r2(s.unalloc), r2(s.nonCharge)]);
      ['meters', 'read', 'broken', 'units', 'billed', 'ded', 'n', 'exc', 'cash', 'unalloc', 'nonCharge'].forEach(function (f) { T[f] = (T[f] || 0) + s[f]; });
    });
    sum.push(['รวม', '', T.meters, T.read, T.broken, r2(T.units), r2(T.billed), r2(T.ded), T.n, r2(T.exc), r2(T.cash), r2(T.unalloc), r2(T.nonCharge)]);
    sum.push([], ['กฎคำนวณ: หน่วยใช้ × อัตรา (ปัด 2 ตำแหน่ง) · ผู้จ่ายหลายคนหารตามคน × จำนวนวันที่พักจริง ปัดขึ้น 2 ตำแหน่งต่อคน · มิเตอร์เสียเหมา ' + d.rates.FLAT + ' บาท · ห้องเวร/ว่าง/นานาชาติ/ส่วนกลางไม่เรียกเก็บ · หักเงินเดือนเฉพาะรหัส 7 หลักที่ยังปฏิบัติงาน']);
    XLSX.utils.book_append_sheet(wb, sheet(sum, [26, 9, 9, 9, 10, 11, 14, 16, 10, 12, 12, 14, 18]), 'สรุป');
    // 2) รายคน
    var pcols = ['ประเภท', 'ที่พัก', 'รหัสพนักงาน', 'ชื่อ-สกุล (ทะเบียน)', 'ชื่อ-สกุล (ระบบบุคลากร)', 'กลุ่มการจ้าง', 'ห้อง', 'จำนวนวัน', 'ยอด (บาท)', 'หัก/ไม่หัก', 'เหตุผล', 'สถานะ API', 'ข้อควรระวัง'];
    var prow = function (p) { return [KTH[p.kind], bldOf(p.bld).name, p.payType === 'EMP' ? p.empCode : (p.cashCode || ''), p.name, p.apiName || '', p.empGroup || '', p.rooms, p.days, r2(p.amount), p.payType === 'CASH' ? 'เงินสด' : p.payType === 'PENDING' ? 'รอรหัส (พักยอด)' : (p.include ? 'หัก' + (p.back ? ' (รวมย้อนหลัง ' + r2(p.back) + ')' : '') : 'ไม่หัก'), p.reason || '', { ACTIVE: 'ปฏิบัติงาน', NOT_FOUND: 'ไม่พบ/พ้นสภาพ', UNCHECKED: 'ยังไม่ตรวจ' }[p.apiStatus] || '', p.warn || '']; };
    var sortP = function (a, b) { return (a.kind < b.kind ? 1 : a.kind > b.kind ? -1 : 0) || BLD_ORDER(a.bld) - BLD_ORDER(b.bld) || (a.empCode < b.empCode ? -1 : 1); };
    var W13 = [8, 24, 12, 28, 28, 18, 22, 8, 11, 9, 30, 13, 26];
    XLSX.utils.book_append_sheet(wb, sheet(H.concat([pcols]).concat(d.persons.filter(function (p) { return p.payType === 'EMP' && p.include; }).sort(sortP).map(prow)), W13), 'รายคน_หักเงินเดือน');
    XLSX.utils.book_append_sheet(wb, sheet(H.concat([pcols]).concat(d.persons.filter(function (p) { return p.payType === 'EMP' && !p.include; }).sort(sortP).map(prow)), W13), 'ไม่หัก');
    XLSX.utils.book_append_sheet(wb, sheet(H.concat([pcols]).concat(d.persons.filter(function (p) { return p.payType === 'CASH'; }).sort(sortP).map(prow)), W13), 'เงินสด');
    XLSX.utils.book_append_sheet(wb, sheet(H.concat([pcols]).concat(d.persons.filter(function (p) { return p.payType === 'PENDING'; }).sort(sortP).map(prow)), W13), 'รอรหัส (พักยอด)');
    // 3) แจ้งเตือน
    var al = H.concat([['ประเภท', 'ที่พัก', 'ห้อง', 'มิเตอร์', 'ชนิด', 'รายละเอียด', 'เลขก่อน', 'เลขหลัง', 'หน่วยใช้', 'ยอด']]);
    var AT = { ERR: 'ผิดพลาด', UNASSIGNED: 'ไม่มีผู้รับผิดชอบ', HIGH: 'ใช้สูงผิดปกติ', ZERO: 'ใช้ 0', MISS: 'ยังไม่จด', MISMATCH: 'ค่าน้ำ≠ค่าไฟ', OVERLAP: 'ชื่อซ้อน 2 ห้อง', DUP: 'คนเดียวกัน 2 แบบ' };
    d.meters.forEach(function (m) { m.alerts.forEach(function (a) { al.push([KTH[m.kind], bldOf(m.bld).name, m.room, m.label, AT[a.t] || a.t, a.m, m.prev, m.broken ? 'เสีย' : m.curr, m.usage, m.amount]); }); });
    XLSX.utils.book_append_sheet(wb, sheet(al, [8, 24, 10, 8, 16, 60, 10, 10, 10, 10]), 'แจ้งเตือน');
    // 4) รายมิเตอร์
    var mr = H.concat([['รหัสมิเตอร์', 'ประเภท', 'ที่พัก', 'ชั้น', 'ห้อง', 'เลขห้องใหม่', 'มิเตอร์', 'สถานะห้อง', 'เลขครั้งก่อน', 'เลขครั้งนี้', 'เลขเริ่มใหม่', 'มิเตอร์เสีย', 'หน่วยใช้', 'อัตรา', 'ยอดมิเตอร์', 'ยกเว้น', 'ผู้จ่าย (วัน · บาท)', 'ไม่มีผู้รับผิดชอบ', 'หมายเหตุ', 'บันทึกโดย', 'เวลาบันทึก']]);
    d.meters.forEach(function (m) { mr.push([m.id, KTH[m.kind], bldOf(m.bld).name, m.floor, m.room, m.newRoom, m.label, MST_TH[m.status], m.prev, m.curr, m.reset, m.broken ? 'เสีย' : '', m.usage, m.rate, m.amount, m.exempt ? 'ยกเว้น: ' + m.exemptReason : '', m.payers.map(function (x) { return x.name + (x.empCode ? ' (' + x.empCode + ')' : '') + ' ' + x.days + 'ว ' + x.share + (x.payType === 'CASH' ? ' สด' : ''); }).join(' | '), m.unallocated, m.note, m.by, m.at]); });
    XLSX.utils.book_append_sheet(wb, sheet(mr, [18, 8, 24, 6, 9, 8, 8, 12, 11, 11, 10, 9, 9, 7, 11, 16, 60, 12, 20, 10, 18]), 'รายมิเตอร์');
    // 5) สรุปแยกหอ (รูปแบบเดิมของฝ่ายอาคาร)
    d.buildings.forEach(function (b) {
      ['E', 'W'].forEach(function (k) {
        var L = d.meters.filter(function (m) { return m.bld === b.id && m.kind === k; });
        if (!L.length) return;
        var a = [[b.name], [KTH[k] === 'ค่าน้ำ' ? 'ค่าน้ำประปา' : 'ค่าไฟฟ้า'], ['รายการ' + (KTH[k] === 'ค่าน้ำ' ? 'ค่าน้ำประปา' : 'ค่าไฟฟ้า') + ' หักเงินสิ้นเดือน' + rTh(job, true) + ' (ยอดใช้ ' + d.round.usageTh + ')'], [stampLine(d)],
          ['หมายเลขห้อง', 'ชั้น', 'มิเตอร์', 'ชื่อ - สกุล', 'รหัสประจำตัวเจ้าหน้าที่', 'หน่วยอ่านก่อน', 'หน่วยอ่านหลัง', 'หน่วยที่ใช้งาน', 'บาท/หน่วย', 'รวม', 'หักบัญชี / ชำระ', 'วิธีชำระ', 'หมายเหตุ']];
        var sumB = 0, sumD = 0;
        L.forEach(function (m) {
          var first = [m.room, m.floor, m.label, '', '', m.prev, m.broken ? 'เสีย' : m.curr, m.broken ? '' : m.usage, m.rate, m.amount];
          var note = [m.status !== 'OCC' ? MST_TH[m.status] : '', m.exempt ? 'ยกเว้น: ' + m.exemptReason : '', m.unallocated ? 'ไม่มีผู้รับผิดชอบ ' + m.unallocated : '', m.note].filter(Boolean).join(' · ');
          if (m.status === 'OCC' && !m.exempt) sumB += m.amount;
          if (!m.payers.length) { a.push(first.concat(['', '', note])); return; }
          m.payers.forEach(function (x, i) {
            var pi = d.persons.filter(function (p) { return p.kind === k && p.bld === b.id && (x.payType === 'EMP' ? p.empCode === x.empCode : p.name === x.name); })[0];
            var how = x.payType === 'CASH' ? 'เงินสด' : x.payType === 'PENDING' ? 'รอรหัส (พักยอด)' : (pi && pi.include ? 'หักเงินเดือน' : 'ไม่หัก' + (pi && pi.reason ? ': ' + pi.reason : '')) + (x.leaveDays ? ' · พักการเรียกเก็บ ' + x.leaveDays + ' วัน (' + (x.leaveWhy || '') + ')' : '');
            if (x.payType === 'EMP' && pi && pi.include) sumD += x.share;
            var r = i === 0 ? first.slice() : ['', '', '', '', '', '', '', '', '', ''];
            r[3] = x.name; r[4] = x.empCode;
            a.push(r.concat([x.share, how, (i === 0 ? note : '') + (x.days < d.D ? (i === 0 && note ? ' · ' : '') + 'พัก ' + x.days + ' วัน' : '')]));
          });
        });
        a.push([], ['รวมยอดเรียกเก็บ', '', '', '', '', '', '', '', '', r2(sumB), r2(sumD), 'หักเงินเดือนรวม']);
        XLSX.utils.book_append_sheet(wb, sheet(a, [11, 6, 7, 30, 14, 11, 11, 11, 8, 10, 12, 24, 30]), safeSheet(b.short + '_' + KTH[k]));
      });
    });
    var name = 'U-Bill_ไฟล์ตรวจสอบ_' + fileStamp(d) + (d.stamp.locked ? '' : '_ฉบับร่าง') + '.xlsx';
    save(wb, name);
    return Promise.resolve({ file: name, rows: d.persons.length, amount: r2(T.ded) });
  }

  /* ---------------------------------------------------------------- แม่แบบจดมิเตอร์ / ทะเบียน */
  var TCOLS = ['รหัสมิเตอร์', 'ที่พัก', 'ชั้น', 'ห้อง', 'เลขห้องใหม่', 'มิเตอร์', 'สถานะห้อง', 'รหัสผู้จ่าย (7 หลัก คั่นด้วย ,)', 'ชื่อผู้จ่าย', 'ผู้ชำระเงินสด (ไม่มีรหัส 7 หลัก)', 'จำนวนผู้จ่าย', 'เลขครั้งก่อน', 'เลขครั้งนี้', 'มิเตอร์เสีย', 'เลขเริ่มใหม่', 'หน่วยใช้', 'อัตรา', 'ยอดเงิน', 'ต่อคน', 'หมายเหตุ'];
  var TW = [20, 22, 6, 9, 9, 8, 13, 22, 34, 26, 9, 11, 11, 9, 10, 9, 7, 11, 10, 30];
  function tplSheet(rows, kind) {
    var ws = sheet([TCOLS].concat(rows.map(function (r) { return r.slice(0, 15).concat(['', '', '', '', r[15] || '']); })), TW);
    var rateRef = kind === 'W' ? "'ตั้งค่า'!$B$2" : "'ตั้งค่า'!$B$3";
    for (var i = 0; i < rows.length; i++) {
      var n = i + 2;
      ws['P' + n] = { t: 'n', f: 'IF(N' + n + '="เสีย","",IF(M' + n + '="","",IF(O' + n + '<>"",M' + n + '-O' + n + ',M' + n + '-L' + n + ')))' };
      ws['Q' + n] = { t: 'n', f: rateRef };
      ws['R' + n] = { t: 'n', f: "IF(N" + n + "=\"เสีย\",'ตั้งค่า'!$B$4,IF(P" + n + "=\"\",\"\",ROUND(P" + n + "*Q" + n + ",2)))" };
      ws['S' + n] = { t: 'n', f: 'IF(OR(R' + n + '="",K' + n + '=0),"",ROUNDUP(R' + n + '/K' + n + ',2))' };
    }
    ws['!autofilter'] = { ref: 'A1:T' + (rows.length + 1) };
    ws['!freeze'] = { xSplit: 7, ySplit: 1 };
    return ws;
  }
  function tplRows(meters, kind, withCurr, payersOf) {
    return meters.filter(function (m) { return m.kind === kind; }).map(function (m) {
      var P = payersOf(m), emp = P.filter(function (x) { return x.payType === 'EMP'; }), cash = P.filter(function (x) { return x.payType !== 'EMP'; });
      return [m.id, bldOf(m.bld).name, m.floor || '', m.room, m.newRoom || '', m.label, MST_TH[m.status] || m.status, emp.map(function (x) { return x.empCode; }).join(', '), emp.map(function (x) { return x.name; }).join(', '),
        cash.map(function (x) { return x.name + (x.empCode ? ' (' + x.empCode + ')' : ''); }).join(', '), P.length, m.prev != null ? m.prev : '', withCurr && m.curr != null ? m.curr : '', withCurr && m.broken ? 'เสีย' : '', withCurr && m.reset != null ? m.reset : '', m.note || ''];
    });
  }
  function tplWorkbook(d, meters, withCurr, payersOf, title) {
    var wb = XLSX.utils.book_new(), rd = d.round;
    var info = [['SOMDEJ U-Bill · ' + title], [rd ? 'รอบหักเงินสิ้นเดือน ' + rTh(rd.id, true) + ' (หน่วยใช้ ' + rd.usageTh + ') · รหัสรอบ ' + rd.id : ''], [stampLine(d)], [], ['วิธีกรอก'],
      ['1. กรอกเฉพาะ "เลขครั้งนี้" ตามที่ช่างจดมา (ตัวเลขเท่านั้น)'], ['2. มิเตอร์เสีย/จอดับ → พิมพ์ "เสีย" ในช่อง "มิเตอร์เสีย"'], ['3. เปลี่ยนมิเตอร์ใหม่/เลขวนกลับ → ใส่เลขเริ่มของมิเตอร์ใหม่ในช่อง "เลขเริ่มใหม่"'],
      ['4. ห้ามแก้คอลัมน์ "รหัสมิเตอร์" — ระบบใช้จับคู่ตอนนำเข้า (เมนู กรอกจากสมุด › นำเข้าไฟล์)'], ['5. ย้ายเข้า/ย้ายออก ให้ทำในระบบ เมนู "ห้อง · มิเตอร์ · ผู้พัก" (ไฟล์นี้ใช้นำเข้าเลขมิเตอร์)'],
      ['6. คอลัมน์ หน่วยใช้ · ยอดเงิน · ต่อคน คำนวณให้ดูคร่าว ๆ — ยอดจริงคำนวณในระบบ (รวมการหารตามจำนวนวันที่พัก)']];
    XLSX.utils.book_append_sheet(wb, sheet(info, [110]), 'อ่านก่อน');
    var rates = d.rates || { W: 30, E: 4.2, FLAT: 15 };
    XLSX.utils.book_append_sheet(wb, sheet([['รายการ', 'ค่า', 'หมายเหตุ'], ['อัตราค่าน้ำ (บาท/หน่วย)', +rates.W, ''], ['อัตราค่าไฟ (บาท/หน่วย)', +rates.E, ''], ['ค่าเหมามิเตอร์เสีย', +rates.FLAT, ''], ['รหัสรอบ', rd ? rd.id : '', '']], [34, 12, 40]), 'ตั้งค่า');
    XLSX.utils.book_append_sheet(wb, tplSheet(tplRows(meters, 'W', withCurr, payersOf), 'W'), 'ค่าน้ำ');
    XLSX.utils.book_append_sheet(wb, tplSheet(tplRows(meters, 'E', withCurr, payersOf), 'E'), 'ค่าไฟ');
    return wb;
  }
  function buildTemplate(d) {
    var wb = tplWorkbook(d, d.meters, true, function (m) { return m.payers.map(function (x) { return { empCode: x.empCode, name: x.name, payType: x.payType }; }); }, 'แม่แบบจดมิเตอร์ค่าน้ำ–ค่าไฟ');
    var name = 'U-Bill_แม่แบบจดมิเตอร์_' + fileStamp(d) + '.xlsx'; save(wb, name);
    return Promise.resolve({ file: name, rows: d.meters.length, amount: 0 });
  }
  function buildMaster(d) {
    var M = d.master, td = today();
    var byM = {}; M.assigns.forEach(function (a) { (byM[a.meterId] = byM[a.meterId] || []).push(a); });
    var meters = M.meters.map(function (m) { return Object.assign({}, m, { prev: m.lastReading }); });
    var wb = tplWorkbook(d, meters, false, function (m) { return (byM[m.id] || []).filter(function (a) { return !a.endDate || a.endDate >= td; }); }, 'ทะเบียนห้อง · มิเตอร์ · ผู้จ่าย (ปัจจุบัน)');
    var A = [['รหัสมิเตอร์', 'ที่พัก', 'ห้อง', 'ประเภท', 'รหัส', 'ชื่อ', 'การชำระ', 'ย้ายเข้า', 'ย้ายออก', 'หมายเหตุ']];
    M.assigns.forEach(function (a) { var m = M.meters.filter(function (x) { return x.id === a.meterId; })[0] || {}; A.push([a.meterId, bldOf(m.bld).name, m.room, KTH[m.kind], a.empCode, a.name, a.payType === 'EMP' ? 'หักเงินเดือน' : 'เงินสด', a.startDate, a.endDate, a.note]); });
    XLSX.utils.book_append_sheet(wb, sheet(A, [20, 22, 9, 8, 12, 30, 12, 12, 12, 30]), 'ประวัติผู้จ่าย');
    var name = 'U-Bill_ทะเบียน_' + nowStamp() + '.xlsx'; save(wb, name);
    return Promise.resolve({ file: name, rows: M.meters.length, amount: 0 });
  }

  /* ---------------------------------------------------------------- อ่านไฟล์ */
  function readWb(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { try { res(XLSX.read(new Uint8Array(fr.result), { type: 'array' })); } catch (e) { rej(new Error('อ่านไฟล์ไม่ได้: ' + e.message)); } };
      fr.onerror = function () { rej(new Error('อ่านไฟล์ไม่ได้')); };
      fr.readAsArrayBuffer(file);
    });
  }
  function readTemplate(file) {
    return readWb(file).then(function (wb) {
      var out = [];
      wb.SheetNames.forEach(function (sn) {
        var a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
        var hi = -1; for (var i = 0; i < Math.min(8, a.length); i++) if (a[i].some(function (c) { return String(c).trim() === 'รหัสมิเตอร์'; })) { hi = i; break; }
        if (hi < 0) return;
        var h = a[hi].map(function (c) { return String(c).trim(); });
        var col = function (t) { for (var j = 0; j < h.length; j++) if (h[j].indexOf(t) === 0) return j; return -1; };
        var C = { id: col('รหัสมิเตอร์'), bld: col('ที่พัก'), floor: col('ชั้น'), room: col('ห้อง'), newRoom: col('เลขห้องใหม่'), label: col('มิเตอร์'), status: col('สถานะห้อง'), codes: col('รหัสผู้จ่าย'), names: col('ชื่อผู้จ่าย'), cash: col('ผู้ชำระเงินสด'), prev: col('เลขครั้งก่อน'), curr: col('เลขครั้งนี้'), broken: col('มิเตอร์เสีย'), reset: col('เลขเริ่มใหม่'), note: col('หมายเหตุ'), lastUsage: col('หน่วยใช้รอบก่อน') };
        if (C.label === C.broken) C.label = h.indexOf('มิเตอร์');
        var kind = /น้ำ/.test(sn) ? 'W' : /ไฟ/.test(sn) ? 'E' : '';
        var g = function (r, k) { return C[k] >= 0 ? r[C[k]] : ''; }, s = function (v) { return v == null ? '' : String(v).trim(); };
        for (var r = hi + 1; r < a.length; r++) {
          var row = a[r], id = s(g(row, 'id')), room = s(g(row, 'room'));
          if (!id && !room) continue;
          var k = kind || (id ? id.charAt(0) : '');
          var cashList = s(g(row, 'cash')) ? s(g(row, 'cash')).split(/\s*,\s*/).filter(Boolean).map(function (x) { var m = x.match(/^(.*?)\s*\(([^)]*)\)\s*$/); return m ? { name: m[1].trim(), code: m[2].trim() } : { name: x.trim(), code: '' }; }) : [];
          var num = function (v) { v = s(v).replace(/,/g, ''); return v === '' ? '' : (isNaN(+v) ? v : +v); };
          out.push({ rowNo: r + 1, sheet: sn, meterId: id, kind: k, bld: s(g(row, 'bld')), floor: s(g(row, 'floor')), room: room, newRoom: s(g(row, 'newRoom')), label: s(g(row, 'label')) || '1', status: s(g(row, 'status')),
            codes: s(g(row, 'codes')) ? s(g(row, 'codes')).split(/[\s,]+/).filter(Boolean) : [], names: s(g(row, 'names')) ? s(g(row, 'names')).split(/\s*,\s*/) : [], cash: cashList,
            prev: num(g(row, 'prev')), curr: num(g(row, 'curr')), broken: /เสีย|จอดับ/.test(s(g(row, 'broken'))), resetStart: num(g(row, 'reset')), note: s(g(row, 'note')), lastUsage: num(g(row, 'lastUsage')) });
        }
      });
      if (!out.length) throw new Error('ไม่พบชีทที่มีคอลัมน์ "รหัสมิเตอร์" — กรุณาใช้ไฟล์แม่แบบของ U-Bill');
      out.forEach(function (o) { if (typeof o.curr === 'string' && o.curr) { if (/เสีย|จอดับ/.test(o.curr)) o.broken = true; o.curr = ''; } });
      return out;
    });
  }
  function readHistory(file) {
    return readWb(file).then(function (wb) {
      var ws = wb.Sheets['History'] || wb.Sheets[wb.SheetNames[0]];
      var rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length || rows[0].round == null) throw new Error('ไฟล์ประวัติต้องมีชีท History และคอลัมน์ round, kind, bld, …');
      return rows.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; }); o.round = String(o.round); if (o.top && typeof o.top === 'string') { try { o.top = JSON.parse(o.top); } catch (e) { o.top = []; } } return o; });
    });
  }

  /* ---------------------------------------------------------------- อ่านไฟล์เดิมของฝ่ายอาคาร (ประวัติ) → สรุปรายเดือน
   * รองรับรูปแบบไฟล์ค่าน้ำ/ค่าไฟเดิม (ทุกหอ) · เดือนอ่านจากหัวตาราง "หักเงินสิ้นเดือน<เดือน> <ปี>" · หอ/ประเภท อ่านจากหัวไฟล์ */
  var MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  function bldFromText(t, sheetName) {
    if (/เทพ/.test(t)) return 'TEP';
    if (/ไวท/.test(t)) return /B/i.test(sheetName) ? 'VTB' : 'VTA';
    if (/2548/.test(t)) return 'D48'; if (/บ่อก๊อก/.test(t)) return 'BOK'; if (/รอบเขา/.test(t)) return 'KAO'; if (/สนามบอล/.test(t)) return 'BAL';
    return '';
  }
  function parseOldSheet(a, sheetName, fileName) {
    var top = a.slice(0, 4).map(function (r) { return r.join(' '); }).join(' ');
    var hi = -1; for (var i = 0; i < Math.min(10, a.length); i++) if (a[i].some(function (c) { return String(c).trim() === 'หักบัญชี'; })) { hi = i; break; }
    if (hi < 1) return null;
    var sub = a[hi].map(function (c) { return String(c).trim(); }), main = a[hi - 1].map(function (c) { return String(c).trim(); });
    var cH = sub.indexOf('หักบัญชี'), cR = sub.indexOf('รวม'), cRate = sub.indexOf('บาท/หน่วย'), cU = cRate - 1, cB = cRate - 3, cA = cRate - 2;
    var cE = -1, cS = -1; main.forEach(function (h, j) { if (/รหัสประจำตัว/.test(h)) cE = j; if (/ยอดเงินนำส่ง/.test(h)) cS = j; });
    var head = main.join(' '), mm = head.match(/หักเงินสิ้นเดือน\s*([ก-๙]+)\s*(\d{4})/);
    if (!mm) return null;
    var mo = MONTHS.indexOf(mm[1]) + 1; if (mo < 1) return null;
    var kind = /ค่าน้ำ/.test(top + head) ? 'W' : /ค่าไฟ/.test(top + head) ? 'E' : '';
    var bld = bldFromText(top + ' ' + fileName, sheetName);
    if (!kind || !bld) return null;
    var o = { round: mm[2] + '-' + ('0' + mo).slice(-2), kind: kind, bld: bld, meters: 0, units: 0, billed: 0, deducted: 0, cash: 0, nonCharge: 0, nonChargeUnits: 0, broken: 0, persons: 0, excluded: 0, top: [], file: fileName };
    var codes = {}, sendSeen = false, empHak = 0, room = '', n = function (v) { return typeof v === 'number' ? v : (String(v).trim() !== '' && !isNaN(+String(v).replace(/,/g, '')) ? +String(v).replace(/,/g, '') : null); };
    for (var r = hi + 1; r < a.length; r++) {
      var row = a[r]; if (!row) continue;
      if (row.some(function (c) { return /หน่วยอ่าน|หมายเลขห้อง|รายการค่า/.test(String(c)); })) continue;
      var c0 = String(row[0] || '').trim(); if (c0) room = c0;
      var name = String(row[1] || '') + ' ' + String(row[2] || '') + (cE > 3 ? ' ' + String(row[3] || '') : ''), code = String(row[cE] == null ? '' : row[cE]).replace(/\.0$/, '').trim();
      var bv = row[cB], av = row[cA], hasM = n(bv) != null || n(av) != null || /เสีย|จอดับ/.test(String(bv) + String(av));
      var tot = n(row[cR]), use = n(row[cU]), hak = n(row[cH]), send = cS >= 0 ? n(row[cS]) : null;
      var nc = /ห้องเวร|ว่าง|นานาชาติ|ห้องโถง|อาจารย์พยาบาล|แม่บ้าน/.test(name) && !/^\d{7}$/.test(code);
      if (hasM) { o.meters++; if (/เสีย|จอดับ/.test(String(bv) + String(av))) o.broken++; if (use != null) { o.units += use; o.top.push([room, use, tot || 0, nc ? 'DUTY' : 'OCC']); } if (nc && tot) { o.nonCharge += tot; o.nonChargeUnits += use || 0; } }
      if (nc || hak == null || hak <= 0) continue;
      if (/^\d{7}$/.test(code)) {
        o.billed += hak; codes[code] = 1; empHak += hak; if (send != null) sendSeen = true;
        if (cS >= 0) { if (send != null) { o.deducted += send; if (send < hak - 0.01) o.excluded += hak - send; } else o.excluded += hak; } else o.deducted += hak;
      } else if (code || name.trim()) { o.billed += hak; o.cash += hak; }
    }
    if (!sendSeen) { o.deducted = empHak; o.excluded = 0; o.noSend = true; }   // ไฟล์ที่ยังไม่กรอกยอดนำส่ง = ถือว่าหักครบ
    o.persons = Object.keys(codes).length;
    o.top.sort(function (x, y) { return y[1] - x[1]; }); o.top = o.top.slice(0, 15);
    ['units', 'billed', 'deducted', 'cash', 'nonCharge', 'nonChargeUnits', 'excluded'].forEach(function (k) { o[k] = r2(o[k]); });
    return o;
  }
  /** files = FileList (เลือกหลายไฟล์ หรือทั้งโฟลเดอร์) · onProgress(i, n) */
  function readOldFiles(files, onProgress) {
    var L = Array.prototype.slice.call(files).filter(function (f) { var rp = f.webkitRelativePath || ''; return /\.xlsx?$/i.test(f.name) && (!rp || (/ค่าน้ำ|ค่าไฟ/.test(rp) && !/Import|import/.test(rp))); });
    var got = {}, skipped = [], i = 0;
    var pri = function (p) { return /\/3\./.test(p) ? 3 : /\/2\./.test(p) ? 1 : /\/1\./.test(p) ? 2 : 0; };   // ใช้ไฟล์โฟลเดอร์ 3 (ยอดนำส่งจริง) ก่อน
    return L.reduce(function (pr, f) {
      return pr.then(function () {
        if (onProgress) onProgress(++i, L.length);
        return readWb(f).then(function (wb) {
          var ok = false;
          wb.SheetNames.forEach(function (sn) {
            if (/^(Import|Sheet2|Sheet3)$/i.test(sn)) return;
            var a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
            var o = parseOldSheet(a, sn, f.name); if (!o) return;
            ok = true; o.prio = pri(f.webkitRelativePath || '');
            var k = o.round + '|' + o.kind + '|' + o.bld;
            if (!got[k] || o.prio > got[k].prio) got[k] = o;
          });
          if (!ok) skipped.push(f.name);
        }).catch(function () { skipped.push(f.name); });
      });
    }, Promise.resolve()).then(function () { return { rows: Object.keys(got).map(function (k) { return got[k]; }).sort(function (a, b) { return a.round < b.round ? -1 : 1; }), skipped: skipped, files: L.length }; });
  }
  function build(d) {
    if (d.type === 'HRMI') return buildHrmi(d);
    if (d.type === 'CHECK') return buildCheck(d);
    if (d.type === 'TEMPLATE') return buildTemplate(d);
    if (d.type === 'MASTER') return buildMaster(d);
    if (XIO2[d.type]) return XIO2[d.type](d, { sheet: sheet, save: save, stampLine: stampLine, fileStamp: fileStamp, download: download, safeSheet: safeSheet });
    return Promise.reject(new Error('ชนิดไฟล์ไม่รู้จัก'));
  }
  return { printCash: function (d) { return XIO2.printCash(d, { stampLine: stampLine }); }, build: build, readTemplate: readTemplate, readHistory: readHistory, readOldFiles: readOldFiles, parseOldSheet: parseOldSheet, download: download, sheet: sheet, save: save };
})();
