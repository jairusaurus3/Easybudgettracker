/* Easy Budget Tracker: spending calendar pop-up (v9.42).
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html (after notebook.js, before boot.js).
   It only reads spending items (state.items with kind 'spend'); the date of a purchase is item.dates[YYYY-MM]. Items without a date are listed under "No date". */
'use strict';
var scEl=null,scMonth=null,scDay=null,scUndOpen=false,scMsg='',scPrev=null;
var SC_WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* short amount for a calendar cell: 120, 12.5, 1.2k, 15k, 1M */
function scCompact(n){
  var a=Math.abs(n),u=['','k','M','B','T'],i=0,v=a;
  while(v>=999.5&&i<4){v/=1000;i++}
  var s=(i===0&&v<100)||(i>0&&v<10)?String(+v.toFixed(1)):String(Math.round(v));
  return (n<0?'−':'')+s+u[i];
}
/* every spending item of month ym, split into dated days and the "No date" group */
function scData(ym){
  var days={},und=[],total=0,undSum=0,max=0;
  state.items.forEach(function(it){
    if(it.kind!=='spend'||!itemShown(it,ym))return;
    var v=itemVal(it,ym);if(!(v>0))return;
    total+=v;
    var d=!it.repeat&&it.dates&&it.dates[ym];
    if(d){var o=days[d]||(days[d]={sum:0,items:[]});o.sum+=v;o.items.push({it:it,v:v})}
    else{und.push({it:it,v:v});undSum+=v}
  });
  Object.keys(days).forEach(function(k){days[k].sum=Math.round(days[k].sum*100)/100;if(days[k].sum>max)max=days[k].sum});
  return {days:days,und:und,total:Math.round(total*100)/100,undSum:Math.round(undSum*100)/100,max:max};
}
function scLong(iso){return isoDate(iso).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}
function scBounds(){return 'min="'+esc(state.startMonth)+'-01" max="'+(new Date().getFullYear()+5)+'-12-31"'}

function scHTML(){
  var d=scData(scMonth),h='<div class="sc-head"><h2 id="scT" tabindex="-1">Spending calendar</h2><button type="button" class="sc-x" data-sc="close" aria-label="Close">✕</button></div>';
  if(scDay){
    var day=d.days[scDay],items=day?day.items:[];
    h+='<button type="button" class="sc-back" data-sc="back">‹ Back to calendar</button>'+
      '<h3 class="sc-h" id="scH" tabindex="-1">'+esc(scLong(scDay))+'</h3>'+
      '<div class="sc-sum"><span>Spent this day</span><b class="num">'+esc(fmt(day?day.sum:0))+'</b></div>';
    h+=items.length?'<ul class="sc-list">'+items.map(function(x){return '<li><span class="sc-nm">'+(x.it.name?esc(x.it.name):'<i>Untitled</i>')+'</span><b class="num">'+esc(fmt(x.v))+'</b><button type="button" class="tbtn" data-sc="edit" data-id="'+esc(x.it.id)+'" aria-label="Edit '+esc(x.it.name||'item')+'">Edit</button></li>'}).join('')+'</ul>':'<p class="sc-empty">Nothing spent on this day.</p>';
    h+='<button type="button" class="tbtn primary sc-add" data-sc="addday" data-d="'+esc(scDay)+'">+ Add spending on this day</button>';
  }else{
    var p=scMonth.split('-'),y=+p[0],mo=+p[1],first=new Date(y,mo-1,1).getDay(),n=spDim(scMonth),today=isoToday(),cells='';
    for(var i=0;i<first;i++)cells+='<span class="sc-pad" aria-hidden="true"></span>';
    for(var dd=1;dd<=n;dd++){
      var iso=scMonth+'-'+pad2(dd),o=d.days[iso],cls='sc-day'+(o?' has':'')+(iso===today?' today':'');
      cells+='<button type="button" class="'+cls+'" data-sc="day" data-d="'+iso+'"'+(o?' style="--h:'+Math.max(.18,Math.min(1,o.sum/d.max)).toFixed(2)+'"':'')+' aria-label="'+esc(scLong(iso))+(o?': spent '+esc(fmt(o.sum)):': nothing spent')+'"><i>'+dd+'</i>'+(o?'<b>'+esc(scCompact(o.sum))+'</b>':'')+'</button>';
    }
    h+='<div class="sc-nav"><button type="button" class="sc-x" data-sc="prev" aria-label="Previous month"'+(idx(scMonth)<=idx(state.startMonth)?' disabled':'')+'>‹</button><b class="sc-mo" aria-live="polite">'+esc(label(scMonth))+'</b><button type="button" class="sc-x" data-sc="next" aria-label="Next month"'+(idx(scMonth)>=idx(ymNow())+12?' disabled':'')+'>›</button></div>'+
      '<div class="sc-sum"><span>Spent in '+esc(short(scMonth))+'</span><b class="num">'+esc(fmt(d.total))+'</b></div>'+
      '<div class="sc-wd" aria-hidden="true">'+SC_WD.map(function(w){return '<span>'+w+'</span>'}).join('')+'</div><div class="sc-grid">'+cells+'</div>';
    if(!Object.keys(d.days).length&&!d.und.length)h+='<p class="sc-empty">No spending in '+esc(label(scMonth))+' yet. Tap a day to add some.</p>';
    if(d.und.length){
      h+='<div class="sc-und"><button type="button" class="sc-undbtn" data-sc="und" aria-expanded="'+scUndOpen+'"><span>No date</span><span class="num">'+d.und.length+' item'+(d.und.length===1?'':'s')+' · '+esc(fmt(d.undSum))+'</span><span aria-hidden="true">'+(scUndOpen?'▴':'▾')+'</span></button>';
      if(scUndOpen)h+='<ul class="sc-list">'+d.und.map(function(x){return '<li><span class="sc-nm">'+(x.it.name?esc(x.it.name):'<i>Untitled</i>')+'</span><b class="num">'+esc(fmt(x.v))+'</b>'+(x.it.repeat?'<span class="sc-note">repeats</span>':'<label class="tbtn sc-setdate">Set date<input type="date" data-sc-set="'+esc(x.it.id)+'" '+scBounds()+' aria-label="Set date for '+esc(x.it.name||'item')+'"></label>')+'</li>'}).join('')+'</ul>';
      h+='</div>';
    }
  }
  h+='<p class="sc-msg" role="status">'+esc(scMsg)+'</p>';
  return h;
}
function scRender(focusSel){
  if(!scEl)return;
  var card=scEl.querySelector('.sc-card'),top=card.scrollTop;
  card.innerHTML=scHTML();
  card.scrollTop=top;
  if(focusSel){var f=card.querySelector(focusSel);if(f)f.focus()}
}
function spCalRefresh(){if(scEl)scRender()}

