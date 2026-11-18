/* Easy Budget Tracker: "What's new" pop-up (v9.43).
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html (after spendcal.js, before boot.js).
   Shows once after an update. The last version the person has seen is kept in localStorage under 'ebt.seen-ver' (a few bytes, this device only).
   To add notes for a new release: add an entry at the TOP of WN_NOTES and raise APP_VER. People who skipped versions see every entry newer than the one they last saw. */
'use strict';
var APP_VER='9.44';
var WN_NOTES=[
  {v:'9.44',title:'A fresh look',items:[
    'A cleaner Inter font, plus cards that float with a soft shadow.',
    'Each category card is outlined in its own color.',
    'Buttons spring when you tap them.',
    'A new floating tab bar with a highlight that slides to the page you are on.'
  ]},
  {v:'9.43',title:'Spending calendar',items:[
    'New calendar button in the Spending card. It shows each day of the month with the total spent, and tapping a day lists its items.',
    'Every spending item now has a date. It starts as today, and you can change it to a past day. A date in another month moves the item to that month.',
    'Items you added before this update keep their amounts and have no date. Tap “set date” beside them to add one.',
    'Spending no longer repeats every month. Use Bills for anything that repeats.',
    'You can read this again any time in Settings, under “What’s new”.'
  ]}
];
var wnEl=null,wnPrev=null;

function wnParse(v){return String(v||'').split('.').map(function(x){return parseInt(x,10)||0})}
function wnCmp(a,b){var x=wnParse(a),y=wnParse(b);for(var i=0;i<3;i++){var d=(x[i]||0)-(y[i]||0);if(d)return d<0?-1:1}return 0}

function wnClose(){
  var el=wnEl;if(!el)return;
  wnEl=null;document.removeEventListener('keydown',wnKey,true);
  if(el.parentNode)el.parentNode.removeChild(el);
  if(typeof syncLock==='function')syncLock();
  if(!(typeof showSettings!=='undefined'&&showSettings))document.body.style.overflow='';
  lsSet('ebt.seen-ver',APP_VER);
  try{if(wnPrev&&wnPrev.focus&&document.body.contains(wnPrev))wnPrev.focus()}catch(e){}
}
function wnKey(e){
  if(!wnEl)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();wnClose();return}
  if(e.key!=='Tab')return;
  var f=[].filter.call(wnEl.querySelectorAll('button'),function(x){return !x.disabled&&x.offsetParent!==null});
  if(!f.length)return;
  var first=f[0],last=f[f.length-1],a=document.activeElement;
  if(!wnEl.contains(a)){e.preventDefault();first.focus()}
  else if(e.shiftKey&&a===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&a===last){e.preventDefault();first.focus()}
}
/* since: only entries newer than this version (null = just the latest entry) */
function showWhatsNew(since){
  if(wnEl)return;
  var list=WN_NOTES.filter(function(n){return since?wnCmp(n.v,since)>0:true});
  if(!since)list=list.slice(0,1);
  if(!list.length)list=WN_NOTES.slice(0,1);
  wnPrev=document.activeElement;
  var body=list.map(function(n){return '<h3>'+esc(n.title)+' <small>version '+esc(n.v)+'</small></h3><ul>'+n.items.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ul>'}).join('');
  var el=document.createElement('div');el.className='curfirst wn';el.id='whatsNew';
  el.innerHTML='<div class="curfirst-card wn-card" role="dialog" aria-modal="true" aria-labelledby="wnT"><h2 id="wnT">What’s new</h2><div class="wn-body">'+body+'</div><button type="button" class="tbtn primary cf-go" id="wnGo">Got it</button></div>';
  document.body.appendChild(el);wnEl=el;document.body.style.overflow='hidden';
  el.addEventListener('click',function(e){if(e.target===el||e.target.id==='wnGo')wnClose()});
  document.addEventListener('keydown',wnKey,true);
  var g=el.querySelector('#wnGo');if(g)g.focus();
}
/* called once from boot.js. A brand-new person already gets the currency pop-up, so they are just marked as up to date. */
function wnCheck(brandNew){
  var seen=null;try{seen=lsGet('ebt.seen-ver')}catch(e){}
  if(brandNew){lsSet('ebt.seen-ver',APP_VER);return}
  if(seen&&wnCmp(seen,APP_VER)>=0)return;
  showWhatsNew(seen||null);
}
