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

  const rankOrder = new Map(RANKS.map((item,index)=>[item[0], index]));
  const rankLabel = new Map(RANKS);
  const root = () => document.getElementById('membersCommunityContainer');
  const staff = () => !!(window.currentUser && ['admin','developer','co_owner','owner'].includes(window.currentUser.rank));

  function injectStyles(){
    if(document.getElementById('kz-ranked-members-styles')) return;
    const style=document.createElement('style');
    style.id='kz-ranked-members-styles';
    style.textContent=`
      .kz-member-rank-section{margin:0 0 30px}
      .kz-member-rank-heading{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:0 2px}
      .kz-member-rank-heading .tier{color:var(--ember,#df6330);font-size:13px}
      .kz-member-rank-heading h2{margin:0;color:var(--paper,#f4eddc);font-size:15px;font-weight:800}
      .kz-member-rank-heading .rule{height:1px;flex:1;background:linear-gradient(90deg,rgba(223,99,48,.55),rgba(89,80,62,.4),transparent)}
      .kz-member-rank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .kz-member-rank-section .kz-profile-card{margin:0}
      @media(max-width:880px){.kz-member-rank-grid{grid-template-columns:1fr}}
      @media(max-width:560px){.kz-member-rank-grid{gap:11px}}
    `;
    document.head.appendChild(style);
  }

  async function getRankMap(){
    if(!window.sb) return new Map();
    const {data,error}=await sb.from('accounts').select('id,username,rank').eq('team_status','approved');
    if(error) return new Map();
    return new Map((data||[]).map(row=>[String(row.username||'').trim().toLowerCase(), row.rank||'member']));
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
    const container=root();
    if(!container) return;
    const cards=[...container.querySelectorAll(':scope > .kz-profile-grid > .kz-profile-card')];
    if(!cards.length) return;

    injectStyles();
    stripStaffMarks(container);

    const ranks=await getRankMap();
    const groups=new Map(RANKS.map(([rank])=>[rank,[]]));

    cards.forEach(card=>{
      const username=(card.querySelector('.kz-profile-name')?.textContent||'').trim().toLowerCase();
      const rank=ranks.get(username)||'member';
      if(!groups.has(rank)) groups.set(rank,[]);
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
      if(!list.length) return;
      const section=makeSection(rank);
      const grid=section.querySelector('.kz-member-rank-grid');
      list.forEach(card=>grid.appendChild(card));
      fragment.appendChild(section);
    });

    // Never surface guests inside the public member sections.
    if(staff() && document.body.dataset.kzShowGuests==='1'){
      const guestSection=makeSection('guest');
      guestSection.classList.add('kz-managed-guest-section');
      fragment.appendChild(guestSection);
    }

    container.replaceChildren(fragment);
  }

  function sanitizePresence(){
    const container=root();
    if(!container) return;
    container.querySelectorAll('.kz-presence').forEach(presence=>{
      const card=presence.closest('.kz-profile-card');
      if(!card) return;
      // Offline cards must never retain configured status/game text from Presence.
      const offline=presence.querySelector('.kz-presence-dot.offline');
      if(offline){
        presence.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
      }
    });
  }

  let timer=null;
  async function sync(){
    if(timer) clearTimeout(timer);
    timer=setTimeout(async()=>{
      await groupMembers();
      sanitizePresence();
    },80);
  }

  function boot(){
    sync();
    setInterval(()=>{ groupMembers().then(sanitizePresence); },10000);
    window.addEventListener('kz:session-changed',sync);
    window.addEventListener('kz:community-refresh',sync);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
