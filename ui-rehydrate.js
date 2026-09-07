// KillZone UI rehydration layer — repairs late script/session races without replacing page logic.
(function(){
  'use strict';

  let timer=null;
  let running=false;

  async function refresh(){
    if(running)return;
    running=true;
    try{
      if(typeof window.renderUserBox==='function') window.renderUserBox();
      if(document.getElementById('membersContainer') && typeof window.renderMembersPage==='function') await window.renderMembersPage();
      if(document.getElementById('gamesContainer') && typeof window.renderGamesPage==='function') await window.renderGamesPage();
      if(document.getElementById('regForm') && typeof window.renderRegisterPage==='function') await window.renderRegisterPage();
      if(document.getElementById('kzJoinApp') && typeof window.kzRenderJoinPage==='function') await window.kzRenderJoinPage();
    }catch(error){
      console.error('KillZone UI rehydrate',error);
    }finally{
      running=false;
    }
  }

  function schedule(){
    clearTimeout(timer);
    timer=setTimeout(refresh,60);
  }

  function boot(){
    [0,250,800,1600,3000].forEach(ms=>setTimeout(schedule,ms));
    const userBox=document.getElementById('userBox');
    if(userBox){
      const observer=new MutationObserver(schedule);
      observer.observe(userBox,{childList:true,subtree:true,characterData:true});
    }
    window.addEventListener('kz:session-ready',schedule);
    window.addEventListener('kz:rehydrate',schedule);
    window.kzRehydrateUI=schedule;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
