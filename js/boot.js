/* Easy Budget Tracker: start-up: load state, first render, Google, visit stats, account sync.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- boot ---------- */
state=loadLocal()||sample();
renderAll();
gBoot();
visitStats();
(function connect(){
  if(!window.claude||!window.claude.use)return;
  window.claude.use('downloads').then(function(d){downloads=d}).catch(function(){});
  Promise.all([window.claude.use('db'),window.claude.use('user')]).then(function(r){
    var db=r[0],user=r[1];if(!db||!user)return;
    return user.id().then(function(uidv){
      if(!uidv)return;
      var doc=db.doc('data/users/'+uidv+'/budget');
      return doc.get().then(function(snap){
        dbDoc=doc;
        if(snap.exists){
          var d=snap.data()||{},remote=null;try{remote=sane(JSON.parse(d.json))}catch(e){}
          if(remote&&(tsNum(d.updatedAt)>state.updatedAt)){state=remote;renderAll()}
          else{save()}
        }else if(state.updatedAt){save()}
        setStatus('Saved to your account');
      });
    });
  }).catch(function(){});
})();
