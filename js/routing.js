/* Easy Budget Tracker: shared page helpers and hash routing.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- Extra pages: Collectibles (money owed to you) and Grocery list ---------- */
var DEFAULT_CL_CATS=['Family','Friends','Customers','Others'];
function formMsg(form,t){var m=form.nextElementSibling;if(!m||!m.classList.contains('form-msg')){m=document.createElement('p');m.className='status form-msg';m.setAttribute('role','alert');m.style.color='var(--neg)';form.parentNode.insertBefore(m,form.nextSibling)}m.textContent=t;m.hidden=!t}
function CL(){return state.collect||(state.collect={cats:DEFAULT_CL_CATS.slice(),items:[]})}
function GR(){return state.grocery||(state.grocery={link:'',limit:0,items:[],group:true,learn:{}})}
function isoToday(){var d=new Date();return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate())}
function isoValid(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;var p=s.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);return d.getFullYear()===+p[0]&&d.getMonth()===+p[1]-1&&d.getDate()===+p[2]&&+p[0]>=1990&&+p[0]<=2200}
function isoDate(s){var p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2])}
function isoShort(s){var d=isoDate(s),t=new Date(),o=MONTHS[d.getMonth()]+' '+d.getDate();return d.getFullYear()===t.getFullYear()?o:o+', '+d.getFullYear()}
function daysUntil(s){var t=new Date();t=new Date(t.getFullYear(),t.getMonth(),t.getDate());return Math.round((isoDate(s)-t)/864e5)}
function trackOnce(name){try{if(!lsGet('ebt.ev.'+name)){lsSet('ebt.ev.'+name,'1');track(name)}}catch(e){}}
function cleanCL(c){
  var out={cats:[],items:[]},seen=Object.create(null);if(!c||typeof c!=='object')c={};
  (Array.isArray(c.cats)?c.cats:DEFAULT_CL_CATS).forEach(function(n){n=String(n==null?'':n).trim().slice(0,40);if(n&&!seen[n.toLowerCase()]&&out.cats.length<60){seen[n.toLowerCase()]=1;out.cats.push(n)}});
  (Array.isArray(c.items)?c.items:[]).slice(0,3000).forEach(function(i){
    if(!i||typeof i!=='object')return;
    var cat=String(i.cat==null?'':i.cat).trim().slice(0,40)||'Others';
    if(!seen[cat.toLowerCase()]){seen[cat.toLowerCase()]=1;out.cats.push(cat)}
    else cat=out.cats.filter(function(x){return x.toLowerCase()===cat.toLowerCase()})[0]||cat;
    var o={id:cid(i.id),name:String(i.name||'').slice(0,80),cat:cat,note:String(i.note||'').slice(0,120),paid:{}};
    if(i.pay===undefined&&i.amount!==undefined){
      /* older single-payment entries become a one-month collectible */
      var fm=isoValid(i.due)?i.due.slice(0,7):(isoValid(i.paid)?i.paid.slice(0,7):ymNow());
      o.pay=Math.max(0,num(i.amount));o.term=1;o.first=fm;o.due=0;
      if(isoValid(i.paid))o.paid[fm]={d:i.paid,by:fm};
    }else{
      o.pay=Math.max(0,num(i.pay));o.term=Math.max(1,Math.min(600,Math.round(num(i.term))||1));o.first=validYM(i.first)?i.first:ymNow();
      o.due=Math.max(0,Math.min(31,Math.round(num(i.due))||0));
      if(i.paid&&typeof i.paid==='object')Object.keys(i.paid).slice(0,700).forEach(function(k){var p=i.paid[k];if(validYM(k)&&p&&isoValid(p.d)&&validYM(p.by))o.paid[k]={d:p.d,by:p.by}});
    }
    out.items.push(o);
  });
  if(!out.cats.length)out.cats=DEFAULT_CL_CATS.slice();
  return out;
}
function cleanGR(g){
  var out={link:'',limit:0,items:[],group:true,learn:{}};if(!g||typeof g!=='object')return out;out.group=g.group!==false;
  if(g.learn&&typeof g.learn==='object'){Object.keys(g.learn).slice(0,300).forEach(function(k){var v=g.learn[k];if(typeof k==='string'&&k.length<=60&&typeof v==='string'&&grAisleOk(v))out.learn[k]=v})}
  out.link=cid(g.link||'x');if(!g.link)out.link='';out.limit=Math.max(0,num(g.limit));
  (Array.isArray(g.items)?g.items:[]).slice(0,2000).forEach(function(i){
    if(!i||typeof i!=='object')return;
    var pr=(i.price===null||i.price===undefined||i.price==='')?null:Math.max(0,num(i.price)),bought=isoValid(i.bought)?i.bought:'',ap=null;
    if(bought&&i.applied&&typeof i.applied==='object'&&validYM(i.applied.ym)&&typeof i.applied.id==='string')ap={id:cid(i.applied.id),ym:i.applied.ym,amt:Math.max(0,num(i.applied.amt))};
    out.items.push({id:cid(i.id),name:String(i.name||'').slice(0,80),price:pr,bought:bought,applied:ap,aisle:(typeof i.aisle==='string'&&grAisleOk(i.aisle))?i.aisle:''});
  });
  return out;
}
function focusKeep(sel){setTimeout(function(){var e=document.querySelector(sel);if(e)try{e.focus({preventScroll:true})}catch(x){e.focus()}},0)}
function focusSoon2(sel){setTimeout(function(){var e=document.querySelector(sel);if(e)e.focus()},0)}

