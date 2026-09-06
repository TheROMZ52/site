// KillZone runtime hardening + small cross-page bug fixes.
(function(){
  'use strict';

  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp']);
  const USERNAME_RE = /^[A-Za-z0-9_\-\.]+$/;

  function patchUnsafeSeed(){
    // Never create a known-password owner/developer account from a public browser.
    if(typeof window.ensureSeedAccounts !== 'function' || window.ensureSeedAccounts.__kzSafeSeed) return;
    const safe = async function(){ return; };
    safe.__kzSafeSeed = true;
    window.ensureSeedAccounts = safe;
  }

  function patchUploadPhoto(){
    if(typeof window.uploadPhoto !== 'function' || window.uploadPhoto.__kzImageFix) return;
    const original = window.uploadPhoto;
    const wrapped = async function(file, onStatus){
      if(file && !ALLOWED_IMAGE_TYPES.has(file.type)){
        if(typeof onStatus === 'function') onStatus('err', 'فقط JPG، PNG یا WEBP مجازه.');
        return null;
      }
      if(file && file.size > 5 * 1024 * 1024){
        if(typeof onStatus === 'function') onStatus('err', 'حجم عکس باید کمتر از ۵ مگابایت باشه.');
        return null;
      }
      return original(file, onStatus);
    };
    wrapped.__kzImageFix = true;
    window.uploadPhoto = wrapped;
  }

  function patchRegistration(){
    if(typeof window.registerUser !== 'function' || window.registerUser.__kzRuntimeFix) return;
    const original = window.registerUser;
    const wrapped = async function(username, password, game, photo){
      const name = String(username || '').trim();
      const pass = String(password || '');
      if(name.length < 3 || name.length > 32 || !USERNAME_RE.test(name)){
        return {ok:false, msg:'نام‌کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد، _، - یا . باشه.'};
      }
      if(pass.length < 6){
        return {ok:false, msg:'رمز عبور باید حداقل ۶ کاراکتر باشه.'};
      }
      return original(name, pass, game, photo);
    };
    wrapped.__kzRuntimeFix = true;
    window.registerUser = wrapped;
  }

  function patchLoginUX(){
    const overlay = document.getElementById('loginOverlay');
    if(!overlay || overlay.dataset.kzRuntimeReady==='1') return;
    overlay.dataset.kzRuntimeReady='1';
    const close = ()=>overlay.classList.remove('show');
    const submit = document.getElementById('loginSubmit');
    const formInputs = [document.getElementById('loginUser'), document.getElementById('loginPass')].filter(Boolean);
    formInputs.forEach(input=>input.addEventListener('keydown', e=>{
      if(e.key==='Enter' && submit){ e.preventDefault(); submit.click(); }
    }));
    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && overlay.classList.contains('show')) close(); });
  }

  function patchMembersFilter(){
    if(!document.getElementById('membersContainer')) return;
    if(typeof window.fetchAccounts !== 'function' || window.fetchAccounts.__kzApprovedOnly) return;
    const original = window.fetchAccounts;
    const wrapped = async function(){
      const rows = await original();
      return (rows || []).filter(a => a.team_status == null || a.team_status === 'approved');
    };
    wrapped.__kzApprovedOnly = true;
    window.fetchAccounts = wrapped;
  }

  async function syncApplicantStatusFromTicket(){
    if(!document.getElementById('kzJoinApp') || !window.currentUser || typeof sb === 'undefined') return;
    try{
      const {data,error}=await sb.from('team_join_requests')
        .select('status,created_at')
        .eq('account_id',window.currentUser.id)
        .order('created_at',{ascending:false})
        .limit(1);
      if(error || !data?.[0]) return;
      const status=data[0].status;
      if(['pending','reviewing','waiting_applicant','approved','rejected'].includes(status)){
        window.currentUser.team_status = status;
        if(typeof renderUserBox==='function') renderUserBox();
        if(typeof updateRubikaAccess==='function') updateRubikaAccess();
      }
    }catch(e){ console.warn('KillZone ticket status sync failed', e); }
  }

  function boot(){
    patchUnsafeSeed();
    patchUploadPhoto();
    patchRegistration();
    patchLoginUX();
    patchMembersFilter();
    setTimeout(syncApplicantStatusFromTicket, 250);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
