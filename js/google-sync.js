/* Easy Budget Tracker: backup file, Google sign-in and Drive saving, anonymous visit counting.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- backup ---------- */
var downloads=null;
function exportText(){
  var json=JSON.stringify(state,null,1),box=$('backupBox');
  box.innerHTML='<p class="status">Copy this text and keep it somewhere safe. To restore, tap Restore from text and paste it in.</p><textarea readonly id="bk">'+esc(json)+'</textarea>';
  var t=$('bk');t.focus();t.select();try{navigator.clipboard.writeText(json).catch(function(){})}catch(e){}
}
function doExport(){
  track('backup-exported');
  var json=JSON.stringify(state,null,1),box=$('backupBox'),fname='budget-backup-'+ymNow()+'.json';
  if(downloads){downloads.save({filename:fname,data:json}).catch(function(e){if(!e||e.code!=='declined')exportText()});return}
  try{
    var f=new File([json],fname,{type:'application/json'});
    if(navigator.canShare&&navigator.canShare({files:[f]})){
      navigator.share({files:[f],title:'Budget backup'}).catch(function(){});
      box.innerHTML='<p class="status">Choose Save to Files. To restore, tap Restore a backup and pick that file.</p>';return;
    }
  }catch(e){}
  try{
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.download=fname;document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);
    box.innerHTML='<p class="status">Backup file downloaded. To restore, tap Restore a backup and pick it.</p>';return;
  }catch(e){}
  exportText();
}
function parseBackup(text){
  var t=String(text).replace(/^\uFEFF/,'').trim();
  try{return JSON.parse(t)}catch(e){return JSON.parse(t.replace(/[“”]/g,'"').replace(/[‘’]/g,"'"))}
}
function applyBackup(text,box){
  try{
    var s=sane(parseBackup(text));if(!s)throw 0;
    if(!budgetEmpty(state)&&!confirm('Restore this backup?\n\nIt replaces the budget on this device, and your Google Drive copy too if Google Drive is on. You can undo it right after.'))return;
    imUndo=JSON.stringify(state);
    state=s;state.sample=false;openId=null;save();renderAll();$('backupBox').innerHTML='<p class="status">Backup restored. Use Undo last import or restore in Settings to go back.</p>';
  }catch(e){var msg='<p class="status" style="color:var(--neg)">That is not a budget backup from this page. Check that you copied all of the text.</p>',pm=$('pasteMsg');if(pm&&$('pasteIn'))pm.innerHTML=msg;else box.innerHTML=msg}
}
function pasteOpen(){
  $('backupBox').innerHTML='<p class="status">Paste the whole backup text here, then tap Restore.</p><textarea id="pasteIn" placeholder="Paste backup text"></textarea><p class="status" id="pasteMsg" role="alert"></p><div class="srow" style="margin-top:8px"><button class="tbtn primary" data-act="pasterestore">Restore</button></div>';
  var t=$('pasteIn');if(t)t.focus();
}
function doImport(file){
  if(!file)return;var r=new FileReader(),box=$('backupBox');
  r.onload=function(){applyBackup(r.result,box)};
  r.readAsText(file);
}


