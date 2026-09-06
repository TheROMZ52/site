// KillZone account fixes — session, profile editing, account deletion and registration defaults.
(function(){
  'use strict';

  const FIX_SESSION_KEY = 'kz_session';
  let profileOverlay = null;
  let profileBusy = false;

  function esc(v){ return typeof escapeHtml === 'function' ? escapeHtml(v) : String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
  function status(msg, ok){
    const el = document.getElementById('kzProfileMsg');
    if(el) el.innerHTML = `<div class="form-msg ${ok ? 'ok' : 'err'}">${esc(msg)}</div>`;
  }

  function ensureStyles(){
    if(document.getElementById('kzAccountFixStyles')) return;
    const s=document.createElement('style'); s.id='kzAccountFixStyles';
    s.textContent=`
      .kz-profile-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .kz-profile-danger{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}
      .kz-danger{border:1px solid #9b3d2c!important;color:#ffb3a5!important;background:transparent}
      .kz-danger:hover{background:#7d2d20!important;color:#fff!important}
      .kz-profile-modal{max-width:620px!important}
      .kz-profile-warning{padding:12px 14px;border:1px solid #9b3d2c;background:rgba(155,61,44,.12);line-height:1.8;margin-top:12px}
    `;
    document.head.appendChild(s);
  }

  function removeProfileOverlay(){ if(profileOverlay){ profileOverlay.remove(); profileOverlay=null; } }

  function openProfile(){
    if(!window.currentUser){ return; }
    ensureStyles(); removeProfileOverlay();
    const u=window.currentUser;
    profileOverlay=document.createElement('div');
    profileOverlay.className='overlay show';
    profileOverlay.id='kzProfileOverlay';
    profileOverlay.innerHTML=`
      <div class="modal kz-profile-modal">
        <button class="close" id="kzProfileClose">✕</button>
        <h3>تنظیمات اکانت</h3>
        <div class="form-grid">
          <div class="field"><label>نام‌کاربری</label><input value="${esc(u.username)}" disabled></div>
          <div class="field"><label>رنک</label><input value="${esc(typeof rankLabel==='function'?rankLabel(u.rank):u.rank)}" disabled></div>
          <div class="field"><label>بازی‌های مورد علاقه</label><input id="kzProfileGame" maxlength="200" value="${esc(u.game||'')}"></div>
          <div class="field"><label>عکس پروفایل جدید</label><input id="kzProfilePhoto" type="file" accept="image/*"></div>
          <div class="field"><label>رمز عبور جدید (اختیاری)</label><input id="kzProfilePass" type="password" minlength="4" maxlength="60" placeholder="اگر نمی‌خوای عوضش کنی خالی بذار"></div>
          <button class="btn primary" id="kzProfileSave">ذخیره تغییرات</button>
          <div id="kzProfileMsg"></div>
        </div>
        <div class="kz-profile-danger">
          <strong>حذف اکانت</strong>
          <p>این کار دائمیه و اطلاعات اکانت و درخواست‌های عضویتت حذف می‌شن.</p>
          <button class="btn kz-danger" id="kzDeleteAccount">حذف دائمی اکانت</button>
        </div>
      </div>`;
    document.body.appendChild(profileOverlay);
    document.getElementById('kzProfileClose').onclick=removeProfileOverlay;
    profileOverlay.addEventListener('click',e=>{ if(e.target===profileOverlay) removeProfileOverlay(); });
    document.getElementById('kzProfileSave').onclick=saveProfile;
    document.getElementById('kzDeleteAccount').onclick=deleteOwnAccount;
  }

  async function saveProfile(){
    if(profileBusy || !window.currentUser) return;
    profileBusy=true;
    const btn=document.getElementById('kzProfileSave'); if(btn) btn.disabled=true;
    try{
      const updates={ game:(document.getElementById('kzProfileGame')?.value||'').trim() };
      const file=document.getElementById('kzProfilePhoto')?.files?.[0];
      if(file && typeof uploadPhoto==='function'){
        const url=await uploadPhoto(file,()=>{});
        if(url) updates.photo=url;
      }
      const newPass=document.getElementById('kzProfilePass')?.value||'';
      if(newPass){
        if(newPass.length<4) throw new Error('رمز جدید باید حداقل ۴ کاراکتر باشه.');
        updates.pass_hash=await hashPass(newPass);
      }
      const {data,error}=await sb.from('accounts').update(updates).eq('id',window.currentUser.id).select('*').maybeSingle();
      if(error) throw error;
      if(!data) throw new Error('اکانت پیدا نشد یا اجازه ویرایش نداری.');
      window.currentUser=data;
      saveSession(data);
      status('تغییرات با موفقیت ذخیره شد ✔',true);
      if(typeof renderUserBox==='function') renderUserBox();
      setTimeout(removeProfileOverlay,700);
    }catch(e){ console.error(e); status(e.message||'ذخیره تغییرات ناموفق بود.',false); }
    finally{ profileBusy=false; if(btn) btn.disabled=false; }
  }

  async function deleteOwnAccount(){
    if(!window.currentUser || profileBusy) return;
    const u=window.currentUser;
    const confirmation=prompt(`برای حذف دائمی اکانت «${u.username}»، نام‌کاربری را دقیقاً وارد کن:`);
    if(confirmation!==u.username) return;
    if(!confirm('مطمئنی؟ این عملیات قابل برگشت نیست.')) return;
    profileBusy=true;
    try{
      await sb.from('team_join_messages').delete().eq('account_id',u.id);
      await sb.from('team_join_requests').delete().eq('account_id',u.id);
      const {error}=await sb.from('accounts').delete().eq('id',u.id);
      if(error) throw error;
      localStorage.removeItem(FIX_SESSION_KEY);
      window.currentUser=null;
      removeProfileOverlay();
      if(typeof renderUserBox==='function') renderUserBox();
      alert('اکانتت با موفقیت حذف شد.');
      location.href='index.html';
    }catch(e){ console.error(e); alert('حذف اکانت انجام نشد. اگر خطای RLS دیدی، سیاست‌های Supabase باید اصلاح شوند.'); }
    finally{ profileBusy=false; }
  }

  function addProfileButton(){
    const box=document.getElementById('userBox');
    if(!box || !window.currentUser) return;
    if(box.querySelector('#kzProfileBtn')) return;
    const logout=box.querySelector('#logoutBtn');
    const b=document.createElement('button'); b.id='kzProfileBtn'; b.className='link-btn'; b.textContent='⚙️ اکانت'; b.onclick=openProfile;
    if(logout) box.insertBefore(b,logout); else box.appendChild(b);
  }

  function patchUserBox(){
    if(typeof window.renderUserBox!=='function' || window.renderUserBox.__kzAccountFix) return;
    const original=window.renderUserBox;
    const wrapped=function(){ original(); addProfileButton(); };
    wrapped.__kzAccountFix=true;
    window.renderUserBox=wrapped;
  }

  // New accounts are regular site accounts, not "new_member" team ranks.
  // Team membership remains controlled separately through team_status.
  function patchRegistration(){
    if(typeof window.registerUser!=='function' || window.registerUser.__kzAccountFix) return;
    const original=window.registerUser;
    const wrapped=async function(username,password,game,photo){
      const res=await original(username,password,game,photo);
      if(res?.ok && res.account?.id){
        const {data,error}=await sb.from('accounts').update({rank:'member',team_status:'none'}).eq('id',res.account.id).select('*').maybeSingle();
        if(!error && data){ res.account=data; }
      }
      return res;
    };
    wrapped.__kzAccountFix=true;
    window.registerUser=wrapped;
  }

  async function syncSessionThenFixUI(){
    patchUserBox(); patchRegistration();
    if(typeof window.initSession==='function') await window.initSession();
    if(typeof window.renderUserBox==='function') window.renderUserBox();
    if(location.pathname.endsWith('/join.html') || location.pathname.endsWith('join.html')){
      if(typeof window.kzRenderJoinPage==='function') window.kzRenderJoinPage();
      else if(typeof window.renderJoinPage==='function') window.renderJoinPage();
      else if(typeof window.kzRenderJoinApp==='function') window.kzRenderJoinApp();
      else window.dispatchEvent(new CustomEvent('kz:session-ready'));
    }
  }

  // Guests may not access the team Rubika group. Registered-but-unapproved users are guests too.
  function updateRubikaAccess(){
    const allowed=!!(window.currentUser && window.currentUser.team_status==='approved');
    document.querySelectorAll('.rubika-link').forEach(link=>{
      link.style.display=allowed?'':'none';
      link.setAttribute('aria-hidden', allowed?'false':'true');
      if(!allowed){
        link.removeAttribute('href');
        link.setAttribute('title','فقط اعضای تأییدشده تیم دسترسی دارند');
        link.onclick=e=>e.preventDefault();
      }else{
        link.href='https://rubika.ir/joing/BBEDHCIEG0CUGHJUEJWPLKHRDAWOCCSB';
      }
    });
  }

  // Remove HTML character-count limits from text fields across all KillZone forms.
  function removeTextLimits(){
    document.querySelectorAll('input, textarea').forEach(el=>{
      if(el.type==='number' || el.type==='file' || el.type==='checkbox' || el.type==='radio') return;
      el.removeAttribute('maxlength');
      el.removeAttribute('minlength');
    });
  }

  function boot(){
    ensureStyles();
    patchUserBox(); patchRegistration();
    setTimeout(async ()=>{
      await syncSessionThenFixUI();
      updateRubikaAccess();
      removeTextLimits();
      // Keep access state correct if the user logs in/out or another script rerenders the header.
      const observer=new MutationObserver(()=>{ updateRubikaAccess(); removeTextLimits(); });
      observer.observe(document.body,{childList:true,subtree:true});
    },0);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
  window.kzOpenProfile=openProfile;
})();