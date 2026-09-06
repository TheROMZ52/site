// KillZone membership workflow — account creation is separate from team membership.
const KZ_PENDING = 'pending';
const KZ_APPROVED = 'approved';

function kzIsMember(u){ return !!(u && u.team_status === KZ_APPROVED); }
function kzIsPending(u){ return !!(u && u.team_status === KZ_PENDING); }

async function kzRequestMembership(){
  if(!currentUser || kzIsMember(currentUser)) return;
  const { data: existing, error: findError } = await sb.from('team_join_requests').select('id,status').eq('account_id', currentUser.id).eq('status','pending').maybeSingle();
  if(findError){ console.error(findError); alert('خطا در بررسی درخواست.'); return; }
  if(existing){ currentUser.team_status='pending'; kzRefreshMembershipUI(); alert('درخواستت قبلاً ارسال شده. ⏳'); return; }
  const req = { id:'req-'+Date.now()+'-'+Math.random().toString(36).slice(2,8), account_id:currentUser.id, status:'pending', message:'' };
  const { error } = await sb.from('team_join_requests').insert([req]);
  if(error){ console.error(error); alert('ارسال درخواست ناموفق بود. دوباره تلاش کن.'); return; }
  const { error: accError } = await sb.from('accounts').update({team_status:'pending'}).eq('id',currentUser.id);
  if(accError) console.error(accError);
  currentUser.team_status='pending'; kzRefreshMembershipUI();
  alert('درخواست عضویتت با موفقیت ارسال شد. منتظر بررسی مدیریت بمون. ⏳');
}

function kzMembershipButtonHtml(){
  if(!currentUser || isStaff(currentUser)) return '';
  if(kzIsMember(currentUser)) return '<span class="admin-btn on">عضو تیم ✔</span>';
  if(kzIsPending(currentUser)) return '<span class="admin-btn on">درخواست در حال بررسی ⏳</span>';
  if(currentUser.team_status==='rejected') return '<button class="link-btn" id="kzJoinBtn">ارسال دوباره درخواست</button>';
  return '<button class="link-btn" id="kzJoinBtn">درخواست عضویت</button>';
}

function kzRefreshMembershipUI(){
  const box=document.getElementById('userBox'); if(!box || !currentUser) return;
  const old=box.querySelector('.kz-membership-status'); if(old) old.remove();
  const html=kzMembershipButtonHtml(); if(!html) return;
  const wrap=document.createElement('span'); wrap.className='kz-membership-status'; wrap.innerHTML=html;
  const el=wrap.firstElementChild; box.insertBefore(wrap,box.querySelector('#logoutBtn'));
  if(el && el.id==='kzJoinBtn') el.addEventListener('click',kzRequestMembership);
}

function kzPatchUserBox(){
  if(typeof renderUserBox!=='function') return;
  const original=renderUserBox;
  window.renderUserBox=function(){ original(); kzRefreshMembershipUI(); };
  renderUserBox();
}

async function kzRenderMembersPage(){
  const container=document.getElementById('membersContainer'); if(!container) return;
  container.innerHTML='<div class="loading-note">در حال بارگذاری اعضای تیم...</div>';
  const {data:accounts,error}=await sb.from('accounts').select('*').eq('team_status','approved').order('username');
  if(error){ console.error(error); container.innerHTML='<div class="empty-note">خطا در بارگذاری اعضا.</div>'; return; }
  container.innerHTML=''; const staff=isStaff(currentUser);
  if(!accounts?.length) container.innerHTML='<div class="empty-note">هنوز عضو تأییدشده‌ای وجود نداره.</div>';
  else{
    const orderHighToLow=[...RANKS].map(r=>r.key).reverse();
    orderHighToLow.forEach(rankKey=>{
      const group=accounts.filter(a=>a.rank===rankKey); if(!group.length) return;
      const sec=document.createElement('div'); sec.className='rank-section';
      sec.innerHTML=`<div class="rank-heading"><span class="tier">${rankChevrons(rankKey)}</span><h3>${escapeHtml(rankLabel(rankKey))}</h3><div class="rule"></div></div>`;
      const grid=document.createElement('div'); grid.className='member-grid';
      group.forEach(m=>grid.appendChild(buildMemberCard(m,staff,accounts)));
      sec.appendChild(grid); container.appendChild(sec);
    });
  }
  const addBtn=document.getElementById('addMemberBtn'); if(addBtn) addBtn.style.display=staff?'inline-block':'none';
  if(staff) kzRenderRequestsPanel();
}

