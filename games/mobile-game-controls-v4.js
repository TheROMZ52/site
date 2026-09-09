/* KillZone mobile bootstrap: start layer + pointer-lock compatibility + v3 touch controls. */
(function(){
  'use strict';
  const frame=document.getElementById('gameFrame');
  if(!frame)return;
  const mode=document.body.dataset.mobileGame||'minecraft';
  let controlsLoaded=false;
  let startLayer=null;
  let watchTimer=null;

  function childDoc(){try{return frame.contentDocument||null}catch(_){return null}}
  function childWin(){try{return frame.contentWindow||null}catch(_){return null}}
  function gameCanvas(){const d=childDoc();return d&&(d.getElementById('game-canvas')||d.querySelector('canvas'));}

  function installPointerLockShim(){
    const d=childDoc(),canvas=gameCanvas();
    if(!d||!canvas)return;
    try{Object.defineProperty(d,'pointerLockElement',{configurable:true,get:()=>canvas});}catch(_){ }
    try{canvas.requestPointerLock=()=>{try{d.dispatchEvent(new Event('pointerlockchange'));}catch(_){ }return Promise.resolve();};}catch(_){ }
    const w=childWin();
    if(w)w.__KZ_MOBILE_LOOK=true;
  }

  function isMenuVisible(){
    const d=childDoc();
    const menu=d?.getElementById('main-menu');
    if(!menu)return false;
    const style=d.defaultView?.getComputedStyle(menu);
    return !(menu.classList.contains('hidden')||style?.display==='none'||style?.visibility==='hidden');
  }

  function startGame(){
    const d=childDoc();
    if(!d)return;
    installPointerLockShim();
    const btn=d.getElementById('start-btn')||d.getElementById('start-game-btn');
    if(btn){try{btn.click();}catch(_){try{btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:d.defaultView}));}catch(__){}}}
    setTimeout(()=>{installPointerLockShim();syncStartLayer();},0);
  }

  function syncStartLayer(){
    if(!window.matchMedia('(pointer: coarse)').matches)return;
    const visible=isMenuVisible();
    if(visible&&!startLayer){
      startLayer=document.createElement('button');
      startLayer.type='button';
      startLayer.className='kz-mobile-start';
      startLayer.textContent='شروع بازی';
      startLayer.setAttribute('aria-label','شروع بازی');
      startLayer.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();startGame();},{passive:false});
      document.body.appendChild(startLayer);
    }else if(!visible&&startLayer){
      startLayer.remove();startLayer=null;
      loadControls();
    }
  }

  function loadControls(){
    if(controlsLoaded)return;
    controlsLoaded=true;
    const s=document.createElement('script');
    s.src='mobile-game-controls-v3.js?v=5';
    s.async=false;
    s.onload=()=>syncStartLayer();
    s.onerror=()=>{controlsLoaded=false;console.warn('KillZone mobile controls could not load.');};
    document.head.appendChild(s);
  }

  function boot(){
    const style=document.createElement('style');
    style.textContent='.kz-mobile-start{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:12000;padding:15px 24px;border:1px solid #df6330;border-radius:12px;background:rgba(16,16,14,.96);color:#f4eddc;font:800 16px Vazirmatn,Arial,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.48);touch-action:manipulation}.kz-mobile-start:active{transform:scale(.97);background:rgba(223,99,48,.22)}';
    document.head.appendChild(style);
    frame.addEventListener('load',()=>{installPointerLockShim();syncStartLayer();});
    watchTimer=setInterval(()=>{installPointerLockShim();syncStartLayer();},300);
    window.addEventListener('pagehide',()=>{if(watchTimer)clearInterval(watchTimer);});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
