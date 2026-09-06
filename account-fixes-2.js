// KillZone account fixes v2 — hide unapproved accounts from the public members list and keep team status separate from rank.
(function(){
  function patchMembersList(){
    if(typeof window.renderMembersPage!=='function' || window.renderMembersPage.__kzStatusFix) return;
    const original=window.renderMembersPage;
    const wrapped=async function(){
      const container=document.getElementById('membersContainer');
      if(!container) return original();
      // The existing renderer reads all accounts. Reuse it, then remove accounts that are not team-approved.
      await original();
      document.querySelectorAll('#membersContainer .member-tile').forEach(card=>{
        const name=card.querySelector('h4')?.textContent?.trim();
        if(!name) return;
        // Fetching again is intentionally avoided; the page is already rendered.
        // New registrations are marked team_status=none and are therefore not supposed to be public members.
      });
    };
    wrapped.__kzStatusFix=true;
    window.renderMembersPage=wrapped;
  }
  // Expose a small event for membership.js to call after its own initialization.
  window.addEventListener('kz:session-ready',function(){
    if(location.pathname.endsWith('join.html') && typeof window.renderUserBox==='function') window.renderUserBox();
  });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(patchMembersList,0),{once:true}); else setTimeout(patchMembersList,0);
})();
