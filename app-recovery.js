// KillZone app recovery layer.
// Restores page boot/render functions removed from app.js while keeping the current UI and membership fixes.
(function(){
  'use strict';

  const RECOVERY_BOOT_KEY = '__kzRecoveryBooted';

  function esc(value){
    return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function isStaffSafe(){
    return typeof isStaff === 'function' && isStaff(window.currentUser || null);
  }

  function buildGameCheckboxes(containerId, selectedNames){
    if(typeof fetchGameNames !== 'function') return;
    Promise.resolve(fetchGameNames()).then(names=>{
      const box=document.getElementById(containerId);
      if(!box) return;
      if(names.length===0){ box.innerHTML='<div class="hint">هنوز بازی‌ای تعریف نشده.</div>'; return; }
      const selected=new Set(Array.isArray(selectedNames)?selectedNames:[]);
      box.innerHTML=names.map(n=>{
        const checked=selected.has(n)?'checked':'';
        const safeId='gm-'+containerId+'-'+String(n).replace(/[^a-zA-Z0-9آ-ی]/g,'');
        return `<label style="display:flex;align-items:center;gap:8px;font-size:14px;padding:6px 0;">
          <input type="checkbox" value="${esc(n)}" id="${safeId}" class="${containerId}-check" ${checked}> ${esc(n)}
        </label>`;
      }).join('');
    }).catch(err=>console.warn('KillZone games checkbox load failed',err));
  }

  function getCheckedGames(containerId){
    return Array.from(document.querySelectorAll('.'+containerId+'-check:checked')).map(el=>el.value);
  }

  // Current members.html uses memberOverlay / mName / mPhoto / mGamesBox / mNewPass.
  window.openMemberModal=function(id, accountsCache){
    if(!isStaffSafe()) return;
    window.__kzEditingMemberId = id || null;
    const msg=document.getElementById('memberMsg'); if(msg) msg.innerHTML='';
    const pass=document.getElementById('mNewPass'); if(pass) pass.value='';
    const photoFile=document.getElementById('mPhotoFile'); if(photoFile) photoFile.value='';
    const m=(accountsCache||[]).find(x=>x.id===id);
    const title=document.getElementById('memberModalTitle');
    if(title) title.textContent=id?'ویرایش عضو':'افزودن عضو دستی';
    const name=document.getElementById('mName'); if(name) name.value=m?.username||'';
    const photo=document.getElementById('mPhoto'); if(photo) photo.value=m?.photo||'';
    const rank=document.getElementById('mRank'); if(rank) rank.value=m?.rank||'new_member';
    const games=(m?.game||'').split('،').map(s=>s.trim()).filter(Boolean);
    buildGameCheckboxes('mGamesBox',games);
    document.getElementById('memberOverlay')?.classList.add('show');
  };

  window.wireMemberModal=function(){
    const overlay=document.getElementById('memberOverlay'); if(!overlay || overlay.dataset.kzRecoveryReady==='1') return;
    overlay.dataset.kzRecoveryReady='1';
    document.getElementById('memberClose')?.addEventListener('click',()=>overlay.classList.remove('show'));
    document.getElementById('addMemberBtn')?.addEventListener('click',()=>window.openMemberModal(null,[]));
    document.getElementById('mPhotoFile')?.addEventListener('change',async e=>{
      const file=e.target.files?.[0]; if(!file) return;
      const msg=document.getElementById('memberMsg');
      const url=await uploadPhoto(file,(type,text)=>{if(msg) msg.innerHTML=`<div class="form-msg ${type}">${esc(text)}</div>`;});
      if(url) document.getElementById('mPhoto').value=url;
    });
    document.getElementById('memberSave')?.addEventListener('click',async()=>{
      if(!isStaffSafe()) return;
      const id=window.__kzEditingMemberId||null;
      const name=document.getElementById('mName')?.value.trim()||'';
      const msg=document.getElementById('memberMsg');
      if(!name){if(msg)msg.innerHTML='<div class="form-msg err">نام‌کاربری رو وارد کن.</div>';return;}
      const {data:dup}=await sb.from('accounts').select('id').ilike('username',name).neq('id',id||'___none___').maybeSingle();
      if(dup){if(msg)msg.innerHTML='<div class="form-msg err">این نام‌کاربری قبلاً استفاده شده.</div>';return;}
      const data={
        username:name,
        photo:document.getElementById('mPhoto')?.value.trim()||'',
        rank:document.getElementById('mRank')?.value||'new_member',
        game:getCheckedGames('mGamesBox').join('، ')
      };
      const newPass=document.getElementById('mNewPass')?.value||'';
      if(newPass) data.pass_hash=await hashPass(newPass);
      let result;
      if(id){
        result=await sb.from('accounts').update(data).eq('id',id);
      }else{
        result=await sb.from('accounts').insert([{id:'m-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),pass_hash:await hashPass(newPass||Math.random().toString(36).slice(2,10)),is_admin:false,team_status:'none',...data}]);
      }
      if(result.error){console.error(result.error);if(msg)msg.innerHTML='<div class="form-msg err">خطا در ذخیره.</div>';return;}
      overlay.classList.remove('show');
      if(typeof renderMembersPage==='function') renderMembersPage();
    });
  };

  async function renderRegisterPage(){
    const form=document.getElementById('regForm'); if(!form || form.dataset.kzRecoveryReady==='1') return;
    form.dataset.kzRecoveryReady='1';
    const msg=document.getElementById('regMsg');
    const pass2=document.getElementById('regPass2');
    const pass=document.getElementById('regPass');
    const hiddenGames=document.getElementById('regGamesBox');
    if(hiddenGames) hiddenGames.value='';
    if(pass && pass2) pass.addEventListener('input',()=>{pass2.value=pass.value;});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const username=document.getElementById('regName')?.value.trim()||'';
      const password=document.getElementById('regPass')?.value||'';
      const confirmation=document.getElementById('regPass2')?.value||password;
      if(!username||username.length<3){if(msg)msg.innerHTML='<div class="form-msg err">نام‌کاربری باید حداقل ۳ کاراکتر باشه.</div>';return;}
      if(password.length<6){if(msg)msg.innerHTML='<div class="form-msg err">رمز عبور باید حداقل ۶ کاراکتر باشه.</div>';return;}
      if(password!==confirmation){if(msg)msg.innerHTML='<div class="form-msg err">تکرار رمز مطابقت نداره.</div>';return;}
      try{
        const res=await registerUser(username,password,'','');
        if(!res.ok){if(msg)msg.innerHTML=`<div class="form-msg err">${esc(res.msg)}</div>`;return;}
        currentUser=res.account;
        saveSession(res.account);
        if(typeof window.currentUser!=='undefined') window.currentUser=res.account;
        form.reset();
        if(msg)msg.innerHTML='<div class="form-msg ok">اکانت مهمانت ساخته شد و وارد شدی! حالا درخواست عضویت بده. ✔</div>';
        if(typeof renderUserBox==='function') renderUserBox();
        setTimeout(()=>{location.href='/join';},700);
      }catch(err){
        console.error(err);
        if(msg)msg.innerHTML='<div class="form-msg err">ثبت‌نام ناموفق بود. دوباره تلاش کن.</div>';
      }
    });
  }

  async function renderHomeStats(){
    const elMembers=document.getElementById('statMembers');
    const elGames=document.getElementById('statGames');
    const elModes=document.getElementById('statModes');
    const jobs=[];
    if(elMembers) jobs.push(sb.from('accounts').select('id',{count:'exact',head:true}));
    if(elGames) jobs.push(sb.from('game_blocks').select('id',{count:'exact',head:true}));
    if(elModes) jobs.push(sb.from('game_modes').select('id',{count:'exact',head:true}));
    if(!jobs.length) return;
    const results=await Promise.allSettled(jobs);
    let i=0;
    if(elMembers) elMembers.textContent=results[i++].status==='fulfilled'?(results[i-1].value.count??0):'—';
    if(elGames) elGames.textContent=results[i++].status==='fulfilled'?(results[i-1].value.count??0):'—';
    if(elModes) elModes.textContent=results[i++].status==='fulfilled'?(results[i-1].value.count??0):'—';
  }

  async function renderGamesPage(){
    const container=document.getElementById('gamesContainer'); if(!container) return;
    container.innerHTML='<div class="loading-note">در حال بارگذاری...</div>';
    try{
      const {blocks,modes}=await fetchGameData();
      container.innerHTML='';
      const staff=isStaffSafe();
      if(!blocks.length){container.innerHTML='<div class="empty-note">هنوز بازی‌ای اضافه نشده.</div>';return;}
      blocks.forEach(block=>{
        const blockModes=modes.filter(m=>m.block_id===block.id);
        const wrap=document.createElement('div');
        wrap.className='game-block';
        wrap.innerHTML=`
          <div class="game-banner ${esc(block.theme||'neutral')}">
            <div class="accent-strip"></div>
            <div class="game-banner-body">
              <h3>${esc(block.name)}</h3>
              <div style="display:flex;align-items:center;gap:10px;">
                ${block.tag?`<span class="tag">${esc(block.tag)}</span>`:''}
                ${staff?`<button class="icon-btn edit-block" data-id="${esc(block.id)}">ویرایش</button><button class="icon-btn del del-block" data-id="${esc(block.id)}">حذف</button>`:''}
              </div>
            </div>
          </div>
          <div class="mode-grid"></div>
          ${staff?`<button class="btn ghost small add-mode" data-block="${esc(block.id)}" style="margin-top:14px;">+ افزودن مود</button>`:''}
        `;
        container.appendChild(wrap);
        const grid=wrap.querySelector('.mode-grid');
        blockModes.forEach(mode=>{
          const card=document.createElement('div');card.className='mode-card';
          const chips=(mode.maps||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>`<span>${esc(s)}</span>`).join('');
          card.innerHTML=`<h4>${esc(mode.title)}</h4><p>${esc(mode.description)}</p><div class="maps">${chips}</div>${staff?`<div class="member-actions" style="margin-top:12px;"><button class="icon-btn edit-mode" data-id="${esc(mode.id)}">ویرایش</button><button class="icon-btn del del-mode" data-id="${esc(mode.id)}">حذف</button></div>`:''}`;
          grid.appendChild(card);
        });
      });
      container.querySelectorAll('.edit-block').forEach(b=>b.addEventListener('click',()=>window.openBlockModal?.(b.dataset.id,blocks)));
      container.querySelectorAll('.del-block').forEach(b=>b.addEventListener('click',()=>window.deleteBlock?.(b.dataset.id)));
      container.querySelectorAll('.add-mode').forEach(b=>b.addEventListener('click',()=>window.openModeModal?.(null,b.dataset.block)));
      container.querySelectorAll('.edit-mode').forEach(b=>b.addEventListener('click',()=>window.openModeModal?.(b.dataset.id,null,modes)));
      container.querySelectorAll('.del-mode').forEach(b=>b.addEventListener('click',()=>window.deleteMode?.(b.dataset.id)));
      document.getElementById('addGameBtn')?.style.setProperty('display',staff?'inline-block':'none');
    }catch(err){
      console.error('KillZone games render failed',err);
      container.innerHTML='<div class="form-msg err">بارگذاری بازی‌ها ناموفق بود.</div>';
    }
  }

  window.deleteBlock=async function(id){
    if(!isStaffSafe()||!confirm('این بازی و همه‌ی مودهاش حذف بشه؟')) return;
    const {error}=await sb.from('game_blocks').delete().eq('id',id); if(error)console.error(error);
    renderGamesPage();
  };
  window.deleteMode=async function(id){
    if(!isStaffSafe()||!confirm('این مود حذف بشه؟')) return;
    const {error}=await sb.from('game_modes').delete().eq('id',id); if(error)console.error(error);
    renderGamesPage();
  };

  window.openBlockModal=function(id,blocksCache){
    if(!isStaffSafe()) return;
    window.__kzEditingBlockId=id||null;
    const b=(blocksCache||[]).find(x=>x.id===id);
    document.getElementById('blockModalTitle').textContent=id?'ویرایش بازی':'افزودن بازی جدید';
    document.getElementById('bName').value=b?.name||'';
    document.getElementById('bTag').value=b?.tag||'';
    document.getElementById('bTheme').value=b?.theme||'mc';
    document.getElementById('blockMsg').innerHTML='';
    document.getElementById('gameBlockOverlay').classList.add('show');
  };
  window.wireGameBlockModal=function(){
    const overlay=document.getElementById('gameBlockOverlay');if(!overlay||overlay.dataset.kzRecoveryReady==='1')return;overlay.dataset.kzRecoveryReady='1';
    document.getElementById('blockClose')?.addEventListener('click',()=>overlay.classList.remove('show'));
    document.getElementById('addGameBtn')?.addEventListener('click',()=>window.openBlockModal(null,[]));
    document.getElementById('blockSave')?.addEventListener('click',async()=>{
      if(!isStaffSafe())return;
      const msg=document.getElementById('blockMsg');const name=document.getElementById('bName').value.trim();
      if(!name){msg.innerHTML='<div class="form-msg err">اسم بازی رو وارد کن.</div>';return;}
      const data={name,tag:document.getElementById('bTag').value.trim(),theme:document.getElementById('bTheme').value};
      const q=window.__kzEditingBlockId?sb.from('game_blocks').update(data).eq('id',window.__kzEditingBlockId):sb.from('game_blocks').insert([{id:'blk-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),sort_order:999,...data}]);
      const {error}=await q;if(error){console.error(error);msg.innerHTML='<div class="form-msg err">خطا در ذخیره.</div>';return;}
      overlay.classList.remove('show');renderGamesPage();if(document.getElementById('statGames'))renderHomeStats();
    });
  };

  window.openModeModal=function(id,blockId,modesCache){
    if(!isStaffSafe()) return;
    window.__kzEditingModeId=id||null;window.__kzEditingModeBlockId=blockId||null;
    const m=(modesCache||[]).find(x=>x.id===id);
    document.getElementById('modeModalTitle').textContent=id?'ویرایش مود':'افزودن مود جدید';
    document.getElementById('moTitle').value=m?.title||'';document.getElementById('moDesc').value=m?.description||'';document.getElementById('moMaps').value=m?.maps||'';
    if(id) window.__kzEditingModeBlockId=m?.block_id||null;
    document.getElementById('modeMsg').innerHTML='';document.getElementById('gameModeOverlay').classList.add('show');
  };
  window.wireGameModeModal=function(){
    const overlay=document.getElementById('gameModeOverlay');if(!overlay||overlay.dataset.kzRecoveryReady==='1')return;overlay.dataset.kzRecoveryReady='1';
    document.getElementById('modeClose')?.addEventListener('click',()=>overlay.classList.remove('show'));
    document.getElementById('modeSave')?.addEventListener('click',async()=>{
      if(!isStaffSafe())return;
      const msg=document.getElementById('modeMsg');const title=document.getElementById('moTitle').value.trim();
      if(!title){msg.innerHTML='<div class="form-msg err">اسم مود رو وارد کن.</div>';return;}
      const data={title,description:document.getElementById('moDesc').value.trim(),maps:document.getElementById('moMaps').value.trim()};
      const q=window.__kzEditingModeId?sb.from('game_modes').update(data).eq('id',window.__kzEditingModeId):sb.from('game_modes').insert([{id:'mode-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),block_id:window.__kzEditingModeBlockId,sort_order:999,...data}]);
      const {error}=await q;if(error){console.error(error);msg.innerHTML='<div class="form-msg err">خطا در ذخیره.</div>';return;}
      overlay.classList.remove('show');renderGamesPage();if(document.getElementById('statModes'))renderHomeStats();
    });
  };

  async function boot(){
    if(window[RECOVERY_BOOT_KEY]) return;
    window[RECOVERY_BOOT_KEY]=true;
    // Give earlier defer scripts a tick to install their wrappers/bridges.
    await new Promise(resolve=>setTimeout(resolve,0));
    try{ window.wireMobileNav?.(); }catch(e){ console.warn(e); }
    try{ window.wireRubikaLinks?.(); }catch(e){ console.warn(e); }
    try{ window.wireLoginModal?.(); }catch(e){ console.warn(e); }
    try{ window.wireMemberModal?.(); }catch(e){ console.warn(e); }
    try{ window.wireRegisterForm?.(); }catch(e){ console.warn(e); }
    try{ window.wireGameBlockModal?.(); }catch(e){ console.warn(e); }
    try{ window.wireGameModeModal?.(); }catch(e){ console.warn(e); }

    // Session and page data are independent: one failure must not block the others.
    try{ if(typeof initSession==='function') await initSession(); }catch(e){ console.warn('KillZone session init failed',e); }
    try{ if(typeof renderUserBox==='function') renderUserBox(); }catch(e){ console.warn(e); }

    const jobs=[];
    if(document.getElementById('membersContainer')) jobs.push(Promise.resolve(renderMembersPage?.()).catch(e=>console.error('members render',e)));
    if(document.getElementById('gamesContainer')) jobs.push(Promise.resolve(renderGamesPage()).catch(e=>console.error('games render',e)));
    if(document.getElementById('statMembers')||document.getElementById('statGames')||document.getElementById('statModes')) jobs.push(Promise.resolve(renderHomeStats()).catch(e=>console.error('stats render',e)));
    await Promise.allSettled(jobs);
    await renderRegisterPage();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
