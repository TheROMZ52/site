// Designed & developed by TheROMZ52 for KillZone Team — 2026
/* ================= ثابت‌ها ================= */
const RANKS = [
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
    ${m.photo ? `<img class="avatar" src="${escapeHtml(m.photo)}" alt="${escapeHtml(m.username)}" onerror="this.outerHTML='<div class=avatar>${initials(m.username)}</div>'">`
              : `<div class="avatar">${initials(m.username)}</div>`}
    <h4>${escapeHtml(m.username)}</h4>
    <div class="rank-badge ${ADMIN_RANKS.includes(m.rank) ? 'staff' : ''}"><span class="tier">${rankChevrons(m.rank)}</span> ${escapeHtml(rankLabel(m.rank))}</div>
    <div class="game-tag">${escapeHtml(m.game || '—')}</div>
    ${staff ? `<div class="member-actions">
      <button class="icon-btn edit" data-id="${m.id}">ویرایش</button>
      <button class="icon-btn del" data-id="${m.id}">حذف</button>
    </div>` : ''}
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
    // عضوهایی با رنک ناشناخته (ایمنی در برابر داده‌های قدیمی)
    const known = new Set(orderHighToLow);
    const unknown = accounts.filter(a=>!known.has(a.rank));
    if(unknown.length){
      const sec = document.createElement('div');
      sec.innerHTML = `<div class="rank-heading"><h3>سایر</h3><div class="rule"></div></div>`;
      const grid = document.createElement('div');
      grid.className = 'member-grid';
      unknown.forEach(m=> grid.appendChild(buildMemberCard(m, staff, accounts)));
      sec.appendChild(grid);
      container.appendChild(sec);
    }
  }

  const addBtn = document.getElementById('addMemberBtn');
  if(addBtn) addBtn.style.display = staff ? 'inline-block' : 'none';
}

async function deleteMember(id){
  if(!isStaff(currentUser)) return;
  if(id === currentUser.id){ alert('نمی‌تونی اکانت خودت رو حذف کنی.'); return; }
  if(!confirm('این عضو حذف بشه؟')) return;
  const { error } = await sb.from('accounts').delete().eq('id', id);
  if(error) console.error(error);
  renderMembersPage();
}

/* ================= مودال ویرایش/افزودن عضو ================= */
let editingId = null;

function buildGameCheckboxes(containerId, selectedNames){
  fetchGameNames().then(names=>{
    const box = document.getElementById(containerId);
    if(!box) return;
    if(names.length === 0){
      box.innerHTML = '<div class="hint">هنوز بازی‌ای تعریف نشده.</div>';
      return;
    }
    box.innerHTML = names.map(n=>{
      const checked = selectedNames.includes(n) ? 'checked' : '';
      const safeId = 'gm-' + containerId + '-' + n.replace(/[^a-zA-Z0-9آ-ی]/g,'');
      return `<label style="display:flex; align-items:center; gap:8px; font-size:14px; padding:6px 0;">
        <input type="checkbox" value="${escapeHtml(n)}" id="${safeId}" class="${containerId}-check"> ${escapeHtml(n)}
      </label>`;
    }).join('');
  });
}
function getCheckedGames(containerId){
  return Array.from(document.querySelectorAll('.'+containerId+'-check:checked')).map(el=>el.value);
}

function openMemberModal(id, accountsCache){
  editingId = id;
  const msg = document.getElementById('memberMsg');
  if(msg) msg.innerHTML = '';
  document.getElementById('mNewPass').value = '';
  document.getElementById('mPhotoFile').value = '';
  let currentGames = [];
  if(id){
    const m = (accountsCache || []).find(x=>x.id===id);
    document.getElementById('memberModalTitle').textContent = 'ویرایش عضو';
    document.getElementById('mName').value = m?.username || '';
    document.getElementById('mPhoto').value = m?.photo || '';
    document.getElementById('mRank').value = m?.rank || 'new_member';
    currentGames = (m?.game || '').split('،').map(s=>s.trim()).filter(Boolean);
  }else{
    document.getElementById('memberModalTitle').textContent = 'افزودن عضو دستی';
    document.getElementById('mName').value = '';
    document.getElementById('mPhoto').value = '';
    document.getElementById('mRank').value = 'new_member';
  }
  buildGameCheckboxes('mGamesBox', currentGames);
  document.getElementById('memberOverlay').classList.add('show');
}

