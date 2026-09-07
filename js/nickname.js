// KillZone nickname feature.
// Login identity stays `username`; `nickname` is display-only for the Members page.
(function(){
  'use strict';

  const MAX_NICKNAME_LENGTH = 32;

  function esc(value){
    return typeof window.escapeHtml === 'function'
      ? window.escapeHtml(value)
      : String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function displayName(account){
    const nickname = String(account?.nickname ?? '').trim();
    return nickname || String(account?.username ?? '').trim() || '—';
  }

  // Keep the existing member-card layout/behavior; only swap the visible name.
  function patchMemberCards(){
    if(typeof window.buildMemberCard !== 'function' || window.buildMemberCard.__kzNickname) return;
    const original = window.buildMemberCard;
    const wrapped = function(account, staff, accountsCache){
      const card = original(account, staff, accountsCache);
      const heading = card?.querySelector('h4');
      if(heading) heading.textContent = displayName(account);
      const avatar = card?.querySelector('.avatar');
      if(avatar && avatar.tagName === 'IMG') avatar.alt = displayName(account);
      return card;
    };
    wrapped.__kzNickname = true;
    window.buildMemberCard = wrapped;
  }

  function addNicknameField(){
    const form = document.getElementById('kzAccountForm');
    if(!form || document.getElementById('kzAccountNickname')) return;
    const gameField = document.getElementById('kzAccountGame')?.closest('.account-field');
    if(!gameField) return;

    const field = document.createElement('div');
    field.className = 'account-field';
    field.innerHTML = `<label for="kzAccountNickname">نیک‌نیم</label><input id="kzAccountNickname" value="${esc(window.currentUser?.nickname || '')}" maxlength="${MAX_NICKNAME_LENGTH}" placeholder="مثلاً ShadowWolf"><small>این اسم فقط برای نمایش در بخش اعضا استفاده می‌شه؛ ورود همچنان با نام‌کاربری انجام می‌شه.</small>`;
    gameField.parentNode.insertBefore(field, gameField);
  }

  async function saveNicknameCapture(event){
    const form = event.target;
    if(form?.id !== 'kzAccountForm') return;
    // Capture phase prevents account.js's older submit handler from issuing a second update.
    event.preventDefault();
    event.stopImmediatePropagation();

    const user = window.currentUser;
    if(!user || user.team_status !== 'approved' || typeof window.sb === 'undefined') return;

    const input = document.getElementById('kzAccountNickname');
    const nickname = String(input?.value || '').trim();
    const msg = document.getElementById('kzAccountMsg');
    const button = document.getElementById('kzSaveAccount');

    if(nickname.length > MAX_NICKNAME_LENGTH){
      if(msg) msg.innerHTML = '<div class="account-msg err">نیک‌نیم باید حداکثر ۳۲ کاراکتر باشه.</div>';
      return;
    }

    if(button) button.disabled = true;
    try{
      const { data, error } = await window.sb
        .from('accounts')
        .update({ nickname })
        .eq('id', user.id)
        .select('*')
        .maybeSingle();
      if(error) throw error;
      if(!data) throw new Error('اکانت پیدا نشد یا اجازه ویرایش نداری.');

      window.currentUser = data;
      if(typeof window.saveSession === 'function') window.saveSession(data);
      if(msg) msg.innerHTML = '<div class="account-msg ok">نیک‌نیم با موفقیت ذخیره شد ✔</div>';

      const title = document.querySelector('.profile-name h2');
      if(title) title.textContent = displayName(data);
    }catch(error){
      console.error('KillZone nickname save failed', error);
      if(msg) msg.innerHTML = `<div class="account-msg err">${esc(error.message || 'ذخیره نیک‌نیم ناموفق بود.')}</div>`;
    }finally{
      if(button) button.disabled = false;
    }
  }

  patchMemberCards();

  if(document.getElementById('kzAccountApp')){
    const observer = new MutationObserver(addNicknameField);
    observer.observe(document.getElementById('kzAccountApp'), {childList:true, subtree:true});
    addNicknameField();
    document.addEventListener('submit', saveNicknameCapture, true);
  }

  window.kzDisplayName = displayName;
})();
