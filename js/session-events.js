// KillZone session lifecycle bridge.
// Emits one consistent event whenever the custom client-side session changes or finishes loading.
(function(){
  'use strict';

  if(window.__kzSessionEventsInstalled)return;
  window.__kzSessionEventsInstalled=true;

  const emit=name=>{try{window.dispatchEvent(new CustomEvent(name));}catch(_){}};

  function wrap(name,onDone){
    const original=window[name];
    if(typeof original!=='function'||original.__kzSessionWrapped)return;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      try{
        if(result&&typeof result.then==='function'){
          return result.then(value=>{onDone?.(value);return value;},error=>{throw error;});
        }
      }catch(_){ }
      onDone?.(result);
      return result;
    };
    wrapped.__kzSessionWrapped=true;
    window[name]=wrapped;
  }

  function install(){
    wrap('saveSession',()=>emit('kz:session-changed'));
    wrap('clearSession',()=>emit('kz:session-changed'));
    wrap('initSession',()=>emit('kz:session-ready'));
  }

  // app.js is loaded immediately before this file on the pages that need the bridge.
  install();
  document.addEventListener('DOMContentLoaded',install,{once:true});
})();
