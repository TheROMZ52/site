// Bridge the app's global lexical currentUser binding to window for extension scripts.
(function(){
  try{
    Object.defineProperty(window,'currentUser',{configurable:true,get:function(){return currentUser;},set:function(v){currentUser=v;}});
  }catch(e){ console.warn('KillZone account bridge unavailable',e); }
})();