/* --- routing --- */
var BASE_TITLE=document.title;
var routeOv=null,routeAt=null,HASHES={budget:'#/',tx:'#/transactions',reports:'#/reports',notebook:'#/notebook',collect:'#/collectibles',grocery:'#/groceries',insights:'#/insights',help:'#/help'};
function viewName(){var h=location.hash;if(routeOv&&routeAt===h)return routeOv;return h==='#/transactions'?'tx':h==='#/reports'?'reports':h==='#/notebook'?'notebook':h==='#/collectibles'?'collect':h==='#/groceries'?'grocery':h==='#/help'?'help':h==='#/insights'?'insights':'budget'}
function renderPages(){
  var v=viewName();
  document.body.setAttribute('data-view',v);
  $('dash').hidden=v!=='budget';$('pgCollect').hidden=v!=='collect';$('pgGrocery').hidden=v!=='grocery';$('pgHelp').hidden=v!=='help';$('pgInsights').hidden=v!=='insights';$('pgTx').hidden=v!=='tx';$('pgReports').hidden=v!=='reports';$('pgNotebook').hidden=v!=='notebook';
  [].forEach.call(document.querySelectorAll('[data-nav][data-v]'),function(a){var on=a.getAttribute('data-v')===v;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});var mb=document.querySelector('[data-more]');if(mb)mb.classList.toggle('on',v==='grocery'||v==='insights'||v==='help'||v==='reports');syncDark();
  document.title=v==='notebook'?'Budget Notebook · Easy Budget Tracker':v==='tx'?'Transactions · Easy Budget Tracker':v==='reports'?'Reports · Easy Budget Tracker':v==='insights'?'Insights · Easy Budget Tracker':v==='help'?'How to use · Easy Budget Tracker':v==='collect'?'Collectibles · Easy Budget Tracker':v==='grocery'?'Grocery list · Easy Budget Tracker':BASE_TITLE;
  if(v==='collect')renderCollect();else if(v==='grocery')renderGrocery();else if(v==='help')renderHelp();else if(v==='insights')renderInsights();else if(v==='tx')renderTx();else if(v==='reports')renderReports();else if(v==='notebook')renderNotebook();
}
function onRoute(){
  if(showSettings)setSettings(false);
  if(nbOpen)nbClosePage();
  var v=viewName();
  if(v==='budget')renderAll();else{renderPages();trackOnce(v==='notebook'?'view-notebook':v==='tx'?'view-transactions':v==='reports'?'view-reports':v==='collect'?'view-collectibles':v==='help'?'view-help':v==='insights'?'view-insights':'view-groceries')}
  window.scrollTo(0,0);
}
window.addEventListener('hashchange',onRoute);
function go(v){try{location.hash=HASHES[v]||'#/'}catch(e){}routeOv=v;routeAt=location.hash;onRoute()}
document.addEventListener('click',function(ev){var a=ev.target.closest&&ev.target.closest('[data-nav][data-v]');if(!a)return;ev.preventDefault();go(a.getAttribute('data-v'))});

