/*
 * 深淺色模式，在 <head> 裡同步載入，好在第一次繪製前就決定——放到 main.js 的話，
 * 深色模式的使用者每次開頁都會先閃一下白。CSP 不允許 inline script，所以單獨一個檔。
 *
 * 規則跟主站一樣：localStorage 的 theme 是 dark / light 就照它，否則跟系統。
 * 主站是另一個網域，存的值不共用，只是鍵名與行為對齊。
 */
(function () {
  var root = document.documentElement;
  var stored = null;
  try { stored = localStorage.getItem('theme'); } catch (e) { /* 無痕模式 */ }
  var dark = stored === 'dark' ||
    (stored !== 'light' && !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches));
  root.classList.add(dark ? 'dark' : 'light');
})();
