/* KillZone mobile start bridge: makes pointer-lock-dependent legacy games enter gameplay on touch devices. */
(function(){
  'use strict';
  const frame=document.getElementById('gameFrame');
  const mode=document.body.dataset.mobileGame||'minecraft';
  if(!frame)return;

  let startLayer=null;

  function child(){try{return frame.contentDocument||null}catch(_){return null}}
  function makePointerLockAppearLocked(doc,canvas){
    try{Object.defineProperty(doc,'pointerLockElement',{configurable:true,get:()=>canvas});}catch(_){ }
    try{doc.dispatchEvent(new Event('pointerlockchange'));}catch(_){ }
  }

  function startGame(){
    const doc=child(); if(!doc)return;
    const start=doc.getElementById('start-btn')||doc.getElementById('start-game-btn');
    const canvas=doc.querySelector('canvas');
    if(start){
      try{start.click();}catch(_){ }
    }
    if(canvas)makePointerLockAppearLocked(doc,canvas);
    if(startLayer)startLayer.remove();
  }

  function install(){
    const doc=child(); if(!doc)return;
    const menu=doc.getElementById('main-menu');
    if(!menu)return;
    const visible=getComputedStyle(menu).display!=='none'&&!menu.classList.contains('hidden');
    if(!visible)return;
    if(startLayer)return;
    startLayer=document.createElement('button');
    startLayer.type='button';
    startLayer.textContent='شروع بازی';
    startLayer.setAttribute('aria-label','شروع بازی');
    startLayer.style.cssText='position:fixed;z-index:12000;right:16px;bottom:max(16px,env(safe-area-inset-bottom));padding:14px 22px;border:1px solid #df6330;border-radius:12px;background:rgba(16,16,14,.94);color:#f4eddc;font:800 16px Vazirmatn,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);touch-action:manipulation;direction:rtl;';
    startLayer.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();startGame();},{passive:false});
    document.body.appendChild(startLayer);
  }

  frame.addEventListener('load',()=>{startLayer=null;setTimeout(install,80);setTimeout(install,400);});
  setInterval(install,500);
})();
