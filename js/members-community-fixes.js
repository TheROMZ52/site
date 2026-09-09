// KillZone members page fixes: staff actions, real membership timestamps, and live presence.
(function(){
  'use strict';

  const ONLINE_MS = 5 * 60 * 1000;
  let accountsCache = null;
  let refreshTimer = null;
  let busy = false;

  const esc = v => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(v)
    : String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  const isStaff = () => !!(
    window.currentUser &&
    ['admin','developer','co_owner','owner'].includes(window.currentUser.rank)
  );

  function formatDateTime(value){
    if(!value) return '';
    try{
      return new Intl.DateTimeFormat('fa-IR', {
        year:'numeric', month:'long', day:'numeric',
        hour:'2-digit', minute:'2-digit'
      }).format(new Date(value));
    }catch(_){ return ''; }
  }

  async function loadAccounts(){
    if(!window.sb) return [];
    const {data,error} = await sb.from('accounts')
      .select('id,username,photo,game,bio,social,joined_at,team_status,rank,is_admin')
      .eq('team_status','approved')
      .order('username');
    if(error){ console.warn('KZ members account refresh:',error); return []; }
    accountsCache = data || [];
    return accountsCache;
  }

  function patchMembershipTimes(accounts){
    const root=document.getElementById('membersCommunityContainer');
    if(!root) return;
    const byName=new Map((accounts||[]).map(a=>[String(a.username||'').trim().toLowerCase(),a]));
    root.querySelectorAll('.kz-profile-card').forEach(card=>{
      const name=card.querySelector('.kz-profile-name')?.textContent?.trim().toLowerCase();
      const account=byName.get(name);
      if(!account?.joined_at) return;
      const meta=card.querySelector('.kz-profile-meta');
      if(!meta) return;
      let item=meta.querySelector('.kz-joined-at');
      if(!item){
        item=document.createElement('span');
        item.className='kz-joined-at';
        meta.appendChild(item);
      }
      item.textContent='عضویت: '+formatDateTime(account.joined_at);
    });
  }

  async function patchAdminActions(accounts){
    const root=document.getElementById('membersCommunityContainer');
    if(!root || !isStaff()) return;
    const list=accounts || await loadAccounts();
    const byName=new Map(list.map(a=>[String(a.username||'').trim().toLowerCase(),a]));

    const add=document.getElementById('addMemberBtn');
    if(add){
      add.style.display='inline-flex';
      if(!add.dataset.kzFixBound){
        add.dataset.kzFixBound='1';
        add.addEventListener('click',()=>{
          if(typeof window.wireMemberModal==='function') window.wireMemberModal();
          if(typeof window.openMemberModal==='function') window.openMemberModal(null,list);
        });
      }
    }

    root.querySelectorAll('.kz-profile-card').forEach(card=>{
      const name=card.querySelector('.kz-profile-name')?.textContent?.trim().toLowerCase();
      const account=byName.get(name);
      if(!account) return;
      let actions=card.querySelector('.kz-profile-admin-actions');
      if(!actions){
        const side=card.querySelector('.kz-profile-side');
        if(!side) return;
        actions=document.createElement('div');
        actions.className='kz-profile-admin-actions';
        side.appendChild(actions);
      }
      if(!actions.querySelector('.kz-member-edit')){
        const edit=document.createElement('button');
        edit.type='button'; edit.className='btn ghost small kz-member-edit';
        edit.textContent='ویرایش';
        edit.dataset.id=account.id;
        edit.addEventListener('click',e=>{
          e.preventDefault(); e.stopPropagation();
          if(typeof window.wireMemberModal==='function') window.wireMemberModal();
          if(typeof window.openMemberModal==='function') window.openMemberModal(account.id,list);
        });
        actions.appendChild(edit);
      }
      if(!actions.querySelector('.kz-member-delete')){
        const del=document.createElement('button');
        del.type='button'; del.className='btn ghost small kz-member-delete';
        del.textContent='حذف'; del.dataset.id=account.id;
        del.addEventListener('click',async e=>{
          e.preventDefault(); e.stopPropagation();
          if(typeof window.deleteMember==='function') return window.deleteMember(account.id);
          if(!confirm(`این اکانت «${account.username}» حذف بشه؟`)) return;
          await sb.from('member_presence').delete().eq('account_id',account.id);
          await sb.from('team_join_messages').delete().eq('account_id',account.id);
          await sb.from('team_join_requests').delete().eq('account_id',account.id);
          await sb.from('accounts').delete().eq('id',account.id);
          location.reload();
        });
        actions.appendChild(del);
      }
    });
  }

  async function paintPresence(accounts){
    const root=document.getElementById('membersCommunityContainer');
    if(!root || !window.sb) return;
    const cards=[...root.querySelectorAll('.kz-profile-card')];
    if(!cards.length) return;
    const list=accounts || await loadAccounts();
    const approved=new Map(list.map(a=>[a.id,a]));
    const {data:rows,error}=await sb.from('member_presence')
      .select('account_id,status,game,status_text,last_seen')
      .in('account_id',[...approved.keys()]);
    if(error){console.warn('KZ member presence:',error);return;}
    const byId=new Map((rows||[]).map(r=>[r.account_id,r]));
    let onlineCount=0;

    cards.forEach(card=>{
      const name=card.querySelector('.kz-profile-name')?.textContent?.trim().toLowerCase();
      const account=list.find(a=>String(a.username||'').trim().toLowerCase()===name);
      if(!account) return;
      const row=byId.get(account.id);
      const old=card.querySelector('.kz-presence');
      if(old) old.remove();
      const wrap=document.createElement('div');
      wrap.className='kz-presence';
      let online=false;
      if(row?.last_seen){
        const age=Date.now()-new Date(row.last_seen).getTime();
        online=Number.isFinite(age) && age <= ONLINE_MS;
      }
      if(online){
        onlineCount++;
        const labels={playing:'در حال بازی',competitive:'در حال رقابت',ready:'آماده',busy:'مشغول',away:'AFK'};
        const icons={playing:'🎮',competitive:'🏆',ready:'🟢',busy:'🔴',away:'💤'};
        const status=row.status||'ready';
        wrap.innerHTML=`<span class="kz-presence-dot ${esc(status)}"></span><span>آنلاین · ${icons[status]||'🟢'} ${esc(labels[status]||'آماده')}</span>${row.game?`<small>${esc(row.game)}</small>`:''}${row.status_text?`<small>${esc(row.status_text)}</small>`:''}`;
      }else{
        wrap.innerHTML='<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
      }
      card.querySelector('.kz-profile-main')?.appendChild(wrap);
    });

    const stat=document.querySelector('.kz-members-stat');
    if(stat){
      let line=stat.querySelector('.kz-online-count');
      if(!line){line=document.createElement('span');line.className='kz-online-count';stat.appendChild(line);}
      line.textContent=`${onlineCount} عضو آنلاین از ${list.length}`;
    }
  }

  async function refresh(){
    if(busy || !window.sb) return;
    const root=document.getElementById('membersCommunityContainer');
    if(!root || !root.querySelector('.kz-profile-card')) return;
    busy=true;
    try{
      const accounts=accountsCache || await loadAccounts();
      patchMembershipTimes(accounts);
      await patchAdminActions(accounts);
      await paintPresence(accounts);
    }finally{busy=false;}
  }

  function start(){
    if(refreshTimer) return;
    let attempts=0;
    const wait=setInterval(async()=>{
      attempts++;
      if(window.sb && document.getElementById('membersCommunityContainer')?.querySelector('.kz-profile-card')){
        clearInterval(wait);
        await refresh();
        refreshTimer=setInterval(refresh,5000);
      }else if(attempts>60){
        clearInterval(wait);
      }
    },250);
  }

  window.addEventListener('kz:session-ready',()=>{accountsCache=null;start();});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
