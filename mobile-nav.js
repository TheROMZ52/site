// KillZone mobile navigation — reliable hamburger menu toggle.
(function(){
  'use strict';
  function boot(){
    const button=document.getElementById('menuToggle');
    const nav=document.querySelector('nav.main');
    if(!button||!nav||button.dataset.kzNavReady==='1') return;
    button.dataset.kzNavReady='1';
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-controls','kzMainNav');
    nav.id='kzMainNav';
    const close=()=>{nav.classList.remove('open');button.setAttribute('aria-expanded','false');};
    button.addEventListener('click',()=>{
      const open=nav.classList.toggle('open');
      button.setAttribute('aria-expanded',String(open));
    });
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    document.addEventListener('click',e=>{
      if(!nav.classList.contains('open')) return;
      if(!nav.contains(e.target)&&e.target!==button) close();
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape') close();});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
