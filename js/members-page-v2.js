// KillZone Members — unified renderer for rank groups, search, filters, presence and staff controls.
(function () {
  "use strict";

  const ROOT = "membersCommunityContainer";
  const RANKS = [
    { key: "owner", label: "اونر" },
    { key: "co_owner", label: "کو-اونر" },
    { key: "developer", label: "دولوپر" },
    { key: "admin", label: "ادمین" },
    { key: "member", label: "ممبر" },
    { key: "new_member", label: "نیو ممبر" },
    { key: "guest", label: "مهمان" },
  ];
  const STAFF = new Set(["admin", "developer", "co_owner", "owner"]);
  const ONLINE_MS = 300000;
  let accounts = [];
  let presence = [];
  let busy = false;
  let bound = false;
  let retryTimer = null;

  const root = () => document.getElementById(ROOT);
  const current = () => {
    try {
      if (typeof currentUser !== "undefined" && currentUser) return currentUser;
    } catch (_) {}
    return window.currentUser || null;
  };
  const isStaff = () => {
    const user = current();
    return !!(user && STAFF.has(user.rank));
  };
  const text = (v) => String(v ?? "").trim();
  const norm = (v) => text(v).toLocaleLowerCase("fa-IR");
  const esc = (v) =>
    typeof window.escapeHtml === "function"
      ? window.escapeHtml(v)
      : text(v).replace(
          /[&<>\"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c],
        );
  const gameList = (a) =>
    text(a?.game).split(/[،,|]/).map(text).filter(Boolean);
  const rankMeta = (key) =>
    RANKS.find((r) => r.key === key) || { key, label: key || "سایر" };
  const chevrons = (key) => {
    const all = [
      "guest",
      "new_member",
      "member",
      "admin",
      "developer",
      "co_owner",
      "owner",
    ];
    const tier = Math.max(1, all.indexOf(key) + 1);
    return "▲".repeat(Math.min(tier, 7));
  };
  const presenceOf = (id) => presence.find((p) => p.account_id === id) || null;
  const online = (id) => {
    const p = presenceOf(id);
    const t = Date.parse(p?.last_seen || "");
    return Number.isFinite(t) && Date.now() - t <= ONLINE_MS;
  };

  async function load() {
    if (!window.sb) return false;
    const [a, p] = await Promise.all([
      window.sb
        .from("accounts")
        .select("id,username,photo,game,bio,social,joined_at,rank,team_status")
        .order("username"),
      window.sb
        .from("member_presence")
        .select("account_id,status,game,status_text,last_seen"),
    ]);
    if (a.error) {
      console.error("KillZone members/accounts", a.error);
      return false;
    }
    accounts = a.data || [];
    presence = p.error ? [] : p.data || [];
    if (p.error) console.error("KillZone members/presence", p.error);
    return true;
  }

  function stats() {
    const uniqueGames = new Set(
      accounts.flatMap(gameList).map(norm).filter(Boolean),
    );
    document
      .getElementById("membersTotal")
      ?.replaceChildren(document.createTextNode(String(accounts.length)));
    document
      .getElementById("membersOnline")
      ?.replaceChildren(
        document.createTextNode(
          String(accounts.filter((a) => online(a.id)).length),
        ),
      );
    document
      .getElementById("membersGames")
      ?.replaceChildren(document.createTextNode(String(uniqueGames.size)));
  }

  function populateGames() {
    const select = document.getElementById("memberGameFilter");
    if (!select) return;
    const selected = select.value;
    const map = new Map();
    accounts.flatMap(gameList).forEach((g) => {
      const key = norm(g);
      if (key && !map.has(key)) map.set(key, g);
    });
    select.replaceChildren(new Option("همه بازی‌ها", "all"));
    [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "fa"))
      .forEach(([key, label]) => select.appendChild(new Option(label, key)));
    select.value = [...select.options].some((o) => o.value === selected)
      ? selected
      : "all";
  }

  function avatarHtml(account, large = false) {
    const cls = large ? "kz-profile-large-avatar" : "kz-profile-avatar";
    const initials = esc(
      (account.username || "?").trim().slice(0, 2).toUpperCase(),
    );
    if (!account.photo) return `<div class="${cls}">${initials}</div>`;
    return `<div class="${cls} kz-avatar-media" data-avatar-url="${esc(account.photo)}" role="img" aria-label="${esc(account.username)}">${initials}</div>`;
  }

  function hydrateAvatars(scope) {
    scope
      ?.querySelectorAll(".kz-avatar-media[data-avatar-url]")
      .forEach((el) => {
        if (el.dataset.kzAvatarReady) return;
        el.dataset.kzAvatarReady = "1";
        const url = el.dataset.avatarUrl;
        const image = new Image();
        image.onload = () => {
          el.style.backgroundImage = `url("${url.replace(/["\\]/g, "\\$&")}")`;
          el.style.backgroundSize = "cover";
          el.style.backgroundPosition = "center";
          el.style.backgroundRepeat = "no-repeat";
          el.textContent = "";
        };
        image.src = url;
      });
  }

  function presenceNode(account) {
    const box = document.createElement("div");
    box.className = "kz-runtime-presence";
    const p = presenceOf(account.id);
    if (!online(account.id)) {
      box.innerHTML =
        '<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
      return box;
    }
    const labels = {
      playing: ["در حال بازی", "🎮"],
      competitive: ["در حال رقابت", "🏆"],
      ready: ["آماده", "🟢"],
      busy: ["مشغول", "🔴"],
      away: ["AFK", "💤"],
    };
    const [label, icon] = labels[p?.status] || labels.ready;
    box.innerHTML = `<span class="kz-presence-dot"></span><span>آنلاین · ${icon} ${esc(label)}</span>${p?.game ? `<small>${esc(p.game)}</small>` : ""}${p?.status_text ? `<small>${esc(p.status_text)}</small>` : ""}`;
    return box;
  }

  function memberCard(account) {
    const card = document.createElement("article");
    const meta = rankMeta(account.rank);
    card.className = "kz-profile-card";
    card.tabIndex = 0;
    card.dataset.accountId = account.id;
    card.dataset.rank = account.rank || "other";
    const games = gameList(account);
    card.innerHTML = `
      ${avatarHtml(account)}
      <div class="kz-profile-main">
        <div class="kz-profile-name-row">
          <h3 class="kz-profile-name">${esc(account.username)}</h3>
          ${STAFF.has(account.rank) ? `<span class="kz-staff-mark">STAFF</span>` : ""}
        </div>
        <div class="kz-member-rank-line"><span class="kz-member-rank-chevron">${esc(chevrons(account.rank))}</span><span>${esc(meta.label)}</span></div>
        <div class="kz-profile-meta">
          <span>${esc(games.slice(0, 2).join(" · ") || "بازی ثبت نشده")}</span>
          ${account.joined_at ? `<span>عضویت: ${esc(new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(account.joined_at)))}</span>` : ""}
        </div>
        <p class="kz-profile-bio ${account.bio ? "" : "is-empty"}">${esc(account.bio || "برای دیدن معرفی و دستاوردها بازش کن.")}</p>
      </div>
      <div class="kz-profile-side">
        <span class="kz-profile-arrow" aria-hidden="true">←</span>
        ${isStaff() ? `<div class="kz-profile-admin-actions"><button class="btn ghost small kz-member-edit" type="button" data-id="${esc(account.id)}">ویرایش</button><button class="btn ghost small kz-member-delete" type="button" data-id="${esc(account.id)}">حذف</button></div>` : ""}
      </div>
    `;
    card.appendChild(presenceNode(account));
    const open = (event) => {
      if (event?.target?.closest?.(".kz-profile-admin-actions")) return;
      if (typeof window.openProfile === "function") window.openProfile(account);
      else fallbackProfile(account);
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(event);
      }
    });
    card
      .querySelector(".kz-member-edit")
      ?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (typeof window.wireMemberModal === "function")
          window.wireMemberModal();
        if (typeof window.openMemberModal === "function")
          window.openMemberModal(account.id, accounts);
      });
    card
      .querySelector(".kz-member-delete")
      ?.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (
          !confirm(`اکانت «${account.username}» و اطلاعات مرتبط باهاش حذف بشه؟`)
        )
          return;
        try {
          for (const [table, column] of [
            ["team_join_messages", "account_id"],
            ["team_join_requests", "account_id"],
            ["member_presence", "account_id"],
            ["achievements", "account_id"],
          ]) {
            const { error } = await window.sb
              .from(table)
              .delete()
              .eq(column, account.id);
            if (error) throw error;
          }
          const { error } = await window.sb
            .from("accounts")
            .delete()
            .eq("id", account.id);
          if (error) throw error;
          await refresh();
        } catch (error) {
          console.error("KillZone member delete", error);
          alert("حذف عضو انجام نشد.");
        }
      });
    return card;
  }

  function renderGroups() {
    const container = root();
    if (!container) return;
    container.replaceChildren();
    const query = norm(document.getElementById("memberSearch")?.value);
    const selectedGame = norm(
      document.getElementById("memberGameFilter")?.value || "all",
    );
    const status =
      document.getElementById("memberStatusFilter")?.value || "all";
    const sort = document.getElementById("memberSort")?.value || "name";

    const visibleAccounts = accounts.filter((account) => {
      const hay = norm(
        [account.username, account.bio, account.game, account.rank].join(" "),
      );
      const qOk = !query || hay.includes(query);
      const gOk =
        selectedGame === "all" ||
        gameList(account).some((g) => norm(g) === selectedGame);
      const sOk =
        status === "all" ||
        (status === "online" ? online(account.id) : !online(account.id));
      return qOk && gOk && sOk;
    });

    const compare = (a, b) => {
      if (sort === "online")
        return (
          Number(online(b.id)) - Number(online(a.id)) ||
          norm(a.username).localeCompare(norm(b.username), "fa")
        );
      if (sort === "recent")
        return Date.parse(b.joined_at || 0) - Date.parse(a.joined_at || 0);
      return norm(a.username).localeCompare(norm(b.username), "fa");
    };

    let groupCount = 0;
    RANKS.forEach((rank) => {
      const members = visibleAccounts
        .filter((a) => a.rank === rank.key)
        .sort(compare);
      if (!members.length) return;
      groupCount++;
      const section = document.createElement("section");
      section.className = "kz-rank-section";
      section.dataset.rank = rank.key;
      section.innerHTML = `<div class="kz-rank-heading"><div class="kz-rank-heading-main"><span class="kz-rank-chevron">${esc(chevrons(rank.key))}</span><div><span class="kz-rank-kicker">RANK // ${esc(rank.key.replace("_", " ").toUpperCase())}</span><h2>${esc(rank.label)}</h2></div></div><span class="kz-rank-count">${members.length} نفر</span></div>`;
      const grid = document.createElement("div");
      grid.className = "kz-profile-grid";
      members.forEach((account) => grid.appendChild(memberCard(account)));
      section.appendChild(grid);
      container.appendChild(section);
    });

    const known = new Set(RANKS.map((r) => r.key));
    const other = visibleAccounts
      .filter((a) => !known.has(a.rank))
      .sort(compare);
    if (other.length) {
      groupCount++;
      const section = document.createElement("section");
      section.className = "kz-rank-section";
      section.dataset.rank = "other";
      section.innerHTML = `<div class="kz-rank-heading"><div class="kz-rank-heading-main"><span class="kz-rank-chevron">▲</span><div><span class="kz-rank-kicker">RANK // OTHER</span><h2>سایر</h2></div></div><span class="kz-rank-count">${other.length} نفر</span></div>`;
      const grid = document.createElement("div");
      grid.className = "kz-profile-grid";
      other.forEach((account) => grid.appendChild(memberCard(account)));
      section.appendChild(grid);
      container.appendChild(section);
    }

    const result = document.getElementById("membersResultCount");
    if (result)
      result.textContent = `نمایش ${visibleAccounts.length} از ${accounts.length} عضو · ${groupCount} گروه رنک`;
    const clear = document.getElementById("memberSearchClear");
    if (clear) clear.hidden = !query;
    hydrateAvatars(container);

    if (accounts.length && !visibleAccounts.length) {
      const empty = document.createElement("div");
      empty.className = "kz-filter-empty";
      empty.innerHTML =
        "<strong>عضوی پیدا نشد</strong><span>عبارت جستجو یا فیلترها رو تغییر بده.</span>";
      container.appendChild(empty);
    }
  }

  function fallbackProfile(account) {
    let overlay = document.getElementById("kzProfileOverlayFallback");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "kzProfileOverlayFallback";
      overlay.className = "overlay kz-community-overlay";
      overlay.innerHTML =
        '<div class="modal kz-modal-panel"><button class="close" type="button" aria-label="بستن">✕</button><div class="kz-fallback-profile"></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.remove("show");
      });
      overlay
        .querySelector(".close")
        .addEventListener("click", () => overlay.classList.remove("show"));
    }
    const content = overlay.querySelector(".kz-fallback-profile");
    const games = gameList(account).join(" · ");
    content.innerHTML = `<div class="kz-profile-hero">${avatarHtml(account, true)}<div class="kz-profile-hero-copy"><span class="kz-eyebrow">KZ // MEMBER PROFILE</span><h3>${esc(account.username)}</h3><p>${esc(account.bio || "این عضو هنوز معرفی کوتاهی ثبت نکرده.")}</p></div></div><section class="kz-profile-section"><div class="kz-profile-section-title"><h4>اطلاعات عضو</h4><span>${esc(rankMeta(account.rank).label)}</span></div><div class="kz-profile-meta kz-profile-meta-large"><span>${esc(games || "بازی ثبت نشده")}</span>${account.joined_at ? `<span>عضویت از ${esc(new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(account.joined_at)))}</span>` : ""}</div></section><section class="kz-profile-section"><div class="kz-profile-section-title"><h4>دستاوردها</h4><span>ACHIEVEMENTS</span></div><div class="kz-fallback-achievements"><div class="kz-community-loading">در حال بارگذاری دستاوردها…</div></div></section>`;
    hydrateAvatars(content);
    overlay.classList.add("show");
    window.sb
      .from("achievements")
      .select("title,description,icon,awarded_at")
      .eq("account_id", account.id)
      .order("awarded_at", { ascending: false })
      .then(({ data }) => {
        const box = content.querySelector(".kz-fallback-achievements");
        if (!box) return;
        box.innerHTML = data?.length
          ? data
              .map(
                (a) =>
                  `<article class="kz-fallback-achievement"><strong>${esc(a.icon || "🏆")} ${esc(a.title)}</strong><p>${esc(a.description || "")}</p></article>`,
              )
              .join("")
          : '<div class="kz-community-empty">هنوز دستاوردی ثبت نشده.</div>';
      });
  }

  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const container = root();
      if (!container) return;
      if (!window.sb) {
        container.innerHTML =
          '<div class="kz-community-empty"><strong>در حال آماده‌سازی اتصال دیتابیس…</strong><span>اتصال هنوز آماده نشده؛ چند لحظه صبر کن.</span></div>';
        clearTimeout(retryTimer);
        retryTimer = setTimeout(refresh, 800);
        return;
      }
      container.innerHTML =
        '<div class="kz-community-loading">در حال دریافت اعضای تیم…</div>';
      if (!(await load())) {
        container.innerHTML =
          '<div class="kz-community-empty"><strong>بارگذاری اعضا ناموفق بود</strong><span>اتصال دیتابیس یا دسترسی جدول اعضا را بررسی کن و دوباره تلاش کن.</span></div>';
        return;
      }
      stats();
      populateGames();
      wire();
      renderGroups();
    } finally {
      busy = false;
    }
  }

  function wire() {
    if (bound) {
      const add = document.getElementById("addMemberBtn");
      if (add) add.style.display = isStaff() ? "inline-flex" : "none";
      const guests = document.getElementById("guestAccountsBtn");
      if (guests) guests.style.display = isStaff() ? "inline-flex" : "none";
      return;
    }
    bound = true;

    const search = document.getElementById("memberSearch");
    const clear = document.getElementById("memberSearchClear");
    const game = document.getElementById("memberGameFilter");
    const status = document.getElementById("memberStatusFilter");
    const sort = document.getElementById("memberSort");
    const reset = document.getElementById("memberResetFilters");
    search?.addEventListener("input", renderGroups);
    search?.addEventListener("compositionend", renderGroups);
    clear?.addEventListener("click", () => {
      if (!search) return;
      search.value = "";
      renderGroups();
      search.focus();
    });
    game?.addEventListener("change", renderGroups);
    status?.addEventListener("change", renderGroups);
    sort?.addEventListener("change", renderGroups);
    reset?.addEventListener("click", () => {
      if (search) search.value = "";
      if (game) game.value = "all";
      if (status) status.value = "all";
      if (sort) sort.value = "name";
      renderGroups();
      search?.focus();
    });

    const add = document.getElementById("addMemberBtn");
    if (add) add.style.display = isStaff() ? "inline-flex" : "none";
    const guests = document.getElementById("guestAccountsBtn");
    if (guests) {
      guests.style.display = isStaff() ? "inline-flex" : "none";
      guests.addEventListener("click", guestManager);
    }
  }

  async function guestManager() {
    if (!isStaff() || !window.sb) return;
    let overlay = document.getElementById("kzGuestManager");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "kzGuestManager";
      overlay.className = "overlay kz-community-overlay";
      overlay.innerHTML =
        '<div class="modal kz-modal-panel" role="dialog" aria-modal="true"><button class="close" id="kzGuestClose" type="button">✕</button><div class="kz-profile-section-title"><h4>اکانت‌های مهمان</h4><span>GUEST ACCOUNTS</span></div><div id="kzGuestList"></div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.remove("show");
      });
      overlay
        .querySelector("#kzGuestClose")
        .addEventListener("click", () => overlay.classList.remove("show"));
    }
    const box = overlay.querySelector("#kzGuestList");
    box.innerHTML =
      '<div class="kz-community-loading">در حال دریافت مهمان‌ها…</div>';
    overlay.classList.add("show");
    const { data, error } = await window.sb
      .from("accounts")
      .select("id,username,game,rank,team_status")
      .eq("rank", "guest")
      .order("username");
    if (error) {
      console.error("KillZone guest accounts", error);
      box.innerHTML =
        '<div class="kz-community-empty">دریافت مهمان‌ها ناموفق بود.</div>';
      return;
    }
    if (!data?.length) {
      box.innerHTML =
        '<div class="kz-community-empty">اکانت مهمانی وجود نداره.</div>';
      return;
    }
    box.innerHTML = `<div class="kz-runtime-guest-grid">${data.map((m) => `<article class="kz-runtime-guest-card" data-id="${esc(m.id)}"><div class="avatar">${esc((m.username || "?").slice(0, 2).toUpperCase())}</div><div class="body"><div class="name">${esc(m.username)}</div><div class="meta">${esc(m.game || "بازی ثبت نشده")} · مهمان</div></div><div class="actions"><button class="btn primary small" data-action="approve" type="button">✓ تأیید</button><button class="btn ghost small" data-action="delete" type="button">حذف</button></div></article>`).join("")}</div>`;
    box.querySelectorAll(".kz-runtime-guest-card").forEach((card) => {
      const id = card.dataset.id;
      card
        .querySelector('[data-action="approve"]')
        ?.addEventListener("click", async () => {
          const { error: updateError } = await window.sb
            .from("accounts")
            .update({ rank: "member", team_status: "approved" })
            .eq("id", id)
            .eq("rank", "guest");
          if (updateError) {
            console.error(updateError);
            alert("تأیید مهمان انجام نشد.");
            return;
          }
          overlay.classList.remove("show");
          await refresh();
        });
      card
        .querySelector('[data-action="delete"]')
        ?.addEventListener("click", async (event) => {
          const b = event.currentTarget;
          if (b.dataset.confirm !== "1") {
            b.dataset.confirm = "1";
            b.textContent = "تأیید حذف";
            setTimeout(() => {
              if (b.dataset.confirm === "1") {
                b.dataset.confirm = "0";
                b.textContent = "حذف";
              }
            }, 3500);
            return;
          }
          const { error: deleteError } = await window.sb
            .from("accounts")
            .delete()
            .eq("id", id)
            .eq("rank", "guest");
          if (deleteError) {
            console.error(deleteError);
            alert("حذف مهمان انجام نشد.");
            return;
          }
          overlay.classList.remove("show");
          await refresh();
        });
    });
  }

  function boot() {
    if (!root()) return;
    wire();
    refresh();
    window.kzMembersRefresh = refresh;
    window.addEventListener("kz:session-changed", () => {
      wire();
      refresh();
    });
    window.addEventListener("kz:supabase-ready", () => refresh());
    window.setInterval(refresh, 30000);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
