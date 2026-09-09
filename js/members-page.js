// KillZone Members Page — single runtime for search, filters, presence and staff actions.
(function () {
  'use strict';

  const ROOT_ID = 'membersCommunityContainer';
  const ONLINE_MS = 5 * 60 * 1000;
  const STAFF_RANKS = new Set(['admin', 'developer', 'co_owner', 'owner']);

  let accounts = [];
  let presence = [];
  let refreshTimer = null;
  let refreshBusy = false;
  let bound = false;

  const root = () => document.getElementById(ROOT_ID);
  const text = value => String(value ?? '').trim();
  const norm = value => text(value).toLocaleLowerCase('fa-IR');
  const esc = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value)
    : text(value).replace(/[&<>\"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

  function currentStaff() {
    return !!(window.currentUser && STAFF_RANKS.has(window.currentUser.rank));
  }

  function gamesOf(account) {
    return text(account?.game)
      .split(/[،,|]/)
      .map(text)
      .filter(Boolean);
  }

  function presenceFor(accountId) {
    return presence.find(item => item.account_id === accountId) || null;
  }

  function isOnline(accountId) {
    const item = presenceFor(accountId);
    if (!item?.last_seen) return false;
    const timestamp = Date.parse(item.last_seen);
    return Number.isFinite(timestamp) && Date.now() - timestamp <= ONLINE_MS;
  }

  function updateStats() {
    const total = document.getElementById('membersTotal');
    const online = document.getElementById('membersOnline');
    const games = document.getElementById('membersGames');
    const gameSet = new Set(accounts.flatMap(gamesOf).map(norm).filter(Boolean));

    if (total) total.textContent = String(accounts.length);
    if (online) online.textContent = String(accounts.filter(a => isOnline(a.id)).length);
    if (games) games.textContent = String(gameSet.size);
  }

  function populateGameFilter() {
    const select = document.getElementById('memberGameFilter');
    if (!select) return;

    const current = select.value;
    const games = new Map();
    accounts.flatMap(gamesOf).forEach(game => {
      const key = norm(game);
      if (key && !games.has(key)) games.set(key, game);
    });

    const sorted = [...games.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fa'));
    select.replaceChildren(new Option('همه بازی‌ها', 'all'));
    sorted.forEach(([key, label]) => select.appendChild(new Option(label, key)));
    select.value = [...select.options].some(option => option.value === current) ? current : 'all';
  }

  function findAccountForCard(card) {
    return accounts.find(account => account.id === card.dataset.accountId) || null;
  }

  function renderPresence(card, account) {
    if (!account) return;
    const old = card.querySelector('.kz-runtime-presence');
    if (old) old.remove();

    const box = document.createElement('div');
    box.className = 'kz-runtime-presence';
    const item = presenceFor(account.id);

    if (!isOnline(account.id)) {
      box.innerHTML = '<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
    } else {
      const labels = {
        playing: ['در حال بازی', '🎮'],
        competitive: ['در حال رقابت', '🏆'],
        ready: ['آماده', '🟢'],
        busy: ['مشغول', '🔴'],
        away: ['AFK', '💤']
      };
      const [label, icon] = labels[item?.status] || labels.ready;
      box.innerHTML = `<span class="kz-presence-dot"></span><span>آنلاین · ${icon} ${esc(label)}</span>`;
      if (item?.game) box.insertAdjacentHTML('beforeend', `<small>${esc(item.game)}</small>`);
      if (item?.status_text) box.insertAdjacentHTML('beforeend', `<small>${esc(item.status_text)}</small>`);
    }
    card.appendChild(box);
  }

  function cardMatches(card) {
    const account = findAccountForCard(card);
    if (!account) return false;

    const query = norm(document.getElementById('memberSearch')?.value);
    const game = norm(document.getElementById('memberGameFilter')?.value || 'all');
    const status = document.getElementById('memberStatusFilter')?.value || 'all';
    const haystack = norm([account.username, account.bio, account.game].join(' '));

    const queryOk = !query || haystack.includes(query);
    const gameOk = game === 'all' || gamesOf(account).some(item => norm(item) === game);
    const statusOk = status === 'all' || (status === 'online' ? isOnline(account.id) : !isOnline(account.id));
    return queryOk && gameOk && statusOk;
  }

  function sortCards(cards) {
    const mode = document.getElementById('memberSort')?.value || 'name';
    return [...cards].sort((first, second) => {
      const a = findAccountForCard(first);
      const b = findAccountForCard(second);
      if (!a || !b) return 0;

      if (mode === 'online') {
        return Number(isOnline(b.id)) - Number(isOnline(a.id))
          || norm(a.username).localeCompare(norm(b.username), 'fa');
      }
      if (mode === 'recent') {
        return Date.parse(b.joined_at || 0) - Date.parse(a.joined_at || 0);
      }
      return norm(a.username).localeCompare(norm(b.username), 'fa');
    });
  }

  function applyFilters() {
    const container = root();
    const grid = container?.querySelector(':scope > .kz-profile-grid');
    if (!grid) return;

    const cards = [...grid.querySelectorAll(':scope > .kz-profile-card')];
    cards.forEach(card => {
      const account = findAccountForCard(card);
      const visible = cardMatches(card);
      card.hidden = !visible;
      renderPresence(card, account);
    });

    // Sorting is done once per filter operation; no MutationObserver is used here.
    // This prevents the old implementation from observing its own appendChild calls forever.
    const sorted = sortCards(cards);
    const fragment = document.createDocumentFragment();
    sorted.forEach(card => fragment.appendChild(card));
    grid.appendChild(fragment);

    const visibleCount = cards.filter(card => !card.hidden).length;
    const result = document.getElementById('membersResultCount');
    if (result) result.textContent = `نمایش ${visibleCount} از ${cards.length} عضو`;

    container.querySelector('.kz-filter-empty')?.remove();
    if (cards.length && visibleCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'kz-filter-empty';
      empty.innerHTML = '<strong>عضوی پیدا نشد</strong><span>عبارت جستجو یا فیلترها رو تغییر بده.</span>';
      container.appendChild(empty);
    }

    const clear = document.getElementById('memberSearchClear');
    if (clear) clear.hidden = !text(document.getElementById('memberSearch')?.value);
  }

  function prepareCards() {
    const grid = root()?.querySelector(':scope > .kz-profile-grid');
    if (!grid) return;
    [...grid.querySelectorAll(':scope > .kz-profile-card')].forEach(card => {
      const name = text(card.querySelector('.kz-profile-name')?.textContent);
      const account = accounts.find(item => norm(item.username) === norm(name));
      if (account) card.dataset.accountId = account.id;
    });
  }

  async function loadData() {
    if (!window.sb) return false;
    const [accountResult, presenceResult] = await Promise.all([
      sb.from('accounts')
        .select('id,username,photo,game,bio,social,joined_at,rank,team_status')
        .eq('team_status', 'approved')
        .order('username'),
      sb.from('member_presence')
        .select('account_id,status,game,status_text,last_seen')
    ]);

    if (accountResult.error) {
      console.error('KillZone members accounts:', accountResult.error);
      return false;
    }
    if (presenceResult.error) {
      console.error('KillZone members presence:', presenceResult.error);
    }

    accounts = accountResult.data || [];
    presence = presenceResult.data || [];
    return true;
  }

  function wireControls() {
    if (bound) return;
    bound = true;

    const search = document.getElementById('memberSearch');
    const clear = document.getElementById('memberSearchClear');
    const game = document.getElementById('memberGameFilter');
    const status = document.getElementById('memberStatusFilter');
    const sort = document.getElementById('memberSort');
    const reset = document.getElementById('memberResetFilters');

    search?.addEventListener('input', applyFilters);
    search?.addEventListener('compositionend', applyFilters);
    clear?.addEventListener('click', () => {
      if (!search) return;
      search.value = '';
      search.focus();
      applyFilters();
    });
    game?.addEventListener('change', applyFilters);
    status?.addEventListener('change', applyFilters);
    sort?.addEventListener('change', applyFilters);
    reset?.addEventListener('click', () => {
      if (search) search.value = '';
      if (game) game.value = 'all';
      if (status) status.value = 'all';
      if (sort) sort.value = 'name';
      applyFilters();
      search?.focus();
    });
  }

  async function refresh() {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      if (!await loadData()) return;
      updateStats();
      populateGameFilter();
      prepareCards();
      applyFilters();
    } finally {
      refreshBusy = false;
    }
  }

  async function guestManager() {
    if (!currentStaff() || !window.sb) return;
    let overlay = document.getElementById('kzGuestManager');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'overlay kz-community-overlay';
      overlay.id = 'kzGuestManager';
      overlay.innerHTML = '<div class="modal kz-modal-panel" role="dialog" aria-modal="true" aria-labelledby="kzGuestTitle"><button class="close" id="kzGuestClose" aria-label="بستن">✕</button><div class="kz-profile-section-title"><h4 id="kzGuestTitle">اکانت‌های مهمان</h4><span>GUEST ACCOUNTS</span></div><div id="kzGuestList"></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.classList.remove('show');
      });
      overlay.querySelector('#kzGuestClose').addEventListener('click', () => overlay.classList.remove('show'));
    }

    const box = overlay.querySelector('#kzGuestList');
    box.innerHTML = '<div class="kz-community-loading">در حال دریافت مهمان‌ها…</div>';
    overlay.classList.add('show');

    const { data, error } = await sb.from('accounts')
      .select('id,username,game,created_at')
      .eq('rank', 'guest')
      .order('username');

    if (error) {
      console.error('KillZone guest accounts:', error);
      box.innerHTML = '<div class="kz-community-empty">دریافت اکانت‌های مهمان ناموفق بود.</div>';
      return;
    }
    if (!data?.length) {
      box.innerHTML = '<div class="kz-community-empty">اکانت مهمانی وجود نداره.</div>';
      return;
    }

    box.innerHTML = `<div class="kz-runtime-guest-grid">${data.map(member => `<article class="kz-runtime-guest-card" data-id="${esc(member.id)}"><div class="avatar">${esc(text(member.username).slice(0, 2).toUpperCase() || '?')}</div><div class="body"><div class="name">${esc(member.username)}</div><div class="meta">${esc(member.game || 'بازی ثبت نشده')} · مهمان</div></div><div class="actions"><button class="btn primary small" data-action="approve" type="button">✓ تأیید</button><button class="btn ghost small" data-action="delete" type="button">حذف</button></div></article>`).join('')}</div>`;

    box.querySelectorAll('.kz-runtime-guest-card').forEach(card => {
      const id = card.dataset.id;
      card.querySelector('[data-action="approve']')?.addEventListener('click', async () => {
        const { error: updateError } = await sb.from('accounts')
          .update({ rank: 'member', team_status: 'approved' })
          .eq('id', id)
          .eq('rank', 'guest');
        if (updateError) {
          console.error(updateError);
          alert('تأیید مهمان انجام نشد.');
          return;
        }
        overlay.classList.remove('show');
        await refresh();
      });

      card.querySelector('[data-action="delete"]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        if (button.dataset.confirm !== '1') {
          button.dataset.confirm = '1';
          button.textContent = 'تأیید حذف';
          setTimeout(() => {
            if (button.dataset.confirm === '1') {
              button.dataset.confirm = '0';
              button.textContent = 'حذف';
            }
          }, 3500);
          return;
        }

        const { error: deleteError } = await sb.from('accounts').delete().eq('id', id).eq('rank', 'guest');
        if (deleteError) {
          console.error(deleteError);
          alert('حذف مهمان انجام نشد.');
          return;
        }
        overlay.classList.remove('show');
        await refresh();
      });
    });
  }

  function wireStaffButtons() {
    const add = document.getElementById('addMemberBtn');
    const guests = document.getElementById('guestAccountsBtn');
    const allowed = currentStaff();
    if (add) add.style.display = allowed ? 'inline-flex' : 'none';
    if (guests) {
      guests.style.display = allowed ? 'inline-flex' : 'none';
      if (!guests.dataset.kzBound) {
        guests.dataset.kzBound = '1';
        guests.addEventListener('click', guestManager);
      }
    }
  }

  function boot() {
    if (!root()) return;
    wireControls();
    wireStaffButtons();
    refresh();

    // community.js owns card rendering; this runtime only enhances already-rendered cards.
    window.addEventListener('kz:members-rendered', () => {
      prepareCards();
      applyFilters();
    });
    window.addEventListener('kz:session-changed', () => {
      wireStaffButtons();
      refresh();
    });

    refreshTimer = window.setInterval(() => {
      refresh();
    }, 30000);

    window.addEventListener('pagehide', () => {
      if (refreshTimer) window.clearInterval(refreshTimer);
    }, { once: true });
  }

  window.kzMembersRefresh = refresh;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
