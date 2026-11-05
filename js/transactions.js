/* Easy Budget Tracker: ledger, activity log and Transactions page.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ===== v9.6: Transactions, Reports, dashboard cards, mobile tab bar ===== */
var KIND_LABEL={income:'Income',bill:'Bills',spend:'Spending',saving:'Savings',card:'Credit cards',loan:'Loans',collect:'Collectibles',back:'Collected back'};
var KIND_COLOR={income:'--pos',bill:'--c-bills',spend:'--c-spend',saving:'--c-save',card:'--c-card',loan:'--c-loan',collect:'--c-collect',back:'--c-back'};
var KORDER=['income','back','bill','spend','saving','card','loan','collect'];
var TX_KINDS=['income','bill','spend','saving','card','loan'];
var IC={
  income:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  bill:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  spend:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 001 .8h8.9a1 1 0 001-.8L20 7H6"/>',
  saving:'<path d="M12 2v20M17 6.5C16 5.3 14.2 5 12.5 5 10 5 8 6.1 8 8s1.7 2.6 4.5 3.2S17 12.4 17 14.4 15 18 12.5 18c-2 0-3.8-.5-4.8-1.8"/>',
  inArrow:'<path d="M17 7L7 17M7 17h8M7 17V9"/>',
  outArrow:'<path d="M7 17L17 7M17 7H9M17 7v8"/>'
};
function ico(p){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>'}
function fmt0(n){var r=Math.round(Math.abs(n));return (n<0&&r>0?'−':'')+esc(state.currency)+r.toLocaleString('en-US')}

/* ---------- ledger: every entry of a month, in one list ---------- */
function txMonth(m){return (state.txns||[]).filter(function(x){return !x.void&&x.date.slice(0,7)===m})}
function cleanTx(a){
  if(!Array.isArray(a))return [];
  var out=[];
  a.slice(0,5000).forEach(function(x){
    if(!x||typeof x!=='object'||!isoValid(x.date))return;
    var amt=Math.round(num(x.amount)*100)/100;if(!(amt>0))return;
    out.push({id:cid(x.id),date:x.date,ts:tsNum(x.ts),kind:TX_KINDS.indexOf(x.kind)>=0?x.kind:'spend',name:String(x.name||'').slice(0,80),amount:amt,void:!!x.void,vts:tsNum(x.vts)});
  });
  return out;
}
function ledger(m){
  var out=[],dim=daysIn(+m.slice(0,4),+m.slice(5));
  function put(o){o.m=m;out.push(o)}
  state.items.forEach(function(it){
    var v=itemVal(it,m);if(!(v>0))return;
    var tr=needsPaid(it,m);
    if(tr&&!(it.paid&&it.paid[m]))return; /* unpaid cards and bills are not money out yet */
    var note=it.kind==='card'?(it.due?'Due on the '+ord(it.due):''):(it.repeat?'Every month':'');
    if(it.kind==='bill'&&it.due)note+=(note?' · ':'')+'Due on the '+ord(it.due);
    if(tr&&it.paid&&it.paid[m])note+=(note?' · ':'')+'Paid';
    put({k:it.kind,name:it.name||'Untitled',amt:v,sign:it.kind==='income'?1:-1,note:note,day:(payKind(it.kind)&&it.due)?Math.min(it.due,dim):0,src:'plan'});
  });
  state.loans.forEach(function(l){
    var v=loanVal(l,m);if(!(v>0)||!(l.paid&&l.paid[m]))return;
    put({k:'loan',name:l.name||'Untitled',amt:v,sign:-1,note:'Payment '+loanN(l,m)+' of '+l.term,day:0,src:'plan'});
  });
  CLd().forEach(function(c){
    var s=clOut(c,m);
    if(s>0)put({k:'collect',name:c.name||'Untitled',amt:s,sign:-1,note:'Lent out · payment '+(idx(m)-idx(c.first)+1)+' of '+c.term,day:c.due>0?Math.min(c.due,dim):0,src:'plan'});
    if(idx(m)>=idx(state.startMonth))Object.keys(c.paid||{}).forEach(function(k){
      var p=c.paid[k];
      if(p&&p.d&&p.d.slice(0,7)===m&&clSched(c,k)>0&&idx(m)>idx(k))put({k:'back',name:c.name||'Untitled',amt:c.pay,sign:1,note:'Collected back',date:p.d,src:'plan'});
    });
  });
  txMonth(m).forEach(function(x){
    put({k:x.kind,name:x.name||KIND_LABEL[x.kind],amt:x.amount,sign:x.kind==='income'?1:-1,note:'Logged by you',date:x.date,src:'manual',id:x.id});
  });
  return out;
}
function sortLedger(a){
  return a.slice().sort(function(x,y){
    var dx=x.date||'',dy=y.date||'';
    if(dx&&dy&&dx!==dy)return dx<dy?1:-1;
    if(!!dx!==!!dy)return dx?-1:1;
    var d=KORDER.indexOf(x.k)-KORDER.indexOf(y.k);
    return d||(y.amt-x.amt)||String(x.name).localeCompare(String(y.name));
  });
}
function dLabel(e){
  if(e.date)return isoShort(e.date);
  if(e.day)return MONTHS[+e.m.slice(5)-1]+' '+e.day;
  return 'Monthly';
}
function cleanLog(a){
  if(!Array.isArray(a))return [];
  var out=[];
  a.slice(-5000).forEach(function(x){
    if(!x||typeof x!=='object'||!isoValid(x.date)||!validYM(x.m))return;
    var amt=Math.round(num(x.amount)*100)/100;if(!(amt>=0))return;
    var act=['added','edited','renamed','removed'].indexOf(x.act)>=0?x.act:'added';
    if((act==='added'||act==='removed')&&!x.via&&(!String(x.name||'').trim()||String(x.name).trim()==='Untitled')&&amt===0)return; /* v9.32: no history for an item with neither a name nor an amount */
    out.push({id:cid(x.id),ref:cid(x.ref),date:x.date,ts:tsNum(x.ts),m:x.m,kind:['income','bill','spend','saving','card','loan','collect'].indexOf(x.kind)>=0?x.kind:'spend',name:String(x.name||'Untitled').slice(0,80),amount:amt,act:act,from:act==='renamed'?String(x.from||'').slice(0,80):Math.max(0,num(x.from)),via:x.via==='tx'?'tx':'',void:!!x.void,vts:tsNum(x.vts),undo:(x.undo&&typeof x.undo==='object')?{had:!!x.undo.had,prev:num(x.undo.prev),after:num(x.undo.after)}:undefined});
  });
  return out;
}
/* Activity log: one entry per action. Typing digits in one amount box is one action (BURST window). */
var BURST=20000;
function logList(){if(!Array.isArray(state.txlog))state.txlog=[];return state.txlog}
function logPush(o){
  var L=logList(),now=Date.now();
  o.id=uid();o.ts=now;if(!o.date)o.date=isoToday();o.name=o.name||'Untitled';o.via=o.via||'';o.void=false;o.vts=0;
  L.push(o);if(L.length>5000)state.txlog=L.slice(-5000);
}
function logAdd(ref,kind,name,m){if(!String(name||'').trim())return;logPush({ref:ref,kind:kind,m:m,name:name,amount:0,act:'added',from:0})}
function logAmt(ref,kind,name,m,before,after){
  var L=logList(),now=Date.now(),b=Math.round(before*100)/100,a=Math.round(after*100)/100;
  var mine=L.filter(function(x){return x.ref===ref&&x.m===m&&x.act!=='renamed'&&x.act!=='removed'&&!x.via&&!x.void});
  var last=mine[mine.length-1];
  if(last){
    if(last.act==='added'&&last.amount===0){last.amount=a;last.ts=now;if(name)last.name=name;return}
    if(now-last.ts<=BURST){
      last.ts=now;if(name)last.name=name;
      if(last.act==='edited'&&Math.abs(a-last.from)<0.005){state.txlog=L.filter(function(x){return x!==last});return}
      last.amount=a;return;
    }
  }
  if(Math.abs(a-b)<0.005)return;
  logPush({ref:ref,kind:kind,m:m,name:name,amount:a,act:b>0?'edited':'added',from:b});
}
function logRename(ref,kind,m,oldName,newName,amount){
  var L=logList(),nn=newName||'Untitled';
  if(!(oldName||'').trim()){var had=false;L.forEach(function(x){if(x.ref===ref&&x.act!=='renamed'){x.name=nn;had=true}});if(!had&&String(newName||'').trim())logPush({ref:ref,kind:kind,m:m,name:nn,amount:Math.round(amount*100)/100,act:'added',from:0});return}
  if((oldName||'')===(newName||''))return;
  logPush({ref:ref,kind:kind,m:m,name:nn,amount:Math.round(amount*100)/100,act:'renamed',from:oldName||'Untitled'});
}
function logRemove(ref,kind,name,amount,m){
  var now=Date.now();
  var meaningful=String(name||'').trim()||amount>0||logList().some(function(x){return x.ref===ref&&(x.amount>0||(x.name&&x.name!=='Untitled'))});
  if(!meaningful){state.txlog=logList().filter(function(x){return x.ref!==ref});return}
  logList().forEach(function(x){if(x.ref===ref&&!x.void){x.void=true;x.vts=now}});
  logPush({ref:ref,kind:kind,m:m,name:name,amount:Math.round(amount*100)/100,act:'removed',from:0});
}
function timeLbl(ts){if(!ts)return '';try{return new Date(ts).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch(e){return ''}}
function histNote(l){
  var mo=short(l.m);
  if(l.kind==='collect'&&l.via!=='tx'){
    if(l.act==='added')return 'New collectible'+(l.amount>0?'':' (no amount yet)');
    if(l.act==='edited')return l.amount>0?'Monthly amount changed from '+fmt(l.from):'Monthly amount cleared (was '+fmt(l.from)+')';
  }
  if(l.act==='added')return l.via==='tx'?'Added to '+KIND_LABEL[l.kind]+' · '+mo:(l.amount>0?'New entry for '+mo:'New blank entry for '+mo);
  if(l.act==='edited'){
    if(l.via==='tx')return 'Added to existing item (was '+fmt(l.from)+') · '+mo;
    return l.amount>0?'Amount changed from '+fmt(l.from)+' for '+mo:'Amount cleared (was '+fmt(l.from)+') for '+mo;
  }
  if(l.act==='removed')return 'Removed from '+KIND_LABEL[l.kind]+' · '+mo;
  return 'Renamed from '+l.from+' · '+mo;
}
function histEntries(){
  var out=[];
  (state.txns||[]).forEach(function(x){out.push({k:x.kind,name:x.name||KIND_LABEL[x.kind],amt:x.amount,sign:x.kind==='income'?1:-1,date:x.date,ts:x.ts||0,src:'manual',id:x.id,m:x.date.slice(0,7),note:'Logged by you',v:!!x.void,vts:x.vts||0})});
  (state.txlog||[]).forEach(function(l){
    var sg=l.kind==='income'?1:-1;
    out.push({k:l.kind,name:l.name,amt:l.amount,sign:sg,date:l.date,ts:l.ts||0,src:'log',id:l.id,m:l.m,note:histNote(l),v:!!l.void,vts:l.vts||0,act:l.act,via:l.via||''});
  });
  CLd().forEach(function(c){Object.keys(c.paid||{}).forEach(function(k){
    var q=c.paid[k];
    if(q&&q.d&&idx(q.d.slice(0,7))>=idx(state.startMonth))out.push({k:'back',name:c.name||'Untitled',amt:c.pay,sign:1,date:q.d,ts:0,src:'plan',id:'cb'+c.id+k,m:q.d.slice(0,7),note:'Collected back · not income'});
  })});
  return out;
}
function sortHist(a){return a.slice().sort(function(x,y){return x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0)})}
function histMonths(){var seen={},arr=[];histEntries().forEach(function(e){var m=e.date.slice(0,7);if(!seen[m]){seen[m]=1;arr.push(m)}});arr.sort().reverse();return arr}
/* ---------- Transactions page ---------- */
var txFilter='all',txPeriod='all',txQuery='',txForm=false,txOpen=null,txSure=null,txMsg='',txConflict=null;
var txDraft={dir:'out',amt:'',date:'',kind:'spend',name:''};
var TX_FILTERS=[['all','All'],['in','Money in'],['bill','Bills'],['spend','Spending'],['saving','Savings'],['debt','Cards & loans'],['collect','Collectibles']];
function txKeep(e){
  var f=txFilter;
  if(f==='in'&&e.sign<0)return false;
  if(f==='bill'&&e.k!=='bill')return false;
  if(f==='spend'&&e.k!=='spend')return false;
  if(f==='saving'&&e.k!=='saving')return false;
  if(f==='debt'&&e.k!=='card'&&e.k!=='loan')return false;
  if(f==='collect'&&e.k!=='collect'&&e.k!=='back')return false;
  var q=txQuery.trim().toLowerCase();
  if(q&&(e.name+' '+KIND_LABEL[e.k]+' '+e.note).toLowerCase().indexOf(q)<0)return false;
  return true;
}
function txMonths(){
  var all=histMonths(),now=ymNow();
  if(txPeriod==='all')return all;
  if(txPeriod==='sel')return [cur];
  if(txPeriod==='3m')return all.filter(function(m){return idx(m)>=idx(now)-2&&idx(m)<=idx(now)});
  if(txPeriod.indexOf('y:')===0)return all.filter(function(m){return m.slice(0,4)===txPeriod.slice(2)});
  return all;
}
function txPeriodHTML(){
  var years={};histMonths().forEach(function(m){years[m.slice(0,4)]=1});
  var h='<option value="all"'+(txPeriod==='all'?' selected':'')+'>All history</option><option value="sel"'+(txPeriod==='sel'?' selected':'')+'>'+esc(label(cur))+'</option><option value="3m"'+(txPeriod==='3m'?' selected':'')+'>Last 3 months</option>';
  Object.keys(years).sort().reverse().forEach(function(y){h+='<option value="y:'+y+'"'+(txPeriod==='y:'+y?' selected':'')+'>Year '+y+'</option>'});
  return h;
}
/* v9.29: rows written when you change an amount or name on the Budget page are history, not transactions: they are listed but never added up */
function isBudgetChange(e){return e.src==='log'&&e.via!=='tx'}
function txEntryHTML(e){
  var bc=isBudgetChange(e),cls=bc?'chg':(e.sign>0?'in':'out'),open=e.src==='manual'&&!e.v&&txOpen===e.id,tm=timeLbl(e.ts);
  var sub=(bc?'Budget change · ':'')+dLabel(e)+(tm?' · '+tm:'')+' · '+KIND_LABEL[e.k]+(e.note?' · '+e.note:'')+(e.v?' · Removed'+(e.vts?' at '+timeLbl(e.vts):''):'');
  var canOpen=e.src==='manual'&&!e.v;
  var main='<div class="tx-ico" style="--ic:var('+KIND_COLOR[e.k]+')">'+ico(e.sign>0?IC.inArrow:IC.outArrow)+'</div>'+
    '<div class="tx-body"><div class="tx-name">'+esc(e.name)+'</div><div class="tx-sub">'+esc(sub)+'</div></div>'+
    '<div class="tx-amt num '+cls+'">'+(bc?'':(e.sign>0?'+':'−'))+fmt(e.amt)+'</div>'+(canOpen?'<span class="tx-chev" aria-hidden="true">'+(open?'▴':'▾')+'</span>':'');
  var sure=txSure===e.id;
  var xb=e.src==='plan'?'':(e.v?'<button type="button" class="tx-x undo" data-tx="undo" data-id="'+esc(e.id)+'" aria-label="Undo remove '+esc(e.name)+'" title="Undo">↶ Undo</button>':'<button type="button" class="tx-x" data-tx="void" data-id="'+esc(e.id)+'" aria-label="Remove '+esc(e.name)+'" title="Remove">✕</button>');
  var h='<li class="txr'+(e.v?' void':'')+(bc?' bchg':'')+'"><div class="txrow">'+(canOpen?'<button type="button" class="txmain" data-tx="open" data-id="'+esc(e.id)+'" aria-expanded="'+open+'">'+main+'</button>':'<div class="txmain">'+main+'</div>')+xb+'</div>';
  if(open){
    var x=(state.txns||[]).filter(function(t){return t.id===e.id})[0];
    if(x){
      h+='<div class="tx-edit"><label class="pg-f">Description<input data-txf="name" data-id="'+esc(x.id)+'" value="'+esc(x.name)+'" maxlength="80"></label>'+
        '<label class="pg-f">Amount<input data-txf="amount" data-id="'+esc(x.id)+'" type="text" inputmode="decimal" value="'+x.amount+'"></label>'+
        '<label class="pg-f">Date<input data-txf="date" data-id="'+esc(x.id)+'" type="date" value="'+x.date+'"></label>'+
        '<label class="pg-f">Category<select data-txf="kind" data-id="'+esc(x.id)+'">'+TX_KINDS.map(function(k){return '<option value="'+k+'"'+(k===x.kind?' selected':'')+'>'+KIND_LABEL[k]+'</option>'}).join('')+'</select></label>'+
        '<div class="acts"><button type="button" class="linkbtn danger" data-tx="void" data-id="'+esc(x.id)+'">'+'Remove'+'</button><button type="button" class="linkbtn" data-tx="open" data-id="'+esc(x.id)+'">Done</button></div></div>';
    }
  }
  return h+'</li>';
}
function renderTxList(){
  var months=txMonths(),by={},inS=0,outS=0,h='',shown=0,openAll=txQuery.trim()!==''||txPeriod!=='all';
  sortHist(histEntries().filter(txKeep)).forEach(function(e){var m=e.date.slice(0,7);(by[m]=by[m]||[]).push(e)});
  months.forEach(function(m){
    var rows=by[m];if(!rows||!rows.length)return;
    var mi=0,mo=0;rows.forEach(function(e){if((e.src==='log'&&e.via!=='tx')||e.v||e.k==='back')return;if(e.sign>0)mi+=e.amt;else mo+=e.amt});
    inS+=mi;outS+=mo;
    var net=mi-mo;shown++;
    var nb=rows.filter(isBudgetChange).length,nl=rows.length-nb,cnt=(nl?nl+' logged':'')+(nb?(nl?' · ':'')+nb+(nb===1?' budget change':' budget changes'):'');
    h+='<details class="txm"'+((openAll||shown<=3)?' open':'')+'><summary><span class="mh">'+esc(label(m))+'</span><span class="status">'+cnt+'</span><span class="mn '+(net>=0?'in':'out')+'" title="Net of logged transactions only">'+(net>=0?'+':'−')+fmt(Math.abs(net))+'</span></summary><ul class="txl">'+rows.map(txEntryHTML).join('')+'</ul></details>';
  });
  if(!h)h='<p class="pg-empty">'+(txQuery||txFilter!=='all'||txPeriod!=='all'?'No transactions match these filters.':'No transactions yet. When you add an entry or change an amount or name, it shows up here.')+'</p>';
  $('txList').innerHTML=h;
  var net=inS-outS;
  function tile(l,c,sg,v){return '<div class="tx-stat"><span>'+l+'</span><b class="num '+c+'" data-full="'+sg+fmt(v)+'" data-short="'+sg+shortAmt(v)+'">'+sg+fmt(v)+'</b></div>'}
  $('txSum').innerHTML=tile('Money in','in','+',inS)+tile('Money out','out','−',outS)+tile('Net',net>=0?'in':'out',net>=0?'+':'−',Math.abs(net));
  fitTxSum();
}
/* short form like ₱12.3M, used only when the full amount would need text smaller than 10px */
function shortAmt(n){
  var a=Math.abs(n),U=[[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'k']],i,v,t;
  if(a<1e3)return esc(state.currency)+a.toFixed(2);
  for(i=0;i<U.length;i++){if(a>=U[i][0]||i===U.length-1){
    v=a/U[i][0];t=v<10?v.toFixed(2):v.toFixed(1);
    if(parseFloat(t)>=1000&&i>0){i--;v=a/U[i][0];t=v<10?v.toFixed(2):v.toFixed(1)}
    return esc(state.currency)+t+U[i][1];
  }}
}
/* shrink the three summary amounts together until the longest fits inside its tile; if it still can't at 10px, show the short form for that tile */
function fitTxSum(){
  var bs=[].slice.call(document.querySelectorAll('#txSum .tx-stat b'));if(!bs.length)return;
  bs.forEach(function(b){b.textContent=b.getAttribute('data-full');b.style.fontSize='';b.removeAttribute('title');b.removeAttribute('aria-label')});
  var base=parseFloat(getComputedStyle(bs[0]).fontSize)||16,fs=base;
  function shrink(b){var f=base;b.style.fontSize=f+'px';while(b.scrollWidth>b.clientWidth+0.5&&f>10){f-=0.5;b.style.fontSize=f+'px'}return f}
  bs.forEach(function(b){
    var f=shrink(b);
    if(b.scrollWidth>b.clientWidth+0.5){b.textContent=b.getAttribute('data-short');b.title=b.getAttribute('data-full');b.setAttribute('aria-label',b.getAttribute('data-full'));f=shrink(b)}
    if(f<fs)fs=f;
  });
  bs.forEach(function(b){b.style.fontSize=fs+'px'});
}
window.addEventListener('resize',function(){if($('txSum'))fitTxSum()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if($('txSum'))fitTxSum()});
function txFormHTML(){
  var d=txDraft,out=d.dir==='out';
  if(!d.date)d.date=isoToday();
  return '<form class="pg-add tx-form" id="txForm" autocomplete="off"><div class="seg" role="group" aria-label="Type"><button type="button" class="in'+(out?'':' on')+'" data-tx="dir" data-dir="in" aria-pressed="'+!out+'">Money in</button><button type="button" class="out'+(out?' on':'')+'" data-tx="dir" data-dir="out" aria-pressed="'+out+'">Money out</button></div>'+
    '<div class="pg-addrow"><label class="pg-f grow">Amount<input id="txAmt" type="text" inputmode="decimal" placeholder="0.00" value="'+esc(d.amt)+'"></label>'+
    '<label class="pg-f grow">Date<input id="txDate" type="date" value="'+esc(d.date)+'"></label></div>'+
    '<div class="pg-addrow">'+(out?'<label class="pg-f grow">Category<select id="txKind">'+TX_KINDS.filter(function(k){return k!=='income'}).map(function(k){return '<option value="'+k+'"'+(d.kind===k?' selected':'')+'>'+KIND_LABEL[k]+'</option>'}).join('')+'</select></label>':'')+
    '<label class="pg-f grow">Description<input id="txName" maxlength="80" placeholder="'+(out?'For example: Jollibee lunch':'For example: Bonus')+'" value="'+esc(d.name)+'"></label></div>'+
    (txConflict?'<div class="tx-conf" role="alert"><b>“'+esc(txConflict.name)+'” is already in '+esc(KIND_LABEL[txConflict.kind])+'.</b> Add '+fmt(txConflict.amt)+' to that item, or rename this one?<div class="srow"><button type="button" class="tbtn primary" data-tx="cadd">Add to existing</button><button type="button" class="tbtn" data-tx="cren">Rename</button><button type="button" class="tbtn" data-tx="ccancel">Cancel</button></div></div>':'<div class="srow"><button type="submit" class="tbtn primary" data-tx="add">Add transaction</button><button type="button" class="tbtn" data-tx="form">Close</button><span class="tx-msg" role="status">'+esc(txMsg)+'</span></div>')+
    '<div class="status">A transaction is added to the item with the same name in that category, or creates a new item there. It counts toward that month in your balance and reports.</div></form>';
}
function renderTx(){
  var el=$('pgTx');if(!el)return;
  var h='<header class="pg-head"><div class="pg-eye">History</div><h2>Transactions</h2></header>'+
    '<div class="pg-lbl tx-cap">Logged transactions</div><div class="tx-sum" id="txSum"></div><div class="status tx-capn">Totals add up only what you log with Add transaction. Budget changes are listed below for history and are not counted.</div>'+
    '<div class="tx-tools"><input class="pg-in" id="txSearch" type="search" placeholder="Search transactions" value="'+esc(txQuery)+'" aria-label="Search transactions"><select class="pg-in" id="txPeriod" aria-label="Period">'+txPeriodHTML()+'</select><button type="button" class="tbtn primary" data-tx="form">'+(txForm?'Close form':'+ Add transaction')+'</button></div>'+
    '<div class="pg-filters" role="group" aria-label="Filter">'+TX_FILTERS.map(function(f){return '<button type="button" class="tbtn'+(txFilter===f[0]?' on':'')+'" data-tx="filter" data-f="'+f[0]+'" aria-pressed="'+(txFilter===f[0])+'">'+f[1]+'</button>'}).join('')+'</div>'+
    (txForm?txFormHTML():'')+'<div id="txList"></div>';
  el.innerHTML=h;renderTxList();
}
function txReadDraft(){
  var a=$('txAmt');if(!a)return;
  txDraft.amt=a.value;txDraft.date=$('txDate').value;txDraft.name=$('txName').value;
  if($('txKind'))txDraft.kind=$('txKind').value;
}
function txAfterChange(){save();renderTx();renderSections();refresh();renderNotice();renderRecent();renderKpis()}
document.addEventListener('click',function(ev){
  var b=ev.target.closest&&ev.target.closest('[data-tx]');if(!b)return;
  var a=b.getAttribute('data-tx'),id=b.getAttribute('data-id');
  if(a==='filter'){txFilter=b.getAttribute('data-f');renderTx()}
  else if(a==='form'){txReadDraft();txForm=!txForm;txMsg='';txConflict=null;renderTx();if(txForm)focusSoon('#txAmt')}
  else if(a==='dir'){txReadDraft();txDraft.dir=b.getAttribute('data-dir');if(txDraft.dir==='in')txDraft.kind='income';else if(txDraft.kind==='income')txDraft.kind='spend';txMsg='';txConflict=null;renderTx()}
  else if(a==='open'){txOpen=(txOpen===id?null:id);txSure=null;renderTxList()}
  else if(a==='void'){txSure=null;txOpen=null;txVoid(id);txAfterChange();focusSoon('[data-tx="undo"][data-id="'+id+'"]')}
  else if(a==='undo'){txRestore(id);txAfterChange();focusSoon('[data-tx="void"][data-id="'+id+'"]')}
  else if(a==='cadd'&&txConflict){var cc=txConflict;txConflict=null;txCommit(cc,true)}
  else if(a==='cren'){txConflict=null;renderTx();focusSoon('#txName')}
  else if(a==='ccancel'){txConflict=null;renderTx()}
});
function txVoid(id){
  var now=Date.now(),x=(state.txns||[]).filter(function(t){return t.id===id})[0];
  if(x){x.void=true;x.vts=now;return}
  var l=logList().filter(function(t){return t.id===id})[0];
  if(!l||l.void)return;
  if(l.via==='tx'){
    var it=findItem(l.ref);
    if(it){
      var had=Object.prototype.hasOwnProperty.call(it.over,l.m),prev=it.over[l.m];
      it.over[l.m]=Math.max(0,Math.round((itemVal(it,l.m)-l.amount)*100)/100);
      l.undo={had:had,prev:prev,after:it.over[l.m]};
    }
  }
  l.void=true;l.vts=now;
}
function txRestore(id){
  var x=(state.txns||[]).filter(function(t){return t.id===id})[0];
  if(x){if(!x.void)return;x.void=false;x.vts=0;return}
  var l=logList().filter(function(t){return t.id===id})[0];
  if(!l||!l.void)return;
  if(l.via==='tx'){
    var it=findItem(l.ref),u=l.undo;
    if(!it){it={id:l.ref,kind:l.kind,name:l.name,usual:0,repeat:false,start:l.m,over:{}};it.over[l.m]=l.amount;state.items.push(it)}
    else if(u&&Math.abs(itemVal(it,l.m)-u.after)<0.005){if(u.had)it.over[l.m]=u.prev;else delete it.over[l.m]}
    else{it.over[l.m]=Math.round((itemVal(it,l.m)+l.amount)*100)/100}
  }
  l.void=false;l.vts=0;delete l.undo;
}
function txCommit(c,toExisting){
  var ym=c.date.slice(0,7),it=toExisting?findItem(c.match):null,before=0;
  if(it){before=itemVal(it,ym);it.over[ym]=Math.round((before+c.amt)*100)/100}
  else{it={id:uid(),kind:c.kind,name:c.name,usual:0,repeat:false,start:ym,over:{}};it.over[ym]=c.amt;state.items.push(it)}
  logPush({ref:it.id,kind:c.kind,m:ym,date:c.date,name:it.name||KIND_LABEL[c.kind],amount:c.amt,act:before>0?'edited':'added',from:before,via:'tx'});
  state.sample=false;
  txDraft.amt='';txDraft.name='';txMsg='Added '+(c.dir==='in'?'+':'−')+fmt(c.amt)+' to '+KIND_LABEL[c.kind]+(it.name?' › '+it.name:'')+'.';
  txAfterChange();focusSoon('#txAmt');
}
document.addEventListener('submit',function(ev){
  if(ev.target.id!=='txForm')return;
  ev.preventDefault();txReadDraft();
  var d=txDraft,amt=Math.round(num(d.amt)*100)/100;
  if(amtBadChars(d.amt)){txMsg='Amounts can only contain numbers, for example 1,250.50.';renderTx();focusSoon('#txAmt');return}
  if(!(amt>0)){txMsg='Enter an amount greater than zero.';renderTx();focusSoon('#txAmt');return}
  if(amt>=AMT_MAX){txMsg='That amount is too large. The most you can enter is '+fmt(AMT_MAX-0.01)+'.';renderTx();focusSoon('#txAmt');return}
  if(!isoValid(d.date)){txMsg='Pick a valid date.';renderTx();return}
  var dy=+d.date.slice(0,4),ny=new Date().getFullYear();if(dy<ny-30||dy>ny+5){txMsg='That date looks like a typo. Pick a date between '+(ny-30)+' and '+(ny+5)+'.';renderTx();return}
  var kind=d.dir==='in'?'income':(d.kind==='income'?'spend':d.kind),nm=d.name.trim().slice(0,80);
  if(kind==='loan'){
    if(!Array.isArray(state.txns))state.txns=[];
    state.txns.push({id:uid(),ts:Date.now(),date:d.date,kind:kind,name:nm,amount:amt});
    state.sample=false;txDraft.amt='';txDraft.name='';txMsg='Added −'+fmt(amt)+' on '+isoShort(d.date)+'.';
    txAfterChange();focusSoon('#txAmt');return;
  }
  var match=nm?state.items.filter(function(i){return i.kind===kind&&!itemEnded(i,d.date.slice(0,7))&&i.name.trim().toLowerCase()===nm.toLowerCase()})[0]:null;
  var c={kind:kind,name:nm,amt:amt,date:d.date,dir:d.dir,match:match?match.id:null};
  if(match){txConflict=c;txMsg='';renderTx();return}
  txCommit(c,false);
});
document.addEventListener('input',function(ev){
  if(ev.target.id==='txSearch'){txQuery=ev.target.value;renderTxList()}
});
document.addEventListener('change',function(ev){
  var e=ev.target;
  if(e.id==='txPeriod'){txPeriod=e.value;renderTxList();return}
  var f=e.getAttribute&&e.getAttribute('data-txf');if(!f)return;
  var x=(state.txns||[]).filter(function(t){return t.id===e.getAttribute('data-id')})[0];if(!x)return;
  if(f==='amount'){var ap=amtProblem(e.value,'bill'),v=Math.round(num(e.value)*100)/100;if(ap)toast(ap+'. That entry was not saved.');else if(v>0)x.amount=v}
  else if(f==='date'){if(isoValid(e.value))x.date=e.value}
  else if(f==='kind'){if(TX_KINDS.indexOf(e.value)>=0)x.kind=e.value}
  else if(f==='name')x.name=e.value.slice(0,80);
  txAfterChange();
});

