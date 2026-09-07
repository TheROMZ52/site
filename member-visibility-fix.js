// KillZone member visibility guard.
// Guests stay hidden from the public members page, but staff can explicitly reveal them.
(function(){
  'use strict';

  function isStaff(){
    const u = window.currentUser;
    return !!(u && ['admin','developer','co_owner','owner'].includes(u.rank));
  }

  function cleanMembersPage(){
    const container = document.getElementById('membersContainer');
    if(!container) return;

    const allowGuests = isStaff() && document.body.dataset.kzShowGuests === '1';
    container.querySelectorAll('.rank-section').forEach(section => {
      const heading = section.querySelector('.rank-heading h3');
      if(!heading) return;
      if(heading.textContent.trim() === 'مهمان' && !allowGuests) section.remove();
    });
  }

  function boot(){
    cleanMembersPage();
    const container = document.getElementById('membersContainer');
    if(!container) return;
    const observer = new MutationObserver(cleanMembersPage);
    observer.observe(container, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
