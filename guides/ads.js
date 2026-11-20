/* Easy Budget Tracker: Google AdSense for the guide pages ONLY (never inside the app).
   Ads stay OFF until you paste your AdSense publisher ID below. After AdSense approves the site:
   1. Put your publisher ID in PUB (looks like ca-pub-1234567890123456). This loads Google's script, which also shows
      Google's certified consent message to visitors in the EU, UK and Switzerland (set it up in AdSense > Privacy & messaging).
   2. Create one "Display ad" unit in AdSense (responsive), and put its unit number in SLOT. One ad is then placed
      in the middle of each guide, and below the list on the guides home page. Leave SLOT empty to load the script only.
   3. Put your publisher ID in ads.txt (see the comments in that file). */
(function () {
  'use strict';
  var PUB = '';
  var SLOT = '';
  if (!/^ca-pub-\d{10,20}$/.test(PUB)) return;
  if (location.pathname.indexOf('/guides/') < 0) return;
  var s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + PUB;
  document.head.appendChild(s);
  if (!/^\d{6,15}$/.test(SLOT)) return;
  function place() {
    var art = document.querySelector('article'), h2 = art ? art.querySelectorAll('h2') : [], box = document.createElement('div');
    box.className = 'ad-slot';
    box.setAttribute('aria-label', 'Advertisement');
    box.innerHTML = '<ins class="adsbygoogle" style="display:block" data-ad-client="' + PUB + '" data-ad-slot="' + SLOT + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    if (h2.length >= 2) h2[1].parentNode.insertBefore(box, h2[1]);
    else { var c = document.querySelector('main .cards'); if (!c) return; c.parentNode.insertBefore(box, c.nextSibling); }
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place); else place();
})();
