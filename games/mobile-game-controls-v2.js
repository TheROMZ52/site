/* KillZone mobile controls v2 — additive bridge; original game files remain unchanged. */
(function(){
  'use strict';

  const frame = document.getElementById('gameFrame');
  const mode = document.body.dataset.mobileGame || 'minecraft';
  if (!frame) return;

  const keys = new Set();
  let joyId = null;
  let lookId = null;
  let joyKeys = new Set();
  let lookX = 0;
  let lookY = 0;
  let gameplayActive = false;

  const CSS = `
    :root{--kz-text:#f4eddc;--kz-line:rgba(244,237,220,.28);--kz-ink:rgba(8,8,7,.72);--kz-orange:#df6330;--kz-green:#728b4b}
    html,body{overscroll-behavior:none}
    body.kz-mobile{touch-action:none}
    .kz-mobile-ui{position:fixed;inset:0;z-index:10000;pointer-events:none;color:var(--kz-text);font-family:Vazirmatn,Arial,sans-serif}
    .kz-mobile-ui *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    .kz-look{position:absolute;inset:0 0 auto auto;width:56%;height:70%;pointer-events:none;touch-action:none}
    .kz-mobile-ui.gameplay .kz-look{pointer-events:auto}
    .kz-stick{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:142px;height:142px;border:1px solid var(--kz-line);border-radius:50%;background:rgba(12,12,10,.26);backdrop-filter:blur(5px);pointer-events:auto;touch-action:none}
    .kz-stick::before{content:"";position:absolute;inset:35px;border:1px solid rgba(244,237,220,.12);border-radius:50%}
    .kz-stick-handle{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px;border-radius:50%;background:rgba(244,237,220,.18);border:1px solid rgba(244,237,220,.3);box-shadow:0 8px 22px rgba(0,0,0,.24);transform:translate(0,0)}
    .kz-pad{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(2,minmax(58px,64px));gap:9px;pointer-events:none}
    .kz-btn{width:64px;height:64px;border:1px solid var(--kz-line);border-radius:15px;background:rgba(12,12,10,.72);color:var(--kz-text);font:800 21px/1 Vazirmatn,Arial,sans-serif;display:grid;place-items:center;pointer-events:auto;touch-action:none;box-shadow:0 8px 18px rgba(0,0,0,.24)}
    .kz-btn:active,.kz-btn.pressed{transform:scale(.94);background:rgba(223,99,48,.28);border-color:rgba(223,99,48,.7)}
    .kz-btn.wide{grid-column:1/-1;width:100%}
    .kz-mini{position:absolute;left:max(10px,env(safe-area-inset-left));top:max(10px,env(safe-area-inset-top));display:flex;gap:7px;pointer-events:auto}
    .kz-mini button{width:45px;height:45px;border:1px solid var(--kz-line);border-radius:11px;background:rgba(12,12,10,.7);color:var(--kz-text);font-weight:800;pointer-events:auto;touch-action:none}
    .kz-hint{position:absolute;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);padding:7px 10px;border:1px solid rgba(244,237,220,.13);background:rgba(8,8,7,.48);font-size:10px;white-space:nowrap;direction:rtl;opacity:.68;pointer-events:none}
    .kz-mobile-ui:not(.gameplay) .kz-stick,.kz-mobile-ui:not(.gameplay) .kz-pad,.kz-mobile-ui:not(.gameplay) .kz-mini,.kz-mobile-ui:not(.gameplay) .kz-hint{opacity:0;pointer-events:none}
    .kz-hotbar{position:absolute;left:50%;bottom:max(10px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:4px;pointer-events:none}
    .kz-hotbar button{width:36px;height:36px;border:1px solid rgba(244,237,220,.2);border-radius:7px;background:rgba(8,8,7,.72);color:var(--kz-text);font-size:11px;pointer-events:auto;touch-action:none}
    @media(min-width:900px){.kz-mobile-ui{display:none}}
    @media(max-width:430px){.kz-stick{width:120px;height:120px}.kz-stick-handle{width:50px;height:50px;margin:-25px}.kz-pad{grid-template-columns:repeat(2,56px);gap:7px}.kz-btn{width:56px;height:56px;font-size:19px}.kz-hotbar button{width:33px;height:33px}.kz-hint{display:none}}
    @media(orientation:landscape){.kz-stick{width:118px;height:118px;bottom:max(9px,env(safe-area-inset-bottom));left:max(10px,env(safe-area-inset-left))}.kz-stick-handle{width:48px;height:48px;margin:-24px}.kz-look{width:53%;height:82%}.kz-pad{grid-template-columns:repeat(2,56px);gap:7px;right:max(10px,env(safe-area-inset-right));bottom:max(9px,env(safe-area-inset-bottom))}.kz-btn{width:56px;height:56px;font-size:18px}.kz-btn.wide{width:119px}.kz-hotbar{bottom:max(7px,env(safe-area-inset-bottom))}.kz-mini{top:max(8px,env(safe-area-inset-top))}}
    @media(orientation:landscape) and (max-height:420px){.kz-stick{width:102px;height:102px}.kz-stick-handle{width:42px;height:42px;margin:-21px}.kz-pad{grid-template-columns:repeat(2,50px);gap:6px}.kz-btn{width:50px;height:50px}.kz-btn.wide{width:106px}.kz-mini button{width:40px;height:40px}}
  `;

  function injectStyles(){
    if(document.getElementById('kz-mobile-v2-style')) return;
    const s=document.createElement('style');s.id='kz-mobile-v2-style';s.textContent=CSS;document.head.appendChild(s);
  }

  function getDoc(){ try{return frame.contentDocument||null;}catch(_){return null;} }
  function getWin(){ try{return frame.contentWindow||null;}catch(_){return null;} }

  function dispatch(target,type,event){try{target.dispatchEvent(event);}catch(_){}}

  function pressKey(code,on){
    const w=getWin(),d=getDoc(); if(!w||!d)return;
    if(on){if(keys.has(code))return;keys.add(code);}else keys.delete(code);
    const ev=new KeyboardEvent(on?'keydown':'keyup',{code,key:code.startsWith('Key')?code.slice(3):code.startsWith('Digit')?code.slice(5):code,bubbles:true,cancelable:true});
    dispatch(w,type,ev); if(d!==w)dispatch(d,type,ev);
  }

  function tapKey(code){pressKey(code,true);setTimeout(()=>pressKey(code,false),18)}

  function mouse(button,on){
    const w=getWin(),d=getDoc(); if(!w||!d)return;
    const ev=new MouseEvent(on?'mousedown':'mouseup',{bubbles:true,cancelable:true,button,buttons:on?(button===0?1:2):0,view:w});
    dispatch(w,'dispatchEvent',ev);dispatch(d,'dispatchEvent',ev);
  }

  function mouseMove(dx,dy){
    const w=getWin(),d=getDoc(); if(!w||!d)return;
    const ev=new MouseEvent('mousemove',{bubbles:true,cancelable:true,view:w,clientX:lookX,clientY:lookY});
    try{Object.defineProperty(ev,'movementX',{value:dx});Object.defineProperty(ev,'movementY',{value:dy});}catch(_){}
    dispatch(d,'mousemove',ev);if(mode==='minecraft')dispatch(w,'mousemove',ev);
  }

  function prepareChildDocument(){
    const d=getDoc();if(!d)return;
    try{
      d.title=mode==='minecraft'?'Minecraft // KILLZONE':'Counter-Strike // KILLZONE';
      d.querySelectorAll('a').forEach(a=>{const t=(a.textContent||'').toLowerCase(),h=(a.getAttribute('href')||'').toLowerCase();if(t.includes('errorarea')||h.includes('errorarea'))a.remove();});
      d.querySelectorAll('*').forEach(el=>{if((el.textContent||'').trim()==='create by ErrorArea')el.remove();});
      if(mode==='counter-strike'){
        const canvas=d.querySelector('canvas');
        if(canvas){
          try{canvas.requestPointerLock=function(){return Promise.resolve();};}catch(_){}
          try{Object.defineProperty(d,'pointerLockElement',{configurable:true,get:()=>canvas});}catch(_){}
        }
      }
    }catch(e){console.warn('KillZone child preparation',e)}
  }

  function isGameplay(){
    const d=getDoc();if(!d)return false;
    const main=d.getElementById('main-menu');
    if(!main)return true;
    return !main.classList.contains('hidden') && !main.classList.contains('hide') && getComputedStyle(main).display!=='none' ? false : true;
  }

  function syncState(ui){
    const active=isGameplay();
    if(active!==gameplayActive){gameplayActive=active;ui.classList.toggle('gameplay',active);}
  }

  function bindHold(el,fn){
    let active=null;
    const end=e=>{if(active===null||e.pointerId!==active)return;e.preventDefault();active=null;el.releasePointerCapture?.(e.pointerId);el.classList.remove('pressed');fn(false)};
    el.addEventListener('pointerdown',e=>{e.preventDefault();if(active!==null)return;active=e.pointerId;el.setPointerCapture?.(e.pointerId);el.classList.add('pressed');fn(true)});
    el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);el.addEventListener('lostpointercapture',end);
  }

  function bindTap(el,fn){
    el.addEventListener('pointerdown',e=>{e.preventDefault();el.classList.add('pressed');});
    const fire=e=>{e.preventDefault();el.classList.remove('pressed');fn()};
    el.addEventListener('pointerup',fire);el.addEventListener('pointercancel',e=>{e.preventDefault();el.classList.remove('pressed')});
  }

  function button(parent,label,cls,fn){
    const b=document.createElement('button');b.type='button';b.className='kz-btn '+(cls||'');b.textContent=label;b.setAttribute('aria-label',label);parent.appendChild(b);fn(b);return b;
  }

  function setupJoystick(stick,handle){
    stick.addEventListener('pointerdown',e=>{e.preventDefault();if(joyId!==null)return;joyId=e.pointerId;stick.setPointerCapture?.(joyId);update(e)});
    stick.addEventListener('pointermove',e=>{if(e.pointerId===joyId)update(e)});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>stick.addEventListener(type,e=>{if(e.pointerId===joyId)release()}));
    function update(e){
      const r=stick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.34;
      let dx=e.clientX-cx,dy=e.clientY-cy,len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}
      handle.style.transform=`translate(${dx}px,${dy}px)`;
      const nx=dx/max,ny=dy/max,next=new Set();
      if(ny<-.28)next.add('KeyW');if(ny>.28)next.add('KeyS');if(nx<-.28)next.add('KeyA');if(nx>.28)next.add('KeyD');
      joyKeys.forEach(k=>{if(!next.has(k))pressKey(k,false)});next.forEach(k=>{if(!joyKeys.has(k))pressKey(k,true)});joyKeys=next;
    }
    function release(){joyId=null;joyKeys.forEach(k=>pressKey(k,false));joyKeys.clear();handle.style.transform='translate(0,0)'}
  }

  function setupLook(look){
    look.addEventListener('pointerdown',e=>{if(!gameplayActive)return;e.preventDefault();lookId=e.pointerId;lookX=e.clientX;lookY=e.clientY;look.setPointerCapture?.(lookId)});
    look.addEventListener('pointermove',e=>{if(e.pointerId!==lookId)return;e.preventDefault();const dx=e.clientX-lookX,dy=e.clientY-lookY;lookX=e.clientX;lookY=e.clientY;mouseMove(dx*(mode==='minecraft'?1.45:1.3),dy*(mode==='minecraft'?1.45:1.3))});
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>look.addEventListener(type,e=>{if(e.pointerId===lookId)lookId=null}));
  }

  function setupMinecraft(ui){
    const stick=document.createElement('div');stick.className='kz-stick';const handle=document.createElement('div');handle.className='kz-stick-handle';stick.appendChild(handle);ui.appendChild(stick);
    const look=document.createElement('div');look.className='kz-look';ui.appendChild(look);setupJoystick(stick,handle);setupLook(look);
    const pad=document.createElement('div');pad.className='kz-pad';ui.appendChild(pad);
    button(pad,'پرش','kz-jump',b=>bindHold(b,on=>pressKey('Space',on)));
    button(pad,'شکستن','',b=>bindHold(b,on=>mouse(0,on)));
    button(pad,'گذاشتن','',b=>bindTap(b,()=>mouse(2,true)||mouse(2,false)));
    button(pad,'E','',b=>bindTap(b,()=>tapKey('KeyE')));
    const hot=document.createElement('div');hot.className='kz-hotbar';for(let i=1;i<=6;i++)button(hot,String(i),'',b=>bindTap(b,()=>tapKey('Digit'+i)));ui.appendChild(hot);
    const mini=document.createElement('div');mini.className='kz-mini';ui.appendChild(mini);button(mini,'⏸','',b=>bindTap(b,()=>tapKey('Escape')));
  }

  function setupCS(ui){
    const stick=document.createElement('div');stick.className='kz-stick';const handle=document.createElement('div');handle.className='kz-stick-handle';stick.appendChild(handle);ui.appendChild(stick);
    const look=document.createElement('div');look.className='kz-look';ui.appendChild(look);setupJoystick(stick,handle);setupLook(look);
    const pad=document.createElement('div');pad.className='kz-pad';ui.appendChild(pad);
    button(pad,'🔥','kz-fire',b=>bindHold(b,on=>mouse(0,on)));
    button(pad,'◉','',b=>bindHold(b,on=>mouse(2,on)));
    button(pad,'⤴','kz-jump',b=>bindTap(b,()=>tapKey('Space')));
    button(pad,'R','',b=>bindTap(b,()=>tapKey('KeyR')));
    button(pad,'B','',b=>bindTap(b,()=>tapKey('KeyB')));
    button(pad,'SHIFT','wide',b=>bindHold(b,on=>pressKey('ShiftLeft',on)));
    const mini=document.createElement('div');mini.className='kz-mini';ui.appendChild(mini);button(mini,'ESC','',b=>bindTap(b,()=>tapKey('Escape')));
  }

  function boot(){
    document.body.classList.add('kz-mobile');injectStyles();
    const ui=document.createElement('div');ui.className='kz-mobile-ui';
    const hint=document.createElement('div');hint.className='kz-hint';hint.textContent=mode==='minecraft'?'چپ: حرکت · راست: دوربین · دکمه‌ها: بازی':'چپ: حرکت · راست: دوربین · 🔥 شلیک · ◉ هدف‌گیری · B خرید';ui.appendChild(hint);
    mode==='minecraft'?setupMinecraft(ui):setupCS(ui);document.body.appendChild(ui);
    const tick=()=>{prepareChildDocument();syncState(ui)};
    frame.addEventListener('load',()=>{prepareChildDocument();setTimeout(tick,50)});
    setInterval(tick,180);
    prepareChildDocument();syncState(ui);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
