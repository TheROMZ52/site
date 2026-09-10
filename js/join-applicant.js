(function () {
  "use strict";
  if (!document.getElementById("kzJoinApp")) return;

  const ACTIVE = new Set(["pending", "reviewing", "waiting_applicant"]);
  const terminal = new Set(["rejected", "closed"]);
  let rendering = false;

  const esc = (v) =>
    typeof window.escapeHtml === "function"
      ? window.escapeHtml(v)
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
  const id = () => window.currentUser?.id || null;
  const user = () => window.currentUser || null;
  const page = () => document.getElementById("kzJoinApp");
  const msg = (el, text, tone = "err") => {
    if (el) el.innerHTML = `<div class="form-msg ${tone}">${esc(text)}</div>`;
  };

  function loading(text = "در حال بارگذاری...") {
    const root = page();
    if (root)
      root.innerHTML = `<div class="kz-join-shell"><div class="kz-community-loading">${esc(text)}</div></div>`;
  }

  function loginGate() {
    const root = page();
    if (!root) return;
    root.innerHTML = `<div class="kz-login-gate panel"><div class="kz-gate-icon">🔒</div><h3>اول وارد اکانت شو</h3><p>برای ثبت درخواست عضویت باید با اکانت KillZone وارد شده باشی.</p><div class="kz-gate-actions"><button class="btn primary" id="kzJoinLogin" type="button">ورود</button><a class="btn ghost" href="/register">ساخت اکانت مهمان</a></div></div>`;
    document
      .getElementById("kzJoinLogin")
      ?.addEventListener("click", () =>
        document.getElementById("loginOpenBtn")?.click(),
      );
  }

  function approvedState() {
    const root = page();
    if (!root) return;
    root.innerHTML = `<section class="kz-ticket"><div class="kz-ticket-head"><div><div class="kz-eyebrow">TEAM ACCESS // ACTIVE</div><h2>عضویتت تأیید شده</h2><p>اکانتت به‌عنوان عضو تأییدشده ثبت شده و دسترسی تیم فعاله.</p></div><span class="kz-status approved">تأیید شده</span></div><div class="kz-form-section"><p style="margin:0;color:var(--paper-dim);line-height:1.9">برای دیدن وضعیت اکانت و Squad Presence می‌تونی وارد صفحه حساب بشی.</p><div class="kz-gate-actions" style="margin-top:16px"><a class="btn primary" href="/account">اکانت من</a><a class="btn ghost rubika-link" href="#">گروه روبیکا</a></div></div></section>`;
  }

  function formState(previous) {
    const root = page();
    if (!root) return;
    const note =
      previous && terminal.has(previous.status)
        ? `<div class="form-msg err" style="margin-bottom:16px">درخواست قبلیت ${esc(kzStatusText(previous.status))} شده. می‌تونی یک درخواست جدید ثبت کنی.</div>`
        : "";
    root.innerHTML = `<div class="kz-join-shell"><div class="section-title top"><h2>درخواست عضویت در KillZone</h2><p>فرم رو کامل کن؛ بعد از ثبت، ادامه‌ی بررسی داخل همین تیکت انجام می‌شه.</p></div>${note}${typeof kzRequestFormHtml === "function" ? kzRequestFormHtml() : '<div class="form-msg err">فرم عضویت بارگذاری نشد.</div>'}</div>`;
    const form = root.querySelector("#kzJoinForm");
    if (form) form.addEventListener("submit", submitRequest, { once: true });
  }

  async function renderTicket(request) {
    const root = page();
    if (!root || !request) return;
    const loaded = await kzLoadMessages(request.id);
    if (loaded.error) {
      root.innerHTML =
        '<div class="kz-join-shell"><div class="form-msg err">پیام‌های تیکت بارگذاری نشد.</div></div>';
      return;
    }
    const messages = loaded.data || [];
    const canReply = ACTIVE.has(request.status);
    root.innerHTML = `<div class="kz-ticket"><div class="kz-ticket-head"><div><div class="kz-eyebrow">APPLICATION // #${esc(
      String(request.id || "")
        .replace(/^req-/, "")
        .slice(-8)
        .toUpperCase(),
    )}</div><h2>درخواست عضویت در KillZone</h2><p>ارسال‌شده در ${esc(kzFormatDate(request.created_at))}</p></div><span class="kz-status ${esc(kzStatusClass(request.status))}">${esc(kzStatusText(request.status))}</span></div><div class="kz-form-section">${typeof kzFormSummaryHtml === "function" ? kzFormSummaryHtml(request) : ""}</div>${typeof kzTicketThreadHtml === "function" ? kzTicketThreadHtml(messages, request) : ""}${typeof kzTicketReplyHtml === "function" ? kzTicketReplyHtml(canReply) : ""}<div class="kz-form-section" style="margin-bottom:0"><div class="kz-gate-actions"><button class="btn ghost" type="button" id="kzJoinRefresh">↻ بروزرسانی تیکت</button><a class="btn ghost" href="/account">اکانت من</a></div><div id="kzJoinTicketMsg" aria-live="polite"></div></div></div>`;
    root
      .querySelector("#kzJoinRefresh")
      ?.addEventListener("click", () => renderJoin(true));
    root
      .querySelector("#kzReplyForm")
      ?.addEventListener("submit", (e) => submitReply(e, request), {
        once: true,
      });
  }

  async function submitRequest(e) {
    e.preventDefault();
    const form = e.currentTarget,
      root = page(),
      submit = form?.querySelector('button[type="submit"]'),
      notice = form?.querySelector("#kzJoinFormMsg");
    const u = user();
    if (!u || !window.sb) return;
    if (rendering) return;
    const values =
      typeof kzRequestFormValues === "function"
        ? kzRequestFormValues(form)
        : null;
    if (!values) return msg(notice, "فرم درخواست در دسترس نیست.");
    const errors =
      typeof kzValidateJoinForm === "function"
        ? kzValidateJoinForm(values)
        : [];
    if (errors.length) return msg(notice, errors[0]);
    submit.disabled = true;
    msg(notice, "در حال بررسی و ثبت درخواست...", "info");
    try {
      const latest =
        typeof kzFindLatestMyRequest === "function"
          ? await kzFindLatestMyRequest()
          : null;
      if (latest && ACTIVE.has(latest.status)) {
        await renderTicket(latest);
        return;
      }
      const payload = {
        id:
          typeof kzNewId === "function" ? kzNewId("req") : "req-" + Date.now(),
        account_id: u.id,
        status: "pending",
        message: [values.why_join, values.contribution]
          .filter(Boolean)
          .join("\n\n"),
        name: values.first_name,
        first_name: values.first_name,
        last_name: values.last_name,
        rubika_id: values.rubika_id,
        age: values.age,
        city: values.city,
        other_games: values.other_games,
        skill_level: values.skill_level,
        gaming_years: values.gaming_years,
        weekly_activity: values.weekly_activity,
        voice_chat: values.voice_chat,
        why_join: values.why_join,
        contribution: values.contribution,
        conflict_response: values.conflict_response,
        how_found_us: values.how_found_us,
        info_confirmed: values.info_confirmed,
      };
      const { data: created, error } = await sb
        .from("team_join_requests")
        .insert([payload])
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!created) throw new Error("درخواست ثبت نشد.");
      const accountUpdate = await sb
        .from("accounts")
        .update({ team_status: "pending" })
        .eq("id", u.id);
      if (accountUpdate.error)
        console.warn(
          "KillZone applicant account status sync failed",
          accountUpdate.error,
        );
      const initial = [payload.message].filter(Boolean).join("\n");
      if (initial) {
        const { error: messageError } = await sb
          .from("team_join_messages")
          .insert([
            {
              id:
                typeof kzNewId === "function"
                  ? kzNewId("msg")
                  : "msg-" + Date.now(),
              request_id: created.id,
              account_id: u.id,
              sender_role: "applicant",
              message: initial,
            },
          ]);
        if (messageError)
          console.warn("KillZone applicant first message failed", messageError);
      }
      u.team_status = "pending";
      if (typeof renderUserBox === "function") renderUserBox();
      if (typeof window.kzPresence?.refresh === "function")
        window.kzPresence.refresh();
      await renderTicket(created);
    } catch (error) {
      console.error("KillZone applicant request failed", error);
      msg(notice, error?.message || "ثبت درخواست ناموفق بود.");
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  async function submitReply(e, request) {
    e.preventDefault();
    const form = e.currentTarget,
      input = form?.querySelector("#kzReplyInput"),
      notice = form?.querySelector("#kzReplyMsg"),
      button = form?.querySelector('button[type="submit"]'),
      u = user();
    const text = input?.value?.trim() || "";
    if (!u || !text || !ACTIVE.has(request.status) || rendering) return;
    if (text.length > 4000) return msg(notice, "پیامت خیلی طولانیه.");
    button.disabled = true;
    msg(notice, "در حال ارسال...", "info");
    try {
      const { error } = await sb.from("team_join_messages").insert([
        {
          id:
            typeof kzNewId === "function"
              ? kzNewId("msg")
              : "msg-" + Date.now(),
          request_id: request.id,
          account_id: u.id,
          sender_role: "applicant",
          message: text,
        },
      ]);
      if (error) throw error;
      if (request.status === "waiting_applicant") {
        const { error: e2 } = await sb
          .from("team_join_requests")
          .update({ status: "reviewing" })
          .eq("id", request.id)
          .eq("account_id", u.id);
        if (e2) throw e2;
        u.team_status = "reviewing";
      }
      if (typeof renderUserBox === "function") renderUserBox();
      await renderJoin(true);
    } catch (error) {
      console.error("KillZone applicant reply failed", error);
      msg(notice, error?.message || "ارسال پیام ناموفق بود.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function renderJoin(fromRefresh) {
    const root = page();
    if (!root || rendering) return;
    const u = user();
    if (typeof kzIsReviewer === "function" && kzIsReviewer(u)) return;
    if (!u) {
      loginGate();
      return;
    }
    if (
      u.team_status === "approved" ||
      (typeof kzIsMember === "function" && kzIsMember(u))
    ) {
      approvedState();
      return;
    }
    rendering = true;
    try {
      loading(
        fromRefresh
          ? "در حال بروزرسانی تیکت..."
          : "در حال بررسی وضعیت درخواست...",
      );
      const latest =
        typeof kzFindLatestMyRequest === "function"
          ? await kzFindLatestMyRequest()
          : null;
      if (latest && ACTIVE.has(latest.status)) {
        await renderTicket(latest);
        return;
      }
      if (latest && latest.status === "approved") {
        u.team_status = "approved";
        approvedState();
        return;
      }
      formState(latest);
    } catch (error) {
      console.error("KillZone applicant join render failed", error);
      root.innerHTML =
        '<div class="kz-join-shell"><div class="form-msg err">بارگذاری بخش عضویت ناموفق بود. دوباره تلاش کن.</div></div>';
    } finally {
      rendering = false;
    }
  }

  window.kzRenderJoinPage = renderJoin;
  const boot = async () => {
    if (typeof initSession === "function" && !window.currentUser) {
      try {
        await initSession();
      } catch (_) {}
    }
    await renderJoin(false);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
