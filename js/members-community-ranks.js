// KillZone ranked community view — restores the legacy grouped-by-rank layout.
(function(){
  'use strict';
  const ORDER=['owner','co_owner','developer','admin','member','new_member','guest'];
  const LABELS={owner:'Owner',co_owner:'Co-Owner',developer:'Developer',admin:'Admin',member:'Member',new_member:'New Member',guest:'Guest'};
  const TITLES={owner:'OWNER',co_owner:'CO-OWNER',developer:'DEVELOPER',admin:'ADMIN',member:'MEMBER',new_member:'NEW MEMBER',guest:'GUEST'};
  const normalize=v=>String(v||'').trim().toLowerCase();
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  async function getRanks(){
    if(!window.sb)return new Map();
    const {data,error}=await sb.from('accounts').select('username,rank,team_status').eq('team_status','approved');
    if(error){console.warn('KillZone rank grouping:',error);return new Map();}
    return new Map((data||[]).map(a=>[normalize(a.username),normalize(a.rank)]));
  }

  function rankName(rank){return LABELS[rank]||rank||'Member';}

  async function regroup(){
    const root=document.getElementById('membersCommunityContainer');
    if(!root || root.querySelector('.kz-community-rank-section'))return;
    const source=root.querySelector('.kz-profile-grid');
    if(!source)return;
    const cards=[...source.querySelectorAll('.kz-profile-card')];
    if(!cards.length)return;
    const ranks=await getRanks();
    const groups=new Map();
    cards.forEach(card=>{
      const username=normalize(card.querySelector('.kz-profile-name')?.textContent);
      const rank=ORDER.includes(ranks.get(username))?ranks.get(username):'member';
      if(!groups.has(rank))groups.set(rank,[]);
      groups.get(rank).push(card);
    });

    const fragment=document.createDocumentFragment();
    ORDER.forEach(rank=>{
      const list=groups.get(rank);if(!list?.length)return;
      list.sort((a,b)=>(a.querySelector('.kz-profile-name')?.textContent||'').localeCompare(b.querySelector('.kz-profile-name')?.textContent||'','fa',{sensitivity:'base'}));
      const section=document.createElement('section');
      section.className='rank-section kz-community-rank-section';
      section.dataset.rank=rank;
      section.innerHTML=`<div class="rank-heading kz-community-rank-heading"><span class="tier">◆</span><h3>${rankName(rank)}</h3><div class="rule"></div><span class="kz-community-rank-code">${TITLES[rank]}</span></div>`;
      const grid=document.createElement('div');
      grid.className='member-grid kz-profile-grid';
      list.forEach(card=>grid.appendChild(card));
      section.appendChild(grid);fragment.appendChild(section);
    });
    root.replaceChildren(fragment);
  }

  async function boot(){
    for(let i=0;i<80;i++){
      const root=document.getElementById('membersCommunityContainer');
      if(root&&window.sb){
        await regroup();
        if(root.querySelector('.kz-community-rank-section'))break;
      }
      await wait(250);
    }
    const root=document.getElementById('membersCommunityContainer');
    if(root){
      const observer=new MutationObserver(()=>{ if(!root.querySelector('.kz-community-rank-section'))regroup(); });
      observer.observe(root,{childList:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('kz:session-changed',()=>{regroup();});
})();
