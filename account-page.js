// KillZone account page — profile, membership status and account controls.
(function(){
  'use strict';
  const REVIEWERS=['developer','co_owner','owner'];
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const rank=()=>typeof rankLabel==='function'?rankLabel(window.currentUser?.rank):window.currentUser?.rank||'—';
  const statusMap={none:['بدون درخواست','neutral'],reviewing:['در حال بررسی','info'],approved:['عضو تأییدشده','ok'],rejected:['درخواست رد شده','danger'],pending:['در انتظار بررسی','info'],waiting_applicant:['منتظر پاسخ شما','warn']};
  let busy=false;

  function showMsg(text,ok=false){
    const el=document.getElementById('kzAccountMsg'); if(el) el.innerHTML=`<div class="account-msg ${ok?'ok':'err'}">${esc(text)}</div>`;
  }
  function statusInfo(value){ return statusMap[value]||[value||'نامشخص','neutral']; }
  function avatar(u){
    return u.photo ? `<img src="${esc(u.photo)}" alt="${esc(u.username)}" onerror="this.outerHTML='<div class=account-avatar-fallback>${esc((u.username||'?').slice(0,2).toUpperCase())}</div>'">` : `<div class="account-avatar-fallback">${esc((u.username||'?').slice(0,2).toUpperCase())}</div>`;
  }
  function render(u,request){
    const root=document.getElementById('kzAccountApp'); if(!root)return;
    const [statusLabel,statusTone]=statusInfo(u.team_status||'none');
    const staff=REVIEWERS.includes(u.rank);
    root.innerHTML=`
      <section class="account-card account-profile-card">
        <div class="account-card-head"><span class="mini-label">IDENTITY</span><span class="account-status ${statusTone}">${esc(statusLabel)}</span></div>
        <div class="profile-main">${avatar(u)}<div class="profile-name"><h2>${esc(u.username)}</h2><div class="rank-line"><span>${esc(rank())}</span><i>${typeof rankChevrons==='function'?rankChevrons(u.rank):'▲'}</i></div></div></div>
        <div class="profile-meta"><div><small>نام کاربری</small><strong>${esc(u.username)}</strong></div><div><small>بازی مورد علاقه</small><strong>${esc(u.game||'هنوز انتخاب نشده')}</strong></div><div><small>وضعیت تیم</small><strong>${esc(statusLabel)}</strong></div></div>
      </section>

      <section class="account-card account-edit-card">
        <div class="account-card-head"><div><span class="mini-label">PROFILE / EDIT</span><h2>ویرایش اطلاعات</h2></div><span class="card-mark">✦</span></div>
        <form id="kzAccountForm" class="account-form">
          <div class="account-field"><label for="kzAccountUsername">نام کاربری</label><input id="kzAccountUsername" value="${esc(u.username)}" disabled><small>نام کاربری قابل تغییر نیست.</small></div>
          <div class="account-field"><label for="kzAccountGame">بازی‌های مورد علاقه</label><input id="kzAccountGame" value="${esc(u.game||'')}" placeholder="مثلاً Minecraft / COD"></div>
          <div class="account-field full"><label for="kzAccountPhoto">عکس پروفایل</label><input id="kzAccountPhoto" type="file" accept="image/*"><small>JPG / PNG / WEBP — حداکثر ۵MB</small></div>
          <div class="account-field full"><label for="kzAccountPass">رمز عبور جدید <span>اختیاری</span></label><input id="kzAccountPass" type="password" placeholder="اگر نمی‌خوای تغییرش بدی خالی بذار"></div>
          <div class="account-form-actions"><button class="btn primary" id="kzSaveAccount" type="submit">ذخیره تغییرات</button><div id="kzAccountMsg" aria-live="polite"></div></div>
        </form>
      </section>

      <section class="account-card account-membership-card">
        <div class="account-card-head"><div><span class="mini-label">TEAM ACCESS</span><h2>وضعیت عضویت</h2></div><span class="card-mark">◈</span></div>
        ${request ? `<div class="membership-status"><div><span class="status-orb ${statusTone}"></span><strong>${esc(statusLabel)}</strong></div><a class="btn ghost" href="join.html">مشاهده تیکت ←</a></div><p class="membership-copy">آخرین درخواست عضویتت همین‌جاست. برای ادامه گفت‌وگو یا دیدن پاسخ مدیریت وارد تیکت شو.</p>` : `<div class="membership-empty"><strong>هنوز درخواست عضویت ندادی.</strong><p>اگر آماده‌ای، فرم عضویت رو پر کن تا مدیریت KillZone بررسیش کنه.</p><a class="btn primary" href="join.html">درخواست عضویت</a></div>`}
        ${u.team_status==='approved'?`<div class="approved-note">✓ دسترسی گروه روبیکا برای اکانتت فعاله.</div>`:''}
      </section>

      <section class="account-card account-security-card">
        <div class="account-card-head"><div><span class="mini-label">SECURITY</span><h2>امنیت و حساب</h2></div><span class="card-mark">⌁</span></div>
        <div class="security-row"><div><strong>اکانت KillZone</strong><p>جلسه ورود روی همین دستگاه ذخیره شده.</p></div><button class="btn ghost" id="kzLogoutAccount">خروج از اکانت</button></div>
        <div class="danger-zone"><div><strong>حذف دائمی اکانت</strong><p>تمام اطلاعات اکانت و درخواست‌های عضویت حذف می‌شن و این کار قابل برگشت نیست.</p></div><button class="btn kz-danger" id="kzDeleteAccountPage">حذف اکانت</button></div>
      </section>
    `;
    document.getElementById('kzAccountForm').addEventListener('submit',save);
    document.getElementById('kzLogoutAccount').onclick=logout;
    document.getElementById('kzDeleteAccountPage').onclick=deleteAccount;
  }

  async function load(){
    if(typeof initSession==='function') await initSession();
    const u=window.currentUser;
    if(!u){ location.href='index.html'; return; }
    const {data:requests}=await sb.from('team_join_requests').select('id,status,created_at').eq('account_id',u.id).order('created_at',{ascending:false}).limit(1);
    render(u,requests?.[0]||null);
  }
  async function save(e){
    e.preventDefault(); if(busy||!window.currentUser)return; busy=true;
    const btn=document.getElementById('kzSaveAccount'); if(btn)btn.disabled=true;
    try{
      const updates={game:(document.getElementById('kzAccountGame')?.value||'').trim()};
      const file=document.getElementById('kzAccountPhoto')?.files?.[0];
      if(file){ const url=await uploadPhoto(file,(kind,text)=>showMsg(text,kind==='ok')); if(url)updates.photo=url; else if(file)throw new Error('آپلود عکس ناموفق بود.'); }
      const pass=document.getElementById('kzAccountPass')?.value||'';
      if(pass)updates.pass_hash=await hashPass(pass);
      const {data,error}=await sb.from('accounts').update(updates).eq('id',window.currentUser.id).select('*').maybeSingle();
      if(error)throw error; if(!data)throw new Error('اکانت پیدا نشد یا اجازه ویرایش نداری.');
      window.currentUser=data; saveSession(data); showMsg('تغییرات با موفقیت ذخیره شد.',true); setTimeout(()=>render(data,null),650);
    }catch(err){console.error(err);showMsg(err.message||'ذخیره تغییرات ناموفق بود.');}
    finally{busy=false;if(btn)btn.disabled=false;}
  }
  function logout(){
    if(typeof clearSession==='function')clearSession(); window.currentUser=null; location.href='index.html';
  }
  async function deleteAccount(){
    if(busy||!window.currentUser)return;
    const u=window.currentUser;
    const ok=window.confirm(`اکانت «${u.username}» و درخواست‌های عضویت حذف بشه؟ این کار قابل برگشت نیست.`);
    if(!ok)return; busy=true;
    try{
      const m=await sb.from('team_join_messages').delete().eq('account_id',u.id); if(m.error)throw m.error;
      const r=await sb.from('team_join_requests').delete().eq('account_id',u.id); if(r.error)throw r.error;
      const a=await sb.from('accounts').delete().eq('id',u.id); if(a.error)throw a.error;
      if(typeof clearSession==='function')clearSession(); window.currentUser=null; location.href='index.html';
    }catch(err){console.error(err);showMsg(err.message||'حذف اکانت انجام نشد.');}
    finally{busy=false;}
  }
  function boot(){load();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
