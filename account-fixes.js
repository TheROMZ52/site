// KillZone account fixes — session, profile editing, account deletion and registration defaults.
(function(){
  'use strict';

  const FIX_SESSION_KEY = 'kz_session';
  let profileOverlay = null;
  let profileBusy = false;

  function esc(v){ return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function status(msg, ok){ const el = document.getElementById('kzProfileMsg'); if(el) el.innerHTML = `<div class="form-msg ${ok ? 'ok' : 'err'}">${esc(msg)}</div>`; }
  function ensureStyles(){
    if(document.getElementById('kzAccountFixStyles')) return;
    const s=document.createElement('style'); s.id='kzAccountFixStyles';
    s.textContent=`.kz-profile-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.kz-profile-danger{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.kz-danger{border:1px solid #9b3d2c!important;color:#ffb3a5!important;background:transparent}.kz-danger:hover{background:#7d2d20!important;color:#fff!important}.kz-profile-modal{max-width:620px!important}.kz-profile-warning{padding:12px 14px;border:1px solid #9b3d2c;background:rgba(155,61,44,.12);line-height:1.8;margin-top:12px}.kz-staff-nav{position:relative}.kz-staff-nav::after{content:'STAFF';margin-right:6px;font-size:9px;opacity:.55;font-family:monospace}`;
    document.head.appendChild(s);
  }
  function removeProfileOverlay(){ if(profileOverlay){ profileOverlay.remove(); profileOverlay=null; } }
  function openProfile(){ location.href='account.html'; }
  async function saveProfile(){
    if(profileBusy || !window.currentUser || window.currentUser.team_status!=='approved') return;
    profileBusy=true;
    const btn=document.getElementById('kzProfileSave'); if(btn) btn.disabled=true;
    try{
      const updates={ game:(document.getElementById('kzProfileGame')?.value||'').trim() };
      const file=document.getElementById('kzProfilePhoto')?.files?.[0];
      if(file && typeof uploadPhoto==='function'){ const url=await uploadPhoto(file,()=>{}); if(url) updates.photo=url; }
      const newPass=document.getElementById('kzProfilePass')?.value||''; if(newPass) updates.pass_hash=await hashPass(newPass);
      const {data,error}=await sb.from('accounts').update(updates).eq('id',window.currentUser.id).select('*').maybeSingle();
      if(error) throw error; if(!data) throw new Error('اکانت پیدا نشد یا اجازه ویرایش نداری.');
      window.currentUser=data; saveSession(data); status('تغییرات با موفقیت ذخیره شد ✔',true); if(typeof renderUserBox==='function') renderUserBox(); setTimeout(removeProfileOverlay,700);
    }catch(e){ console.error(e); status(e.message||'ذخیره تغییرات ناموفق بود.',false); } finally{ profileBusy=false; if(btn) btn.disabled=false; }
  }
  async function deleteOwnAccount(){
    if(!window.currentUser || profileBusy) return;
    const u=window.currentUser;
    const confirmation=prompt(`برای حذف دائمی اکانت «${u.username}»، نام‌کاربری را دقیقاً وارد کن:`); if(confirmation!==u.username) return;
    if(!confirm('مطمئنی؟ این عملیات قابل برگشت نیست.')) return; profileBusy=true;
    try{
      const m=await sb.from('team_join_messages').delete().eq('account_id',u.id); if(m.error)throw m.error;
      const r=await sb.from('team_join_requests').delete().eq('account_id',u.id); if(r.error)throw r.error;
      const {error}=await sb.from('accounts').delete().eq('id',u.id); if(error)throw error;
      localStorage.removeItem(FIX_SESSION_KEY); window.currentUser=null; removeProfileOverlay(); if(typeof renderUserBox==='function')renderUserBox(); location.href='index.html';
    }catch(e){console.error(e);alert('حذف اکانت انجام نشد. اگر خطای RLS دیدی، سیاست‌های Supabase باید اصلاح شوند.');}finally{profileBusy=false;}
  }
  function addProfileButton(){
    const box=document.getElementById('userBox'); if(!box || !window.currentUser || box.querySelector('#kzProfileBtn')) return;
    const logout=box.querySelector('#logoutBtn');
    const a=document.createElement('a'); a.id='kzProfileBtn'; a.className='link-btn'; a.textContent='⚙️ اکانت'; a.href='account.html';
    if(logout) box.insertBefore(a,logout); else box.appendChild(a);
  }
  function patchUserBox(){
    if(typeof window.renderUserBox!=='function' || window.renderUserBox.__kzAccountFix) return;
    const original=window.renderUserBox;
    const wrapped=function(){ original(); addProfileButton(); updateRubikaAccess(); };
    wrapped.__kzAccountFix=true; window.renderUserBox=wrapped;
  }
  function patchRegistration(){
    if(typeof window.registerUser!=='function' || window.registerUser.__kzAccountFix) return;
    const original=window.registerUser;
    const wrapped=async function(username,password,game,photo){
      const res=await original(username,password,game,photo);
      if(res?.ok && res.account?.id){ const {data,error}=await sb.from('accounts').update({rank:'guest',team_status:'none'}).eq('id',res.account.id).select('*').maybeSingle(); if(!error&&data)res.account=data; }
      return res;
    };
    wrapped.__kzAccountFix=true; window.registerUser=wrapped;
  }
  function addStaffRequestsMenu(){
    const nav=document.querySelector('nav.main'); if(!nav)return;
    const old=nav.querySelector('.kz-staff-nav'); const allowed=!!(window.currentUser&&['developer','co_owner','owner'].includes(window.currentUser.rank));
    if(!allowed){if(old)old.remove();return;} if(old)return;
    const a=document.createElement('a'); a.className='kz-staff-nav'; a.href='join.html#requests'; a.textContent='درخواست‌های عضویت';
    const reg=nav.querySelector('a[href="register.html"]'); if(reg)nav.insertBefore(a,reg);else nav.appendChild(a);
  }
  async function syncSessionThenFixUI(){
    patchUserBox(); patchRegistration(); if(typeof window.initSession==='function')await window.initSession(); if(typeof window.renderUserBox==='function')window.renderUserBox(); addStaffRequestsMenu();
    if(location.pathname.endsWith('/join.html')||location.pathname.endsWith('join.html')){ if(typeof window.kzRenderJoinPage==='function')window.kzRenderJoinPage(); else if(typeof window.renderJoinPage==='function')window.renderJoinPage(); else if(typeof window.kzRenderJoinApp==='function')window.kzRenderJoinApp(); else window.dispatchEvent(new CustomEvent('kz:session-ready')); }
  }
  function updateRubikaAccess(){
    const allowed=!!(window.currentUser&&window.currentUser.team_status==='approved');
    document.querySelectorAll('.rubika-link').forEach(link=>{ link.style.display=allowed?'':'none'; link.setAttribute('aria-hidden',allowed?'false':'true'); if(!allowed){link.removeAttribute('href');link.setAttribute('title','فقط اعضای تأییدشده تیم دسترسی دارند');link.onclick=e=>e.preventDefault();}else link.href='https://rubika.ir/joing/BBEDHCIEG0CUGHJUEJWPLKHRDAWOCCSB'; });
  }
  function removeTextLimits(){ document.querySelectorAll('input, textarea').forEach(el=>{if(el.type==='number'||el.type==='file'||el.type==='checkbox'||el.type==='radio')return;el.removeAttribute('maxlength');el.removeAttribute('minlength');}); }
  function boot(){ ensureStyles(); patchUserBox(); patchRegistration(); setTimeout(async()=>{await syncSessionThenFixUI();updateRubikaAccess();removeTextLimits();const observer=new MutationObserver(()=>{updateRubikaAccess();removeTextLimits();addStaffRequestsMenu();});observer.observe(document.body,{childList:true,subtree:true});},0); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.kzOpenProfile=openProfile; window.kzAddStaffRequestsMenu=addStaffRequestsMenu;
})();
