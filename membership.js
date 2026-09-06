// KillZone membership workflow — account creation is separate from team membership.
const KZ_PENDING = 'pending';
const KZ_APPROVED = 'approved';
const KZ_ACTIVE_TICKET_STATUSES = ['pending','reviewing','waiting_applicant'];
const KZ_TICKET_STATUS = {
  pending: ['در انتظار بررسی', 'review'],
  reviewing: ['در حال بررسی', 'review'],
  waiting_applicant: ['منتظر پاسخ متقاضی', 'waiting'],
  approved: ['پذیرفته شد', 'approved'],
  rejected: ['رد شد', 'rejected'],
  closed: ['بسته شد', 'closed']
};
function kzIsMember(u){ return !!(u && u.team_status === KZ_APPROVED); }
function kzIsPending(u){ return !!(u && KZ_ACTIVE_TICKET_STATUSES.includes(u.team_status)); }
function kzIsReviewer(u){ return !!(u && ['developer','co_owner','owner'].includes(u.rank)); }
function kzStatusText(status){ return KZ_TICKET_STATUS[status]?.[0] || status || 'نامشخص'; }
function kzStatusClass(status){ return KZ_TICKET_STATUS[status]?.[1] || 'closed'; }
function kzFormatDate(value){ if(!value) return '—'; try{ return new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }catch(e){ return value; } }
function kzNewId(prefix){ return prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,9); }
function kzMembershipButtonHtml(){
  if(!currentUser || kzIsMember(currentUser)) return '';
  if(kzIsPending(currentUser)) return '<a class="admin-btn on" href="join.html">تیکت عضویت ⏳</a>';
  if(currentUser.team_status==='rejected') return '<a class="link-btn" href="join.html">مشاهده درخواست عضویت</a>';
  return '<a class="link-btn" href="join.html">درخواست عضویت</a>';
}
function kzRefreshMembershipUI(){
  const box=document.getElementById('userBox'); if(!box || !currentUser) return;
  const old=box.querySelector('.kz-membership-status'); if(old) old.remove();
  const html=kzMembershipButtonHtml(); if(!html) return;
  const wrap=document.createElement('span'); wrap.className='kz-membership-status'; wrap.innerHTML=html;
  box.insertBefore(wrap,box.querySelector('#logoutBtn'));
}
function kzPatchUserBox(){
  if(typeof renderUserBox!=='function') return;
  const original=renderUserBox;
  window.renderUserBox=function(){ original(); kzRefreshMembershipUI(); };
  renderUserBox();
}
function kzApplyJoinNav(){
  document.querySelectorAll('nav.main').forEach(nav=>{
    if(nav.querySelector('a[href="join.html"]')) return;
    const reg=nav.querySelector('a[href="register.html"]'); if(!reg) return;
    const a=document.createElement('a'); a.href='join.html'; a.textContent='عضویت در تیم'; nav.insertBefore(a,reg);
  });
}
function kzRequestFormValues(form){
  const get=id=>document.getElementById(id)?.value?.trim() || '';
  return { first_name:get('joinFirstName'), last_name:get('joinLastName'), rubika_id:get('joinRubika'), age:get('joinAge') ? Number(get('joinAge')) : null, city:get('joinCity'), other_games:get('joinGames'), skill_level:get('joinSkill'), gaming_years:get('joinYears') ? Number(get('joinYears')) : null, weekly_activity:get('joinActivity'), voice_chat:get('joinVoice'), why_join:get('joinWhy'), contribution:get('joinContribution'), conflict_response:get('joinConflict'), how_found_us:get('joinFound'), info_confirmed:!!document.getElementById('joinInfoConfirmed')?.checked };
}
function kzValidateJoinForm(v){
  const errors=[];
  if(!v.first_name || v.first_name.length<2) errors.push('نام را کامل وارد کن.');
  if(!v.rubika_id) errors.push('آیدی روبیکا را وارد کن.');
  if(v.age!==null && (!Number.isInteger(v.age) || v.age<1 || v.age>100)) errors.push('سن باید یک عدد معتبر باشد.');
  if(v.gaming_years!==null && (!Number.isInteger(v.gaming_years) || v.gaming_years<0 || v.gaming_years>80)) errors.push('مدت بازی کردن معتبر نیست.');
  if(!v.skill_level) errors.push('سطح خودت را انتخاب کن.');
  if(!v.weekly_activity) errors.push('میزان فعالیت هفتگی را انتخاب کن.');
  if(!v.voice_chat) errors.push('وضعیت Voice Chat را انتخاب کن.');
  if(v.why_join.length<15) errors.push('برای «چرا می‌خواهی به KillZone بپیوندی؟» حداقل ۱۵ کاراکتر بنویس.');
  if(v.contribution.length<15) errors.push('بگو چه چیزی می‌توانی به تیم اضافه کنی.');
  if(v.conflict_response.length<15) errors.push('نحوه برخوردت با اختلاف را توضیح بده.');
  if(!v.how_found_us) errors.push('بگو چطور با KillZone آشنا شدی.');
  if(!v.info_confirmed) errors.push('تأیید صحت اطلاعات الزامی است.');
  return errors;
}
async function kzFindLatestMyRequest(){
  if(!currentUser) return null;
  const {data,error}=await sb.from('team_join_requests').select('*').eq('account_id',currentUser.id).order('created_at',{ascending:false}).limit(1);
  if(error){ console.error(error); return null; } return data?.[0] || null;
}
async function kzLoadMessages(requestId){
  const {data,error}=await sb.from('team_join_messages').select('*').eq('request_id',requestId).order('created_at',{ascending:true});
  if(error){ console.error(error); return {data:[],error}; } return {data:data||[],error:null};
}
function kzMessageHtml(m,request){
  const isAdmin=m.sender_role==='staff'; const sender=isAdmin?'مدیریت KillZone':(request?.first_name||request?.accounts?.username||'متقاضی');
  return `<article class="kz-message ${isAdmin?'staff':'applicant'}"><div class="kz-message-meta"><strong>${escapeHtml(sender)}</strong><time>${escapeHtml(kzFormatDate(m.created_at))}</time></div><div class="kz-message-body">${escapeHtml(m.message).replace(/\n/g,'<br>')}</div></article>`;
}
function kzRequestFormHtml(){
  return `<form id="kzJoinForm" class="kz-join-form">
    <div class="kz-form-section"><div class="kz-form-kicker">01 // اطلاعات پایه</div><h3>اول با خودت آشنا بشیم</h3><div class="kz-form-grid">
      <div class="field"><label for="joinFirstName">نام *</label><input id="joinFirstName" required maxlength="40" autocomplete="given-name"></div>
      <div class="field"><label for="joinLastName">نام خانوادگی</label><input id="joinLastName" maxlength="60" autocomplete="family-name"></div>
      <div class="field"><label>نام کاربری</label><input value="${escapeHtml(currentUser?.username||'')}" disabled></div>
      <div class="field"><label for="joinRubika">آیدی روبیکا *</label><input id="joinRubika" required maxlength="80" placeholder="@username یا آیدی شما"></div>
      <div class="field"><label for="joinAge">سن</label><input id="joinAge" type="number" min="1" max="100" inputmode="numeric"></div>
      <div class="field"><label for="joinCity">شهر</label><input id="joinCity" maxlength="60" autocomplete="address-level2" placeholder="مثلاً اراک"></div>
    </div></div>
    <div class="kz-form-section"><div class="kz-form-kicker">02 // پروفایل گیمینگ</div><h3>سبک بازی و فعالیتت</h3><div class="kz-form-grid">
      <div class="field"><label for="joinGames">در چه بازی‌هایی فعالیت داری؟</label><textarea id="joinGames" maxlength="600" placeholder="مثلاً Minecraft، COD، Valorant... "></textarea></div>
      <div class="field"><label for="joinSkill">سطح خودت در بازی‌هات را چطور ارزیابی می‌کنی؟ *</label><select id="joinSkill" required><option value="">انتخاب کن</option><option>تازه‌کار</option><option>متوسط</option><option>حرفه‌ای</option><option>خیلی حرفه‌ای</option></select></div>
      <div class="field"><label for="joinYears">چند سال است که بازی می‌کنی؟</label><input id="joinYears" type="number" min="0" max="80" inputmode="numeric"></div>
      <div class="field"><label for="joinActivity">معمولاً در هفته چقدر بازی می‌کنی؟ *</label><select id="joinActivity" required><option value="">انتخاب کن</option><option>کمتر از ۵ ساعت</option><option>۵ تا ۱۰ ساعت</option><option>۱۰ تا ۲۰ ساعت</option><option>بیشتر از ۲۰ ساعت</option></select></div>
      <div class="field"><label for="joinVoice">میکروفون / امکان استفاده از Voice Chat داری؟ *</label><select id="joinVoice" required><option value="">انتخاب کن</option><option>بله</option><option>خیر</option><option>گاهی</option></select></div>
    </div></div>
    <div class="kz-form-section"><div class="kz-form-kicker">03 // خودت و KillZone</div><h3>بیشتر از خودت بگو</h3><div class="kz-form-stack">
      <div class="field"><label for="joinWhy">چرا می‌خواهی به KillZone بپیوندی؟ *</label><textarea id="joinWhy" required minlength="15" maxlength="1200" rows="5" placeholder="واقعی و خودمونی بنویس..."></textarea></div>
      <div class="field"><label for="joinContribution">چه مهارت یا کمکی می‌توانی به تیم اضافه کنی؟ *</label><textarea id="joinContribution" required minlength="15" maxlength="1200" rows="5" placeholder="مثلاً مهارت گیم، ساخت‌وساز، مدیریت، طراحی، تولید محتوا و..."></textarea></div>
      <div class="field"><label for="joinConflict">اگر بین تو و یکی از اعضای تیم اختلافی پیش بیاید، چطور حلش می‌کنی؟ *</label><textarea id="joinConflict" required minlength="15" maxlength="1200" rows="5"></textarea></div>
      <div class="field"><label for="joinFound">چطور با KillZone آشنا شدی؟ *</label><select id="joinFound" required><option value="">انتخاب کن</option><option>دوست یا عضو تیم</option><option>روبیکا</option><option>سایت KillZone</option><option>داخل بازی</option><option>شبکه‌های اجتماعی</option><option>سایر</option></select></div>
    </div></div>
    <div class="kz-form-section"><div class="kz-form-kicker">04 // تأیید</div><h3>آخرش فقط یک تأیید</h3><label class="kz-check"><input id="joinInfoConfirmed" type="checkbox" required><span>تأیید می‌کنم اطلاعاتی که در این فرم وارد کردم واقعی و متعلق به خودم است.</span></label></div>
    <div class="kz-submit-row"><button type="submit" class="btn primary">ثبت درخواست عضویت</button><div id="kzJoinFormMsg" aria-live="polite"></div></div>
  </form>`;
}
function kzTicketHeaderHtml(r){ const number=r?.id?r.id.replace(/^req-/,'').slice(-8).toUpperCase():'--------'; return `<div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${escapeHtml(number)}</div><h2>درخواست عضویت در KillZone</h2><p>ارسال‌شده در ${escapeHtml(kzFormatDate(r?.created_at))}</p></div><span class="kz-status ${kzStatusClass(r?.status)}">${escapeHtml(kzStatusText(r?.status))}</span></div>`; }
function kzFormSummaryHtml(r){ const rows=[['نام',r.first_name],['نام خانوادگی',r.last_name],['نام کاربری',r.accounts?.username||currentUser?.username],['آیدی روبیکا',r.rubika_id],['سن',r.age],['شهر',r.city],['بازی‌ها',r.other_games],['سطح',r.skill_level],['سابقه بازی',r.gaming_years!=null?`${r.gaming_years} سال`:'' ],['فعالیت هفتگی',r.weekly_activity],['Voice Chat',r.voice_chat],['چرا KillZone؟',r.why_join],['چه چیزی اضافه می‌کنی؟',r.contribution],['اگر اختلاف پیش بیاد؟',r.conflict_response],['نحوه آشنایی',r.how_found_us]]; return `<div class="kz-dossier"><div class="kz-dossier-title">پرونده متقاضی</div>${rows.map(([label,value])=>`<div class="kz-dossier-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value||'—')}</strong></div>`).join('')}</div>`; }
function kzTicketThreadHtml(messages,r){ return `<div class="kz-thread"><div class="kz-thread-title"><span>گفت‌وگوی درخواست</span><small>${messages.length} پیام</small></div>${messages.length?messages.map(m=>kzMessageHtml(m,r)).join(''):'<div class="kz-empty-thread">هنوز پیامی در این درخواست ثبت نشده.</div>'}</div>`; }
function kzTicketReplyHtml(canReply){ if(!canReply)return ''; return `<form id="kzReplyForm" class="kz-reply"><label for="kzReplyInput">پیام جدید</label><textarea id="kzReplyInput" maxlength="1800" rows="4" placeholder="پیامت را بنویس..."></textarea><div class="kz-reply-footer"><span>گفت‌وگو مستقیم داخل تیکت ثبت می‌شود.</span><button class="btn primary" type="submit">ارسال پیام</button></div><div id="kzReplyMsg" aria-live="polite"></div></form>`; }
async function kzSendMessage(request,text){
  const clean=(text||'').trim(); if(!clean||clean.length<2)return{ok:false,msg:'پیام خالیه.'};
  const staff=kzIsReviewer(currentUser);
  const {error}=await sb.from('team_join_messages').insert([{id:kzNewId('msg'),request_id:request.id,account_id:currentUser.id,sender_role:staff?'staff':'applicant',message:clean}]);
  if(error){console.error(error);return{ok:false,msg:'ارسال پیام ناموفق بود.'};}
  if(['approved','rejected','closed'].includes(request.status))return{ok:true};
  const {error:statusError}=await sb.from('team_join_requests').update({status:staff?'waiting_applicant':'reviewing'}).eq('id',request.id); if(statusError)console.error(statusError);
  return{ok:true};
}
async function kzSubmitJoinForm(form){
  if(!currentUser)return;
  const msg=document.getElementById('kzJoinFormMsg'); const values=kzRequestFormValues(form); const errors=kzValidateJoinForm(values);
  if(errors.length){msg.innerHTML=`<div class="form-msg err">${escapeHtml(errors[0])}</div>`;return;}
  const latest=await kzFindLatestMyRequest(); if(latest&&KZ_ACTIVE_TICKET_STATUSES.includes(latest.status)){location.href='join.html';return;}
  const payload={id:kzNewId('req'),account_id:currentUser.id,status:'reviewing',message:'',...values};
  const {data,error}=await sb.from('team_join_requests').insert([payload]).select('*').maybeSingle();
  if(error){console.error(error);msg.innerHTML='<div class="form-msg err">ثبت درخواست ناموفق بود. دوباره تلاش کن.</div>';return;}
  const {error:accError}=await sb.from('accounts').update({team_status:'reviewing'}).eq('id',currentUser.id); if(accError)console.error(accError);
  currentUser.team_status='reviewing'; msg.innerHTML='<div class="form-msg ok">درخواستت ثبت شد. الان وارد تیکتت می‌شیم. 🎫</div>'; renderUserBox(); kzRefreshMembershipUI(); setTimeout(()=>kzRenderJoinPage(data||payload),250);
}
async function kzRenderMyView(root){
  const request=await kzFindLatestMyRequest();
  if(request&&KZ_ACTIVE_TICKET_STATUSES.includes(request.status)){ const {data:messages}=await kzLoadMessages(request.id); root.innerHTML=`<div class="kz-view-head"><div><div class="section-title top"><h2>تیکت عضویت من</h2><p>اینجا گفت‌وگوی تو با مدیریت KillZone ادامه پیدا می‌کنه.</p></div></div></div><section class="kz-ticket panelish">${kzTicketHeaderHtml(request)}${kzFormSummaryHtml(request)}${kzTicketThreadHtml(messages,request)}${kzTicketReplyHtml(true)}</section>`; kzWireReply(root,request); return; }
  if(request&&request.status==='approved'){ const {data:messages}=await kzLoadMessages(request.id); root.innerHTML=`<div class="section-title top"><h2>عضویت تأیید شد 🎉</h2><p>به KillZone خوش اومدی. تیکتت برای سابقه درخواست نگه داشته شده.</p></div><section class="kz-ticket panelish">${kzTicketHeaderHtml(request)}${kzFormSummaryHtml(request)}${kzTicketThreadHtml(messages,request)}</section>`; return; }
  if(request&&request.status==='rejected'){ const {data:messages}=await kzLoadMessages(request.id); root.innerHTML=`<div class="section-title top"><h2>درخواست قبلی رد شده</h2><p>گفت‌وگوی قبلی را ببین یا یک درخواست تازه ثبت کن.</p></div><section class="kz-ticket panelish kz-rejected-ticket">${kzTicketHeaderHtml(request)}${kzFormSummaryHtml(request)}${kzTicketThreadHtml(messages,request)}</section><div class="kz-new-request-wrap"><button class="btn primary" id="kzNewRequestBtn">ثبت درخواست جدید</button></div>`; root.querySelector('#kzNewRequestBtn').addEventListener('click',()=>{root.innerHTML=kzRequestFormHtml();kzWireJoinForm(root);}); return; }
  root.innerHTML=`<div class="section-title top"><h2>درخواست عضویت در KillZone</h2><p>قبل از ورود به تیم، چند سؤال کوتاه داریم تا باهات آشنا بشیم.</p></div>${kzRequestFormHtml()}`; kzWireJoinForm(root);
}
async function kzRenderAdminList(root){
  const list=document.createElement('div'); list.className='kz-admin-layout'; list.innerHTML='<aside class="kz-ticket-list"><div class="kz-ticket-list-head"><div><div class="kz-eyebrow">STAFF // APPLICATIONS</div><h3>درخواست‌ها</h3></div><span class="kz-list-count">…</span></div><div class="kz-list-items">در حال بارگذاری...</div></aside><section class="kz-admin-detail" id="kzAdminDetail"><div class="kz-admin-placeholder">یک درخواست را از لیست انتخاب کن.</div></section>';
  root.innerHTML='<div class="section-title top"><h2>مرکز درخواست‌های عضویت</h2><p>فقط Developer، Co-Owner و Owner به این بخش دسترسی دارند.</p></div>'; root.appendChild(list);
  const {data,error}=await sb.from('team_join_requests').select('*,accounts(username,photo,rank)').order('created_at',{ascending:false}); if(error){list.querySelector('.kz-list-items').innerHTML='<div class="form-msg err">خطا در بارگذاری درخواست‌ها.</div>';return;}
  const items=list.querySelector('.kz-list-items'); list.querySelector('.kz-list-count').textContent=data?.length||0; if(!data?.length){items.innerHTML='<div class="kz-list-empty">درخواستی ثبت نشده.</div>';return;}
  items.innerHTML=''; data.forEach(r=>{ const btn=document.createElement('button'); btn.type='button'; btn.className='kz-ticket-list-item'; btn.dataset.id=r.id; btn.innerHTML=`<span class="kz-list-status ${kzStatusClass(r.status)}"></span><span class="kz-list-copy"><strong>${escapeHtml(r.first_name||r.accounts?.username||'بدون نام')}</strong><small>@${escapeHtml(r.accounts?.username||'—')} · ${escapeHtml(kzStatusText(r.status))}</small></span><time>${escapeHtml(kzFormatDate(r.created_at))}</time>`; btn.addEventListener('click',()=>kzOpenAdminTicket(r,list)); items.appendChild(btn); }); kzOpenAdminTicket(data[0],list);
}
async function kzOpenAdminTicket(request,listRoot){
  listRoot.querySelectorAll('.kz-ticket-list-item').forEach(x=>x.classList.toggle('active',x.dataset.id===request.id)); const detail=listRoot.querySelector('#kzAdminDetail'); detail.innerHTML='<div class="kz-admin-placeholder">در حال بارگذاری تیکت...</div>'; const {data:messages}=await kzLoadMessages(request.id);
  detail.innerHTML=`<section class="kz-ticket panelish">${kzTicketHeaderHtml(request)}${kzFormSummaryHtml(request)}${kzTicketThreadHtml(messages,request)}<div class="kz-admin-actions"><button class="btn primary" id="kzApproveBtn" ${request.status==='approved'?'disabled':''}>تأیید عضویت</button><button class="btn danger" id="kzRejectBtn" ${request.status==='rejected'?'disabled':''}>رد درخواست</button></div>${kzTicketReplyHtml(!['approved','rejected','closed'].includes(request.status))}</section>`;
  detail.querySelector('#kzApproveBtn')?.addEventListener('click',()=>kzReviewTicket(request,'approved',listRoot)); detail.querySelector('#kzRejectBtn')?.addEventListener('click',()=>kzReviewTicket(request,'rejected',listRoot)); kzWireReply(detail,request);
}
async function kzReviewTicket(request,decision,listRoot){
  if(!kzIsReviewer(currentUser))return; const next=decision==='approved'?'approved':'rejected';
  const {error:reqError}=await sb.from('team_join_requests').update({status:next,reviewed_at:new Date().toISOString(),reviewed_by:currentUser.id}).eq('id',request.id); if(reqError){console.error(reqError);return;}
  const {error:accError}=await sb.from('accounts').update({team_status:next}).eq('id',request.account_id); if(accError)console.error(accError); request.status=next; kzOpenAdminTicket(request,listRoot);
}
function kzWireReply(scope,request){
  const form=scope.querySelector('#kzReplyForm'); if(!form)return; form.addEventListener('submit',async e=>{ e.preventDefault(); const input=form.querySelector('#kzReplyInput'),msg=form.querySelector('#kzReplyMsg'),text=input.value.trim(); if(!text){msg.innerHTML='<div class="form-msg err">پیام رو بنویس.</div>';return;} form.querySelector('button').disabled=true; const res=await kzSendMessage(request,text); form.querySelector('button').disabled=false; if(!res.ok){msg.innerHTML=`<div class="form-msg err">${escapeHtml(res.msg)}</div>`;return;} input.value=''; msg.innerHTML='<div class="form-msg ok">پیام ارسال شد.</div>'; const parent=scope.closest('.kz-ticket'); if(parent){const loaded=await kzLoadMessages(request.id); const thread=parent.querySelector('.kz-thread'); if(thread)thread.outerHTML=kzTicketThreadHtml(loaded.data,request); const {data:latest}=await sb.from('team_join_requests').select('status,reviewed_at').eq('id',request.id).maybeSingle(); if(latest)request.status=latest.status; const head=parent.querySelector('.kz-ticket-head'); if(head)head.outerHTML=kzTicketHeaderHtml(request);} if(document.querySelector('.kz-admin-layout'))kzRenderAdminList(document.getElementById('kzJoinApp')); });
}
function kzWireJoinForm(scope){ const form=scope.querySelector('#kzJoinForm'); if(!form)return; form.addEventListener('submit',e=>{e.preventDefault(); kzSubmitJoinForm(form);}); }
async function kzRenderJoinPage(){
  const root=document.getElementById('kzJoinApp'); if(!root)return;
  if(!currentUser){ root.innerHTML='<div class="section-title top"><h2>برای درخواست باید وارد شوی</h2><p>اول وارد اکانتت شو؛ بعد فرم عضویت در تیم را پر می‌کنی.</p></div><div class="panel kz-login-gate"><div class="kz-gate-icon">🔒</div><h3>حساب کاربری لازمه</h3><p>اکانت داری؟ از دکمه ورود بالای صفحه استفاده کن. هنوز اکانت نداری؟ اول ثبت‌نام کن.</p><div class="kz-gate-actions"><button class="btn primary" id="kzJoinLoginBtn">ورود</button><a class="btn ghost" href="register.html">ساخت اکانت</a></div></div>'; root.querySelector('#kzJoinLoginBtn').addEventListener('click',()=>document.getElementById('loginOpenBtn')?.click()); return; }
  if(kzIsReviewer(currentUser)){await kzRenderAdminList(root);return;}
  if(kzIsMember(currentUser)){root.innerHTML='<div class="section-title top"><h2>تو همین حالا عضو KillZone هستی 👑</h2><p>برای مدیریت اطلاعاتت از صفحه اعضا استفاده کن.</p></div><a class="btn primary" href="members.html">مشاهده اعضا</a>';return;}
  await kzRenderMyView(root);
}

document.addEventListener('submit',async e=>{
  const form=e.target; if(!form||form.id!=='regForm')return; e.preventDefault(); e.stopImmediatePropagation();
  const username=document.getElementById('regName').value.trim(),pass=document.getElementById('regPass').value,pass2=document.getElementById('regPass2').value,games=getCheckedGames('regGamesBox'),msg=document.getElementById('regMsg');
  if(!username||username.length<3){msg.innerHTML='<div class="form-msg err">نام‌کاربری باید حداقل ۳ کاراکتر باشه.</div>';return;} if(pass.length<4){msg.innerHTML='<div class="form-msg err">رمز باید حداقل ۴ کاراکتر باشه.</div>';return;} if(pass!==pass2){msg.innerHTML='<div class="form-msg err">تکرار رمز مطابقت نداره.</div>';return;}
  const {data:existing}=await sb.from('accounts').select('id').ilike('username',username).maybeSingle(); if(existing){msg.innerHTML='<div class="form-msg err">این نام‌کاربری قبلاً گرفته شده.</div>';return;}
  const acc={id:'m-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),username,pass_hash:await hashPass(pass),rank:'new_member',game:games.join('، '),photo:regPhotoUrl||'',is_admin:false,team_status:'none'};
  const {error}=await sb.from('accounts').insert([acc]); if(error){console.error(error);msg.innerHTML='<div class="form-msg err">خطا در ثبت‌نام. دوباره تلاش کن.</div>';return;}
  currentUser=acc;saveSession(acc);form.reset();regPhotoUrl='';msg.innerHTML='<div class="form-msg ok">اکانت ساخته شد! حالا از «عضویت در تیم» فرم درخواستت رو پر کن. 🎫</div>';renderUserBox();kzRefreshMembershipUI();
},true);

document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ kzApplyJoinNav(); kzPatchUserBox(); if(document.getElementById('membersContainer')&&typeof renderMembersPage==='function')renderMembersPage(); if(document.getElementById('statMembers'))sb.from('accounts').select('*',{count:'exact',head:true}).eq('team_status','approved').then(({count})=>{document.getElementById('statMembers').textContent=count??0;}); if(document.getElementById('kzJoinApp'))kzRenderJoinPage(); },0));
