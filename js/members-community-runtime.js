// KillZone Members — directory runtime
(function(){
  'use strict';
  const ROOT='membersCommunityContainer';
  const STAFF=new Set(['admin','developer','co_owner','owner']);
  const ONLINE_MS=300000;
  let accounts=[], presence=[], timer=null, observer=null, refreshing=false;

  const root=()=>document.getElementById(ROOT);
  const norm=v=>String(v??'').trim().toLowerCase();
  const staff=()=>!!(window.currentUser&&STAFF.has(window.currentUser.rank));
  const esc=v=>typeof window.escapeHtml==='function'?window.escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function isOnline(id){
    const p=presence.find(x=>x.account_id===id);
    return !!(p?.last_seen && Date.now()-new Date(p.last_seen).getTime()<=ONLINE_MS);
  }
  function gamesOf(a){return String(a?.game||'').split(/[،,|]/).map(x=>x.trim()).filter(Boolean);}
  function getCardAccount(card){
    const name=norm(card.querySelector('.kz-profile-name')?.textContent);
    return accounts.find(a=>norm(a.username)===name)||null;
  }

  async function load(){
    if(!window.sb)return;
    const [a,p]=await Promise.all([
      sb.from('accounts').select('id,username,photo,game,bio,social,joined_at,rank,team_status').eq('team_status','approved').order('username'),
      sb.from('member_presence').select('account_id,status,game,status_text,last_seen')
    ]);
    if(!a.error)accounts=a.data||[];
    if(!p.error)presence=p.data||[];
  }

  function updateStats(){
    const total=document.getElementById('membersTotal');
    const online=document.getElementById('membersOnline');
    const games=document.getElementById('membersGames');
    if(total)total.textContent=accounts.length;
    if(online)online.textContent=accounts.filter(a=>isOnline(a.id)).length;
    if(games)games.textContent=new Set(accounts.flatMap(gamesOf).map(norm)).size;
  }

  function populateGames(){
    const select=document.getElementById('memberGameFilter');if(!select)return;
    const current=select.value;
    const values=[...new Map(accounts.flatMap(gamesOf).map(g=>[norm(g),g])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fa'));
    select.innerHTML='<option value="all">همه بازی‌ها</option>'+values.map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');
    select.value=[...select.options].some(o=>o.value===current)?current:'all';
  }

  function addPresence(card,a){
    card.querySelector('.kz-runtime-presence')?.remove();
    if(!a)return;
    const p=presence.find(x=>x.account_id===a.id);
    const box=document.createElement('div');box.className='kz-runtime-presence';
    if(!isOnline(a.id)){
      box.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
    }else{
      const labels={playing:['در حال بازی','🎮'],competitive:['در حال رقابت','🏆'],ready:['آماده','🟢'],busy:['مشغول','🔴'],away:['AFK','💤']};
      const info=labels[p?.status]||labels.ready;
      box.innerHTML=`<span class="kz-presence-dot"></span><span>آنلاین · ${info[1]} ${info[0]}</span>${p?.game?`<small>${esc(p.game)}</small>`:''}${p?.status_text?`<small>${esc(p.status_text)}</small>`:''}`;
    }
    card.appendChild(box);
  }

  function sortCards(cards){
    const mode=document.getElementById('memberSort')?.value||'name';
    return [...cards].sort((x,y)=>{
      const a=getCardAccount(x),b=getCardAccount(y);
      if(mode==='online')return Number(isOnline(b?.id))-Number(isOnline(a?.id)) || norm(a?.username).localeCompare(norm(b?.username),'fa');
      if(mode==='recent')return new Date(b?.joined_at||0)-new Date(a?.joined_at||0);
      return norm(a?.username).localeCompare(norm(b?.username),'fa');
    });
  }

  function applyFilters(){
    const r=root();if(!r)return;
    const grid=r.querySelector(':scope > .kz-profile-grid');if(!grid)return;
    const q=norm(document.getElementById('memberSearch')?.value);
    const game=norm(document.getElementById('memberGameFilter')?.value||'all');
    const status=document.getElementById('memberStatusFilter')?.value||'all';
    const cards=[...grid.querySelectorAll(':scope > .kz-profile-card')];
    cards.forEach(card=>{
      const a=getCardAccount(card);const text=norm([a?.username,a?.bio,a?.game].join(' '));
      const gameOk=game==='all'||gamesOf(a).some(g=>norm(g)===game);
      const statusOk=status==='all'||(status==='online'?isOnline(a?.id):!isOnline(a?.id));
      card.hidden=!(text.includes(q)&&gameOk&&statusOk);
      addPresence(card,a);
    });
    sortCards(cards).forEach(c=>grid.appendChild(c));
    const visible=cards.filter(c=>!c.hidden);
    const count=document.getElementById('membersResultCount');if(count)count.textContent=`نمایش ${visible.length} از ${cards.length} عضو`;
    r.querySelector('.kz-filter-empty')?.remove();
    if(cards.length&&!visible.length){
      const empty=document.createElement('div');empty.className='kz-filter-empty';empty.innerHTML='<strong>عضوی پیدا نشد</strong><span>عبارت جستجو یا فیلترها رو تغییر بده.</span>';r.appendChild(empty);
    }
    const clear=document.getElementById('memberSearchClear');if(clear)clear.hidden=!q;
  }

  function wireControls(){
    const search=document.getElementById('memberSearch');
    const clear=document.getElementById('memberSearchClear');
    const game=document.getElementById('memberGameFilter');
    const status=document.getElementById('memberStatusFilter');
    const sort=document.getElementById('memberSort');
    const reset=document.getElementById('memberResetFilters');
    if(search&&!search.dataset.kzBound){search.dataset.kzBound='1';search.addEventListener('input',applyFilters);search.addEventListener('compositionend',applyFilters);}
    if(clear&&!clear.dataset.kzBound){clear.dataset.kzBound='1';clear.addEventListener('click',()=>{search.value='';search.focus();applyFilters();});}
    [game,status,sort].forEach(el=>{if(el&&!el.dataset.kzBound){el.dataset.kzBound='1';el.addEventListener('change',applyFilters);}});
    if(reset&&!reset.dataset.kzBound){reset.dataset.kzBound='1';reset.addEventListener('click',()=>{if(search)search.value='';if(game)game.value='all';if(status)status.value='all';if(sort)sort.value='name';applyFilters();search?.focus();});}
  }

  function wireStaff(){
    const add=document.getElementById('addMemberBtn');
    const guests=document.getElementById('guestAccountsBtn');
    if(add)add.style.display=staff()?'inline-flex':'none';
    if(guests)guests.style.display=staff()?'inline-flex':'none';
  }

  async function refresh(force){
    if(refreshing)return;refreshing=true;
    try{await load();updateStats();populateGames();wireControls();wireStaff();applyFilters();}
    finally{refreshing=false;}
  }

  function boot(){
    const r=root();if(!r){setTimeout(boot,250);return;}
    wireControls();wireStaff();
    observer=new MutationObserver(()=>{if(r.querySelector(':scope > .kz-profile-grid'))applyFilters();});
    observer.observe(r,{childList:true,subtree:true});
    refresh(true);
    window.addEventListener('kz:session-changed',()=>{wireStaff();refresh(true);});
    window.addEventListener('kz:community-refresh',()=>refresh(true));
    timer=setInterval(()=>refresh(false),10000);
    window.addEventListener('pagehide',()=>{if(timer)clearInterval(timer);observer?.disconnect();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
