/* Easy Budget Tracker: dark mode and the More sheet.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- navigation helpers: dark mode, More sheet ---------- */
function setMore(open){var s=$('moreSheet');if(s)s.hidden=!open}
document.addEventListener('click',function(ev){
  var t=ev.target;if(!t.closest)return;
  if(t.closest('[data-more]')){setMore($('moreSheet').hidden);return}
  if(t.closest('[data-nav]')||t.closest('[data-scroll]')){setMore(false)}
  if(t.closest('[data-scroll]')){window.scrollTo(0,0)}
  var d=t.closest('[data-dark]');
  if(d){
    var ct=themeOf(themeOk(state.theme)?state.theme:'blue-dark'),tid=themeId(ct.color,ct.mode==='dark'?'light':'dark');
    if(themeOk(tid)){state.theme=tid;applyTheme(tid);save();renderSettings();renderInsights();syncDark()}
    setMore(false);
  }
  if(t.classList&&t.classList.contains('sheet'))setMore(false);
});
var setDownOn=null;
document.addEventListener('mousedown',function(ev){setDownOn=ev.target},true);
document.addEventListener('touchstart',function(ev){setDownOn=ev.target},true);
document.addEventListener('click',function(ev){var t=ev.target;if(showSettings&&t&&t.id==='settings'&&setDownOn===t)setSettings(false);if(nbOpen&&t&&t.id==='nbModal'&&setDownOn===t)nbClosePage()});
document.addEventListener('keydown',function(ev){
  if(ev.key==='Escape'){setMore(false);if(nbOpen){ev.preventDefault();nbClosePage();return}var dlg=$('impDlg');if(showSettings&&!(dlg&&dlg.open)){ev.preventDefault();setSettings(false)}return}
  if(ev.key==='Tab'&&(showSettings||nbOpen)){
    var dlg2=$('impDlg');if(dlg2&&dlg2.open)return;
    var card=document.querySelector('.settings:not([hidden]) .set-card');if(!card)return;
    var f=focusables(card);if(!f.length)return;
    var first=f[0],last=f[f.length-1],act=document.activeElement;
    if(!card.contains(act)){ev.preventDefault();first.focus()}
    else if(ev.shiftKey&&act===first){ev.preventDefault();last.focus()}
    else if(!ev.shiftKey&&act===last){ev.preventDefault();first.focus()}
  }
});
function syncDark(){
  var dark=themeOf(themeOk(state.theme)?state.theme:'blue-dark').mode==='dark';
  [].forEach.call(document.querySelectorAll('[data-dark] span'),function(s){s.textContent=dark?'Light mode':'Dark mode'});
}

