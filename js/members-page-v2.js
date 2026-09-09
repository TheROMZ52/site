// KillZone Members — stable runtime for filters, presence and staff controls.
(function () {
  'use strict';

  const ROOT = 'membersCommunityContainer';
  const STAFF = new Set(['admin', 'developer', 'co_owner', 'owner']);
  const ONLINE_MS = 300000;
  let accounts = [];
  let presence = [];
  let busy = false;

  const root = () => document.getElementById(ROOT);
  const norm = v => String(v ?? '').trim().toLocaleLowerCase('fa-IR');
  const esc = v => typeof window.escapeHtml === 'function' ? window.escapeHtml(v) : String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const staff = () => !!(window.currentUser && STAFF.has(window.currentUser.rank));
  const games = a => String(a?.game ?? '').split(/[،,|]/).map(v => v.trim()).filter(Boolean);
  const presenceOf = id => presence.find(p => p.account_id === id) || null;
  const online = id => { const p = presenceOf(id); const t = Date.parse(p?.last_seen || ''); return Number.isFinite(t) && Date.now() - t <= ONLINE_MS; };

  async function load() {
    if (!window.sb) return false;
    const [a, p] = await Promise.all([
      sb.from('accounts').select('id,username,photo,game,bio,social,joined_at,rank,team_status').eq('team_status','approved').order('username'),
      sb.from('member_presence').select('account_id,status,game,status_text,last_seen')
    ]);
    if (a.error) { console.error('members/accounts', a.error); return false; }
    accounts = a.data || [];
    presence = p.error ? [] : (p.data || []);
    if (p.error) console.error('members/presence', p.error);
    return true;
  }

  function stats() {
    const uniqueGames = new Set(accounts.flatMap(games).map(norm).filter(Boolean));
    document.getElementById('membersTotal')?.replaceChildren(document.createTextNode(String(accounts.length)));
    document.getElementById('membersOnline')?.replaceChildren(document.createTextNode(String(accounts.filter(a => online(a.id)).length)));
    document.getElementById('membersGames')?.replaceChildren(document.createTextNode(String(uniqueGames.size)));
  }

  function populateGames() {
    const select = document.getElementById('memberGameFilter');
    if (!select) return;
    const current = select.value;
    const map = new Map();
    accounts.flatMap(games).forEach(g => { const k = norm(g); if (k && !map.has(k)) map.set(k, g); });
    select.replaceChildren(new Option('همه بازی‌ها', 'all'));
    [...map.entries()].sort((a,b) => a[1].localeCompare(b[1], 'fa')).forEach(([k,v]) => select.appendChild(new Option(v,k)));
    select.value = [...select.options].some(o => o.value === current) ? current : 'all';
  }

  function attachAccountIds() {
    const grid = root()?.querySelector(':scope > .kz-profile-grid');
    if (!grid) return;
    grid.querySelectorAll(':scope > .kz-profile-card').forEach(card => {
      const name = norm(card.querySelector('.kz-profile-name')?.textContent);
      const account = accounts.find(a => norm(a.username) === name);
      if (account) card.dataset.accountId = account.id;
    });
  }

  function presenceUI(card, account) {
    card.querySelector('.kz-runtime-presence')?.remove();
    if (!account) return;
    const box = document.createElement('div');
    box.className = 'kz-runtime-presence';
    const p = presenceOf(account.id);
    if (!online(account.id)) {
      box.innerHTML = '<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
    } else {
      const labels = {playing:['در حال بازی','🎮'],competitive:['در حال رقابت','🏆'],ready:['آماده','🟢'],busy:['مشغول','🔴'],away:['AFK','💤']};
      const [label, icon] = labels[p?.status] || labels.ready;
      box.innerHTML = `<span class="kz-presence-dot"></span><span>آنلاین · ${icon} ${esc(label)}</span>${p?.game ? `<small>${esc(p.game)}</small>` : ''}${p?.status_text ? `<small>${esc(p.status_text)}</small>` : ''}`;
    }
    card.appendChild(box);
  }

  function apply() {
    const container = root();
    const grid = container?.querySelector(':scope > .kz-profile-grid');
    if (!grid) return;
    const q = norm(document.getElementById('memberSearch')?.value);
    const game = norm(document.getElementById('memberGameFilter')?.value || 'all');
    const status = document.getElementById('memberStatusFilter')?.value || 'all';
    const sort = document.getElementById('memberSort')?.value || 'name';
    const cards = [...grid.querySelectorAll(':scope > .kz-profile-card')];

    cards.forEach(card => {
      const a = accounts.find(x => x.id === card.dataset.accountId);
      const hay = norm([a?.username, a?.bio, a?.game].join(' '));
      const visible = !!a && (!q || hay.includes(q)) && (game === 'all' || games(a).some(g => norm(g) === game)) && (status === 'all' || (status === 'online' ? online(a.id) : !online(a.id)));
      card.hidden = !visible;
      presenceUI(card, a);
    });

    cards.sort((x,y) => {
      const a = accounts.find(v => v.id === x.dataset.accountId), b = accounts.find(v => v.id === y.dataset.accountId);
      if (!a || !b) return 0;
      if (sort === 'online') return Number(online(b.id)) - Number(online(a.id)) || norm(a.username).localeCompare(norm(b.username),'fa');
      if (sort === 'recent') return Date.parse(b.joined_at || 0) - Date.parse(a.joined_at || 0);
      return norm(a.username).localeCompare(norm(b.username),'fa');
    });
    const fragment = document.createDocumentFragment();
    cards.forEach(card => fragment.appendChild(card));
    grid.appendChild(fragment);

    const visible = cards.filter(c => !c.hidden).length;
    const result = document.getElementById('membersResultCount');
    if (result) result.textContent = `نمایش ${visible} از ${cards.length} عضو`;
    const clear = document.getElementById('memberSearchClear');
    if (clear) clear.hidden = !q;
    container.querySelector('.kz-filter-empty')?.remove();
    if (cards.length && !visible) {
      const empty = document.createElement('div');
      empty.className = 'kz-filter-empty';
      empty.innerHTML = '<strong>عضوی پیدا نشد</strong><span>عبارت جستجو یا فیلترها رو تغییر بده.</span>';
      container.appendChild(empty);
    }
  }

  function wire() {
    const search = document.getElementById('memberSearch');
    const clear = document.getElementById('memberSearchClear');
    const game = document.getElementById('memberGameFilter');
    const status = document.getElementById('memberStatusFilter');
    const sort = document.getElementById('memberSort');
    const reset = document.getElementById('memberResetFilters');
    search?.addEventListener('input', apply);
    search?.addEventListener('compositionend', apply);
    clear?.addEventListener('click', () => { if (search) search.value = ''; apply(); search?.focus(); });
    game?.addEventListener('change', apply);
    status?.addEventListener('change', apply);
    sort?.addEventListener('change', apply);
    reset?.addEventListener('click', () => { if(search)search.value=''; if(game)game.value='all'; if(status)status.value='all'; if(sort)sort.value='name'; apply(); search?.focus(); });

    const add = document.getElementById('addMemberBtn');
    if (add) add.style.display = staff() ? 'inline-flex' : 'none';
    const guests = document.getElementById('guestAccountsBtn');
    if (guests) {
      guests.style.display = staff() ? 'inline-flex' : 'none';
      guests.onclick = staff() ? guestManager : null;
    }
  }

  async function guestManager() {
    if (!staff() || !window.sb) return;
    let overlay = document.getElementById('kzGuestManager');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'kzGuestManager';
      overlay.className = 'overlay kz-community-overlay';
      overlay.innerHTML = '<div class="modal kz-modal-panel" role="dialog" aria-modal="true"><button class="close" id="kzGuestClose">✕</button><div class="kz-profile-section-title"><h4>اکانت‌های مهمان</h4><span>GUEST ACCOUNTS</span></div><div id="kzGuestList"></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('show'); });
      overlay.querySelector('#kzGuestClose').onclick = () => overlay.classList.remove('show');
    }
    const box = overlay.querySelector('#kzGuestList');
    box.innerHTML = '<div class="kz-community-loading">در حال دریافت مهمان‌ها…</div>';
    overlay.classList.add('show');
    const { data, error } = await sb.from('accounts').select('id,username,game').eq('rank','guest').order('username');
    if (error) { console.error(error); box.innerHTML = '<div class="kz-community-empty">دریافت مهمان‌ها ناموفق بود.</div>'; return; }
    if (!data?.length) { box.innerHTML = '<div class="kz-community-empty">اکانت مهمانی وجود نداره.</div>'; return; }
    box.innerHTML = `<div class="kz-runtime-guest-grid">${data.map(m => `<article class="kz-runtime-guest-card" data-id="${esc(m.id)}"><div class="avatar">${esc((m.username||'?').slice(0,2).toUpperCase())}</div><div class="body"><div class="name">${esc(m.username)}</div><div class="meta">${esc(m.game||'بازی ثبت نشده')} · مهمان</div></div><div class="actions"><button class="btn primary small" data-action="approve">✓ تأیید</button><button class="btn ghost small" data-action="delete">حذف</button></div></article>`).join('')}</div>`;
    box.querySelectorAll('.kz-runtime-guest-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-action="approve"]')?.addEventListener('click', async () => {
        const { error: e } = await sb.from('accounts').update({rank:'member',team_status:'approved'}).eq('id',id).eq('rank','guest');
        if (e) { console.error(e); alert('تأیید مهمان انجام نشد.'); return; }
        overlay.classList.remove('show'); await refresh();
      });
      card.querySelector('[data-action="delete"]')?.addEventListener('click', async event => {
        const b = event.currentTarget;
        if (b.dataset.confirm !== '1') { b.dataset.confirm='1'; b.textContent='تأیید حذف'; setTimeout(() => { if(b.dataset.confirm==='1'){b.dataset.confirm='0';b.textContent='حذف';}},3500); return; }
        const { error: e } = await sb.from('accounts').delete().eq('id',id).eq('rank','guest');
        if (e) { console.error(e); alert('حذف مهمان انجام نشد.'); return; }
        overlay.classList.remove('show'); await refresh();
      });
    });
  }

  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      if (!await load()) return;
      stats(); populateGames(); wire(); attachAccountIds(); apply();
    } finally { busy = false; }
  }

  function boot() {
    if (!root()) return;
    wire();
    window.addEventListener('kz:members-rendered', () => { attachAccountIds(); apply(); });
    window.addEventListener('kz:session-changed', () => refresh());
    refresh();
    window.kzMembersRefresh = refresh;
    window.setInterval(() => refresh(), 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
