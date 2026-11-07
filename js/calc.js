/* Easy Budget Tracker: budget calculations, ordering and number formatting.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- calculations ---------- */
function itemEnded(it,m){return !!it.end&&m>it.end}
function itemShown(it,m){
  if(itemEnded(it,m))return false;
  if(!it.repeat)return Object.prototype.hasOwnProperty.call(it.over,m)||(it.start===m);
  if(it.repeat&&it.start&&m<it.start&&!Object.prototype.hasOwnProperty.call(it.over,m))return false;
  return true;
}
function itemVal(it,m){
  if(itemEnded(it,m))return 0;
  if(Object.prototype.hasOwnProperty.call(it.over,m))return num(it.over[m]);
  if(it.repeat&&it.usual&&(!it.start||m>=it.start))return it.usual;
  return 0;
}
function itemDefault(it,m){return itemEnded(it,m)?0:(it.repeat&&it.usual&&(!it.start||m>=it.start))?it.usual:0}
/* bills and cards must be marked paid before they leave your balance. For bills this only applies from state.billsFrom on; earlier months always count as paid. */
function billsFromIdx(){return idx(validYM(state.billsFrom)?state.billsFrom:ymNow())}
function needsPaid(it,m){return it.kind==='card'||(it.kind==='bill'&&idx(m)>=billsFromIdx())}
function payKind(k){return k==='card'||k==='bill'}
function loanN(l,m){return idx(m)-idx(l.first)+1}
function loanVal(l,m){var n=loanN(l,m);return (n>=1&&n<=l.term&&idx(m)>=idx(state.startMonth))?l.pay:0}
function CLd(){return (state.collect&&Array.isArray(state.collect.items))?state.collect.items:[]}
function clSched(c,m){var n=idx(m)-idx(c.first)+1;return (n>=1&&n<=c.term&&idx(m)>=idx(state.startMonth))?c.pay:0}
function clPaid(c,k){return !!(c.paid&&c.paid[k])}
function clPaidCount(c){var n=0;for(var k=0;k<c.term;k++){if(clPaid(c,add(c.first,k)))n++}return n}
function clRemain(c){var s=0;for(var k=0;k<c.term;k++){var ym=add(c.first,k);if(idx(ym)>=idx(state.startMonth)&&!clPaid(c,ym))s+=c.pay}return s}
function clCarried(c,m){
  var s=0,lim=Math.min(240,idx(m)-idx(state.startMonth));
  for(var j=1;j<=lim;j++){var k=add(m,-j);if(clSched(c,k)>0&&!clPaid(c,k))s+=c.pay}
  return s;
}
/* ---- ordering: unpaid by nearest due date, then not yet due, then ticked (paid) at the bottom ---- */
function clRank(c){
  var st=clStatus(c,cur);
  if(st.state==='open')return 0;
  if(st.state==='done')return 2;
  return clRemain(c)>0?1:2;
}
function clDueTs(c){
  if(!(c.due>0))return Infinity;
  var m=cur,lim=Math.min(240,idx(cur)-idx(state.startMonth));
  for(var j=lim;j>=1;j--){var k=add(cur,-j);if(clSched(c,k)>0&&!clPaid(c,k)){m=k;break}}
  var p=m.split('-');
  return new Date(+p[0],+p[1]-1,Math.min(c.due,daysIn(+p[0],+p[1]))).getTime();
}
function clSort(list){
  var arr=list.map(function(c){return {c:c,r:clRank(c),k:clDueTs(c)}});
  arr.sort(function(x,y){
    if(x.r!==y.r)return x.r-y.r;
    if(x.r===1){var d=idx(x.c.first)-idx(y.c.first);if(d)return d}
    if(x.k!==y.k)return x.k<y.k?-1:1;
    return idx(x.c.first)-idx(y.c.first)||(x.c.name||'').localeCompare(y.c.name||'');
  });
  return arr.map(function(o){return o.c});
}
function clCollect(c,m){
  var lim=Math.min(240,idx(m)-idx(state.startMonth)),d=isoToday();
  for(var j=lim;j>=0;j--){var k=add(m,-j);if(clSched(c,k)>0&&!clPaid(c,k)){if(!c.paid)c.paid={};c.paid[k]={d:d,by:m}}}
}
function clUncollect(c,m){
  var p=c.paid&&c.paid[m],by=p?p.by:m;
  Object.keys(c.paid||{}).forEach(function(k){if(c.paid[k].by===by&&idx(k)<=idx(m))delete c.paid[k]});
}
/* v9.33: a collectible payment is money out only while it is still uncollected when its month ends.
   Collected in its own month (or earlier) it counts as neither expense nor income. Collected in a later month, the earlier month keeps the expense and the later month gets "collected back" (never income). */
