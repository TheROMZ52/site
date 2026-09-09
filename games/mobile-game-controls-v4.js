/* KillZone mobile bootstrap: start layer + branding cleanup + pointer-lock compatibility + v3 controls. */
(function(){
  'use strict';
  const frame=document.getElementById('gameFrame');
  if(!frame)return;
  let controlsLoaded=false,startLayer=null,watchTimer=null;

  function childDoc(){try{return frame.contentDocument||null}catch(_){return null}}
  function gameCanvas(){const d=childDoc();return d&&(d.getElementById('game-canvas')||d.querySelector('canvas'));}

  function cleanGameBranding(){
    const d=childDoc();if(!d)return;
    try{d.title=(document.body.dataset.mobileGame==='minecraft'?'Minecraft':'Counter-Strike')+' // KILLZONE';}catch(_){ }
    d.querySelectorAll('a').forEach(a=>{const text=(a.textContent||'').toLowerCase(),href=(a.getAttribute('href')||'').toLowerCase();if(text.includes('errorarea')||href.includes('errorarea'))a.remove();});
  }

  function installPointerLockShim(){
    const d=childDoc(),canvas=gameCanvas();if(!d||!canvas)return;
    try{Object.defineProperty(d,'pointerLockElement',{configurable:true,get:()=>canvas});}catch(_){ }
    try{canvas.requestPointerLock=()=>{try{d.dispatchEvent(new Event('pointerlockchange'));}catch(_){ }return Promise.resolve();};}catch(_){ }
    try{d.documentElement.style.touchAction='none';d.body.style.touchAction='none';}catch(_){ }
  }

  function menuVisible(){
    const d=childDoc(),m=d?.getElementById('main-menu');if(!m)return false;
    const style=d.defaultView?.getComputedStyle(m);return !(m.classList.contains('hidden')||style?.display==='none'||style?.visibility==='hidden');
  }

  function start(){
    const d=childDoc();if(!d)return;cleanGameBranding();installPointerLockShim();
    const btn=d.getElementById('start-btn')||d.getElementById('start-game-btn');
    if(btn){try{btn.click();}catch(_){try{btn.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:d.defaultView}));}catch(__){}}}
    setTimeout(()=>{cleanGameBranding();installPointerLockShim();sync();},0);
  }

  function sync(){
    if(!window.matchMedia('(pointer: coarse)').matches){if(startLayer){startLayer.remove();startLayer=null}return;}
    const visible=menuVisible();
    if(visible&&!startLayer){
      startLayer=document.createElement('button');startLayer.type='button';startLayer.className='kz-mobile-start';startLayer.textContent='شروع بازی';startLayer.setAttribute('aria-label','شروع بازی');
      startLayer.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();start();},{passive:false});document.body.appendChild(startLayer);
    }else if(!visible&&startLayer){startLayer.remove();startLayer=null;loadControls();}
  }

  function loadControls(){
    if(controlsLoaded)return;controlsLoaded=true;
    const s=document.createElement('script');s.src='mobile-game-controls-v3.js?v=5';s.async=false;s.onload=sync;s.onerror=()=>{controlsLoaded=false;console.warn('KillZone mobile controls could not load.')};document.head.appendChild(s);
  }

  function boot(){
    const style=document.createElement('style');style.textContent='.kz-mobile-start{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:12000;padding:15px 24px;border:1px solid #df6330;border-radius:12px;background:rgba(16,16,14,.96);color:#f4eddc;font:800 16px Vazirmatn,Arial,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.48);touch-action:manipulation}.kz-mobile-start:active{transform:scale(.97);background:rgba(223,99,48,.22)}';document.head.appendChild(style);
    frame.addEventListener('load',()=>{cleanGameBranding();installPointerLockShim();sync();});
    watchTimer=setInterval(()=>{cleanGameBranding();installPointerLockShim();sync();},500);
    window.addEventListener('pagehide',()=>{if(watchTimer)clearInterval(watchTimer);});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
