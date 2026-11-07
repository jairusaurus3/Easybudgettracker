/* Easy Budget Tracker: settings, constants, sample data, saved state, loading and saving, other-tab sync.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* PASTE YOUR GOOGLE CLIENT ID BETWEEN THE QUOTES (see setup steps). Leave empty to paste it in Settings instead. */
var GOOGLE_CLIENT_ID='390639454624-p9rk919gntg6gblhkqibeqd8pb9qt67h.apps.googleusercontent.com';
/* Anonymous sign-in counter. Put your GoatCounter address between the quotes, for example https://yourcode.goatcounter.com
   Leave it empty to turn counting off (nothing is sent). */
var GOATCOUNTER='https://easybudgettracker.goatcounter.com';
var KEY='monthbymonth.v1';
var KINDS=[
  {k:'income',title:'Income',color:'--c-income',noun:'income',sugg:['Salary','Side income','Allowance']},
  {k:'bill',title:'Bills',color:'--c-bills',noun:'bill',sugg:['Rent / mortgage','Electricity','Internet','Phone']},
  {k:'spend',title:'Spending',color:'--c-spend',noun:'spending category',sugg:['Groceries','Transport','Eating out']},
  {k:'saving',title:'Savings',color:'--c-save',noun:'savings goal',sugg:['Emergency fund','Retirement']},
  {k:'card',title:'Credit Cards',color:'--c-card',noun:'credit card',sugg:['BDO card','BPI card','Metrobank card']},
  {k:'loan',title:'Loans',color:'--c-loan',noun:'loan',sugg:[]},
  {k:'collect',title:'Collectibles',color:'--c-collect',noun:'collectible',sugg:[]}
];
var THEMES=[
  {id:'blue-dark',color:'blue',mode:'dark',bg:'#0f141c',ac:'#8fb0ff'},
  {id:'blue-light',color:'blue',mode:'light',bg:'#f2f4f7',ac:'#2447a8'},
  {id:'pink-dark',color:'pink',mode:'dark',bg:'#1a0f16',ac:'#ff8fbf'},
  {id:'pink-light',color:'pink',mode:'light',bg:'#fdf1f6',ac:'#c2306f'},
  {id:'black',color:'mono',mode:'dark',bg:'#000000',ac:'#ffffff'},
  {id:'white',color:'mono',mode:'light',bg:'#ffffff',ac:'#111318'},
  {id:'green-dark',color:'green',mode:'dark',bg:'#0e1813',ac:'#7bf4b4'},
  {id:'green-light',color:'green',mode:'light',bg:'#eef7f2',ac:'#157542'},
  {id:'teal-dark',color:'teal',mode:'dark',bg:'#0e1818',ac:'#7bf0f4'},
  {id:'teal-light',color:'teal',mode:'light',bg:'#eef6f7',ac:'#157275'},
  {id:'purple-dark',color:'purple',mode:'dark',bg:'#130e18',ac:'#b47bf4'},
  {id:'purple-light',color:'purple',mode:'light',bg:'#f2eef7',ac:'#531a93'},
  {id:'red-dark',color:'red',mode:'dark',bg:'#180e0e',ac:'#f47b83'},
  {id:'red-light',color:'red',mode:'light',bg:'#f7eeee',ac:'#931a22'},
  {id:'orange-dark',color:'orange',mode:'dark',bg:'#18120e',ac:'#f4b07b'},
  {id:'orange-light',color:'orange',mode:'light',bg:'#f7f2ee',ac:'#824517'},
  {id:'yellow-dark',color:'yellow',mode:'dark',bg:'#18160e',ac:'#f4d87b'},
  {id:'yellow-light',color:'yellow',mode:'light',bg:'#f7f5ee',ac:'#826917'}
];
var THEME_COLORS=[['blue','Blue'],['green','Green'],['teal','Teal'],['purple','Purple'],['pink','Pink'],['red','Red'],['orange','Orange'],['yellow','Yellow'],['mono','Black / White']];
function themeId(color,mode){return THEMES.filter(function(t){return t.color===color&&t.mode===mode})[0].id}
function themeOf(id){return THEMES.filter(function(t){return t.id===id})[0]||THEMES[0]}
function themeOk(id){return THEMES.some(function(t){return t.id===id})}
var CURRENCIES=['$','₱','€','£','¥','₹','₩','A$','C$','S$','R$','Rp','฿','kr','CHF'];
var MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];

