/* Easy Budget Tracker: Budget Notebook (trips and projects).
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ===== v9.21: Budget Notebook: pages for trips and projects ===== */
var nbOpen=null,nbOpener=null,nbSureTimer=null;
function NB(){if(!state.notebook||!Array.isArray(state.notebook.pages))state.notebook={pages:[],learn:{}};return state.notebook}
var NB_TYPES=[['transport','Transportation'],['food','Food & Drinks'],['stay','Hotel & Stay'],['fun','Activities'],['shop','Shopping'],['ess','Essentials'],['other','Other']];
var NB_WORDS={
 transport:'flight airplane plane airfare bus train taxi grab uber cab jeepney tricycle mrt lrt subway metro ferry boat cruise car rental gas gasoline fuel toll parking fare commute shinkansen jr angkas van shuttle bike baggage luggage tren eroplano pamasahe sasakyan plane_ticket train_ticket bus_ticket jr_pass',
 food:'food meal meals breakfast lunch dinner snack snacks coffee cafe restaurant ramen sushi drink drinks beer dessert buffet pizza burger takoyaki groceries kain pagkain almusal tanghalian hapunan merienda inumin resto tea bar milk_tea',
 stay:'hotel hostel airbnb resort room lodging accommodation stay inn villa motel bnb dorm tent campsite tuloy',
 fun:'tour museum park admission entrance show concert excursion activity activities ride diving snorkeling hike trek spa massage disneyland usj universal studios onsen shrine temple castle aquarium zoo adventure hopping guide movie cinema klook theme_park',
 shop:'souvenir souvenirs gift gifts pasalubong shopping clothes shirt shoes bag mall outlet cosmetics perfume merch toy toys duty_free',
 ess:'visa insurance sim esim wifi laundry tip tips tax fee permit vaccine passport charger adapter load pocket_wifi'
};
var NB_MAP=null,NB_PHR=[],NB_CACHE={};
function nbBuild(){NB_MAP={};NB_PHR=[];Object.keys(NB_WORDS).forEach(function(k){NB_WORDS[k].split(' ').forEach(function(w){if(!w)return;if(w.indexOf('_')>=0)NB_PHR.push([w.replace(/_/g,' '),k]);else NB_MAP[w]=k})});NB_PHR.sort(function(a,b){return b[0].length-a[0].length})}
function nbTypeOk(k){return NB_TYPES.some(function(a){return a[0]===k})}
function nbLabel(k){for(var i=0;i<NB_TYPES.length;i++)if(NB_TYPES[i][0]===k)return NB_TYPES[i][1];return 'Other'}
function nbGuess(name){
  var n=grNorm(name);if(!n)return 'other';
  var L=NB().learn,ln=(L&&Object.prototype.hasOwnProperty.call(L,n))?L[n]:null;if(ln&&nbTypeOk(ln))return ln;
  if(NB_CACHE[n])return NB_CACHE[n];
  if(!NB_MAP)nbBuild();
  var pad=' '+n+' ',i,j,t,v,tk=n.split(' ');
  for(i=0;i<NB_PHR.length;i++)if(pad.indexOf(' '+NB_PHR[i][0]+' ')>=0)return (NB_CACHE[n]=NB_PHR[i][1]);
  for(i=tk.length-1;i>=0;i--){t=tk[i];v=[t];if(/ies$/.test(t))v.push(t.slice(0,-3)+'y');if(/es$/.test(t))v.push(t.slice(0,-2));if(/s$/.test(t))v.push(t.slice(0,-1));
    for(j=0;j<v.length;j++)if(NB_MAP[v[j]])return (NB_CACHE[n]=NB_MAP[v[j]])}
  return (NB_CACHE[n]='other');
}
function nbType(i){return (i.type&&nbTypeOk(i.type))?i.type:nbGuess(i.name)}
function nbAmt(v){var n=num(v);return (isFinite(n)&&n>0)?Math.min(1e12,Math.round(n*100)/100):0}
function cleanNB(n){
  var out={pages:[],learn:{}};if(!n||typeof n!=='object'||!Array.isArray(n.pages))return out;
  if(n.learn&&typeof n.learn==='object')Object.keys(n.learn).slice(0,300).forEach(function(k){var v=n.learn[k];if(k.length<=60&&typeof v==='string'&&nbTypeOk(v))out.learn[k]=v});
  n.pages.slice(0,200).forEach(function(p){
    if(!p||typeof p!=='object')return;
    var pg={id:cid(p.id),title:String(p.title==null?'':p.title).slice(0,80),budget:nbAmt(p.budget),created:tsNum(p.created),updated:tsNum(p.updated),cats:[]};
    (Array.isArray(p.cats)?p.cats:[]).slice(0,100).forEach(function(c){
      if(!c||typeof c!=='object')return;
      var cat={id:cid(c.id),name:String(c.name==null?'':c.name).slice(0,40),label:String(c.label==null?'':c.label).slice(0,40),col:!!c.col,items:[]};
      (Array.isArray(c.items)?c.items:[]).slice(0,500).forEach(function(i){if(!i||typeof i!=='object')return;cat.items.push({id:cid(i.id),name:String(i.name==null?'':i.name).slice(0,80),amt:nbAmt(i.amt),type:nbTypeOk(i.type)?i.type:''})});
      pg.cats.push(cat)});
    out.pages.push(pg)});
  return out;
}
function nbCatTotal(c){var t=0;c.items.forEach(function(i){t+=i.amt});return Math.round(t*100)/100}
function nbSpent(p){var t=0;p.cats.forEach(function(c){t+=nbCatTotal(c)});return Math.round(t*100)/100}
function nbCount(p){var n=0;p.cats.forEach(function(c){n+=c.items.length});return n}
function nbStatus(p,spent){
  if(!(p.budget>0))return {cls:'none',label:'No budget set',msg:'Type a budget above to see if you are on track.',pct:0};
  var pct=spent/p.budget*100;
  if(spent>p.budget)return {cls:'over',label:'Over budget',msg:'You are '+fmt(spent-p.budget)+' over your budget.',pct:pct};
  if(pct>=80)return {cls:'warn',label:'Close to the limit',msg:fmt(p.budget-spent)+' left. You have used '+Math.round(pct)+'% of your budget.',pct:pct};
  return {cls:'',label:'On track',msg:fmt(p.budget-spent)+' left of your budget ('+Math.round(pct)+'% used).',pct:pct};
}
function nbMeterCls(s){return (s.cls==='over'||s.cls==='warn')?s.cls:''}
function nbTouch(p){p.updated=Date.now();state.sample=false;save()}
function nbPage(){if(!nbOpen)return null;return NB().pages.filter(function(p){return p.id===nbOpen})[0]||null}
function nbFindCat(p,id){return p.cats.filter(function(c){return c.id===id})[0]||null}

