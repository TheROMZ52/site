// KillZone guest account viewer.
// Guests are private by default and are only exposed to staff through an explicit toggle.
(function(){
  'use strict';

  const STAFF = ['admin','developer','co_owner','owner'];
  let wired = false;

  function isStaff(){
    return !!(window.currentUser && STAFF.includes(window.currentUser.rank));
  }

  function renderButton(){
    const toolbar = document.querySelector('.members-toolbar');
    if(!toolbar || !isStaff()) return false;

    let button = document.getElementById('guestAccountsBtn');
    if(!button){
      button = document.createElement('button');
      button.id = 'guestAccountsBtn';
      button.className = 'btn ghost small guest-accounts-btn';
      toolbar.appendChild(button);
    }

    const shown = document.body.dataset.kzShowGuests === '1';
    button.textContent = shown ? '👁 مخفی‌کردن مهمان‌ها' : '👥 مشاهده اکانت‌های مهمان';
    button.setAttribute('aria-pressed', String(shown));

    if(!wired){
      wired = true;
      button.addEventListener('click', async function(){
        if(!isStaff()) return;
        const next = document.body.dataset.kzShowGuests !== '1';
        document.body.dataset.kzShowGuests = next ? '1' : '0';
        button.disabled = true;
        try{
          if(typeof window.renderMembersPage === 'function') await window.renderMembersPage();
        }finally{
          button.disabled = false;
          renderButton();
        }
      });
    }
    return true;
  }

  function sync(){
    if(!isStaff()){
      document.body.dataset.kzShowGuests = '0';
      document.getElementById('guestAccountsBtn')?.remove();
      return;
    }
    renderButton();
  }

  function boot(){
    sync();
    // app.js restores the session asynchronously, so wait briefly for it.
    let tries = 0;
    const timer = setInterval(()=>{
      sync();
      if(++tries >= 40) clearInterval(timer);
    }, 250);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
