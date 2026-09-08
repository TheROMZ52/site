/* KillZone mobile controls v4 — native-input-compatible bootstrap for the existing full games. */
(function(){
  'use strict';
  const frame=document.getElementById('gameFrame');
  if(!frame)return;
  const mode=document.body.dataset.mobileGame||'minecraft';
  let started=false;
  let oldRequest=null;

  function installGamePointerLockShim(){
    const d=frame.contentDocument;
    const w=frame.contentWindow;
    if(!d||!w)return false;
    const target=mode==='minecraft'?d.body:d.getElementById('game-canvas')||d.querySelector('canvas');
    if(!target)return false;

    try{
      Object.defineProperty(d,'pointerLockElement',{
        configurable:true,
        get:function(){return target;}
      });
    }catch(_){ }

    try{
      if(!target.__kzOriginalRequestPointerLock){
        target.__kzOriginalRequestPointerLock=target.requestPointerLock;
      }
      target.requestPointerLock=function(){
        try{d.dispatchEvent(new Event('pointerlockchange',{bubbles:true}));}catch(_){ }
        return Promise.resolve();
      };
    }catch(_){ }
    return true;
  }

  function triggerStart(){
    if(started)return;
    const d=frame.contentDocument;
    if(!d)return;
    installGamePointerLockShim();
    const btn=d.getElementById('start-btn')||d.getElementById('start-game-btn');
    if(!btn)return;
    started=true;
    try{btn.click();}catch(_){
      try{btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}catch(__){ }
    }
  }

  function boot(){
    installGamePointerLockShim();
    frame.addEventListener('load',function(){installGamePointerLockShim();setTimeout(installGamePointerLockShim,100);});
    const observer=new MutationObserver(function(){
      const d=frame.contentDocument;
      if(!d)return;
      installGamePointerLockShim();
      const menu=d.getElementById('main-menu');
      if(menu&&menu.classList.contains('hidden'))return;
      if(window.matchMedia('(pointer: coarse)').matches) return;
    });
    try{observer.observe(frame.contentDocument.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});}catch(_){ }

    /* Re-expose a direct full-game touch surface only after the user starts the game. */
    const tapTarget=document.createElement('div');
    tapTarget.setAttribute('aria-hidden','true');
    Object.assign(tapTarget.style,{position:'fixed',inset:'0',zIndex:'9998',pointerEvents:'none',touchAction:'none'});
    document.body.appendChild(tapTarget);

    const startWatcher=setInterval(function(){
      const d=frame.contentDocument;
      if(!d){return;}
      installGamePointerLockShim();
      const menu=d.getElementById('main-menu');
      if(menu&&menu.classList.contains('hidden')){
        clearInterval(startWatcher);
        return;
      }
      if(window.matchMedia('(pointer: coarse)').matches){
        const btn=d.getElementById('start-btn')||d.getElementById('start-game-btn');
        if(btn){
          btn.addEventListener('pointerup',function(){setTimeout(installGamePointerLockShim,0);},{once:true});
        }
      }
    },250);

    /* Load v3 only after the pointer-lock shim is in place. */
    const s=document.createElement('script');
    s.src='mobile-game-controls-v3.js?v=4';
    s.async=false;
    document.head.appendChild(s);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
