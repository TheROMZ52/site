/* KillZone mobile game controls — additive controller layer. Keeps original game logic untouched. */
(function(){
  'use strict';

  const frame = document.getElementById('gameFrame');
  const mode = document.body.dataset.mobileGame || 'minecraft';
  if(!frame) return;

  const activeKeys = new Set();
  const joy = { pointerId:null, x:0, y:0, keys:new Set() };
  let lookPointerId = null;
  let lookX = 0;
  let lookY = 0;
  let lastTap = 0;

  const CSS = `
    :root{--mc:#728b4b;--ember:#df6330;--ink:rgba(10,10,8,.72);--line:rgba(244,237,220,.25);--text:#f4eddc}
    body.kz-mobile{touch-action:none}
    .kz-mobile-ui{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:Vazirmatn,Arial,sans-serif;color:var(--text)}
    .kz-mobile-ui *{box-sizing:border-box}
    .kz-touch-zone{position:absolute;pointer-events:auto;touch-action:none}
    .kz-stick{left:16px;bottom:18px;width:138px;height:138px;border:1px solid var(--line);border-radius:50%;background:rgba(12,12,10,.3);backdrop-filter:blur(5px)}
    .kz-stick::before{content:"";position:absolute;inset:35px;border:1px solid rgba(244,237,220,.12);border-radius:50%}
    .kz-stick-handle{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:rgba(244,237,220,.18);border:1px solid rgba(244,237,220,.3);box-shadow:0 8px 22px rgba(0,0,0,.25);transform:translate(0,0);transition:transform .04s linear}
    .kz-look{right:0;top:0;width:57%;height:67%;pointer-events:auto;touch-action:none}
    .kz-pad{right:16px;bottom:18px;display:grid;grid-template-columns:repeat(2,64px);gap:10px;pointer-events:none}
    .kz-btn{width:64px;height:64px;border:1px solid var(--line);border-radius:16px;background:rgba(12,12,10,.7);color:var(--text);font:800 22px/1 Vazirmatn,Arial,sans-serif;display:grid;place-items:center;pointer-events:auto;touch-action:none;box-shadow:0 8px 18px rgba(0,0,0,.25);-webkit-tap-highlight-color:transparent}
    .kz-btn:active,.kz-btn.pressed{transform:scale(.94);background:rgba(223,99,48,.28);border-color:rgba(223,99,48,.7)}
    .kz-btn.wide{grid-column:1/-1;width:138px}
    .kz-mini{position:absolute;left:16px;top:16px;pointer-events:auto;touch-action:none;display:flex;gap:8px}
    .kz-mini button{width:44px;height:44px;border:1px solid var(--line);border-radius:10px;background:rgba(12,12,10,.68);color:var(--text);font-size:16px;pointer-events:auto}
    .kz-hint{position:absolute;left:50%;top:14px;transform:translateX(-50%);padding:7px 10px;border:1px solid rgba(244,237,220,.14);background:rgba(8,8,7,.45);font-size:10px;direction:rtl;white-space:nowrap;opacity:.7}
    .kz-fire{background:rgba(223,99,48,.22)}
    .kz-jump{background:rgba(114,139,75,.24)}
    .kz-hotbar{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:flex;gap:4px;pointer-events:auto}
    .kz-hotbar button{width:38px;height:38px;border:1px solid rgba(244,237,220,.18);border-radius:7px;background:rgba(8,8,7,.72);color:var(--text);font-size:12px}
    @media(min-width:900px){.kz-mobile-ui{display:none}}
    @media(max-width:430px){.kz-stick{width:122px;height:122px}.kz-stick-handle{width:52px;height:52px;margin:-26px}.kz-pad{right:10px;bottom:12px;grid-template-columns:repeat(2,56px);gap:7px}.kz-btn{width:56px;height:56px}.kz-btn.wide{width:119px}.kz-mini{left:10px;top:10px}.kz-hint{display:none}.kz-hotbar button{width:34px;height:34px}}
    @media(orientation:landscape) and (max-height:520px){.kz-stick{bottom:10px}.kz-pad{bottom:10px}.kz-look{width:50%;height:78%}.kz-hotbar{bottom:8px}}
  `;

  function injectStyles(){
    const style=document.createElement('style');
    style.id='kz-mobile-controls-style';
    style.textContent=CSS;
    document.head.appendChild(style);
  }

  function pressKey(code,on){
    try{
      const win=frame.contentWindow;
      if(!win) return;
      if(on){
        if(activeKeys.has(code)) return;
        activeKeys.add(code);
      }else{
        activeKeys.delete(code);
      }
      win.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code.replace('Key','').replace('Digit',''),bubbles:true,cancelable:true}));
    }catch(e){ console.warn('KillZone mobile key bridge',e); }
  }

  function mouse(button,on){
    try{
      const win=frame.contentWindow;
      if(!win)return;
      const ev=new MouseEvent(on?'mousedown':'mouseup',{bubbles:true,cancelable:true,button,buttons:on?(button===0?1:2):0,view:win});
      win.dispatchEvent(ev);
    }catch(e){ console.warn('KillZone mobile mouse bridge',e); }
  }

  function mouseMove(dx,dy){
    try{
      const win=frame.contentWindow;
      if(!win)return;
      const ev=new MouseEvent('mousemove',{bubbles:true,cancelable:true,view:win,clientX:lookX,clientY:lookY});
      Object.defineProperty(ev,'movementX',{value:dx});
      Object.defineProperty(ev,'movementY',{value:dy});
      win.dispatchEvent(ev);
    }catch(e){ console.warn('KillZone mobile look bridge',e); }
  }

  function setPressed(el,on){el.classList.toggle('pressed',on);}

  function bindHold(el,down){
    const ids=new Set();
    const start=e=>{e.preventDefault(); ids.add(e.pointerId); el.setPointerCapture?.(e.pointerId); setPressed(el,true); down(true);};
    const end=e=>{if(!ids.has(e.pointerId))return;e.preventDefault();ids.delete(e.pointerId);setPressed(el,false);down(false);};
    el.addEventListener('pointerdown',start);el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
  }

  function addButton(parent,label,cls,fn){
    const b=document.createElement('button');b.type='button';b.className='kz-btn '+(cls||'');b.textContent=label;b.setAttribute('aria-label',label);parent.appendChild(b);fn(b);return b;
  }

  function setupMinecraft(ui){
    const stick=document.createElement('div');stick.className='kz-touch-zone kz-stick';stick.setAttribute('aria-label','جوی‌استیک حرکت');
    const handle=document.createElement('div');handle.className='kz-stick-handle';stick.appendChild(handle);ui.appendChild(stick);
    const look=document.createElement('div');look.className='kz-look';look.setAttribute('aria-label','کنترل دوربین');ui.appendChild(look);
    const pad=document.createElement('div');pad.className='kz-pad';ui.appendChild(pad);
    addButton(pad,'پرش','kz-jump',b=>bindHold(b,on=>pressKey('Space',on)));
    addButton(pad,'شکستن','',b=>bindHold(b,on=>mouse(0,on)));
    addButton(pad,'گذاشتن','',b=>bindHold(b,on=>mouse(2,on)));
    addButton(pad,'اینونتوری','',b=>{b.style.fontSize='13px';bindHold(b,on=>{if(on)pressKey('KeyE',true);else pressKey('KeyE',false);});});
    const hot=document.createElement('div');hot.className='kz-hotbar';
    for(let i=1;i<=6;i++) addButton(hot,String(i),'',b=>{b.style.width='38px';bindHold(b,on=>pressKey('Digit'+i,on));});
    ui.appendChild(hot);
    const mini=document.createElement('div');mini.className='kz-mini';ui.appendChild(mini);
    addButton(mini,'⏸','',b=>b.addEventListener('pointerdown',e=>{e.preventDefault();pressKey('Escape',true);pressKey('Escape',false);}));
    stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.pointerId=e.pointerId;stick.setPointerCapture?.(e.pointerId);updateJoy(e);});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===joy.pointerId)updateJoy(e);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>stick.addEventListener(t,e=>{if(e.pointerId===joy.pointerId)releaseJoy();}));
    function updateJoy(e){
      const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
      let dx=e.clientX-cx,dy=e.clientY-cy;const max=r.width*.34;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}
      handle.style.transform=`translate(${dx}px,${dy}px)`;const nx=dx/max,ny=dy/max;const next=new Set();if(ny<-.28)next.add('KeyW');if(ny>.28)next.add('KeyS');if(nx<-.28)next.add('KeyA');if(nx>.28)next.add('KeyD');joy.keys.forEach(k=>{if(!next.has(k))pressKey(k,false);});next.forEach(k=>{if(!joy.keys.has(k))pressKey(k,true);});joy.keys=next;
    }
    function releaseJoy(){joy.pointerId=null;joy.keys.forEach(k=>pressKey(k,false));joy.keys.clear();handle.style.transform='translate(0,0)';}
    let lx=0,ly=0;
    look.addEventListener('pointerdown',e=>{e.preventDefault();lookPointerId=e.pointerId;lx=e.clientX;ly=e.clientY;look.setPointerCapture?.(e.pointerId);});
    look.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointerId)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;lookX=e.clientX;lookY=e.clientY;mouseMove(dx*1.35,dy*1.35);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>look.addEventListener(t,e=>{if(e.pointerId===lookPointerId)lookPointerId=null;}));
  }

  function setupCS(ui){
    const stick=document.createElement('div');stick.className='kz-touch-zone kz-stick';stick.setAttribute('aria-label','جوی‌استیک حرکت');
    const handle=document.createElement('div');handle.className='kz-stick-handle';stick.appendChild(handle);ui.appendChild(stick);
    const look=document.createElement('div');look.className='kz-look';look.setAttribute('aria-label','کنترل دوربین و نشانه‌گیری');ui.appendChild(look);
    const pad=document.createElement('div');pad.className='kz-pad';ui.appendChild(pad);
    addButton(pad,'🔥','kz-fire',b=>bindHold(b,on=>mouse(0,on)));
    addButton(pad,'◉','',b=>bindHold(b,on=>mouse(2,on)));
    addButton(pad,'⤴','kz-jump',b=>bindHold(b,on=>pressKey('Space',on)));
    addButton(pad,'R','',b=>bindHold(b,on=>pressKey('KeyR',on)));
    addButton(pad,'SHIFT','wide',b=>bindHold(b,on=>pressKey('ShiftLeft',on)));
    const mini=document.createElement('div');mini.className='kz-mini';ui.appendChild(mini);
    addButton(mini,'ESC','',b=>b.addEventListener('pointerdown',e=>{e.preventDefault();pressKey('Escape',true);pressKey('Escape',false);}));
    stick.addEventListener('pointerdown',e=>{e.preventDefault();joy.pointerId=e.pointerId;stick.setPointerCapture?.(e.pointerId);updateJoy(e);});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===joy.pointerId)updateJoy(e);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>stick.addEventListener(t,e=>{if(e.pointerId===joy.pointerId)releaseJoy();}));
    function updateJoy(e){
      const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy;const max=r.width*.34;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}handle.style.transform=`translate(${dx}px,${dy}px)`;const nx=dx/max,ny=dy/max;const next=new Set();if(ny<-.28)next.add('KeyW');if(ny>.28)next.add('KeyS');if(nx<-.28)next.add('KeyA');if(nx>.28)next.add('KeyD');joy.keys.forEach(k=>{if(!next.has(k))pressKey(k,false);});next.forEach(k=>{if(!joy.keys.has(k))pressKey(k,true);});joy.keys=next;
    }
    function releaseJoy(){joy.pointerId=null;joy.keys.forEach(k=>pressKey(k,false));joy.keys.clear();handle.style.transform='translate(0,0)';}
    let lx=0,ly=0;
    look.addEventListener('pointerdown',e=>{e.preventDefault();lookPointerId=e.pointerId;lx=e.clientX;ly=e.clientY;look.setPointerCapture?.(e.pointerId);try{const doc=frame.contentDocument,canvas=doc&&doc.querySelector('canvas');if(doc&&canvas){try{Object.defineProperty(doc,'pointerLockElement',{configurable:true,get:()=>canvas});}catch(_){}}}catch(_){} });
    look.addEventListener('pointermove',e=>{if(e.pointerId!==lookPointerId)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;lookX=e.clientX;lookY=e.clientY;mouseMove(dx*1.25,dy*1.25);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>look.addEventListener(t,e=>{if(e.pointerId===lookPointerId)lookPointerId=null;}));
  }

  function cleanupFrame(){
    try{
      const doc=frame.contentDocument;if(!doc)return;
      doc.title=mode==='minecraft'?'Minecraft // KILLZONE':'Counter-Strike // KILLZONE';
      doc.querySelectorAll('a').forEach(a=>{const t=(a.textContent||'').toLowerCase(),h=(a.getAttribute('href')||'').toLowerCase();if(t.includes('errorarea')||h.includes('errorarea'))a.remove();});
      doc.querySelectorAll('*').forEach(el=>{const t=(el.textContent||'').trim();if(t==='create by ErrorArea')el.remove();});
    }catch(e){console.warn('KillZone mobile frame cleanup unavailable',e);}
  }

  function boot(){
    document.body.classList.add('kz-mobile');injectStyles();cleanupFrame();
    const ui=document.createElement('div');ui.className='kz-mobile-ui';
    const hint=document.createElement('div');hint.className='kz-hint';hint.textContent=mode==='minecraft'?'چپ: حرکت · راست: دوربین · دکمه‌ها: بازی':'چپ: حرکت · راست: دوربین · 🔥 شلیک · ◉ هدف‌گیری';ui.appendChild(hint);
    mode==='minecraft'?setupMinecraft(ui):setupCS(ui);document.body.appendChild(ui);
    frame.addEventListener('load',cleanupFrame);
    window.addEventListener('pagehide',()=>{activeKeys.forEach(k=>pressKey(k,false));activeKeys.clear();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();