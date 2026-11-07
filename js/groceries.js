/* Easy Budget Tracker: Grocery list and aisles.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* --- Grocery list --- */
var grSureTimer=null;
function grTarget(create){
  var G=GR();if(G.noLink)return null;
  var it=state.items.filter(function(i){return i.id===G.link&&i.kind==='spend'})[0];
  if(it)return it;
  it=state.items.filter(function(i){return i.kind==='spend'&&/grocer/i.test(i.name||'')})[0];
  if(it){G.link=it.id;return it}
  if(!create)return null;
  it={id:uid(),kind:'spend',name:'Groceries',usual:0,repeat:false,start:null,over:{},due:0,paid:{}};
  state.items.push(it);G.link=it.id;return it;
}
function budgetAdd(it,ym,delta){
  var pv=itemVal(it,ym),nv=Math.max(0,Math.round((pv+delta)*100)/100);
  if(Math.abs(nv-itemDefault(it,ym))<0.005)delete it.over[ym];else it.over[ym]=nv;
  logAmt(it.id,it.kind,it.name,ym,pv,nv);
  state.sample=false;
}
function grCheck(g){
  var t=grTarget(true),today=isoToday(),amt=g.price||0,ym=today.slice(0,7);
  g.bought=today;
  if(!t){g.applied=null;state.sample=false;return}
  g.applied={id:t.id,ym:ym,amt:amt};
  if(amt)budgetAdd(t,ym,amt);
  state.sample=false;
}
function grUncheck(g){
  if(g.applied){var it=findItem(g.applied.id);if(it&&g.applied.amt)budgetAdd(it,g.applied.ym,-g.applied.amt)}
  g.applied=null;g.bought='';
}
function grPrice(g){
  if(!g.bought||!g.applied)return;
  var amt=g.price||0,d=amt-g.applied.amt;
  if(Math.abs(d)>=0.005){var it=findItem(g.applied.id);if(it)budgetAdd(it,g.applied.ym,d)}
  g.applied.amt=amt;
}
function grSums(){
  var G=GR(),r={toBuy:0,unpriced:0,nTo:0,inCart:0,nCart:0,total:0,noPrice:0};
  G.items.forEach(function(i){
    r.total+=i.price||0;if(!i.price)r.noPrice++;
    if(i.bought){r.nCart++;r.inCart+=i.price||0}
    else{r.nTo++;if(i.price===null||i.price===0)r.unpriced++;else r.toBuy+=i.price}
  });
  return r;
}
function grLimitUpdate(r){
  r=r||grSums();
  var G=GR(),lim=G.limit||0,total=r.total,card=$('grLimitCard');if(!card)return;
  var pend=pf(($('grAmt')||{}).value),pending=(isFinite(pend)&&pend>0)?pend:0,set=function(id,t){var e=$(id);if(e)e.textContent=t};
  set('grTotal',fmt(total));
  var cls='',msg,pct=0;
  if(lim>0){
    pct=total/lim*100;
    if(total>lim){cls='over';msg=fmt(total-lim)+' over your limit'}
    else if(pct>=80){cls='warn';msg='Almost there: '+fmt(lim-total)+' left of '+fmt(lim)}
    else msg=fmt(lim-total)+' left of '+fmt(lim)
  }else msg='Set a limit to see right away if you go over budget.';
  set('grLimitMsg',msg);
  var m=document.querySelector('#grMeter i');if(m){m.style.width=Math.min(100,pct)+'%';m.className=cls}
  card.className='pg-card pg-limit'+(cls?' '+cls:'');
  var pv='';
  if(pending>0){var t2=total+pending;pv='With the item you are adding: '+fmt(t2)+(lim>0?(t2>lim?' ('+fmt(t2-lim)+' over your limit)':' ('+fmt(lim-t2)+' left)'):'')}
  set('grPreview',pv);
  set('grNoPrice',r.noPrice?r.noPrice+' item'+(r.noPrice===1?' has':'s have')+' no price yet, so your real total may be higher.':'');
}
function grSummary(){
  var r=grSums(),set=function(id,t){var e=$(id);if(e)e.textContent=t},t=grTarget(false);
  set('grTo',fmt(r.toBuy));set('grToN',r.nTo+' to buy'+(r.unpriced?' · '+r.unpriced+' without a price':''));
  set('grCart',fmt(r.inCart));set('grCartN',r.nCart+' in cart');
  set('grBudget',t?fmt(itemVal(t,ymNow())):'–');
  grLimitUpdate(r);
}
/* ===== v9.27: Grocery aisles: items sort themselves into groups ===== */
var GR_AISLES=[['produce','Fruits & Vegetables'],['dairy','Dairy, Eggs & Cheese'],['meat','Meat & Seafood'],['bakery','Bread & Bakery'],['pantry','Rice, Pasta & Pantry'],['snacks','Snacks & Sweets'],['drinks','Drinks'],['household','Household & Cleaning'],['personal','Personal Care & Health'],['other','Others']];
var GR_WORDS={
produce:'apple banana mango orange lemon lime grape papaya pineapple watermelon melon calamansi avocado tomato onion garlic ginger potato carrot cabbage lettuce cucumber eggplant talong ampalaya sitaw kangkong pechay okra squash kalabasa corn mushroom broccoli cauliflower celery spinach chili siling strawberry berry pear peach saging mansanas sibuyas bawang kamatis patatas repolyo labanos upo sayote malunggay basil cilantro fruit vegetable gulay prutas leaf scallion leek radish turnip bell_pepper',
dairy:'milk gatas egg itlog cheese keso butter yogurt yoghurt cream creamer margarine evaporated condensed dairy',
meat:'chicken manok pork baboy beef baka meat steak sausage sausages hotdog bacon ham longganisa tocino liempo ground mince fish isda tilapia bangus salmon tuna shrimp hipon squid pusit crab alimango fillet drumstick wings lamb turkey meatballs seafood',
bakery:'bread pandesal tinapay bun bagel croissant tortilla cake donut doughnut muffin loaf pastry pie',
pantry:'rice bigas pasta spaghetti noodles noodle pancit macaroni flour sugar asukal salt asin pepper oil mantika vinegar suka toyo patis ketchup mayonnaise mayo sauce spice spices canned sardines sardinas beans oats oatmeal cereal cornstarch baking honey jam broth bouillon lentils soup bagoong tomato_paste shrimp_paste coconut_milk gata soy_sauce cooking_oil olive_oil peanut_butter tomato_sauce corned_beef canned_tuna instant_noodles',
snacks:'chips chocolate candy candies cookie cookies biscuit biscuits crackers chichirya snack snacks nuts popcorn sweets gum marshmallow ice_cream gummies wafer',
drinks:'water coffee tea juice soda cola beer wine softdrink softdrinks milo gatorade coke sprite pepsi smoothie liquor gin rum vodka whiskey energy_drink soft_drink 3in1',
household:'detergent surf downy zonrox bleach tissue napkins trash garbage sponge cleaner disinfectant foil candle batteries battery lightbulb bulb mop broom dishwashing dishwash laundry fabric toilet_paper trash_bag garbage_bag dish_soap paper_towel ziplock plastic cling_wrap',
personal:'toothpaste toothbrush shampoo conditioner soap sabon lotion deodorant tampon sanitary pad pads razor shaving cologne perfume vitamins vitamin medicine paracetamol biogesic ibuprofen bandage alcohol mask floss mouthwash cotton diaper diapers wipes sunscreen facewash face_wash cream_cleanser lipstick tooth_paste hand_cream face_cream body_lotion baby_oil baby_powder baby_wipes lip_balm medicine tablet ointment'
};
var GR_MAP=null,GR_PHR=[],GR_LIST=[],GR_CACHE={};
function grBuild(){
  GR_MAP=Object.create(null);GR_PHR=[];GR_LIST=[];
  Object.keys(GR_WORDS).forEach(function(a){GR_WORDS[a].split(' ').forEach(function(w){
    if(!w)return;
    if(w.indexOf('_')>=0)GR_PHR.push([w.replace(/_/g,' '),a]);
    else{GR_MAP[w]=a;if(w.length>=5)GR_LIST.push([w,a])}
  })});
  GR_PHR.sort(function(x,y){return y[0].length-x[0].length});
}
function grNorm(s){return String(s==null?'':s).toLowerCase().replace(/[^a-zñ\s]/g,' ').replace(/\s+/g,' ').trim().slice(0,60)}
function grLev(a,b){
  if(a===b)return 0;var m=a.length,n=b.length;if(Math.abs(m-n)>1)return 2;
  var p=[],c=[],i,j;for(j=0;j<=n;j++)p[j]=j;
  for(i=1;i<=m;i++){c[0]=i;for(j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));p=c.slice()}
  return p[n];
}
function grAisleOk(k){return GR_AISLES.some(function(a){return a[0]===k})}
function grGuess(name){
  var n=grNorm(name);if(!n)return 'other';
  var G=GR(),ln=G.learn&&Object.prototype.hasOwnProperty.call(G.learn,n)?G.learn[n]:null;if(ln&&grAisleOk(ln))return ln;
  if(GR_CACHE[n])return GR_CACHE[n];
  if(!GR_MAP)grBuild();
  var res='other',pad=' '+n+' ',i,j,t,v;
  for(i=0;i<GR_PHR.length;i++){if(pad.indexOf(' '+GR_PHR[i][0]+' ')>=0){res=GR_PHR[i][1];GR_CACHE[n]=res;return res}}
  var tk=n.split(' ');
  for(i=tk.length-1;i>=0;i--){
    t=tk[i];v=[t];if(/ies$/.test(t))v.push(t.slice(0,-3)+'y');if(/es$/.test(t))v.push(t.slice(0,-2));if(/s$/.test(t))v.push(t.slice(0,-1));
    for(j=0;j<v.length;j++)if(GR_MAP[v[j]]){res=GR_MAP[v[j]];GR_CACHE[n]=res;return res}
  }
  for(i=tk.length-1;i>=0;i--){
    t=tk[i];if(t.length<5)continue;
    for(j=0;j<GR_LIST.length;j++)if(grLev(t,GR_LIST[j][0])<=1){res=GR_LIST[j][1];GR_CACHE[n]=res;return res}
  }
  GR_CACHE[n]=res;return res;
}
function grAisle(i){return (i.aisle&&grAisleOk(i.aisle))?i.aisle:grGuess(i.name)}
function grAisleLabel(k){for(var a=0;a<GR_AISLES.length;a++)if(GR_AISLES[a][0]===k)return GR_AISLES[a][1];return 'Others'}
var grClosed={},grMsg='';
function grBoughtSub(i){
  var b='Bought '+isoShort(i.bought);
  if(i.applied&&i.applied.amt)return b+' · added to your budget';
  if(GR().noLink)return b+' · not linked to your budget';
  return i.price?b+' · added to your budget':b+' · add the price to count it in your budget';
}
function grRow(i,grouped){
  var sub;
  if(i.bought)sub=grBoughtSub(i);
  else sub=i.price?'':'Price unknown';
  var mv='';if(grouped&&!i.bought){mv='<select class="pg-aisle" data-gr="aisle" aria-label="Move '+esc(i.name)+' to another aisle"><option value="__" selected>Move…</option><option value="">Auto-sort</option>'+GR_AISLES.map(function(a){return '<option value="'+a[0]+'"'+(a[0]===grAisle(i)?' disabled':'')+'>'+esc(a[1])+'</option>'}).join('')+'</select>'}
  return '<li class="pg-li'+(i.bought?' done':'')+'" data-gid="'+esc(i.id)+'" data-aisle="'+esc(grAisle(i))+'"><div class="pg-row">'+
    '<label class="pg-cb"><input type="checkbox" data-gr="check"'+(i.bought?' checked':'')+' aria-label="Bought: '+esc(i.name)+'"><span class="pg-box"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg></span></label>'+
    '<div class="pg-meta"><input class="pg-name" data-gr="name" value="'+esc(i.name)+'" aria-label="Item name" maxlength="80">'+(sub?'<span class="pg-sub" data-gr-sub>'+esc(sub)+'</span>':'<span class="pg-sub" data-gr-sub></span>')+mv+'</div>'+
    '<input class="pg-amt num" data-gr="price" type="text" inputmode="decimal" value="'+(i.price==null?'':i.price)+'" placeholder="Price" aria-label="Price of '+esc(i.name)+'">'+
    '<button type="button" class="pg-rm" data-gr="del" aria-label="Delete '+esc(i.name)+'" title="Delete">✕</button></div></li>';
}
function renderGrocery(){
  var el=$('pgGrocery');if(!el)return;
  var G=GR(),t=grTarget(false),spends=state.items.filter(function(i){return i.kind==='spend'}),h='';
  h+='<header class="pg-head"><div class="pg-eye">Shopping</div><h2>Grocery list</h2></header>';
  h+='<section class="pg-card pg-limit" id="grLimitCard" aria-live="polite"><div class="pg-limrow"><div><div class="pg-lbl">List total</div><div class="pg-big num" id="grTotal"></div></div><label class="pg-f pg-limin">Shopping limit<input class="pg-in num" id="grLimit" type="text" inputmode="decimal" placeholder="No limit" value="'+(G.limit||'')+'" aria-label="Shopping limit"></label></div><div class="budget-meter" id="grMeter"><i></i></div><div class="pg-limmsg" id="grLimitMsg"></div><div class="status" id="grPreview"></div><div class="status" id="grNoPrice"></div></section>';
  h+='<section class="pg-card" aria-live="polite"><div class="pg-two"><div><div class="pg-lbl">Still to buy</div><div class="pg-big num" id="grTo"></div><div class="status" id="grToN"></div></div><div><div class="pg-lbl">In your cart</div><div class="pg-big num" id="grCart"></div><div class="status" id="grCartN"></div></div></div>'+
    '<div class="pg-link"><label class="pg-f" for="grLink">Add ticked items to this Spending category</label><select class="pg-in" id="grLink"><option value="__none"'+(G.noLink?' selected':'')+'>Don\u2019t link (keep list only)</option>'+(t||G.noLink?'':'<option value="" selected>Groceries (will be created)</option>')+spends.map(function(i){return '<option value="'+esc(i.id)+'"'+(t&&t.id===i.id?' selected':'')+'>'+esc(i.name||'Unnamed')+'</option>'}).join('')+'<option value="__new">+ New spending category…</option></select><div class="pg-addrow" id="grNewRow" hidden style="margin-top:8px"><input class="pg-in grow" id="grNewLink" maxlength="40" placeholder="Category name, e.g. Pharmacy" aria-label="New spending category name"><button type="button" class="tbtn primary" data-gr="newlink">Create</button></div>'+
    (G.noLink?'<div class="status">Not linked. Ticking items only moves them to Bought. Nothing is added to your budget.</div>':'<div class="status">This month, that category totals <b class="num" id="grBudget"></b> on your dashboard.</div>')+'</div></section>';
  h+='<form class="pg-add" id="grForm" novalidate><div class="pg-addrow"><input class="pg-in grow" id="grName" maxlength="80" placeholder="Item (e.g. Rice 5 kg)" aria-label="Item"><input class="pg-in amtw num" id="grAmt" type="text" inputmode="decimal" placeholder="Price" aria-label="Price (optional)"><button class="tbtn primary" type="submit">Add</button></div></form><p class="status" id="grAdded" role="status"'+(grMsg?'':' hidden')+'>'+esc(grMsg)+'</p>';
  var todo=G.items.filter(function(i){return !i.bought}),done=G.items.filter(function(i){return i.bought});
  done.sort(function(a,b){return a.bought<b.bought?1:a.bought>b.bought?-1:0});
  var grp=G.group!==false,flat=function(i){return grRow(i,false)},inAisle=function(i){return grRow(i,true)};
  h+='<section class="pg-sec"><div class="pg-sech"><h3>To buy <span class="status">('+todo.length+')</span></h3>'+(todo.length?'<button type="button" class="tbtn'+(grp?' on':'')+'" data-gr="group" aria-pressed="'+grp+'">Group by aisle: '+(grp?'On':'Off')+'</button>':'')+'</div>';
  if(!todo.length)h+='<p class="pg-empty">'+(G.items.length?'Everything on your list is in the cart.':'Your list is empty. Add your first item above.')+'</p>';
  else if(!grp)h+='<ul class="pg-list">'+todo.map(flat).join('')+'</ul>';
  else GR_AISLES.forEach(function(a){
    var rows=todo.filter(function(i){return grAisle(i)===a[0]});if(!rows.length)return;
    var sum=0;rows.forEach(function(i){sum+=i.price||0});
    h+='<details class="txm gr-aisle" data-aisle="'+a[0]+'"'+(grClosed[a[0]]?'':' open')+'><summary><span class="mh">'+esc(a[1])+'</span><span class="status">'+rows.length+(rows.length===1?' item':' items')+'</span>'+(sum>0?'<span class="mn">'+fmt(sum)+'</span>':'')+'</summary><ul class="pg-list">'+rows.map(inAisle).join('')+'</ul></details>';
  });
  h+='</section>';
  if(done.length)h+='<section class="pg-sec"><div class="pg-sech"><h3>Bought <span class="status">('+done.length+')</span></h3><button type="button" class="tbtn" data-gr="clear">Clear bought items</button></div><ul class="pg-list">'+done.map(function(i){return grRow(i,false)}).join('')+'</ul></section>';
  el.innerHTML=h;grMsg='';grSummary();
}
function grAfter(id){renderGrocery();if(id)focusKeep('[data-gid="'+id+'"] [data-gr="check"]')}
(function(){
  var el=$('pgGrocery');
  function item(e){var li=e.closest&&e.closest('[data-gid]');if(!li)return null;var id=li.getAttribute('data-gid');return GR().items.filter(function(i){return i.id===id})[0]||null}
  el.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('[data-gr]');if(!b)return;var a=b.getAttribute('data-gr');
    if(a==='group'){var G0=GR();G0.group=G0.group===false;save();renderGrocery();focusKeep('[data-gr="group"]');return}
    if(a==='newlink'){
      var nm=$('grNewLink').value.trim().slice(0,40);if(!nm){$('grNewLink').focus();return}
      var ex=state.items.filter(function(i){return i.kind==='spend'&&(i.name||'').toLowerCase()===nm.toLowerCase()})[0];
      if(!ex){ex={id:uid(),kind:'spend',name:nm,usual:0,repeat:false,start:null,over:{},due:0,paid:{}};state.items.push(ex)}
      GR().link=ex.id;GR().noLink=false;state.sample=false;save();renderGrocery();return}
    if(a==='del'){
      var it=item(b);if(!it)return;
      if(b.classList.contains('sure')){clearTimeout(grSureTimer);if(it.bought)grUncheck(it);var G=GR();G.items=G.items.filter(function(x){return x.id!==it.id});save();renderGrocery()}
      else{document.querySelectorAll('#pgGrocery .pg-rm.sure').forEach(function(x){x.classList.remove('sure');x.textContent='✕'});b.classList.add('sure');b.textContent=it.bought&&it.price?'Undo & delete?':'Delete?';clearTimeout(grSureTimer);grSureTimer=setTimeout(function(){b.classList.remove('sure');b.textContent='✕'},3500)}
    }else if(a==='clear'){
      if(b.classList.contains('sure')){clearTimeout(grSureTimer);var G2=GR();G2.items=G2.items.filter(function(x){return !x.bought});save();renderGrocery()}
      else{b.classList.add('sure');b.textContent='Tap again to clear';clearTimeout(grSureTimer);grSureTimer=setTimeout(function(){b.classList.remove('sure');b.textContent='Clear bought items'},3500)}
    }
  });
  el.addEventListener('toggle',function(ev){var d=ev.target;if(d&&d.classList&&d.classList.contains('gr-aisle')){var k=d.getAttribute('data-aisle');if(d.open)delete grClosed[k];else grClosed[k]=true}},true);
  el.addEventListener('input',function(ev){
    var e=ev.target;
    if(e.id==='grLimit'){var lv=pf(e.value);GR().limit=(isFinite(lv)&&lv>0)?Math.round(lv*100)/100:0;save();grLimitUpdate();trackOnce('grocery-limit-set');return}
    if(e.id==='grAmt'){grLimitUpdate();return}
    var a=e.getAttribute&&e.getAttribute('data-gr'),it=item(e);if(!a||!it)return;
    if(a==='name'){it.name=e.value;save()}
    else if(a==='price'){
      var v=pf(e.value);it.price=(e.value===''||!isFinite(v)||v<0)?null:Math.round(v*100)/100;
      grPrice(it);save();grSummary();
      var sub=e.closest('li').querySelector('[data-gr-sub]');
      if(sub)sub.textContent=it.bought?grBoughtSub(it):(it.price?'':'Price unknown');
    }
  });
  el.addEventListener('change',function(ev){
    var e=ev.target;
    if(e.id==='grLink'){if(e.value==='__new'){$('grNewRow').hidden=false;$('grNewLink').focus();return}var GL=GR();if(e.value==='__none'){GL.noLink=true;GL.link=''}else{GL.noLink=false;GL.link=e.value}save();renderGrocery();focusKeep('#grLink');return}
    var a=e.getAttribute&&e.getAttribute('data-gr'),it=item(e);if(!a||!it)return;
    if(a==='check'){if(e.checked){grCheck(it);trackOnce('grocery-item-checked')}else grUncheck(it);save();grAfter(it.id)}
    else if(a==='name'){if(!e.value.trim()){it.name='Item';e.value='Item'}else it.name=e.value.trim();save();
      var gli=e.closest('li');if(GR().group!==false&&!it.bought&&gli&&gli.getAttribute('data-aisle')!==grAisle(it)){renderGrocery();focusKeep('[data-gid="'+it.id+'"] [data-gr="check"]')}}
    else if(a==='aisle'){
      if(e.value==='__')return;var G1=GR();G1.learn=G1.learn||{};var nk=grNorm(it.name);
      if(e.value===''){it.aisle='';if(nk)delete G1.learn[nk]}
      else if(grAisleOk(e.value)){it.aisle=e.value;if(nk){var ks=Object.keys(G1.learn);if(ks.length>=300&&!(nk in G1.learn))delete G1.learn[ks[0]];G1.learn[nk]=e.value}}
      save();renderGrocery();focusKeep('[data-gid="'+it.id+'"] [data-gr="check"]')}
  });
  el.addEventListener('submit',function(ev){
    ev.preventDefault();if(ev.target.id!=='grForm')return;
    var name=$('grName').value.trim();if(!name){formMsg(ev.target,'Enter an item name first.');$('grName').focus();return}
    if(amtBadChars($('grAmt').value)){formMsg(ev.target,'Numbers only, for example 120.50.');$('grAmt').focus();return}var v=parseAmt($('grAmt').value);if(v!==null&&v<0){formMsg(ev.target,'The price cannot be negative.');$('grAmt').focus();return}formMsg(ev.target,'');if(v===null)v=NaN;
    var ni={id:uid(),name:name,price:(isFinite(v)&&v>=0&&$('grAmt').value!=='')?Math.round(v*100)/100:null,bought:'',applied:null,aisle:''};GR().items.push(ni);
    if(GR().group!==false){grMsg='Added \u201c'+name.slice(0,40)+'\u201d to '+grAisleLabel(grAisle(ni))+'.';if(grClosed[grAisle(ni)])grClosed[grAisle(ni)]=false}
    save();trackOnce('grocery-item-added');renderGrocery();focusSoon2('#grName');
  });
})();