function clLate(c,k){var p=c.paid&&c.paid[k];return !!(p&&p.d&&idx(p.d.slice(0,7))>idx(k))}
function clOut(c,m){var s=clSched(c,m);if(!(s>0))return 0;return (c.paid&&c.paid[m]&&!clLate(c,m))?0:s}
function clBack(m){
  var s=0;
  CLd().forEach(function(c){Object.keys(c.paid||{}).forEach(function(k){var p=c.paid[k];if(p&&p.d&&p.d.slice(0,7)===m&&idx(m)>=idx(state.startMonth)&&clSched(c,k)>0&&idx(m)>idx(k))s+=c.pay})});
  return s;
}
var _cc=null;
function calc(m){
  if(!_cc){_cc={};Promise.resolve().then(function(){_cc=null})}
  if(_cc[m])return _cc[m];
  var t={income:0,bill:0,spend:0,saving:0,card:0,loan:0,collect:0,back:0};
  t.pend=0;
  state.items.forEach(function(i){var v=itemVal(i,m);if(needsPaid(i,m)&&!(i.paid&&i.paid[m])){t.pend+=v;return}t[i.kind]+=v});
  state.loans.forEach(function(l){var v=loanVal(l,m);if(!(l.paid&&l.paid[m])){t.pend+=v;return}t.loan+=v});
  CLd().forEach(function(c){t.collect+=clOut(c,m)});t.back=clBack(m);txMonth(m).forEach(function(x){t[x.kind]+=x.amount});
  t.out=t.bill+t.spend+t.saving+t.card+t.loan+t.collect; t.left=t.income-t.out+t.back; return (_cc[m]=t);
}
function balance(m){
  var c=calc(m), carried=0;
  if(state.carry&&idx(m)>=idx(state.startMonth)){
    carried=state.opening;
    var n=Math.min(idx(m)-idx(state.startMonth),240);
    for(var k=0;k<n;k++)carried+=calc(add(state.startMonth,k)).left;
  }
  return {c:c,carried:carried,bal:c.left+carried};
}

/* ---------- formatting ---------- */
function fmt(n){var neg=n<0&&Math.round(Math.abs(n)*100)>0;return (neg?'−':'')+esc(state.currency)+Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
function compact(n){var a=Math.abs(n),s;if(a>=1e9)s=(a/1e9).toFixed(1)+'B';else if(a>=1e6)s=(a/1e6).toFixed(1)+'M';else if(a>=1e3)s=(a/1e3).toFixed(1)+'k';else s=a.toFixed(0);return (n<0&&a>=0.5?'−':'')+esc(state.currency)+s}
function inputVal(n){return n?n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):''}
/* v9.38: amount boxes show 1.3M / 1.45B when not being edited (viewing). Clicking the box shows the full digits. */
function amtShort(n){
  var a=Math.abs(n);if(!(a>=1e6))return inputVal(n);
  var v=Math.round(a/1e6*100)/100,u='M';
  if(v>=1000){v=Math.round(a/1e9*100)/100;u='B'}
  if(v>=1000){v=Math.round(a/1e12*100)/100;u='T'}
  return (n<0?'-':'')+String(v)+u;
}
function isShortAmt(s){return /^-?[0-9.]+[MBT]$/.test(String(s))}

