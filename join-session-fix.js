// KillZone join page — applicant flow only.
// Reviewer flow is owned by join-rescue.js to prevent duplicate rendering/boot races.
(function(){
  'use strict';
  const REVIEWERS=['developer','co_owner','owner'];
  const isJoinPage=()=>{const p=location.pathname.replace(/\/+$/,'');return p==='/join'||p.endsWith('/join.html');};
  const isReviewer=()=>!!(window.currentUser&&REVIEWERS.includes(window.currentUser.rank));
  async function boot(){
    if(!isJoinPage()||isReviewer()) return;
    if(typeof window.kzRenderJoinPage!=='function'||typeof initSession!=='function') return;
    try{await initSession();if(!window.currentUser||REVIEWERS.includes(window.currentUser.rank))return;await window.kzRenderJoinPage();}
    catch(e){console.error('KillZone applicant join boot failed',e);}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,300),{once:true});
  else setTimeout(boot,300);
})();
