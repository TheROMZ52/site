// KillZone member visibility guard — only approved team members belong on the public members page.
(function(){
  'use strict';

  function cleanMembersPage(){
    const container = document.getElementById('membersContainer');
    if(!container) return;

    container.querySelectorAll('.rank-section').forEach(section => {
      const heading = section.querySelector('.rank-heading h3');
      if(!heading) return;

      // Guests are account holders who have not been approved into the team.
      // Their cards must never appear on the public members page.
      if(heading.textContent.trim() === 'مهمان') section.remove();
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
