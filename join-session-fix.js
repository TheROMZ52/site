// KillZone join page — applicant tickets + staff membership-request panel.
(function(){
  const ACTIVE=['pending','reviewing','waiting_applicant'];
  const REVIEWERS=['developer','co_owner','owner'];
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>typeof kzFormatDate==='function'?kzFormatDate(v):v||'—';
  const statusText=v=>typeof kzStatusText==='function'?kzStatusText(v):v||'نامشخص';
  const statusClass=v=>typeof kzStatusClass==='function'?kzStatusClass(v):'closed';
  const newMessageId=()=>typeof kzNewId==='function'?kzNewId('msg'):`msg-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  const isReviewer=()=>!!(window.currentUser&&REVIEWERS.includes(window.currentUser.rank));
  const isJoinPage=()=>{const p=location.pathname.replace(/\/+$/,'');return p==='/join'||p.endsWith('/join.html');};

  async function loadLatest(){
    if(!window.currentUser) return null;
    const {data,error}=await sb.from('team_join_requests').select('*').eq('account_id',window.currentUser.id).order('created_at',{ascending:false}).limit(1);
    if(error){ console.error(error); return null; }
    return data?.[0]||null;
  }
  async function loadAllRequests(){
    const {data,error}=await sb.from('team_join_requests').select('*').order('created_at',{ascending:false});
    if(error){ console.error(error); return {requests:[],accounts:{},error}; }
    const requests=data||[]; const ids=[...new Set(requests.map(r=>r.account_id).filter(Boolean))]; const accounts={};
    if(ids.length){ const {data:rows,error:e2}=await sb.from('accounts').select('id,username,rank,team_status').in('id',ids); if(e2) console.error(e2); else (rows||[]).forEach(a=>accounts[a.id]=a); }
    return {requests,accounts,error:null};
  }
  function applicantName(r,a){ return r.first_name||r.name||a?.username||'متقاضی'; }
  function requestFields(r,a){
    const rows=[['نام',r.first_name||r.name],['نام خانوادگی',r.last_name],['نام کاربری',a?.username],['آیدی روبیکا',r.rubika_id],['سن',r.age],['شهر',r.city],['بازی‌ها',r.other_games],['سطح',r.skill_level],['سابقه بازی',r.gaming_years!=null?`${r.gaming_years} سال`:'' ],['فعالیت هفتگی',r.weekly_activity],['Voice Chat',r.voice_chat],['چرا KillZone؟',r.why_join],['چه چیزی اضافه می‌کنی؟',r.contribution],['اگر اختلاف پیش بیاد؟',r.conflict_response],['نحوه آشنایی',r.how_found_us]];
    return `<div class="kz-dossier">${rows.map(([l,v])=>`<div class="kz-dossier-row"><span>${esc(l)}</span><strong>${esc(v||'—')}</strong></div>`).join('')}</div>`;
  }
  async function renderAdminPanel(){
    const root=document.getElementById('kzJoinApp'); if(!root||!isReviewer()) return false;
    root.innerHTML=`<div class="kz-join-shell" id="requests"><div class="section-title top"><h2>درخواست‌های عضویت</h2><p>مرکز بررسی درخواست‌ها و گفت‌وگوی تیم با متقاضی‌ها.</p></div><div id="kzAdminRequests"><div class="loading-note">در حال بارگذاری درخواست‌ها...</div></div></div>`;
    const data=await loadAllRequests(); const host=document.getElementById('kzAdminRequests'); if(!host) return true;
    if(data.error){ host.innerHTML='<div class="form-msg err">بارگذاری درخواست‌ها ناموفق بود.</div>'; return true; }
    if(!data.requests.length){ host.innerHTML='<div class="empty-note">هنوز هیچ درخواست عضویتی ثبت نشده.</div>'; return true; }
    let selectedId=data.requests[0].id;
    const render=async()=>{
      const selected=data.requests.find(r=>r.id===selectedId)||data.requests[0]; selectedId=selected.id;
      const acc=data.accounts[selected.account_id]||{};
      const {data:messages,error:me}=await sb.from('team_join_messages').select('*').eq('request_id',selected.id).order('created_at',{ascending:true}); if(me) console.error(me);
      host.innerHTML=`<div class="kz-admin-layout"><aside class="kz-ticket-list"><div class="kz-ticket-list-head"><div><strong>درخواست‌ها</strong><p>${data.requests.length} تیکت</p></div><button class="link-btn" id="kzReqRefresh">↻ بروزرسانی</button></div><div class="kz-list-items">${data.requests.map(r=>{const a=data.accounts[r.account_id]||{};return `<button class="kz-ticket-list-item ${r.id===selected.id?'active':''}" data-request-id="${esc(r.id)}"><span><strong>${esc(applicantName(r,a))}</strong><small>${esc(a.username||r.rubika_id||'')}</small></span><span class="kz-status ${statusClass(r.status)}">${esc(statusText(r.status))}</span></button>`;}).join('')}</div></aside><section class="kz-ticket-detail"><div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${esc(String(selected.id||'').replace(/^req-/,'').slice(-8).toUpperCase())}</div><h2>${esc(applicantName(selected,acc))}</h2><p>${esc(acc.username||'')} · ارسال‌شده در ${esc(fmt(selected.created_at))}</p></div><span class="kz-status ${statusClass(selected.status)}">${esc(statusText(selected.status))}</span></div><div class="kz-admin-actions"><button class="btn primary" data-action="approve">✓ پذیرش</button><button class="btn" data-action="reviewing">در حال بررسی</button><button class="btn" data-action="waiting_applicant">منتظر پاسخ</button><button class="btn kz-danger" data-action="reject">✕ رد درخواست</button><button class="btn" data-action="closed">بستن تیکت</button></div>${requestFields(selected,acc)}<div class="kz-thread"><div class="kz-thread-title"><span>گفت‌وگو</span><small>${messages?.length||0} پیام</small></div>${messages?.length?messages.map(m=>`<article class="kz-message ${m.sender_role==='staff'?'staff':'applicant'}"><div class="kz-message-meta"><strong>${m.sender_role==='staff'?'مدیریت KillZone':esc(applicantName(selected,acc))}</strong><time>${esc(fmt(m.created_at))}</time></div><div class="kz-message-body">${esc(m.message).replace(/\n/g,'<br>')}</div></article>`).join(''):'<div class="kz-empty-thread">هنوز پیامی ثبت نشده.</div>'}</div>${ACTIVE.includes(selected.status)?`<form id="kzStaffReply" class="kz-reply"><label for="kzStaffReplyInput">پیام برای متقاضی</label><textarea id="kzStaffReplyInput" rows="4" required placeholder="پیامت رو برای متقاضی بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzStaffReplyMsg"></div></form>`:''}<div id="kzAdminMsg"></div></section></div>`;
      host.querySelectorAll('.kz-ticket-list-item').forEach(b=>b.addEventListener('click',()=>{selectedId=b.dataset.requestId;render();}));
      const refresh=document.getElementById('kzReqRefresh'); if(refresh) refresh.addEventListener('click',async()=>{const fresh=await loadAllRequests();data.requests=fresh.requests;data.accounts=fresh.accounts;await render();});
      host.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>changeStatus(selected,b.dataset.action)));
      const reply=document.getElementById('kzStaffReply'); if(reply) reply.addEventListener('submit',async e=>{ e.preventDefault(); const input=document.getElementById('kzStaffReplyInput'),msg=document.getElementById('kzStaffReplyMsg'); const text=input.value.trim(); if(!text)return; const {error}=await sb.from('team_join_messages').insert([{id:newMessageId(),request_id:selected.id,account_id:selected.account_id,sender_role:'staff',message:text}]); if(error){console.error(error);msg.innerHTML='<div class="form-msg err">ارسال پیام ناموفق بود.</div>';return;} await render(); });
    };
    async function changeStatus(req,action){
      const newStatus=action==='approve'?'approved':action==='reject'?'rejected':action; const msg=document.getElementById('kzAdminMsg'); if(msg)msg.innerHTML='<div class="form-msg">در حال ذخیره...</div>';
      const {error}=await sb.from('team_join_requests').update({status:newStatus,reviewed_at:newStatus==='approved'||newStatus==='rejected'?new Date().toISOString():null,reviewed_by:window.currentUser.id}).eq('id',req.id);
      if(error){console.error(error);if(msg)msg.innerHTML='<div class="form-msg err">تغییر وضعیت ناموفق بود.</div>';return;}
      const accountUpdate=newStatus==='approved'?{rank:'member',team_status:'approved'}:{team_status:newStatus==='rejected'?'rejected':'reviewing'}; const {error:e2}=await sb.from('accounts').update(accountUpdate).eq('id',req.account_id); if(e2)console.error(e2); await renderAdminPanel();
    }
  }
  async function renderApplicant(){
    const root=document.getElementById('kzJoinApp'); if(!root||!window.currentUser||isReviewer())return;
    const request=await loadLatest();
    if(!request){
      if(window.currentUser.team_status==='approved'){
        root.innerHTML=`<div class="kz-join-shell"><div class="section-title top"><h2>عضویت در KillZone</h2><p>عضویت اکانتت تأیید شده و دسترسی تیم برایت فعال است. 🎉</p></div><div class="approved-note">✓ عضو تأییدشده KillZone هستی.</div></div>`;
        return;
      }
      root.innerHTML=`<div class="kz-join-shell"><div class="section-title top"><h2>درخواست عضویت در KillZone</h2><p>فرم رو کامل کن؛ بعد از ارسال، همین‌جا تیکتت رو دنبال می‌کنی.</p></div>${typeof kzRequestFormHtml==='function'?kzRequestFormHtml():'<p>فرم عضویت در دسترس نیست.</p>'}</div>`; bindForm(root); return;
    }
    const {data:messages}=await sb.from('team_join_messages').select('*').eq('request_id',request.id).order('created_at',{ascending:true});
    root.innerHTML=`<div class="kz-join-shell">${typeof kzTicketHeaderHtml==='function'?kzTicketHeaderHtml(request):''}${typeof kzFormSummaryHtml==='function'?kzFormSummaryHtml(request):''}${typeof kzTicketThreadHtml==='function'?kzTicketThreadHtml(messages||[],request):''}${ACTIVE.includes(request.status)?`<form id="kzJoinReplyFix" class="kz-reply"><label for="kzJoinReplyInput">پیام جدید</label><textarea id="kzJoinReplyInput" rows="4" required placeholder="پیامت رو برای مدیریت بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzJoinReplyMsg"></div></form>`:''}</div>`;
    const reply=document.getElementById('kzJoinReplyFix'); if(reply) reply.addEventListener('submit',async e=>{e.preventDefault();const input=document.getElementById('kzJoinReplyInput'),msg=document.getElementById('kzJoinReplyMsg');const text=input.value.trim();if(!text)return;const {error}=await sb.from('team_join_messages').insert([{id:newMessageId(),request_id:request.id,account_id:window.currentUser.id,sender_role:'applicant',message:text}]);if(error){console.error(error);msg.innerHTML='<div class="form-msg err">ارسال پیام ناموفق بود.</div>';return;}await renderApplicant();});
  }
  function bindForm(root){
    const form=root.querySelector('#kzJoinForm'); if(!form)return;
    form.addEventListener('submit',async e=>{e.preventDefault();if(!window.currentUser){location.reload();return;}const msg=document.getElementById('kzJoinFormMsg');const values=typeof kzRequestFormValues==='function'?kzRequestFormValues(form):{};const errors=typeof kzValidateJoinForm==='function'?kzValidateJoinForm(values):[];if(errors.length){msg.innerHTML=`<div class="form-msg err">${esc(errors.join('<br>'))}</div>`;return;}const {data:existing}=await sb.from('team_join_requests').select('id,status').eq('account_id',window.currentUser.id).in('status',ACTIVE).limit(1);if(existing?.length){await renderApplicant();return;}msg.innerHTML='<div class="form-msg ok">در حال ثبت درخواست...</div>';const payload={id:typeof kzNewId==='function'?kzNewId('req'):'req-'+Date.now(),account_id:window.currentUser.id,status:'reviewing',name:values.first_name,last_name:values.last_name,rubika_id:values.rubika_id,age:values.age,city:values.city,other_games:values.other_games,skill_level:values.skill_level,gaming_years:values.gaming_years,weekly_activity:values.weekly_activity,voice_chat:values.voice_chat,why_join:values.why_join,contribution:values.contribution,conflict_response:values.conflict_response,how_found_us:values.how_found_us,info_confirmed:values.info_confirmed};const {error}=await sb.from('team_join_requests').insert([payload]);if(error){console.error(error);msg.innerHTML='<div class="form-msg err">ثبت درخواست ناموفق بود. دوباره تلاش کن.</div>';return;}const {data:updated}=await sb.from('accounts').update({team_status:'reviewing',rank:'guest'}).eq('id',window.currentUser.id).select('*').maybeSingle();if(updated)window.currentUser=updated;await renderApplicant();});
  }
  async function boot(){
    const root=document.getElementById('kzJoinApp');
    if(!root)return;
    root.dataset.kzJoinBoot='pending';
    try{
      if(typeof sb==='undefined' || typeof initSession!=='function') throw new Error('Join page dependencies are not ready.');
      await initSession();
      if(!window.currentUser){ root.innerHTML='<div class="empty-note">برای مشاهده یا ثبت درخواست، اول وارد اکانتت شو.</div>'; return; }
      if(isReviewer()) await renderAdminPanel(); else await renderApplicant();
      root.dataset.kzJoinBoot='done';
    }catch(error){
      console.error('KillZone join boot failed',error);
      root.dataset.kzJoinBoot='error';
      root.innerHTML='<div class="form-msg err">مرکز درخواست‌ها نتونست بارگذاری بشه. صفحه رو یک‌بار رفرش کن.</div>';
    }
  }
  window.kzRenderJoinPage=async()=>{
    if(!document.getElementById('kzJoinApp'))return false;
    if(typeof sb==='undefined' || typeof initSession!=='function')return false;
    try{
      if(!window.currentUser)await initSession();
      if(!window.currentUser){ document.getElementById('kzJoinApp').innerHTML='<div class="empty-note">برای مشاهده یا ثبت درخواست، اول وارد اکانتت شو.</div>'; return false; }
      return isReviewer()?renderAdminPanel():renderApplicant();
    }catch(error){
      console.error('KillZone join render failed',error);
      document.getElementById('kzJoinApp').innerHTML='<div class="form-msg err">بارگذاری درخواست‌ها ناموفق بود.</div>';
      return false;
    }
  };
  function start(){
    if(!isJoinPage())return;
    boot();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0),{once:true});else setTimeout(start,0);
})();
