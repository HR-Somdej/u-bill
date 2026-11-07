/* SOMDEJ U-Bill — sw.js : ทำให้ติดตั้งเป็นแอปได้ + เปิดหน้าได้เร็ว/ตอนเน็ตไม่ดี
 * - ไม่แตะคำขอไป Apps Script (POST/โดเมนอื่น) · ข้อมูลจริงมาจากเซิร์ฟเวอร์เสมอ
 * - ไฟล์หน้าเว็บ: ลองเน็ตก่อน (ได้รุ่นใหม่ทันที) ถ้าเน็ตล่ม ใช้สำเนาในเครื่อง */
var CACHE = 'ubill-2569-11-08.1';
var CORE = ['./', 'index.html', 'me.html', 'style.css', 'app.js', 'me.js', 'config.js', 'help.js', 'icon-192.png', 'icon-512.png', 'logo.jpg', 'manifest.webmanifest', 'manifest-me.webmanifest'];
self.addEventListener('install', function (e) { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () { }); })); });
self.addEventListener('activate', function (e) { e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('ubill-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); })); });
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || /version\.json/.test(u.pathname)) return;
  e.respondWith(fetch(r).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () { return caches.match(r, { ignoreSearch: /\.(html)$|\/$/.test(u.pathname) }).then(function (m) { return m || caches.match('index.html'); }); }));
});