/* ---------- Google sign-in and Drive saving ---------- */
var gTok=null,gExp=0,gTc=null,gFileId=null,gSynced=false,gBusy=false,gNeedReconnect=false,gUserSignIn=false;
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}
function gClient(){return GOOGLE_CLIENT_ID||lsGet('mbm.gclient')||''}
function gLive(){return !!gTok&&Date.now()<gExp}
var gcLoading=false;
function loadGC(){
  if(!GOATCOUNTER||gcLoading)return;gcLoading=true;
  try{
    window.goatcounter=window.goatcounter||{};
    if(!document.getElementById('gcjs')){var sc=document.createElement('script');sc.id='gcjs';sc.async=true;sc.src='https://gc.zgo.at/count.js';sc.setAttribute('data-goatcounter',GOATCOUNTER.replace(/\/+$/,'')+'/count');document.head.appendChild(sc)}
  }catch(e){}
}
function track(name){
  if(!GOATCOUNTER)return;
  try{
    loadGC();
    var n=0,iv=setInterval(function(){
      if(window.goatcounter&&window.goatcounter.count){clearInterval(iv);try{window.goatcounter.count({path:name,title:name,event:true})}catch(e){}}
      else if(++n>100)clearInterval(iv);
    },100);
  }catch(e){}
}
/* Anonymous visit counting: one page view per load (GoatCounter, no cookies) plus one-time return events kept as simple flags on this device. */
function visitStats(){
  loadGC();
  try{
    var first=lsGet('ebt.first-visit'),now=Date.now();
    if(!first){lsSet('ebt.first-visit',String(now));track('first-visit');return}
    var days=(now-num(first))/86400000;
    if(days>=7&&!lsGet('ebt.sent-d7')){lsSet('ebt.sent-d7','1');track('returned-after-7-days')}
    if(days>=30&&!lsGet('ebt.sent-d30')){lsSet('ebt.sent-d30','1');track('returned-after-30-days')}
  }catch(e){}
}
function loadGsi(cb){
  if(window.google&&google.accounts&&google.accounts.oauth2)return cb();
  var sc=document.createElement('script');sc.src='https://accounts.google.com/gsi/client';sc.async=true;
  sc.onload=cb;sc.onerror=function(){setStatus('Could not reach Google. Saved on this device')};document.head.appendChild(sc);
}
function gInit(cb){
  if(!gClient())return;
  loadGsi(function(){
    if(!gTc){
      gTc=google.accounts.oauth2.initTokenClient({
        client_id:gClient(),scope:'https://www.googleapis.com/auth/drive.appdata',
        callback:function(r){
          if(r&&r.access_token){gTok=r.access_token;gExp=Date.now()+Math.max(60,(r.expires_in||3600)-60)*1000;gNeedReconnect=false;gNeedReconnectAsked=false;lsSet('mbm.gsigned','1');if(gUserSignIn){gUserSignIn=false;track('sign-in')}try{sessionStorage.setItem('mbm.gtok',JSON.stringify({t:gTok,e:gExp}))}catch(x){}updateGoogleUI();gSync()}
          else{gNeedReconnect=true;updateGoogleUI()}
        },
        error_callback:function(){gUserSignIn=false;gNeedReconnect=true;updateGoogleUI();setStatus('Google not connected. Saved on this device')}
      });
    }
    cb()
  });
}
function gSignIn(){gFirstLink=!lsGet('mbm.gsigned');gUserSignIn=true;gInit(function(){gTc.requestAccessToken({prompt:lsGet('mbm.gsigned')?'':'consent'})})}
function gSignOut(){
  try{if(gTok&&window.google)google.accounts.oauth2.revoke(gTok,function(){})}catch(e){}
  gTok=null;gFileId=null;gSynced=false;gNeedReconnect=false;lsSet('mbm.gsigned','');try{sessionStorage.removeItem('mbm.gtok')}catch(x){}updateGoogleUI();setStatus('Signed out of Google. Saved on this device');renderSettings();
}
function gFetch(url,opt){
  opt=opt||{};opt.headers=Object.assign({Authorization:'Bearer '+gTok},opt.headers||{});
  return fetch(url,opt).then(function(r){
    if(r.status===401){gTok=null;gNeedReconnect=true;updateGoogleUI();throw new Error('auth')}
    if(!r.ok)throw new Error('http '+r.status);return r});
}
function gFind(){
  return gFetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q='+encodeURIComponent("name='budget.json'")+'&fields=files(id)')
    .then(function(r){return r.json()}).then(function(j){return (j.files&&j.files[0])||null});
}
function gUpload(json){
  var b='mbm'+Date.now(),meta=gFileId?{name:'budget.json'}:{name:'budget.json',parents:['appDataFolder']};
  var body='--'+b+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+b+'\r\nContent-Type: application/json\r\n\r\n'+json+'\r\n--'+b+'--';
  var url=gFileId?'https://www.googleapis.com/upload/drive/v3/files/'+gFileId+'?uploadType=multipart&fields=id':'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
  return gFetch(url,{method:gFileId?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+b},body:body})
    .then(function(r){return r.json()}).then(function(j){gFileId=j.id});
}
var gSeen=0,gPushBusy=false,gPending=null,gLastPull=0,gFirstLink=false;
function budgetEmpty(b){return !b||b.sample||(!b.items.length&&!b.loans.length&&!(b.collect&&b.collect.items&&b.collect.items.length)&&!(b.grocery&&b.grocery.items&&b.grocery.items.length)&&!(b.notebook&&b.notebook.pages&&b.notebook.pages.length))}
function gDirty(){return lsGet('mbm.gdirty')==='1'}
function gClean(){lsSet('mbm.gdirty','')}
function gGetRemote(){
  var known=gFileId?Promise.resolve({id:gFileId}):gFind();
  return known.then(function(f){
    if(!f)return {id:null,data:null,bad:false};
    return gFetch('https://www.googleapis.com/drive/v3/files/'+f.id+'?alt=media').then(function(r){return r.text()}).then(function(t){
      var d=null;try{d=sane(JSON.parse(t))}catch(e){}
      return {id:f.id,data:d,bad:!d};
    });
  }).catch(function(e){
    if(gFileId&&e&&e.message==='http 404'){gFileId=null;return gGetRemote()}
    throw e;
  });
}
function gAdopt(remote){gPending=null;state=remote;state.sample=false;lsSet(KEY,JSON.stringify(state));gSeen=state.updatedAt;gClean();renderAll()}
function gSyncDone(msg){gSynced=true;setStatus(msg);updateGoogleUI();if(gLive()&&state.updatedAt>gSeen)gPush(JSON.stringify(state))}
function gUp(){var json=JSON.stringify(state),sent=state.updatedAt;return gUpload(json).then(function(){gSeen=sent;if(state.updatedAt===sent)gClean();gSyncDone('Saved to Google Drive')})}
function gSync(quiet){
  var wasSynced=gSynced;gSynced=false;if(!quiet)setStatus('Connecting to Google Drive…');
  return gGetRemote().then(function(r){
    if(!r.id){gFileId=null;return gUp()}
    gFileId=r.id;
    if(r.bad){
      if(confirm('The budget saved in your Google Drive could not be read. Replace it with the budget on this device?')){return gUp()}
      gSynced=false;setStatus('Google Drive file not changed. Saved on this device');return;
    }
    var rt=r.data.updatedAt,first=gFirstLink;gFirstLink=false;
    if(budgetEmpty(state)&&!budgetEmpty(r.data)){gAdopt(r.data);gSyncDone('Updated from Google Drive');return}
    if(first&&!budgetEmpty(r.data)&&!budgetEmpty(state)){
      if(confirm('Your Google Drive already has a saved budget.\n\nOK = use the Google Drive budget (the budget on this device is replaced).\nCancel = keep this device\'s budget and replace the Drive copy.')){gAdopt(r.data);gSyncDone('Updated from Google Drive');return}
      return gUp();
    }
    if(rt>state.updatedAt){
      if(gDirty()&&state.updatedAt>0&&!state.sample&&!confirm('Your Google Drive has a newer budget from another device, but this device also has changes that are not saved to Drive yet.\n\nOK = use the Google Drive budget (changes on this device are replaced).\nCancel = keep this device\'s budget and replace the Drive copy.')){
        return gUp();
      }
      gAdopt(r.data);gSyncDone('Updated from Google Drive');return;
    }
    if(rt===state.updatedAt){gSeen=rt;gClean();gSyncDone('Up to date with Google Drive');return}
    return gUp();
  }).catch(function(){gSynced=wasSynced;setStatus('Google Drive error. Saved on this device')});
}
function gManualSync(){
  if(!gClient())return;
  if(gLive()){setStatus('Syncing with Google Drive…');gSync(true);return}
  gUserSignIn=false;gInit(function(){try{gTc.requestAccessToken({prompt:''})}catch(e){gSignIn()}});
}
function gPull(){
  if(!gLive()||!gSynced||gPushBusy)return;
  if(Date.now()-gLastPull<10000)return;
  var ae=document.activeElement;if(ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))return;
  gLastPull=Date.now();gSync(true);
}
function gPush(json){
  if(!gClient())return;
  if(!gLive()&&lsGet('mbm.gsigned')){
    setStatus('Not saved to Google Drive yet. Tap Sync to reconnect');gNeedReconnect=true;updateGoogleUI();
    if(gTc&&!gNeedReconnectAsked){gNeedReconnectAsked=true;try{gTc.requestAccessToken({prompt:''})}catch(e){}}
    return;
  }
  if(!gLive()||!gSynced)return;
  if(gPushBusy){gPending=json;return}
  gPushBusy=true;var upd=tsNum(JSON.parse(json).updatedAt);
  gGetRemote().then(function(r){
    if(r.id&&!r.bad&&r.data.updatedAt>gSeen&&r.data.updatedAt!==upd){
      if(confirm('Another device saved newer changes to your Google Drive.\n\nOK = load those changes (your latest edit on this device is replaced).\nCancel = keep this device\'s budget and replace the Drive copy.')){gAdopt(r.data);setStatus('Updated from Google Drive');return}
    }
    if(r.bad&&!confirm('The budget saved in your Google Drive could not be read. Replace it with the budget on this device?')){setStatus('Google Drive file not changed. Saved on this device');return}
    gFileId=r.id;
    return gUpload(json).then(function(){gSeen=upd;if(state.updatedAt===upd)gClean();setStatus('Saved to Google Drive')});
  }).catch(function(){setStatus('Google Drive error. Saved on this device')}).then(function(){
    gPushBusy=false;if(gPending){var j=gPending;gPending=null;gPush(j)}
  });
}
var gNeedReconnectAsked=false;
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')gPull()});
window.addEventListener('focus',gPull);window.addEventListener('online',gPull);
function updateGoogleUI(){
  var b=$('gBtn');if(!b)return;
  if(!gClient()){b.hidden=true;return}
  b.hidden=false;
  if(gLive())b.innerHTML='<span class="gfull">Google </span>Drive: on';else b.textContent=(gNeedReconnect&&lsGet('mbm.gsigned')?'Reconnect Google':'Sign in with Google');
  b.className='tbtn'+(gLive()?'':' primary');
  b.disabled=gLive();
  var sb=$('gSyncBtn');if(sb)sb.hidden=!(gClient()&&lsGet('mbm.gsigned'));
}
function googleSettingsHTML(){
  var lab='font-size:.78rem;color:var(--muted);font-weight:600';
  if(!gClient())return '<div class="srow"><label style="flex:1 1 280px;display:grid;gap:4px;'+lab+'">Google Client ID (needed once to turn on Google Drive saving)<input id="set-gid" style="background:var(--field);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%;font-weight:400" placeholder="1234567890-abc123.apps.googleusercontent.com"></label></div>';
  return '<div class="srow"><span class="status" style="flex:1 1 260px">'+(gLive()?'Connected to Google Drive. Every change saves automatically to a private app folder in your Drive.':'Not connected to Google. Sign in to save your budget to your Google Drive.')+'</span>'+
    (gLive()?'<button class="tbtn" data-act="gsync">&#8635; Sync now</button><button class="tbtn" data-act="gout">Sign out of Google</button>':'<button class="tbtn primary" data-act="gin">Sign in with Google</button>')+'</div>';
}
function gBoot(){
  try{var st=JSON.parse(sessionStorage.getItem('mbm.gtok')||'null');if(st&&st.t&&st.e>Date.now()&&lsGet('mbm.gsigned')){gTok=st.t;gExp=st.e;updateGoogleUI();gInit(function(){});gSync();return}}catch(x){}
  updateGoogleUI();
  if(gClient()&&lsGet('mbm.gsigned'))gInit(function(){try{gTc.requestAccessToken({prompt:''})}catch(e){gNeedReconnect=true;updateGoogleUI()}});
}

