// KillZone guest account viewer.
// Guests are private by default and are only exposed to staff through an explicit toggle.
(function(){
  'use strict';

  const STAFF = ['admin','developer','co_owner','owner'];
  let wired = false;

  function isStaff(){ return !!(window.currentUser && STAFF.includes(window.currentUser.rank)); }
  function esc(value){ return String(value ?? '').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function initials(name){ return String(name||'?').trim().slice(0,2).toUpperCase(); }
  function statusLabel(status){ return ({none:'بدون درخواست',pending:'در انتظار بررسی',reviewing:'در حال بررسی',waiting_applicant:'منتظر پاسخ متقاضی',approved:'تأیید شده',rejected:'رد شده',closed:'بسته شده'})[status] || status || 'نامشخص'; }

  async function approveGuest(accountId){
    if(!isStaff() || typeof sb==='undefined') return;
    const account=await sb.from('accounts').select('id,username,rank,team_status').eq('id',accountId).eq('rank','guest').maybeSingle();
    if(account.error) throw account.error;
    if(!account.data) throw new Error('اکانت مهمان پیدا نشد یا قبلاً تغییر کرده.');
    if(!confirm(`اکانت «${account.data.username}» به عضو تأییدشده تبدیل شود؟`)) return;

    const req=await sb.from('team_join_requests').select('id,status').eq('account_id',accountId).order('created_at',{ascending:false}).limit(1);
    if(req.error) throw req.error;

    const updateAccount=await sb.from('accounts').update({rank:'member',team_status:'approved'}).eq('id',accountId).eq('rank','guest');
    if(updateAccount.error) throw updateAccount.error;

    if(req.data?.[0]){
      const updateRequest=await sb.from('team_join_requests').update({status:'approved'}).eq('id',req.data[0].id);
      if(updateRequest.error) console.warn('Guest request status sync failed:',updateRequest.error);
    }
    await showGuests();
  }

  async function deleteGuest(accountId){
    if(!isStaff() || typeof sb==='undefined') return;
    const account=await sb.from('accounts').select('id,username,rank').eq('id',accountId).eq('rank','guest').maybeSingle();
    if(account.error) throw account.error;
    if(!account.data) throw new Error('اکانت مهمان پیدا نشد یا قبلاً حذف/تأیید شده.');
    if(!confirm(`اکانت مهمان «${account.data.username}» و درخواست‌های مرتبط حذف شوند؟\n\nاین کار قابل برگشت نیست.`)) return;

    const req=await sb.from('team_join_requests').select('id').eq('account_id',accountId);
    if(req.error) throw req.error;
    const requestIds=(req.data||[]).map(r=>r.id);

    if(requestIds.length){
      const messages=await sb.from('team_join_messages').delete().in('request_id',requestIds);
      if(messages.error) throw messages.error;
      const requests=await sb.from('team_join_requests').delete().eq('account_id',accountId);
      if(requests.error) throw requests.error;
    }

    const removed=await sb.from('accounts').delete().eq('id',accountId).eq('rank','guest');
    if(removed.error) throw removed.error;
    await showGuests();
  }

  async function action(accountId,kind,button){
    button.disabled=true;
    try{
      if(kind==='approve') await approveGuest(accountId);
      if(kind==='delete') await deleteGuest(accountId);
    }catch(error){
      console.error(error);
      alert(error?.message || 'عملیات روی اکانت مهمان ناموفق بود.');
      await showGuests();
    }finally{ button.disabled=false; }
  }

  async function showGuests(){
    const container=document.getElementById('membersContainer');
    if(!container || !isStaff() || typeof sb==='undefined') return;
    container.querySelector('.kz-guest-section')?.remove();
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
      const actions=`<div class="guest-actions"><button class="btn primary small kz-guest-approve" type="button" data-account-id="${esc(m.id)}">✓ تأیید اکانت</button><button class="btn danger small kz-guest-delete" type="button" data-account-id="${esc(m.id)}">× حذف اکانت</button></div>`;
      card.innerHTML=`${m.photo?`<img class="avatar" src="${esc(m.photo)}" alt="${esc(m.username)}" loading="lazy" decoding="async">`:`<div class="avatar">${initials(m.username)}</div>`}<h4>${esc(m.username)}</h4><div class="rank-badge"><span class="tier">▲</span> مهمان</div><div class="game-tag">${esc(m.game||'—')}</div><div class="guest-status">وضعیت عضویت: ${esc(statusLabel(m.team_status))}</div>${actions}`;
      grid.appendChild(card);
    });

    grid.querySelectorAll('.kz-guest-approve').forEach(button=>button.addEventListener('click',()=>action(button.dataset.accountId,'approve',button)));
    grid.querySelectorAll('.kz-guest-delete').forEach(button=>button.addEventListener('click',()=>action(button.dataset.accountId,'delete',button)));
  }

  function hideGuests(){ document.body.dataset.kzShowGuests='0'; document.querySelector('.kz-guest-section')?.remove(); }

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
        try{ if(next){document.body.dataset.kzShowGuests='1';await showGuests();}else hideGuests(); }
        finally{button.disabled=false;renderButton();}
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
