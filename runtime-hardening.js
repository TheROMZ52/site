// KillZone runtime hardening + small cross-page bug fixes.
(function(){
  'use strict';

  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp']);
  const USERNAME_RE = /^[A-Za-z0-9_\-\.]+$/;
  const TICKET_LABELS = {
    pending: 'در انتظار بررسی',
    reviewing: 'در حال بررسی',
    waiting_applicant: 'منتظر پاسخ شما',
    approved: 'عضو تأییدشده',
    rejected: 'درخواست رد شده'
  };

  function injectButtonStyles(){
    if(document.getElementById('kz-button-system')) return;
    const link=document.createElement('link');
    link.id='kz-button-system';
    link.rel='stylesheet';
    link.href='/buttons.css?v=2';
    document.head.appendChild(link);
  }

  function injectTwemoji(){
    if(document.getElementById('kz-twemoji-api')) return;
    const style=document.createElement('style');
    style.id='kz-twemoji-style';
    style.textContent='.kz-twemoji, img.emoji{display:inline-block;width:1em;height:1em;margin:0 .05em 0 .1em;vertical-align:-0.1em;line-height:1;object-fit:contain;}';
    document.head.appendChild(style);

    const script=document.createElement('script');
    script.id='kz-twemoji-api';
    script.src='https://cdn.jsdelivr.net/npm/@twemoji/api@17.0.3/dist/twemoji.min.js';
    script.integrity='sha384-Y5xukbGJwykbHHkTbLJykYLcBPFxrwipTbEh0puxhkz9CZ90raTPGe2Ks4vCxsYU';
    script.crossOrigin='anonymous';
    script.onload=()=>startTwemoji();
    script.onerror=()=>console.warn('KillZone Twemoji failed to load');
    document.head.appendChild(script);
  }

  function startTwemoji(){
    if(!window.twemoji || typeof window.twemoji.parse!=='function') return;
    const options={
      folder:'svg',
      ext:'.svg',
      base:'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/',
      className:'kz-twemoji'
    };

    const parseNode=node=>{
      if(!node) return;
      try{
        if(node.nodeType===Node.ELEMENT_NODE) window.twemoji.parse(node,options);
        else if(node.nodeType===Node.TEXT_NODE && node.parentElement) window.twemoji.parse(node.parentElement,options);
      }catch(e){ console.warn('KillZone Twemoji parse skipped',e); }
    };

    try{ window.twemoji.parse(document.body,options); }catch(e){ console.warn('KillZone Twemoji initial parse skipped',e); }

    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType===Node.TEXT_NODE || node.nodeType===Node.ELEMENT_NODE) parseNode(node);
        }
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    window.kzTwemojiReady=true;
  }

  function patchUnsafeSeed(){
    if(typeof window.ensureSeedAccounts !== 'function' || window.ensureSeedAccounts.__kzSafeSeed) return;
    const safe = async function(){ return; };
    safe.__kzSafeSeed = true;
    window.ensureSeedAccounts = safe;
  }
  function patchUploadPhoto(){
    if(typeof window.uploadPhoto !== 'function' || window.uploadPhoto.__kzImageFix) return;
    const original = window.uploadPhoto;
    const wrapped = async function(file, onStatus){
      if(file && !ALLOWED_IMAGE_TYPES.has(file.type)){ if(typeof onStatus === 'function') onStatus('err', 'فقط JPG، PNG یا WEBP مجازه.'); return null; }
      if(file && file.size > 5 * 1024 * 1024){ if(typeof onStatus === 'function') onStatus('err', 'حجم عکس باید کمتر از ۵ مگابایت باشه.'); return null; }
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
      if(name.length < 3 || name.length > 32 || !USERNAME_RE.test(name)) return {ok:false, msg:'نام‌کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد، _، - یا . باشه.'};
      if(pass.length < 6) return {ok:false, msg:'رمز عبور باید حداقل ۶ کاراکتر باشه.'};
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
    formInputs.forEach(input=>input.addEventListener('keydown', e=>{ if(e.key==='Enter' && submit){ e.preventDefault(); submit.click(); }}));
    overlay.addEventListener('click', e=>{ if(e.target===overlay) close(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && overlay.classList.contains('show')) close(); });
  }
  function patchMembersFilter(){
    if(!document.getElementById('membersContainer')) return;
    if(typeof window.fetchAccounts !== 'function' || window.fetchAccounts.__kzApprovedOnly) return;
    const original = window.fetchAccounts;
    const wrapped = async function(){ const rows = await original(); return (rows || []).filter(a => a.team_status == null || a.team_status === 'approved'); };
    wrapped.__kzApprovedOnly = true;
    window.fetchAccounts = wrapped;
  }
  function syncRenderedAccountStatus(status){
    const label=TICKET_LABELS[status];
    if(!label || !document.getElementById('kzAccountApp')) return;
    document.querySelectorAll('#kzAccountApp .account-status').forEach(el=>{ el.textContent=label; el.classList.remove('neutral','info','ok','danger','warn'); el.classList.add(status==='approved'?'ok':status==='rejected'?'danger':status==='waiting_applicant'?'warn':'info'); });
    const meta=document.querySelectorAll('#kzAccountApp .profile-meta strong'); if(meta[2]) meta[2].textContent=label;
  }
  async function syncApplicantStatusFromTicket(){
    if((!document.getElementById('kzJoinApp') && !document.getElementById('kzAccountApp')) || !window.currentUser || typeof sb === 'undefined') return;
    try{
      const {data,error}=await sb.from('team_join_requests').select('status,created_at').eq('account_id',window.currentUser.id).order('created_at',{ascending:false}).limit(1);
      if(error || !data?.[0]) return;
      const status=data[0].status;
      if(['pending','reviewing','waiting_applicant','approved','rejected'].includes(status)){ window.currentUser.team_status = status; syncRenderedAccountStatus(status); if(typeof renderUserBox==='function') renderUserBox(); }
    }catch(e){ console.warn('KillZone ticket status sync failed', e); }
  }
  function boot(){
    injectButtonStyles();
    injectTwemoji();
    patchUnsafeSeed();
    patchUploadPhoto();
    patchRegistration();
    patchLoginUX();
    patchMembersFilter();
    setTimeout(syncApplicantStatusFromTicket,250);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
