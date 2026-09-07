// KillZone members presence decorations.
(function(){
  'use strict';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const ageText=ms=>{const m=Math.max(1,Math.floor(ms/60000));return m<60?`آخرین فعالیت: ${m} دقیقه پیش`:`آخرین فعالیت: ${Math.floor(m/60)} ساعت پیش`;};
  async function render(){
    if(!window.kzPresence || !window.kzPresence.fetchAll) return setTimeout(render,700);
    const container=document.getElementById('membersContainer'); if(!container) return;
    const [rows,accounts]=await Promise.all([window.kzPresence.fetchAll(),sb.from('accounts').select('id,username')]);
    const names=new Map((accounts.data||[]).map(a=>[a.id,a.username]));
    const byName=new Map(rows.map(r=>[String(names.get(r.account_id)||'').toLowerCase(),r]));
    container.querySelectorAll('.member-tile').forEach(card=>{
      const nameEl=card.querySelector('h4'); if(!nameEl || card.querySelector('.kz-presence')) return;
      const row=byName.get(nameEl.textContent.trim().toLowerCase());
      const wrap=document.createElement('div'); wrap.className='kz-presence';
      if(!row){wrap.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';card.appendChild(wrap);return;}
      const online=window.kzPresence.isOnline(row);
      const away=window.kzPresence.isAway(row);
      const info=window.kzPresence.formatStatus(row.status,row.game,row.status_text);
      const tone=online?(away?'away':info.tone):'offline';
      const label=online?(away?'آخرین فعالیت':info.label):'آفلاین';
      wrap.innerHTML=`<span class="kz-presence-dot ${tone}"></span><span>${info.icon} ${esc(label)}</span>${online&&info.game?`<small>${esc(info.game)}</small>`:''}${online&&info.text?`<small>${esc(info.text)}</small>`:''}${!online&&row.last_seen?`<small>${ageText(Date.now()-new Date(row.last_seen).getTime())}</small>`:''}`;
      card.appendChild(wrap);
    });
  }
  function boot(){setTimeout(render,900);setInterval(render,30000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
