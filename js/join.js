// KillZone join domain — merged from membership.js, join-session-fix.js and join-rescue.js.
// Structural refactor only; original helper, applicant and reviewer sections keep their order.

// ===== Former membership.js =====
const KZ_PENDING = "pending";
const KZ_APPROVED = "approved";
const KZ_ACTIVE_TICKET_STATUSES = ["pending", "reviewing", "waiting_applicant"];
const KZ_TICKET_STATUS = {
  pending: ["در انتظار بررسی", "review"],
  reviewing: ["در حال بررسی", "review"],
  waiting_applicant: ["منتظر پاسخ متقاضی", "waiting"],
  approved: ["پذیرفته شد", "approved"],
  rejected: ["رد شد", "rejected"],
  closed: ["بسته شد", "closed"],
};
function kzIsMember(u) {
  return !!(u && u.team_status === KZ_APPROVED);
}
function kzIsPending(u) {
  return !!(u && KZ_ACTIVE_TICKET_STATUSES.includes(u.team_status));
}
function kzIsReviewer(u) {
  return !!(u && ["developer", "co_owner", "owner"].includes(u.rank));
}
function kzStatusText(status) {
  return KZ_TICKET_STATUS[status]?.[0] || status || "نامشخص";
}
function kzStatusClass(status) {
  return KZ_TICKET_STATUS[status]?.[1] || "closed";
}
function kzFormatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (e) {
    return value;
  }
}
function kzNewId(prefix) {
  return (
    prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9)
  );
}
function kzMembershipButtonHtml() {
  if (!currentUser || kzIsMember(currentUser)) return "";
  if (kzIsPending(currentUser))
    return '<a class="admin-btn on" href="/join">تیکت عضویت ⏳</a>';
  if (currentUser.team_status === "rejected")
    return '<a class="link-btn" href="/join">مشاهده درخواست عضویت</a>';
  return '<a class="link-btn" href="/join">درخواست عضویت</a>';
}
function kzRefreshMembershipUI() {
  const box = document.getElementById("userBox");
  if (!box || !currentUser) return;
  const old = box.querySelector(".kz-membership-status");
  if (old) old.remove();
  const html = kzMembershipButtonHtml();
  if (!html) return;
  const wrap = document.createElement("span");
  wrap.className = "kz-membership-status";
  wrap.innerHTML = html;
  box.insertBefore(wrap, box.querySelector("#logoutBtn"));
}
function kzPatchUserBox() {
  if (typeof renderUserBox !== "function") return;
  const original = renderUserBox;
  window.renderUserBox = function () {
    original();
    kzRefreshMembershipUI();
  };
  renderUserBox();
}
function kzApplyJoinNav() {
  document.querySelectorAll("nav.main").forEach((nav) => {
    if (nav.querySelector('a[href="/join"]')) return;
    const reg = nav.querySelector('a[href="/register"]');
    if (!reg) return;
    const a = document.createElement("a");
    a.href = "/join";
    a.textContent = "عضویت در تیم";
    nav.insertBefore(a, reg);
  });
}
function kzRequestFormValues(form) {
  const get = (id) => document.getElementById(id)?.value?.trim() || "";
  return {
    first_name: get("joinFirstName"),
    last_name: get("joinLastName"),
    rubika_id: get("joinRubika"),
    age: get("joinAge") ? Number(get("joinAge")) : null,
    city: get("joinCity"),
    other_games: get("joinGames"),
    skill_level: get("joinSkill"),
    gaming_years: get("joinYears") ? Number(get("joinYears")) : null,
    weekly_activity: get("joinActivity"),
    voice_chat: get("joinVoice"),
    why_join: get("joinWhy"),
    contribution: get("joinContribution"),
    conflict_response: get("joinConflict"),
    how_found_us: get("joinFound"),
    info_confirmed: !!document.getElementById("joinInfoConfirmed")?.checked,
  };
}
function kzValidateJoinForm(v) {
  const errors = [];
  if (!v.first_name) errors.push("نام را وارد کن.");
  if (!v.rubika_id) errors.push("آیدی روبیکا را وارد کن.");
  if (v.age !== null && (!Number.isInteger(v.age) || v.age < 1 || v.age > 100))
    errors.push("سن باید یک عدد معتبر باشد.");
  if (
    v.gaming_years !== null &&
    (!Number.isInteger(v.gaming_years) ||
      v.gaming_years < 0 ||
      v.gaming_years > 80)
  )
    errors.push("مدت بازی کردن معتبر نیست.");
  if (!v.skill_level) errors.push("سطح خودت را انتخاب کن.");
  if (!v.weekly_activity) errors.push("میزان فعالیت هفتگی را انتخاب کن.");
  if (!v.voice_chat) errors.push("وضعیت Voice Chat را انتخاب کن.");
  if (!v.how_found_us) errors.push("بگو چطور با KillZone آشنا شدی.");
  if (!v.info_confirmed) errors.push("تأیید صحت اطلاعات الزامی است.");
  return errors;
}
async function kzFindLatestMyRequest() {
  if (!currentUser) return null;
  const { data, error } = await sb
    .from("team_join_requests")
    .select("*")
    .eq("account_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error(error);
    return null;
  }
  return data?.[0] || null;
}
async function kzLoadMessages(requestId) {
  const { data, error } = await sb
    .from("team_join_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    return { data: [], error };
  }
  return { data: data || [], error: null };
}
function kzMessageHtml(m, request) {
  const isAdmin = m.sender_role === "staff";
  const sender = isAdmin
    ? "مدیریت KillZone"
    : request?.first_name || request?.accounts?.username || "متقاضی";
  return `<article class="kz-message ${isAdmin ? "staff" : "applicant"}"><div class="kz-message-meta"><strong>${escapeHtml(sender)}</strong><time>${escapeHtml(kzFormatDate(m.created_at))}</time></div><div class="kz-message-body">${escapeHtml(m.message).replace(/\n/g, "<br>")}</div></article>`;
}
function kzRequestFormHtml() {
  return `<form id="kzJoinForm" class="kz-join-form"><div class="kz-form-section"><div class="kz-form-kicker">01 // اطلاعات پایه</div><h3>اول با خودت آشنا بشیم</h3><div class="kz-form-grid"><div class="field"><label for="joinFirstName">نام *</label><input id="joinFirstName" required autocomplete="given-name"></div><div class="field"><label for="joinLastName">نام خانوادگی</label><input id="joinLastName" autocomplete="family-name"></div><div class="field"><label>نام کاربری</label><input value="${escapeHtml(currentUser?.username || "")}" disabled></div><div class="field"><label for="joinRubika">آیدی روبیکا *</label><input id="joinRubika" required placeholder="@username یا آیدی شما"></div><div class="field"><label for="joinAge">سن</label><input id="joinAge" type="number" min="1" max="100" inputmode="numeric"></div><div class="field"><label for="joinCity">شهر</label><input id="joinCity" autocomplete="address-level2" placeholder="مثلاً اراک"></div></div></div><div class="kz-form-section"><div class="kz-form-kicker">02 // پروفایل گیمینگ</div><h3>سبک بازی و فعالیتت</h3><div class="kz-form-grid"><div class="field"><label for="joinGames">در چه بازی‌هایی فعالیت داری؟</label><textarea id="joinGames" placeholder="مثلاً Minecraft، COD، Valorant..."></textarea></div><div class="field"><label for="joinSkill">سطح خودت در بازی‌هات را چطور ارزیابی می‌کنی؟ *</label><select id="joinSkill" required><option value="">انتخاب کن</option><option>تازه‌کار</option><option>متوسط</option><option>حرفه‌ای</option><option>خیلی حرفه‌ای</option></select></div><div class="field"><label for="joinYears">چند سال است که بازی می‌کنی؟</label><input id="joinYears" type="number" min="0" max="80" inputmode="numeric"></div><div class="field"><label for="joinActivity">معمولاً در هفته چقدر بازی می‌کنی؟ *</label><select id="joinActivity" required><option value="">انتخاب کن</option><option>کمتر از ۵ ساعت</option><option>۵ تا ۱۰ ساعت</option><option>۱۰ تا ۲۰ ساعت</option><option>بیشتر از ۲۰ ساعت</option></select></div><div class="field"><label for="joinVoice">میکروفون / امکان استفاده از Voice Chat داری؟ *</label><select id="joinVoice" required><option value="">انتخاب کن</option><option>بله</option><option>خیر</option><option>گاهی</option></select></div></div></div><div class="kz-form-section"><div class="kz-form-kicker">03 // خودت و KillZone</div><h3>بیشتر از خودت بگو</h3><div class="kz-form-stack"><div class="field"><label for="joinWhy">چرا می‌خواهی به KillZone بپیوندی؟ *</label><textarea id="joinWhy" required rows="5" placeholder="واقعی و خودمونی بنویس..."></textarea></div><div class="field"><label for="joinContribution">چه مهارت یا کمکی می‌توانی به تیم اضافه کنی؟ *</label><textarea id="joinContribution" required rows="5" placeholder="مثلاً مهارت گیم، ساخت‌وساز، مدیریت، طراحی، تولید محتوا و..."></textarea></div><div class="field"><label for="joinConflict">اگر بین تو و یکی از اعضای تیم اختلافی پیش بیاید، چطور حلش می‌کنی؟ *</label><textarea id="joinConflict" required rows="5"></textarea></div><div class="field"><label for="joinFound">چطور با KillZone آشنا شدی؟ *</label><select id="joinFound" required><option value="">انتخاب کن</option><option>دوست یا عضو تیم</option><option>روبیکا</option><option>سایت KillZone</option><option>داخل بازی</option><option>شبکه‌های اجتماعی</option><option>سایر</option></select></div></div></div><div class="kz-form-section"><div class="kz-form-kicker">04 // تأیید</div><h3>آخرش فقط یک تأیید</h3><label class="kz-check"><input id="joinInfoConfirmed" type="checkbox" required><span>تأیید می‌کنم اطلاعاتی که در این فرم وارد کردم واقعی و متعلق به خودم است.</span></label></div><div class="kz-submit-row"><button type="submit" class="btn primary">ثبت درخواست عضویت</button><div id="kzJoinFormMsg" aria-live="polite"></div></div></form>`;
}
function kzTicketHeaderHtml(r) {
  const number = r?.id
    ? r.id.replace(/^req-/, "").slice(-8).toUpperCase()
    : "--------";
  return `<div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${escapeHtml(number)}</div><h2>درخواست عضویت در KillZone</h2><p>ارسال‌شده در ${escapeHtml(kzFormatDate(r?.created_at))}</p></div><span class="kz-status ${kzStatusClass(r?.status)}">${escapeHtml(kzStatusText(r?.status))}</span></div>`;
}
function kzFormSummaryHtml(r) {
  const rows = [
    ["نام", r.first_name || r.name],
    ["نام خانوادگی", r.last_name],
    ["نام کاربری", r.accounts?.username || currentUser?.username],
    ["آیدی روبیکا", r.rubika_id],
    ["سن", r.age],
    ["شهر", r.city],
    ["بازی‌ها", r.other_games],
    ["سطح", r.skill_level],
    ["سابقه بازی", r.gaming_years != null ? `${r.gaming_years} سال` : ""],
    ["فعالیت هفتگی", r.weekly_activity],
    ["Voice Chat", r.voice_chat],
    ["چرا KillZone؟", r.why_join],
    ["چه چیزی اضافه می‌کنی؟", r.contribution],
    ["اگر اختلاف پیش بیاد؟", r.conflict_response],
    ["نحوه آشنایی", r.how_found_us],
  ];
  return `<div class="kz-dossier"><div class="kz-dossier-title">پرونده متقاضی</div>${rows.map(([label, value]) => `<div class="kz-dossier-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div>`;
}
function kzTicketThreadHtml(messages, r) {
  return `<div class="kz-thread"><div class="kz-thread-title"><span>گفت‌وگوی درخواست</span><small>${messages.length} پیام</small></div>${messages.length ? messages.map((m) => kzMessageHtml(m, r)).join("") : '<div class="kz-empty-thread">هنوز پیامی در این درخواست ثبت نشده.</div>'}</div>`;
}
function kzTicketReplyHtml(canReply) {
  if (!canReply) return "";
  return `<form id="kzReplyForm" class="kz-reply"><label for="kzReplyInput">پیام جدید</label><textarea id="kzReplyInput" rows="4" required placeholder="پیامت رو برای مدیریت بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzReplyMsg"></div></form>`;
}
function kzRenderJoinPage() {
  const root = document.getElementById("kzJoinApp");
  if (!root || !currentUser) return;
  if (kzIsReviewer(currentUser)) return;
}
window.kzRenderJoinPage = kzRenderJoinPage;

