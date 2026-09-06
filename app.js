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
const ADMIN_RANKS = ['admin','developer','co_owner','owner']; // این رنک‌ها دسترسی مدیریت دارن
const DEFAULT_ADMIN_PASSWORD = 'killzone2026';
const SESSION_KEY = 'kz_session';
const RUBIKA_LINK = 'https://rubika.ir/joing/BBEDHCIEG0CUGHJUEJWPLKHRDAWOCCSB';

function rankLabel(key){ const r = RANKS.find(x=>x.key===key); return r ? r.label : key; }
function rankTier(key){ const i = RANKS.findIndex(x=>x.key===key); return i<0 ? 1 : i+1; }
function rankChevrons(key){ return '▲'.repeat(rankTier(key)); }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
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
  const { count, error } = await sb.from('accounts').select('*', { count:'exact', head:true });
  if(error){ console.error(error); return; }
  if(count === 0){
    const hp = await hashPass(DEFAULT_ADMIN_PASSWORD);
    await sb.from('accounts').insert([
      { id:'seed-1', username:'1Y2U3I', pass_hash:hp, rank:'owner', game:'', photo:'', is_admin:true },
      { id:'seed-2', username:'TheROMZ52', pass_hash:hp, rank:'developer', game:'', photo:'', is_admin:true }
    ]);
  }
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
      { id:'blk-cod', name:'کال‌آف‌دیوتی', tag:'CALL OF DUTY', theme:'cod', sort_order:2 }
    ]);
    await sb.from('game_modes').insert([
      { id:'mode-1', block_id:'blk-mc', title:'اسکای‌بلاک', description:'بازسازی از صفر روی یه جزیره کوچیک؛ منابع، اقتصاد و پیشرفت تیمی.', maps:'Island Reset, Economy', sort_order:1 },
      { id:'mode-2', block_id:'blk-mc', title:'اسکای‌وارز', description:'نبرد سریع روی جزیره‌های معلق؛ لوت کن، آماده شو، حمله کن.', maps:'Solo, Teams', sort_order:2 },
      { id:'mode-3', block_id:'blk-mc', title:'بدوارز', description:'دفاع از تخت، خرید آپگرید، و حذف تیم‌های رقیب یکی‌یکی.', maps:'4-Team, 8-Team', sort_order:3 },
      { id:'mode-4', block_id:'blk-mc', title:'سروایول', description:'سرور اصلی تیم برای ساخت‌وساز بلندمدت روی مپ‌های محبوب جامعه.', maps:'محبوب #1, محبوب #2, محبوب #3', sort_order:4 },
      { id:'mode-5', block_id:'blk-cod', title:'مولتی‌پلیر', description:'مچ‌های تیمی روی مپ‌های کلاسیک؛ تمرین آیم و هماهنگی اسکواد.', maps:'Team Deathmatch, Domination', sort_order:1 },
      { id:'mode-6', block_id:'blk-cod', title:'بتل‌رویال', description:'دراپ گروهی، جمع‌کردن لوت و بقا تا حلقه آخر با اسکواد کامل.', maps:'Squad, Duo', sort_order:2 }
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

/* ================= صفحه اعضا (بخش‌بندی‌شده بر اساس رنک) ================= */
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
      unknown.forEach(m=>grid.appendChild(buildMemberCard(m, staff, accounts)));
      sec.appendChild(grid);
      container.appendChild(sec);
    }
  }
}

async function deleteMember(id){
  if(!isStaff(currentUser)) return;
  if(!confirm('این اکانت حذف بشه؟')) return;
  await sb.from('team_join_messages').delete().eq('account_id',id);
  await sb.from('team_join_requests').delete().eq('account_id',id);
  const { error } = await sb.from('accounts').delete().eq('id',id);
  if(error) console.error(error);
  renderMembersPage();
}

let editingMemberId=null;
function openMemberModal(id, accountsCache){
  editingMemberId=id;
  const m=(accountsCache||[]).find(x=>x.id===id); if(!m) return;
  document.getElementById('memberModalTitle').textContent='ویرایش عضو';
  document.getElementById('mUser').value=m.username||'';
  document.getElementById('mRank').value=m.rank||'guest';
  document.getElementById('mGame').value=m.game||'';
  document.getElementById('memberModal').classList.add('show');
}

function wireMemberModal(){
  const overlay=document.getElementById('memberModal'); if(!overlay)return;
  document.getElementById('memberClose').addEventListener('click',()=>overlay.classList.remove('show'));
  document.getElementById('memberSave').addEventListener('click',async()=>{
    if(!isStaff(currentUser)||!editingMemberId)return;
    const data={username:document.getElementById('mUser').value.trim(),rank:document.getElementById('mRank').value,game:document.getElementById('mGame').value.trim()};
    const {error}=await sb.from('accounts').update(data).eq('id',editingMemberId);
    if(error){document.getElementById('memberMsg').innerHTML='<div class="form-msg err">خطا در ذخیره.</div>';return;}
    overlay.classList.remove('show'); renderMembersPage();
  });
}

/* ================= صفحه بازی‌ها (مدیریت محتوا توسط استاف) ================= */
