// KillZone members community extras: presence + guest management.
(function(){
  'use strict';
  const staff=()=>!!(window.currentUser&&['admin','developer','co_owner','owner'].includes(window.currentUser.rank));
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const waitForSb=async()=>{for(let i=0;i<80&&!window.sb;i++)await new Promise(r=>setTimeout(r,125));return !!window.sb;};
  const container=()=>document.getElementById('membersCommunityContainer');

  async function paintPresence(){
    if(!container()||!window.sb)return;
    const cards=[...container().querySelectorAll('.kz-profile-card')];if(!cards.length)return;
    const {data:rows,error}=await sb.from('member_presence').select('account_id,status,game,status_text,last_seen');
    if(error)return;
    const {data:accounts}=await sb.from('accounts').select('id,username').eq('team_status','approved');
    const names=new Map((accounts||[]).map(a=>[a.id,String(a.username||'').trim().toLowerCase()]));
    const byName=new Map((rows||[]).map(r=>[names.get(r.account_id),r]));
    cards.forEach(card=>{
      const name=card.querySelector('.kz-profile-name')?.textContent?.trim().toLowerCase();if(!name)return;
      card.querySelector('.kz-presence')?.remove();
      const row=byName.get(name);const wrap=document.createElement('div');wrap.className='kz-presence';
      if(!row){wrap.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';card.querySelector('.kz-profile-main')?.appendChild(wrap);return;}
      const age=Date.now()-new Date(row.last_seen).getTime();const online=Number.isFinite(age)&&age<=5*60*1000;
      const labels={playing:['در حال بازی','🎮'],competitive:['در حال رقابت','🏆'],ready:['آماده','🟢'],busy:['مشغول','🔴'],away:['AFK','💤']};
      const info=labels[row.status]||labels.ready;wrap.innerHTML=online?`<span class="kz-presence-dot ${esc(row.status||'ready')}"></span><span>${info[1]} ${info[0]}</span>${row.game?`<small>${esc(row.game)}</small>`:''}`:'<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
      card.querySelector('.kz-profile-main')?.appendChild(wrap);
    });
  }

  async function renderGuests(){
    const c=container();if(!c||!staff()||!sb)return;
    c.querySelector('.kz-guest-section')?.remove();
    const {data,error}=await sb.from('accounts').select('id,username,game,photo,team_status').eq('rank','guest').order('username');
    if(error)return;
    const section=document.createElement('section');section.className='kz-guest-section';
    section.innerHTML='<div class="kz-profile-section-title"><h3>اکانت‌های مهمان</h3><span>GUEST ACCOUNTS</span></div><div class="kz-guest-grid"></div>';
    c.appendChild(section);const grid=section.querySelector('.kz-guest-grid');
    if(!data?.length){grid.innerHTML='<div class="kz-community-empty">اکانت مهمانی وجود نداره.</div>';return;}
    data.forEach(m=>{const card=document.createElement('article');card.className='kz-profile-card kz-guest-card';card.innerHTML=`${m.photo?`<img class="kz-profile-avatar" src="${esc(m.photo)}" alt="${esc(m.username)}" loading="lazy">`:`<div class="kz-profile-avatar">${esc(String(m.username||'?').slice(0,2).toUpperCase())}</div>`}<div class="kz-profile-main"><h3 class="kz-profile-name">${esc(m.username)}</h3><div class="kz-profile-meta"><span>${esc(m.game||'بازی ثبت نشده')}</span><span>مهمان</span></div></div><div class="kz-guest-actions"><button class="btn primary small" type="button" data-action="approve">✓ تأیید</button><button class="btn ghost small" type="button" data-action="delete">حذف</button></div>`;
      card.querySelector('[data-action="approve"]').addEventListener('click',async()=>{if(!confirm(`اکانت «${m.username}» تأیید و به عضو تبدیل شود؟`))return;const r=await sb.from('accounts').update({rank:'member',team_status:'approved'}).eq('id',m.id).eq('rank','guest');if(r.error){alert('تأیید اکانت انجام نشد.');return;}await renderGuests();});
      card.querySelector('[data-action="delete"]').addEventListener('click',async()=>{if(!confirm(`اکانت «${m.username}» حذف شود؟`))return;const r=await sb.from('accounts').delete().eq('id',m.id).eq('rank','guest');if(r.error){alert('حذف اکانت انجام نشد.');return;}await renderGuests();});grid.appendChild(card);});
  }

  function wire(){
    const guest=document.getElementById('guestAccountsBtn');if(guest&&!guest.dataset.kzBound){guest.dataset.kzBound='1';guest.addEventListener('click',async()=>{const shown=guest.dataset.shown==='1';if(shown){container()?.querySelector('.kz-guest-section')?.remove();guest.dataset.shown='0';guest.textContent='👥 مشاهده اکانت‌های مهمان';}else{guest.disabled=true;await renderGuests();guest.disabled=false;guest.dataset.shown='1';guest.textContent='👁 مخفی‌کردن مهمان‌ها';}});}
  }
  async function boot(){if(!await waitForSb())return;wire();paintPresence();setInterval(paintPresence,10000);setInterval(wire,1000);}
  window.addEventListener('kz:community-refresh',()=>location.reload());
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
