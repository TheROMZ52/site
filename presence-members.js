// KillZone members presence decorations.
(function(){
  'use strict';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const ageText=ms=>{const m=Math.max(1,Math.floor(ms/60000));return m<60?`آخرین فعالیت: ${m} دقیقه پیش`:`آخرین فعالیت: ${Math.floor(m/60)} ساعت پیش`;};
  let running=false;
  async function render(){
    if(running) return;
    const container=document.getElementById('membersContainer');
    if(!container) return;
    if(!window.kzPresence || !window.kzPresence.fetchAll || typeof sb==='undefined') return;
    const cards=container.querySelectorAll('.member-tile');
    if(!cards.length) return;
    running=true;
    try{
      const [rows,accounts]=await Promise.all([
        window.kzPresence.fetchAll(),
        sb.from('accounts').select('id,username,team_status')
      ]);
      const approvedIds=new Set((accounts.data||[]).filter(a=>a.team_status==null||a.team_status==='approved').map(a=>a.id));
      const names=new Map((accounts.data||[]).filter(a=>approvedIds.has(a.id)).map(a=>[a.id,a.username]));
      const byName=new Map((rows||[]).filter(r=>approvedIds.has(r.account_id)).map(r=>[String(names.get(r.account_id)||'').toLowerCase(),r]));
      cards.forEach(card=>{
        const nameEl=card.querySelector('h4');
        if(!nameEl) return;
        const old=card.querySelector('.kz-presence');
        if(old) old.remove();
        const row=byName.get(nameEl.textContent.trim().toLowerCase());
        const wrap=document.createElement('div'); wrap.className='kz-presence';
        if(!row){wrap.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';card.appendChild(wrap);return;}
        const online=window.kzPresence.isOnline(row);
        const info=window.kzPresence.formatStatus(row.status,row.game,row.status_text);
        const tone=online?info.tone:'offline';
        const label=online?info.label:'آفلاین';
        wrap.innerHTML=`<span class="kz-presence-dot ${tone}"></span><span>${info.icon} ${esc(label)}</span>${online&&info.game?`<small>${esc(info.game)}</small>`:''}${online&&info.text?`<small>${esc(info.text)}</small>`:''}${!online&&row.last_seen?`<small>${ageText(Date.now()-new Date(row.last_seen).getTime())}</small>`:''}`;
        card.appendChild(wrap);
      });
    }catch(err){
      console.warn('KillZone presence render skipped',err);
    }finally{
      running=false;
    }
  }
  function boot(){
    setTimeout(render,1000);
    setInterval(render,5000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
