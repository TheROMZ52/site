// KillZone account domain — merged from account-globals.js, account-fixes.js, account-fixes-2.js and account-page.js.
// Structural refactor only: the original sections remain in execution order.
(function () {
  "use strict";
  try {
    Object.defineProperty(window, "currentUser", {
      configurable: true,
      get: function () {
        return currentUser;
      },
      set: function (v) {
        currentUser = v;
      },
    });
  } catch (e) {
    console.warn("KillZone account bridge unavailable", e);
  }
})();

(function () {
  "use strict";
  const FIX_SESSION_KEY = "kz_session";
  let profileOverlay = null,
    profileBusy = false;
  function esc(v) {
    return typeof escapeHtml === "function"
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
  }
  function status(msg, ok) {
    const el = document.getElementById("kzProfileMsg");
    if (el)
      el.innerHTML = `<div class="form-msg ${ok ? "ok" : "err"}">${esc(msg)}</div>`;
  }
  function ensureStyles() {
    if (document.getElementById("kzAccountFixStyles")) return;
    const s = document.createElement("style");
    s.id = "kzAccountFixStyles";
    s.textContent = `.kz-profile-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.kz-profile-danger{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.kz-danger{border:1px solid #9b3d2c!important;color:#ffb3a5!important;background:transparent}.kz-danger:hover{background:#7d2d20!important;color:#fff!important}.kz-profile-modal{max-width:620px!important}.kz-profile-warning{padding:12px 14px;border:1px solid #9b3d2c;background:rgba(155,61,44,.12);line-height:1.8;margin-top:12px}.kz-staff-nav{position:relative}.kz-staff-nav::after{content:'STAFF';margin-right:6px;font-size:9px;opacity:.55;font-family:monospace}`;
    document.head.appendChild(s);
  }
  function removeProfileOverlay() {
    if (profileOverlay) {
      profileOverlay.remove();
      profileOverlay = null;
    }
  }
  function openProfile() {
    location.href = "account.html";
  }
  async function saveProfile() {
    if (
      profileBusy ||
      !window.currentUser ||
      window.currentUser.team_status !== "approved"
    )
      return;
    profileBusy = true;
    const btn = document.getElementById("kzProfileSave");
    if (btn) btn.disabled = true;
    try {
      const updates = {
        game: (document.getElementById("kzProfileGame")?.value || "").trim(),
      };
      const file = document.getElementById("kzProfilePhoto")?.files?.[0];
      if (file && typeof uploadPhoto === "function") {
        const url = await uploadPhoto(file, () => {});
        if (url) updates.photo = url;
      }
      const newPass = document.getElementById("kzProfilePass")?.value || "";
      if (newPass) updates.pass_hash = await hashPass(newPass);
      const { data, error } = await sb
        .from("accounts")
        .update(updates)
        .eq("id", window.currentUser.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("اکانت پیدا نشد یا اجازه ویرایش نداری.");
      window.currentUser = data;
      saveSession(data);
      status("تغییرات با موفقیت ذخیره شد ✔", true);
      if (typeof renderUserBox === "function") renderUserBox();
      setTimeout(removeProfileOverlay, 700);
    } catch (e) {
      console.error(e);
      status(e.message || "ذخیره تغییرات ناموفق بود.", false);
    } finally {
      profileBusy = false;
      if (btn) btn.disabled = false;
    }
  }
  async function deleteOwnAccount() {
    if (!window.currentUser || profileBusy) return;
    const u = window.currentUser;
    const confirmation = prompt(
      `برای حذف دائمی اکانت «${u.username}»، نام‌کاربری را دقیقاً وارد کن:`,
    );
    if (confirmation !== u.username) return;
    if (!confirm("مطمئنی؟ این عملیات قابل برگشت نیست.")) return;
    profileBusy = true;
    try {
      const m = await sb
        .from("team_join_messages")
        .delete()
        .eq("account_id", u.id);
      if (m.error) throw m.error;
      const r = await sb
        .from("team_join_requests")
        .delete()
        .eq("account_id", u.id);
      if (r.error) throw r.error;
      const { error } = await sb.from("accounts").delete().eq("id", u.id);
      if (error) throw error;
      localStorage.removeItem(FIX_SESSION_KEY);
      window.currentUser = null;
      removeProfileOverlay();
      if (typeof renderUserBox === "function") renderUserBox();
      location.href = "index.html";
    } catch (e) {
      console.error(e);
      alert(
        "حذف اکانت انجام نشد. اگر خطای RLS دیدی، سیاست‌های Supabase باید اصلاح شوند.",
      );
    } finally {
      profileBusy = false;
    }
  }
  function addProfileButton() {
    const box = document.getElementById("userBox");
    if (!box || !window.currentUser || box.querySelector("#kzProfileBtn"))
      return;
    const logout = box.querySelector("#logoutBtn");
    const a = document.createElement("a");
    a.id = "kzProfileBtn";
    a.className = "link-btn";
    a.textContent = "⚙️ اکانت";
    a.href = "account.html";
    if (logout) box.insertBefore(a, logout);
    else box.appendChild(a);
  }
  function patchUserBox() {
    if (
      typeof window.renderUserBox !== "function" ||
      window.renderUserBox.__kzAccountFix
    )
      return;
    const original = window.renderUserBox;
    const wrapped = function () {
      original();
      addProfileButton();
      updateRubikaAccess();
    };
    wrapped.__kzAccountFix = true;
    window.renderUserBox = wrapped;
  }
  function patchRegistration() {
    if (
      typeof window.registerUser !== "function" ||
      window.registerUser.__kzAccountFix
    )
      return;
    const original = window.registerUser;
    const wrapped = async function (username, password, game, photo) {
      const res = await original(username, password, game, photo);
      if (res?.ok && res.account?.id) {
        const { data, error } = await sb
          .from("accounts")
          .update({ rank: "guest", team_status: "none" })
          .eq("id", res.account.id)
          .select("*")
          .maybeSingle();
        if (!error && data) res.account = data;
      }
      return res;
    };
    wrapped.__kzAccountFix = true;
    window.registerUser = wrapped;
  }
  function addStaffRequestsMenu() {
    const nav = document.querySelector("nav.main");
    if (!nav) return;
    const old = nav.querySelector(".kz-staff-nav");
    const allowed = !!(
      window.currentUser &&
      ["developer", "co_owner", "owner"].includes(window.currentUser.rank)
    );
    if (!allowed) {
      if (old) old.remove();
      return;
    }
    if (old) return;
    const a = document.createElement("a");
    a.className = "kz-staff-nav";
    a.href = "join.html#requests";
    a.textContent = "درخواست‌های عضویت";
    const reg = nav.querySelector('a[href="register.html"]');
    if (reg) nav.insertBefore(a, reg);
    else nav.appendChild(a);
  }
  async function syncSessionThenFixUI() {
    patchUserBox();
    patchRegistration();
    if (typeof window.initSession === "function") await window.initSession();
    if (typeof window.renderUserBox === "function") window.renderUserBox();
    addStaffRequestsMenu();
    if (
      location.pathname.endsWith("/join.html") ||
      location.pathname.endsWith("join.html")
    ) {
      if (typeof window.kzRenderJoinPage === "function")
        window.kzRenderJoinPage();
      else if (typeof window.renderJoinPage === "function")
        window.renderJoinPage();
      else if (typeof window.kzRenderJoinApp === "function")
        window.kzRenderJoinApp();
      else window.dispatchEvent(new CustomEvent("kz:session-ready"));
    }
  }
  function updateRubikaAccess() {
    const allowed = !!(
      window.currentUser && window.currentUser.team_status === "approved"
    );
    document.querySelectorAll(".rubika-link").forEach((link) => {
      link.style.display = allowed ? "" : "none";
      link.setAttribute("aria-hidden", allowed ? "false" : "true");
      if (!allowed) {
        link.removeAttribute("href");
        link.setAttribute("title", "فقط اعضای تأییدشده تیم دسترسی دارند");
        link.onclick = (e) => e.preventDefault();
      } else
        link.href = "https://rubika.ir/joing/BBEDHCIEG0CUGHJUEJWPLKHRDAWOCCSB";
    });
  }
  function removeTextLimits() {
    document.querySelectorAll("input, textarea").forEach((el) => {
      if (
        el.type === "number" ||
        el.type === "file" ||
        el.type === "checkbox" ||
        el.type === "radio"
      )
        return;
      el.removeAttribute("maxlength");
      el.removeAttribute("minlength");
    });
  }
  function boot() {
    ensureStyles();
    patchUserBox();
    patchRegistration();
    setTimeout(async () => {
      await syncSessionThenFixUI();
      updateRubikaAccess();
      removeTextLimits();
      const observer = new MutationObserver(() => {
        updateRubikaAccess();
        removeTextLimits();
        addStaffRequestsMenu();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }, 0);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.kzOpenProfile = openProfile;
  window.kzAddStaffRequestsMenu = addStaffRequestsMenu;
})();

(function () {
  function patchAccountsForMembers() {
    if (
      typeof window.fetchAccounts !== "function" ||
      window.fetchAccounts.__kzStatusFix
    )
      return;
    const original = window.fetchAccounts;
    const wrapped = async function () {
      const rows = await original();
      if (document.getElementById("membersContainer"))
        return (rows || []).filter(
          (a) => a.team_status == null || a.team_status === "approved",
        );
      return rows || [];
    };
    wrapped.__kzStatusFix = true;
    window.fetchAccounts = wrapped;
  }
  window.addEventListener("kz:session-ready", () => {
    if (
      location.pathname.endsWith("join.html") &&
      typeof window.renderUserBox === "function"
    )
      window.renderUserBox();
  });
  if (document.readyState === "loading")
    document.addEventListener(
      "DOMContentLoaded",
      () => setTimeout(patchAccountsForMembers, 0),
      { once: true },
    );
  else setTimeout(patchAccountsForMembers, 0);
})();

// Former account-page.js. It is intentionally guarded so this code cannot redirect other pages.
(function () {
  "use strict";
  if (!document.getElementById("kzAccountApp")) return;
  const REVIEWERS = ["developer", "co_owner", "owner"];
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
  const rank = () =>
    typeof rankLabel === "function"
      ? rankLabel(window.currentUser?.rank)
      : window.currentUser?.rank || "—";
  const statusMap = {
    none: ["بدون درخواست", "neutral"],
    reviewing: ["در حال بررسی", "info"],
    approved: ["عضو تأییدشده", "ok"],
    rejected: ["درخواست رد شده", "danger"],
    pending: ["در انتظار بررسی", "info"],
    waiting_applicant: ["منتظر پاسخ شما", "warn"],
  };
  let busy = false;
  function showMsg(text, ok = false) {
    const el = document.getElementById("kzAccountMsg");
    if (el)
      el.innerHTML = `<div class="account-msg ${ok ? "ok" : "err"}">${esc(text)}</div>`;
  }
  function statusInfo(value) {
    return statusMap[value] || [value || "نامشخص", "neutral"];
  }
  function avatar(u) {
    return u.photo
      ? `<img src="${esc(u.photo)}" alt="${esc(u.username)}" onerror="this.outerHTML='<div class=account-avatar-fallback>${esc((u.username || "?").slice(0, 2).toUpperCase())}</div>'">`
      : `<div class="account-avatar-fallback">${esc((u.username || "?").slice(0, 2).toUpperCase())}</div>`;
  }
  function render(u, request) {
    const root = document.getElementById("kzAccountApp");
    if (!root) return;
    const [statusLabel, statusTone] = statusInfo(u.team_status || "none");
    const isApproved = u.team_status === "approved";
    const membershipVisible = u.rank === "guest";
    root.innerHTML = `<section class="account-card account-profile-card"><div class="account-card-head"><span class="mini-label">IDENTITY</span><span class="account-status ${statusTone}">${esc(statusLabel)}</span></div><div class="profile-main">${avatar(u)}<div class="profile-name"><h2>${esc(u.username)}</h2><div class="rank-line"><span>${esc(rank())}</span><i>${typeof rankChevrons === "function" ? rankChevrons(u.rank) : "▲"}</i></div></div></div><div class="profile-meta"><div><small>نام کاربری</small><strong>${esc(u.username)}</strong></div><div><small>بازی مورد علاقه</small><strong>${esc(u.game || "هنوز انتخاب نشده")}</strong></div><div><small>وضعیت تیم</small><strong>${esc(statusLabel)}</strong></div></div></section>${isApproved ? `<section class="account-card account-edit-card"><div class="account-card-head"><div><span class="mini-label">PROFILE / EDIT</span><h2>ویرایش اطلاعات</h2></div><span class="card-mark">✦</span></div><form id="kzAccountForm" class="account-form"><div class="account-field"><label for="kzAccountUsername">نام کاربری</label><input id="kzAccountUsername" value="${esc(u.username)}" disabled><small>نام کاربری قابل تغییر نیست.</small></div><div class="account-field"><label for="kzAccountGame">بازی‌های مورد علاقه</label><input id="kzAccountGame" value="${esc(u.game || "")}" placeholder="مثلاً Minecraft / COD"></div><div class="account-field full"><label for="kzAccountPhoto">عکس پروفایل</label><input id="kzAccountPhoto" type="file" accept="image/*"><small>JPG / PNG / WEBP — حداکثر ۵MB</small></div><div class="account-field full"><label for="kzAccountPass">رمز عبور جدید <span>اختیاری</span></label><input id="kzAccountPass" type="password" placeholder="اگر نمی‌خوای تغییرش بدی خالی بذار"></div><div class="account-form-actions"><button class="btn primary" id="kzSaveAccount" type="submit">ذخیره تغییرات</button><div id="kzAccountMsg" aria-live="polite"></div></div></form></section>` : ""}${membershipVisible ? `<section class="account-card account-membership-card"><div class="account-card-head"><div><span class="mini-label">TEAM ACCESS</span><h2>وضعیت عضویت</h2></div><span class="card-mark">◈</span></div>${request ? `<div class="membership-status"><div><span class="status-orb ${statusTone}"></span><strong>${esc(statusLabel)}</strong></div><a class="btn ghost" href="/join">مشاهده تیکت ←</a></div><p class="membership-copy">آخرین درخواست عضویتت همین‌جاست. برای ادامه گفت‌وگو یا دیدن پاسخ مدیریت وارد تیکت شو.</p>` : `<div class="membership-empty"><strong>هنوز درخواست عضویت ندادی.</strong><p>اگر آماده‌ای، فرم عضویت رو پر کن تا مدیریت KillZone بررسیش کنه.</p><a class="btn primary" href="/join">درخواست عضویت</a></div>`}${u.team_status === "approved" ? `<div class="approved-note">✓ دسترسی گروه روبیکا برای اکانتت فعاله.</div>` : ""}</section>` : ""}<section class="account-card account-security-card"><div class="account-card-head"><div><span class="mini-label">SECURITY</span><h2>امنیت و حساب</h2></div><span class="card-mark">⌁</span></div><div class="security-row"><div><strong>اکانت KillZone</strong><p>جلسه ورود روی همین دستگاه ذخیره شده.</p></div><button class="btn ghost" id="kzLogoutAccount">خروج از اکانت</button></div><div class="danger-zone"><div><strong>حذف دائمی اکانت</strong><p>تمام اطلاعات اکانت و درخواست‌های عضویت حذف می‌شن و این کار قابل برگشت نیست.</p></div><button class="btn kz-danger" id="kzDeleteAccountPage">حذف اکانت</button></div></section>`;
    if (isApproved)
      document.getElementById("kzAccountForm").addEventListener("submit", save);
    document.getElementById("kzLogoutAccount").onclick = logout;
    document.getElementById("kzDeleteAccountPage").onclick = deleteAccount;
  }
  async function load() {
    if (typeof initSession === "function") await initSession();
    const u = window.currentUser;
    if (!u) {
      location.href = "/";
      return;
    }
    const { data: requests } = await sb
      .from("team_join_requests")
      .select("id,status,created_at")
      .eq("account_id", u.id)
      .order("created_at", { ascending: false })
      .limit(1);
    render(u, requests?.[0] || null);
  }
  async function save(e) {
    e.preventDefault();
    if (
      busy ||
      !window.currentUser ||
      window.currentUser.team_status !== "approved"
    )
      return;
    busy = true;
    const btn = document.getElementById("kzSaveAccount");
    if (btn) btn.disabled = true;
    try {
      const updates = {
        game: (document.getElementById("kzAccountGame")?.value || "").trim(),
      };
      const file = document.getElementById("kzAccountPhoto")?.files?.[0];
      if (file) {
        const url = await uploadPhoto(file, (kind, text) =>
          showMsg(text, kind === "ok"),
        );
        if (url) updates.photo = url;
        else if (file) throw new Error("آپلود عکس ناموفق بود.");
      }
      const pass = document.getElementById("kzAccountPass")?.value || "";
      if (pass) updates.pass_hash = await hashPass(pass);
      const { data, error } = await sb
        .from("accounts")
        .update(updates)
        .eq("id", window.currentUser.id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("اکانت پیدا نشد یا اجازه ویرایش نداری.");
      window.currentUser = data;
      saveSession(data);
      showMsg("تغییرات با موفقیت ذخیره شد.", true);
      setTimeout(() => render(data, null), 650);
    } catch (err) {
      console.error(err);
      showMsg(err.message || "ذخیره تغییرات ناموفق بود.");
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  }
  function logout() {
    if (typeof clearSession === "function") clearSession();
    window.currentUser = null;
    location.href = "/";
  }
  async function deleteAccount() {
    if (busy || !window.currentUser) return;
    const u = window.currentUser;
    const ok = window.confirm(
      `اکانت «${u.username}» و درخواست‌های عضویت حذف بشه؟ این کار قابل برگشت نیست.`,
    );
    if (!ok) return;
    busy = true;
    try {
      const m = await sb
        .from("team_join_messages")
        .delete()
        .eq("account_id", u.id);
      if (m.error) throw m.error;
      const r = await sb
        .from("team_join_requests")
        .delete()
        .eq("account_id", u.id);
      if (r.error) throw r.error;
      const a = await sb.from("accounts").delete().eq("id", u.id);
      if (a.error) throw a.error;
      if (typeof clearSession === "function") clearSession();
      window.currentUser = null;
      location.href = "/";
    } catch (err) {
      console.error(err);
      showMsg(err.message || "حذف اکانت انجام نشد.");
    } finally {
      busy = false;
    }
  }
  function boot() {
    load();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
