// KillZone join-page session fix — renders the applicant view after the account session is restored.
(function(){
  const ACTIVE=['pending','reviewing','waiting_applicant'];
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'');
  const fmt=v=>typeof kzFormatDate==='function'?kzFormatDate(v):v;
  const statusText=v=>typeof kzStatusText==='function'?kzStatusText(v):v;
  const statusClass=v=>typeof kzStatusClass==='function'?kzStatusClass(v):'closed';

  async function loadLatest(){
    if(!window.currentUser) return null;
    const {data,error}=await sb.from('team_join_requests').select('*').eq('account_id',currentUser.id).order('created_at',{ascending:false}).limit(1);
    if(error){ console.error(error); return null; }
    return data?.[0]||null;
  }

  async function renderApplicant(){
    const root=document.getElementById('kzJoinApp');
    if(!root || !window.currentUser || (typeof kzIsReviewer==='function' && kzIsReviewer(currentUser))) return;
    const request=await loadLatest();
    if(!request){
      root.innerHTML=`<div class="kz-join-shell"><div class="section-title top"><h2>درخواست عضویت در KillZone</h2><p>فرم رو کامل کن؛ بعد از ارسال، همین‌جا تیکتت رو دنبال می‌کنی.</p></div>${typeof kzRequestFormHtml==='function'?kzRequestFormHtml():'<p>فرم عضویت در دسترس نیست.</p>'}</div>`;
      bindForm(root); return;
    }
    const {data:messages}=await sb.from('team_join_messages').select('*').eq('request_id',request.id).order('created_at',{ascending:true});
    root.innerHTML=`<div class="kz-join-shell">${typeof kzTicketHeaderHtml==='function'?kzTicketHeaderHtml(request):''}${typeof kzFormSummaryHtml==='function'?kzFormSummaryHtml(request):''}${typeof kzTicketThreadHtml==='function'?kzTicketThreadHtml(messages||[],request):''}${ACTIVE.includes(request.status)?`<form id="kzJoinReplyFix" class="kz-reply"><label for="kzJoinReplyInput">پیام جدید</label><textarea id="kzJoinReplyInput" rows="4" maxlength="2000" required placeholder="پیامت رو برای مدیریت بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzJoinReplyMsg"></div></form>`:''}</div>`;
    const reply=document.getElementById('kzJoinReplyFix');
    if(reply) reply.addEventListener('submit',async e=>{
      e.preventDefault();
      const input=document.getElementById('kzJoinReplyInput'), msg=document.getElementById('kzJoinReplyMsg');
      const text=input.value.trim(); if(!text) return;
      const {error}=await sb.from('team_join_messages').insert([{request_id:request.id,account_id:currentUser.id,sender_role:'applicant',message:text}]);
      if(error){ console.error(error); msg.innerHTML='<div class="form-msg err">ارسال پیام ناموفق بود.</div>'; return; }
      await renderApplicant();
    });
  }

  function bindForm(root){
    const form=root.querySelector('#kzJoinForm'); if(!form) return;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!window.currentUser){ location.reload(); return; }
      const msg=document.getElementById('kzJoinFormMsg');
      const values=typeof kzRequestFormValues==='function'?kzRequestFormValues(form):{};
      const errors=typeof kzValidateJoinForm==='function'?kzValidateJoinForm(values):[];
      if(errors.length){ msg.innerHTML=`<div class="form-msg err">${esc(errors.join('<br>'))}</div>`; return; }
      const {data:existing}=await sb.from('team_join_requests').select('id,status').eq('account_id',currentUser.id).in('status',ACTIVE).limit(1);
      if(existing?.length){ await renderApplicant(); return; }
      msg.innerHTML='<div class="form-msg ok">در حال ثبت درخواست...</div>';
      const payload={
        id:typeof kzNewId==='function'?kzNewId('req'):'req-'+Date.now(),
        account_id:currentUser.id,status:'reviewing',
        name:values.first_name,last_name:values.last_name,rubika_id:values.rubika_id,age:values.age,city:values.city,
        other_games:values.other_games,skill_level:values.skill_level,gaming_years:values.gaming_years,weekly_activity:values.weekly_activity,
        voice_chat:values.voice_chat,why_join:values.why_join,contribution:values.contribution,conflict_response:values.conflict_response,
        how_found_us:values.how_found_us,info_confirmed:values.info_confirmed
      };
      const {error}=await sb.from('team_join_requests').insert([payload]);
      if(error){ console.error(error); msg.innerHTML='<div class="form-msg err">ثبت درخواست ناموفق بود. دوباره تلاش کن.</div>'; return; }
      const {data:updated}=await sb.from('accounts').update({team_status:'reviewing'}).eq('id',currentUser.id).select('*').maybeSingle();
      if(updated) window.currentUser=updated;
      await renderApplicant();
    });
  }

  async function boot(){
    if(!document.getElementById('kzJoinApp')) return;
    // app.js owns the canonical session; wait for it, then force the join view to use that session.
    if(typeof initSession==='function') await initSession();
    if(window.currentUser && !(typeof kzIsReviewer==='function' && kzIsReviewer(currentUser))) await renderApplicant();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true}); else setTimeout(boot,0);
})();