async function kzRenderRequestsPanel(){
  const panel=document.getElementById('kzRequestsPanel'); if(!panel || !isStaff(currentUser)) return;
  panel.innerHTML='<div class="loading-note">در حال بارگذاری درخواست‌ها...</div>';
  const {data,error}=await sb.from('team_join_requests').select('id,account_id,status,message,created_at,accounts(username,photo,game,rank)').eq('status','pending').order('created_at',{ascending:false});
  if(error){ console.error(error); panel.innerHTML='<div class="form-msg err">خطا در بارگذاری درخواست‌ها.</div>'; return; }
  if(!data?.length){ panel.innerHTML='<div class="empty-note">درخواست عضویت جدیدی نیست. ✔</div>'; return; }
  panel.innerHTML='<div class="rank-heading"><span class="tier">▲</span><h3>درخواست‌های عضویت</h3><div class="rule"></div></div>';
  const grid=document.createElement('div'); grid.className='member-grid';
  data.forEach(r=>{
    const a=r.accounts||{}; const card=document.createElement('div'); card.className='member-tile';
    card.innerHTML=`${a.photo?`<img class="avatar" src="${escapeHtml(a.photo)}" alt="${escapeHtml(a.username||'')}">`:`<div class="avatar">${initials(a.username||'?')}</div>`}<h4>${escapeHtml(a.username||'اکانت حذف‌شده')}</h4><div class="rank-badge"><span class="tier">${rankChevrons(a.rank||'new_member')}</span> ${escapeHtml(rankLabel(a.rank||'new_member'))}</div><div class="game-tag">${escapeHtml(a.game||'—')}</div><div class="member-actions"><button class="icon-btn edit kz-approve">تأیید ✔</button><button class="icon-btn del kz-reject">رد ✕</button></div>`;
    card.querySelector('.kz-approve').addEventListener('click',()=>kzReviewRequest(r,'approved'));
    card.querySelector('.kz-reject').addEventListener('click',()=>kzReviewRequest(r,'rejected'));
    grid.appendChild(card);
  });
  panel.appendChild(grid);
}

async function kzReviewRequest(req,decision){
  if(!isStaff(currentUser)) return;
  const account=req.accounts||{}; const label=decision==='approved'?'تأیید':'رد';
  if(!confirm(`درخواست ${account.username||''} ${label} بشه؟`)) return;
  const {error:reqError}=await sb.from('team_join_requests').update({status:decision,reviewed_at:new Date().toISOString(),reviewed_by:currentUser.id}).eq('id',req.id).eq('status','pending');
  if(reqError){ console.error(reqError); alert('خطا در ثبت تصمیم.'); return; }
  const {error:accError}=await sb.from('accounts').update({team_status:decision==='approved'?'approved':'rejected'}).eq('id',req.account_id);
  if(accError){ console.error(accError); alert('درخواست ثبت شد ولی وضعیت اکانت کامل به‌روزرسانی نشد.'); }
  kzRenderRequestsPanel(); kzRenderMembersPage();
}

// Capture registration before the old app.js handler so new accounts never become team members automatically.
document.addEventListener('submit',async e=>{
  const form=e.target; if(!form || form.id!=='regForm') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const username=document.getElementById('regName').value.trim(), pass=document.getElementById('regPass').value, pass2=document.getElementById('regPass2').value;
  const games=getCheckedGames('regGamesBox'), msg=document.getElementById('regMsg');
  if(!username||username.length<3){msg.innerHTML='<div class="form-msg err">نام‌کاربری باید حداقل ۳ کاراکتر باشه.</div>';return;}
  if(pass.length<4){msg.innerHTML='<div class="form-msg err">رمز باید حداقل ۴ کاراکتر باشه.</div>';return;}
  if(pass!==pass2){msg.innerHTML='<div class="form-msg err">تکرار رمز مطابقت نداره.</div>';return;}
  const {data:existing}=await sb.from('accounts').select('id').ilike('username',username).maybeSingle();
  if(existing){msg.innerHTML='<div class="form-msg err">این نام‌کاربری قبلاً گرفته شده.</div>';return;}
  const acc={id:'m-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),username,pass_hash:await hashPass(pass),rank:'new_member',game:games.join('، '),photo:regPhotoUrl||'',is_admin:false,team_status:'none'};
  const {error}=await sb.from('accounts').insert([acc]);
  if(error){console.error(error);msg.innerHTML='<div class="form-msg err">خطا در ثبت‌نام. دوباره تلاش کن.</div>';return;}
  currentUser=acc; saveSession(acc); form.reset(); regPhotoUrl='';
  msg.innerHTML='<div class="form-msg ok">اکانت ساخته شد! برای ورود به تیم، بعد از ورود روی «درخواست عضویت» بزن. ⏳</div>';
  renderUserBox(); kzRefreshMembershipUI();
},true);

document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  if(typeof renderMembersPage==='function') window.renderMembersPage=kzRenderMembersPage;
  kzPatchUserBox();
  if(document.getElementById('membersContainer')) kzRenderMembersPage();
  if(document.getElementById('statMembers')) sb.from('accounts').select('*',{count:'exact',head:true}).eq('team_status','approved').then(({count})=>{document.getElementById('statMembers').textContent=count??0;});
},0));
