// Designed & developed by TheROMZ52 for KillZone Team — 2026
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const initials=name=>(String(name||'?').trim().slice(0,2)||'?').toUpperCase();
  const dateFa=value=>{try{return new Intl.DateTimeFormat('fa-IR',{year:'numeric',month:'long',day:'numeric'}).format(new Date(value));}catch{return '';}};
  const categoryLabel=key=>({announcement:'اطلاعیه',news:'خبر',event:'رویداد'})[key]||'خبر';
  const safeUrl=raw=>{const s=String(raw||'').trim();try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch{return '';}};
  const staff=()=>typeof currentUser!=='undefined'&&currentUser&&typeof isStaff==='function'&&isStaff(currentUser);
  async function getAccounts(){const {data,error}=await sb.from('accounts').select('id,username,photo,game,bio,social,joined_at,team_status').eq('team_status','approved').order('username');if(error){console.error(error);return [];}return data||[];}
  async function getAchievements(accountId){const {data,error}=await sb.from('achievements').select('id,title,description,icon,awarded_at').eq('account_id',accountId).order('awarded_at',{ascending:false});if(error){console.error(error);return [];}return data||[];}
  async function getAnnouncements(limit){let q=sb.from('announcements').select('id,title,body,category,pinned,published_at,author_id').order('pinned',{ascending:false}).order('published_at',{ascending:false});if(limit)q=q.limit(limit);const {data,error}=await q;if(error){console.error(error);return [];}return data||[];}
  function avatarHtml(m,large){const cls=large?'kz-profile-large-avatar':'kz-profile-avatar';return m.photo?`<img class="${cls}" src="${esc(m.photo)}" alt="${esc(m.username)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=\"${cls}\">${esc(initials(m.username))}</div>'">`:`<div class="${cls}">${esc(initials(m.username))}</div>`;}

  async function renderMembers(){
    const container=document.getElementById('membersContainer');if(!container)return;
    container.innerHTML='<div class="kz-community-loading">در حال آماده‌سازی پروفایل‌های تیم…</div>';
    const accounts=await getAccounts();container.innerHTML='';
    if(!accounts.length){container.innerHTML='<div class="kz-community-empty">هنوز پروفایل عمومی‌ای برای نمایش وجود نداره.</div>';return;}
    const grid=document.createElement('div');grid.className='kz-profile-grid';
    accounts.forEach(m=>{
      const card=document.createElement('article');card.className='kz-profile-card';card.tabIndex=0;card.setAttribute('role','button');
      const games=String(m.game||'').split('،').map(x=>x.trim()).filter(Boolean);const gameText=games.slice(0,2).join(' · ')||'بازی ثبت نشده';
      card.innerHTML=`${avatarHtml(m,false)}<div class="kz-profile-main"><h3 class="kz-profile-name">${esc(m.username)}</h3><div class="kz-profile-meta"><span>${esc(gameText)}</span>${m.joined_at?`<span>عضویت: ${esc(dateFa(m.joined_at))}</span>`:''}</div>${m.bio?`<p class="kz-profile-bio">${esc(m.bio)}</p>`:''}</div><div class="kz-profile-arrow" aria-hidden="true">←</div>`;
      const open=()=>openProfile(m);card.addEventListener('click',open);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  async function ensureProfileModal(){
    let overlay=document.getElementById('kzProfileOverlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.className='overlay kz-community-overlay';overlay.id='kzProfileOverlay';
    overlay.innerHTML='<div class="modal kz-modal-panel" role="dialog" aria-modal="true" aria-labelledby="kzProfileTitle"><button class="close" id="kzProfileClose" aria-label="بستن">✕</button><div id="kzProfileContent"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});
    document.getElementById('kzProfileClose').addEventListener('click',()=>overlay.classList.remove('show'));
    return overlay;
  }

  async function openProfile(m){
    const overlay=await ensureProfileModal();const content=document.getElementById('kzProfileContent');
    content.innerHTML=`<div class="kz-profile-hero">${avatarHtml(m,true)}<div><h3 id="kzProfileTitle">${esc(m.username)}</h3><p>${esc(m.bio||'این عضو هنوز معرفی کوتاهی ثبت نکرده.')}</p>${safeUrl(m.social)?`<a class="kz-social" href="${esc(safeUrl(m.social))}" target="_blank" rel="noopener noreferrer">لینک پروفایل ↗</a>`:''}</div></div><section class="kz-profile-section"><div class="kz-profile-section-title"><h4>درباره عضو</h4><span>PROFILE</span></div><div class="kz-profile-meta"><span>${esc(String(m.game||'بازی ثبت نشده').replaceAll('،',' · '))}</span>${m.joined_at?`<span>از ${esc(dateFa(m.joined_at))}</span>`:''}</div></section><section class="kz-profile-section"><div class="kz-profile-section-title"><h4>دستاوردها</h4><span>ACHIEVEMENTS</span></div>${staff()?'<button class="btn primary small" id="kzAchievementAdd">+ افزودن دستاورد</button>':''}<div id="kzProfileAchievements" class="kz-achievements"><div class="kz-community-loading">در حال بارگذاری دستاوردها…</div></div></section>`;
    overlay.classList.add('show');
    document.getElementById('kzAchievementAdd')?.addEventListener('click',()=>openAchievementEditor(m,null));
    await refreshProfileAchievements(m);
  }

  async function refreshProfileAchievements(m){
    const ach=await getAchievements(m.id);const box=document.getElementById('kzProfileAchievements');if(!box)return;
    box.innerHTML=ach.length?ach.map(a=>`<article class="kz-achievement"><div class="kz-achievement-icon">${esc(a.icon||'◆')}</div><div><h4>${esc(a.title)}</h4><p>${esc(a.description)}</p><small>${esc(dateFa(a.awarded_at))}</small>${staff()?`<div class="kz-achievement-actions"><button class="btn ghost small kz-achievement-edit" data-id="${esc(a.id)}">ویرایش</button><button class="btn ghost small kz-achievement-delete" data-id="${esc(a.id)}">حذف</button></div>`:''}</div></article>`).join(''):'<div class="kz-community-empty">هنوز دستاوردی ثبت نشده.</div>';
    if(staff()){
      box.querySelectorAll('.kz-achievement-edit').forEach(b=>b.addEventListener('click',()=>openAchievementEditor(m,ach.find(x=>x.id===b.dataset.id))));
      box.querySelectorAll('.kz-achievement-delete').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('این دستاورد حذف بشه؟'))return;const {error}=await sb.from('achievements').delete().eq('id',b.dataset.id);if(error){alert('حذف دستاورد انجام نشد.');return;}refreshProfileAchievements(m);}));
    }
  }

  async function openAchievementEditor(account,item){
    let o=document.getElementById('kzAchievementEditor');
    if(!o){
      o=document.createElement('div');o.className='overlay kz-community-overlay';o.id='kzAchievementEditor';
      o.innerHTML='<div class="modal kz-modal-panel kz-achievement-editor"><button class="close" id="kzAchievementClose">✕</button><h3 id="kzAchievementEditorTitle">افزودن دستاورد</h3><div class="form-grid"><div class="field"><label>عنوان دستاورد</label><input id="kzAchievementTitle" maxlength="120" placeholder="مثلاً قهرمان تورنمنت"></div><div class="field"><label>توضیح</label><textarea id="kzAchievementDescription" rows="4" maxlength="500" placeholder="این دستاورد برای چه چیزی ثبت شده؟"></textarea></div><div class="field"><label>آیکن</label><input id="kzAchievementIcon" maxlength="8" placeholder="🏆"></div><button class="btn primary" id="kzAchievementSave">ذخیره دستاورد</button><div id="kzAchievementMsg"></div></div></div>';
      document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});document.getElementById('kzAchievementClose').addEventListener('click',()=>o.classList.remove('show'));
    }
    o.dataset.accountId=account.id;o.dataset.id=item?.id||'';document.getElementById('kzAchievementEditorTitle').textContent=item?'ویرایش دستاورد':'افزودن دستاورد';document.getElementById('kzAchievementTitle').value=item?.title||'';document.getElementById('kzAchievementDescription').value=item?.description||'';document.getElementById('kzAchievementIcon').value=item?.icon||'🏆';document.getElementById('kzAchievementMsg').innerHTML='';o.classList.add('show');
    document.getElementById('kzAchievementSave').onclick=async()=>{
      if(!staff())return;
      const title=document.getElementById('kzAchievementTitle').value.trim(),description=document.getElementById('kzAchievementDescription').value.trim(),icon=document.getElementById('kzAchievementIcon').value.trim()||'🏆';
      const msg=document.getElementById('kzAchievementMsg');if(!title||!description){msg.innerHTML='<div class="form-msg err">عنوان و توضیح رو کامل کن.</div>';return;}
      const data={title,description,icon,account_id:account.id,awarded_at:item?.awarded_at||new Date().toISOString()};
      const q=item?sb.from('achievements').update({title,description,icon}).eq('id',item.id):sb.from('achievements').insert([{id:'ach-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),...data}]);
      const {error}=await q;if(error){console.error(error);msg.innerHTML='<div class="form-msg err">ذخیره دستاورد ناموفق بود.</div>';return;}
      o.classList.remove('show');refreshProfileAchievements(account);
    };
  }

  function renderNews(container,items){container.innerHTML=items.length?`<div class="kz-news-list">${items.map(n=>`<article class="kz-news-card ${n.pinned?'is-pinned':''}"><div class="kz-news-head"><div><h3 class="kz-news-title">${esc(n.title)}</h3><p class="kz-news-date">${esc(dateFa(n.published_at))}</p></div><span class="kz-news-badge">${esc(categoryLabel(n.category))}</span></div><p class="kz-news-body">${esc(n.body)}</p>${staff()?`<div class="kz-news-actions"><button class="btn ghost small kz-news-edit" data-id="${esc(n.id)}">ویرایش</button><button class="btn ghost small kz-news-delete" data-id="${esc(n.id)}">حذف</button></div>`:''}</article>`).join('')}</div>`:'<div class="kz-community-empty">هنوز خبر یا اطلاعیه‌ای منتشر نشده.</div>';}

  async function renderNewsPage(){const c=document.getElementById('newsContainer');if(!c)return;c.innerHTML='<div class="kz-community-loading">در حال دریافت خبرها…</div>';const items=await getAnnouncements();renderNews(c,items);bindNewsAdmin(c,items);}
  function bindNewsAdmin(container,items){const add=document.getElementById('newsAddBtn');if(staff()&&add){add.style.display='inline-flex';if(!add.dataset.kzBound){add.dataset.kzBound='1';add.addEventListener('click',()=>openNewsEditor());}}else if(add){add.style.display='none';}if(!staff())return;container.querySelectorAll('.kz-news-edit').forEach(b=>b.addEventListener('click',()=>openNewsEditor(items.find(x=>x.id===b.dataset.id))));container.querySelectorAll('.kz-news-delete').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('این خبر حذف بشه؟'))return;const {error}=await sb.from('announcements').delete().eq('id',b.dataset.id);if(error){alert('حذف خبر انجام نشد.');return;}renderNewsPage();}));}

  async function openNewsEditor(item){let o=document.getElementById('kzNewsEditor');if(!o){o=document.createElement('div');o.className='overlay kz-community-overlay';o.id='kzNewsEditor';o.innerHTML='<div class="modal kz-modal-panel"><button class="close" id="kzNewsClose">✕</button><h3 id="kzNewsEditorTitle">افزودن خبر</h3><div class="form-grid"><div class="field"><label>عنوان</label><input id="kzNewsTitle" maxlength="120"></div><div class="field"><label>نوع</label><select id="kzNewsCategory"><option value="news">خبر</option><option value="announcement">اطلاعیه</option><option value="event">رویداد</option></select></div><div class="field"><label>متن</label><textarea id="kzNewsBody" rows="6" maxlength="4000"></textarea></div><label class="field"><span><input type="checkbox" id="kzNewsPinned"> سنجاق شود</span></label><button class="btn primary" id="kzNewsSave">ذخیره</button><div id="kzNewsMsg"></div></div></div>';document.body.appendChild(o);o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('show');});document.getElementById('kzNewsClose').addEventListener('click',()=>o.classList.remove('show'));}o.dataset.id=item?.id||'';document.getElementById('kzNewsEditorTitle').textContent=item?'ویرایش خبر':'افزودن خبر';document.getElementById('kzNewsTitle').value=item?.title||'';document.getElementById('kzNewsCategory').value=item?.category||'news';document.getElementById('kzNewsBody').value=item?.body||'';document.getElementById('kzNewsPinned').checked=!!item?.pinned;document.getElementById('kzNewsMsg').innerHTML='';o.classList.add('show');document.getElementById('kzNewsSave').onclick=async()=>{if(!staff())return;const title=document.getElementById('kzNewsTitle').value.trim(),body=document.getElementById('kzNewsBody').value.trim();if(!title||!body){document.getElementById('kzNewsMsg').innerHTML='<div class="form-msg err">عنوان و متن رو کامل کن.</div>';return;}const data={title,body,category:document.getElementById('kzNewsCategory').value,pinned:document.getElementById('kzNewsPinned').checked};const q=o.dataset.id?sb.from('announcements').update(data).eq('id',o.dataset.id):sb.from('announcements').insert([{id:'news-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),...data,author_id:currentUser?.id||null}]);const {error}=await q;if(error){document.getElementById('kzNewsMsg').innerHTML='<div class="form-msg err">ذخیره خبر ناموفق بود.</div>';return;}o.classList.remove('show');renderNewsPage();};}

  async function boot(){
    if(typeof sb==='undefined'){setTimeout(boot,120);return;}
    await new Promise(r=>setTimeout(r,0));
    window.renderMembersPage=renderMembers;
    if(document.getElementById('membersContainer'))await renderMembers();
    if(document.getElementById('newsPreview')){const items=await getAnnouncements(3);renderNews(document.getElementById('newsPreview'),items);}
    if(document.getElementById('newsContainer'))await renderNewsPage();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
