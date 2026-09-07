// Designed & developed by TheROMZ52 for KillZone Team — 2026
// KillZone application core — single, resilient source of truth for session, data, page rendering and CRUD UI.
(function(){
  'use strict';

  const RANKS = [
    {key:'guest',label:'مهمان'},
    {key:'new_member',label:'نیو ممبر'},
    {key:'member',label:'ممبر'},
    {key:'admin',label:'ادمین'},
    {key:'developer',label:'دولوپر'},
    {key:'co_owner',label:'کو-اونر'},
    {key:'owner',label:'اونر'}
  ];
  const ADMIN_RANKS=['admin','developer','co_owner','owner'];
  const SESSION_KEY='kz_session';
  const RUBIKA_LINK='https://rubika.ir/joing/BBEDHCIEG0CUGHJUEJWPLKHRDAWOCCSB';
  let currentUser=null;
  let booted=false;
  let renderGeneration=0;
  let editingMemberId=null;
  let editingBlockId=null;
  let editingModeId=null;
  let editingModeBlockId=null;

  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const rankLabel=key=>RANKS.find(r=>r.key===key)?.label||key||'نامشخص';
  const rankTier=key=>Math.max(1,RANKS.findIndex(r=>r.key===key)+1);
  const rankChevrons=key=>'▲'.repeat(rankTier(key));
  const initials=name=>(String(name||'?').trim().slice(0,2)||'?').toUpperCase();
  const isStaff=u=>!!(u&&ADMIN_RANKS.includes(u.rank));
  const isReviewer=u=>!!(u&&['developer','co_owner','owner'].includes(u.rank));
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  async function hashPass(password){
    const value=String(password??'');
    try{
      const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
      return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
    }catch(e){
      let h=0; for(let i=0;i<value.length;i++) h=((h<<5)-h)+value.charCodeAt(i)|0;
      return 'fallback-'+h;
    }
  }

  async function uploadPhoto(file,onStatus){
    if(!file)return null;
    const allowed=['image/jpeg','image/png','image/webp'];
    if(!allowed.includes(file.type)){onStatus?.('err','فقط JPG، PNG یا WEBP مجازه.');return null;}
    if(file.size>5*1024*1024){onStatus?.('err','حجم عکس باید کمتر از ۵ مگابایت باشه.');return null;}
    onStatus?.('ok','در حال آپلود عکس...');
    try{
      const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
      const path=`u-${Date.now()}-${Math.random().toString(36).slice(2,9)}.${ext}`;
      const {error}=await sb.storage.from('avatars').upload(path,file,{upsert:false,cacheControl:'3600'});
      if(error)throw error;
      const {data}=sb.storage.from('avatars').getPublicUrl(path);
      onStatus?.('ok','عکس آپلود شد ✔');
      return data?.publicUrl||null;
    }catch(e){console.error('KillZone uploadPhoto',e);onStatus?.('err','آپلود عکس ناموفق بود.');return null;}
  }

  function saveSession(account){if(account?.id)localStorage.setItem(SESSION_KEY,JSON.stringify({id:account.id}));}
  function clearSession(){localStorage.removeItem(SESSION_KEY);}
  function getSessionId(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')?.id||null;}catch{return null;}}

  async function initSession(){
    const id=getSessionId();
    if(!id){currentUser=null;return null;}
    try{
      const {data,error}=await sb.from('accounts').select('*').eq('id',id).maybeSingle();
      if(error||!data){clearSession();currentUser=null;return null;}
      currentUser=data;
      return data;
    }catch(e){console.error('KillZone initSession',e);return null;}
  }

  async function fetchAccounts(){
    try{
      const {data,error}=await sb.from('accounts').select('*').order('username',{ascending:true});
      if(error)throw error;
      return data||[];
    }catch(e){console.error('KillZone fetchAccounts',e);return [];}
  }

  async function loginUser(username,password){
    const name=String(username||'').trim();
    if(!name||!password)return {ok:false,msg:'یوزرنیم و رمز رو وارد کن.'};
    try{
      const {data,error}=await sb.from('accounts').select('*').ilike('username',name).maybeSingle();
      if(error)throw error;
      if(!data)return {ok:false,msg:'همچین اکانتی پیدا نشد.'};
      if(await hashPass(password)!==data.pass_hash)return {ok:false,msg:'رمز اشتباهه.'};
      return {ok:true,account:data};
    }catch(e){console.error('KillZone loginUser',e);return {ok:false,msg:'ارتباط با سرور ناموفق بود. دوباره تلاش کن.'};}
  }

  async function registerUser(username,password,game='',photo=''){
    const name=String(username||'').trim();
    if(!/^[A-Za-z0-9_.-]{3,32}$/.test(name))return {ok:false,msg:'نام‌کاربری باید ۳ تا ۳۲ کاراکتر و فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشه.'};
    if(String(password||'').length<6)return {ok:false,msg:'رمز عبور باید حداقل ۶ کاراکتر باشه.'};
    try{
      const {data:existing,error:checkError}=await sb.from('accounts').select('id').ilike('username',name).maybeSingle();
      if(checkError)throw checkError;
      if(existing)return {ok:false,msg:'این نام‌کاربری قبلاً گرفته شده.'};
      const account={id:`m-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,username:name,pass_hash:await hashPass(password),rank:'guest',game:String(game||''),photo:String(photo||''),is_admin:false,team_status:'none'};
      const {error}=await sb.from('accounts').insert([account]);
      if(error)throw error;
      return {ok:true,account};
    }catch(e){console.error('KillZone registerUser',e);return {ok:false,msg:'ثبت‌نام ناموفق بود. دوباره تلاش کن.'};}
  }

  async function fetchGameData(){
    try{
      const [blocksResult,modesResult]=await Promise.all([
        sb.from('game_blocks').select('*').order('sort_order',{ascending:true}),
        sb.from('game_modes').select('*').order('sort_order',{ascending:true})
      ]);
      if(blocksResult.error)throw blocksResult.error;
      if(modesResult.error)throw modesResult.error;
      return {blocks:blocksResult.data||[],modes:modesResult.data||[]};
    }catch(e){console.error('KillZone fetchGameData',e);return {blocks:[],modes:[]};}
  }
  async function fetchGameNames(){const {blocks}=await fetchGameData();return blocks.map(b=>b.name).filter(Boolean);}

  function renderUserBox(){
    const box=$('userBox');if(!box)return;
    if(currentUser){
      box.innerHTML=`<div class="user-chip"><span class="tier">${rankChevrons(currentUser.rank)}</span><span>${esc(currentUser.username)}</span><span class="rk">${esc(rankLabel(currentUser.rank))}</span></div>${isStaff(currentUser)?'<span class="admin-btn on">حالت مدیریت فعاله</span>':''}<button class="link-btn" id="logoutBtn">خروج</button>`;
      $('logoutBtn')?.addEventListener('click',()=>{currentUser=null;clearSession();window.currentUser=null;renderUserBox();safeRenderCurrentPage();});
    }else{
      box.innerHTML='<button class="link-btn" id="loginOpenBtn">🔒 ورود</button>';
      $('loginOpenBtn')?.addEventListener('click',()=>{$('loginMsg')&&( $('loginMsg').innerHTML='');$('loginOverlay')?.classList.add('show');$('loginUser')?.focus();});
    }
    if(typeof window.kzRefreshMembershipUI==='function')window.kzRefreshMembershipUI();
  }

  function wireLoginModal(){
    const overlay=$('loginOverlay');if(!overlay||overlay.dataset.kzCoreReady==='1')return;
    overlay.dataset.kzCoreReady='1';
    $('loginClose')?.addEventListener('click',()=>overlay.classList.remove('show'));
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});
    const submit=async()=>{
      const username=$('loginUser')?.value.trim()||'';const pass=$('loginPass')?.value||'';const msg=$('loginMsg');
      if(!username||!pass){if(msg)msg.innerHTML='<div class="form-msg err">یوزرنیم و رمز رو وارد کن.</div>';return;}
      const btn=$('loginSubmit');if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');}
      try{
        const res=await loginUser(username,pass);
        if(!res.ok){if(msg)msg.innerHTML=`<div class="form-msg err">${esc(res.msg)}</div>`;return;}
        currentUser=res.account;window.currentUser=currentUser;saveSession(currentUser);overlay.classList.remove('show');$('loginUser').value='';$('loginPass').value='';renderUserBox();safeRenderCurrentPage();
      }finally{if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');}}
    };
    $('loginSubmit')?.addEventListener('click',submit);
    [$('loginUser'),$('loginPass')].forEach(input=>input?.addEventListener('keydown',e=>{if(e.key==='Enter')submit();}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')overlay.classList.remove('show');},{passive:true});
  }

  function memberCard(member,staff,accounts){
    const card=document.createElement('article');card.className='member-tile';card.dataset.accountId=member.id;
    const photo=member.photo?`<img class="avatar" src="${esc(member.photo)}" alt="${esc(member.username)}" loading="lazy" decoding="async">`:`<div class="avatar">${esc(initials(member.username))}</div>`;
    card.innerHTML=`${photo}<h4>${esc(member.username)}</h4><div class="rank-badge ${ADMIN_RANKS.includes(member.rank)?'staff':''}"><span class="tier">${rankChevrons(member.rank)}</span> ${esc(rankLabel(member.rank))}</div><div class="game-tag">${esc(member.game||'—')}</div>${staff?`<div class="member-actions"><button class="icon-btn edit" data-id="${esc(member.id)}">ویرایش</button><button class="icon-btn del" data-id="${esc(member.id)}">حذف</button></div>`:''}<div class="kz-presence-slot" aria-live="polite"></div>`;
    const img=card.querySelector('img');img?.addEventListener('error',()=>{const fallback=document.createElement('div');fallback.className='avatar';fallback.textContent=initials(member.username);img.replaceWith(fallback);},{once:true});
    if(staff){card.querySelector('.edit')?.addEventListener('click',()=>openMemberModal(member.id,accounts));card.querySelector('.del')?.addEventListener('click',()=>deleteMember(member.id));}
    return card;
  }

  async function renderMembersPage(){
    const container=$('membersContainer');if(!container)return;
    const token=++renderGeneration;container.innerHTML='<div class="loading-note kz-skeleton-list"><span>در حال بارگذاری اعضا...</span></div>';
    const accounts=await fetchAccounts();if(token!==renderGeneration)return;container.innerHTML='';
    const approved=accounts.filter(a=>a.team_status==='approved'||a.team_status==null||['owner','co_owner','developer','admin','member','new_member'].includes(a.rank));
    const visible=approved.filter(a=>a.team_status!=='none'&&a.rank!=='guest');
    const staff=isStaff(currentUser);
    if(!visible.length){container.innerHTML='<div class="empty-note">هنوز عضو تأییدشده‌ای برای نمایش وجود نداره.</div>';return;}
    [...RANKS].reverse().forEach(rank=>{
      const group=visible.filter(a=>a.rank===rank.key);if(!group.length)return;
      const section=document.createElement('section');section.className='rank-section';section.innerHTML=`<div class="rank-heading"><span class="tier">${rankChevrons(rank.key)}</span><h3>${esc(rank.label)}</h3><div class="rule"></div></div>`;
      const grid=document.createElement('div');grid.className='member-grid';group.forEach(m=>grid.appendChild(memberCard(m,staff,visible)));section.appendChild(grid);container.appendChild(section);
    });
    if(typeof window.wireMemberModal==='function')window.wireMemberModal();
  }

  async function deleteMember(id){
    if(!isStaff(currentUser)||!id)return;
    if(!confirm('این اکانت و درخواست‌های مرتبط باهاش حذف بشه؟'))return;
    try{
      const [messages,requests,account]=await Promise.all([
        sb.from('team_join_messages').delete().eq('account_id',id),
        sb.from('team_join_requests').delete().eq('account_id',id),
        sb.from('member_presence').delete().eq('account_id',id)
      ]);
      if(messages.error)throw messages.error;if(requests.error)throw requests.error;if(account.error)throw account.error;
      const {error}=await sb.from('accounts').delete().eq('id',id);if(error)throw error;
      renderMembersPage();
    }catch(e){console.error(e);alert('حذف عضو انجام نشد.');}
  }

  function openMemberModal(id,accountsCache){
    if(!isStaff(currentUser))return;editingMemberId=id||null;const m=(accountsCache||[]).find(x=>x.id===id);
    $('memberModalTitle')?.replaceChildren(document.createTextNode(id?'ویرایش عضو':'افزودن عضو دستی'));
    $('mName')&&($('mName').value=m?.username||'');$('mPhoto')&&($('mPhoto').value=m?.photo||'');$('mRank')&&($('mRank').value=m?.rank||'new_member');$('mNewPass')&&($('mNewPass').value='');$('memberMsg')&&($('memberMsg').innerHTML='');$('memberOverlay')?.classList.add('show');
    loadMemberGameChecks(m?.game||'');
  }
  async function loadMemberGameChecks(selected){
    const box=$('mGamesBox');if(!box)return;box.innerHTML='<div class="hint">در حال بارگذاری بازی‌ها...</div>';const names=await fetchGameNames();const selectedSet=new Set(String(selected).split('،').map(s=>s.trim()).filter(Boolean));box.innerHTML=names.map((name,i)=>`<label class="kz-game-check"><input type="checkbox" value="${esc(name)}" ${selectedSet.has(name)?'checked':''}> ${esc(name)}</label>`).join('')||'<div class="hint">هنوز بازی‌ای تعریف نشده.</div>';
  }
  function wireMemberModal(){
    const overlay=$('memberOverlay');if(!overlay||overlay.dataset.kzCoreReady==='1')return;overlay.dataset.kzCoreReady='1';
    $('memberClose')?.addEventListener('click',()=>overlay.classList.remove('show'));overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show');});
    $('addMemberBtn')?.addEventListener('click',()=>openMemberModal(null,[]));
    $('mPhotoFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const url=await uploadPhoto(file,(type,text)=>{const msg=$('memberMsg');if(msg)msg.innerHTML=`<div class="form-msg ${type}">${esc(text)}</div>`;});if(url&&$('mPhoto'))$('mPhoto').value=url;});
    $('memberSave')?.addEventListener('click',saveMember);
  }
  async function saveMember(){
    if(!isStaff(currentUser))return;const msg=$('memberMsg');const name=$('mName')?.value.trim()||'';if(!name){if(msg)msg.innerHTML='<div class="form-msg err">نام‌کاربری رو وارد کن.</div>';return;}
    const btn=$('memberSave');if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');}
    try{
      const {data:dup,error:dupError}=await sb.from('accounts').select('id').ilike('username',name).neq('id',editingMemberId||'__none__').maybeSingle();if(dupError)throw dupError;if(dup){if(msg)msg.innerHTML='<div class="form-msg err">این نام‌کاربری قبلاً استفاده شده.</div>';return;}
      const games=[...document.querySelectorAll('#mGamesBox input[type="checkbox"]:checked')].map(x=>x.value).join('، ');
      const data={username:name,photo:$('mPhoto')?.value.trim()||'',rank:$('mRank')?.value||'member',game:games};const newPass=$('mNewPass')?.value||'';if(newPass)data.pass_hash=await hashPass(newPass);
      if(editingMemberId){const {error}=await sb.from('accounts').update(data).eq('id',editingMemberId);if(error)throw error;}else{data.id=`m-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;data.pass_hash=data.pass_hash||await hashPass(Math.random().toString(36).slice(2,10));data.is_admin=ADMIN_RANKS.includes(data.rank);data.team_status=data.rank==='guest'?'none':'approved';const {error}=await sb.from('accounts').insert([data]);if(error)throw error;}
      $('memberOverlay')?.classList.remove('show');renderMembersPage();
    }catch(e){console.error(e);if(msg)msg.innerHTML='<div class="form-msg err">ذخیره عضو ناموفق بود.</div>';}finally{if(btn){btn.disabled=false;btn.removeAttribute('aria-busy');}}
  }

  function gameCard(block,modes,staff){
    const wrap=document.createElement('section');wrap.className='game-block';const blockModes=modes.filter(m=>m.block_id===block.id);
    wrap.innerHTML=`<div class="game-banner ${esc(block.theme||'neutral')}"><div class="accent-strip"></div><div class="game-banner-body"><div><h3>${esc(block.name)}</h3>${block.tag?`<span class="tag">${esc(block.tag)}</span>`:''}</div>${staff?`<div class="game-admin-actions"><button class="icon-btn edit-block" data-id="${esc(block.id)}">ویرایش</button><button class="icon-btn del del-block" data-id="${esc(block.id)}">حذف</button></div>`:''}</div></div><div class="mode-grid"></div>${staff?`<button class="btn ghost small add-mode" data-block="${esc(block.id)}" style="margin-top:14px;">+ افزودن مود</button>`:''}`;
    const grid=wrap.querySelector('.mode-grid');
    blockModes.forEach(mode=>{const card=document.createElement('article');card.className='mode-card';const chips=String(mode.maps||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>`<span>${esc(s)}</span>`).join('');card.innerHTML=`<h4>${esc(mode.title)}</h4><p>${esc(mode.description||'')}</p><div class="maps">${chips}</div>${staff?`<div class="member-actions"><button class="icon-btn edit-mode" data-id="${esc(mode.id)}">ویرایش</button><button class="icon-btn del del-mode" data-id="${esc(mode.id)}">حذف</button></div>`:''}`;grid.appendChild(card);});
    wrap.querySelectorAll('.edit-block').forEach(b=>b.addEventListener('click',()=>openBlockModal(b.dataset.id,window.__kzGameCache?.blocks||[])));wrap.querySelectorAll('.del-block').forEach(b=>b.addEventListener('click',()=>deleteBlock(b.dataset.id)));wrap.querySelectorAll('.add-mode').forEach(b=>b.addEventListener('click',()=>openModeModal(null,b.dataset.block,window.__kzGameCache?.modes||[])));wrap.querySelectorAll('.edit-mode').forEach(b=>b.addEventListener('click',()=>openModeModal(b.dataset.id,null,window.__kzGameCache?.modes||[])));wrap.querySelectorAll('.del-mode').forEach(b=>b.addEventListener('click',()=>deleteMode(b.dataset.id)));
    return wrap;
  }

  async function renderGamesPage(){
    const container=$('gamesContainer');if(!container)return;const token=++renderGeneration;container.innerHTML='<div class="loading-note">در حال بارگذاری بازی‌ها...</div>';
    try{const data=await fetchGameData();if(token!==renderGeneration)return;window.__kzGameCache=data;container.innerHTML='';const staff=isStaff(currentUser);if(!data.blocks.length){container.innerHTML='<div class="empty-note">هنوز بازی‌ای اضافه نشده.</div>';return;}data.blocks.forEach(block=>container.appendChild(gameCard(block,data.modes,staff)));$('addGameBtn')?.style.setProperty('display',staff?'inline-flex':'none');wireGameModals();}
    catch(e){console.error(e);container.innerHTML='<div class="form-msg err">بارگذاری بازی‌ها ناموفق بود. دوباره تلاش کن.</div>';}
  }

  async function deleteBlock(id){if(!isStaff(currentUser)||!id||!confirm('این بازی و مودهای وابسته بهش حذف بشن؟'))return;try{const {error}=await sb.from('game_modes').delete().eq('block_id',id);if(error)throw error;const result=await sb.from('game_blocks').delete().eq('id',id);if(result.error)throw result.error;renderGamesPage();}catch(e){console.error(e);alert('حذف بازی انجام نشد.');}}
  async function deleteMode(id){if(!isStaff(currentUser)||!id||!confirm('این مود حذف بشه؟'))return;try{const {error}=await sb.from('game_modes').delete().eq('id',id);if(error)throw error;renderGamesPage();}catch(e){console.error(e);alert('حذف مود انجام نشد.');}}

  function openBlockModal(id,blocks){if(!isStaff(currentUser))return;editingBlockId=id||null;const b=(blocks||[]).find(x=>x.id===id);if($('blockModalTitle'))$('blockModalTitle').textContent=id?'ویرایش بازی':'افزودن بازی جدید';if($('bName'))$('bName').value=b?.name||'';if($('bTag'))$('bTag').value=b?.tag||'';if($('bTheme'))$('bTheme').value=b?.theme||'neutral';if($('blockMsg'))$('blockMsg').innerHTML='';$('gameBlockOverlay')?.classList.add('show');}
  function openModeModal(id,blockId,modes){if(!isStaff(currentUser))return;editingModeId=id||null;editingModeBlockId=blockId||null;const m=(modes||[]).find(x=>x.id===id);if(id)editingModeBlockId=m?.block_id||null;if($('modeModalTitle'))$('modeModalTitle').textContent=id?'ویرایش مود':'افزودن مود جدید';if($('moTitle'))$('moTitle').value=m?.title||'';if($('moDesc'))$('moDesc').value=m?.description||'';if($('moMaps'))$('moMaps').value=m?.maps||'';if($('modeMsg'))$('modeMsg').innerHTML='';$('gameModeOverlay')?.classList.add('show');}
  function wireGameModals(){
    const blockOverlay=$('gameBlockOverlay');if(blockOverlay&&blockOverlay.dataset.kzCoreReady!=='1'){blockOverlay.dataset.kzCoreReady='1';$('blockClose')?.addEventListener('click',()=>blockOverlay.classList.remove('show'));blockOverlay.addEventListener('click',e=>{if(e.target===blockOverlay)blockOverlay.classList.remove('show');});$('addGameBtn')?.addEventListener('click',()=>openBlockModal(null,[]));$('blockSave')?.addEventListener('click',saveBlock);}
    const modeOverlay=$('gameModeOverlay');if(modeOverlay&&modeOverlay.dataset.kzCoreReady!=='1'){modeOverlay.dataset.kzCoreReady='1';$('modeClose')?.addEventListener('click',()=>modeOverlay.classList.remove('show'));modeOverlay.addEventListener('click',e=>{if(e.target===modeOverlay)modeOverlay.classList.remove('show');});$('modeSave')?.addEventListener('click',saveMode);}
  }
  async function saveBlock(){if(!isStaff(currentUser))return;const msg=$('blockMsg');const name=$('bName')?.value.trim()||'';if(!name){if(msg)msg.innerHTML='<div class="form-msg err">اسم بازی رو وارد کن.</div>';return;}const btn=$('blockSave');btn&&(btn.disabled=true);try{const data={name,tag:$('bTag')?.value.trim()||'',theme:$('bTheme')?.value||'neutral'};let result;if(editingBlockId)result=await sb.from('game_blocks').update(data).eq('id',editingBlockId);else result=await sb.from('game_blocks').insert([{id:`blk-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,sort_order:(window.__kzGameCache?.blocks?.length||0)+1,...data}]);if(result.error)throw result.error;$('gameBlockOverlay')?.classList.remove('show');renderGamesPage();}catch(e){console.error(e);if(msg)msg.innerHTML='<div class="form-msg err">ذخیره بازی ناموفق بود.</div>';}finally{btn&&(btn.disabled=false);}}
  async function saveMode(){if(!isStaff(currentUser))return;const msg=$('modeMsg');const title=$('moTitle')?.value.trim()||'';if(!title){if(msg)msg.innerHTML='<div class="form-msg err">اسم مود رو وارد کن.</div>';return;}if(!editingModeBlockId){if(msg)msg.innerHTML='<div class="form-msg err">بازی مربوط به این مود مشخص نیست.</div>';return;}const btn=$('modeSave');btn&&(btn.disabled=true);try{const data={block_id:editingModeBlockId,title,description:$('moDesc')?.value.trim()||'',maps:$('moMaps')?.value.trim()||''};let result;if(editingModeId)result=await sb.from('game_modes').update(data).eq('id',editingModeId);else result=await sb.from('game_modes').insert([{id:`mode-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,sort_order:(window.__kzGameCache?.modes?.filter(m=>m.block_id===editingModeBlockId).length||0)+1,...data}]);if(result.error)throw result.error;$('gameModeOverlay')?.classList.remove('show');renderGamesPage();}catch(e){console.error(e);if(msg)msg.innerHTML='<div class="form-msg err">ذخیره مود ناموفق بود.</div>';}finally{btn&&(btn.disabled=false);}}

  async function renderHomeStats(){
    const targets=[['statMembers','accounts'],['statGames','game_blocks'],['statModes','game_modes']];
    await Promise.all(targets.map(async([id,table])=>{const el=$(id);if(!el)return;try{const {count,error}=await sb.from(table).select('id',{count:'exact',head:true});if(error)throw error;el.textContent=String(count??0);}catch(e){console.error('KillZone stats',table,e);el.textContent='—';}}));
  }

  async function renderRegisterPage(){
    const form=$('regForm');if(!form||form.dataset.kzCoreReady==='1')return;form.dataset.kzCoreReady='1';const msg=$('regMsg');
    form.addEventListener('submit',async e=>{e.preventDefault();const username=$('regName')?.value.trim()||'';const password=$('regPass')?.value||'';const btn=form.querySelector('button[type="submit"]');if(!/^[A-Za-z0-9_.-]{3,32}$/.test(username)){msg.innerHTML='<div class="form-msg err">نام‌کاربری باید ۳ تا ۳۲ کاراکتر انگلیسی باشد.</div>';return;}if(password.length<6){msg.innerHTML='<div class="form-msg err">رمز عبور باید حداقل ۶ کاراکتر باشه.</div>';return;}btn&&(btn.disabled=true);try{const res=await registerUser(username,password,'','');if(!res.ok){msg.innerHTML=`<div class="form-msg err">${esc(res.msg)}</div>`;return;}currentUser=res.account;window.currentUser=currentUser;saveSession(currentUser);renderUserBox();msg.innerHTML='<div class="form-msg ok">اکانت مهمانت ساخته شد. حالا درخواست عضویت بده. ✔</div>';form.reset();setTimeout(()=>location.href='/join',650);}catch(e){console.error(e);msg.innerHTML='<div class="form-msg err">ثبت‌نام ناموفق بود.</div>';}finally{btn&&(btn.disabled=false);}});
  }

  async function waitForSupabase(){for(let i=0;i<80;i++){if(typeof sb!=='undefined'&&sb?.from)return true;await wait(100);}return false;}

  async function boot(){
    if(booted)return;booted=true;
    const ready=await waitForSupabase();if(!ready){console.error('KillZone: Supabase client unavailable');document.querySelectorAll('.loading-note').forEach(el=>el.innerHTML='<span>ارتباط با دیتابیس برقرار نشد.</span>');return;}
    try{await initSession();window.currentUser=currentUser;}catch(e){console.error(e);}
    renderUserBox();wireLoginModal();
    if($('membersContainer')){wireMemberModal();await renderMembersPage();}
    if($('gamesContainer')){wireGameModals();await renderGamesPage();}
    if($('statMembers')||$('statGames')||$('statModes'))renderHomeStats();
    if($('regForm'))renderRegisterPage();
    document.querySelectorAll('.rubika-link').forEach(link=>{if(currentUser?.team_status==='approved')link.href=RUBIKA_LINK;});
    document.documentElement.classList.add('kz-app-ready');
  }

  async function safeRenderCurrentPage(){
    try{if($('membersContainer'))await renderMembersPage();if($('gamesContainer'))await renderGamesPage();if($('statMembers')||$('statGames')||$('statModes'))await renderHomeStats();}catch(e){console.error('KillZone rerender',e);}
  }

  // Public API used by the other KillZone modules.
  Object.assign(window,{RANKS,ADMIN_RANKS,SESSION_KEY,RUBIKA_LINK,rankLabel,rankTier,rankChevrons,escapeHtml:esc,initials,isStaff,hashPass,uploadPhoto,saveSession,clearSession,getSessionId,initSession,ensureSeedAccounts:async()=>{},fetchAccounts,loginUser,registerUser,ensureSeedGames:async()=>{},fetchGameData,fetchGameNames,renderUserBox,wireLoginModal,buildMemberCard:memberCard,renderMembersPage,deleteMember,openMemberModal,wireMemberModal,renderGamesPage,deleteBlock,deleteMode,openBlockModal,openModeModal,wireGameModals,renderHomeStats,renderRegisterPage});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
