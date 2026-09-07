// KillZone guest account viewer.
// Guests are private by default and are only exposed to staff through an explicit toggle.
(function(){
  'use strict';

  const STAFF = ['admin','developer','co_owner','owner'];
  let wired = false;

  function isStaff(){
    return !!(window.currentUser && STAFF.includes(window.currentUser.rank));
  }
  function esc(value){
    return String(value ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }
  function initials(name){ return String(name||'?').trim().slice(0,2).toUpperCase(); }

  async function showGuests(){
    const container=document.getElementById('membersContainer');
    if(!container || !isStaff() || typeof sb==='undefined') return;
    const old=container.querySelector('.kz-guest-section');
    if(old) old.remove();
    container.querySelector('.empty-note.kz-guest-empty')?.remove();
    const section=document.createElement('div');
    section.className='rank-section kz-guest-section';
    section.innerHTML='<div class="rank-heading"><span class="tier">▲</span><h3>مهمان‌ها</h3><div class="rule"></div></div><div class="member-grid kz-guest-grid"><div class="loading-note">در حال بارگذاری اکانت‌های مهمان...</div></div>';
    container.prepend(section);
    const grid=section.querySelector('.kz-guest-grid');
    const {data,error}=await sb.from('accounts').select('id,username,rank,game,photo,team_status').eq('rank','guest').order('username');
    if(error){ grid.innerHTML='<div class="empty-note">بارگذاری مهمان‌ها ناموفق بود.</div>'; console.error(error); return; }
    if(!data?.length){ grid.innerHTML='<div class="empty-note">اکانت مهمانی وجود نداره.</div>'; return; }
    grid.innerHTML='';
    data.forEach(m=>{
      const card=document.createElement('div');
      card.className='member-tile guest-tile';
      const status=m.team_status||'none';
      card.innerHTML=`${m.photo?`<img class="avatar" src="${esc(m.photo)}" alt="${esc(m.username)}" loading="lazy" decoding="async">`:`<div class="avatar">${initials(m.username)}</div>`}<h4>${esc(m.username)}</h4><div class="rank-badge"><span class="tier">▲</span> مهمان</div><div class="game-tag">${esc(m.game||'—')}</div><div class="guest-status">وضعیت: ${esc(status)}</div><div class="member-actions"><button class="icon-btn guest-open" type="button">مدیریت</button></div>`;
      card.querySelector('.guest-open').addEventListener('click',()=>{
        // Use the existing member editor if the core exposes it through the page.
        if(typeof window.openMemberModal==='function') window.openMemberModal(m.id,[m]);
        else alert('ویرایشگر عضو در این نسخه در دسترس نیست.');
      });
      grid.appendChild(card);
    });
  }

  function hideGuests(){
    document.body.dataset.kzShowGuests='0';
    document.querySelector('.kz-guest-section')?.remove();
  }

  function renderButton(){
    const toolbar=document.querySelector('.members-toolbar');
    if(!toolbar || !isStaff()) return;
    let button=document.getElementById('guestAccountsBtn');
    if(!button){
      button=document.createElement('button');
      button.id='guestAccountsBtn';
      button.className='btn ghost small guest-accounts-btn';
      toolbar.appendChild(button);
    }
    const shown=document.body.dataset.kzShowGuests==='1';
    button.textContent=shown?'👁 مخفی‌کردن مهمان‌ها':'👥 مشاهده اکانت‌های مهمان';
    button.setAttribute('aria-pressed',String(shown));
    if(!wired){
      wired=true;
      button.addEventListener('click',async()=>{
        if(!isStaff()) return;
        const next=document.body.dataset.kzShowGuests!=='1';
        button.disabled=true;
        try{
          if(next){document.body.dataset.kzShowGuests='1';await showGuests();}
          else hideGuests();
        }finally{button.disabled=false;renderButton();}
      });
    }
  }

  function sync(){
    if(!isStaff()){
      document.body.dataset.kzShowGuests='0';
      document.getElementById('guestAccountsBtn')?.remove();
      document.querySelector('.kz-guest-section')?.remove();
      return;
    }
    renderButton();
  }

  function boot(){
    sync();
    let tries=0;
    const timer=setInterval(()=>{sync();if(++tries>=40)clearInterval(timer);},250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
