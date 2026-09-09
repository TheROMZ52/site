// KillZone members community grouping layer.
// Restores the classic rank-separated member layout without exposing staff badges.
(function(){
  'use strict';

  const RANKS = [
    ['owner','اونر'],
    ['co_owner','کو-اونر'],
    ['developer','دولوپر'],
    ['admin','ادمین'],
    ['member','ممبر'],
    ['new_member','نیو ممبر'],
    ['guest','مهمان']
  ];

  const rankLabel = new Map(RANKS);
  const root = () => document.getElementById('membersCommunityContainer');
  const staff = () => !!(window.currentUser && ['admin','developer','co_owner','owner'].includes(window.currentUser.rank));
  let grouping = false;
  let queued = false;

  function injectStyles(){
    if(document.getElementById('kz-ranked-members-styles')) return;
    const style=document.createElement('style');
    style.id='kz-ranked-members-styles';
    style.textContent=`
      .kz-member-rank-section{margin:0 0 32px}
      .kz-member-rank-heading{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:0 2px}
      .kz-member-rank-heading .tier{color:var(--ember,#df6330);font-size:13px;line-height:1}
      .kz-member-rank-heading h2{margin:0;color:var(--paper,#f4eddc);font-size:15px;font-weight:800;white-space:nowrap}
      .kz-member-rank-heading .rule{height:1px;flex:1;background:linear-gradient(90deg,rgba(223,99,48,.58),rgba(89,80,62,.42),transparent)}
      .kz-member-rank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .kz-member-rank-section .kz-profile-card{margin:0}
      @media(max-width:880px){.kz-member-rank-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.kz-member-rank-grid{gap:11px}.kz-member-rank-heading{gap:9px}.kz-member-rank-heading h2{font-size:14px}}
    `;
    document.head.appendChild(style);
  }

  async function getRankMap(){
    if(typeof window.fetchAccounts==='function'){
      try{
        const rows=await window.fetchAccounts();
        if(Array.isArray(rows)&&rows.length){
          return new Map(rows.map(row=>[String(row.username||'').trim().toLowerCase(),String(row.rank||'member').trim().toLowerCase()]));
        }
      }catch(err){console.warn('KillZone fetchAccounts rank grouping:',err);}
    }
    if(!window.sb) return new Map();
    const {data,error}=await sb.from('accounts').select('id,username,rank').eq('team_status','approved');
    if(error){console.warn('KillZone rank grouping:',error);return new Map();}
    return new Map((data||[]).map(row=>[String(row.username||'').trim().toLowerCase(),String(row.rank||'member').trim().toLowerCase()]));
  }

  function stripStaffMarks(container){
    container.querySelectorAll('.kz-staff-mark').forEach(el=>el.remove());
  }

  function makeSection(rank){
    const section=document.createElement('section');
    section.className='kz-member-rank-section';
    section.dataset.rank=rank;
    section.innerHTML=`<div class="kz-member-rank-heading"><span class="tier">▲</span><h2>${rankLabel.get(rank)||rank}</h2><div class="rule"></div></div><div class="kz-member-rank-grid"></div>`;
    return section;
  }

  async function groupMembers(){
    if(grouping)return;
    const container=root();
    if(!container)return;

    const source=container.querySelector(':scope > .kz-profile-grid');
    if(!source)return;
    const cards=[...source.querySelectorAll(':scope > .kz-profile-card')];
    if(!cards.length)return;

    grouping=true;
    try{
      injectStyles();
      stripStaffMarks(container);
      const ranks=await getRankMap();
      if(!ranks.size)return;
      const groups=new Map(RANKS.map(([rank])=>[rank,[]]));

      cards.forEach(card=>{
        const username=(card.querySelector('.kz-profile-name')?.textContent||'').trim().toLowerCase();
        const rank=ranks.get(username);
        if(!rank || !groups.has(rank))return;
        groups.get(rank).push(card);
      });

      groups.forEach(list=>list.sort((a,b)=>{
        const aa=(a.querySelector('.kz-profile-name')?.textContent||'').trim();
        const bb=(b.querySelector('.kz-profile-name')?.textContent||'').trim();
        return aa.localeCompare(bb,'fa',{sensitivity:'base'});
      }));

      const fragment=document.createDocumentFragment();
      RANKS.forEach(([rank])=>{
        const list=groups.get(rank)||[];
        if(!list.length)return;
        const section=makeSection(rank);
        const grid=section.querySelector('.kz-member-rank-grid');
        list.forEach(card=>grid.appendChild(card));
        fragment.appendChild(section);
      });

      container.replaceChildren(fragment);
    }finally{
      grouping=false;
    }
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      groupMembers();
    });
  }

  function sanitizePresence(){
    const container=root();
    if(!container)return;
    container.querySelectorAll('.kz-presence').forEach(presence=>{
      const offline=presence.querySelector('.kz-presence-dot.offline');
      if(offline)presence.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
    });
  }

  function boot(){
    const container=root();
    if(!container){setTimeout(boot,250);return;}
    const observer=new MutationObserver(()=>{sanitizePresence();schedule();});
    observer.observe(container,{childList:true,subtree:true});
    schedule();
    setInterval(()=>{sanitizePresence();schedule();},5000);
    window.addEventListener('kz:session-changed',schedule);
    window.addEventListener('kz:community-refresh',schedule);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
