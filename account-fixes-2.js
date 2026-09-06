// KillZone account fixes v2 — keep account rank separate from team approval.
(function(){
  function patchAccountsForMembers(){
    if(typeof window.fetchAccounts!=='function' || window.fetchAccounts.__kzStatusFix) return;
    const original=window.fetchAccounts;
    const wrapped=async function(){
      const rows=await original();
      if(document.getElementById('membersContainer')){
        // Legacy accounts without team_status are treated as existing approved members.
        return (rows||[]).filter(a=>a.team_status==null || a.team_status==='approved');
      }
      return rows||[];
    };
    wrapped.__kzStatusFix=true;
    window.fetchAccounts=wrapped;
  }
  window.addEventListener('kz:session-ready',()=>{
    if(location.pathname.endsWith('join.html') && typeof window.renderUserBox==='function') window.renderUserBox();
  });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(patchAccountsForMembers,0),{once:true});
  else setTimeout(patchAccountsForMembers,0);
})();