function openSpendCal(opener){
  if(scEl)return;
  scPrev=opener||document.activeElement;scMonth=validYM(cur)?cur:ymNow();scDay=null;scUndOpen=false;scMsg='';
  scEl=document.createElement('div');scEl.className='sc-wrap';scEl.id='spendCal';
  scEl.innerHTML='<div class="sc-card" role="dialog" aria-modal="true" aria-labelledby="scT"></div>';
  document.body.appendChild(scEl);document.body.style.overflow='hidden';
  scEl.addEventListener('click',scClick);scEl.addEventListener('change',scChange);
  document.addEventListener('keydown',scKey,true);
  scRender('.sc-day.today,.sc-day,.sc-x');
}
function scClose(skipFocus){
  if(!scEl)return;
  var el=scEl;scEl=null;document.removeEventListener('keydown',scKey,true);
  if(el.parentNode)el.parentNode.removeChild(el);
  document.body.style.overflow='';
  if(!skipFocus){try{if(scPrev&&document.contains(scPrev))scPrev.focus()}catch(e){}}
}
function scKey(e){
  if(!scEl)return;
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();scClose();return}
  if(e.key!=='Tab')return;
  var f=[].filter.call(scEl.querySelectorAll('button,input,select'),function(x){return !x.disabled&&x.offsetParent!==null});
  if(!f.length)return;
  var first=f[0],last=f[f.length-1],a=document.activeElement;
  if(!scEl.contains(a)){e.preventDefault();first.focus()}
  else if(e.shiftKey&&a===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&a===last){e.preventDefault();first.focus()}
}
function scClick(e){
  if(e.target===scEl){scClose();return}
  var b=e.target.closest&&e.target.closest('[data-sc]');if(!b||b.disabled)return;
  var a=b.getAttribute('data-sc'),id=b.getAttribute('data-id'),d=b.getAttribute('data-d');
  if(a==='close')scClose();
  else if(a==='prev'&&idx(scMonth)>idx(state.startMonth)){scMonth=add(scMonth,-1);scMsg='';scUndOpen=false;scRender('.sc-nav [data-sc="prev"]:not(:disabled),.sc-mo')}
  else if(a==='next'&&idx(scMonth)<idx(ymNow())+12){scMonth=add(scMonth,1);scMsg='';scUndOpen=false;scRender('.sc-nav [data-sc="next"]:not(:disabled),.sc-mo')}
  else if(a==='day'&&isoValid(d)){scDay=d;scMsg='';scRender('#scH')}
  else if(a==='back'){var was=scDay;scDay=null;scMsg='';scRender('.sc-day[data-d="'+was+'"]')}
  else if(a==='und'){scUndOpen=!scUndOpen;scRender('.sc-undbtn')}
  else if(a==='edit'&&id)scEdit(id);
  else if(a==='addday'&&isoValid(d))scAddOn(d);
}
function scChange(e){
  var id=e.target.getAttribute&&e.target.getAttribute('data-sc-set');if(!id)return;
  var it=findItem(id),iso=e.target.value;if(!it||!iso)return;
  var r=setSpendDate(it,iso,scMonth);
  if(!r.ok){scMsg=r.msg;scRender();return}
  touchTs(it);state.sample=false;save();
  scMsg=r.ym===scMonth?'Date set.':'Moved to '+label(r.ym)+'.';
  renderAll();scRender('.sc-undbtn');
}
function scGoRow(id,ym){
  cur=ym;openId=id;if(!state.collapsed)state.collapsed={};state.collapsed.spend=false;
  scClose(true);renderAll();
  setTimeout(function(){var r=document.querySelector('.row[data-id="'+id+'"]');if(r&&r.scrollIntoView)r.scrollIntoView({block:'center'});var n=document.querySelector('[data-field="name"][data-id="'+id+'"]');if(n)n.focus()},60);
}
function scEdit(id){var it=findItem(id);if(it)scGoRow(id,scMonth)}
function scAddOn(iso){
  var ym=iso.slice(0,7);
  if(idx(ym)<idx(state.startMonth)){scMsg='That is before your budget starts ('+label(state.startMonth)+').';scRender();return}
  state.sample=false;
  var it={id:uid(),kind:'spend',name:'',usual:0,repeat:false,start:ym,over:{},dates:{}};it.dates[ym]=iso;
  state.items.push(it);save();
  scGoRow(it.id,ym);
}