function nbRowHTML(p){
  var sp=nbSpent(p),st=nbStatus(p,sp),n=nbCount(p);
  return '<li><button type="button" class="nb-row" data-nb="open" data-id="'+p.id+'"><span class="nb-main"><span class="nb-t">'+(p.title?esc(p.title):'<span style="color:var(--muted)">Untitled page</span>')+'</span>'+
    '<span class="nb-meta"><span class="nb-badge '+st.cls+'">'+st.label+'</span><span>'+fmt(sp)+(p.budget>0?' of '+fmt(p.budget):' spent')+' · '+p.cats.length+(p.cats.length===1?' category':' categories')+' · '+n+(n===1?' item':' items')+'</span></span>'+
    '<span class="budget-meter"><i class="'+nbMeterCls(st)+'" style="width:'+Math.min(100,st.pct)+'%"></i></span></span><span class="nb-chev" aria-hidden="true">&rsaquo;</span></button></li>';
}
function renderNotebook(){
  var el=$('pgNotebook');if(!el)return;
  var pages=NB().pages.slice().sort(function(a,b){return (b.updated||b.created)-(a.updated||a.created)});
  var h='<header class="pg-head"><div class="pg-eye">Trips and projects</div><h2>Budget Notebook</h2><p>Keep a page for each trip or project. Set a budget, add your expenses, and see if you are on track.</p></header>'+
    '<div><button type="button" class="tbtn primary" data-nb="new">+ New page</button></div>';
  if(!pages.length)h+='<div class="pg-card nb-empty"><b>No pages yet.</b><p>Tap <b>+ New page</b> and name it, for example “Travel budget &amp; expenses (Japan)”. Add a budget, then a day such as Day 1 (Osaka) with items such as Airplane or Ramen. Items sort themselves by type.</p></div>';
  else h+='<ul class="nb-list">'+pages.map(nbRowHTML).join('')+'</ul>';
  el.innerHTML=h;
}
var NB_CHEV='<svg viewBox="0 0 24 24" aria-hidden="true" class="i"><path d="M9 5l7 7-7 7"/></svg>';
function nbCatName(c){return (c.name||'')+(c.label?' ('+c.label+')':'')}
function nbItemsHTML(c){
  var g={};c.items.forEach(function(i){var k=nbType(i);(g[k]=g[k]||[]).push(i)});
  return NB_TYPES.filter(function(t){return g[t[0]]}).map(function(t){
    var sum=0;g[t[0]].forEach(function(i){sum+=i.amt});sum=Math.round(sum*100)/100;
    return '<div class="nb-grp" data-g="'+t[0]+'"><span>'+esc(t[1])+'</span><b>'+fmt(sum)+'</b></div>'+g[t[0]].map(function(i){return nbItemHTML(i,t[0])}).join('');
  }).join('');
}
function nbCatHTML(p,c){
  var tot=nbCatTotal(c),n=c.items.length,nm=nbCatName(c)||'this category';
  var h='<section class="nb-cat" data-cid="'+c.id+'"><div class="nb-cat-h"><button type="button" class="nb-fold" data-nb="toggle" aria-expanded="'+(!c.col)+'" aria-label="'+(c.col?'Expand ':'Collapse ')+esc(nm)+'">'+NB_CHEV+'</button>'+
    '<div class="nb-cat-names"><input class="nb-cat-name" data-nb-f="catname" maxlength="40" placeholder="Day 1" value="'+esc(c.name)+'" aria-label="Day or section name">'+
    '<input class="nb-cat-name lbl" data-nb-f="catlabel" maxlength="40" placeholder="(Label name)" value="'+esc(c.label||'')+'" aria-label="Label name"></div>'+
    '<span class="nb-cat-tot"><b data-nb-tot>'+fmt(tot)+'</b><small data-nb-sub>'+nbCatSub(p,c)+'</small></span></div>';
  if(!c.col){
    h+='<div class="nb-items">'+(n?nbItemsHTML(c):'<div class="nb-none">No items yet. They sort themselves by type as you name them.</div>')+'</div>'+
      '<div class="nb-cat-acts"><button type="button" class="tbtn" data-nb="additem">+ Add item</button><button type="button" class="linkbtn danger" data-nb="delcat">Delete category</button></div>';
  }
  return h+'</section>';
}
function nbCatSub(p,c){var n=c.items.length;return n+(n===1?' item':' items')+(p.budget>0?' · '+Math.round(nbCatTotal(c)/p.budget*100)+'%':'')}
function nbItemHTML(i,g){
  var cur=g||nbType(i);
  return '<div class="nb-item" data-iid="'+i.id+'" data-g="'+cur+'"><input class="pg-in nb-iname" data-nb-f="iname" maxlength="80" placeholder="Item (e.g. Airplane)" value="'+esc(i.name)+'" aria-label="Item name">'+
    '<input class="pg-in num nb-iamt" data-nb-f="iamt" inputmode="decimal" placeholder="0.00" value="'+inputVal(i.amt)+'" aria-label="Amount">'+
    '<button type="button" class="nb-x" data-nb="delitem" aria-label="Delete item">&#10005;</button>'+
    '<select class="pg-aisle nb-type" data-nb-t="type" aria-label="Change type of '+esc(i.name||'this item')+'"><option value="__" selected>Move…</option><option value="">Auto-sort</option>'+NB_TYPES.map(function(t){return '<option value="'+t[0]+'"'+(t[0]===cur?' disabled':'')+'>'+esc(t[1])+'</option>'}).join('')+'</select></div>';
}
function nbSumHTML(p){
  var sp=nbSpent(p),st=nbStatus(p,sp),over=p.budget>0&&sp>p.budget;
  return '<div class="nb-stats"><div class="nb-stat"><small>Spent so far</small><b>'+fmt(sp)+'</b></div><div class="nb-stat'+(over?' over':'')+'"><small>'+(over?'Over by':'Left')+'</small><b>'+(p.budget>0?fmt(Math.abs(p.budget-sp)):'–')+'</b></div></div>'+
    '<div class="budget-meter"><i class="'+nbMeterCls(st)+'" style="width:'+Math.min(100,st.pct)+'%"></i></div>'+
    '<div class="nb-msg"><span class="nb-badge '+st.cls+'">'+st.label+'</span><span>'+st.msg+'</span></div>';
}
function nbUpdateSum(){
  var p=nbPage();if(!p)return;var el=$('nbSum');if(el)el.innerHTML=nbSumHTML(p);
  [].forEach.call(document.querySelectorAll('#nbModal [data-cid]'),function(n){var c=nbFindCat(p,n.getAttribute('data-cid'));if(!c)return;var t=n.querySelector('[data-nb-tot]'),sb=n.querySelector('[data-nb-sub]');if(t)t.textContent=fmt(nbCatTotal(c));if(sb)sb.textContent=nbCatSub(p,c)});
}
function nbFocusKey(ae){
  if(!ae||!ae.getAttribute)return null;
  if(ae.id)return '#'+ae.id;
  var f=ae.getAttribute('data-nb-f'),a=ae.getAttribute('data-nb'),it=ae.closest&&ae.closest('[data-iid]'),ct=ae.closest&&ae.closest('[data-cid]');
  if(f&&it)return '[data-iid="'+it.getAttribute('data-iid')+'"] [data-nb-f="'+f+'"]';
  if(f&&ct)return '[data-cid="'+ct.getAttribute('data-cid')+'"] [data-nb-f="'+f+'"]';
  if(a&&ct&&(a==='toggle'||a==='additem'))return '[data-cid="'+ct.getAttribute('data-cid')+'"] [data-nb="'+a+'"]';
  if(a==='addcat'||a==='allcol')return '#nbModal [data-nb="'+a+'"]';
  return null;
}
function renderNbModal(){
  var el=$('nbModal'),p=nbPage();
  if(!p){el.hidden=true;el.innerHTML='';syncLock();return}
  var pb=el.querySelector('.set-body'),keepTop=pb?pb.scrollTop:0,key=el.contains(document.activeElement)?nbFocusKey(document.activeElement):null;
  var X='<svg viewBox="0 0 24 24" aria-hidden="true" class="i"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var allCol=p.cats.length>0&&p.cats.every(function(c){return c.col});
  el.hidden=false;
  el.innerHTML='<div class="set-card nb-card" role="dialog" aria-modal="true" aria-labelledby="nbTitle"><div class="set-head"><textarea class="nb-title" id="nbTitle" rows="1" data-nb-f="title" maxlength="80" placeholder="Page title, e.g. Travel budget &amp; expenses (Japan)" aria-label="Page title">'+esc(p.title)+'</textarea><button type="button" class="set-x" data-nb="close" aria-label="Close page">'+X+'</button></div>'+
    '<div class="set-body"><div class="nb-sum"><label class="nb-bud" for="nbBudget">Budget<input id="nbBudget" class="num" data-nb-f="budget" inputmode="decimal" placeholder="0.00" value="'+inputVal(p.budget)+'"></label><div id="nbSum" class="nb-sum-in" style="display:grid;gap:12px">'+nbSumHTML(p)+'</div></div>'+
    '<div class="nb-bar"><button type="button" class="tbtn primary" data-nb="addcat">+ Add category</button>'+(p.cats.length>1?'<button type="button" class="linkbtn" data-nb="allcol">'+(allCol?'Expand all':'Collapse all')+'</button>':'')+'</div>'+
    (p.cats.length?'<div class="nb-cats">'+p.cats.map(function(c){return nbCatHTML(p,c)}).join('')+'</div>':'<p class="status">No categories yet. Add one such as Day 1 with a label like (Osaka), then add items. They sort into Transportation, Food, Hotel and more by themselves.</p>')+
    '<div class="set-sec"><button type="button" class="linkbtn danger" data-nb="delpage" style="justify-self:start">Delete this page</button></div></div>'+
    '<div class="set-foot"><button type="button" class="tbtn primary" data-nb="close">Done</button></div></div>';
  var nb=el.querySelector('.set-body');if(nb)nb.scrollTop=keepTop;
  nbFitTitle();
  if(key){var kn=el.querySelector(key);if(kn&&kn!==document.activeElement)try{kn.focus({preventScroll:true})}catch(x){}}
  syncLock();
}
function nbCheck(e){
  var v=String(e.value).trim(),n=v===''?0:parseAmt(v),bad=(v!==''&&(n===null||n<0||amtBadChars(v)));
  e.classList.toggle('nb-bad',bad);
  var w=$('nbWarn');
  if(bad){if(!w){w=document.createElement('p');w.id='nbWarn';w.className='status';w.setAttribute('role','alert');w.style.cssText='color:var(--neg);margin:2px 0 6px'}var an=e.closest('.nb-item')||e.closest('.nb-sum');if(an&&an.parentNode)an.parentNode.insertBefore(w,an.nextSibling);w.textContent='Amounts must be a number of 0 or more, for example 1,250.50. Anything else is left blank.';w.hidden=false}
  else if(w)w.hidden=true;
}
function nbFitTitle(){var t=$('nbTitle');if(!t)return;t.style.height='auto';t.style.height=Math.min(t.scrollHeight+2,120)+'px'}
function nbOpenPage(id,focusTitle){
  nbOpener=document.activeElement;nbOpen=id;renderNbModal();popAnim($('nbModal'));nbFitTitle();
  setTimeout(function(){var t=focusTitle?$('nbTitle'):document.querySelector('#nbModal .set-x');if(t)t.focus({preventScroll:true})},0);
}
function nbClosePage(){
  var p=nbPage();
  if(p&&!p.title.trim()&&!(p.budget>0)&&!p.cats.some(function(c){return c.name.trim()||(c.label||'').trim()||c.items.some(function(i){return i.name.trim()||i.amt>0})})){
    var pid=p.id;NB().pages=NB().pages.filter(function(x){return x.id!==pid});save();p=null;
  }
  if(p){
    p.cats=p.cats.filter(function(c){c.items=c.items.filter(function(i){return i.name.trim()||i.amt>0});return c.name.trim()||(c.label||'').trim()||c.items.length});
    p.cats.forEach(function(c){c.name=c.name.trim();c.label=(c.label||'').trim()});
    p.title=p.title.trim()||'Untitled page';
    p.updated=Date.now();save();
  }
  nbOpen=null;renderNbModal();
  if(viewName()==='notebook')renderNotebook();
  var o=nbOpener;nbOpener=null;
  setTimeout(function(){var r=p&&document.querySelector('.nb-row[data-id="'+p.id+'"]');
    if(o&&o.isConnected&&o.offsetParent!==null)o.focus({preventScroll:true});else if(r)r.focus({preventScroll:true})},0);
}
function nbArm(b,armed,idle){
  if(b.classList.contains('sure'))return true;
  [].forEach.call(document.querySelectorAll('#nbModal .sure'),function(x){x.classList.remove('sure');x.textContent=x.getAttribute('data-idle')||x.textContent});
  b.setAttribute('data-idle',b.textContent);b.classList.add('sure');b.textContent=armed;
  clearTimeout(nbSureTimer);nbSureTimer=setTimeout(function(){b.classList.remove('sure');b.textContent=idle},3500);
  return false;
}
document.addEventListener('click',function(ev){
  var b=ev.target.closest&&ev.target.closest('[data-nb]');if(!b)return;
  var a=b.getAttribute('data-nb'),p=nbPage(),ct=b.closest('[data-cid]'),c=(p&&ct)?nbFindCat(p,ct.getAttribute('data-cid')):null;
  if(a==='new'){var np={id:uid(),title:'',budget:0,created:Date.now(),updated:Date.now(),cats:[]};NB().pages.push(np);state.sample=false;save();trackOnce('notebook-page-added');nbOpenPage(np.id,true);return}
  if(a==='open'){nbOpenPage(b.getAttribute('data-id'),false);return}
  if(a==='close'){nbClosePage();return}
  if(!p)return;
  if(a==='addcat'){var nc={id:uid(),name:'',label:'',col:false,items:[]};p.cats.push(nc);nbTouch(p);renderNbModal();var ni=document.querySelector('[data-cid="'+nc.id+'"] [data-nb-f="catname"]');if(ni){ni.focus();ni.scrollIntoView({block:'center'})}return}
  if(a==='additem'&&c){var it={id:uid(),name:'',amt:0,type:''};c.items.push(it);c.col=false;nbTouch(p);renderNbModal();var nn=document.querySelector('[data-iid="'+it.id+'"] [data-nb-f="iname"]');if(nn){nn.focus();nn.scrollIntoView({block:'center'})}return}
  if(a==='toggle'&&c){c.col=!c.col;nbTouch(p);renderNbModal();return}
  if(a==='allcol'){var allC=p.cats.every(function(x){return x.col});p.cats.forEach(function(x){x.col=!allC});nbTouch(p);renderNbModal();return}
  if(a==='delitem'&&c){var ie=b.closest('[data-iid]');if(!ie)return;if(nbArm(b,'Delete?','✕')){clearTimeout(nbSureTimer);c.items=c.items.filter(function(x){return x.id!==ie.getAttribute('data-iid')});nbTouch(p);renderNbModal()}return}
  if(a==='delcat'&&c){if(nbArm(b,'Tap again to delete','Delete category')){clearTimeout(nbSureTimer);p.cats=p.cats.filter(function(x){return x.id!==c.id});nbTouch(p);renderNbModal()}return}
  if(a==='delpage'){if(nbArm(b,'Tap again to delete this page','Delete this page')){clearTimeout(nbSureTimer);var id=p.id;NB().pages=NB().pages.filter(function(x){return x.id!==id});save();nbOpen=null;nbOpener=null;renderNbModal();if(viewName()==='notebook')renderNotebook();var nw=document.querySelector('[data-nb="new"]');if(nw)nw.focus()}return}
});
document.addEventListener('input',function(ev){
  var e=ev.target,f=e.getAttribute&&e.getAttribute('data-nb-f');if(!f||!nbOpen)return;
  var p=nbPage();if(!p)return;
  var ie=e.closest('[data-iid]'),ce=e.closest('[data-cid]'),c=ce?nbFindCat(p,ce.getAttribute('data-cid')):null,it=(c&&ie)?c.items.filter(function(x){return x.id===ie.getAttribute('data-iid')})[0]:null;
  if(f==='title'){p.title=e.value.replace(/[\r\n]+/g,' ').slice(0,80);nbFitTitle()}
  else if(f==='budget'){nbCheck(e);p.budget=nbAmt(e.value);nbTouch(p);nbUpdateSum();return}
  else if(f==='catname'&&c)c.name=e.value.slice(0,40);
  else if(f==='catlabel'&&c)c.label=e.value.slice(0,40);
  else if(f==='iname'&&it)it.name=e.value.slice(0,80);
  else if(f==='iamt'&&it){nbCheck(e);it.amt=nbAmt(e.value);nbTouch(p);nbUpdateSum();return}
  else return;
  nbTouch(p);
});
var nbSortT=null;
function nbQueueSort(){
  clearTimeout(nbSortT);
  nbSortT=setTimeout(function(){
    var p=nbPage();if(!p)return;var ae=document.activeElement;
    if(ae&&ae.matches&&ae.matches('#nbModal .nb-item [data-nb-f]'))return; /* still typing: sort at the next blur */
    var dirty=false;p.cats.forEach(function(c){c.items.forEach(function(i){var r=document.querySelector('#nbModal [data-iid="'+i.id+'"]');if(r&&r.getAttribute('data-g')!==nbType(i))dirty=true})});
    if(dirty)renderNbModal();
  },450);
}
document.addEventListener('change',function(ev){
  var e=ev.target;if(!e.getAttribute||e.getAttribute('data-nb-t')!=='type'||!nbOpen)return;
  var p=nbPage(),ie=e.closest('[data-iid]'),ce=e.closest('[data-cid]');if(!p||!ie||!ce||e.value==='__')return;
  var c=nbFindCat(p,ce.getAttribute('data-cid')),it=c&&c.items.filter(function(x){return x.id===ie.getAttribute('data-iid')})[0];if(!it)return;
  var N=NB();N.learn=N.learn||{};var nk=grNorm(it.name);
  if(e.value===''){it.type='';if(nk)delete N.learn[nk]}
  else if(nbTypeOk(e.value)){it.type=e.value;if(nk){var ks=Object.keys(N.learn);if(ks.length>=300&&!(nk in N.learn))delete N.learn[ks[0]];N.learn[nk]=e.value}}
  NB_CACHE={};nbTouch(p);renderNbModal();
  var f=document.querySelector('#nbModal [data-iid="'+it.id+'"] [data-nb-f="iname"]');if(f)try{f.focus({preventScroll:true})}catch(x){}
});
document.addEventListener('focusout',function(ev){
  var e=ev.target,f=e.getAttribute&&e.getAttribute('data-nb-f');if(!f||!nbOpen)return;
  var p=nbPage();if(!p)return;
  if(f==='budget'||f==='iamt'){e.classList.remove('nb-bad')}
  if(f==='iname'||f==='iamt')nbQueueSort();
  if(f==='budget')e.value=inputVal(p.budget);
  else if(f==='iamt'){var ie=e.closest('[data-iid]'),ce=e.closest('[data-cid]'),c=ce?nbFindCat(p,ce.getAttribute('data-cid')):null,it=(c&&ie)?c.items.filter(function(x){return x.id===ie.getAttribute('data-iid')})[0]:null;if(it)e.value=inputVal(it.amt)}
});
document.addEventListener('keydown',function(ev){
  var e=ev.target,f=e.getAttribute&&e.getAttribute('data-nb-f');if(!f||!nbOpen||ev.key!=='Enter'||ev.isComposing)return;
  ev.preventDefault();
  var ie=e.closest('[data-iid]'),ce=e.closest('[data-cid]');
  if(f==='title'){var bu=$('nbBudget');if(bu)bu.focus()}
  else if(f==='iname'&&ie){var am=ie.querySelector('[data-nb-f="iamt"]');if(am)am.focus()}
  else if(f==='iamt'&&ie&&ce){var addb=ce.querySelector('[data-nb="additem"]');if(addb&&(e.value.trim()||ie.querySelector('[data-nb-f="iname"]').value.trim()))addb.click();else e.blur()}
  else if(f==='catname'&&ce){var ab=ce.querySelector('[data-nb="additem"]');if(ab)ab.click();else{var tg=ce.querySelector('[data-nb="toggle"]');if(tg)tg.click()}}
  else e.blur();
});

