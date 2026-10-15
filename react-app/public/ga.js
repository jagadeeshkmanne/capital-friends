// Google Analytics 4 for capitalfriends.in (all pages load this file).
// Put your GA4 Measurement ID here (Admin → Data streams → Web → Measurement ID, looks like G-XXXXXXXXXX).
// While it is empty, nothing is loaded and nothing is sent.
window.CF_GA_ID = '';
(function () {
  var id = window.CF_GA_ID;
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return;
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true, send_page_view: true });
  // SPA: the React app changes the URL without a reload; send a page_view on each change
  var last = location.pathname + location.search;
  var push = history.pushState, rep = history.replaceState;
  function changed() { var now = location.pathname + location.search; if (now !== last) { last = now; gtag('event', 'page_view', { page_path: now, page_title: document.title }); } }
  history.pushState = function () { push.apply(this, arguments); changed(); };
  history.replaceState = function () { rep.apply(this, arguments); changed(); };
  window.addEventListener('popstate', changed);
})();
