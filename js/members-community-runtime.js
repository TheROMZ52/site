// KillZone community page runtime.
// Single owner for rank grouping, public presence and guest management.
(function(){
  'use strict';
  const ROOT='membersCommunityContainer';
  const RANKS=[['owner','اونر','OWNER'],['co_owner','کو-اونر','CO-OWNER'],['developer','دولوپر','DEVELOPER'],['admin','ادمین','ADMIN'],['member','ممبر','MEMBER'],['new_member','نیو ممبر','NEW MEMBER']];
  const STAFF=new Set(['admin','developer','co_owner','owner']);
  const rankKeys=new Set(RANKS.map(x=>x[0]));
  const ONLINE_MS=300000;
  let observer=null, busy=false, queued=false, lastSignature='';
  let cachedAccounts=[], cachedPresence=[];

  const root=()=>document.getElementById(ROOT);
  const norm=v=>String(v||'').trim().toLowerCase();
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const staff=()=>!!(window.currentUser&&STAFF.has(window.currentUser.rank));

  function styles(){
    if(document.getElementById('kz-members-runtime-style'))return;
    const s=document.createElement('style');s.id='kz-members-runtime-style';s.textContent='.kz-community-rank-section{margin:0 0 34px}.kz-community-rank-heading{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:0 2px}.kz-community-rank-heading .tier{display:grid;place-items:center;width:28px;height:28px;border:1px solid rgba(223,99,48,.42);color:#df6330;font-size:11px;background:rgba(223,99,48,.05)}.kz-community-rank-heading h3{margin:0;color:#f4eddc;font-size:18px;font-weight:800;white-space:nowrap}.kz-community-rank-heading .rule{height:1px;flex:1;background:linear-gradient(90deg,rgba(223,99,48,.55),rgba(89,80,62,.55),transparent)}.kz-community-rank-code{color:rgba(244,237,220,.34);font:700 8px Press Start 2P,monospace;letter-spacing:.8px;direction:ltr}.kz-community-rank-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.kz-community-rank-grid .kz-profile-card{margin:0}.kz-runtime-presence{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:10px;color:#a59b86;font-size:10px}.kz-runtime-presence .kz-presence-dot{width:7px;height:7px;border-radius:50%;display:inline-block;background:#728b4b}.kz-runtime-presence .kz-presence-dot.offline{background:#59503e}.kz-runtime-presence small{font-size:9px;color:#756d5d}.kz-runtime-guests{margin-top:32px;border-top:1px solid rgba(89,80,62,.5);padding-top:24px}.kz-runtime-guest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.kz-runtime-guest-card{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #3b362a;background:rgba(255,255,255,.018)}.kz-runtime-guest-card .avatar{width:46px;height:46px;flex:0 0 46px;border:1px solid #3b362a;display:grid;place-items:center;background:#11110f}.kz-runtime-guest-card .body{min-width:0;flex:1}.kz-runtime-guest-card .name{font-weight:800;color:#f4eddc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kz-runtime-guest-card .meta{margin-top:4px;color:#a59b86;font-size:10px}.kz-runtime-guest-card .actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}@media(max-width:880px){.kz-community-rank-grid,.kz-runtime-guest-grid{grid-template-columns:1fr}}@media(max-width:560px){.kz-community-rank-heading h3{font-size:15px}.kz-community-rank-code{display:none}}';document.head.appendChild(s);
  }

  async function accounts(){
    if(!window.sb)return [];
    const {data,error}=await sb.from('accounts').select('id,username,photo,game,rank,team_status').eq('team_status','approved').order('username');
    if(error){console.warn('KZ member runtime accounts:',error);return []}return data||[];
  }
  async function presence(){
    if(!window.sb)return [];
    const {data,error}=await sb.from('member_presence').select('account_id,status,game,status_text,last_seen');
    if(error){console.warn('KZ member runtime presence:',error);return []}return data||[];
  }
  function signature(list){return list.map(a=>[a.id,a.username,a.game,a.rank,a.photo].join('|')).join('||')}

  async function group(){
    const r=root();if(!r||busy)return;
    const source=r.querySelector(':scope > .kz-profile-grid');if(!source)return;
    const cards=[...source.querySelectorAll(':scope > .kz-profile-card')];if(!cards.length)return;
    busy=true;
    try{
      const byName=new Map(cachedAccounts.map(a=>[norm(a.username),norm(a.rank)]));
      const groups=new Map(RANKS.map(x=>[x[0],[]]));const other=[];
      cards.forEach(card=>{const name=norm(card.querySelector('.kz-profile-name')?.textContent);const rank=byName.get(name)||'';if(rankKeys.has(rank))groups.get(rank).push(card);else other.push(card);});
      const frag=document.createDocumentFragment();
      RANKS.forEach(([key,label,code])=>{const list=groups.get(key)||[];if(!list.length)return;list.sort((a,b)=>(a.querySelector('.kz-profile-name')?.textContent||'').localeCompare(b.querySelector('.kz-profile-name')?.textContent||'','fa'));const sec=document.createElement('section');sec.className='kz-community-rank-section';sec.dataset.rank=key;sec.innerHTML='<div class="kz-community-rank-heading"><span class="tier">▲</span><h3>'+esc(label)+'</h3><div class="rule"></div><span class="kz-community-rank-code">'+code+'</span></div><div class="kz-community-rank-grid"></div>';const grid=sec.querySelector('.kz-community-rank-grid');list.forEach(c=>grid.appendChild(c));frag.appendChild(sec)});
      if(other.length){const sec=document.createElement('section');sec.className='kz-community-rank-section';sec.dataset.rank='other';sec.innerHTML='<div class="kz-community-rank-heading"><span class="tier">▲</span><h3>سایر</h3><div class="rule"></div><span class="kz-community-rank-code">OTHER</span></div><div class="kz-community-rank-grid"></div>';other.forEach(c=>sec.querySelector('.kz-community-rank-grid').appendChild(c));frag.appendChild(sec)}
      r.replaceChildren(frag);
    }finally{busy=false}
  }

  function paint(){
    const r=root();if(!r)return;const byId=new Map(cachedPresence.map(x=>[x.account_id,x]));const byName=new Map(cachedAccounts.map(x=>[norm(x.username),x]));
    r.querySelectorAll('.kz-profile-card').forEach(card=>{card.querySelector('.kz-runtime-presence')?.remove();const a=byName.get(norm(card.querySelector('.kz-profile-name')?.textContent));if(!a)return;const p=byId.get(a.id);const age=p?.last_seen?Date.now()-new Date(p.last_seen).getTime():Infinity;const online=Number.isFinite(age)&&age<=ONLINE_MS;const box=document.createElement('div');box.className='kz-runtime-presence';if(!online){box.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>'}else{const labels={playing:['در حال بازی','🎮'],competitive:['در حال رقابت','🏆'],ready:['آماده','🟢'],busy:['مشغول','🔴'],away:['AFK','💤']};const info=labels[p.status]||labels.ready;box.innerHTML='<span class="kz-presence-dot"></span><span>آنلاین · '+info[1]+' '+info[0]+'</span>'+(p.game?'<small>'+esc(p.game)+'</small>':'')+(p.status_text?'<small>'+esc(p.status_text)+'</small>':'')}card.querySelector('.kz-profile-main')?.appendChild(box)});
  }

  function guestButton(){
    const b=document.getElementById('guestAccountsBtn');if(!b)return;b.style.display=staff()?'inline-flex':'none';if(b.dataset.kzRuntimeBound)return;b.dataset.kzRuntimeBound='1';b.addEventListener('click',async()=>{const show=b.dataset.shown==='1';if(show){b.dataset.shown='0';delete document.body.dataset.kzShowGuests;root()?.querySelector('.kz-runtime-guests')?.remove();b.textContent='👥 مشاهده اکانت‌های مهمان';return}b.dataset.shown='1';document.body.dataset.kzShowGuests='1';b.textContent='👁 مخفی‌کردن مهمان‌ها';await guests()});
  }
  async function guests(){
    const r=root();if(!r||!staff()||!window.sb)return;r.querySelector('.kz-runtime-guests')?.remove();const {data,error}=await sb.from('accounts').select('id,username,photo,game').eq('rank','guest').order('username');if(error){console.warn('KZ guest runtime:',error);return}const sec=document.createElement('section');sec.className='kz-runtime-guests';sec.innerHTML='<div class="kz-profile-section-title"><h3>اکانت‌های مهمان</h3><span>GUEST ACCOUNTS</span></div><div class="kz-runtime-guest-grid"></div>';const grid=sec.querySelector('.kz-runtime-guest-grid');if(!data?.length){grid.innerHTML='<div class="kz-community-empty">اکانت مهمانی وجود نداره.</div>'}else{data.forEach(m=>{const card=document.createElement('article');card.className='kz-runtime-guest-card';card.innerHTML='<div class="avatar">'+esc((m.username||'?').slice(0,2).toUpperCase())+'</div><div class="body"><div class="name">'+esc(m.username)+'</div><div class="meta">'+esc(m.game||'بازی ثبت نشده')+' · مهمان</div></div><div class="actions"><button class="btn primary small" data-action="approve" type="button">✓ تأیید</button><button class="btn ghost small" data-action="delete" type="button">حذف</button></div>';card.querySelector('[data-action="approve"]').onclick=async()=>{if(!confirm('اکانت «'+m.username+'» تأیید و به عضو تبدیل شود؟'))return;const {error:e}=await sb.from('accounts').update({rank:'member',team_status:'approved'}).eq('id',m.id).eq('rank','guest');if(e){alert('تأیید اکانت انجام نشد.');return}await refresh(true)};card.querySelector('[data-action="delete"]').onclick=async()=>{if(!confirm('اکانت «'+m.username+'» حذف شود؟'))return;const {error:e}=await sb.from('accounts').delete().eq('id',m.id).eq('rank','guest');if(e){alert('حذف اکانت انجام نشد.');return}await refresh(true)};grid.appendChild(card)})}r.appendChild(sec);
  }

  async function refresh(force){
    const r=root();if(!r||!window.sb)return;cachedAccounts=await accounts();cachedPresence=await presence();const sig=signature(cachedAccounts);if(force||sig!==lastSignature){if(r.querySelector(':scope > .kz-profile-grid'))await group();lastSignature=sig}paint();guestButton();if(staff()&&document.body.dataset.kzShowGuests==='1')await guests();
  }
  function queue(force){if(queued&&!force)return;queued=true;requestAnimationFrame(async()=>{queued=false;await refresh(!!force)})}
  function boot(){styles();const r=root();if(!r){setTimeout(boot,250);return}observer=new MutationObserver(()=>{if(groupingInProgress())return;if(r.querySelector(':scope > .kz-profile-grid')&&!r.querySelector(':scope > .kz-community-rank-section'))queue(true);paint()});observer.observe(r,{childList:true,subtree:true});guestButton();queue(true);window.addEventListener('kz:session-changed',()=>queue(true));window.addEventListener('kz:community-refresh',()=>queue(true));setInterval(()=>queue(false),5000)}
  const groupingInProgress=()=>busy;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
