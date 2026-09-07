// KillZone reviewer membership center — single boot, separate tickets, delete + responder names.
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
  let started=false;

  async function getUser(){
    const id=sessionId();
    if(!id||typeof sb==='undefined') return null;
    const {data,error}=await sb.from('accounts').select('*').eq('id',id).maybeSingle();
    if(error){console.error('join reviewer user lookup failed',error);return null;}
    return data||null;
  }
  async function loadData(){
    const {data,error}=await sb.from('team_join_requests').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    const requests=data||[];
    const ids=[...new Set(requests.map(r=>r.account_id).filter(Boolean))];
    const accounts={};
    if(ids.length){
      const {data:rows,error:e}=await sb.from('accounts').select('id,username,rank,team_status').in('id',ids); if(e)throw e; (rows||[]).forEach(a=>accounts[a.id]=a); }
    return {requests,accounts};
  }
  function applicantName(r,a){return r.first_name||r.name||a?.username||'متقاضی';}
  function fields(r,a){const rows=[['نام',r.first_name||r.name],['نام خانوادگی',r.last_name],['نام کاربری',a?.username],['آیدی روبیکا',r.rubika_id],['سن',r.age],['شهر',r.city],['بازی‌ها',r.other_games],['سطح',r.skill_level],['سابقه بازی',r.gaming_years!=null?`${r.gaming_years} سال`:'' ],['فعالیت هفتگی',r.weekly_activity],['Voice Chat',r.voice_chat],['چرا KillZone؟',r.why_join],['چه چیزی اضافه می‌کنی؟',r.contribution],['اگر اختلاف پیش بیاد؟',r.conflict_response],['نحوه آشنایی',r.how_found_us]];return `<div class="kz-dossier">${rows.map(([l,v])=>`<div class="kz-dossier-row"><span>${esc(l)}</span><strong>${esc(v||'—')}</strong></div>`).join('')}</div>`;}

  async function render(){
    if(started||!isJoinPage())return;
    started=true;
    const root=document.getElementById('kzJoinApp'); if(!root||typeof sb==='undefined'){started=false;return;}
    root.innerHTML='<div class="kz-join-shell"><div class="section-title top"><h2>درخواست‌های عضویت</h2><p>مرکز بررسی درخواست‌ها و گفت‌وگوی تیم با متقاضی‌ها.</p></div><div id="kzRescueHost"><div class="loading-note">در حال بارگذاری درخواست‌ها...</div></div></div>';
    try{
      const user=await getUser();
      if(!user||!REVIEWERS.includes(user.rank)){started=false;return;}
      const {requests,accounts}=await loadData();
      const host=document.getElementById('kzRescueHost'); if(!host)return;
      if(!requests.length){host.innerHTML='<div class="empty-note">هنوز هیچ درخواست عضویتی ثبت نشده.</div>';return;}
      let selectedId=requests[0].id;

      const draw=async()=>{
        const selected=requests.find(r=>r.id===selectedId)||requests[0]; if(!selected)return;
        const acc=accounts[selected.account_id]||{};
        const {data:messages,error}=await sb.from('team_join_messages').select('*').eq('request_id',selected.id).order('created_at',{ascending:true});
        if(error)throw error;
        const responderIds=[...new Set((messages||[]).filter(m=>m.sender_role==='staff'&&m.account_id).map(m=>m.account_id))];
        const responders={};
        if(responderIds.length){const {data:staffRows}=await sb.from('accounts').select('id,username').in('id',responderIds);(staffRows||[]).forEach(a=>responders[a.id]=a.username);}
        host.innerHTML=`<div class="kz-admin-layout"><aside class="kz-ticket-list"><div class="kz-ticket-list-head"><div><strong>درخواست‌ها</strong><p>${requests.length} تیکت</p></div><button class="link-btn" id="kzRescueRefresh" type="button">↻ بروزرسانی</button></div><div class="kz-list-items">${requests.map(r=>{const a=accounts[r.account_id]||{};return `<button class="kz-ticket-list-item ${r.id===selected.id?'active':''}" type="button" data-request-id="${esc(r.id)}"><span><strong>${esc(applicantName(r,a))}</strong><small>${esc(a.username||r.rubika_id||'')}</small></span><span class="kz-status ${statusClass(r.status)}">${esc(statusText(r.status))}</span></button>`;}).join('')}</div></aside><section class="kz-ticket-detail"><div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${esc(String(selected.id||'').replace(/^req-/,'').slice(-8).toUpperCase())}</div><h2>${esc(applicantName(selected,acc))}</h2><p>${esc(acc.username||'')} · ارسال‌شده در ${esc(fmt(selected.created_at))}</p></div><span class="kz-status ${statusClass(selected.status)}">${esc(statusText(selected.status))}</span></div><div class="kz-admin-actions"><button class="btn primary" type="button" data-action="approved">✓ پذیرش</button><button class="btn" type="button" data-action="reviewing">در حال بررسی</button><button class="btn" type="button" data-action="waiting_applicant">منتظر پاسخ</button><button class="btn kz-danger" type="button" data-action="rejected">✕ رد درخواست</button><button class="btn" type="button" data-action="closed">بستن تیکت</button><button class="btn kz-danger" type="button" data-action="delete-ticket">🗑 حذف تیکت</button></div>${fields(selected,acc)}<div class="kz-thread"><div class="kz-thread-title"><span>گفت‌وگو</span><small>${messages?.length||0} پیام</small></div>${messages?.length?messages.map(m=>{const sender=m.sender_role==='staff'?(responders[m.account_id]||'مدیریت KillZone'):applicantName(selected,acc);return `<article class="kz-message ${m.sender_role==='staff'?'staff':'applicant'}"><div class="kz-message-meta"><strong>${esc(sender)}</strong><time>${esc(fmt(m.created_at))}</time></div><div class="kz-message-body">${esc(m.message).replace(/\n/g,'<br>')}</div></article>`;}).join(''):'<div class="kz-empty-thread">هنوز پیامی ثبت نشده.</div>'}</div>${ACTIVE.includes(selected.status)?'<form id="kzRescueReply" class="kz-reply"><label for="kzRescueReplyInput">پیام برای متقاضی</label><textarea id="kzRescueReplyInput" rows="4" required placeholder="پیامت رو برای متقاضی بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzRescueReplyMsg"></div></form>':''}<div id="kzRescueMsg"></div></section></div>`;
        host.querySelectorAll('.kz-ticket-list-item').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.requestId;draw();}));
        document.getElementById('kzRescueRefresh')?.addEventListener('click',async()=>{try{const fresh=await loadData();requests.splice(0,requests.length,...fresh.requests);Object.keys(accounts).forEach(k=>delete accounts[k]);Object.assign(accounts,fresh.accounts);selectedId=requests.find(r=>r.id===selectedId)?.id||requests[0]?.id;await draw();}catch(e){console.error(e);}});
        host.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',async()=>{const action=b.dataset.action;if(action==='delete-ticket'){if(!confirm('این تیکت و تمام پیام‌های آن حذف شود؟ این کار برگشت‌پذیر نیست.'))return;try{await sb.from('team_join_messages').delete().eq('request_id',selected.id);const {error}=await sb.from('team_join_requests').delete().eq('id',selected.id);if(error)throw error;const fresh=await loadData();requests.splice(0,requests.length,...fresh.requests);Object.keys(accounts).forEach(k=>delete accounts[k]);Object.assign(accounts,fresh.accounts);selectedId=requests[0]?.id;if(requests.length)await draw();else host.innerHTML='<div class="empty-note">هنوز هیچ درخواست عضویتی ثبت نشده.</div>';}catch(e){console.error(e);alert('حذف تیکت ناموفق بود.');}return;}await changeStatus(selected,action);}));
        document.getElementById('kzRescueReply')?.addEventListener('submit',async e=>{e.preventDefault();const input=document.getElementById('kzRescueReplyInput'),msg=document.getElementById('kzRescueReplyMsg');const text=input?.value.trim();if(!text)return;const {error}=await sb.from('team_join_messages').insert([{id:'msg-'+Date.now()+'-'+Math.random().toString(36).slice(2,9),request_id:selected.id,account_id:selected.account_id,sender_role:'staff',message:text}]);if(error){console.error(error);if(msg)msg.innerHTML='<div class="form-msg err">ارسال پیام ناموفق بود.</div>';return;}await draw();});
      };
      const changeStatus=async(req,status)=>{const msg=document.getElementById('kzRescueMsg');if(msg)msg.innerHTML='<div class="form-msg">در حال ذخیره...</div>';const newStatus=status==='approved'?'approved':status;const {error}=await sb.from('team_join_requests').update({status:newStatus,reviewed_at:['approved','rejected'].includes(newStatus)?new Date().toISOString():null,reviewed_by:user.id}).eq('id',req.id);if(error){console.error(error);if(msg)msg.innerHTML='<div class="form-msg err">تغییر وضعیت ناموفق بود.</div>';return;}const accountUpdate=newStatus==='approved'?{rank:'member',team_status:'approved'}:{team_status:newStatus==='rejected'?'rejected':'reviewing'};await sb.from('accounts').update(accountUpdate).eq('id',req.account_id);const fresh=await loadData();requests.splice(0,requests.length,...fresh.requests);Object.keys(accounts).forEach(k=>delete accounts[k]);Object.assign(accounts,fresh.accounts);selectedId=req.id;await draw();};
      await draw();
      root.dataset.kzJoinBoot='done';root.dataset.kzJoinRescued='1';
    }catch(error){console.error('KillZone reviewer join render failed',error);root.innerHTML='<div class="kz-join-shell"><div class="form-msg err">بارگذاری درخواست‌های عضویت ناموفق بود.</div></div>';}
  }
  function start(){if(!isJoinPage()||started)return;setTimeout(render,700);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
