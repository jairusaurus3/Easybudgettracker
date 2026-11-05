/* Easy Budget Tracker: Collectibles page (money owed to you).
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* --- Collectibles (people owe you) --- */
var clFilter='all',clEdit=null,clMgr=false,clClosed=Object.create(null),clSureTimer=null;
function clStatus(c,m){
  var s=clSched(c,m),car=clCarried(c,m),n=idx(m)-idx(c.first)+1,last=add(c.first,c.term-1);
  var unp=(s>0&&!clPaid(c,m))?s:0,r={sched:s,carried:car,open:car+unp,state:'none',text:'',late:false};
  if(r.open>0){
    r.state='open';r.late=car>0;
    r.text=(s>0?'Payment '+n+' of '+c.term+' · ':'Unpaid from earlier · ')+fmt(r.open)+' to collect'+(car>0?' ('+fmt(car)+' carried over)':'');
  }else if(s>0){
    var p=c.paid[m];r.state='done';
    r.text='Payment '+n+' of '+c.term+' · collected'+(p&&p.d?' '+isoShort(p.d):'');
  }else if(idx(m)<idx(state.startMonth)){r.state='before';r.text='Before tracking started · not counted'}
  else if(n<1)r.text='Starts in '+(1-n)+(1-n===1?' month':' months')+' · first payment '+short(c.first);
  else r.text=clRemain(c)>0?'Nothing due this month':'All collected · ended '+short(last);
  if(c.due>0&&(r.state==='open'||r.state==='done')){
    r.text+=' · due on the '+ord(c.due);
    if(r.state==='open'&&s>0&&!clPaid(c,m)){
      var pp=m.split('-'),dd=new Date(+pp[0],+pp[1]-1,Math.min(c.due,daysIn(+pp[0],+pp[1]))),t=new Date(),t0=new Date(t.getFullYear(),t.getMonth(),t.getDate()),late=Math.round((t0-dd)/864e5);
      if(late>0){r.late=true;r.text+=' · overdue by '+late+(late===1?' day':' days')}
      else if(late===0)r.text+=' · due today';
    }
  }
  return r;
}
function clTotals(){
  var r={total:0,coll:0,dueNow:0,nOpen:0,cat:Object.create(null)};
  CLd().forEach(function(c){
    var rem=0;
    for(var k=0;k<c.term;k++){
      var ym=add(c.first,k);if(idx(ym)<idx(state.startMonth))continue;
      r.total+=c.pay;
      if(c.paid[ym])r.coll+=c.pay;else{rem+=c.pay;if(idx(ym)<=idx(cur))r.dueNow+=c.pay}
    }
    if(rem>0)r.nOpen++;
    var g=r.cat[c.cat]||(r.cat[c.cat]={out:0,n:0});g.n++;g.out+=rem;
  });
  return r;
}
function clSummary(){
  var r=clTotals(),set=function(id,t){var e=$(id);if(e)e.textContent=t};
  set('clOut',fmt(r.total-r.coll));set('clOver',fmt(r.dueNow));set('clColl',fmt(r.coll));set('clCount',r.nOpen+' still open of '+CLd().length);
  var m=document.querySelector('#clMeter i');if(m)m.style.width=(r.total>0?r.coll/r.total*100:0).toFixed(1)+'%';
  CL().cats.forEach(function(c,ci){var g=r.cat[c];set('clg'+ci,g?(g.out>0?fmt(g.out)+' to collect':'All collected'):'')});
}
function clRow(c){
  var st=clStatus(c,cur),open=clEdit===c.id,C=CL(),canTick=st.state==='open'||st.state==='done',
    pct=c.term?Math.min(100,clPaidCount(c)/c.term*100):0;
  var h='<li class="pg-li'+(st.state==='done'?' done':'')+'" data-cid="'+esc(c.id)+'"><div class="pg-row">'+
    '<label class="pg-cb"><input type="checkbox" data-cl="check"'+(st.state==='done'?' checked':'')+(canTick?'':' disabled')+' aria-label="Collected for '+label(cur)+': '+esc(c.name)+'"><span class="pg-box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg></span></label>'+
    '<div class="pg-meta"><input class="pg-name" data-cl="name" value="'+esc(c.name)+'" aria-label="Name" maxlength="80"><span class="pg-sub'+(st.late?' late':'')+'" data-cl-sub>'+esc(st.text)+'</span><div class="prog cl"><i style="width:'+pct.toFixed(1)+'%"></i></div></div>'+
    '<input class="pg-amt num" data-cl="pay" type="text" inputmode="decimal" value="'+(c.pay||'')+'" placeholder="0.00" aria-label="Amount each month for '+esc(c.name)+'">'+
    '<button type="button" class="pg-more" data-cl="more" aria-expanded="'+open+'" aria-label="Edit details for '+esc(c.name)+'">'+(open?'▴':'⋯')+'</button></div>';
  if(open){
    h+='<div class="pg-edit"><label class="pg-f">Number of months<input type="number" min="1" max="600" inputmode="numeric" data-cl="term" value="'+c.term+'"></label>'+
      '<label class="pg-f">First month<input type="month" data-cl="first" value="'+c.first+'"></label>'+
      '<label class="pg-f">Category<select data-cl="cat">'+C.cats.map(function(x){return '<option'+(x===c.cat?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select></label>'+
      '<label class="pg-f">Due date each month (day 1 to 31)<input type="number" min="0" max="31" inputmode="numeric" data-cl="dueday" value="'+(c.due||'')+'" placeholder="1 to 31"></label>'+
      '<label class="pg-f wide">Note<input data-cl="note" maxlength="120" value="'+esc(c.note)+'" placeholder="Optional"></label>'+
      '<div class="pg-f wide"><span class="status">Total owed: <b class="num">'+fmt(c.pay*c.term)+'</b> over '+c.term+(c.term===1?' month':' months')+'.</span><button type="button" class="tbtn" data-cl="del">Delete this entry</button></div></div>';
  }
  return h+'</li>';
}
function renderCollect(){
  var el=$('pgCollect');if(!el)return;
  var C=CL(),r=clTotals(),h='';
  h+='<header class="pg-head"><div class="pg-eye">People owe you</div><h2>Collectibles</h2></header>';
  h+='<section class="pg-card" aria-live="polite"><div><div class="pg-lbl">Still to collect (all months)</div><div class="pg-big num" id="clOut"></div></div><div class="budget-meter" id="clMeter"><i></i></div><div class="pg-stats"><span>Due so far <b class="num" id="clOver"></b></span><span>Collected <b class="num" id="clColl"></b></span><span id="clCount"></span></div></section>';
  h+='<form class="pg-add" id="clForm" novalidate><div class="pg-addrow"><input class="pg-in grow" id="clName" maxlength="80" placeholder="Name (who owes you)" aria-label="Name"><input class="pg-in amtw num" id="clAmt" type="text" inputmode="decimal" placeholder="Per month" aria-label="Amount each month"></div>'+
    '<div class="pg-addrow"><label class="pg-f grow">Number of months<input class="pg-in" id="clTerm" type="number" min="1" max="600" inputmode="numeric" value="1"></label><label class="pg-f grow">First month<input class="pg-in" id="clFirst" type="month" value="'+cur+'"></label></div>'+
    '<div class="pg-addrow"><label class="pg-f grow">Due date each month (day 1 to 31, optional)<input class="pg-in" id="clDueDay" type="number" min="1" max="31" inputmode="numeric" placeholder="e.g. 15"></label></div>'+
    '<div class="pg-addrow"><label class="pg-f grow">Category<select class="pg-in" id="clCat">'+C.cats.map(function(c){return '<option>'+esc(c)+'</option>'}).join('')+'<option value="__new">+ New category…</option></select></label></div>'+
    '<div class="pg-addrow"><input class="pg-in grow" id="clNewCat" maxlength="40" placeholder="New category name" aria-label="New category name" hidden><button class="tbtn primary" type="submit">Add</button></div></form>';
  h+='<div class="pg-filters" role="group" aria-label="Show">'+[['all','All'],['open','Still open'],['done','Finished']].map(function(f){return '<button type="button" class="tbtn'+(clFilter===f[0]?' on':'')+'" data-cl="filter" data-f="'+f[0]+'" aria-pressed="'+(clFilter===f[0])+'">'+f[1]+'</button>'}).join('')+'<button type="button" class="tbtn" data-cl="mgr" aria-expanded="'+clMgr+'">Categories</button></div>';
  if(clMgr){h+='<div class="pg-chips">'+C.cats.map(function(c,ci){var n=(r.cat[c]||{n:0}).n;return '<span class="pg-chip">'+esc(c)+' · '+n+(n===0?' <button type="button" class="pg-x" data-cl="delcat" data-ci="'+ci+'" aria-label="Remove category '+esc(c)+'">✕</button>':'')+'</span>'}).join('')+'<span class="status">Categories with no entries can be removed. Add new ones from the form above.</span></div>'}
  var any=false;
  var groups=[];
  C.cats.forEach(function(cat,ci){
    var list=C.items.filter(function(i){var rem=clRemain(i);return i.cat===cat&&(clFilter==='all'||(clFilter==='open'?rem>0:rem<=0))});
    if(!list.length)return;
    list=clSort(list);
    groups.push({cat:cat,ci:ci,list:list,r:clRank(list[0]),k:clDueTs(list[0])});
  });
  groups.sort(function(x,y){if(x.r!==y.r)return x.r-y.r;if(x.k!==y.k)return x.k<y.k?-1:1;return x.ci-y.ci});
  groups.forEach(function(g){
    var cat=g.cat,ci=g.ci,list=g.list;any=true;
    h+='<details class="pg-group" data-ci="'+ci+'"'+(clClosed[cat]?'':' open')+'><summary><span class="pg-chev" aria-hidden="true"></span><span class="pg-gname">'+esc(cat)+'</span><span class="pg-gsum" id="clg'+ci+'"></span></summary><ul class="pg-list">'+list.map(clRow).join('')+'</ul></details>';
  });
  if(!any)h+='<p class="pg-empty">'+(C.items.length?'Nothing to show for this filter.':'No entries yet. Add the first person who owes you above.')+'</p>';
  el.innerHTML=h;clSummary();
}
function clAfter(id){renderCollect();refresh();if(id)focusKeep('[data-cid="'+id+'"] [data-cl="check"]')}
(function(){
  var el=$('pgCollect');
  function item(e){var li=e.closest&&e.closest('[data-cid]');if(!li)return null;var id=li.getAttribute('data-cid');return CLd().filter(function(i){return i.id===id})[0]||null}
  el.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('[data-cl]');if(!b)return;var a=b.getAttribute('data-cl'),it;
    if(a==='more'){it=item(b);if(it){clEdit=clEdit===it.id?null:it.id;renderCollect()}}
    else if(a==='filter'){clFilter=b.getAttribute('data-f');renderCollect()}
    else if(a==='mgr'){clMgr=!clMgr;renderCollect()}
    else if(a==='delcat'){var C=CL(),ci=+b.getAttribute('data-ci');if(C.cats[ci]&&!C.items.some(function(i){return i.cat===C.cats[ci]})&&C.cats.length>1){C.cats.splice(ci,1);save();renderCollect()}}
    else if(a==='del'){
      it=item(b);if(!it)return;
      if(b.classList.contains('sure')){clearTimeout(clSureTimer);logRemove(it.id,'collect',it.name,it.pay,it.first);var C2=CL();C2.items=C2.items.filter(function(i){return i.id!==it.id});clEdit=null;save();clAfter(null)}
      else{b.classList.add('sure');b.textContent='Tap again to delete';clearTimeout(clSureTimer);clSureTimer=setTimeout(function(){b.classList.remove('sure');b.textContent='Delete this entry'},3500)}
    }
  });
  var clOld=Object.create(null);
  el.addEventListener('focusin',function(ev){var e=ev.target;if(e.getAttribute&&e.getAttribute('data-cl')==='name'){var it0=item(e);if(it0&&!(it0.id in clOld))clOld[it0.id]=it0.name}});
  el.addEventListener('toggle',function(ev){var d=ev.target;if(d&&d.classList&&d.classList.contains('pg-group')){var c=CL().cats[+d.getAttribute('data-ci')];if(c){if(d.open)delete clClosed[c];else clClosed[c]=true}}},true);
  el.addEventListener('input',function(ev){
    var e=ev.target,a=e.getAttribute&&e.getAttribute('data-cl'),it=item(e);if(!a||!it)return;
    if(a==='name')it.name=e.value;
    else if(a==='pay'){var v=pf(e.value),pb=it.pay;it.pay=isFinite(v)&&v>=0?Math.round(v*100)/100:0;logAmt(it.id,'collect',it.name,it.first,pb,it.pay);clSummary();refresh()}
    else if(a==='note')it.note=e.value;
    else return;
    save();
  });
  el.addEventListener('change',function(ev){
    var e=ev.target;
    if(e.id==='clCat'){var n=$('clNewCat');n.hidden=e.value!=='__new';if(!n.hidden)n.focus();return}
    var a=e.getAttribute&&e.getAttribute('data-cl'),it=item(e);if(!a||!it)return;
    if(a==='check'){if(e.checked){clCollect(it,cur);trackOnce('collectible-marked-paid')}else clUncollect(it,cur);save();clAfter(it.id)}
    else if(a==='pay'){save();clAfter(null)}
    else if(a==='term'){it.term=Math.max(1,Math.min(600,Math.round(num(e.value))||1));save();clAfter(null)}
    else if(a==='first'){if(validYM(e.value))it.first=e.value;save();clAfter(null)}
    else if(a==='dueday'){it.due=Math.max(0,Math.min(31,Math.round(num(e.value))||0));save();clAfter(null)}
    else if(a==='cat'){it.cat=e.value;save();clAfter(null)}
    else if(a==='name'){var oldN=(it.id in clOld)?clOld[it.id]:it.name;delete clOld[it.id];if(!e.value.trim()){it.name='Untitled';e.value='Untitled'}else it.name=e.value.trim();logRename(it.id,'collect',it.first,oldN,it.name,it.pay);save();clAfter(null)}
    else if(a==='note'){it.note=e.value.trim();save()}
  });
  el.addEventListener('submit',function(ev){
    ev.preventDefault();if(ev.target.id!=='clForm')return;
    var C=CL(),name=$('clName').value.trim();if(!name){formMsg(ev.target,'Enter a name first.');$('clName').focus();return}
    if(amtBadChars($('clAmt').value)){formMsg(ev.target,'Numbers only, for example 1,250.50.');$('clAmt').focus();return}var v=parseAmt($('clAmt').value),cat=$('clCat').value;if(v!==null&&v<0){formMsg(ev.target,'The amount cannot be negative.');$('clAmt').focus();return}if(!(v>0)){formMsg(ev.target,'Enter an amount greater than zero.');$('clAmt').focus();return}formMsg(ev.target,'');
    if(cat==='__new'){
      cat=$('clNewCat').value.trim().slice(0,40);if(!cat){$('clNewCat').focus();return}
      var ex=C.cats.filter(function(c){return c.toLowerCase()===cat.toLowerCase()})[0];if(ex)cat=ex;else C.cats.push(cat);
    }
    var term=Math.max(1,Math.min(600,Math.round(num($('clTerm').value))||1)),first=$('clFirst').value;
    var nc={id:uid(),name:name,pay:isFinite(v)&&v>=0?Math.round(v*100)/100:0,term:term,first:validYM(first)?first:cur,cat:cat,note:'',due:Math.max(0,Math.min(31,Math.round(num($('clDueDay').value))||0)),paid:{}};
    C.items.push(nc);logPush({ref:nc.id,kind:'collect',m:nc.first,name:nc.name,amount:nc.pay,act:'added',from:0});
    state.sample=false;save();trackOnce('collectible-added');renderCollect();refresh();focusSoon2('#clName');
  });
})();

