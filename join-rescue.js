// KillZone join rescue — independent reviewer renderer for /join.
(function(){
  'use strict';

  const REVIEWERS=['developer','co_owner','owner'];
  const ACTIVE=['pending','reviewing','waiting_applicant'];
  const isJoinPage=()=>{const p=location.pathname.replace(/\/+$/,'');return p==='/join'||p.endsWith('/join.html');};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>typeof kzFormatDate==='function'?kzFormatDate(v):v||'—';
  const statusText=v=>typeof kzStatusText==='function'?kzStatusText(v):v||'نامشخص';
  const statusClass=v=>typeof kzStatusClass==='function'?kzStatusClass(v):'closed';
  const sessionId=()=>{try{return JSON.parse(localStorage.getItem('kz_session')||'null')?.id||null;}catch{return null;}};

  async function getUser(){
    const id=sessionId();
    if(!id||typeof sb==='undefined') return null;
    const {data,error}=await sb.from('accounts').select('*').eq('id',id).maybeSingle();
    if(error){console.error('join rescue user lookup failed',error);return null;}
    return data||null;
  }

  async function loadRequests(){
    const {data,error}=await sb.from('team_join_requests').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    const requests=data||[];
    const ids=[...new Set(requests.map(r=>r.account_id).filter(Boolean))];
    const accounts={};
    if(ids.length){
      const {data:rows,error:e}=await sb.from('accounts').select('id,username,rank,team_status').in('id',ids);
      if(e) throw e;
      (rows||[]).forEach(a=>accounts[a.id]=a);
    }
    return {requests,accounts};
  }

  function nameOf(r,a){return r.first_name||r.name||a?.username||'متقاضی';}
  function fields(r,a){
    const rows=[['نام',r.first_name||r.name],['نام خانوادگی',r.last_name],['نام کاربری',a?.username],['آیدی روبیکا',r.rubika_id],['سن',r.age],['شهر',r.city],['بازی‌ها',r.other_games],['سطح',r.skill_level],['سابقه بازی',r.gaming_years!=null?`${r.gaming_years} سال`:'' ],['فعالیت هفتگی',r.weekly_activity],['Voice Chat',r.voice_chat],['چرا KillZone؟',r.why_join],['چه چیزی اضافه می‌کنی؟',r.contribution],['اگر اختلاف پیش بیاد؟',r.conflict_response],['نحوه آشنایی',r.how_found_us]];
    return `<div class="kz-dossier">${rows.map(([l,v])=>`<div class="kz-dossier-row"><span>${esc(l)}</span><strong>${esc(v||'—')}</strong></div>`).join('')}</div>`;
  }

  async function render(){
    if(!isJoinPage()) return;
    const root=document.getElementById('kzJoinApp');
    if(!root||typeof sb==='undefined') return;
    const user=await getUser();
    if(!user||!REVIEWERS.includes(user.rank)) return;

    root.innerHTML='<div class="kz-join-shell"><div class="section-title top"><h2>درخواست‌های عضویت</h2><p>مرکز بررسی درخواست‌ها و گفت‌وگوی تیم با متقاضی‌ها.</p></div><div id="kzRescueHost"><div class="loading-note">در حال بارگذاری درخواست‌ها...</div></div></div>';
    try{
      const {requests,accounts}=await loadRequests();
      const host=document.getElementById('kzRescueHost');
      if(!host) return;
      if(!requests.length){host.innerHTML='<div class="empty-note">هنوز هیچ درخواست عضویتی ثبت نشده.</div>';return;}
      let selectedId=requests[0].id;

      const draw=async()=>{
        const selected=requests.find(r=>r.id===selectedId)||requests[0];
        const acc=accounts[selected.account_id]||{};
        const {data:messages,error}=await sb.from('team_join_messages').select('*').eq('request_id',selected.id).order('created_at',{ascending:true});
        if(error) console.error(error);
        host.innerHTML=`<div class="kz-admin-layout"><aside class="kz-ticket-list"><div class="kz-ticket-list-head"><div><strong>درخواست‌ها</strong><p>${requests.length} تیکت</p></div><button class="link-btn" id="kzRescueRefresh" type="button">↻ بروزرسانی</button></div><div class="kz-list-items">${requests.map(r=>{const a=accounts[r.account_id]||{};return `<button class="kz-ticket-list-item ${r.id===selected.id?'active':''}" type="button" data-request-id="${esc(r.id)}"><span><strong>${esc(nameOf(r,a))}</strong><small>${esc(a.username||r.rubika_id||'')}</small></span><span class="kz-status ${statusClass(r.status)}">${esc(statusText(r.status))}</span></button>`;}).join('')}</div></aside><section class="kz-ticket-detail"><div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${esc(String(selected.id||'').replace(/^req-/,'').slice(-8).toUpperCase())}</div><h2>${esc(nameOf(selected,acc))}</h2><p>${esc(acc.username||'')} · ارسال‌شده در ${esc(fmt(selected.created_at))}</p></div><span class="kz-status ${statusClass(selected.status)}">${esc(statusText(selected.status))}</span></div><div class="kz-admin-actions"><button class="btn primary" type="button" data-action="approved">✓ پذیرش</button><button class="btn" type="button" data-action="reviewing">در حال بررسی</button><button class="btn" type="button" data-action="waiting_applicant">منتظر پاسخ</button><button class="btn kz-danger" type="button" data-action="rejected">✕ رد درخواست</button><button class="btn" type="button" data-action="closed">بستن تیکت</button></div>${fields(selected,acc)}<div class="kz-thread"><div class="kz-thread-title"><span>گفت‌وگو</span><small>${messages?.length||0} پیام</small></div>${messages?.length?messages.map(m=>`<article class="kz-message ${m.sender_role==='staff'?'staff':'applicant'}"><div class="kz-message-meta"><strong>${m.sender_role==='staff'?'مدیریت KillZone':esc(nameOf(selected,acc))}</strong><time>${esc(fmt(m.created_at))}</time></div><div class="kz-message-body">${esc(m.message).replace(/\n/g,'<br>')}</div></article>`).join(''):'<div class="kz-empty-thread">هنوز پیامی ثبت نشده.</div>'}</div>${ACTIVE.includes(selected.status)?'<form id="kzRescueReply" class="kz-reply"><label for="kzRescueReplyInput">پیام برای متقاضی</label><textarea id="kzRescueReplyInput" rows="4" required placeholder="پیامت رو برای متقاضی بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzRescueReplyMsg"></div></form>':''}<div id="kzRescueMsg"></div></section></div>`;

        host.querySelectorAll('.kz-ticket-list-item').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.requestId;draw();}));
        document.getElementById('kzRescueRefresh')?.addEventListener('click',async()=>{try{const fresh=await loadRequests();requests.splice(0,requests.length,...fresh.requests);Object.keys(accounts).forEach(k=>delete accounts[k]);Object.assign(accounts,fresh.accounts);selectedId=requests[0]?.id||selectedId;await draw();}catch(e){console.error(e);}});
        host.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>changeStatus(selected,b.dataset.action)));
        document.getElementById('kzRescueReply')?.addEventListener('submit',async e=>{e.preventDefault();const input=document.getElementById('kzRescueReplyInput');const msg=document.getElementById('kzRescueReplyMsg');const text=input?.value.trim();if(!text)return;const {error}=await sb.from('team_join_messages').insert([{id:'msg-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),request_id:selected.id,account_id:selected.account_id,sender_role:'staff',message:text}]);if(error){console.error(error);if(msg)msg.innerHTML='<div class="form-msg err">ارسال پیام ناموفق بود.</div>';return;}await draw();});
      };

      const changeStatus=async(req,status)=>{
        const msg=document.getElementById('kzRescueMsg');
        if(msg)msg.innerHTML='<div class="form-msg">در حال ذخیره...</div>';
        const {error}=await sb.from('team_join_requests').update({status,reviewed_at:['approved','rejected'].includes(status)?new Date().toISOString():null,reviewed_by:user.id}).eq('id',req.id);
        if(error){console.error(error);if(msg)msg.innerHTML='<div class="form-msg err">تغییر وضعیت ناموفق بود.</div>';return;}
        const accountUpdate=status==='approved'?{rank:'member',team_status:'approved'}:{team_status:status==='rejected'?'rejected':'reviewing'};
        const {error:e2}=await sb.from('accounts').update(accountUpdate).eq('id',req.account_id);
        if(e2) console.error(e2);
        const fresh=await loadRequests();
        requests.splice(0,requests.length,...fresh.requests);Object.keys(accounts).forEach(k=>delete accounts[k]);Object.assign(accounts,fresh.accounts);
        selectedId=requests.find(r=>r.id===req.id)?.id||requests[0]?.id;
        if(requests.length) await draw(); else root.innerHTML='<div class="kz-join-shell"><div class="empty-note">هنوز هیچ درخواست عضویتی ثبت نشده.</div></div>';
      };

      await draw();
      root.dataset.kzJoinBoot='done';
      root.dataset.kzJoinRescued='1';
    }catch(error){
      console.error('KillZone independent join rescue failed',error);
      root.innerHTML='<div class="kz-join-shell"><div class="form-msg err">بارگذاری درخواست‌های عضویت ناموفق بود. اتصال دیتابیس را بررسی کن.</div></div>';
    }
  }

  function start(){
    if(!isJoinPage()) return;
    [0,400,1200,2500].forEach(delay=>setTimeout(render,delay));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