function uid(){return Math.random().toString(36).slice(2,9)}
function cid(x){var t=String(x==null?'':x).replace(/[^\w\-]/g,'').slice(0,40);return t||uid()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function ymNow(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function idx(m){var p=m.split('-');return (+p[0])*12+(+p[1]-1)}
function fromIdx(i){var y=Math.floor(i/12),mo=i%12+1;return y+'-'+String(mo).padStart(2,'0')}
function add(m,n){return fromIdx(idx(m)+n)}
function label(m){var p=m.split('-');return FULL[+p[1]-1]+' '+p[0]}
function short(m){var p=m.split('-');return MONTHS[+p[1]-1]+' '+p[0]}
function validYM(s){return /^\d{4}-(0[1-9]|1[0-2])$/.test(s||'')}
function ord(n){var x=['th','st','nd','rd'],v=n%100;return n+(x[(v-20)%10]||x[v]||x[0])}
function daysIn(y,m){return new Date(y,m,0).getDate()}
function pad2(n){return String(n).padStart(2,'0')}
/* timestamps are milliseconds (about 1.8 trillion): they must not go through the amount clamp */
/* anything before Sep 2001 (under 1e12 ms) is not a real date: an old bug saved 1e9, which showed as Jan 12, 1970 */
function tsNum(v){var n=Number(v);return (isFinite(n)&&n>=1e12)?Math.min(n,8.64e15):0}
function num(v){if(typeof v==='number')return isFinite(v)?amtClamp(v):0;if(amtBadChars(v))return 0;var n=parseAmt(v);return n===null?0:n}

/* ---------- sample data ---------- */
function sample(){var r=sampleRaw();return sane(r)||r}
function sampleRaw(){
  var now=ymNow(), prev=add(now,-1), prev2=add(now,-2);
  function it(kind,name,usual,repeat,start,over){var pd={};if(kind==='bill')pd[now]=true;return {id:uid(),kind:kind,name:name,usual:usual,repeat:repeat,start:start,over:over||{},paid:pd}}
  var o=function(a,b,c){var r={};r[now]=a;r[prev]=b;r[prev2]=c;return r};
  return {v:1,currency:'₱',carry:false,startMonth:prev2,opening:0,sample:true,updatedAt:0,
    items:[
      it('income','Salary',3400,true,prev2),
      it('income','Side income',0,false,null,o(250,180,0)),
      it('bill','Rent',1050,true,prev2),
      it('bill','Electricity & water',120,true,prev2,o(138.5,112,120)),
      it('bill','Internet',45,true,prev2),
      it('bill','Phone',30,true,prev2),
      it('bill','Streaming',15,true,prev2),
      it('spend','Groceries',0,false,null,o(410,385,372)),
      it('spend','Transport',0,false,null,o(92,88,95)),
      it('spend','Eating out',0,false,null,o(120,140,90)),
      it('saving','Emergency fund',200,true,prev2)
    ],
    loans:[
      {id:uid(),name:'Car loan',pay:285,term:36,first:add(now,-6)},
      {id:uid(),name:'Phone installment',pay:75,term:12,first:add(now,-3)}
    ]};
}
function blank(){return {v:1,paidMig:true,billsFrom:ymNow(),currency:'₱',carry:false,startMonth:ymNow(),opening:0,sample:false,updatedAt:0,items:[],loans:[],budgets:{overall:0,categories:{}}}}

/* ---------- state ---------- */
var state=null, cur=ymNow(), openId=null, showSettings=false, confirmAct=null, statusText='Saved on this device';
function sane(s){
  if(!s||typeof s!=='object'||!Array.isArray(s.items)||!Array.isArray(s.loans))return null;
  s.items=s.items.filter(function(i){return i&&typeof i==='object'}).map(function(i){
    return {id:cid(i.id),kind:['income','bill','spend','saving','card'].indexOf(i.kind)>=0?i.kind:'spend',name:String(i.name||''),
      usual:num(i.usual),repeat:!!i.repeat,start:validYM(i.start)?i.start:null,end:validYM(i.end)?i.end:null,over:(i.over&&typeof i.over==='object')?i.over:{},due:Math.max(0,Math.min(31,Math.round(num(i.due))||0)),paid:(i.paid&&typeof i.paid==='object')?i.paid:{},ts:tsNum(i.ts)}});
  s.loans=s.loans.filter(function(l){return l&&typeof l==='object'}).map(function(l){
    return {id:cid(l.id),name:String(l.name||''),pay:num(l.pay),term:Math.max(1,Math.round(num(l.term))||1),first:validYM(l.first)?l.first:ymNow(),due:Math.max(0,Math.min(31,Math.round(num(l.due))||0)),paid:(l.paid&&typeof l.paid==='object')?l.paid:{},ts:tsNum(l.ts)}});
  /* items saved before v9.28 have no change date: borrow the newest entry from the activity log */
  if(Array.isArray(s.txlog)){var lastTs={};s.txlog.forEach(function(x){if(x&&typeof x==='object'&&typeof x.ref==='string'){var t=tsNum(x.ts);if(t>(lastTs[x.ref]||0))lastTs[x.ref]=t}});s.items.concat(s.loans).forEach(function(o){if(!o.ts&&lastTs[o.id])o.ts=lastTs[o.id]})}
  s.currency=typeof s.currency==='string'&&s.currency.length<=4?s.currency:'₱';
  s.carry=!!s.carry; s.opening=num(s.opening); s.startMonth=validYM(s.startMonth)?s.startMonth:ymNow();
  var col={};if(s.collapsed&&typeof s.collapsed==='object'){['income','bill','spend','saving','card','loan','collect'].forEach(function(k){if(s.collapsed[k])col[k]=true})}s.collapsed=col;
  s.sample=!!s.sample; s.updatedAt=tsNum(s.updatedAt); s.v=1; s.theme=themeOk(s.theme)?s.theme:null;
  s.remind=(s.remind==null||s.remind==='')?3:Math.max(0,Math.min(30,Math.round(num(s.remind))||0));
  s.budgets=s.budgets&&typeof s.budgets==='object'?s.budgets:{overall:0,categories:{}};s.budgets.overall=Math.max(0,num(s.budgets.overall));s.budgets.categories=s.budgets.categories&&typeof s.budgets.categories==='object'?s.budgets.categories:{};
  var im={};if(s.importMap&&typeof s.importMap==='object'){Object.keys(s.importMap).slice(0,300).forEach(function(k){var v=s.importMap[k];if(typeof v==='string'&&v.length<40)im[String(k).slice(0,80)]=v})}s.importMap=im;s.collect=cleanCL(s.collect);s.grocery=cleanGR(s.grocery);
  s.txns=cleanTx(s.txns);s.txlog=cleanLog(s.txlog);s.notebook=cleanNB(s.notebook);
  s.goal=(s.goal&&typeof s.goal==='object')?{target:Math.max(0,num(s.goal.target)),months:Math.max(1,Math.min(600,Math.round(num(s.goal.months))||6))}:{target:0,months:6};
  Object.keys(s.budgets.categories).forEach(function(k){s.budgets.categories[k]=Math.max(0,num(s.budgets.categories[k]))});
  /* v9.28 one-time migration: before this version every card and loan payment was always counted. "Paid only" now applies from the current month on, so every earlier month is marked paid and keeps its old numbers. */
  if(!s.paidMig){
    var lastM=add(ymNow(),-1),nM=Math.min(240,idx(lastM)-idx(s.startMonth)+1);
    for(var mk=0;mk<nM;mk++){
      var mm=add(lastM,-mk);
      s.items.forEach(function(it){if(it.kind==='card'&&itemVal(it,mm)>0){if(!it.paid)it.paid={};it.paid[mm]=true}});
      s.loans.forEach(function(l){var ln=idx(mm)-idx(l.first)+1;if(l.pay>0&&ln>=1&&ln<=l.term){if(!l.paid)l.paid={};l.paid[mm]=true}});
    }
    s.paidMig=true;
  }
  s.paidMig=!!s.paidMig;
  /* v9.31: "Mark paid" for bills starts in the month this version is first opened. Every earlier month counts as paid, so old balances do not change. */
  s.billsFrom=validYM(s.billsFrom)?s.billsFrom:ymNow();
  return s;
}
function loadLocal(){var t=null;try{t=localStorage.getItem(KEY);if(t){var s=sane(JSON.parse(t));if(s)return s}}catch(e){}if(t)lsSet(KEY+'.corrupt',t);return null}
var saveTimer=null, dbDoc=null;
var gPushTimer=null;
function save(){
  state.updatedAt=Date.now();lsSet('mbm.gdirty','1');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(function(){
    saveTimer=null;
    var json=JSON.stringify(state),ok=true;
    try{localStorage.setItem(KEY,json)}catch(e){ok=false;setStatus('Not saved on this device: the browser blocked storage. Download a backup from Settings.')}
    if(ok){clearTimeout(gPushTimer);gPushTimer=setTimeout(function(){gPush(JSON.stringify(state))},2500)}
    if(dbDoc){dbDoc.set({json:json,updatedAt:state.updatedAt}).then(function(){setStatus('Saved to your account')},function(){setStatus('Saved on this device')})}
  },500);
}
function flushSave(){
  if(!saveTimer)return;
  clearTimeout(saveTimer);saveTimer=null;
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}
}
window.addEventListener('pagehide',flushSave);
(function(){var t=document.querySelector('.top');if(!t)return;function setH(){document.documentElement.style.setProperty('--topH',Math.round(t.getBoundingClientRect().height)+'px')}setH();if(window.ResizeObserver)new ResizeObserver(setH).observe(t);window.addEventListener('resize',setH)})();
var lastYM=ymNow();
function dayCheck(){var n=ymNow();if(n!==lastYM){var wasNow=(cur===lastYM);lastYM=n;if(wasNow)cur=n;if(state){if(saveTimer){clearTimeout(saveTimer);saveTimer=null;try{localStorage.setItem(KEY,JSON.stringify(state))}catch(x){}}renderAll()}}}
setInterval(dayCheck,60000);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')dayCheck()});
/* ---------- other tab changed the budget ---------- */
var staleTab=false;
function staleBanner(){return staleTab?'<div class="notice" role="alert"><p><b>Your budget was changed in another tab or window.</b> Reload to see the latest changes. Anything here that is not saved yet will be replaced.</p><div class="acts"><button class="tbtn primary" data-act="reloadtab">Reload latest</button></div></div>':''}
function adoptStored(){var s=loadLocal();if(!s)return false;clearTimeout(saveTimer);saveTimer=null;state=s;openId=null;confirmAct=null;staleTab=false;renderAll();return true}
window.addEventListener('storage',function(ev){
  if(ev.storageArea!==localStorage||ev.key!==KEY||!ev.newValue||!state)return;
  var a=document.activeElement,editing=!!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)),dlg=document.querySelector('dialog[open]');
  if(!saveTimer&&!editing&&!dlg){if(adoptStored())return}
  staleTab=true;renderNotice();
});
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')flushSave()});
function setStatus(t){statusText=t;var f=document.getElementById('foot');if(f)f.textContent=t+' · Your budget stays private to you. · version 9.39.1'}

