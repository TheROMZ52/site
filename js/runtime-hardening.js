// KillZone runtime hardening + small cross-page bug fixes.
(function () {
  "use strict";

  const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
  const USERNAME_RE = /^[A-Za-z0-9_\-آ-ی]+$/;
  const TICKET_LABELS = { pending: "در انتظار بررسی", reviewing: "در حال بررسی", waiting_applicant: "منتظر پاسخ شما", approved: "عضو تأییدشده", rejected: "درخواست رد شده" };
  const LION_SUN_FLAG = "https://upload.wikimedia.org/wikipedia/commons/f/fd/State_flag_of_Iran_%281964%E2%80%931980%29.svg";

  function injectButtonStyles() {
    if (document.getElementById("kz-button-system")) return;
    const link = document.createElement("link"); link.id = "kz-button-system"; link.rel = "stylesheet"; link.href = "/css/buttons.css?v=20260910"; document.head.appendChild(link);
  }
  function injectShellFixes() {
    if (document.getElementById("kz-shell-fixes")) return;
    const style = document.createElement("style"); style.id = "kz-shell-fixes"; style.textContent = `#userBox #logoutBtn{display:none!important}.btn,.link-btn,.admin-btn,.menu-toggle{visibility:visible!important;opacity:1!important}`; document.head.appendChild(style);
  }
  function injectTwemoji() {
    if (document.getElementById("kz-twemoji-api")) return;
    const style = document.createElement("style"); style.id = "kz-twemoji-style"; style.textContent = ".kz-twemoji,img.emoji,.kz-lion-sun{display:inline-block;width:1em;height:1em;margin:0 .05em 0 .1em;vertical-align:-.1em;line-height:1;object-fit:contain}"; document.head.appendChild(style);
    const script = document.createElement("script"); script.id = "kz-twemoji-api"; script.src = "https://cdn.jsdelivr.net/npm/@twemoji/api@17.0.3/dist/twemoji.min.js"; script.integrity = "sha384-Y5xukbGJwykbHHkTbLJykYLcBPFxrwipTbEh0puxhkz9CZ90raTPGe2Ks4vCxsYU"; script.crossOrigin = "anonymous"; script.onload = startTwemoji; script.onerror = () => console.warn("KillZone Twemoji failed to load"); document.head.appendChild(script);
  }
  function replaceLionSun(node) {
    if (!node) return;
    const textNodes = []; const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT); let current;
    while ((current = walk.nextNode())) { if (current.parentElement && current.parentElement.closest('script,style,textarea,input,[contenteditable="false"]')) continue; if (current.nodeValue?.includes("🇮🇷")) textNodes.push(current); }
    for (const textNode of textNodes) { const parts = textNode.nodeValue.split("🇮🇷"); const frag = document.createDocumentFragment(); parts.forEach((part, index) => { if (part) frag.appendChild(document.createTextNode(part)); if (index < parts.length - 1) { const img = document.createElement("img"); img.className = "kz-lion-sun"; img.src = LION_SUN_FLAG; img.alt = "پرچم شیر و خورشید ایران"; img.title = "شیر و خورشید"; img.loading = "lazy"; img.decoding = "async"; img.draggable = false; frag.appendChild(img); } }); textNode.parentNode?.replaceChild(frag, textNode); }
  }
  function startTwemoji() {
    if (!window.twemoji || typeof window.twemoji.parse !== "function") return;
    const options = { folder: "svg", ext: ".svg", base: "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/", className: "kz-twemoji" };
    try { replaceLionSun(document.body); window.twemoji.parse(document.body, options); } catch (e) { console.warn("KillZone Twemoji initial parse skipped", e); }
    const observer = new MutationObserver((mutations) => { for (const mutation of mutations) for (const node of mutation.addedNodes) if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) { try { replaceLionSun(node); if (node.nodeType === Node.ELEMENT_NODE) window.twemoji.parse(node, options); } catch (_) {} } });
    observer.observe(document.body, { childList: true, subtree: true }); window.kzTwemojiReady = true; window.kzLionSunReady = true;
  }
  function patchUnsafeSeed() { if (typeof window.ensureSeedAccounts !== "function" || window.ensureSeedAccounts.__kzSafeSeed) return; const safe = async function () { return; }; safe.__kzSafeSeed = true; window.ensureSeedAccounts = safe; }
  function patchUploadPhoto() { if (typeof window.uploadPhoto !== "function" || window.uploadPhoto.__kzImageFix) return; const original = window.uploadPhoto; const wrapped = async function (file, onStatus) { if (file && !ALLOWED_IMAGE_TYPES.has(file.type)) { onStatus?.("err", "فقط JPG، PNG یا WEBP مجازه."); return null; } if (file && file.size > 5 * 1024 * 1024) { onStatus?.("err", "حجم عکس باید کمتر از ۵ مگابایت باشه."); return null; } return original(file, onStatus); }; wrapped.__kzImageFix = true; window.uploadPhoto = wrapped; }
  function patchRegistration() { if (typeof window.registerUser !== "function" || window.registerUser.__kzRuntimeFix) return; const original = window.registerUser; const wrapped = async function (username, password, game, photo) { const name = String(username || "").trim(); const pass = String(password || ""); if (name.length < 3 || name.length > 24 || !USERNAME_RE.test(name)) return { ok: false, msg: "نام‌کاربری باید ۳ تا ۲۴ کاراکتر و فقط شامل حروف، عدد، _ یا - باشه." }; if (pass.length < 8 || pass.length > 128) return { ok: false, msg: "رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشه." }; return original(name, pass, game, photo); }; wrapped.__kzRuntimeFix = true; window.registerUser = wrapped; }
  function patchLoginUX() { const overlay = document.getElementById("loginOverlay"); if (!overlay || overlay.dataset.kzRuntimeReady === "1") return; overlay.dataset.kzRuntimeReady = "1"; const close = () => overlay.classList.remove("show"); const submit = document.getElementById("loginSubmit"); [document.getElementById("loginUser"), document.getElementById("loginPass")].filter(Boolean).forEach((input) => input.addEventListener("keydown", (e) => { if (e.key === "Enter" && submit) { e.preventDefault(); submit.click(); } })); overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); }); document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("show")) close(); }); }
  function patchMembersFilter() { if (!document.getElementById("membersContainer")) return; if (typeof window.fetchAccounts !== "function" || window.fetchAccounts.__kzApprovedOnly) return; const original = window.fetchAccounts; const wrapped = async function () { const rows = await original(); return (rows || []).filter((a) => a.team_status == null || a.team_status === "approved"); }; wrapped.__kzApprovedOnly = true; window.fetchAccounts = wrapped; }
  function syncRenderedAccountStatus(status) { const label = TICKET_LABELS[status]; if (!label || !document.getElementById("kzAccountApp")) return; document.querySelectorAll("#kzAccountApp .account-status").forEach((el) => { el.textContent = label; el.classList.remove("neutral", "info", "ok", "danger", "warn"); el.classList.add(status === "approved" ? "ok" : status === "rejected" ? "danger" : status === "waiting_applicant" ? "warn" : "info"); }); const meta = document.querySelectorAll("#kzAccountApp .profile-meta strong"); if (meta[2]) meta[2].textContent = label; }
  async function syncApplicantStatusFromTicket() { try { if (!window.currentUser || typeof sb === "undefined") return; const u = window.currentUser; const { data, error } = await sb.from("team_join_requests").select("status").eq("account_id", u.id).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (error || !data?.status || data.status === u.team_status) return; u.team_status = data.status; try { localStorage.setItem("kz_session", JSON.stringify({ id: u.id })); } catch {} syncRenderedAccountStatus(data.status); renderUserBox?.(); } catch (e) { console.warn("KillZone ticket status sync failed", e); } }

  function scrubSensitiveAccountData() {
    try {
      const user = window.currentUser;
      if (!user || !Object.prototype.hasOwnProperty.call(user, "pass_hash")) return;
      const { pass_hash: _discard, ...safe } = user;
      window.currentUser = safe;
    } catch (_) {}
  }

  function installFormGuards() {
    document.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const name = form.querySelector("#regName")?.value.trim();
      const pass = form.querySelector("#regPass")?.value || "";
      if (name != null && pass != null && form.id === "regForm") {
        if (name.length < 3 || name.length > 24 || !USERNAME_RE.test(name) || pass.length < 8 || pass.length > 128) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const msg = form.querySelector("#regMsg");
          if (msg) msg.innerHTML = '<div class="form-msg err">نام‌کاربری باید ۳ تا ۲۴ کاراکتر و رمز باید ۸ تا ۱۲۸ کاراکتر باشد؛ نام‌کاربری فقط حروف، عدد، _ یا - داشته باشد.</div>';
        }
      }
      setTimeout(scrubSensitiveAccountData, 0);
    }, true);
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && (target.closest("#loginSubmit") || target.closest("#regForm"))) setTimeout(scrubSensitiveAccountData, 25);
    }, true);
  }

  function fixHomeStats() {
    const map = { statMembers: "consoleMembers", statGames: "consoleGames", statModes: "consoleModes" };
    const load = async () => {
      if (!window.sb) return;
      const [a, g, m] = await Promise.all([sb.from("accounts").select("id").eq("team_status", "approved"), sb.from("game_blocks").select("id"), sb.from("game_modes").select("id")]);
      const values = { statMembers: a.error ? null : (a.data || []).length, statGames: g.error ? null : (g.data || []).length, statModes: m.error ? null : (m.data || []).length };
      Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el && value !== null) el.textContent = String(value); });
    };
    if (!Object.keys(map).some((id) => document.getElementById(id))) return;
    if (window.sb) load(); else window.addEventListener("kz:supabase-ready", load, { once: true });
  }

  function fixBrokenScriptDependencies() {
    const broken = ["/js/staff-permissions.js", "/js/ticket-ids.js"];
    document.querySelectorAll("script[src]").forEach((script) => { const src = new URL(script.src, location.href).pathname; if (broken.includes(src)) script.remove(); });
  }

  function fixChatSafetyConflict() {
    const page = document.querySelector("#chatMessages");
    if (!page) return;
    const safety = document.querySelector('script[src*="chat-safety.js"]');
    if (safety) safety.remove();
  }

  function fixMembershipNavigation() {
    document.querySelectorAll('a[href="register.html"]').forEach((a) => { if (location.pathname.includes("/register")) a.href = "/register"; });
  }

  function boot() {
    injectButtonStyles(); injectShellFixes(); injectTwemoji(); patchUnsafeSeed(); patchUploadPhoto(); patchRegistration(); patchLoginUX(); patchMembersFilter(); installFormGuards(); scrubSensitiveAccountData(); fixHomeStats(); fixBrokenScriptDependencies(); fixChatSafetyConflict(); fixMembershipNavigation(); setTimeout(syncApplicantStatusFromTicket, 250); setTimeout(scrubSensitiveAccountData, 800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();