// ===== Former join-session-fix.js =====
(function () {
  "use strict";
  const REVIEWERS = ["developer", "co_owner", "owner"];
  const isJoinPage = () => {
    const p = location.pathname.replace(/\/+$/, "");
    return p === "/join" || p.endsWith("/join.html");
  };
  const isReviewer = () =>
    !!(window.currentUser && REVIEWERS.includes(window.currentUser.rank));
  async function boot() {
    if (!isJoinPage() || isReviewer()) return;
    if (
      typeof window.kzRenderJoinPage !== "function" ||
      typeof initSession !== "function"
    )
      return;
    try {
      await initSession();
      if (!window.currentUser || REVIEWERS.includes(window.currentUser.rank))
        return;
      await window.kzRenderJoinPage();
    } catch (e) {
      console.error("KillZone applicant join boot failed", e);
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 300), {
      once: true,
    });
  else setTimeout(boot, 300);
})();

// ===== Former join-rescue.js =====
(function () {
  "use strict";
  const REVIEWERS = ["developer", "co_owner", "owner"];
  const ACTIVE = ["pending", "reviewing", "waiting_applicant"];
  const isJoinPage = () => {
    const p = location.pathname.replace(/\/+$/, "");
    return p === "/join" || p.endsWith("/join.html");
  };
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
  const fmt = (v) =>
    typeof kzFormatDate === "function" ? kzFormatDate(v) : v || "—";
  const statusText = (v) =>
    typeof kzStatusText === "function" ? kzStatusText(v) : v || "نامشخص";
  const statusClass = (v) =>
    typeof kzStatusClass === "function" ? kzStatusClass(v) : "closed";
  const sessionId = () => {
    try {
      return (
        JSON.parse(localStorage.getItem("kz_session") || "null")?.id || null
      );
    } catch {
      return null;
    }
  };
  let started = false;
  async function getUser() {
    const id = sessionId();
    if (!id || typeof sb === "undefined") return null;
    const { data, error } = await sb
      .from("accounts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("join reviewer user lookup failed", error);
      return null;
    }
    return data || null;
  }
  async function loadData() {
    const { data, error } = await sb
      .from("team_join_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const requests = data || [];
    const ids = [...new Set(requests.map((r) => r.account_id).filter(Boolean))];
    const accounts = {};
    if (ids.length) {
      const { data: rows, error: e } = await sb
        .from("accounts")
        .select("id,username,rank,team_status")
        .in("id", ids);
      if (e) throw e;
      (rows || []).forEach((a) => (accounts[a.id] = a));
    }
    return { requests, accounts };
  }
  function applicantName(r, a) {
    return r.first_name || r.name || a?.username || "متقاضی";
  }
  function fields(r, a) {
    const rows = [
      ["نام", r.first_name || r.name],
      ["نام خانوادگی", r.last_name],
      ["نام کاربری", a?.username],
      ["آیدی روبیکا", r.rubika_id],
      ["سن", r.age],
      ["شهر", r.city],
      ["بازی‌ها", r.other_games],
      ["سطح", r.skill_level],
      ["سابقه بازی", r.gaming_years != null ? `${r.gaming_years} سال` : ""],
      ["فعالیت هفتگی", r.weekly_activity],
      ["Voice Chat", r.voice_chat],
      ["چرا KillZone؟", r.why_join],
      ["چه چیزی اضافه می‌کنی؟", r.contribution],
      ["اگر اختلاف پیش بیاد؟", r.conflict_response],
      ["نحوه آشنایی", r.how_found_us],
    ];
    return `<div class="kz-dossier">${rows.map(([l, v]) => `<div class="kz-dossier-row"><span>${esc(l)}</span><strong>${esc(v || "—")}</strong></div>`).join("")}</div>`;
  }
  async function render() {
    if (started || !isJoinPage()) return;
    started = true;
    const root = document.getElementById("kzJoinApp");
    if (!root || typeof sb === "undefined") {
      started = false;
      return;
    }
    root.innerHTML =
      '<div class="kz-join-shell"><div class="section-title top"><h2>درخواست‌های عضویت</h2><p>برای مشاهده جزئیات، روی تیکت موردنظر بزن.</p></div><div id="kzRescueHost"><div class="loading-note">در حال بارگذاری درخواست‌ها...</div></div></div>';
    try {
      const user = await getUser();
      if (!user || !REVIEWERS.includes(user.rank)) {
        started = false;
        return;
      }
      let { requests, accounts } = await loadData();
      const host = document.getElementById("kzRescueHost");
      if (!host) return;
      if (!requests.length) {
        host.innerHTML =
          '<div class="empty-note">هنوز هیچ درخواست عضویتی ثبت نشده.</div>';
        return;
      }
      const refreshData = async () => {
        const fresh = await loadData();
        requests = fresh.requests;
        accounts = fresh.accounts;
      };
      const openTicket = async (selected) => {
        const { data: messages, error } = await sb
          .from("team_join_messages")
          .select("*")
          .eq("request_id", selected.id)
          .order("created_at", { ascending: true });
        if (error) throw error;
        const acc = accounts[selected.account_id] || {};
        const responderIds = [
          ...new Set(
            (messages || [])
              .filter((m) => m.sender_role === "staff" && m.account_id)
              .map((m) => m.account_id),
          ),
        ];
        const responders = {};
        if (responderIds.length) {
          const { data: staffRows } = await sb
            .from("accounts")
            .select("id,username")
            .in("id", responderIds);
          (staffRows || []).forEach((a) => (responders[a.id] = a.username));
        }
        const overlay = document.createElement("div");
        overlay.className = "kz-ticket-overlay";
        overlay.innerHTML = `<div class="kz-ticket-modal" role="dialog" aria-modal="true" aria-label="تیکت ${esc(applicantName(selected, acc))}"><button class="kz-ticket-close" type="button" aria-label="بستن">✕</button><div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${esc(
          String(selected.id || "")
            .replace(/^req-/, "")
            .slice(-8)
            .toUpperCase(),
        )}</div><h2>${esc(applicantName(selected, acc))}</h2><p>${esc(acc.username || "")} · ارسال‌شده در ${esc(fmt(selected.created_at))}</p></div><span class="kz-status ${statusClass(selected.status)}">${esc(statusText(selected.status))}</span></div><div class="kz-admin-actions"><button class="btn primary" type="button" data-action="approved">✓ پذیرش</button><button class="btn" type="button" data-action="reviewing">در حال بررسی</button><button class="btn" type="button" data-action="waiting_applicant">منتظر پاسخ</button><button class="btn kz-danger" type="button" data-action="rejected">✕ رد درخواست</button><button class="btn" type="button" data-action="closed">بستن تیکت</button><button class="btn kz-danger" type="button" data-action="delete-ticket">🗑 حذف تیکت</button></div>${fields(selected, acc)}<div class="kz-thread"><div class="kz-thread-title"><span>گفت‌وگو</span><small>${messages?.length || 0} پیام</small></div>${
          messages?.length
            ? messages
                .map((m) => {
                  const sender =
                    m.sender_role === "staff"
                      ? responders[m.account_id] || "مدیریت KillZone"
                      : applicantName(selected, acc);
                  return `<article class="kz-message ${m.sender_role === "staff" ? "staff" : "applicant"}"><div class="kz-message-meta"><strong>${esc(sender)}</strong><time>${esc(fmt(m.created_at))}</time></div><div class="kz-message-body">${esc(m.message).replace(/\n/g, "<br>")}</div></article>`;
                })
                .join("")
            : '<div class="kz-empty-thread">هنوز پیامی ثبت نشده.</div>'
        }</div>${ACTIVE.includes(selected.status) ? '<form id="kzRescueReply" class="kz-reply"><label for="kzRescueReplyInput">پیام برای متقاضی</label><textarea id="kzRescueReplyInput" rows="4" required placeholder="پیامت رو برای متقاضی بنویس..."></textarea><button class="btn primary" type="submit">ارسال پیام</button><div id="kzRescueReplyMsg"></div></form>' : ""}<div id="kzRescueMsg"></div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay
          .querySelector(".kz-ticket-close")
          ?.addEventListener("click", close);
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) close();
        });
        const changeStatus = async (status) => {
          const msg = overlay.querySelector("#kzRescueMsg");
          if (msg)
            msg.innerHTML = '<div class="form-msg">در حال ذخیره...</div>';
          const { error } = await sb
            .from("team_join_requests")
            .update({
              status,
              reviewed_at: ["approved", "rejected"].includes(status)
                ? new Date().toISOString()
                : null,
              reviewed_by: user.id,
            })
            .eq("id", selected.id);
          if (error) {
            console.error(error);
            if (msg)
              msg.innerHTML =
                '<div class="form-msg err">تغییر وضعیت ناموفق بود.</div>';
            return;
          }
          const accountUpdate =
            status === "approved"
              ? { rank: "member", team_status: "approved" }
              : {
                  team_status: status === "rejected" ? "rejected" : "reviewing",
                };
          await sb
            .from("accounts")
            .update(accountUpdate)
            .eq("id", selected.account_id);
          await refreshData();
          close();
          drawList();
        };
        overlay.querySelectorAll("[data-action]").forEach((b) =>
          b.addEventListener("click", async () => {
            const action = b.dataset.action;
            if (action === "delete-ticket") {
              if (
                !confirm(
                  "این تیکت و تمام پیام‌های آن حذف شود؟ این کار برگشت‌پذیر نیست.",
                )
              )
                return;
              try {
                await sb
                  .from("team_join_messages")
                  .delete()
                  .eq("request_id", selected.id);
                const { error } = await sb
                  .from("team_join_requests")
                  .delete()
                  .eq("id", selected.id);
                if (error) throw error;
                await refreshData();
                close();
                drawList();
              } catch (e) {
                console.error(e);
                alert("حذف تیکت ناموفق بود.");
              }
              return;
            }
            await changeStatus(action);
          }),
        );
        overlay
          .querySelector("#kzRescueReply")
          ?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const input = overlay.querySelector("#kzRescueReplyInput"),
              msg = overlay.querySelector("#kzRescueReplyMsg");
            const text = input?.value.trim();
            if (!text) return;
            const { error } = await sb
              .from("team_join_messages")
              .insert([
                {
                  id:
                    "msg-" +
                    Date.now() +
                    "-" +
                    Math.random().toString(36).slice(2, 9),
                  request_id: selected.id,
                  account_id: user.id,
                  sender_role: "staff",
                  message: text,
                },
              ]);
            if (error) {
              console.error(error);
              if (msg)
                msg.innerHTML =
                  '<div class="form-msg err">ارسال پیام ناموفق بود.</div>';
              return;
            }
            close();
            openTicket(selected);
          });
      };
      const drawList = () => {
        host.innerHTML = `<div class="kz-ticket-center"><div class="kz-ticket-toolbar"><div><strong>تیکت‌های عضویت</strong><span>${requests.length} درخواست</span></div><button class="link-btn" id="kzRescueRefresh" type="button">↻ بروزرسانی</button></div><div class="kz-ticket-grid">${requests
          .map((r) => {
            const a = accounts[r.account_id] || {};
            return `<button class="kz-ticket-card" type="button" data-request-id="${esc(r.id)}"><span class="kz-ticket-card-main"><strong>${esc(applicantName(r, a))}</strong><small>${esc(a.username || r.rubika_id || "بدون نام کاربری")}</small><small>${esc(fmt(r.created_at))}</small></span><span class="kz-ticket-card-side"><span class="kz-status ${statusClass(r.status)}">${esc(statusText(r.status))}</span><b>مشاهده ←</b></span></button>`;
          })
          .join("")}</div></div>`;
        host.querySelectorAll("[data-request-id]").forEach((card) =>
          card.addEventListener("click", () => {
            const selected = requests.find(
              (r) => r.id === card.dataset.requestId,
            );
            if (selected) openTicket(selected);
          }),
        );
        document
          .getElementById("kzRescueRefresh")
          ?.addEventListener("click", async () => {
            try {
              await refreshData();
              drawList();
            } catch (e) {
              console.error(e);
            }
          });
      };
      drawList();
      root.dataset.kzJoinBoot = "done";
      root.dataset.kzJoinRescued = "1";
    } catch (error) {
      console.error("KillZone reviewer join render failed", error);
      root.innerHTML =
        '<div class="kz-join-shell"><div class="form-msg err">بارگذاری درخواست‌های عضویت ناموفق بود.</div></div>';
    }
  }
  function start() {
    if (!isJoinPage() || started) return;
    setTimeout(render, 700);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
