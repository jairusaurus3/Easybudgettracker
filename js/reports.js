/* Easy Budget Tracker: chart helpers, Reports page and dashboard cards.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- chart helpers (plain SVG, no libraries) ---------- */
var chartN=0,CHW=480;
function setCW(full){var el=$('pgReports'),w=(el&&el.clientWidth)||360,inner=full||w<900?w-38:(w-16)/2-38;CHW=Math.max(260,Math.min(900,Math.round(inner)))}
function chH(){return Math.round(Math.min(240,Math.max(170,CHW*0.42)))}
function niceStep(r){var p=Math.pow(10,Math.floor(Math.log(r)/Math.LN10)),f=r/p;return (f<=1?1:f<=2?2:f<=5?5:10)*p}
function scaleOf(vals,ticks){
  var mn=Math.min(0,Math.min.apply(null,vals)),mx=Math.max(0,Math.max.apply(null,vals));
  if(mx===mn)mx=mn+1;
  var step=niceStep((mx-mn)/ticks),lo=Math.floor(mn/step+1e-9)*step,hi=Math.ceil(mx/step-1e-9)*step;
  return {lo:lo,hi:hi,step:step};
}
function svgDonut(parts,total,cLabel,cVal){
  var R=74,C=2*Math.PI*R,off=0,pos=parts.filter(function(p){return p.val>0});
  var h='<svg class="donut" viewBox="0 0 200 200" role="img" aria-label="'+esc(cLabel)+' '+cVal.replace(/<[^>]*>/g,'')+'"><circle cx="100" cy="100" r="'+R+'" fill="none" stroke="var(--c-left)" stroke-width="26"/>';
  pos.forEach(function(p){
    var len=p.val/total*C,gap=pos.length>1?2:0,dash=Math.max(0,len-gap);
    h+='<circle cx="100" cy="100" r="'+R+'" fill="none" stroke="var('+p.color+')" stroke-width="26" stroke-dasharray="'+dash.toFixed(2)+' '+(C-dash).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 100 100)"><title>'+esc(p.name)+': '+fmt0(p.val)+' ('+Math.round(p.val/total*100)+'%)</title></circle>';
    off+=len;
  });
  return h+'<text x="100" y="95" text-anchor="middle" class="d-lbl">'+esc(cLabel)+'</text><text x="100" y="119" text-anchor="middle" class="d-val">'+cVal+'</text></svg>';
}
function svgArea(labels,vals,color,aria){
  var W=CHW,H=chH(),pl=46,pr=10,pt=12,pb=26,n=vals.length,sc=scaleOf(vals,3),id='ag'+(++chartN);
  function X(i){return pl+(n>1?i/(n-1):.5)*(W-pl-pr)}
  function Y(v){return pt+(sc.hi-v)/(sc.hi-sc.lo)*(H-pt-pb)}
  var h='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(aria)+'"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var('+color+')" stop-opacity=".35"/><stop offset="1" stop-color="var('+color+')" stop-opacity="0"/></linearGradient></defs>';
  for(var t=sc.lo;t<=sc.hi+sc.step/2;t+=sc.step){
    var y=Y(t);h+='<line class="'+(Math.abs(t)<1e-9?'zero':'grid')+'" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/><text x="'+(pl-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+compact(t)+'</text>';
  }
  var pts=vals.map(function(v,i){return X(i).toFixed(1)+','+Y(v).toFixed(1)});
  var base=Y(Math.max(sc.lo,Math.min(0,sc.hi))).toFixed(1);
  h+='<polygon points="'+pts.join(' ')+' '+X(n-1).toFixed(1)+','+base+' '+X(0).toFixed(1)+','+base+'" fill="url(#'+id+')"/>';
  h+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="var('+color+')" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  var skip=n>8?2:1;
  vals.forEach(function(v,i){
    h+='<g><circle cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="'+(i===n-1?4.5:3.5)+'" fill="var('+color+')" stroke="var(--surface)" stroke-width="2"/><circle cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="14" fill="transparent"><title>'+esc(labels[i])+': '+fmt0(v)+'</title></circle></g>';
    if(i%skip===0)h+='<text x="'+X(i).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle">'+esc(labels[i])+'</text>';
  });
  return h+'</svg>';
}
function barPath(x,y,w,h,r){
  r=Math.min(r,h,w/2);
  return 'M'+x+','+(y+h)+'L'+x+','+(y+r)+'Q'+x+','+y+' '+(x+r)+','+y+'L'+(x+w-r)+','+y+'Q'+(x+w)+','+y+' '+(x+w)+','+(y+r)+'L'+(x+w)+','+(y+h)+'Z';
}
function svgPairs(labels,a,b,ca,cb,na,nb,aria){
  var W=CHW,H=chH(),pl=46,pr=10,pt=12,pb=26,n=labels.length,sc=scaleOf(a.concat(b),3);
  function Y(v){return pt+(sc.hi-v)/(sc.hi-sc.lo)*(H-pt-pb)}
  var slot=(W-pl-pr)/n,bw=Math.min(22,slot/3),h='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(aria)+'">';
  for(var t=sc.lo;t<=sc.hi+sc.step/2;t+=sc.step){var y=Y(t);h+='<line class="'+(Math.abs(t)<1e-9?'zero':'grid')+'" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/><text x="'+(pl-6)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+compact(t)+'</text>'}
  var y0=Y(0);
  labels.forEach(function(lb,i){
    var cx=pl+slot*i+slot/2,hs=[[a[i],ca,na,cx-bw-1],[b[i],cb,nb,cx+1]];
    hs.forEach(function(p){
      var y=Y(p[0]),hh=Math.abs(y0-y);if(hh<1)return;
      h+='<path d="'+barPath(+p[3].toFixed(1),+Math.min(y,y0).toFixed(1),bw,+hh.toFixed(1),4)+'" fill="var('+p[1]+')"><title>'+esc(lb)+' · '+esc(p[2])+': '+fmt0(p[0])+'</title></path>';
    });
    h+='<text x="'+cx.toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle">'+esc(lb)+'</text>';
  });
  return h+'</svg>';
}
function hbars(rows,total){
  return rows.map(function(r){
    var p=total>0?Math.min(100,r.val/total*100):0;
    return '<div class="hb"><div class="hb-top"><span>'+esc(r.name)+(r.sub?'<small>'+esc(r.sub)+'</small>':'')+'</span><b>'+fmt(r.val)+'</b></div><div class="hb-track"><i style="width:'+p.toFixed(1)+'%;background:var('+r.color+')"></i></div></div>';
  }).join('');
}
function legendRows(parts,total){
  return parts.map(function(p){return '<div class="lg-row"><i class="sw" style="background:var('+p.color+')"></i><span class="nm2">'+esc(p.name)+'</span><span class="pc">'+Math.round(p.val/total*100)+'%</span><b>'+fmt0(p.val)+'</b></div>'}).join('');
}
function sparkSVG(vals){
  var n=vals.length,mn=Math.min.apply(null,vals),mx=Math.max.apply(null,vals);if(mx===mn){mx+=1;mn-=1}
  var id='sp'+(++chartN);
  function X(i){return 2+(n>1?i/(n-1):.5)*156}
  function Y(v){return 6+(mx-v)/(mx-mn)*44}
  var pts=vals.map(function(v,i){return X(i).toFixed(1)+','+Y(v).toFixed(1)}).join(' ');
  return '<svg viewBox="0 0 160 60" preserveAspectRatio="none" role="img" aria-label="Remaining balance over the last '+n+' months"><defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><polygon points="'+pts+' '+X(n-1).toFixed(1)+',60 '+X(0).toFixed(1)+',60" fill="url(#'+id+')"/><polyline points="'+pts+'" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

/* ---------- Reports page ---------- */
var rpTab='spend';
function monthsBack(n){var a=[];for(var i=n-1;i>=0;i--)a.push(add(cur,-i));return a}
function groupParts(c){
  return ['bill','spend','saving','card','loan','collect'].map(function(k){return {name:KIND_LABEL[k],val:c[k],color:KIND_COLOR[k]}}).filter(function(p){return p.val>0});
}
function rcard(title,body,cls,hint){return '<section class="rcard'+(cls?' '+cls:'')+'" aria-label="'+esc(title)+'"><h3>'+esc(title)+'</h3>'+(hint?'<p class="hint">'+esc(hint)+'</p>':'')+body+'</section>'}
function emptyMsg(t){return '<p class="pg-empty">'+esc(t)+'</p>'}
function rpSpending(c){
  var h='',parts=groupParts(c),tot=c.out;
  h+=rcard('Spending by category',parts.length?'<div class="donutwrap">'+svgDonut(parts,tot,'Total out',fmt0(tot))+'<div>'+legendRows(parts,tot)+'</div></div>':emptyMsg('Nothing going out in '+label(cur)+' yet.'));
  var top=ledger(cur).filter(function(e){return e.sign<0}).sort(function(a,b){return b.amt-a.amt}).slice(0,6);
  h+=rcard('Biggest expenses',top.length?hbars(top.map(function(e){return {name:e.name,sub:KIND_LABEL[e.k],val:e.amt,color:KIND_COLOR[e.k]}}),top[0].amt):emptyMsg('No expenses to rank yet.'),'','Top six for '+label(cur));
  var ms=monthsBack(6),outs=ms.map(function(m){return calc(m).out});
  setCW(false);h+=rcard('Monthly trend',svgArea(ms.map(function(m){return MONTHS[+m.slice(5)-1]}),outs,'--c-bills','Money out per month, last 6 months'),'','Total money out, last 6 months');
  var b=state.budgets||{overall:0,categories:{}},lim='';
  var spent=c.bill+c.spend+c.card+c.loan;
  function meter(name,val,limit){var p=val/limit*100;return '<div class="hb"><div class="hb-top"><span>'+esc(name)+'</span><b>'+fmt0(val)+' of '+fmt0(limit)+'</b></div><div class="budget-meter" style="margin-top:0"><i class="'+(p>=100?'over':p>=80?'warn':'')+'" style="width:'+Math.min(100,p).toFixed(1)+'%"></i></div></div>'}
  if(b.overall>0)lim+=meter('Overall limit',spent,b.overall);
  spendCats().forEach(function(it){var l=num(b.categories[it.id]);if(l>0)lim+=meter(it.name||'Unnamed category',itemVal(it,cur),l)});
  h+=rcard('Spending limits',lim||emptyMsg('Set limits on the Insights tab to see how close you are.'),'','Based on the limits you set');
  return h;
}
function rpIncome(c){
  var h='',src=ledger(cur).filter(function(e){return e.sign>0&&e.k!=='back'}).sort(function(a,b){return b.amt-a.amt});
  var inTot=src.reduce(function(s,e){return s+e.amt},0);
  h+=rcard('Income sources',src.length?hbars(src.slice(0,8).map(function(e){return {name:e.name,sub:KIND_LABEL[e.k],val:e.amt,color:'--pos'}}),inTot)+'<div class="status">Total in: <b class="num">'+fmt(inTot)+'</b></div>':emptyMsg('No income recorded for '+label(cur)+'.'));
  setCW(false);var ms=monthsBack(6),cs=ms.map(calc),lb=ms.map(function(m){return MONTHS[+m.slice(5)-1]});
  var ins=cs.map(function(x){return x.income}),outs=cs.map(function(x){return x.out});
  h+=rcard('Income vs money out',svgPairs(lb,ins,outs,'--pos','--neg','Money in','Money out','Money in and money out per month, last 6 months')+'<div class="key"><span><i class="sw" style="background:var(--pos)"></i>Money in</span><span><i class="sw" style="background:var(--neg)"></i>Money out</span></div>','','Last 6 months');
  setCW(true);h+=rcard('Income trend',svgArea(lb,ins,'--pos','Money in per month, last 6 months'),'full');
  return h;
}
function ytdRows(y){
  var r=[];for(var i=1;i<=12;i++){var m=y+'-'+pad2(i),c=calc(m);r.push({m:m,inn:c.income,back:c.back,out:c.out,left:c.left,saving:c.saving,any:c.income||c.out||c.back})}
  return r;
}
function rpSummary(c){
  var h='',inn=c.income,rate=c.income>0?c.saving/c.income*100:0;
  h+='<div class="full stats4">'+
    '<div class="tx-stat"><span>Money in</span><b class="num in">'+fmt0(inn)+'</b></div>'+
    '<div class="tx-stat"><span>Money out</span><b class="num out">'+fmt0(c.out)+'</b></div>'+
    '<div class="tx-stat"><span>Left over</span><b class="num '+(c.left>=0?'in':'out')+'">'+fmt0(c.left)+'</b></div>'+
    '<div class="tx-stat"><span>Savings rate</span><b class="num">'+(c.income>0?rate.toFixed(0)+'%':'–')+'</b></div></div>'+(c.back>0?'<div class="full status">Left over includes '+fmt0(c.back)+' collected back from collectibles. That money was lent out, so it is not counted as income.</div>':'');
  var y=cur.slice(0,4),rows=ytdRows(y);
  setCW(true);h+=rcard('Remaining balance by month',svgArea(MONTHS,rows.map(function(r){return balance(r.m).bal}),'--accent','Remaining balance for each month of '+y),'full','Year '+y+(state.carry?', with money carried over':''));
  var tIn=0,tOut=0,tSave=0,tBack=0,tLeft=0,cnt=0;rows.forEach(function(r){tIn+=r.inn;tOut+=r.out;tSave+=r.saving;tBack+=r.back;tLeft+=r.left;if(r.any)cnt++});
  h+=rcard('Year '+y+' totals','<table class="rtable"><thead><tr><th></th><th>Total</th><th>Monthly average</th></tr></thead><tbody>'+
    '<tr><td>Money in</td><td class="in">'+fmt0(tIn)+'</td><td>'+fmt0(cnt?tIn/cnt:0)+'</td></tr>'+
    '<tr><td>Money out</td><td class="out">'+fmt0(tOut)+'</td><td>'+fmt0(cnt?tOut/cnt:0)+'</td></tr>'+
    (tBack>0?'<tr><td>Collected back</td><td>'+fmt0(tBack)+'</td><td>'+fmt0(cnt?tBack/cnt:0)+'</td></tr>':'')+
    '<tr><td>Saved</td><td>'+fmt0(tSave)+'</td><td>'+fmt0(cnt?tSave/cnt:0)+'</td></tr>'+
    '<tr><td>Left over</td><td class="'+(tLeft>=0?'in':'out')+'">'+fmt0(tLeft)+'</td><td>'+fmt0(cnt?tLeft/cnt:0)+'</td></tr></tbody></table>'+(cnt?'<div class="status">Averages use the '+cnt+(cnt===1?' month':' months')+' with entries.</div>':''));
  var p=calc(add(cur,-1)),ch='';
  ['income','bill','spend','saving','card','loan','collect'].forEach(function(k){
    var a=c[k],b=p[k];if(!a&&!b)return;
    var d=a-b,pc=b>0?Math.round(d/b*100):null;
    ch+='<div class="chg"><span>'+KIND_LABEL[k]+'</span><b class="num">'+fmt0(a)+' <span style="color:var(--muted);font-weight:500">('+(d>=0?'+':'−')+fmt0(Math.abs(d))+(pc!==null?', '+(d>=0?'+':'−')+Math.abs(pc)+'%':'')+')</span></b></div>';
  });
  h+=rcard('Compared with '+label(add(cur,-1)),ch||emptyMsg('Nothing to compare yet.'));
  var notes=[],cs=monthsBack(6).map(function(m){return {m:m,c:calc(m)}}).filter(function(x){return x.c.out>0});
  if(c.income>0)notes.push('You set aside '+rate.toFixed(0)+'% of your income as savings in '+label(cur)+'.');
  if(c.out>0&&c.income>0)notes.push('Bills, spending, savings, cards and loans take '+Math.round(c.out/c.income*100)+'% of your income.');
  var ex=ledger(cur).filter(function(e){return e.sign<0}).sort(function(a,b){return b.amt-a.amt})[0];
  if(ex)notes.push('Your biggest expense is '+ex.name+' at '+fmt0(ex.amt)+'.');
  if(cs.length>1){var mx=cs.slice().sort(function(a,b){return b.c.out-a.c.out})[0];notes.push('Money out was highest in '+label(mx.m)+' ('+fmt0(mx.c.out)+') over the last 6 months.')}
  var best=null,worst=null;
  state.items.forEach(function(it){if(it.kind!=='spend'&&it.kind!=='bill')return;var d=itemVal(it,cur)-itemVal(it,add(cur,-1));if(!d)return;if(!worst||d>worst.d)worst={n:it.name,d:d};if(!best||d<best.d)best={n:it.name,d:d}});
  if(worst&&worst.d>0)notes.push('Biggest increase since last month: '+(worst.n||'Untitled')+' (+'+fmt0(worst.d)+').');
  if(best&&best.d<0)notes.push('Biggest drop since last month: '+(best.n||'Untitled')+' (−'+fmt0(-best.d)+').');
  h+=rcard('Highlights',notes.length?'<ul class="notes">'+notes.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ul>':emptyMsg('Add some entries to see highlights.'));
  return h;
}
function renderReports(){
  var el=$('pgReports');if(!el)return;
  var c=calc(cur),any=c.income||c.out||c.back;
  var tabs=[['spend','Spending'],['income','Income'],['summary','Summary']];
  var h='<header class="pg-head"><div class="pg-eye">Your numbers</div><h2>Reports</h2><p>'+esc(label(cur))+'. Use the arrows at the top to change month.</p></header>'+
    '<div class="rp-tabs" role="tablist" aria-label="Report type">'+tabs.map(function(t){return '<button type="button" role="tab" class="'+(rpTab===t[0]?'on':'')+'" aria-selected="'+(rpTab===t[0])+'" data-rp="'+t[0]+'">'+t[1]+'</button>'}).join('')+'</div>';
  var body=rpTab==='income'?rpIncome(c):rpTab==='summary'?rpSummary(c):rpSpending(c);
  if(!any&&rpTab!=='summary')body='<div class="rcard full">'+emptyMsg('Nothing entered for '+label(cur)+' yet. Pick another month, or add entries on the Budget tab.')+'</div>';
  el.innerHTML=h+'<div class="rp-grid">'+body+'</div>';
}
document.addEventListener('click',function(ev){
  var b=ev.target.closest&&ev.target.closest('[data-rp]');if(!b)return;
  rpTab=b.getAttribute('data-rp');renderReports();
});

/* ---------- dashboard: summary cards, recent transactions ---------- */
function renderKpis(){
  var el=$('kpis');if(!el)return;
  var c=calc(cur),inc=c.income;
  var cards=[['income','Income',c.income,'--pos'],['bill','Bills',c.bill,'--c-bills'],['spend','Spending',c.spend,'--c-spend'],['saving','Savings',c.saving,'--c-save']];
  el.innerHTML=cards.map(function(k){
    var p=inc>0?Math.round(k[2]/inc*100):0,w=Math.max(0,Math.min(100,p));
    return '<div class="kpi"><div class="kpi-h"><span class="kico" style="--ic:var('+k[3]+')">'+ico(IC[k[0]])+'</span>'+k[1]+'</div><div class="kpi-v">'+fmt(k[2])+'</div><div class="kpi-p">'+(inc>0?p+'% of income':'–')+'</div><div class="prog"><i style="width:'+w+'%;background:var('+k[3]+')"></i></div></div>';
  }).join('');
}
function renderRecent(){
  var el=$('recent');if(!el)return;
  var rows=sortHist(histEntries()).slice(0,5);
  el.innerHTML='<div class="rec-h"><h2>Recent activity</h2><a href="#/transactions" data-nav data-v="tx">View all</a></div>'+
    (rows.length?'<div class="rec-head"><span>Date</span><span>Description</span><span>Category</span><span>Amount</span></div>'+rows.map(function(e){
      var bc=isBudgetChange(e);return '<div class="rec-r'+(e.v?' void':'')+(bc?' bchg':'')+'"><span class="d">'+esc(dLabel(e)+(e.ts?' · '+timeLbl(e.ts):''))+'</span><span class="n">'+esc(e.name)+'</span><span class="c">'+esc(bc?'Budget change':KIND_LABEL[e.k])+'</span><span class="a num '+(bc?'chg':(e.sign>0?'in':'out'))+'">'+(bc?'':(e.sign>0?'+':'−'))+fmt(e.amt)+'</span></div>';
    }).join(''):'<div class="empty">No transactions yet. New entries and changes to amounts or names show up here.</div>');
}
