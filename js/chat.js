// KillZone team chat
(() => {
  "use strict";

  const TABLE = "chat_messages";
  const MAX = 2000;
  const REACTIONS = ["👍", "❤️", "😂", "🔥"];

  const state = {
    messages: [],
    replyTo: null,
    editingId: null,
    channel: null,
    previewMode: false,
    loading: false,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const client = () => window.sb || window.supabaseClient || null;
  const current = () => (typeof currentUser !== "undefined" ? currentUser : window.currentUser || null);

  const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char]);

  const initials = (value) => (String(value || "?").trim().slice(0, 2) || "?").toUpperCase();

  const formatTime = (value) => {
    try {
      return new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  };

  function markdown(source) {
    let text = esc(source).replace(/\r\n?/g, "\n");
    const stash = [];
    const save = (html) => {
      const index = stash.push(html) - 1;
      return `\u0000${index}\u0000`;
    };

    text = text.replace(/```(?:[\w-]+)?\n?([\s\S]*?)```/g, (_, code) => save(`<pre><code>${code}</code></pre>`));
    text = text.replace(/`([^`\n]+)`/g, (_, code) => save(`<code>${code}</code>`));
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => save(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`));

    const output = [];
    const list = [];
    const flushList = () => {
      if (!list.length) return;
      output.push(`<ul>${list.join("")}</ul>`);
      list.length = 0;
    };

    for (const line of text.split("\n")) {
      if (/^\s*[-*]\s+/.test(line)) {
        list.push(`<li>${line.replace(/^\s*[-*]\s+/, "")}</li>`);
        continue;
      }
      flushList();
      if (!line.trim()) {
        output.push("");
      } else if (/^\s*&gt;/.test(line)) {
        output.push(`<blockquote>${line.replace(/^\s*&gt;\s?/, "")}</blockquote>`);
      } else {
        output.push(line);
      }
    }
    flushList();

    text = output.join("\n")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

    text = text.split(/\n\n+/).map((part) => {
      if (/^<(?:ul|blockquote|pre)/.test(part)) return part;
      return `<p>${part.replace(/\n/g, "<br>")}</p>`;
    }).join("");

    return text.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)] || "");
  }

  function toast(message) {
    document.querySelector(".kz-chat-toast")?.remove();
    const element = document.createElement("div");
    element.className = "kz-chat-toast";
    element.textContent = message;
    document.body.appendChild(element);
    window.setTimeout(() => element.remove(), 2400);
  }

  function setStatus(message, error = false) {
    const element = $("#chatStatus");
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", error);
  }

  async function waitForClient(timeout = 10000) {
    const started = Date.now();
    while (!client() && Date.now() - started < timeout) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return client();
  }

  function render() {
    const box = $("#chatMessages");
    const count = $("#chatMessageCount");
    const query = ($( "#chatSearch")?.value || "").trim().toLowerCase();
    if (!box) return;

    const visible = state.messages.filter((message) => !query || `${message.author_name} ${message.body}`.toLowerCase().includes(query));
    if (count) count.textContent = String(state.messages.length);

    if (!visible.length) {
      box.innerHTML = `<div class="kz-chat-empty">${query ? "چیزی با این جستجو پیدا نشد." : "هنوز پیامی نیست؛ اولین پیام رو تو بفرست."}</div>`;
      return;
    }

    const me = current();
    box.innerHTML = visible.map((message) => {
      const mine = String(me?.id) === String(message.author_id);
      const reply = message.reply_to ? state.messages.find((item) => String(item.id) === String(message.reply_to)) : null;
      const reactions = message.reactions && typeof message.reactions === "object" ? message.reactions : {};
      const reactionButtons = REACTIONS.map((emoji) => {
        const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
        return `<button type="button" class="${users.includes(me?.id) ? "active" : ""}" data-react="${esc(emoji)}" data-id="${esc(message.id)}">${emoji}${users.length ? ` ${users.length}` : ""}</button>`;
      }).join("");

      return `<article class="kz-chat-msg ${mine ? "mine" : ""}" data-id="${esc(message.id)}">
        <div class="kz-chat-avatar">${initials(message.author_name)}</div>
        <div class="kz-chat-bubble">
          ${reply ? `<div class="kz-chat-reply"><strong>${esc(reply.author_name)}</strong> · ${esc(reply.body.slice(0, 110))}${reply.body.length > 110 ? "…" : ""}</div>` : ""}
          <div class="kz-chat-head"><span class="kz-chat-author">${esc(message.author_name)}</span><span class="kz-chat-time">${formatTime(message.created_at)}</span>${message.edited_at ? `<span class="kz-chat-edited">ویرایش‌شده</span>` : ""}</div>
          <div class="kz-chat-body">${markdown(message.body)}</div>
          <div class="kz-chat-actions">
            <button type="button" data-reply="${esc(message.id)}">↩ پاسخ</button>
            <div class="kz-chat-reactions">${reactionButtons}</div>
            ${mine ? `<button type="button" data-edit="${esc(message.id)}">ویرایش</button><button type="button" data-delete="${esc(message.id)}">حذف</button>` : ""}
          </div>
        </div>
      </article>`;
    }).join("");
  }

  function scrollBottom(smooth = false) {
    const box = $("#chatMessages");
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  async function load() {
    const api = client();
    const box = $("#chatMessages");
    if (!api) throw new Error("Supabase client is not ready");
    if (box) box.innerHTML = `<div class="kz-chat-loading">در حال دریافت پیام‌ها…</div>`;

    const { data, error } = await api.from(TABLE)
      .select("id,author_id,author_name,body,reply_to,reactions,created_at,edited_at")
      .order("created_at", { ascending: false })
      .limit(80);

    if (error) throw error;
    state.messages = (data || []).reverse();
    render();
    scrollBottom();
  }

  function subscribe(api) {
    state.channel?.unsubscribe();
    state.channel = api.channel("killzone-chat");
    state.channel.on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
      if (payload.eventType === "INSERT" && !state.messages.some((item) => String(item.id) === String(payload.new.id))) state.messages.push(payload.new);
      if (payload.eventType === "UPDATE") state.messages = state.messages.map((item) => String(item.id) === String(payload.new.id) ? payload.new : item);
      if (payload.eventType === "DELETE") state.messages = state.messages.filter((item) => String(item.id) !== String(payload.old.id));
      render();
    }).subscribe();
  }

  function setComposerState() {
    const bar = $("#chatReplyBar");
    const send = $("#chatSend");
    if (!bar || !send) return;

    if (state.editingId) {
      bar.hidden = false;
      bar.innerHTML = `<span>در حال ویرایش <strong>پیام خودت</strong></span><button type="button" id="chatCancelAction">لغو</button>`;
      send.querySelector("span")?.replaceChildren(document.createTextNode("ذخیره"));
    } else if (state.replyTo) {
      bar.hidden = false;
      bar.innerHTML = `<span>پاسخ به <strong>${esc(state.replyTo.author_name)}</strong></span><button type="button" id="chatCancelAction">لغو</button>`;
      send.querySelector("span")?.replaceChildren(document.createTextNode("ارسال"));
    } else {
      bar.hidden = true;
      bar.innerHTML = "";
      send.querySelector("span")?.replaceChildren(document.createTextNode("ارسال"));
    }
  }

  async function send() {
    const api = client();
    const me = current();
    const input = $("#chatInput");
    const button = $("#chatSend");
    const body = String(input?.value || "").trim();

    if (!me) return toast("برای استفاده از چت اول وارد اکانت شو.");
    if (!api || !body || body.length > MAX) return;

    button.disabled = true;
    try {
      if (state.editingId) {
        const { error } = await api.from(TABLE).update({ body, edited_at: new Date().toISOString() }).eq("id", state.editingId).eq("author_id", me.id);
        if (error) throw error;
        toast("پیام ویرایش شد.");
      } else {
        const { error } = await api.from(TABLE).insert({ author_id: String(me.id), author_name: String(me.username || "عضو تیم").slice(0, 24), body, reply_to: state.replyTo?.id || null });
        if (error) throw error;
        toast("پیام ارسال شد.");
      }
      state.editingId = null;
      state.replyTo = null;
      input.value = "";
      updateCount();
      setComposerState();
      await load();
    } catch (error) {
      console.error("[KillZone Chat] send", error);
      toast("پیام ارسال نشد؛ دوباره امتحان کن.");
    } finally {
      button.disabled = false;
    }
  }

  async function removeMessage(id) {
    const api = client();
    const me = current();
    if (!api || !me || !window.confirm("این پیام حذف بشه؟")) return;
    const { error } = await api.from(TABLE).delete().eq("id", id).eq("author_id", me.id);
    if (error) toast("حذف انجام نشد.");
    else await load();
  }

  async function react(id, emoji) {
    const api = client();
    const me = current();
    const message = state.messages.find((item) => String(item.id) === String(id));
    if (!api || !me || !message) return toast("برای ری‌اکشن باید وارد اکانت باشی.");

    const reactions = message.reactions && typeof message.reactions === "object" ? structuredClone(message.reactions) : {};
    for (const key of REACTIONS) reactions[key] = Array.isArray(reactions[key]) ? reactions[key].filter((idValue) => String(idValue) !== String(me.id)) : [];
    const previous = Array.isArray(message.reactions?.[emoji]) ? message.reactions[emoji] : [];
    if (!previous.some((idValue) => String(idValue) === String(me.id))) reactions[emoji].push(me.id);

    const { error } = await api.from(TABLE).update({ reactions }).eq("id", id);
    if (error) toast("ری‌اکشن ثبت نشد.");
    else {
      message.reactions = reactions;
      render();
    }
  }

  function updateCount() {
    const input = $("#chatInput");
    const output = $("#chatCharCount");
    if (input && output) output.textContent = `${input.value.length} / ${MAX}`;
  }

  function insertMarkdown(type) {
    const input = $("#chatInput");
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = input.value.slice(start, end) || "متن";
    const snippets = {
      bold: `**${selected}**`,
      italic: `*${selected}*`,
      code: `\`${selected}\``,
      quote: `> ${selected}`,
      list: `- ${selected}`,
      link: `[${selected}](https://)`,
    };
    input.focus();
    input.setRangeText(snippets[type] || selected, start, end, "end");
    updateCount();
  }

  function bindTools() {
    document.querySelectorAll("[data-md]").forEach((button) => button.addEventListener("click", () => insertMarkdown(button.dataset.md)));
    $("#chatSend")?.addEventListener("click", send);
    $("#chatSearch")?.addEventListener("input", render);
    $("#chatInput")?.addEventListener("input", updateCount);
    $("#chatInput")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        send();
      }
    });
    $("#chatPreviewToggle")?.addEventListener("click", () => {
      state.previewMode = !state.previewMode;
      const input = $("#chatInput");
      const preview = $("#chatMarkdownPreview");
      if (!input || !preview) return;
      input.hidden = state.previewMode;
      preview.hidden = !state.previewMode;
      preview.innerHTML = state.previewMode ? markdown(input.value || "پیش‌نمایش اینجا میاد…") : "";
      $("#chatPreviewToggle").textContent = state.previewMode ? "بازگشت به نوشتن" : "پیش‌نمایش";
    });
  }

  function bindMessages() {
    $("#chatMessages")?.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const id = button.dataset.id || button.dataset.reply || button.dataset.edit || button.dataset.delete;
      const message = state.messages.find((item) => String(item.id) === String(id));

      if (button.dataset.reply && message) {
        state.replyTo = message;
        state.editingId = null;
        setComposerState();
        $("#chatInput")?.focus();
      } else if (button.dataset.edit && message && String(current()?.id) === String(message.author_id)) {
        state.editingId = message.id;
        state.replyTo = null;
        $("#chatInput").value = message.body;
        updateCount();
        setComposerState();
        $("#chatInput").focus();
      } else if (button.dataset.delete) {
        removeMessage(id);
      } else if (button.dataset.react) {
        react(button.dataset.id, button.dataset.react);
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target.id !== "chatCancelAction") return;
      state.editingId = null;
      state.replyTo = null;
      $("#chatInput").value = "";
      updateCount();
      setComposerState();
    });
  }

  async function boot() {
    if (state.loading) return;
    state.loading = true;
    bindTools();
    bindMessages();
    updateCount();
    setComposerState();

    if (!$("#chatMessages")) {
      state.loading = false;
      return;
    }

    setStatus("در حال اتصال به ارتباطات تیم…");
    try {
      const api = await waitForClient();
      if (!api) throw new Error("Supabase client is unavailable");
      await load();
      subscribe(api);
      setStatus("ارتباط تیم برقرار است");
    } catch (error) {
      console.error("[KillZone Chat] boot", error);
      setStatus("اتصال به چت برقرار نشد؛ دوباره تلاش کن.", true);
      const box = $("#chatMessages");
      if (box) box.innerHTML = `<div class="kz-chat-empty">اتصال برقرار نشد. صفحه رو رفرش کن.</div>`;
    } finally {
      state.loading = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
