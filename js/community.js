// Designed & developed by TheROMZ52 for KillZone Team — 2026
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const initials=name=>(String(name||'?').trim().slice(0,2)||'?').toUpperCase();
  const dateFa=v=>{try{return new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(v));}catch{return '';}};
  const categoryLabel=k=>({announcement:'اطلاعیه',news:'خبر',event:'رویداد'})[k]||'خبر';
  const staff=()=>typeof currentUser!=='undefined'&&currentUser&&typeof isStaff==='function'&&isStaff(currentUser);
  const safeUrl=raw=>{try{const u=new URL(String(raw||'').trim());return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};

  async function getAccounts(){
    const {data,error}=await sb.from('accounts').select('id,username,photo,game,bio,social,joined_at,team_status').eq('team_status','approved').order('username');
    if(error){console.error('members',error);return [];} return data||[];
  }
  async function getAchievements(accountId){
    const {data,error}=await sb.from('achievements').select('id,title,description,icon,awarded_at').eq('account_id',accountId).order('awarded_at',{ascending:false});
    if(error){console.error('achievements',error);return [];} return data||[];
  }
  function avatar(m,large){const cls=large?'kz-profile-large-avatar':'kz-profile-avatar';return m.photo?`<img class="${cls}" src="${esc(m.photo)}" alt="${esc(m.username)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=\"${cls}\">${esc(initials(m.username))}</div>'">`:`<div class="${cls}">${esc(initials(m.username))}</div>`;}

  async function renderMembers(){
    const container=document.getElementById('membersCommunityContainer'); if(!container)return;
    const add=document.getElementById('addMemberBtn');
    if(add){
      add.style.display=staff()?'inline-flex':'none';
      if(!add.dataset.kzBound){
        add.dataset.kzBound='1';
        add.addEventListener('click',()=>{if(typeof wireMemberModal==='function')wireMemberModal();if(typeof openMemberModal==='function')openMemberModal(null,[]);});
      }
    }
    container.innerHTML='<div class="kz-community-loading">در حال آماده‌سازی پروفایل‌های تیم…</div>';
    const accounts=await getAccounts();
    if(!accounts.length){container.innerHTML='<div class="kz-community-empty">هنوز عضو تأییدشده‌ای برای نمایش وجود نداره.</div>';return;}
    const grid=document.createElement('div'); grid.className='kz-profile-grid';
    accounts.forEach(m=>{
      const games=String(m.game||'').split('،').map(x=>x.trim()).filter(Boolean);
      const card=document.createElement('article'); card.className='kz-profile-card'; card.tabIndex=0; card.setAttribute('role','button');
      card.innerHTML=`${avatar(m,false)}<div class="kz-profile-main"><div class="kz-profile-name-row"><h3 class="kz-profile-name">${esc(m.username)}</h3>${staff()?'<span class="kz-staff-mark">STAFF</span>':''}</div><div class="kz-profile-meta"><span>${esc(games.slice(0,2).join(' · ')||'بازی ثبت نشده')}</span>${m.joined_at?`<span>عضویت: ${esc(dateFa(m.joined_at))}</span>`:''}</div><p class="kz-profile-bio ${m.bio?'':'is-empty'}">${esc(m.bio||'برای دیدن معرفی و دستاوردها بازش کن.')}</p></div><div class="kz-profile-side"><span class="kz-profile-arrow" aria-hidden="true">←</span>${staff()?`<div class="kz-profile-admin-actions"><button class="btn ghost small kz-member-edit" data-id="${esc(m.id)}">ویرایش</button><button class="btn ghost small kz-member-delete" data-id="${esc(m.id)}">حذف</button></div>`:''}</div>`;
      const open=e=>{if(e.target.closest('.kz-profile-admin-actions'))return;openProfile(m);};
      card.addEventListener('click',open);
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(e);}});
      card.querySelector('.kz-member-edit')?.addEventListener('click',e=>{e.stopPropagation();if(typeof wireMemberModal==='function')wireMemberModal();if(typeof openMemberModal==='function')openMemberModal(e.currentTarget.dataset.id,accounts);});
      card.querySelector('.kz-member-delete')?.addEventListener('click',async e=>{
        e.stopPropagation(); if(!confirm('این اکانت و اطلاعات مرتبط باهاش حذف بشه؟'))return; const id=e.currentTarget.dataset.id;
        try{for(const [table,column] of [['team_join_messages','account_id'],['team_join_requests','account_id'],['member_presence','account_id']]){const r=await sb.from(table).delete().eq(column,id);if(r.error)throw r.error;}const r=await sb.from('accounts').delete().eq('id',id);if(r.error)throw r.error;await renderMembers();}catch(err){console.error(err);alert('حذف عضو انجام نشد.');}
      });
      grid.appendChild(card);
    });
    container.replaceChildren(grid);
  }

  async function ensureProfileModal(){
    let o=document.getElementById('kzProfileOverlay');if(o)return o;o=document.createElement('div');o.className='overlay kz-community-overlay';o.id='kzProfileOverlay';
    o.innerHTML='<div class="modal kz-modal-panel" role="dialog" aria-modal="true" aria-labelledby="kzProfileTitle"><button class="close" id="kzProfileClose" aria-label="بستن">✕</button><div id="kzProfileContent"></div></div>';
    document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});o.querySelector('#kzProfileClose').addEventListener('click',()=>o.classList.remove('show'));return o;
  }

  async function openProfile(m){
    const o=await ensureProfileModal();const c=o.querySelector('#kzProfileContent');const social=safeUrl(m.social);
    c.innerHTML=`<div class="kz-profile-hero">${avatar(m,true)}<div class="kz-profile-hero-copy"><span class="kz-eyebrow">KZ // MEMBER PROFILE</span><h3 id="kzProfileTitle">${esc(m.username)}</h3><p>${esc(m.bio||'این عضو هنوز معرفی کوتاهی ثبت نکرده.')}</p>${social?`<a class="kz-social" href="${esc(social)}" target="_blank" rel="noopener noreferrer">لینک پروفایل ↗</a>`:''}</div></div><section class="kz-profile-section"><div class="kz-profile-section-title"><h4>درباره عضو</h4><span>PROFILE</span></div><div class="kz-profile-meta kz-profile-meta-large"><span>${esc(String(m.game||'بازی ثبت نشده').replaceAll('،',' · '))}</span>${m.joined_at?`<span>عضویت از ${esc(dateFa(m.joined_at))}</span>`:''}</div></section><section class="kz-profile-section"><div class="kz-profile-section-title"><h4>دستاوردها</h4><span>ACHIEVEMENTS</span></div>${staff()?'<button class="btn primary small" id="kzAchievementAdd">+ افزودن دستاورد</button>':''}<div id="kzProfileAchievements" class="kz-achievements"><div class="kz-community-loading">در حال بارگذاری دستاوردها…</div></div></section>`;
    o.classList.add('show');o.querySelector('#kzAchievementAdd')?.addEventListener('click',()=>openAchievementEditor(m,null));await refreshProfileAchievements(m);
  }

  async function refreshProfileAchievements(m){
    const box=document.getElementById('kzProfileAchievements');if(!box)return;const ach=await getAchievements(m.id);
    box.innerHTML=ach.length?ach.map(a=>`<article class="kz-achievement"><div class="kz-achievement-icon">${esc(a.icon||'🏆')}</div><div><h4>${esc(a.title)}</h4><p>${esc(a.description)}</p><small>${esc(dateFa(a.awarded_at))}</small>${staff()?`<div class="kz-achievement-actions"><button class="btn ghost small kz-achievement-edit" data-id="${esc(a.id)}">ویرایش</button><button class="btn ghost small kz-achievement-delete" data-id="${esc(a.id)}">حذف</button></div>`:''}</div></article>`).join(''):'<div class="kz-community-empty">هنوز دستاوردی ثبت نشده.</div>';
    if(staff()){
      box.querySelectorAll('.kz-achievement-edit').forEach(b=>b.addEventListener('click',()=>openAchievementEditor(m,ach.find(a=>a.id===b.dataset.id))));
      box.querySelectorAll('.kz-achievement-delete').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('این دستاورد حذف بشه؟'))return;const {error}=await sb.from('achievements').delete().eq('id',b.dataset.id);if(error){alert('حذف دستاورد انجام نشد.');return;}refreshProfileAchievements(m);}));
    }
  }

  function openAchievementEditor(account,item){
    if(!staff())return;let o=document.getElementById('kzAchievementEditor');
    if(!o){o=document.createElement('div');o.className='overlay kz-community-overlay';o.id='kzAchievementEditor';o.innerHTML='<div class="modal kz-modal-panel kz-achievement-editor" role="dialog" aria-modal="true"><button class="close" id="kzAchievementClose" aria-label="بستن">✕</button><h3 id="kzAchievementEditorTitle">افزودن دستاورد</h3><div class="form-grid"><div class="field"><label>عنوان دستاورد</label><input id="kzAchievementTitle" maxlength="120"></div><div class="field"><label>توضیح</label><textarea id="kzAchievementDescription" rows="4" maxlength="500"></textarea></div><div class="field"><label>آیکن</label><input id="kzAchievementIcon" maxlength="8" placeholder="🏆"></div><button class="btn primary" id="kzAchievementSave">ذخیره دستاورد</button><div id="kzAchievementMsg"></div></div></div>';document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});o.querySelector('#kzAchievementClose').addEventListener('click',()=>o.classList.remove('show'));}
    o.querySelector('#kzAchievementEditorTitle').textContent=item?'ویرایش دستاورد':`افزودن دستاورد برای ${account.username}`;o.querySelector('#kzAchievementTitle').value=item?.title||'';o.querySelector('#kzAchievementDescription').value=item?.description||'';o.querySelector('#kzAchievementIcon').value=item?.icon||'🏆';o.querySelector('#kzAchievementMsg').innerHTML='';o.classList.add('show');
    o.querySelector('#kzAchievementSave').onclick=async()=>{const title=o.querySelector('#kzAchievementTitle').value.trim(),description=o.querySelector('#kzAchievementDescription').value.trim(),icon=o.querySelector('#kzAchievementIcon').value.trim()||'🏆',msg=o.querySelector('#kzAchievementMsg');if(!title||!description){msg.innerHTML='<div class="form-msg err">عنوان و توضیح رو کامل کن.</div>';return;}const q=item?sb.from('achievements').update({title,description,icon}).eq('id',item.id):sb.from('achievements').insert([{id:'ach-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),account_id:account.id,title,description,icon,awarded_at:new Date().toISOString()}]);const {error}=await q;if(error){console.error(error);msg.innerHTML='<div class="form-msg err">ذخیره دستاورد ناموفق بود.</div>';return;}o.classList.remove('show');refreshProfileAchievements(account);};
  }

  async function getAnnouncements(limit){let q=sb.from('announcements').select('id,title,body,category,pinned,published_at,author_id').order('pinned',{ascending:false}).order('published_at',{ascending:false});if(limit)q=q.limit(limit);const {data,error}=await q;if(error){console.error('news',error);return [];}return data||[];}
  function renderNews(container,items){if(!container)return;container.innerHTML=items.length?`<div class="kz-news-list">${items.map(n=>`<article class="kz-news-card ${n.pinned?'is-pinned':''}"><div class="kz-news-head"><div><h3 class="kz-news-title">${esc(n.title)}</h3><p class="kz-news-date">${esc(dateFa(n.published_at))}</p></div><span class="kz-news-badge">${esc(categoryLabel(n.category))}</span></div><p class="kz-news-body">${esc(n.body)}</p>${staff()?`<div class="kz-news-actions"><button class="btn ghost small kz-news-edit" data-id="${esc(n.id)}">ویرایش</button><button class="btn ghost small kz-news-delete" data-id="${esc(n.id)}">حذف</button></div>`:''}</article>`).join('')}</div>`:'<div class="kz-community-empty">هنوز خبر یا اطلاعیه‌ای منتشر نشده.</div>';}
  function ensureNewsButton(){const add=document.getElementById('newsAddBtn');if(!add)return;add.style.display=staff()?'inline-flex':'none';if(!add.dataset.kzBound){add.dataset.kzBound='1';add.addEventListener('click',()=>openNewsEditor(null));}}
  async function renderNewsPage(){const c=document.getElementById('newsContainer');if(!c)return;ensureNewsButton();c.innerHTML='<div class="kz-community-loading">در حال دریافت خبرها…</div>';const items=await getAnnouncements();renderNews(c,items);c.querySelectorAll('.kz-news-edit').forEach(b=>b.addEventListener('click',()=>openNewsEditor(items.find(n=>n.id===b.dataset.id))));c.querySelectorAll('.kz-news-delete').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('این خبر حذف بشه؟'))return;const {error}=await sb.from('announcements').delete().eq('id',b.dataset.id);if(error){alert('حذف خبر انجام نشد.');return;}renderNewsPage();}));}
  function openNewsEditor(item){if(!staff())return;let o=document.getElementById('kzNewsEditor');if(!o){o=document.createElement('div');o.className='overlay kz-community-overlay';o.id='kzNewsEditor';o.innerHTML='<div class="modal kz-modal-panel" role="dialog" aria-modal="true"><button class="close" id="kzNewsClose" aria-label="بستن">✕</button><h3 id="kzNewsEditorTitle">افزودن خبر</h3><div class="form-grid"><div class="field"><label>عنوان</label><input id="kzNewsTitle" maxlength="120"></div><div class="field"><label>نوع</label><select id="kzNewsCategory"><option value="news">خبر</option><option value="announcement">اطلاعیه</option><option value="event">رویداد</option></select></div><div class="field"><label>متن</label><textarea id="kzNewsBody" rows="6" maxlength="4000"></textarea></div><label class="field"><span><input type="checkbox" id="kzNewsPinned"> سنجاق شود</span></label><button class="btn primary" id="kzNewsSave">ذخیره خبر</button><div id="kzNewsMsg"></div></div></div>';document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});o.querySelector('#kzNewsClose').addEventListener('click',()=>o.classList.remove('show'));}o.dataset.id=item?.id||'';o.querySelector('#kzNewsEditorTitle').textContent=item?'ویرایش خبر':'افزودن خبر';o.querySelector('#kzNewsTitle').value=item?.title||'';o.querySelector('#kzNewsCategory').value=item?.category||'news';o.querySelector('#kzNewsBody').value=item?.body||'';o.querySelector('#kzNewsPinned').checked=!!item?.pinned;o.querySelector('#kzNewsMsg').innerHTML='';o.classList.add('show');o.querySelector('#kzNewsSave').onclick=async()=>{const title=o.querySelector('#kzNewsTitle').value.trim(),body=o.querySelector('#kzNewsBody').value.trim(),msg=o.querySelector('#kzNewsMsg');if(!title||!body){msg.innerHTML='<div class="form-msg err">عنوان و متن رو کامل کن.</div>';return;}const data={title,body,category:o.querySelector('#kzNewsCategory').value,pinned:o.querySelector('#kzNewsPinned').checked};const q=o.dataset.id?sb.from('announcements').update(data).eq('id',o.dataset.id):sb.from('announcements').insert([{id:'news-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),...data,author_id:currentUser?.id||null}]);const {error}=await q;if(error){msg.innerHTML='<div class="form-msg err">ذخیره خبر ناموفق بود.</div>';return;}o.classList.remove('show');renderNewsPage();};}

  async function boot(){if(typeof sb==='undefined'){setTimeout(boot,120);return;}if(document.getElementById('membersCommunityContainer')){if(typeof wireMemberModal==='function')wireMemberModal();await renderMembers();}if(document.getElementById('newsPreview'))renderNews(document.getElementById('newsPreview'),await getAnnouncements(3));if(document.getElementById('newsContainer'))await renderNewsPage();}
  window.addEventListener('kz:session-changed',()=>{if(document.getElementById('membersCommunityContainer'))renderMembers();if(document.getElementById('newsContainer'))renderNewsPage();if(document.getElementById('newsPreview'))getAnnouncements(3).then(i=>renderNews(document.getElementById('newsPreview'),i));});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();