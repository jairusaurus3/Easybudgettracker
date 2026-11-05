/* Easy Budget Tracker: Budget page: rendering and actions.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- render ---------- */
var $=function(id){return document.getElementById(id)};
function applyTheme(id){
  if(!themeOk(id))id='blue-dark';
  var t=THEMES.filter(function(x){return x.id===id})[0];
  document.documentElement.setAttribute('data-theme',id);
  try{localStorage.setItem('ebt.theme',id)}catch(e){}
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t.bg);
}
function themeHTML(){
  var cur=themeOf(themeOk(state.theme)?state.theme:'blue-dark');
  var colors=THEME_COLORS.map(function(c){
    var t=themeOf(themeId(c[0],cur.mode)),on=c[0]===cur.color;
    return '<button class="tbtn th'+(on?' on':'')+'" data-act="theme-color" data-color="'+c[0]+'" aria-pressed="'+on+'"><i class="dot" style="background:linear-gradient(135deg,'+t.bg+' 50%,'+t.ac+' 50%)"></i>'+c[1]+'</button>';
  }).join('');
  var modes=['light','dark'].map(function(m){var on=m===cur.mode;return '<button class="tbtn th'+(on?' on':'')+'" data-act="theme-mode" data-mode="'+m+'" aria-pressed="'+on+'">'+(m==='light'?'Light':'Dark')+'</button>'}).join('');
  return '<div class="themes th-row" role="group" aria-label="Mode">'+modes+'</div><div class="themes" role="group" aria-label="Color">'+colors+'</div>';
}
function renderHeader(){
  updateGoogleUI();
  $('monthLabel').textContent=label(cur);
  $('todayBtn').hidden=(cur===ymNow());
}
function corruptRaw(){var c=lsGet(KEY+'.corrupt');return c&&lsGet('ebt.corrupt.seen')!==(c.length+':'+c.slice(0,40))?c:null}
function corruptSeen(){var c=lsGet(KEY+'.corrupt');if(c)lsSet('ebt.corrupt.seen',c.length+':'+c.slice(0,40))}
function renderNotice(){
  var cb=corruptRaw()?'<div class="notice" role="alert"><p><b>We could not read your saved budget.</b> What you see now may not be your own data. A copy of the unreadable data was kept. Try to recover it, or download it so nothing is lost.</p><div class="acts"><button class="tbtn primary" data-act="recoverbad">Try to recover</button><button class="tbtn" data-act="dlbad">Download the copy</button><button class="tbtn" data-act="dismissbad">Dismiss</button></div><p class="status" id="badMsg" role="status"></p></div>':'';
  $('notice').innerHTML=staleBanner()+cb+(state.sample?'<div class="notice"><p><b>This is a sample budget.</b> Every name and amount is an example so you can see how it works. Change anything, or start with your own.</p><div class="acts"><button class="tbtn primary" data-act="blank">Start my own budget</button><button class="tbtn" data-act="keep">Keep exploring</button></div></div>':'');
}
function remindDays(){return (state&&state.remind!=null)?state.remind:3}
var dueAll=false,DUE_SHOW=3;
function dueList(){
  var out=[],t=new Date(),t0=new Date(t.getFullYear(),t.getMonth(),t.getDate()),n=remindDays(),now=ymNow();
  function dueDate(m,day){var p=m.split('-');return new Date(+p[0],+p[1]-1,Math.min(day,daysIn(+p[0],+p[1])))}
  state.items.forEach(function(it){
    if(!payKind(it.kind)||!it.due)return;
    [add(now,-2),add(now,-1),now,add(now,1)].forEach(function(m){
      if(idx(m)<idx(state.startMonth)||!needsPaid(it,m))return;
      var amt=itemVal(it,m);if(!(amt>0)||(it.paid&&it.paid[m]))return;
      var diff=Math.round((dueDate(m,it.due)-t0)/864e5);
      if(diff<=n)out.push({it:it,m:m,diff:diff,amt:amt,type:it.kind});
    });
  });
  state.loans.forEach(function(l){
    if(!(l.due>0))return;
    [add(now,-2),add(now,-1),now,add(now,1)].forEach(function(m){
      if(idx(m)<idx(state.startMonth))return;
      var amt=loanVal(l,m);if(!(amt>0)||(l.paid&&l.paid[m]))return;
      var diff=Math.round((dueDate(m,l.due)-t0)/864e5);
      if(diff<=n)out.push({it:l,m:m,diff:diff,amt:amt,type:'loan'});
    });
  });
  /* collectibles: one row per person. Unpaid months that are due (or overdue) are added together, because ticking collects everything due so far. */
  CLd().forEach(function(c){
    if(!(c.due>0)||!(c.pay>0))return;
    var q=[],first=idx(state.startMonth),last=idx(add(now,1)),lo=Math.max(first,last-240);
    for(var k=lo;k<=last;k++){
      var m=fromIdx(k);if(!(clSched(c,m)>0)||clPaid(c,m))continue;
      var diff=Math.round((dueDate(m,c.due)-t0)/864e5);
      if(diff<=n)q.push({m:m,diff:diff});
    }
    if(!q.length)return;
    out.push({it:c,m:q[q.length-1].m,diff:q[0].diff,amt:c.pay*q.length,count:q.length,type:'collect'});
  });
  var TR={card:0,loan:1,bill:2,collect:3};out.sort(function(a,b){return a.diff-b.diff||(TR[a.type]-TR[b.type])});return out;
}
function dueWhen(d){return d<0?(-d)+(d===-1?' day overdue':' days overdue'):(d===0?'due today':'due in '+d+(d===1?' day':' days'))}
function renderDue(){
  var el=$('dueBanner');if(!el)return;var L=dueList();
  if(!L.length){el.innerHTML='';return}
  var shown=(dueAll||L.length<=DUE_SHOW+1)?L:L.slice(0,DUE_SHOW),rest=L.length-shown.length;
  el.innerHTML='<div class="due" role="status">'+shown.map(function(x){
    var w=dueWhen(x.diff),late=x.diff<0?' late':'';
    if(x.type==='collect')return '<div class="dueRow col'+late+'"><span><b>'+esc(x.it.name||'Collectible')+'</b> owes you '+fmt(x.amt)+(x.count>1?' ('+x.count+' payments)':'')+' · '+w+'</span><button class="tbtn" data-act="cpaid" data-id="'+x.it.id+'" data-m="'+x.m+'">Mark collected</button></div>';
    return '<div class="dueRow'+late+'"><span><b>'+esc(x.it.name||(x.type==='loan'?'Loan':x.type==='bill'?'Bill':'Credit card'))+'</b> '+w+' · '+fmt(x.amt)+'</span><button class="tbtn" data-act="paid" data-id="'+x.it.id+'" data-m="'+x.m+'">Mark paid</button></div>';
  }).join('')+(rest>0?'<button class="linkbtn dueMore" data-act="duemore">Show '+rest+' more</button>':(dueAll&&L.length>DUE_SHOW+1?'<button class="linkbtn dueMore" data-act="duemore">Show less</button>':''))+'</div>';
}
function icsEsc(t){return String(t).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n')}
function icsFold(l){var o=[];while(l.length>60){o.push(l.slice(0,60));l=' '+l.slice(60)}o.push(l);return o.join('\r\n')}
function buildIcs(kind){
  kind=kind==='bill'?'bill':'card';
  var cards=state.items.filter(function(i){return i.kind===kind&&i.due>0&&(kind==='card'||(i.repeat&&!i.end))});if(!cards.length)return '';
  var n=remindDays(),t=new Date(),t0=new Date(t.getFullYear(),t.getMonth(),t.getDate()),
    stamp=t.getUTCFullYear()+pad2(t.getUTCMonth()+1)+pad2(t.getUTCDate())+'T'+pad2(t.getUTCHours())+pad2(t.getUTCMinutes())+pad2(t.getUTCSeconds())+'Z';
  var L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Easy Budget Tracker//EN','CALSCALE:GREGORIAN'];
  cards.forEach(function(c){
    var first=new Date(t.getFullYear(),t.getMonth(),Math.min(c.due,daysIn(t.getFullYear(),t.getMonth()+1)));
    if(first<t0){var nx=new Date(t.getFullYear(),t.getMonth()+1,1);first=new Date(nx.getFullYear(),nx.getMonth(),Math.min(c.due,daysIn(nx.getFullYear(),nx.getMonth()+1)))}
    var ds=first.getFullYear()+pad2(first.getMonth()+1)+pad2(first.getDate());
    var rule=c.due>=31?'FREQ=MONTHLY;BYMONTHDAY=-1':(c.due>=29?'FREQ=MONTHLY;BYMONTHDAY='+(c.due-2)+','+(c.due-1)+','+c.due+';BYSETPOS=-1':'FREQ=MONTHLY;BYMONTHDAY='+c.due);
    var name=c.name||(kind==='bill'?'Bill':'Credit card');
    L.push('BEGIN:VEVENT','UID:'+kind+'-'+c.id+'@ezbudgettracker.app','DTSTAMP:'+stamp,'DTSTART;VALUE=DATE:'+ds,'RRULE:'+rule,
      'SUMMARY:'+icsEsc((kind==='bill'?'Bill due: ':'Credit card due: ')+name),
      'DESCRIPTION:'+icsEsc('Pay '+name+' on or before the due date.'+(c.usual?' Usual payment: '+state.currency+c.usual.toFixed(2):'')),
      'TRANSP:TRANSPARENT');
    if(n>0){var hrs=n*24-9;L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(name+' is due in '+n+(n===1?' day':' days')),'TRIGGER:-PT'+hrs+'H','END:VALARM')}
    L.push('BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:'+icsEsc(name+' is due today'),'TRIGGER:PT9H','END:VALARM','END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n')+'\r\n';
}
function doCalendar(kind){
  kind=kind==='bill'?'bill':'card';
  var ics=buildIcs(kind);if(!ics){setStatus(kind==='bill'?'Add a due day to at least one repeating bill first':'Add a due day to at least one card first');return}
  track('calendar-exported');
  var name=kind==='bill'?'bill-due-dates.ics':'credit-card-due-dates.ics',blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
  try{
    var f=new File([blob],name,{type:'text/calendar'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:kind==='bill'?'Bill due dates':'Credit card due dates'}).catch(function(){});setStatus('Choose Calendar to add the reminders');return}
  }catch(e){}
  try{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);setStatus('Calendar file downloaded. Open it to add the reminders')}
  catch(e){setStatus('Could not create the calendar file')}
}
function renderHero(){
  var r=balance(cur),c=r.c,neg=r.bal<0;
  var total=Math.max(c.income+c.back,c.out,0.01);
  function seg(v,col){return '<i style="width:'+(Math.max(0,v)/total*100).toFixed(2)+'%;background:var('+col+')"></i>'}
  var left=Math.max(0,c.income-c.out+c.back);
  var any=c.income||c.out;
  var prev=balance(add(cur,-1)).bal,tr='';
  if(any&&prev>0){var pc=(r.bal-prev)/prev*100;tr='<div class="trend '+(pc>=0?'pos':'neg')+'">'+(pc>=0?'↑ ':'↓ ')+Math.abs(pc).toFixed(0)+'% from last month</div>'}
  var vals=[];for(var q=6;q>=0;q--)vals.push(balance(add(cur,-q)).bal);
  var h='<div class="hero-top"><div><div class="lbl">Remaining balance'+(any?'<span class="pill '+(neg?'neg':'pos')+'">'+(neg?'Over budget':'On track')+'</span>':'')+'</div>'+
    '<div class="big num '+(any?(neg?'neg':'pos'):'')+(fmt(r.bal).length>13?' long':'')+'">'+fmt(r.bal)+'</div>'+tr+
    '<div class="sub num">'+(any?fmt(c.income)+' coming in · '+fmt(c.out)+' going out'+(c.back?' · '+fmt(c.back)+' collected back':'')+(c.pend>0?' · '+fmt(c.pend)+' bill/card/loan not yet paid':'')+(state.carry&&r.carried?' · '+fmt(r.carried)+' carried over':''):'Nothing entered for '+label(cur)+' yet. Add income and expenses below.')+'</div></div>'+
    '<div class="spark">'+sparkSVG(vals)+'</div></div>';
  h+='<div class="bar" role="img" aria-label="How income is used">'+seg(c.bill,'--c-bills')+seg(c.spend,'--c-spend')+seg(c.saving,'--c-save')+seg(c.card,'--c-card')+seg(c.loan,'--c-loan')+seg(c.collect,'--c-collect')+'</div>';
  h+='<div class="legend num">'+
    '<span><i class="sw" style="background:var(--c-bills)"></i>Bills <b>'+fmt(c.bill)+'</b></span>'+
    '<span><i class="sw" style="background:var(--c-spend)"></i>Spending <b>'+fmt(c.spend)+'</b></span>'+
    '<span><i class="sw" style="background:var(--c-save)"></i>Savings <b>'+fmt(c.saving)+'</b></span>'+
    '<span><i class="sw" style="background:var(--c-card)"></i>Cards <b>'+fmt(c.card)+'</b></span>'+
    '<span><i class="sw" style="background:var(--c-loan)"></i>Loans <b>'+fmt(c.loan)+'</b></span>'+
    '<span><i class="sw" style="background:var(--c-collect)"></i>Collectibles <b>'+fmt(c.collect)+'</b></span>'+(c.back?'<span><i class="sw" style="background:var(--c-back)"></i>Collected back <b>'+fmt(c.back)+'</b></span>':'')+
    '<span><i class="sw" style="background:var(--c-left)"></i>Left over <b>'+fmt(left)+'</b></span></div>';
  $('hero').innerHTML=h;
}
var wiAmt=null,wiMonths=6,goalUsed=false;
function spendCats(){return state.items.filter(function(i){return i.kind==='spend'})}
function reviewMonth(){var now=ymNow();return cur<now?cur:add(now,-1)}
function money0(n){return fmt(Math.round(n))}
function trendNotes(R){
  var notes={up:[],down:[],base:null};
  var months=[add(R,-3),add(R,-2),add(R,-1)],cI=calc(R).income;
  spendCats().forEach(function(it){
    var now=itemVal(it,R);if(!(now>0))return;
    var vals=months.map(function(m){return itemVal(it,m)}).filter(function(v){return v>0});
    if(vals.length<2)return;
    var avg=vals.reduce(function(a,b){return a+b},0)/vals.length,diff=now-avg,pct=diff/avg*100;
    var minDiff=Math.max(avg*0.1,cI>0?cI*0.01:0);
    if(Math.abs(diff)<minDiff||Math.abs(pct)<15)return;
    var row={name:it.name||'Unnamed category',now:now,avg:avg,pct:pct,n:vals.length,diff:diff};
    (diff>0?notes.up:notes.down).push(row);
  });
  notes.up.sort(function(a,b){return b.diff-a.diff});notes.down.sort(function(a,b){return a.diff-b.diff});
  notes.base=short(months[0])+' to '+short(months[2]);
  return notes;
}
function renderInsights(){
  var ae=document.activeElement,keepId=(ae&&ae.id&&$('insights').contains(ae))?ae.id:null;
  var c=calc(cur),b=state.budgets||(state.budgets={overall:0,categories:{}}),cats=spendCats(),h='';
  var goal=state.goal||(state.goal={target:0,months:6});
  var spent=c.bill+c.spend+c.card+c.loan,hL='';
  /* 1. limits (shown after the suggestions) */
  hL+='<section class="insight-card"><h2>Monthly budget limits</h2>';
  hL+='<div class="budget-row"><label for="budget-overall"><b>Overall spending limit</b><br><span class="status">Bills, spending, cards and loans</span></label><input id="budget-overall" data-budget="overall" class="num" inputmode="decimal" type="text" value="'+(b.overall||'')+'" placeholder="No limit"></div>';
  if(b.overall>0){var pct=spent/b.overall*100;hL+='<div><div class="srow" style="justify-content:space-between"><span class="status">'+fmt(spent)+' of '+fmt(b.overall)+'</span><b>'+Math.round(pct)+'%</b></div><div class="budget-meter"><i class="'+(pct>=100?'over':pct>=80?'warn':'')+'" style="width:'+Math.min(100,pct)+'%"></i></div><p style="margin-top:5px">'+(pct>=100?'You are '+fmt(spent-b.overall)+' over this limit.':pct>=80?'You have used at least 80% of this limit.':fmt(b.overall-spent)+' remains for this month.')+'</p></div>'}
  if(cats.length){hL+='<div class="status" style="font-weight:600">Category limits</div><div class="status">Transactions you log by hand count toward the overall limit only.</div>';cats.forEach(function(it){var lim=num(b.categories[it.id]),val=itemVal(it,cur),pc=lim>0?val/lim*100:0;hL+='<div class="budget-row"><div><label for="budget-cat-'+esc(it.id)+'">'+esc(it.name||'Unnamed category')+'</label>'+(lim>0?'<div class="budget-meter"><i class="'+(pc>=100?'over':pc>=80?'warn':'')+'" style="width:'+Math.min(100,pc)+'%"></i></div><div class="status">'+fmt(val)+' of '+fmt(lim)+(pc>=100?' · over limit':pc>=80?' · nearing limit':'')+'</div>':'')+'</div><input id="budget-cat-'+esc(it.id)+'" data-budget="category" data-id="'+esc(it.id)+'" class="num" inputmode="decimal" type="text" value="'+(lim||'')+'" placeholder="No limit" aria-label="Monthly limit for '+esc(it.name)+'"></div>'})}
  hL+='</section>';
  /* 2. suggestions, all calculated from recorded amounts */
  var R=reviewMonth(),T=trendNotes(R),notes=[];
  if(c.income>0){
    var kept=c.income-spent,rate=kept/c.income*100;
    notes.push(rate<0?'In '+label(cur)+', bills, spending, cards and loans ('+fmt(spent)+') are more than your recorded income ('+fmt(c.income)+'). Look for a category you can reduce or a month where income is still missing.':'In '+label(cur)+', about '+Math.round(rate)+'% of recorded income ('+fmt(kept)+') is left after bills, spending, cards and loans. That is your room for savings.');
  }
  if(T.base){
    T.up.slice(0,2).forEach(function(r){notes.push(r.name+' was '+fmt(r.now)+' in '+label(R)+', '+Math.round(r.pct)+'% above its average of '+fmt(r.avg)+' ('+r.n+' earlier months, '+T.base+'). Check whether this was a one-off or the new normal.')});
    T.down.slice(0,1).forEach(function(r){notes.push(r.name+' was '+fmt(r.now)+' in '+label(R)+', '+Math.round(Math.abs(r.pct))+'% below its average of '+fmt(r.avg)+' ('+r.n+' earlier months, '+T.base+'). Consider keeping the habits that helped.')});
  }
  var M=c.spend>0?cur:R,cm=calc(M),top=null;
  spendCats().forEach(function(it){var v=itemVal(it,M);if(v>0&&(!top||v>top.v))top={name:it.name||'Unnamed category',v:v}});
  if(top&&cm.spend>0){var tenth=top.v*0.1;notes.push('Your largest spending category in '+label(M)+' is '+top.name+' at '+fmt(top.v)+' ('+Math.round(top.v/cm.spend*100)+'% of recorded spending). Trimming it by 10% would free about '+money0(tenth)+' a month, or about '+money0(tenth*12)+' over 12 months.')}
  h+='<section class="insight-card"><h2>Savings suggestions</h2>';
  if(!notes.length)notes.push('Add income and spending amounts for at least three months to unlock comparisons. Suggestions stay limited when records are incomplete.');
  notes.forEach(function(x){h+='<div class="insight-note">'+esc(x)+'</div>'});
  h+='<p class="insight-small">Estimates only, not financial advice.</p></section>';
  /* 3. calculators */
  if(wiAmt==null){wiAmt=c.income>0?Math.max(50,Math.round(c.income*0.1/50)*50):500}
  h+=hL;
  h+='<section class="insight-card"><h2>Savings planner</h2><div class="status" style="font-weight:600">What if I save more?</div><div class="whatif"><label for="whatif-monthly">Extra saved each month</label><input id="whatif-monthly" type="text" inputmode="decimal" value="'+esc(wiAmt)+'"></div><div class="whatif"><label for="whatif-months">How many months?</label><input id="whatif-months" type="number" min="1" max="600" step="1" inputmode="numeric" value="'+esc(wiMonths)+'"></div><div><div class="status">Estimated total saved</div><div id="whatif-result" class="whatif-result"></div><p id="whatif-caption" class="insight-small"></p></div>';
  h+='<div class="status" style="font-weight:600;margin-top:6px">Goal planner</div><div class="whatif"><label for="goal-target">Savings target</label><input id="goal-target" type="text" inputmode="decimal" value="'+(goal.target||'')+'" placeholder="e.g. 6000"></div><div class="whatif"><label for="goal-months">In how many months?</label><input id="goal-months" type="number" min="1" max="600" step="1" inputmode="numeric" value="'+esc(goal.months||6)+'"></div><div id="goal-result" class="insight-note"></div></section>';
  /* 4. overview */
  h+='<section class="insight-card"><h2>Spending overview</h2>';
  h+='<div class="srow" style="justify-content:space-between"><span>Income</span><b class="num">'+fmt(c.income)+'</b></div><div class="srow" style="justify-content:space-between"><span>Recorded outgoings</span><b class="num">'+fmt(c.out)+'</b></div><div class="srow" style="justify-content:space-between"><span>Left after outgoings</span><b class="num">'+fmt(c.income-c.out)+'</b></div>';
  if(c.income>0)h+='<div class="budget-meter"><i class="'+(c.out>c.income?'over':'')+'" style="width:'+Math.min(100,Math.max(0,c.out/c.income*100))+'%"></i></div><p>'+Math.round(c.out/c.income*100)+'% of recorded income is allocated to outgoings. Savings entries are included in outgoings.</p>';
  h+='</section>';
  $('insights').innerHTML=h;
  updateWhatIf();updateGoal(true);
  if(keepId){var n=document.getElementById(keepId);if(n&&n!==document.activeElement)n.focus()}
}
function updateWhatIf(){
  var a=document.getElementById('whatif-monthly'),m=document.getElementById('whatif-months'),r=document.getElementById('whatif-result'),cap=document.getElementById('whatif-caption');if(!a||!m||!r)return;
  var amount=Math.max(0,num(a.value)),months=Math.max(1,Math.min(600,Math.round(num(m.value)||1)));
  wiAmt=amount;wiMonths=months;
  r.textContent=fmt(amount*months);
  if(cap)cap.textContent=fmt(amount)+' × '+months+(months===1?' month':' months')+', assuming you can set aside that amount each month.';
}
function updateGoal(fromRender){
  var t=document.getElementById('goal-target'),m=document.getElementById('goal-months'),r=document.getElementById('goal-result');if(!t||!m||!r)return;
  var target=Math.max(0,num(t.value)),months=Math.max(1,Math.min(600,Math.round(num(m.value)||1)));
  if(!fromRender){state.goal={target:target,months:months};save()}
  if(!(target>0)){r.textContent='Enter a target to see how much to set aside each month.';return}
  var need=target/months,c=calc(cur),room=c.income-(c.bill+c.spend+c.card+c.loan),txt=fmt(target)+' in '+months+' month'+(months===1?'':'s')+' needs about '+fmt(need)+' per month.';
  if(c.income>0){
    if(room>=need)txt+=' In '+label(cur)+' you have '+fmt(room)+' left after bills, spending, cards and loans, which covers it with '+fmt(room-need)+' to spare.';
    else if(room>0)txt+=' In '+label(cur)+' you have '+fmt(room)+' left after bills, spending, cards and loans, which is '+fmt(need-room)+' short. At '+fmt(room)+' a month it would take about '+Math.ceil(target/room)+' months.';
    else txt+=' In '+label(cur)+' nothing is left after bills, spending, cards and loans, so this goal needs room in the budget first.';
  }else txt+=' Add income for '+label(cur)+' to compare it with your budget.';
  r.textContent=txt;
}
function renderStrip(){
  var y=cur.split('-')[0],h='';
  $('stripLbl').innerHTML='12-month overview <small>Remaining balance by month, '+y+'</small>';
  for(var i=1;i<=12;i++){
    var m=y+'-'+String(i).padStart(2,'0'),r=balance(m),any=r.c.income||r.c.out;
    h+='<button class="tile'+(m===cur?' sel':'')+'" data-act="goto" data-m="'+m+'" aria-label="'+label(m)+'"><div class="m">'+MONTHS[i-1]+'</div><div class="v num '+(any?(r.bal<0?'neg':'pos'):'none')+'">'+(any?compact(r.bal):'–')+'</div></button>';
  }
  $('strip').innerHTML=h;
}
function pctLbl(k,c){if(k==='income')return 'Total income';return c.income>0?Math.round(c[k]/c.income*100)+'% of income':'–'}
function updateTotals(){
  var c=calc(cur);
  KINDS.forEach(function(K){var e=document.querySelector('[data-total="'+K.k+'"]');if(e)e.textContent=fmt(c[K.k]);var q=document.querySelector('[data-pct="'+K.k+'"]');if(q)q.textContent=pctLbl(K.k,c)});
}
function tsLbl(ts){if(!(ts>0))return '';var d=new Date(ts);if(isNaN(d))return '';var o=MONTHS[d.getMonth()]+' '+d.getDate();return d.getFullYear()===new Date().getFullYear()?o:o+', '+d.getFullYear()}
function dtHTML(o){var t=tsLbl(o.ts);return t?'<span class="dt" title="Last changed '+esc(t)+'">'+esc(t)+'</span>':''}
function touchTs(o){if(o)o.ts=Date.now()}
function syncDate(id){
  var o=findItem(id)||findLoan(id),row=document.querySelector('.row[data-id="'+id+'"]');if(!o||!row)return;
  var nm=row.querySelector('.nm');if(!nm)return;var d=nm.querySelector('.dt'),t=tsLbl(o.ts);
  if(!t){if(d)d.remove();return}
  if(!d){d=document.createElement('span');d.className='dt';var f=nm.firstChild;if(f&&f.nextSibling)nm.insertBefore(d,f.nextSibling);else nm.appendChild(d)}
  d.textContent=t;d.title='Last changed '+t;
}
function payBtn(o){var on=!!(o.paid&&o.paid[cur]);return '<button class="paybtn'+(on?' on':'')+'" data-act="paidtog" data-id="'+o.id+'" aria-pressed="'+on+'" title="'+(on?'Marked paid. Tap to undo':'Mark paid for '+FULL[+cur.split('-')[1]-1])+'">'+(on?'Paid ✓':'Mark paid')+'</button>'}
function itemRow(K,it){
  var v=itemVal(it,cur),def=itemDefault(it,cur),edited=it.repeat&&it.usual&&Object.prototype.hasOwnProperty.call(it.over,cur)&&num(it.over[cur])!==def;
  var open=openId===it.id,h='<div class="row" data-id="'+it.id+'"><div class="line">'+
    '<div class="nmw"><button class="nm" data-act="toggle" data-id="'+it.id+'" aria-expanded="'+open+'" title="Edit details">'+(it.name?esc(it.name):'<span style="color:var(--muted)">Untitled</span>')+dtHTML(it)+
    (payKind(K.k)?(it.due?'<small>due '+ord(it.due)+'</small>':(K.k==='bill'&&it.repeat?'<small>every month</small>':'<small>set due day</small>')):(it.repeat?'<small>every month</small>':''))+(edited?'<span class="edited" title="Different from the usual amount this month"></span>':'')+'</button>'+(payKind(K.k)&&v>0&&needsPaid(it,cur)?payBtn(it):'')+'</div>'+
    '<input class="amt num" inputmode="decimal" data-field="amt" data-id="'+it.id+'" value="'+inputVal(v)+'" placeholder="0.00" aria-label="'+esc(it.name||K.noun)+' amount for '+label(cur)+'"></div>';
  if(payKind(K.k)&&v>0){h+='<div class="sub2">'+(needsPaid(it,cur)?(it.due?'Due on the '+ord(it.due):'Set a due day in the details')+' · '+((it.paid&&it.paid[cur])?'Paid · counted in your balance':'Not paid yet · not deducted'):'Earlier month · counted as paid')+'</div>'}
  if(open){
    h+='<div class="edit">'+
      '<label>Name<input data-field="name" data-id="'+it.id+'" list="s-'+K.k+'" value="'+esc(it.name)+'" placeholder="Name"></label>'+
      '<label>Usual amount<input class="num" inputmode="decimal" data-field="usual" data-id="'+it.id+'" value="'+inputVal(it.usual)+'" placeholder="0.00"></label>'+
      '<label>Starting from<input data-field="start" data-id="'+it.id+'" type="month" value="'+(it.start||'')+'" placeholder="YYYY-MM"></label>'+
      (payKind(K.k)?'<label>Due day of month<input class="num" inputmode="numeric" data-field="due" data-id="'+it.id+'" value="'+(it.due||'')+'" placeholder="1 to 31"></label>':'')+
      '<label class="chk"><input type="checkbox" data-field="repeat" data-id="'+it.id+'"'+(it.repeat?' checked':'')+'> Repeats every month</label>'+
      '<div class="acts">'+(confirmAct==='rm'+it.id?'<button class="linkbtn danger" data-act="remove" data-mode="from" data-id="'+it.id+'">Remove from '+short(cur)+' on</button><button class="linkbtn danger" data-act="remove" data-mode="all" data-id="'+it.id+'">Delete all months</button><button class="linkbtn" data-act="rmcancel" data-id="'+it.id+'">Cancel</button>':'<button class="linkbtn danger" data-act="remove" data-id="'+it.id+'">Remove</button>')+
      (edited?'<button class="linkbtn" data-act="resetmonth" data-id="'+it.id+'">Use the usual amount this month</button>':'')+
      '<button class="linkbtn" data-act="toggle" data-id="'+it.id+'">Done</button></div></div>';
  }
  return h+'</div>';
}
function loanRow(l){
  var n=loanN(l,cur),open=openId===l.id,last=add(l.first,l.term-1),st,pct=Math.max(0,Math.min(l.term,n))/l.term*100;
  var pre=idx(cur)<idx(state.startMonth);
  if(pre)st='Before tracking started · not counted';
  else if(n<1)st='Starts in '+(1-n)+(1-n===1?' month':' months')+' · first payment '+short(l.first);
  else if(n>l.term)st='Paid off in '+short(last);
  else if(n===l.term)st='Final payment · '+l.term+' of '+l.term;
  else st='Payment '+n+' of '+l.term+' · '+(l.term-n)+' left · ends '+short(last);
  var h='<div class="row" data-id="'+l.id+'"><div class="line"><div class="nmw"><button class="nm" data-act="toggle" data-id="'+l.id+'" aria-expanded="'+open+'" title="Edit details">'+(l.name?esc(l.name):'<span style="color:var(--muted)">Untitled</span>')+dtHTML(l)+(l.due?'<small>due '+ord(l.due)+'</small>':'')+'</button>'+(loanVal(l,cur)>0?payBtn(l):'')+'</div>'+
    '<input class="amt num" readonly tabindex="-1" aria-label="'+esc(l.name)+' payment for '+label(cur)+'" value="'+inputVal(loanVal(l,cur))+'" placeholder="–"></div>'+
    '<div class="sub2">'+st+(loanVal(l,cur)>0?' · '+(l.due?'Due on the '+ord(l.due)+' · ':'')+((l.paid&&l.paid[cur])?'Paid':'Not paid yet · not deducted'):'')+'<div class="prog"><i style="width:'+pct.toFixed(1)+'%"></i></div></div>';
  if(open){
    h+='<div class="edit">'+
      '<label>Name<input data-field="lname" data-id="'+l.id+'" value="'+esc(l.name)+'" placeholder="Loan name"></label>'+
      '<label>Monthly payment<input class="num" inputmode="decimal" data-field="lpay" data-id="'+l.id+'" value="'+inputVal(l.pay)+'" placeholder="0.00"></label>'+
      '<label>Number of payments<input class="num" inputmode="numeric" data-field="lterm" data-id="'+l.id+'" value="'+l.term+'"></label>'+
      '<label>Due day of month<input class="num" inputmode="numeric" data-field="ldue" data-id="'+l.id+'" value="'+(l.due||'')+'" placeholder="1 to 31"></label>'+
      '<label>First payment month<input data-field="lfirst" data-id="'+l.id+'" type="month" value="'+l.first+'" placeholder="YYYY-MM"></label>'+
      '<div class="acts"><button class="linkbtn danger" data-act="remove" data-id="'+l.id+'">'+(confirmAct==='rm'+l.id?'Click again to remove':'Remove')+'</button><button class="linkbtn" data-act="toggle" data-id="'+l.id+'">Done</button></div></div>';
  }
  return h+'</div>';
}
function collectRow(c){
  var st=clStatus(c,cur),canTick=st.state==='open'||st.state==='done',pct=c.term?Math.min(100,clPaidCount(c)/c.term*100):0;
  return '<div class="row" data-id="'+c.id+'"><div class="line"><button class="nm" data-act="golist" title="Open on the Collectibles page">'+(c.name?esc(c.name):'<span style="color:var(--muted)">Untitled</span>')+'<small>'+esc(c.cat)+'</small></button>'+
    '<input class="amt num" readonly tabindex="-1" aria-label="'+esc(c.name)+' amount for '+label(cur)+'" value="'+inputVal(st.sched)+'" placeholder="–"></div>'+
    '<div class="sub2"><span'+(st.late?' style="color:var(--neg)"':'')+'>'+esc(st.text)+'</span>'+(canTick?'<div><label style="display:inline-flex;gap:6px;align-items:center;color:var(--ink);margin-top:4px"><input type="checkbox" data-field="clpaid" data-id="'+c.id+'"'+(st.state==='done'?' checked':'')+'> Collected for '+FULL[+cur.split('-')[1]-1]+'</label></div>':'')+'<div class="prog cl"><i style="width:'+pct.toFixed(1)+'%"></i></div></div></div>';
}
function renderSections(){
  var c=calc(cur),h='';
  KINDS.forEach(function(K){
    var rows='',list,folded=!!(state.collapsed&&state.collapsed[K.k]);
    if(K.k==='loan'){list=state.loans;rows=list.map(loanRow).join('')}
    else if(K.k==='collect'){list=clSort(CLd());rows=list.map(collectRow).join('')}
    else{list=state.items.filter(function(i){return i.kind===K.k&&(itemShown(i,cur)||i.id===openId)});rows=list.map(function(i){return itemRow(K,i)}).join('')}
    if(!list.length){
      rows='<div class="empty">No '+K.title.toLowerCase()+' yet.'+(K.k==='loan'||K.k==='collect'?'':(K.sugg.length?' Quick start:':''))+
        (K.sugg.length&&K.k!=='loan'&&K.k!=='collect'?'<div class="chips">'+K.sugg.map(function(s){return '<button class="chip" data-act="addnamed" data-kind="'+K.k+'" data-name="'+esc(s)+'">'+esc(s)+'</button>'}).join('')+'</div>':'')+'</div>';
    }
    var ltx=txMonth(cur).filter(function(x){return x.kind===K.k});
    if(ltx.length){var lsum=ltx.reduce(function(q,x){return q+x.amount},0);rows+='<div class="row"><div class="sub2" style="padding-top:10px">'+ltx.length+' logged transaction'+(ltx.length===1?'':'s')+' · '+fmt(lsum)+' included · <a href="#/transactions" data-nav data-v="tx" style="color:var(--accent)">View</a></div></div>'}
    h+='<section class="panel'+(folded?' folded':'')+'" style="--cc:var('+(K.k==='income'?'--pos':K.color)+')" aria-label="'+K.title+'"><div class="ph"><h2><button class="foldbtn" data-act="fold" data-kind="'+K.k+'" aria-expanded="'+(!folded)+'"><span class="chev" aria-hidden="true">&#9654;</span><span class="pn">'+K.title+(K.hint?' <span class="khint">'+K.hint+'</span>':'')+'</span></button></h2><span class="tot"><b class="num" data-total="'+K.k+'">'+fmt(c[K.k])+'</b><small data-pct="'+K.k+'">'+pctLbl(K.k,c)+'</small></span></div>'+(folded?'':rows+
      '<div class="add"><button class="tbtn" data-act="add" data-kind="'+K.k+'">+ Add '+K.noun+'</button>'+(payKind(K.k)&&list.some(function(i){return i.due>0&&(K.k==='card'||i.repeat)})?'<button class="tbtn" data-act="cal" data-kind="'+K.k+'">Add due dates to my calendar</button>':'')+'</div>')+'</section>';
  });
  var allc=KINDS.every(function(K){return state.collapsed&&state.collapsed[K.k]});
  $('foldbar').innerHTML='<span class="catlbl">Categories</span><button class="tbtn" data-act="foldall">'+(allc?'Expand all':'Collapse all')+'</button>';
  $('sections').innerHTML=h;
}
var settingsOpener=null;
function popAnim(el){if(!el)return;el.classList.add('anim');clearTimeout(el._anim);el._anim=setTimeout(function(){el.classList.remove('anim')},450)}
function syncLock(){document.documentElement.classList.toggle('modal-open',!!(showSettings||nbOpen))}
function focusables(root){return [].filter.call(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'),function(n){return n.offsetParent!==null&&!n.closest('[hidden]')})}
function setSettings(open){
  if(open===showSettings)return;
  showSettings=open;
  if(open)settingsOpener=document.activeElement;
  renderSettings();
  if(open)popAnim($('settings'));
  syncLock();
  if(open){setTimeout(function(){var x=document.querySelector('#settings .set-x');if(x)x.focus({preventScroll:true})},0)}
  else{var o=settingsOpener;settingsOpener=null;setTimeout(function(){if(o&&o.focus&&o.offsetParent!==null)o.focus({preventScroll:true});else{var b=$('setBtn');if(b&&b.offsetParent!==null)b.focus({preventScroll:true})}},0)}
}
function renderSettings(){
  var el=$('settings');el.hidden=!showSettings;$('setBtn').setAttribute('aria-expanded',String(showSettings));
  syncLock();
  if(!showSettings)return;
  var pb=el.querySelector('.set-body'),keepTop=pb?pb.scrollTop:0,ae=document.activeElement,keepSel=null;
  if(ae&&el.contains(ae)){if(ae.id)keepSel='#'+ae.id;else if(ae.getAttribute('data-act')){keepSel='[data-act="'+ae.getAttribute('data-act')+'"]'+(ae.getAttribute('data-color')?'[data-color="'+ae.getAttribute('data-color')+'"]':'')+(ae.getAttribute('data-mode')?'[data-mode="'+ae.getAttribute('data-mode')+'"]':'')}}
  var opts=CURRENCIES.map(function(c){return '<option'+(c===state.currency?' selected':'')+'>'+esc(c)+'</option>'}).join('');
  if(CURRENCIES.indexOf(state.currency)<0)opts='<option selected>'+esc(state.currency)+'</option>'+opts;
  var X='<svg viewBox="0 0 24 24" aria-hidden="true" class="i"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  el.innerHTML='<div class="set-card" role="dialog" aria-modal="true" aria-labelledby="setTitle"><div class="set-head"><h2 id="setTitle">Settings</h2><button type="button" class="set-x" data-act="settings" aria-label="Close settings">'+X+'</button></div><div class="set-body">'+
    '<div class="set-sec"><h3 class="set-h">Google Drive</h3>'+googleSettingsHTML()+'</div>'+
    '<div class="set-sec"><h3 class="set-h">Theme</h3>'+themeHTML()+'</div>'+
    '<div class="set-sec"><h3 class="set-h">Budget options</h3><div class="sgrid">'+
    '<label>Currency symbol<select id="set-cur">'+opts+'</select></label>'+
    '<label>Remind me before a bill, card or collectible is due (days)<input class="num" id="set-remind" inputmode="numeric" value="'+remindDays()+'"></label>'+
    '<label class="chk" style="align-self:end;padding-bottom:8px"><input type="checkbox" id="set-carry"'+(state.carry?' checked':'')+'> Carry leftover money into the next month</label>'+
    '<label>Tracking starts in<input id="set-start" type="month" value="'+state.startMonth+'" placeholder="YYYY-MM"></label>'+(state.carry?'<label>Money on hand at the start<input class="num" id="set-open" inputmode="decimal" value="'+inputVal(state.opening)+'" placeholder="0.00"></label>':'')+
    '</div></div>'+
    '<div class="set-sec"><h3 class="set-h">Backup and reset</h3><div class="srow"><button class="tbtn" data-act="export">Download a backup</button>'+
    '<label class="tbtn" for="set-file" style="cursor:pointer">Restore a backup</label><input id="set-file" type="file" accept=".json,application/json" hidden>'+
    '<button class="tbtn" data-act="exporttext">Copy backup as text</button><button class="tbtn" data-act="pasteopen">Restore from text</button>'+
    '<button class="tbtn" data-act="sample">'+(confirmAct==='sample'?'Click again to confirm':'Load the sample budget')+'</button>'+
    '<button class="tbtn" data-act="blank2">'+(confirmAct==='blank2'?'Click again to erase everything':'Erase and start blank')+'</button></div><div id="backupBox"></div></div>'+
    '<div class="set-sec"><h3 class="set-h">Excel and CSV</h3><div class="srow"><label class="status" for="xl-year">Year</label><select id="xl-year" class="tbtn">'+xlYearOptions()+'</select><button class="tbtn" data-act="xl-xlsx">Export to Excel</button><button class="tbtn" data-act="xl-csv">Export to CSV</button>'+
    '<label class="tbtn" for="imp-file" style="cursor:pointer">Import from Excel or CSV</label><input id="imp-file" type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>'+(imUndo?'<button class="tbtn" data-imp="undo">Undo last import or restore</button>':'')+'</div>'+
    '<div class="status">Import links the rows in your file to your categories, and nothing leaves your device.</div></div>'+
    '<div class="status">Your budget saves automatically. A backup file lets you move it to another device.</div></div>'+
    '<div class="set-foot"><button type="button" class="tbtn primary" data-act="settings">Done</button></div></div>';
  var nb=el.querySelector('.set-body');if(nb)nb.scrollTop=keepTop;
  if(keepSel){var kn=el.querySelector(keepSel);if(kn&&kn!==document.activeElement)try{kn.focus({preventScroll:true})}catch(x){}}
}
function renderAll(){applyTheme(state.theme||lsGet('ebt.theme')||'blue-dark');renderHeader();renderNotice();renderDue();renderHero();renderInsights();renderStrip();renderKpis();renderRecent();renderSections();renderSettings();renderPages();syncDark();setStatus(statusText)}

/* ---------- actions ---------- */
function findItem(id){return state.items.filter(function(i){return i.id===id})[0]}
function findLoan(id){return state.loans.filter(function(i){return i.id===id})[0]}
var insTimer=null;
function scheduleInsights(){clearTimeout(insTimer);insTimer=setTimeout(renderInsights,0)}
function refresh(){renderHero();scheduleInsights();renderStrip();renderKpis();renderRecent();updateTotals();renderDue();try{if(viewName()==='tx'&&$('txList'))renderTxList()}catch(x){}}
function keepFocus(fn){
  var ae=document.activeElement,f=ae&&ae.getAttribute&&ae.getAttribute('data-field'),id=ae&&ae.getAttribute&&ae.getAttribute('data-id'),val=ae?ae.value:null,ss=null,se=null;
  try{ss=ae.selectionStart;se=ae.selectionEnd}catch(x){}
  fn();
  if(f&&id){var n=document.querySelector('[data-field="'+f+'"][data-id="'+id+'"]');
    if(n){if(n!==document.activeElement)n.focus();if(n.type!=='checkbox'&&val!=null&&n.value!==val)n.value=val;try{if(ss!=null)n.setSelectionRange(ss,se)}catch(x){}}}
}
function focusSoon(sel){setTimeout(function(){var e=document.querySelector(sel);if(e){e.focus();if(e.select)e.select()}},0)}

document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-act]');if(!b)return;
  var act=b.getAttribute('data-act'),id=b.getAttribute('data-id'),kind=b.getAttribute('data-kind');
  if(act!=='remove'&&act!=='sample'&&act!=='blank2')confirmAct=null;
  if(act==='prev'){cur=add(cur,-1);renderAll()}
  else if(act==='next'){cur=add(cur,1);renderAll()}
  else if(act==='today'){cur=ymNow();renderAll()}
  else if(act==='goto'){cur=b.getAttribute('data-m');renderAll()}
  else if(act==='settings'){setSettings(!showSettings)}
  else if(act==='keep'){state.sample=false;save();renderNotice()}
  else if(act==='reloadtab'){adoptStored()}
  else if(act==='dismissbad'){corruptSeen();renderNotice()}
  else if(act==='dlbad'){var raw=lsGet(KEY+'.corrupt')||'';xlDownload('budget-unreadable-copy.json',new Blob([raw],{type:'application/json'}),'Saved a copy of the unreadable data')}
  else if(act==='recoverbad'){var rm=$('badMsg');try{var rs=sane(parseBackup(lsGet(KEY+'.corrupt')||''));if(!rs)throw 0;state=rs;state.sample=false;openId=null;corruptSeen();save();renderAll()}catch(x){if(rm)rm.textContent='It could not be recovered automatically. Tap Download the copy and keep that file safe.'}}
  else if(act==='blank'){var nb=blank();nb.currency=state.currency;nb.theme=state.theme;nb.remind=state.remind;state=nb;openId=null;save();renderAll()}
  else if(act==='toggle'){openId=(openId===id?null:id);renderSections();if(openId)focusSoon('[data-field="name"][data-id="'+id+'"],[data-field="lname"][data-id="'+id+'"]')}
  else if(act==='golist'){go('collect')}
  else if(act==='add'&&kind==='collect'){go('collect');focusSoon2('#clName')}
  else if(act==='add'||act==='addnamed'){
    var nm=act==='addnamed'?b.getAttribute('data-name'):'';
    /* v9.29: if an empty row of this kind is already open for this month, use it instead of piling up another */
    if(act==='add'){
      var blankRow=(kind==='loan'?state.loans.filter(function(l){return !(l.name||'').trim()&&!(l.pay>0)&&l.first===cur}):state.items.filter(function(i){return i.kind===kind&&!(i.name||'').trim()&&itemShown(i,cur)&&!itemVal(i,cur)&&!i.usual}))[0];
      if(blankRow){openId=blankRow.id;renderSections();focusSoon('[data-field="name"][data-id="'+blankRow.id+'"],[data-field="lname"][data-id="'+blankRow.id+'"]');toast('You already have an empty row. Fill it in first.');return}
    }
    state.sample=false;
    if(kind==='loan'){var l={id:uid(),name:nm,pay:0,term:12,first:cur,due:0,paid:{}};state.loans.push(l);openId=l.id}
    else{var it=nm?state.items.filter(function(i){return i.kind===kind&&!itemEnded(i,cur)&&!itemShown(i,cur)&&i.name.trim().toLowerCase()===nm.trim().toLowerCase()})[0]:null;
      if(it){it.over[cur]=0;openId=it.id}
      else{it={id:uid(),kind:kind,name:nm,usual:0,repeat:false,start:cur,over:{}};state.items.push(it);openId=it.id}}
    logAdd(openId,kind,nm,cur);
    save();renderNotice();renderSections();focusSoon('[data-field="name"][data-id="'+openId+'"],[data-field="lname"][data-id="'+openId+'"]');
    if(act==='addnamed')focusSoon('[data-field="amt"][data-id="'+openId+'"]');
    refresh();
  }
  else if(act==='rmcancel'){confirmAct=null;renderSections()}
  else if(act==='remove'&&findItem(id)&&confirmAct==='rm'+id&&b.getAttribute('data-mode')==='from'){
    var ei=findItem(id),endM=add(cur,-1),hist=Object.keys(ei.over).some(function(k){return k<=endM&&num(ei.over[k])>0})||(ei.repeat&&ei.usual>0&&(!ei.start||ei.start<=endM));
    logRemove(ei.id,ei.kind,ei.name,itemVal(ei,cur),cur);
    if(hist){ei.end=endM;Object.keys(ei.over).forEach(function(k){if(k>endM)delete ei.over[k]})}
    else{state.items=state.items.filter(function(i){return i.id!==id});if(state.budgets&&state.budgets.categories)delete state.budgets.categories[id];if(state.grocery&&state.grocery.link===id)state.grocery.link=''}
    openId=null;confirmAct=null;save();renderAll();
  }
  else if(act==='remove'){
    if(confirmAct==='rm'+id){var rmI=findItem(id),rmL=findLoan(id);if(rmI)logRemove(rmI.id,rmI.kind,rmI.name,itemVal(rmI,cur),cur);else if(rmL)logRemove(rmL.id,'loan',rmL.name,loanVal(rmL,cur),cur);state.items=state.items.filter(function(i){return i.id!==id});state.loans=state.loans.filter(function(i){return i.id!==id});if(state.budgets&&state.budgets.categories)delete state.budgets.categories[id];if(state.grocery&&state.grocery.link===id)state.grocery.link='';openId=null;confirmAct=null;save();renderAll()}
    else{confirmAct='rm'+id;renderSections()}
  }
  else if(act==='resetmonth'){var it2=findItem(id);if(it2){var rb=itemVal(it2,cur);delete it2.over[cur];logAmt(it2.id,it2.kind,it2.name,cur,rb,itemVal(it2,cur));save();renderSections();refresh()}}
  else if(act==='paid'){var pi=findItem(id)||findLoan(id),pm=b.getAttribute('data-m');if(pi&&validYM(pm)){if(!pi.paid)pi.paid={};pi.paid[pm]=true;state.sample=false;save();renderSections();refresh()}}
  else if(act==='paidtog'){var pt=findItem(id)||findLoan(id);if(pt){if(!pt.paid)pt.paid={};if(pt.paid[cur])delete pt.paid[cur];else pt.paid[cur]=true;state.sample=false;save();renderSections();refresh()}}
  else if(act==='cpaid'){var cc2=CLd().filter(function(x){return x.id===id})[0],cm=b.getAttribute('data-m');if(cc2&&validYM(cm)){clCollect(cc2,cm);trackOnce('collectible-marked-paid');state.sample=false;save();renderSections();refresh()}}
  else if(act==='duemore'){dueAll=!dueAll;renderDue()}
  else if(act==='cal'){doCalendar(kind)}
  else if(act==='fold'){state.collapsed=state.collapsed||{};if(state.collapsed[kind])delete state.collapsed[kind];else state.collapsed[kind]=true;save();renderSections();focusSoon('[data-act="fold"][data-kind="'+kind+'"]')}
  else if(act==='foldall'){var every=KINDS.every(function(K){return state.collapsed&&state.collapsed[K.k]});state.collapsed={};if(!every)KINDS.forEach(function(K){state.collapsed[K.k]=true});save();renderSections()}
  else if(act==='theme-color'||act==='theme-mode'){var ct=themeOf(themeOk(state.theme)?state.theme:'blue-dark');var tid=themeId(act==='theme-color'?b.getAttribute('data-color'):ct.color,act==='theme-mode'?b.getAttribute('data-mode'):ct.mode);if(themeOk(tid)){state.theme=tid;applyTheme(tid);save();renderSettings();renderInsights()}}
  else if(act==='export'){doExport()}
  else if(act==='exporttext'){exportText()}
  else if(act==='pasteopen'){pasteOpen()}
  else if(act==='pasterestore'){applyBackup($('pasteIn')?$('pasteIn').value:'',$('backupBox'))}
  else if(act==='gbtn'||act==='gin'){gSignIn()}
  else if(act==='gout'){gSignOut()}
  else if(act==='gsync'){gManualSync()}
  else if(act==='sample'){if(confirmAct==='sample'){state=sample();confirmAct=null;openId=null;save();renderAll()}else{confirmAct='sample';renderSettings()}}
  else if(act==='blank2'){if(confirmAct==='blank2'){state=blank();confirmAct=null;openId=null;save();renderAll()}else{confirmAct='blank2';renderSettings()}}
});
var firstEnt={},usualBefore={};
function patchName(id){
  var it=findItem(id)||findLoan(id),row=document.querySelector('.row[data-id="'+id+'"]');
  if(!it||!row)return;var nm=row.querySelector('.nm');if(!nm)return;
  var first=nm.firstChild,node;
  if(it.name)node=document.createTextNode(it.name);
  else{node=document.createElement('span');node.style.color='var(--muted)';node.textContent='Untitled'}
  if(first)nm.replaceChild(node,first);else nm.appendChild(node);
  var am=row.querySelector('input.amt');if(am)am.setAttribute('aria-label',(it.name||'Item')+' amount for '+label(cur));
}
function applyUsual(it,n){
  var oldDef=itemDefault(it,cur);
  it.usual=n;
  if(!it.repeat){it.over[cur]=n}
  else{
    if(!it.start)it.start=cur;
    if(Object.prototype.hasOwnProperty.call(it.over,cur)&&(num(it.over[cur])===oldDef||!num(it.over[cur])))delete it.over[cur];
  }
}
document.addEventListener('input',function(ev){
  var e=ev.target; if(e.id==='whatif-monthly'||e.id==='whatif-months'){updateWhatIf();try{if(!sessionStorage.getItem('ebt.whatif.event')){track('savings-calculator-used');sessionStorage.setItem('ebt.whatif.event','1')}}catch(x){}return}
  if(e.id==='goal-target'||e.id==='goal-months'){updateGoal(false);if(!goalUsed&&num(document.getElementById('goal-target').value)>0){goalUsed=true;track('goal-planner-used')}return}
  var f=e.getAttribute('data-field'),id=e.getAttribute('data-id');
  if(f==='usual'){
    var ui=findItem(id);if(!ui)return;if(amtProblem(e.value,ui.kind))return;
    applyUsual(ui,num(e.value));touchTs(ui);state.sample=false;save();
    var ab=document.querySelector('.row[data-id="'+id+'"] [data-field="amt"]');if(ab)ab.value=inputVal(itemVal(ui,cur));
    syncDot(id);refresh();return;
  }
  if(f==='amt'){
    var it=findItem(id);if(!it)return;if(amtProblem(e.value,it.kind))return;var n=num(e.value),beforeV=itemVal(it,cur);state.sample=false;try{if(n>0&&!localStorage.getItem('ebt.first-amount-event')){track('first-budget-amount-entered');localStorage.setItem('ebt.first-amount-event','1')}}catch(x){}
    if(firstEnt[id]===cur||(it.repeat&&!it.usual&&!Object.keys(it.over).length)){firstEnt[id]=cur;it.usual=n;it.start=cur;delete it.over[cur]}
    else it.over[cur]=n;
    touchTs(it);logAmt(it.id,it.kind,it.name,cur,beforeV,itemVal(it,cur));
    save();syncDot(id);syncDate(id);refresh();renderRecent();
    var nt=$('notice');if(nt.firstChild)renderNotice();
  }
});
document.addEventListener('keydown',function(ev){var e=ev.target;if(ev.key==='Enter'&&e&&e.getAttribute&&e.getAttribute('data-budget')){e.blur()}});
document.addEventListener('focusin',function(ev){var e=ev.target;if(e.getAttribute&&e.getAttribute('data-field')==='amt'){var v0=e.value,sI=findItem(e.getAttribute('data-id'));if(sI)amtSnap[sI.id]=snapItem(sI);setTimeout(function(){/* v9.29: only select if the user has not typed since focus (else the first typed character was replaced by the next one) */try{if(document.activeElement===e&&e.value===v0&&e.selectionStart===e.selectionEnd)e.select()}catch(x){}},0)}if(e.getAttribute&&e.getAttribute('data-field')==='usual'){var fi=findItem(e.getAttribute('data-id'));if(fi){usualBefore[fi.id]=itemVal(fi,cur);amtSnap[fi.id]=snapItem(fi)}}});
function syncDot(id){
  var it=findItem(id),row=document.querySelector('.row[data-id="'+id+'"]');if(!it||!row)return;
  var nm=row.querySelector('.nm'),dot=nm.querySelector('.edited');
  var edited=it.repeat&&it.usual&&Object.prototype.hasOwnProperty.call(it.over,cur)&&num(it.over[cur])!==itemDefault(it,cur);
  if(edited&&!dot){var sp=document.createElement('span');sp.className='edited';sp.title='Different from the usual amount this month';nm.appendChild(sp)}
  else if(!edited&&dot)dot.remove();
}
var amtSnap={};
function snapItem(it){return {usual:it.usual,start:it.start,hadStart:Object.prototype.hasOwnProperty.call(it,'start'),hadOver:Object.prototype.hasOwnProperty.call(it.over,cur),over:it.over[cur],ts:it.ts}}
/* v9.29: put an item back the way it was when the field got focus (typing live-saves each keystroke, so a rejected entry like 2+3 must undo the saved "2") */
function restoreItem(it,sn){
  var cv=itemVal(it,cur);
  it.usual=sn.usual;if(sn.hadStart)it.start=sn.start;else delete it.start;
  if(sn.hadOver)it.over[cur]=sn.over;else delete it.over[cur];
  it.ts=sn.ts;
  var bv=itemVal(it,cur);if(Math.abs(bv-cv)>=0.005)logAmt(it.id,it.kind,it.name,cur,cv,bv);
}
var toastT=null;
function toast(msg){var t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true},3500)}
function flagBad(e,msg){msg=msg||'Numbers only';if(e.dataset.badT){toast(msg);return}var ph=e.getAttribute('placeholder')||'';e.dataset.badT='1';e.classList.add('bad');e.setAttribute('aria-invalid','true');e.setAttribute('placeholder',msg);toast(msg+'. That entry was not saved.');setTimeout(function(){e.classList.remove('bad');e.removeAttribute('aria-invalid');e.setAttribute('placeholder',ph);delete e.dataset.badT},3500)}
document.addEventListener('change',function(ev){
  var g=ev.target;if(g&&g.tagName==='INPUT'&&g.type==='text'&&g.getAttribute('data-field')!=='amt'&&(g.classList.contains('num')||g.classList.contains('amtw')||g.getAttribute('inputmode')==='decimal'||g.getAttribute('inputmode')==='numeric')){var gk0=g.getAttribute('data-id')?findItem(g.getAttribute('data-id')):null,gv=g.value,gp=amtProblem(gv,gk0&&gk0.kind);if(gp){var gid=g.id;setTimeout(function(){flagBad((gid&&document.getElementById(gid))||g,gp)},0)}}
},true);
document.addEventListener('focusout',function(ev){
  var e=ev.target;if(!e.getAttribute||e.getAttribute('data-field')!=='amt')return;
  var id=e.getAttribute('data-id'),it=findItem(id);if(!it)return;
  delete firstEnt[id];
  var rawV=e.value,rawP=amtProblem(rawV,it.kind);if(rawP&&amtSnap[id])restoreItem(it,amtSnap[id]);delete amtSnap[id];if(rawP)setTimeout(function(){flagBad(document.querySelector('[data-field="amt"][data-id="'+id+'"]')||e,rawP)},0);
  if(it.usual&&it.repeat&&Object.prototype.hasOwnProperty.call(it.over,cur)&&num(it.over[cur])===itemDefault({usual:it.usual,repeat:it.repeat,start:it.start,over:{}},cur))delete it.over[cur];
  e.value=inputVal(itemVal(it,cur));save();syncDot(id);refresh();
});
document.addEventListener('change',function(ev){
  var e=ev.target,f=e.getAttribute('data-field'),id=e.getAttribute('data-id');
  if(e.tagName==='INPUT'&&e.type==='text'&&f!=='amt'&&f!=='name'&&f!=='lname'){
    var np=amtProblem(e.value,(findItem(id)||{}).kind),rv=null;
    if(np){
      if(f==='usual'){var qi=findItem(id);if(qi&&amtSnap[id]){restoreItem(qi,amtSnap[id]);delete amtSnap[id];save();setTimeout(function(){keepFocus(renderSections);refresh()},0)}rv=qi?inputVal(qi.usual):''}
      else if(f==='lpay'){var ql=findLoan(id);rv=ql?inputVal(ql.pay):''}
      else if(e.id==='set-open')rv=inputVal(state.opening);
      else if(e.getAttribute('data-budget')==='overall')rv=(state.budgets&&state.budgets.overall)||'';
      else if(e.getAttribute('data-budget')==='category')rv=(state.budgets&&state.budgets.categories&&state.budgets.categories[id])||'';
      if(rv!==null){e.value=rv;return}
    }
  }
  if(e.getAttribute('data-budget')==='overall'){state.budgets=state.budgets||{overall:0,categories:{}};state.budgets.overall=Math.max(0,num(e.value));state.sample=false;save();if(state.budgets.overall>0)track('monthly-budget-limit-set');renderInsights();return}
  if(e.getAttribute('data-budget')==='category'){state.budgets=state.budgets||{overall:0,categories:{}};state.budgets.categories=state.budgets.categories||{};if(num(e.value)>0){state.budgets.categories[id]=num(e.value);track('category-budget-limit-set')}else delete state.budgets.categories[id];state.sample=false;save();renderInsights();return}
  if(e.id==='set-cur'){state.currency=e.value;save();renderAll();return}
  if(e.id==='set-carry'){state.carry=e.checked;save();renderSettings();refresh();return}
  if(e.id==='set-start'){if(validYM(e.value)){state.startMonth=e.value;save();renderSections();refresh()}else e.value=state.startMonth;return}
  if(e.id==='set-open'){state.opening=num(e.value);e.value=inputVal(state.opening);save();refresh();return}
  if(e.id==='set-remind'){state.remind=(String(e.value).trim()===''||amtBadChars(e.value)||parseAmt(e.value)===null)?3:Math.max(0,Math.min(30,Math.round(num(e.value))||0));e.value=state.remind;save();refresh();return}
  if(e.id==='set-file'){var bf=e.files&&e.files[0];e.value='';doImport(bf);return}
  if(e.id==='set-gid'){var v=e.value.trim();try{localStorage.setItem('mbm.gclient',v)}catch(x){}gTc=null;renderAll();return}
  if(!f||f==='amt')return;
  if(f==='clpaid'){var cc=CLd().filter(function(x){return x.id===id})[0];if(cc){if(e.checked){clCollect(cc,cur);trackOnce('collectible-marked-paid')}else clUncollect(cc,cur);state.sample=false;save();renderSections();refresh()}return}
  var it=findItem(id),l=findLoan(id);
  if(it){
    if(f==='name'){var oldN=it.name;it.name=e.value.trim();logRename(it.id,it.kind,cur,oldN,it.name,itemVal(it,cur))}
    else if(f==='usual'){applyUsual(it,num(e.value));if(usualBefore[it.id]!==undefined&&usualBefore[it.id]!==itemVal(it,cur))logAmt(it.id,it.kind,it.name,cur,usualBefore[it.id],itemVal(it,cur));delete usualBefore[it.id]}
    else if(f==='start'){it.start=validYM(e.value)?e.value:null}
    else if(f==='repeat'){if(!e.checked&&it.repeat){var rf=validYM(it.start)?it.start:state.startMonth,rn=Math.min(600,idx(cur)-idx(rf));for(var rq=0;rq<=rn;rq++){var rm=add(rf,rq);if(!Object.prototype.hasOwnProperty.call(it.over,rm)){var rv=itemDefault(it,rm);if(rv)it.over[rm]=rv}}}var wasRep=it.repeat;it.repeat=e.checked;if(it.repeat&&!wasRep){it.start=cur;if(!it.usual){var cv=num(it.over[cur]);if(cv>0){it.usual=cv;delete it.over[cur]}}}}
    else if(f==='due'){it.due=Math.max(0,Math.min(31,Math.round(num(e.value))||0))}
    else if(f==='paid'){if(!it.paid)it.paid={};if(e.checked)it.paid[cur]=true;else delete it.paid[cur]}
  }else if(l){
    if(f==='lname'){var oldL=l.name;l.name=e.value.trim();logRename(l.id,'loan',cur,oldL,l.name,loanVal(l,cur))}
    else if(f==='lpay'){var oldP=loanVal(l,cur);l.pay=num(e.value);logAmt(l.id,'loan',l.name,cur,oldP,loanVal(l,cur))}
    else if(f==='lterm')l.term=Math.max(1,Math.min(600,Math.round(num(e.value))||1));
    else if(f==='ldue')l.due=Math.max(0,Math.min(31,Math.round(num(e.value))||0));
    else if(f==='lfirst'){if(validYM(e.value))l.first=e.value}
  }else return;
  if(f!=='paid')touchTs(it||l);
  state.sample=false;save();renderNotice();
  if(f==='name'||f==='lname'){patchName(id);syncDate(id);refresh();return}
  setTimeout(function(){keepFocus(renderSections);refresh()},0);
});

