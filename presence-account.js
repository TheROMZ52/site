// KillZone account presence controls.
(function(){
  'use strict';
  const statuses=[['playing','🎮 در حال بازی'],['competitive','🏆 در حال رقابت'],['ready','🟢 آماده برای بازی'],['busy','🔴 مشغول'],['away','💤 AFK']];
  let injected=false;
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  async function inject(){
    if(injected || !window.kzPresence || !window.currentUser) return;
    const root=document.getElementById('kzAccountApp'); if(!root) return;
    if(!root.querySelector('.account-profile-card')) return setTimeout(inject,250);
    if(window.currentUser.team_status!=='approved'){injected=true;return;}
    injected=true;
    const u=window.currentUser;
    const {data}=await sb.from('member_presence').select('*').eq('account_id',u.id).maybeSingle();
    const row=data||{status:'ready',game:u.game||'',status_text:''};
    const card=document.createElement('section');
    card.className='account-card kz-presence-card';
    card.innerHTML=`<div class="account-card-head"><div><span class="mini-label">SQUAD PRESENCE</span><h2>وضعیت من</h2></div><span class="card-mark">●</span></div>
      <form id="kzPresenceForm" class="account-form">
        <div class="account-field"><label for="kzPresenceStatus">وضعیت</label><select id="kzPresenceStatus">${statuses.map(([v,l])=>`<option value="${v}" ${row.status===v?'selected':''}>${l}</option>`).join('')}</select></div>
        <div class="account-field"><label for="kzPresenceGame">الان مشغول چه بازی‌ای؟</label><input id="kzPresenceGame" maxlength="60" value="${esc(row.game||'')}" placeholder="مثلاً Minecraft"></div>
        <div class="account-field full"><label for="kzPresenceText">متن وضعیت <span>اختیاری</span></label><input id="kzPresenceText" maxlength="100" value="${esc(row.status_text||'')}" placeholder="مثلاً منتظر هم‌تیمی‌هام"></div>
        <div class="account-form-actions"><button class="btn primary" type="submit">ذخیره وضعیت</button><div id="kzPresenceMsg" aria-live="polite"></div></div>
      </form>`;
    root.appendChild(card);
    card.querySelector('#kzPresenceForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const msg=card.querySelector('#kzPresenceMsg');
      const result=await window.kzPresence.setStatus(card.querySelector('#kzPresenceStatus').value,card.querySelector('#kzPresenceGame').value,card.querySelector('#kzPresenceText').value);
      msg.innerHTML=`<div class="account-msg ${result.ok?'ok':'err'}">${esc(result.ok?'وضعیت ذخیره شد.':result.msg)}</div>`;
    });
  }

  function boot(){setTimeout(inject,350);setInterval(()=>{if(!injected)inject();},1000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
