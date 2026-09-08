// Designed & developed by TheROMZ52 for KillZone Team — 2026
/* ================= ثابت‌ها ================= */
const RANKS = [
  { key:'guest', label:'مهمان' },
  { key:'new_member', label:'نیو ممبر' },
  { key:'member', label:'ممبر' },
  { key:'admin', label:'ادمین' },
  { key:'developer', label:'دولوپر' },
  { key:'co_owner', label:'کو-اونر' },
  { key:'owner', label:'اونر' }
];
const ADMIN_RANKS = ['admin','developer','co_owner','owner'];
const SESSION_KEY = 'kz_session';
const RUBIKA_LINK = 'https://rubika.ir/joing/BBEDHCIEG0CUGHJUEJWPLKHRDAWOCCSB';

function rankLabel(key){ const r = RANKS.find(x=>x.key===key); return r ? r.label : key; }
function rankTier(key){ const i = RANKS.findIndex(x=>x.key===key); return i<0 ? 1 : i+1; }
function rankChevrons(key){ return '▲'.repeat(rankTier(key)); }
function escapeHtml(s){ return String(s??'').replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
function initials(name){ return (name||'?').trim().slice(0,2).toUpperCase(); }
function isStaff(u){ return !!(u && ADMIN_RANKS.includes(u.rank)); }

async function hashPass(pw){
  try{
    const enc = new TextEncoder().encode(pw);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    let h = 0;
    for(let i=0;i<pw.length;i++){ h = ((h<<5)-h)+pw.charCodeAt(i); h|=0; }
    return 'fallback-'+h;
  }
}

/* ================= آپلود عکس ================= */
async function uploadPhoto(file, onStatus){
  if(!file) return null;
  if(!file.type || !file.type.startsWith('image/')){
    onStatus && onStatus('err', 'فقط فایل عکس مجازه.');
    return null;
  }
  if(file.size > 5 * 1024 * 1024){
    onStatus && onStatus('err', 'حجم عکس باید کمتر از ۵ مگابایت باشه.');
    return null;
  }
  onStatus && onStatus('ok', 'در حال آپلود عکس...');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
  const path = 'u-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
  const { error } = await sb.storage.from('avatars').upload(path, file, { upsert:true, cacheControl:'3600' });
  if(error){
    console.error(error);
    onStatus && onStatus('err', 'آپلود عکس ناموفق بود.');
    return null;
  }
  const { data } = sb.storage.from('avatars').getPublicUrl(path);
  onStatus && onStatus('ok', 'عکس آپلود شد ✔');
  return data?.publicUrl || null;
}

/* ================= Session (فقط برای نگه‌داشتن ورود بین صفحات) ================= */
let currentUser = null;
function saveSession(acc){ localStorage.setItem(SESSION_KEY, JSON.stringify({ id: acc.id })); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function getSessionId(){
  try{ const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw).id : null; }
  catch(e){ return null; }
}
async function initSession(){
  const id = getSessionId();
  if(!id) return;
  const { data, error } = await sb.from('accounts').select('*').eq('id', id).maybeSingle();
  if(!error && data) currentUser = data; else clearSession();
}

/* ================= دیتابیس: اکانت‌ها ================= */
async function ensureSeedAccounts(){
  // Admin accounts are provisioned outside browser code. Never ship a default admin password in client JS.
  return;
}
async function fetchAccounts(){
  const { data, error } = await sb.from('accounts').select('*').order('username');
  if(error){ console.error(error); return []; }
  return data;
}
async function loginUser(username, password){
  const { data, error } = await sb.from('accounts').select('*').ilike('username', username).maybeSingle();
  if(error || !data) return { ok:false, msg:'همچین اکانتی پیدا نشد.' };
  const ph = await hashPass(password);
  if(ph !== data.pass_hash) return { ok:false, msg:'رمز اشتباهه.' };
  return { ok:true, account:data };
}
async function registerUser(username, password, game, photo){
  const { data: existing } = await sb.from('accounts').select('id').ilike('username', username).maybeSingle();
  if(existing) return { ok:false, msg:'این نام‌کاربری قبلاً گرفته شده.' };
  const acc = {
    id: 'm-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
    username, pass_hash: await hashPass(password),
    rank:'new_member', game: game || '', photo: photo || '', is_admin:false
  };
  const { error } = await sb.from('accounts').insert([acc]);
  if(error){ console.error(error); return { ok:false, msg:'خطا در ثبت‌نام. دوباره تلاش کن.' }; }
  return { ok:true, account:acc };
}

/* ================= دیتابیس: بازی‌ها ================= */
async function ensureSeedGames(){
  const { count, error } = await sb.from('game_blocks').select('*', { count:'exact', head:true });
  if(error){ console.error(error); return; }
  if(count === 0){
    await sb.from('game_blocks').insert([
      { id:'blk-mc', name:'ماینکرفت', tag:'MINECRAFT', theme:'mc', sort_order:1 },
      { id:'blk-cs', name:'کانتر استرایک', tag:'COUNTER-STRIKE', theme:'cod', sort_order:2 }
    ]);
    await sb.from('game_modes').insert([
      { id:'mode-1', block_id:'blk-mc', title:'اسکای‌بلاک', description:'بازسازی از صفر روی یه جزیره کوچیک؛ منابع، اقتصاد و پیشرفت تیمی.', maps:'Island Reset, Economy', sort_order:1 },
      { id:'mode-2', block_id:'blk-mc', title:'اسکای‌وارز', description:'نبرد سریع روی جزیره‌های معلق؛ لوت کن، آماده شو، حمله کن.', maps:'Solo, Teams', sort_order:2 },
      { id:'mode-3', block_id:'blk-mc', title:'بدوارز', description:'دفاع از تخت، خرید آپگرید، و حذف تیم‌های رقیب یکی‌یکی.', maps:'4-Team, 8-Team', sort_order:3 },
      { id:'mode-4', block_id:'blk-mc', title:'سروایول', description:'سرور اصلی تیم برای ساخت‌وساز بلندمدت روی مپ‌های محبوب جامعه.', maps:'محبوب #1, محبوب #2, محبوب #3', sort_order:4 },
      { id:'mode-5', block_id:'blk-cs', title:'Respawn Deathmatch', description:'مچ سریع؛ بعد از مرگ دوباره Spawn می‌شوی و بازی تا پایان تایمر ادامه دارد.', maps:'Respawn, Kill Feed', sort_order:1 },
      { id:'mode-6', block_id:'blk-cs', title:'تمرینی', description:'تمرین آیم و شلیک در میدان سه‌بعدی.', maps:'Dust II 3D, Practice', sort_order:2 }
    ]);
  }
}
async function fetchGameData(){
  const { data: blocks, error: e1 } = await sb.from('game_blocks').select('*').order('sort_order');
  const { data: modes, error: e2 } = await sb.from('game_modes').select('*').order('sort_order');
  if(e1) console.error(e1);
  if(e2) console.error(e2);
  return { blocks: blocks||[], modes: modes||[] };
}
async function fetchGameNames(){
  const { data, error } = await sb.from('game_blocks').select('name').order('sort_order');
  if(error){ console.error(error); return []; }
  return (data||[]).map(x=>x.name);
}

/* ================= هدر / ورود ================= */
function renderUserBox(){
  const box = document.getElementById('userBox');
  if(!box) return;
  if(currentUser){
    box.innerHTML = `
      <div class="user-chip">
        <span class="tier">${rankChevrons(currentUser.rank)}</span>
        <span>${escapeHtml(currentUser.username)}</span>
        <span class="rk">${escapeHtml(rankLabel(currentUser.rank))}</span>
      </div>
      ${isStaff(currentUser) ? '<span class="admin-btn on">حالت مدیریت فعاله</span>' : ''}
      <button class="link-btn" id="logoutBtn">خروج</button>
    `;
    document.getElementById('logoutBtn').addEventListener('click', ()=>{
      currentUser = null;
      clearSession();
      renderUserBox();
      if(document.getElementById('membersContainer')) renderMembersPage();
      if(document.getElementById('gamesContainer')) renderGamesPage();
    });
  }else{
    box.innerHTML = `<button class="link-btn" id="loginOpenBtn">🔒 ورود</button>`;
    document.getElementById('loginOpenBtn').addEventListener('click', ()=>{
      const msg = document.getElementById('loginMsg');
      if(msg) msg.innerHTML = '';
      document.getElementById('loginOverlay').classList.add('show');
    });
  }
}
function wireLoginModal(){
  const overlay = document.getElementById('loginOverlay');
  if(!overlay) return;
  document.getElementById('loginClose').addEventListener('click', ()=>overlay.classList.remove('show'));
  document.getElementById('loginSubmit').addEventListener('click', async ()=>{
    const username = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const msg = document.getElementById('loginMsg');
    if(!username || !pass){ msg.innerHTML = '<div class="form-msg err">یوزرنیم و رمز رو وارد کن.</div>'; return; }
    const res = await loginUser(username, pass);
    if(!res.ok){ msg.innerHTML = `<div class="form-msg err">${escapeHtml(res.msg)}</div>`; return; }
    currentUser = res.account;
    saveSession(res.account);
    overlay.classList.remove('show');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    renderUserBox();
    if(document.getElementById('membersContainer')) renderMembersPage();
    if(document.getElementById('gamesContainer')) renderGamesPage();
  });
}

/* ================= صفحه اعضا ================= */
function buildMemberCard(m, staff, accountsCache){
  const card = document.createElement('div');
  card.className = 'member-tile';
  card.innerHTML = `
    ${m.photo ? `<img class="avatar" src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.username)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=avatar>${initials(m.username)}</div>'">` : `<div class="avatar">${initials(m.username)}</div>`}
    <h4>${escapeHtml(m.username)}</h4>
    <div class="rank-badge ${ADMIN_RANKS.includes(m.rank) ? 'staff' : ''}"><span class="tier">${rankChevrons(m.rank)}</span> ${escapeHtml(rankLabel(m.rank))}</div>
    <div class="game-tag">${escapeHtml(m.game || '—')}</div>
    ${staff ? `<div class="member-actions"><button class="icon-btn edit" data-id="${m.id}">ویرایش</button><button class="icon-btn del" data-id="${m.id}">حذف</button></div>` : ''}
  `;
  if(staff){
    card.querySelector('.edit').addEventListener('click', ()=>openMemberModal(m.id, accountsCache));
    card.querySelector('.del').addEventListener('click', ()=>deleteMember(m.id));
  }
  return card;
}
async function renderMembersPage(){
  const container = document.getElementById('membersContainer');
  if(!container) return;
  container.innerHTML = '<div class="loading-note">در حال بارگذاری...</div>';
  const accounts = await fetchAccounts();
  container.innerHTML = '';
  const staff = isStaff(currentUser);
  if(accounts.length === 0){
    container.innerHTML = '<div class="empty-note">هنوز عضوی ثبت‌نام نکرده.</div>';
  }else{
    const orderHighToLow = [...RANKS].map(r=>r.key).reverse();
    orderHighToLow.forEach(rankKey=>{
      const group = accounts.filter(a=>a.rank===rankKey);
      if(group.length === 0) return;
      if(rankKey==='guest' && !staff) return;
      const sec = document.createElement('div');
      sec.className = 'rank-section';
      sec.innerHTML = `<div class="rank-heading"><span class="tier">${rankChevrons(rankKey)}</span><h3>${escapeHtml(rankLabel(rankKey))}</h3><div class="rule"></div></div>`;
      const grid = document.createElement('div');
      grid.className = 'member-grid';
      group.forEach(m=> grid.appendChild(buildMemberCard(m, staff, accounts)));
      sec.appendChild(grid);
      container.appendChild(sec);
    });
    const known = new Set(orderHighToLow);
    const unknown = accounts.filter(a=>!known.has(a.rank));
    if(unknown.length){
      const sec = document.createElement('div');
      sec.className = 'rank-section';
      sec.innerHTML = `<div class="rank-heading"><span class="tier">▲</span><h3>سایر</h3><div class="rule"></div></div>`;
      const grid = document.createElement('div');
      grid.className = 'member-grid';
      unknown.forEach(m=> grid.appendChild(buildMemberCard(m, staff, accounts)));
      sec.appendChild(grid); container.appendChild(sec);
    }
  }
  if(typeof window.wireMemberModal==='function') window.wireMemberModal();
}

/* ================= مدیریت اعضا ================= */
let editingMemberId = null;
function openMemberModal(id, accounts){
  if(!isStaff(currentUser)) return;
  editingMemberId = id || null;
  const m=(accounts||[]).find(x=>x.id===id);
  const overlay=document.getElementById('memberOverlay');
  if(!overlay)return;
  document.getElementById('memberModalTitle').textContent=id?'ویرایش عضو':'افزودن عضو دستی';
  document.getElementById('mName').value=m?.username||'';
  document.getElementById('mPhoto').value=m?.photo||'';
  document.getElementById('mRank').value=m?.rank||'new_member';
  document.getElementById('mNewPass').value='';
  document.getElementById('memberMsg').innerHTML='';
  overlay.classList.add('show');
  loadMemberGameChecks(m?.game||'');
}
async function loadMemberGameChecks(selected){
  const box=document.getElementById('mGamesBox'); if(!box) return;
  box.innerHTML='<div class="hint">در حال بارگذاری بازی‌ها...</div>';
  const names=await fetchGameNames();
  const set=new Set(String(selected).split('،').map(s=>s.trim()).filter(Boolean));
  box.innerHTML=names.map(name=>`<label class="kz-game-check"><input type="checkbox" value="${escapeHtml(name)}" ${set.has(name)?'checked':''}> ${escapeHtml(name)}</label>`).join('')||'<div class="hint">هنوز بازی‌ای تعریف نشده.</div>';
}
function wireMemberModal(){
  const overlay=document.getElementById('memberOverlay'); if(!overlay||overlay.dataset.kzCoreReady==='1') return;
  overlay.dataset.kzCoreReady='1';
  document.getElementById('memberClose')?.addEventListener('click',()=>overlay.classList.remove('show'));
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});
  document.getElementById('addMemberBtn')?.addEventListener('click',()=>openMemberModal(null,[]));
  document.getElementById('mPhotoFile')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const url=await uploadPhoto(file,(type,text)=>{const msg=document.getElementById('memberMsg');if(msg)msg.innerHTML=`<div class="form-msg ${type}">${escapeHtml(text)}</div>`;});
    if(url)document.getElementById('mPhoto').value=url;
  });
  document.getElementById('memberSave')?.addEventListener('click',saveMember);
}
async function saveMember(){
  if(!isStaff(currentUser)) return;
  const msg=document.getElementById('memberMsg');
  const name=document.getElementById('mName')?.value.trim()||'';
  if(!name){if(msg)msg.innerHTML='<div class="form-msg err">نام‌کاربری رو وارد کن.</div>';return;}
  const games=[...document.querySelectorAll('#mGamesBox input:checked')].map(x=>x.value).join('، ');
  const data={username:name,photo:document.getElementById('mPhoto')?.value.trim()||'',rank:document.getElementById('mRank')?.value||'new_member',game:games};
  const pass=document.getElementById('mNewPass')?.value||'';
  try{
    if(pass)data.pass_hash=await hashPass(pass);
    if(editingMemberId){
      const {error}=await sb.from('accounts').update(data).eq('id',editingMemberId);if(error)throw error;
    }else{
      data.id='m-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);data.pass_hash=data.pass_hash||await hashPass(Math.random().toString(36).slice(2,10));data.is_admin=ADMIN_RANKS.includes(data.rank);data.team_status=data.rank==='guest'?'none':'approved';const {error}=await sb.from('accounts').insert([data]);if(error)throw error;
    }
    document.getElementById('memberOverlay')?.classList.remove('show');renderMembersPage();
  }catch(e){console.error(e);if(msg)msg.innerHTML='<div class="form-msg err">ذخیره عضو ناموفق بود.</div>';}
}
async function deleteMember(id){
  if(!isStaff(currentUser)||!id)return;
  if(!confirm('این اکانت و درخواست‌های مرتبط باهاش حذف بشه؟'))return;
  try{
    for(const [table,column] of [['team_join_messages','account_id'],['team_join_requests','account_id'],['member_presence','account_id']]){const {error}=await sb.from(table).delete().eq(column,id);if(error)throw error;}
    const {error}=await sb.from('accounts').delete().eq('id',id);if(error)throw error;
    renderMembersPage();
  }catch(e){console.error(e);alert('حذف عضو انجام نشد.');}
}

/* ================= بازی‌ها ================= */
let editingBlockId=null, editingModeId=null, editingModeBlockId=null;
function gameCard(block,modes,staff){
  const wrap=document.createElement('section');wrap.className='game-block';
  const blockModes=modes.filter(m=>m.block_id===block.id);
  wrap.innerHTML=`<div class="game-banner ${escapeHtml(block.theme||'neutral')}"><div class="accent-strip"></div><div class="game-banner-body"><div><h3>${escapeHtml(block.name)}</h3>${block.tag?`<span class="tag">${escapeHtml(block.tag)}</span>`:''}</div>${staff?`<div class="game-admin-actions"><button class="icon-btn edit-block" data-id="${escapeHtml(block.id)}">ویرایش</button><button class="icon-btn del del-block" data-id="${escapeHtml(block.id)}">حذف</button></div>`:''}</div></div><div class="mode-grid"></div>${staff?`<button class="btn ghost small add-mode" data-block="${escapeHtml(block.id)}" style="margin-top:14px;">+ افزودن مود</button>`:''}`;
  const grid=wrap.querySelector('.mode-grid');
  blockModes.forEach(mode=>{const card=document.createElement('article');card.className='mode-card';const chips=String(mode.maps||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>`<span>${escapeHtml(s)}</span>`).join('');card.innerHTML=`<h4>${escapeHtml(mode.title)}</h4><p>${escapeHtml(mode.description||'')}</p><div class="maps">${chips}</div>${staff?`<div class="member-actions"><button class="icon-btn edit-mode" data-id="${escapeHtml(mode.id)}">ویرایش</button><button class="icon-btn del del-mode" data-id="${escapeHtml(mode.id)}">حذف</button></div>`:''}`;grid.appendChild(card);});
  wrap.querySelectorAll('.edit-block').forEach(b=>b.addEventListener('click',()=>openBlockModal(b.dataset.id,window.__kzGameCache?.blocks||[])));
  wrap.querySelectorAll('.del-block').forEach(b=>b.addEventListener('click',()=>deleteBlock(b.dataset.id)));
  wrap.querySelectorAll('.add-mode').forEach(b=>b.addEventListener('click',()=>openModeModal(null,b.dataset.block,window.__kzGameCache?.modes||[])));
  wrap.querySelectorAll('.edit-mode').forEach(b=>b.addEventListener('click',()=>openModeModal(b.dataset.id,null,window.__kzGameCache?.modes||[])));
  wrap.querySelectorAll('.del-mode').forEach(b=>b.addEventListener('click',()=>deleteMode(b.dataset.id)));
  return wrap;
}
async function renderGamesPage(){
  const container=document.getElementById('gamesContainer');if(!container)return;
  container.innerHTML='<div class="loading-note">در حال بارگذاری بازی‌ها...</div>';
  const data=await fetchGameData();window.__kzGameCache=data;container.innerHTML='';
  const staff=isStaff(currentUser);
  if(!staff){
    container.innerHTML='<div class="empty-note">مدیریت مودها فقط برای اعضای تیم مدیریت قابل مشاهده است.</div>';
    document.getElementById('addGameBtn')?.style.setProperty('display','none');
    return;
  }
  if(!data.blocks.length){container.innerHTML='<div class="empty-note">هنوز بازی‌ای اضافه نشده.</div>';return;}
  data.blocks.forEach(block=>container.appendChild(gameCard(block,data.modes,staff)));
  document.getElementById('addGameBtn')?.style.setProperty('display','inline-flex');
  wireGameModals();
}
function openBlockModal(id,blocks){
  if(!isStaff(currentUser))return;editingBlockId=id||null;const b=(blocks||[]).find(x=>x.id===id);document.getElementById('blockModalTitle').textContent=id?'ویرایش بازی':'افزودن بازی';document.getElementById('bName').value=b?.name||'';document.getElementById('bTag').value=b?.tag||'';document.getElementById('bTheme').value=b?.theme||'neutral';document.getElementById('blockMsg').innerHTML='';document.getElementById('gameBlockOverlay').classList.add('show');
}
function openModeModal(id,blockId,modes){
  if(!isStaff(currentUser))return;editingModeId=id||null;editingModeBlockId=blockId||null;const m=(modes||[]).find(x=>x.id===id);if(id)editingModeBlockId=m?.block_id||null;document.getElementById('modeModalTitle').textContent=id?'ویرایش مود':'افزودن مود جدید';document.getElementById('moTitle').value=m?.title||'';document.getElementById('moDesc').value=m?.description||'';document.getElementById('moMaps').value=m?.maps||'';document.getElementById('modeMsg').innerHTML='';document.getElementById('gameModeOverlay').classList.add('show');
}
function wireGameModals(){
  const bo=document.getElementById('gameBlockOverlay');if(bo&&!bo.dataset.kzCoreReady){bo.dataset.kzCoreReady='1';document.getElementById('blockClose')?.addEventListener('click',()=>bo.classList.remove('show'));bo.addEventListener('click',e=>{if(e.target===bo)bo.classList.remove('show');});document.getElementById('addGameBtn')?.addEventListener('click',()=>openBlockModal(null,[]));document.getElementById('blockSave')?.addEventListener('click',saveBlock);}
  const mo=document.getElementById('gameModeOverlay');if(mo&&!mo.dataset.kzCoreReady){mo.dataset.kzCoreReady='1';document.getElementById('modeClose')?.addEventListener('click',()=>mo.classList.remove('show'));mo.addEventListener('click',e=>{if(e.target===mo)mo.classList.remove('show');});document.getElementById('modeSave')?.addEventListener('click',saveMode);}
}
async function saveBlock(){if(!isStaff(currentUser))return;const msg=document.getElementById('blockMsg');const name=document.getElementById('bName').value.trim();if(!name){msg.innerHTML='<div class="form-msg err">اسم بازی رو وارد کن.</div>';return;}const data={name,tag:document.getElementById('bTag').value.trim(),theme:document.getElementById('bTheme').value};try{const q=editingBlockId?sb.from('game_blocks').update(data).eq('id',editingBlockId):sb.from('game_blocks').insert([{id:'blk-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),sort_order:999,...data}]);const {error}=await q;if(error)throw error;document.getElementById('gameBlockOverlay').classList.remove('show');renderGamesPage();}catch(e){console.error(e);msg.innerHTML='<div class="form-msg err">ذخیره بازی ناموفق بود.</div>';}}
async function saveMode(){if(!isStaff(currentUser))return;const msg=document.getElementById('modeMsg');const title=document.getElementById('moTitle').value.trim();if(!title||!editingModeBlockId){msg.innerHTML='<div class="form-msg err">اطلاعات مود کامل نیست.</div>';return;}const data={block_id:editingModeBlockId,title,description:document.getElementById('moDesc').value.trim(),maps:document.getElementById('moMaps').value.trim()};try{const q=editingModeId?sb.from('game_modes').update(data).eq('id',editingModeId):sb.from('game_modes').insert([{id:'mode-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),sort_order:999,...data}]);const {error}=await q;if(error)throw error;document.getElementById('gameModeOverlay').classList.remove('show');renderGamesPage();}catch(e){console.error(e);msg.innerHTML='<div class="form-msg err">ذخیره مود ناموفق بود.</div>';}}
async function deleteBlock(id){if(!isStaff(currentUser)||!id)return;if(!confirm('این بازی و مودهای وابسته حذف بشن؟'))return;try{const {error:m}=await sb.from('game_modes').delete().eq('block_id',id);if(m)throw m;const {error}=await sb.from('game_blocks').delete().eq('id',id);if(error)throw error;renderGamesPage();}catch(e){console.error(e);alert('حذف بازی انجام نشد.');}}
async function deleteMode(id){if(!isStaff(currentUser)||!id)return;if(!confirm('این مود حذف بشه؟'))return;try{const {error}=await sb.from('game_modes').delete().eq('id',id);if(error)throw error;renderGamesPage();}catch(e){console.error(e);alert('حذف مود انجام نشد.');}}

/* ================= آمار / ثبت مهمان ================= */
async function renderHomeStats(){
  const stats=[['statMembers','accounts'],['statGames','game_blocks'],['statModes','game_modes']];
  await Promise.all(stats.map(async([id,table])=>{const el=document.getElementById(id);if(!el)return;const {count,error}=await sb.from(table).select('*',{count:'exact',head:true});if(error){console.error(error);el.textContent='—';return;}el.textContent=String(count??0);}));
}
async function renderRegisterPage(){
  const form=document.getElementById('regForm');if(!form)return;
  if(form.dataset.kzCoreReady==='1')return;form.dataset.kzCoreReady='1';
  form.addEventListener('submit',async e=>{e.preventDefault();const username=document.getElementById('regName').value.trim();const password=document.getElementById('regPass').value;const msg=document.getElementById('regMsg');if(!username||!password){msg.innerHTML='<div class="form-msg err">یوزرنیم و رمز رو وارد کن.</div>';return;}const res=await registerUser(username,password,'','');if(!res.ok){msg.innerHTML=`<div class="form-msg err">${escapeHtml(res.msg)}</div>`;return;}currentUser=res.account;saveSession(res.account);renderUserBox();msg.innerHTML='<div class="form-msg ok">اکانت مهمانت ساخته شد. حالا درخواست عضویت بده. ✔</div>';setTimeout(()=>location.href='/join',700);});
}

/* ================= بوت اصلی ================= */
async function boot(){
  if(typeof sb==='undefined'){setTimeout(boot,100);return;}
  try{await ensureSeedAccounts();await ensureSeedGames();await initSession();window.currentUser=currentUser;renderUserBox();wireLoginModal();if(document.getElementById('membersContainer')){wireMemberModal();await renderMembersPage();}if(document.getElementById('gamesContainer')){wireGameModals();await renderGamesPage();}if(document.getElementById('statMembers')||document.getElementById('statGames')||document.getElementById('statModes'))await renderHomeStats();if(document.getElementById('regForm'))await renderRegisterPage();}catch(e){console.error('KillZone boot failed',e);document.querySelectorAll('.loading-note').forEach(x=>{x.textContent='بارگذاری ناموفق بود؛ صفحه رو دوباره باز کن.';});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
