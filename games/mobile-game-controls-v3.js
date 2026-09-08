/* KillZone mobile controls v3 — touch-first bridge for the existing full games. */
(function () {
  'use strict';

  const frame = document.getElementById('gameFrame');
  const mode = document.body.dataset.mobileGame || 'minecraft';
  if (!frame) return;

  let ui = null;
  let active = false;
  const held = new Set();
  const pointers = new Map();
  let lookId = null;
  let lookX = 0;
  let lookY = 0;
  let pollTimer = null;

  const css = `
    html,body{width:100%;height:100%;overflow:hidden;overscroll-behavior:none;touch-action:none}
    .kz-mobile-ui{position:fixed;inset:0;z-index:10000;pointer-events:none;font-family:Vazirmatn,Arial,sans-serif;color:#f4eddc}
    .kz-mobile-ui.hidden{display:none}
    .kz-zone{position:absolute;touch-action:none;pointer-events:auto;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
    .kz-stick{left:max(14px,env(safe-area-inset-left));bottom:max(14px,env(safe-area-inset-bottom));width:140px;height:140px;border:1px solid rgba(244,237,220,.28);border-radius:50%;background:rgba(8,8,7,.38);backdrop-filter:blur(6px)}
    .kz-stick:after{content:"";position:absolute;inset:34px;border:1px solid rgba(244,237,220,.14);border-radius:50%}
    .kz-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:rgba(244,237,220,.22);border:1px solid rgba(244,237,220,.36);transform:translate(0,0)}
    .kz-look{right:0;top:0;width:54%;height:74%;z-index:1}
    .kz-buttons{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,58px);gap:8px;z-index:3}
    .kz-btn{width:58px;height:58px;border:1px solid rgba(244,237,220,.28);border-radius:14px;background:rgba(8,8,7,.76);color:#f4eddc;font:800 15px/1 Vazirmatn,Arial,sans-serif;touch-action:none;display:grid;place-items:center;box-shadow:0 6px 16px rgba(0,0,0,.3)}
    .kz-btn:active,.kz-btn.on{transform:scale(.94);border-color:#df6330;background:rgba(223,99,48,.3)}
    .kz-btn.fire{background:rgba(223,99,48,.3);font-size:23px}
    .kz-btn.green{background:rgba(114,139,75,.28)}
    .kz-top{left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));display:flex;gap:7px;z-index:5}
    .kz-top .kz-btn{width:48px;height:42px;font-size:12px}
    .kz-hint{left:50%;top:10px;transform:translateX(-50%);padding:6px 9px;border:1px solid rgba(244,237,220,.16);background:rgba(8,8,7,.45);font-size:10px;white-space:nowrap;direction:rtl;opacity:.75;z-index:4}
    .kz-hotbar{left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:4px;z-index:4}
    .kz-hotbar .kz-btn{width:38px;height:38px;font-size:11px;border-radius:7px}
    @media(max-width:520px){.kz-stick{width:122px;height:122px}.kz-knob{width:50px;height:50px;margin:-25px}.kz-buttons{grid-template-columns:repeat(3,52px);gap:6px}.kz-btn{width:52px;height:52px}.kz-top .kz-btn{width:44px;height:40px}.kz-hotbar .kz-btn{width:32px;height:32px}}
    @media(orientation:landscape) and (max-height:520px){.kz-stick{width:112px;height:112px}.kz-knob{width:46px;height:46px;margin:-23px}.kz-look{width:48%;height:86%}.kz-buttons{bottom:8px;grid-template-columns:repeat(4,50px);gap:6px}.kz-btn{width:50px;height:50px}.kz-top{top:8px}.kz-hint{display:none}.kz-hotbar{bottom:7px}}
  `;

  function childDoc(){ return frame.contentDocument || null; }
  function childWin(){ return frame.contentWindow || null; }
  function childCanvas(){ const d=childDoc(); return d && d.querySelector('canvas'); }

  function dispatchKey(code, down){
    const w=childWin(), d=childDoc();
    if(!w || !d) return;
    if(down){ if(held.has(code)) return; held.add(code); }
    else held.delete(code);
    const key = code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? ' ' : code === 'Escape' ? 'Escape' : code === 'ShiftLeft' ? 'Shift' : code;
    const opts={code,key,bubbles:true,cancelable:true,composed:true,repeat:false};
    const ev1=new KeyboardEvent(down?'keydown':'keyup',opts);
    const ev2=new KeyboardEvent(down?'keydown':'keyup',opts);
    try{w.dispatchEvent(ev1);}catch(_){ }
    try{d.dispatchEvent(ev2);}catch(_){ }
  }

  function dispatchMouse(button,down){
    const w=childWin(), d=childDoc();
    if(!w || !d) return;
    const target=childCanvas() || d.body;
    const opts={bubbles:true,cancelable:true,view:w,button,buttons:down?(button===2?2:1):0,clientX:lookX,clientY:lookY};
    const e1=new MouseEvent(down?'mousedown':'mouseup',opts);
    const e2=new MouseEvent(down?'mousedown':'mouseup',opts);
    try{target.dispatchEvent(e1);}catch(_){ }
    try{w.dispatchEvent(e2);}catch(_){ }
  }

  function lockPointer(){
    const w=childWin(), d=childDoc(), c=childCanvas();
    try{
      if(c && typeof c.requestPointerLock==='function') c.requestPointerLock();
      else if(d && d.body && typeof d.body.requestPointerLock==='function') d.body.requestPointerLock();
    }catch(_){ }
    if(w) w.__KZ_MOBILE_LOOK=true;
  }

  function dispatchLook(dx,dy){
    const w=childWin(), d=childDoc(); if(!w || !d) return;
    lookX+=dx; lookY+=dy;
    const opts={bubbles:true,cancelable:true,view:w,clientX:lookX,clientY:lookY};
    const e1=new MouseEvent('mousemove',opts), e2=new MouseEvent('mousemove',opts);
    try{Object.defineProperty(e1,'movementX',{value:dx});Object.defineProperty(e1,'movementY',{value:dy});}catch(_){ }
    try{Object.defineProperty(e2,'movementX',{value:dx});Object.defineProperty(e2,'movementY',{value:dy});}catch(_){ }
    try{w.dispatchEvent(e1);}catch(_){ }
    try{d.dispatchEvent(e2);}catch(_){ }
  }

  function button(parent,label,cls,down,up=down){
    const b=document.createElement('button'); b.type='button'; b.className='kz-btn '+(cls||''); b.textContent=label; b.setAttribute('aria-label',label);
    parent.appendChild(b);
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();b.classList.add('on');b.setPointerCapture?.(e.pointerId);down(e);});
    const end=e=>{e.preventDefault();e.stopPropagation();b.classList.remove('on');up(e);};
    b.addEventListener('pointerup',end); b.addEventListener('pointercancel',end); b.addEventListener('lostpointercapture',()=>{b.classList.remove('on');up({});});
    return b;
  }

  function setup(){
    const style=document.createElement('style'); style.textContent=css; document.head.appendChild(style);
    ui=document.createElement('div'); ui.className='kz-mobile-ui hidden';

    const hint=document.createElement('div'); hint.className='kz-zone kz-hint'; hint.textContent=mode==='minecraft'?'چپ: حرکت · راست: دوربین · لمس چندگانه فعال':'چپ: حرکت · راست: دوربین · شلیک · هدف‌گیری · B · ESC'; ui.appendChild(hint);

    const look=document.createElement('div'); look.className='kz-zone kz-look'; ui.appendChild(look);
    look.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();lookId=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture?.(e.pointerId);lockPointer();});
    look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;e.preventDefault();const dx=e.clientX-lookX,dy=e.clientY-lookY;lookX=e.clientX;lookY=e.clientY;dispatchLook(dx*1.35,dy*1.35);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>look.addEventListener(t,e=>{if(e.pointerId===lookId)lookId=null;}));

    const stick=document.createElement('div'); stick.className='kz-zone kz-stick'; const knob=document.createElement('div');knob.className='kz-knob';stick.appendChild(knob);ui.appendChild(stick);
    let joyId=null, joyKeys=new Set();
    stick.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();joyId=e.pointerId;stick.setPointerCapture?.(e.pointerId);updateJoy(e);});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)updateJoy(e);});
    const release=()=>{if(joyId===null)return;joyKeys.forEach(k=>dispatchKey(k,false));joyKeys.clear();joyId=null;knob.style.transform='translate(0,0)';};
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>stick.addEventListener(t,release));
    function updateJoy(e){
      const r=stick.getBoundingClientRect(),max=r.width*.34,cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}
      knob.style.transform=`translate(${dx}px,${dy}px)`;const nx=dx/max,ny=dy/max,next=new Set();if(ny<-.25)next.add('KeyW');if(ny>.25)next.add('KeyS');if(nx<-.25)next.add('KeyA');if(nx>.25)next.add('KeyD');joyKeys.forEach(k=>{if(!next.has(k))dispatchKey(k,false)});next.forEach(k=>{if(!joyKeys.has(k))dispatchKey(k,true)});joyKeys=next;
    }

    const pad=document.createElement('div');pad.className='kz-zone kz-buttons';ui.appendChild(pad);
    if(mode==='minecraft'){
      button(pad,'پرش','green',()=>dispatchKey('Space',true),()=>dispatchKey('Space',false));
      button(pad,'شکستن','',()=>dispatchMouse(0,true),()=>dispatchMouse(0,false));
      button(pad,'گذاشتن','',()=>dispatchMouse(2,true),()=>dispatchMouse(2,false));
      button(pad,'E','',()=>dispatchKey('KeyE',true),()=>dispatchKey('KeyE',false));
      button(pad,'ESC','',()=>dispatchKey('Escape',true),()=>dispatchKey('Escape',false));
    }else{
      button(pad,'🔥','fire',()=>dispatchMouse(0,true),()=>dispatchMouse(0,false));
      button(pad,'◉','',()=>dispatchMouse(2,true),()=>dispatchMouse(2,false));
      button(pad,'R','',()=>dispatchKey('KeyR',true),()=>dispatchKey('KeyR',false));
      button(pad,'B','',()=>dispatchKey('KeyB',true),()=>dispatchKey('KeyB',false));
      button(pad,'ESC','',()=>dispatchKey('Escape',true),()=>dispatchKey('Escape',false));
      button(pad,'1','',()=>dispatchKey('Digit1',true),()=>dispatchKey('Digit1',false));
      button(pad,'2','',()=>dispatchKey('Digit2',true),()=>dispatchKey('Digit2',false));
      button(pad,'3','',()=>dispatchKey('Digit3',true),()=>dispatchKey('Digit3',false));
      button(pad,'SPACE','green',()=>dispatchKey('Space',true),()=>dispatchKey('Space',false));
      button(pad,'SHIFT','',()=>dispatchKey('ShiftLeft',true),()=>dispatchKey('ShiftLeft',false));
    }

    const top=document.createElement('div');top.className='kz-zone kz-top';ui.appendChild(top);
    button(top,'⛶','',()=>{try{document.documentElement.requestFullscreen?.();}catch(_){ }},()=>{});
    button(top,'↻','',()=>{try{childWin()?.location.reload();}catch(_){ }},()=>{});

    if(mode==='minecraft'){
      const hot=document.createElement('div');hot.className='kz-zone kz-hotbar';ui.appendChild(hot);for(let i=1;i<=6;i++)button(hot,String(i),'',()=>dispatchKey('Digit'+i,true),()=>dispatchKey('Digit'+i,false));
    }

    document.body.appendChild(ui);
    frame.addEventListener('load',()=>{active=false;ui.classList.add('hidden');});

    pollTimer=setInterval(()=>{
      const d=childDoc(); if(!d)return;
      const menu=d.getElementById(mode==='minecraft'?'main-menu':'main-menu');
      const running=mode==='minecraft' ? !!menu && menu.classList.contains('hidden') : !!menu && menu.classList.contains('hidden');
      if(running!==active){active=running;ui.classList.toggle('hidden',!active);}
    },150);

    window.addEventListener('pagehide',()=>{clearInterval(pollTimer);held.forEach(k=>dispatchKey(k,false));held.clear();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
