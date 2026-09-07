// KillZone join rescue — guarantees the membership center renders after session/app boot races.
(function(){
  'use strict';

  const isJoinPage=()=>{
    const p=location.pathname.replace(/\/+$/,'');
    return p==='/join'||p.endsWith('/join.html');
  };

  async function rescue(){
    if(!isJoinPage()) return;
    const root=document.getElementById('kzJoinApp');
    if(!root||typeof window.kzRenderJoinPage!=='function') return;
    try{
      // Wait until the normal boot has had a chance to establish the custom session.
      if(typeof sb==='undefined'||typeof initSession!=='function') return;
      if(!window.currentUser) await initSession();
      if(!window.currentUser) return;

      const needsRender =
        root.dataset.kzJoinBoot==='error' ||
        root.dataset.kzJoinBoot==='pending' ||
        root.textContent.trim()==='' ||
        !!root.querySelector('.loading-note');

      if(needsRender){
        await window.kzRenderJoinPage();
      }
      root.dataset.kzJoinRescued='1';
    }catch(error){
      console.error('KillZone join rescue failed',error);
    }
  }

  function start(){
    if(!isJoinPage()) return;
    // A few staggered checks handle the async session + script initialization race.
    [250,700,1400].forEach(delay=>setTimeout(rescue,delay));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
