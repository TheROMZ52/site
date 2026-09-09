// KillZone community rank data bridge.
// Keeps rank data authoritative: unmatched cards are never silently turned into `member`.
(function(){
  'use strict';

  const root=()=>document.getElementById('membersCommunityContainer');
  const normalize=v=>String(v||'').trim().toLowerCase();

  async function applyRanks(){
    const r=root();
    if(!r||!window.sb)return false;
    const cards=[...r.querySelectorAll('.kz-profile-card')];
    if(!cards.length)return false;

    const {data,error}=await window.sb
      .from('accounts')
      .select('id,username,rank')
      .eq('team_status','approved');
    if(error){console.error('KillZone rank data:',error);return false;}

    const byName=new Map((data||[]).map(a=>[
      normalize(a.username),
      normalize(a.rank||'')
    ]));

    cards.forEach(card=>{
      const name=normalize(card.querySelector('.kz-profile-name')?.textContent);
      const rank=byName.get(name)||'';
      if(rank) card.dataset.rank=rank;
      else delete card.dataset.rank;
    });

    r.dataset.kzRanksReady='1';
    window.dispatchEvent(new CustomEvent('kz:ranks-ready'));
    return true;
  }

  function boot(){
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      if(await applyRanks()||tries>=120)clearInterval(timer);
    },250);
    window.addEventListener('kz:session-changed',()=>setTimeout(applyRanks,150));
    window.addEventListener('kz:community-refresh',()=>setTimeout(applyRanks,150));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