function wireMemberModal(){
  const overlay = document.getElementById('memberOverlay');
  if(!overlay) return;
  document.getElementById('memberClose').addEventListener('click', ()=>overlay.classList.remove('show'));
  const addBtn = document.getElementById('addMemberBtn');
  if(addBtn) addBtn.addEventListener('click', ()=>openMemberModal(null, []));

  document.getElementById('mPhotoFile').addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const msg = document.getElementById('memberMsg');
    const url = await uploadPhoto(file, (type, text)=>{ msg.innerHTML = `<div class="form-msg ${type}">${escapeHtml(text)}</div>`; });
    if(url) document.getElementById('mPhoto').value = url;
  });

  document.getElementById('memberSave').addEventListener('click', async ()=>{
    const username = document.getElementById('mName').value.trim();
    const msg = document.getElementById('memberMsg');
    if(!username){ msg.innerHTML = '<div class="form-msg err">نام‌کاربری رو وارد کن.</div>'; return; }

    const { data: dup } = await sb.from('accounts').select('id').ilike('username', username).neq('id', editingId || '___none___').maybeSingle();
    if(dup){ msg.innerHTML = '<div class="form-msg err">این نام‌کاربری قبلاً استفاده شده.</div>'; return; }

    const data = {
      username,
      photo: document.getElementById('mPhoto').value.trim(),
      rank: document.getElementById('mRank').value,
      game: getCheckedGames('mGamesBox').join('، ')
    };
    const newPass = document.getElementById('mNewPass').value;

    if(editingId){
      if(newPass && newPass.length>=4){ data.pass_hash = await hashPass(newPass); }
      const { error } = await sb.from('accounts').update(data).eq('id', editingId);
      if(error){ msg.innerHTML = '<div class="form-msg err">خطا در ذخیره.</div>'; console.error(error); return; }
      if(currentUser && editingId===currentUser.id){
        currentUser = { ...currentUser, ...data };
        saveSession(currentUser);
        renderUserBox();
      }
    }else{
      const newAcc = {
        id: 'm-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),
        pass_hash: await hashPass(newPass && newPass.length>=4 ? newPass : Math.random().toString(36).slice(2,10)),
        is_admin: false,
        ...data
      };
      const { error } = await sb.from('accounts').insert([newAcc]);
      if(error){ msg.innerHTML = '<div class="form-msg err">خطا در ذخیره.</div>'; console.error(error); return; }
    }

    overlay.classList.remove('show');
    renderMembersPage();
  });
}

/* ================= صفحه ثبت‌نام ================= */
let regPhotoUrl = '';

function wireRegisterForm(){
  const form = document.getElementById('regForm');
  if(!form) return;

  buildGameCheckboxes('regGamesBox', []);

  const fileInput = document.getElementById('regPhotoFile');
  if(fileInput){
    fileInput.addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const msg = document.getElementById('regMsg');
      const url = await uploadPhoto(file, (type, text)=>{ msg.innerHTML = `<div class="form-msg ${type}">${escapeHtml(text)}</div>`; });
      if(url) regPhotoUrl = url;
    });
  }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const username = document.getElementById('regName').value.trim();
    const pass = document.getElementById('regPass').value;
    const pass2 = document.getElementById('regPass2').value;
    const games = getCheckedGames('regGamesBox');
    const msg = document.getElementById('regMsg');

    if(!username || username.length<3){ msg.innerHTML = '<div class="form-msg err">نام‌کاربری باید حداقل ۳ کاراکتر باشه.</div>'; return; }
    if(pass.length<4){ msg.innerHTML = '<div class="form-msg err">رمز باید حداقل ۴ کاراکتر باشه.</div>'; return; }
    if(pass !== pass2){ msg.innerHTML = '<div class="form-msg err">تکرار رمز مطابقت نداره.</div>'; return; }

    const res = await registerUser(username, pass, games.join('، '), regPhotoUrl);
    if(!res.ok){ msg.innerHTML = `<div class="form-msg err">${escapeHtml(res.msg)}</div>`; return; }

    currentUser = res.account;
    saveSession(res.account);
    form.reset();
    regPhotoUrl = '';
    msg.innerHTML = '<div class="form-msg ok">اکانتت ساخته شد و وارد شدی! رنکت رو مدیریت تیم بعداً ارتقا می‌ده. ✔</div>';
    renderUserBox();
    setTimeout(()=>{ window.location.href = 'members.html'; }, 900);
  });
}

