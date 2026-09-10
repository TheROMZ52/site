// KillZone presence domain.
// Sources merged from presence.js, presence-account.js and presence-members.js.
(function () {
  "use strict";
  const HEARTBEAT_MS = 30000;
  const ONLINE_MS = 5 * 60 * 1000;
  const AWAY_MS = 10 * 60 * 1000;
  const STATUS_LABELS = {
    playing: ["در حال بازی", "playing", "🎮"],
    competitive: ["در حال رقابت", "competitive", "🏆"],
    ready: ["آماده برای بازی", "ready", "🟢"],
    busy: ["مشغول", "busy", "🔴"],
    away: ["AFK", "away", "💤"],
  };
  let timer = null,
    lastAccountId = null,
    heartbeatRunning = false;
  window.kzPresence = window.kzPresence || {
    ONLINE_MS,
    AWAY_MS,
    STATUS_LABELS,
    formatStatus(status, game, text) {
      const item = STATUS_LABELS[status] || STATUS_LABELS.ready;
      return {
        label: item[0],
        tone: item[1],
        icon: item[2],
        game: game || "",
        text: text || "",
      };
    },
    isOnline(row) {
      return (
        !!row && Date.now() - new Date(row.last_seen).getTime() <= ONLINE_MS
      );
    },
    isAway(row) {
      return (
        !!row &&
        !this.isOnline(row) &&
        Date.now() - new Date(row.last_seen).getTime() <= AWAY_MS
      );
    },
  };
  async function getUser() {
    if (typeof initSession === "function" && !window.currentUser)
      await initSession();
    return window.currentUser || null;
  }
  async function heartbeat() {
    if (heartbeatRunning) return;
    heartbeatRunning = true;
    try {
      const u = await getUser();
      if (!u || u.team_status !== "approved") return;
      if (lastAccountId && lastAccountId !== u.id) return;
      lastAccountId = u.id;
      const { data: old } = await sb
        .from("member_presence")
        .select("status,game,status_text")
        .eq("account_id", u.id)
        .maybeSingle();
      const now = new Date().toISOString();
      const payload = {
        account_id: u.id,
        status: old?.status || "ready",
        game: old?.game || u.game || "",
        status_text: old?.status_text || "",
        last_seen: now,
        updated_at: now,
      };
      const { error } = await sb
        .from("member_presence")
        .upsert(payload, { onConflict: "account_id" });
      if (error) console.warn("KillZone presence heartbeat:", error);
    } finally {
      heartbeatRunning = false;
    }
  }
  function scheduleHeartbeat() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      await heartbeat();
      scheduleHeartbeat();
    }, HEARTBEAT_MS);
  }
  async function bootCore() {
    if (!window.sb) return setTimeout(bootCore, 1000);
    await heartbeat();
    scheduleHeartbeat();
  }
  ["focus", "pageshow", "online"].forEach((eventName) =>
    window.addEventListener(eventName, () => heartbeat(), { passive: true }),
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") heartbeat();
  });
  window.kzPresence.refresh = heartbeat;
  window.kzPresence.setStatus = async function (status, game, statusText) {
    const u = await getUser();
    if (!u || u.team_status !== "approved")
      return {
        ok: false,
        msg: "فقط اعضای تأییدشده می‌تونن وضعیت اسکواد رو تنظیم کنن.",
      };
    if (!STATUS_LABELS[status]) return { ok: false, msg: "وضعیت نامعتبره." };
    const now = new Date().toISOString();
    const payload = {
      account_id: u.id,
      status,
      game: (game || "").trim(),
      status_text: (statusText || "").trim(),
      last_seen: now,
      updated_at: now,
    };
    const { data, error } = await sb
      .from("member_presence")
      .upsert(payload, { onConflict: "account_id" })
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, msg: error.message };
    return { ok: true, data };
  };
  window.kzPresence.fetchAll = async function () {
    const { data, error } = await sb.from("member_presence").select("*");
    if (error) {
      console.warn("KillZone presence fetch:", error);
      return [];
    }
    return data || [];
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bootCore, { once: true });
  else bootCore();

  // Former presence-account.js.
  const statuses = [
    ["playing", "🎮 در حال بازی"],
    ["competitive", "🏆 در حال رقابت"],
    ["ready", "🟢 آماده برای بازی"],
    ["busy", "🔴 مشغول"],
    ["away", "💤 AFK"],
  ];
  let accountInjected = false;
  const esc = (v) =>
    typeof escapeHtml === "function"
      ? escapeHtml(v)
      : String(v ?? "").replace(
          /[&<>\"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '\"': "&quot;",
              "'": "&#39;",
            })[c],
        );
  async function injectAccountPresence() {
    if (accountInjected || !window.kzPresence || !window.currentUser) return;
    const root = document.getElementById("kzAccountApp");
    if (!root) return;
    if (!root.querySelector(".account-profile-card"))
      return setTimeout(injectAccountPresence, 250);
    if (window.currentUser.team_status !== "approved") {
      accountInjected = true;
      return;
    }
    accountInjected = true;
    const u = window.currentUser;
    const { data } = await sb
      .from("member_presence")
      .select("*")
      .eq("account_id", u.id)
      .maybeSingle();
    const row = data || {
      status: "ready",
      game: u.game || "",
      status_text: "",
    };
    const card = document.createElement("section");
    card.className = "account-card kz-presence-card";
    card.innerHTML = `<div class="account-card-head"><div><span class="mini-label">SQUAD PRESENCE</span><h2>وضعیت من</h2></div><span class="card-mark">●</span></div><form id="kzPresenceForm" class="account-form"><div class="account-field"><label for="kzPresenceStatus">وضعیت</label><select id="kzPresenceStatus">${statuses.map(([v, l]) => `<option value="${v}" ${row.status === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="account-field"><label for="kzPresenceGame">الان مشغول چه بازی‌ای؟</label><input id="kzPresenceGame" maxlength="60" value="${esc(row.game || "")}" placeholder="مثلاً Minecraft"></div><div class="account-field full"><label for="kzPresenceText">متن وضعیت <span>اختیاری</span></label><input id="kzPresenceText" maxlength="100" value="${esc(row.status_text || "")}" placeholder="مثلاً منتظر هم‌تیمی‌هام"></div><div class="account-form-actions"><button class="btn primary" type="submit">ذخیره وضعیت</button><div id="kzPresenceMsg" aria-live="polite"></div></div></form>`;
    root.appendChild(card);
    card
      .querySelector("#kzPresenceForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        const msg = card.querySelector("#kzPresenceMsg");
        const result = await window.kzPresence.setStatus(
          card.querySelector("#kzPresenceStatus").value,
          card.querySelector("#kzPresenceGame").value,
          card.querySelector("#kzPresenceText").value,
        );
        msg.innerHTML = `<div class="account-msg ${result.ok ? "ok" : "err"}">${esc(result.ok ? "وضعیت ذخیره شد." : result.msg)}</div>`;
      });
  }
  function bootAccountPresence() {
    setTimeout(injectAccountPresence, 350);
    setInterval(() => {
      if (!accountInjected) injectAccountPresence();
    }, 1000);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bootAccountPresence, {
      once: true,
    });
  else bootAccountPresence();

  // Former presence-members.js.
  const escMember = (v) =>
    typeof escapeHtml === "function"
      ? escapeHtml(v)
      : String(v ?? "").replace(
          /[&<>\"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '\"': "&quot;",
              "'": "&#39;",
            })[c],
        );
  const ageText = (ms) => {
    const m = Math.max(1, Math.floor(ms / 60000));
    return m < 60
      ? `آخرین فعالیت: ${m} دقیقه پیش`
      : `آخرین فعالیت: ${Math.floor(m / 60)} ساعت پیش`;
  };
  let memberRunning = false;
  async function renderMembersPresence() {
    if (memberRunning) return;
    const container = document.getElementById("membersContainer");
    if (
      !container ||
      !window.kzPresence ||
      !window.kzPresence.fetchAll ||
      typeof sb === "undefined"
    )
      return;
    const cards = container.querySelectorAll(".member-tile");
    if (!cards.length) return;
    memberRunning = true;
    try {
      const [rows, accounts] = await Promise.all([
        window.kzPresence.fetchAll(),
        sb.from("accounts").select("id,username,team_status"),
      ]);
      const approvedIds = new Set(
        (accounts.data || [])
          .filter((a) => a.team_status == null || a.team_status === "approved")
          .map((a) => a.id),
      );
      const names = new Map(
        (accounts.data || [])
          .filter((a) => approvedIds.has(a.id))
          .map((a) => [a.id, a.username]),
      );
      const byName = new Map(
        (rows || [])
          .filter((r) => approvedIds.has(r.account_id))
          .map((r) => [String(names.get(r.account_id) || "").toLowerCase(), r]),
      );
      cards.forEach((card) => {
        const nameEl = card.querySelector("h4");
        if (!nameEl) return;
        const old = card.querySelector(".kz-presence");
        if (old) old.remove();
        const row = byName.get(nameEl.textContent.trim().toLowerCase());
        const wrap = document.createElement("div");
        wrap.className = "kz-presence";
        if (!row) {
          wrap.innerHTML =
            '<span class="kz-presence-dot offline"></span><span>آفلاین</span>';
          card.appendChild(wrap);
          return;
        }
        const online = window.kzPresence.isOnline(row);
        const info = window.kzPresence.formatStatus(
          row.status,
          row.game,
          row.status_text,
        );
        const tone = online ? info.tone : "offline";
        const label = online ? info.label : "آفلاین";
        wrap.innerHTML = `<span class="kz-presence-dot ${tone}"></span><span>${info.icon} ${escMember(label)}</span>${online && info.game ? `<small>${escMember(info.game)}</small>` : ""}${online && info.text ? `<small>${escMember(info.text)}</small>` : ""}${!online && row.last_seen ? `<small>${ageText(Date.now() - new Date(row.last_seen).getTime())}</small>` : ""}`;
        card.appendChild(wrap);
      });
    } catch (err) {
      console.warn("KillZone presence render skipped", err);
    } finally {
      memberRunning = false;
    }
  }
  function bootMembersPresence() {
    setTimeout(renderMembersPresence, 1000);
    setInterval(renderMembersPresence, 5000);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", bootMembersPresence, {
      once: true,
    });
  else bootMembersPresence();
})();