/* ================= خانه: آمار ================= */
async function renderHomeStats(){
  const elMembers = document.getElementById('statMembers');
  const elGames = document.getElementById('statGames');
  const elModes = document.getElementById('statModes');
  if(elMembers){ const accounts = await fetchAccounts(); elMembers.textContent = accounts.length; }
  if(elGames || elModes){
    const { blocks, modes } = await fetchGameData();
    if(elGames) elGames.textContent = blocks.length;
    if(elModes) elModes.textContent = modes.length;
  }
}

/* ================= منوی موبایل ================= */
function wireMobileNav(){
  const btn = document.getElementById('menuToggle');
  const nav = document.querySelector('nav.main');
  if(!btn || !nav) return;
  btn.addEventListener('click', ()=> nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> nav.classList.remove('open')));
}

/* ================= رابیکا ================= */
function wireRubikaLinks(){
  document.querySelectorAll('.rubika-link').forEach(a=>{
    a.href = RUBIKA_LINK;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}

/* ================= صفحه بازی‌ها (مدیریت محتوا توسط استاف) ================= */
async function renderGamesPage(){
  const container = document.getElementById('gamesContainer');
  if(!container) return;
  container.innerHTML = '<div class="loading-note">در حال بارگذاری...</div>';
  const { blocks, modes } = await fetchGameData();
  container.innerHTML = '';
  const staff = isStaff(currentUser);

  if(blocks.length === 0){
    container.innerHTML = '<div class="empty-note">هنوز بازی‌ای اضافه نشده.</div>';
  }

  blocks.forEach(block=>{
    const blockModes = modes.filter(m=>m.block_id===block.id);
    const wrap = document.createElement('div');
    wrap.className = 'game-block';
    wrap.innerHTML = `
      <div class="game-banner ${escapeHtml(block.theme || 'neutral')}">
        <div class="accent-strip"></div>
        <div class="game-banner-body">
          <h3>${escapeHtml(block.name)}</h3>
          <div style="display:flex; align-items:center; gap:10px;">
            ${block.tag ? `<span class="tag">${escapeHtml(block.tag)}</span>` : ''}
            ${staff ? `
              <button class="icon-btn edit-block" data-id="${block.id}">ویرایش</button>
              <button class="icon-btn del del-block" data-id="${block.id}">حذف</button>
            ` : ''}
          </div>
        </div>
      </div>
      <div class="mode-grid"></div>
      ${staff ? `<button class="btn ghost small add-mode" data-block="${block.id}" style="margin-top:14px;">+ افزودن مود</button>` : ''}
    `;
    container.appendChild(wrap);
    const grid = wrap.querySelector('.mode-grid');
    blockModes.forEach(m=>{
      const card = document.createElement('div');
      card.className = 'mode-card';
      const mapsChips = (m.maps||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>`<span>${escapeHtml(s)}</span>`).join('');
      card.innerHTML = `
        <h4>${escapeHtml(m.title)}</h4>
        <p>${escapeHtml(m.description)}</p>
        <div class="maps">${mapsChips}</div>
        ${staff ? `<div class="member-actions" style="margin-top:12px;">
          <button class="icon-btn edit-mode" data-id="${m.id}">ویرایش</button>
          <button class="icon-btn del del-mode" data-id="${m.id}">حذف</button>
        </div>` : ''}
      `;
      grid.appendChild(card);
    });
  });

  container.querySelectorAll('.edit-block').forEach(b=>b.addEventListener('click', ()=>openBlockModal(b.dataset.id, blocks)));
  container.querySelectorAll('.del-block').forEach(b=>b.addEventListener('click', ()=>deleteBlock(b.dataset.id)));
  container.querySelectorAll('.add-mode').forEach(b=>b.addEventListener('click', ()=>openModeModal(null, b.dataset.block)));
  container.querySelectorAll('.edit-mode').forEach(b=>b.addEventListener('click', ()=>openModeModal(b.dataset.id, null, modes)));
  container.querySelectorAll('.del-mode').forEach(b=>b.addEventListener('click', ()=>deleteMode(b.dataset.id)));

  const addGameBtn = document.getElementById('addGameBtn');
  if(addGameBtn) addGameBtn.style.display = staff ? 'inline-block' : 'none';
}

async function deleteBlock(id){
  if(!isStaff(currentUser)) return;
  if(!confirm('این بازی و همه‌ی مودهاش حذف بشه؟')) return;
  const { error } = await sb.from('game_blocks').delete().eq('id', id);
  if(error) console.error(error);
  renderGamesPage();
}
async function deleteMode(id){
  if(!isStaff(currentUser)) return;
  if(!confirm('این مود حذف بشه؟')) return;
  const { error } = await sb.from('game_modes').delete().eq('id', id);
  if(error) console.error(error);
  renderGamesPage();
}

let editingBlockId = null;
function openBlockModal(id, blocksCache){
  editingBlockId = id;
  const msg = document.getElementById('blockMsg');
  if(msg) msg.innerHTML = '';
  if(id){
    const b = (blocksCache||[]).find(x=>x.id===id);
    document.getElementById('blockModalTitle').textContent = 'ویرایش بازی';
    document.getElementById('bName').value = b?.name || '';
    document.getElementById('bTag').value = b?.tag || '';
    document.getElementById('bTheme').value = b?.theme || 'mc';
  }else{
    document.getElementById('blockModalTitle').textContent = 'افزودن بازی جدید';
    document.getElementById('bName').value = '';
    document.getElementById('bTag').value = '';
    document.getElementById('bTheme').value = 'mc';
  }
  document.getElementById('gameBlockOverlay').classList.add('show');
}

function wireGameBlockModal(){
  const overlay = document.getElementById('gameBlockOverlay');
  if(!overlay) return;
  document.getElementById('blockClose').addEventListener('click', ()=>overlay.classList.remove('show'));
  const addBtn = document.getElementById('addGameBtn');
  if(addBtn) addBtn.addEventListener('click', ()=>openBlockModal(null, []));

  document.getElementById('blockSave').addEventListener('click', async ()=>{
    const name = document.getElementById('bName').value.trim();
    const msg = document.getElementById('blockMsg');
    if(!name){ msg.innerHTML = '<div class="form-msg err">اسم بازی رو وارد کن.</div>'; return; }
    const data = {
      name,
      tag: document.getElementById('bTag').value.trim(),
      theme: document.getElementById('bTheme').value
    };
    if(editingBlockId){
      const { error } = await sb.from('game_blocks').update(data).eq('id', editingBlockId);
      if(error){ msg.innerHTML = '<div class="form-msg err">خطا در ذخیره.</div>'; console.error(error); return; }
    }else{
      const newBlock = { id:'blk-'+Date.now()+'-'+Math.random().toString(36).slice(2,6), ...data, sort_order: 999 };
      const { error } = await sb.from('game_blocks').insert([newBlock]);
      if(error){ msg.innerHTML = '<div class="form-msg err">خطا در ذخیره.</div>'; console.error(error); return; }
    }
    overlay.classList.remove('show');
    renderGamesPage();
    if(document.getElementById('statGames')) renderHomeStats();
  });
}

let editingModeId = null;
let editingModeBlockId = null;
function openModeModal(id, blockId, modesCache){
  editingModeId = id;
  editingModeBlockId = blockId;
  const msg = document.getElementById('modeMsg');
  if(msg) msg.innerHTML = '';
  if(id){
    const m = (modesCache||[]).find(x=>x.id===id);
    editingModeBlockId = m?.block_id;
    document.getElementById('modeModalTitle').textContent = 'ویرایش مود';
    document.getElementById('moTitle').value = m?.title || '';
    document.getElementById('moDesc').value = m?.description || '';
    document.getElementById('moMaps').value = m?.maps || '';
  }else{
    document.getElementById('modeModalTitle').textContent = 'افزودن مود جدید';
    document.getElementById('moTitle').value = '';
    document.getElementById('moDesc').value = '';
    document.getElementById('moMaps').value = '';
  }
  document.getElementById('gameModeOverlay').classList.add('show');
}

function wireGameModeModal(){
  const overlay = document.getElementById('gameModeOverlay');
  if(!overlay) return;
  document.getElementById('modeClose').addEventListener('click', ()=>overlay.classList.remove('show'));

  document.getElementById('modeSave').addEventListener('click', async ()=>{
    const title = document.getElementById('moTitle').value.trim();
    const msg = document.getElementById('modeMsg');
    if(!title){ msg.innerHTML = '<div class="form-msg err">اسم مود رو وارد کن.</div>'; return; }
    const data = {
      title,
      description: document.getElementById('moDesc').value.trim(),
      maps: document.getElementById('moMaps').value.trim()
    };
    if(editingModeId){
      const { error } = await sb.from('game_modes').update(data).eq('id', editingModeId);
      if(error){ msg.innerHTML = '<div class="form-msg err">خطا در ذخیره.</div>'; console.error(error); return; }
    }else{
      const newMode = { id:'mode-'+Date.now()+'-'+Math.random().toString(36).slice(2,6), block_id: editingModeBlockId, sort_order:999, ...data };
      const { error } = await sb.from('game_modes').insert([newMode]);
      if(error){ msg.innerHTML = '<div class="form-msg err">خطا در ذخیره.</div>'; console.error(error); return; }
    }
    overlay.classList.remove('show');
    renderGamesPage();
    if(document.getElementById('statModes')) renderHomeStats();
  });
}

/* ================= شروع هر صفحه ================= */
async function initPage(){
  // اول همه‌ی چیزهایی که به دیتابیس نیاز ندارن — این‌ها باید همیشه کار کنن
  wireMobileNav();
  wireRubikaLinks();
  wireLoginModal();
  wireMemberModal();
  wireRegisterForm();
  wireGameBlockModal();
  wireGameModeModal();

  // بعد کارهای مربوط به دیتابیس — اگه هرکدوم خطا بده، بقیه‌ی صفحه نباید بخوابه
  try{
    await ensureSeedAccounts();
    await ensureSeedGames();
    await initSession();
  }catch(e){
    console.error('اتصال به دیتابیس با مشکل مواجه شد:', e);
  }

  renderUserBox();
  if(document.getElementById('membersContainer')) renderMembersPage();
  if(document.getElementById('statMembers') || document.getElementById('statGames') || document.getElementById('statModes')) renderHomeStats();
  if(document.getElementById('gamesContainer')) renderGamesPage();
}
document.addEventListener('DOMContentLoaded', initPage);

/* ================= امضا (فقط تو کنسول، رو سایت دیده نمی‌شه) ================= */
console.log('%cKILLZONE', 'color:#e0a93a; font-size:22px; font-weight:bold; font-family:sans-serif;');
console.log('%cDesigned & developed by TheROMZ52', 'color:#8ea34e; font-size:12px;');
