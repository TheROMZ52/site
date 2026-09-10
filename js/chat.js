// KillZone team chat
(function () {
  "use strict";
  const TABLE = "chat_messages";
  const MAX = 2000;
  const REACTIONS = ["👍", "❤️", "😂", "🔥"];
  let messages = [];
  let replyTo = null;
  let editingId = null;
  let channel = null;
  let previewMode = false;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const initials = (v) => (String(v || "?").trim().slice(0, 2) || "?").toUpperCase();
  const user = () => typeof currentUser !== "undefined" ? currentUser : window.currentUser || null;
  const fmt = (v) => { try { return new Intl.DateTimeFormat("fa-IR", {hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit"}).format(new Date(v)); } catch { return ""; } };
  const cls = (v) => String(v || "").replace(/[^\w\u0600-\u06ff-]/g, "");
  function md(src) {
    let s = esc(src).replace(/\r\n?/g, "\n");
    const stash = [];
    const save = (html) => { const i = stash.push(html) - 1; return `\u0000${i}\u0000`; };
    s = s.replace(/```(?:[\w-]+)?\n?([\s\S]*?)```/g, (_, c) => save(`<pre><code>${c}</code></pre>`));
    s = s.replace(/`([^`\n]+)`/g, (_, c) => save(`<code>${c}</code>`));
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => save(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`));
    const lines = s.split("\n"), out = [], list = [];
    const flush = () => { if (list.length) { out.push(`<ul>${list.join("")}</ul>`); list.length = 0; } };
    for (const line of lines) {
      if (/^\s*[-*]\s+/.test(line)) { list.push(`<li>${line.replace(/^\s*[-*]\s+/, "")}</li>`); continue; }
      flush();
      if (!line.trim()) { out.push(""); continue; }
      if (/^\s*&gt;/.test(line)) { out.push(`<blockquote>${line.replace(/^\s*&gt;\s?/, "")}</blockquote>`); continue; }
      out.push(line);
    }
    flush();
    s = out.join("\n");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>").replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
    s = s.split(/\n\n+/).map(x => /^<(?:ul|blockquote|pre)/.test(x) ? x : `<p>${x.replace(/\n/g, "<br>")}</p>`).join("");
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)] || "");
    return s;
  }
  function showToast(text) { const old = $(".kz-chat-toast"); old?.remove(); const t = document.createElement("div"); t.className = "kz-chat-toast"; t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }
  function setComposerState() { const bar = $("#chatReplyBar"), input = $("#chatInput"), send = $("#chatSend"); if (!bar || !input || !send) return; if (editingId) { bar.hidden = false; bar.innerHTML = `<span>در حال ویرایش <strong>پیام خودت</strong></span><button type="button" id="chatCancelAction">لغو</button>`; send.querySelector("span").textContent = "ذخیره"; } else if (replyTo) { bar.hidden = false; bar.innerHTML = `<span>پاسخ به <strong>${esc(replyTo.author_name)}</strong></span><button type="button" id="chatCancelAction">لغو</button>`; send.querySelector("span").textContent = "ارسال"; } else { bar.hidden = true; bar.innerHTML = ""; send.querySelector("span").textContent = "ارسال"; } }
  function scrollBottom(smooth = false) { const box = $("#chatMessages"); if (box) box.scrollTo({top: box.scrollHeight, behavior: smooth ? "smooth" : "auto"}); }
  function render() {
    const box = $("#chatMessages"), count = $("#chatMessageCount"), q = ($("#chatSearch")?.value || "").trim().toLowerCase();
    if (!box) return;
    const list = messages.filter(m => !q || `${m.author_name} ${m.body}`.toLowerCase().includes(q));
    if (count) count.textContent = String(messages.length);
    if (!list.length) { box.innerHTML = `<div class="kz-chat-empty">${q ? "چیزی با این جستجو پیدا نشد." : "هنوز پیامی نیست؛ اولین پیام رو تو بفرست."}</div>`; return; }
    box.innerHTML = list.map(m => {
      const mine = user()?.id === m.author_id;
      const r = m.reply_to ? messages.find(x => x.id === m.reply_to) : null;
      const counts = m.reactions && typeof m.reactions === "object" ? m.reactions : {};
      const reactions = REACTIONS.map(x => `<button type="button" class="${Array.isArray(counts[x]) && counts[x].includes(user()?.id) ? "active" : ""}" data-react="${x}" data-id="${m.id}">${x}${Array.isArray(counts[x]) && counts[x].length ? ` ${counts[x].length}` : ""}</button>`).join("");
      return `<article class="kz-chat-msg ${mine ? "mine" : ""}" data-id="${m.id}"><div class="kz-chat-avatar">${initials(m.author_name)}</div><div class="kz-chat-bubble">${r ? `<div class="kz-chat-reply"><strong>${esc(r.author_name)}</strong> · ${esc(r.body.slice(0, 110))}${r.body.length > 110 ? "…" : ""}</div>` : ""}<div class="kz-chat-head"><span class="kz-chat-author">${esc(m.author_name)}</span><span class="kz-chat-time">${fmt(m.created_at)}</span>${m.edited_at ? `<span class="kz-chat-edited">ویرایش‌شده</span>` : ""}</div><div class="kz-chat-body">${md(m.body)}</div><div class="kz-chat-actions"><button type="button" data-reply="${m.id}">↩ پاسخ</button><div class="kz-chat-reactions">${reactions}</div>${mine ? `<button type="button" data-edit="${m.id}">ویرایش</button><button type="button" data-delete="${m.id}">حذف</button>` : ""}</div></div></article>`;
    }).join("");
  }
  async function load() {
    const box = $("#chatMessages");
    if (box) box.innerHTML = `<div class="kz-chat-loading">در حال دریافت پیام‌ها…</div>`;
    const { data, error } = await sb.from(TABLE).select("id,author_id,author_name,body,reply_to,reactions,created_at,edited_at").order("created_at", {ascending:false}).limit(80);
    if (error) { console.error(error); if (box) box.innerHTML = `<div class="kz-chat-empty">اتصال به چت برقرار نشد. دوباره صفحه رو باز کن.</div>`; return; }
    messages = (data || []).reverse(); render(); scrollBottom();
  }
  async function send() {
    const me = user();
    const input = $("#chatInput"), btn = $("#chatSend");
    if (!me) { showToast("برای استفاده از چت اول وارد اکانت شو."); return; }
    const body = String(input?.value || "").trim();
    if (!body || body.length > MAX) return;
    btn.disabled = true;
    try {
      if (editingId) {
        const { data, error } = await sb.from(TABLE).update({body, edited_at:new Date().toISOString()}).eq("id", editingId).eq("author_id", me.id).select("*").maybeSingle();
        if (error || !data) throw error || new Error("ویرایش انجام نشد");
        editingId = null; showToast("پیام ویرایش شد.");
      } else {
        const row = {author_id:String(me.id), author_name:String(me.username).slice(0,24), body, reply_to:replyTo?.id || null};
        const { data, error } = await sb.from(TABLE).insert(row).select("*").single();
        if (error || !data) throw error || new Error("ارسال انجام نشد");
        replyTo = null;
      }
      input.value = ""; input.focus(); updateCount(); setComposerState(); await load();
    } catch (e) { console.error(e); showToast("پیام ارسال نشد؛ دوباره امتحان کن."); }
    finally { btn.disabled = false; }
  }
  async function del(id) { const me = user(); if (!me) return; if (!window.confirm("این پیام حذف بشه؟")) return; const { error } = await sb.from(TABLE).delete().eq("id", id).eq("author_id", me.id); if (error) showToast("حذف انجام نشد."); else { showToast("پیام حذف شد."); await load(); } }
  async function react(id, emoji) { const me = user(); if (!me) { showToast("برای ری‌اکشن باید وارد اکانت باشی."); return; } const m = messages.find(x => x.id === id); if (!m) return; const r = m.reactions && typeof m.reactions === "object" ? structuredClone(m.reactions) : {}; for (const key of REACTIONS) r[key] = Array.isArray(r[key]) ? r[key].filter(x => x !== me.id) : []; const previous = Array.isArray((m.reactions || {})[emoji]) ? (m.reactions || {})[emoji] : []; const active = previous.includes(me.id); if (!active) r[emoji].push(me.id); const { error } = await sb.from(TABLE).update({reactions:r}).eq("id", id); if (error) showToast("ری‌اکشن ثبت نشد."); else { m.reactions = r; render(); } }
  function updateCount() { const input = $("#chatInput"), out = $("#chatCharCount"); if (input && out) out.textContent = `${input.value.length} / ${MAX}`; }
  function insertMd(kind) { const input = $("#chatInput"); if (!input) return; const a=input.selectionStart,b=input.selectionEnd,v=input.value,sel=v.slice(a,b)||"متن"; const map={bold:[`**${sel}**`,`**`,`**`],italic:[`*${sel}*`,`*`,`*`],code:[`\`${sel}\``,`\`` ,`\``],quote:[`> ${sel}`,"> ",""],list:[`- ${sel}`,"- ","],link:[`[${sel}](https://)`,`[`,`"]("`][0]}; const item=map[kind] || map.bold; let replacement=item[0]; if (kind === "link") replacement=`[${sel}](https://)`; input.focus(); input.setRangeText(replacement,a,b,"end"); updateCount(); }
  function bindTools() { document.querySelectorAll("[data-md]").forEach(b => b.addEventListener("click", () => insertMd(b.dataset.md))); $("#chatPreviewToggle")?.addEventListener("click", () => { previewMode = !previewMode; const p=$("#chatMarkdownPreview"), i=$("#chatInput"); p.hidden=!previewMode; i.hidden=previewMode; if (previewMode) p.innerHTML=md(i.value || "پیش‌نمایش اینجا میاد…"); $("#chatPreviewToggle").textContent=previewMode ? "بازگشت به نوشتن" : "پیش‌نمایش"; }); $("#chatInput")?.addEventListener("input", () => { updateCount(); const p=$("#chatMarkdownPreview"), i=$("#chatInput"); if (previewMode) p.innerHTML=md(i.value || "پیش‌نمایش اینجا میاد…"); }); $("#chatInput")?.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } }); $("#chatSend")?.addEventListener("click", send); $("#chatSearch")?.addEventListener("input", render); $("#chatSearchClear")?.addEventListener("click", () => { $("#chatSearch").value=""; $("#chatSearch").dispatchEvent(new Event("input")); $("#chatSearch").focus(); }); $("#chatInput")?.addEventListener("input", () => { const c=$("#chatSearchClear"); if(c) c.classList.toggle("show", !!$("#chatSearch")?.value); }); }
  function bindMessages() { $("#chatMessages")?.addEventListener("click", e => { const b=e.target.closest("button"); if(!b) return; if(b.dataset.reply){ const m=messages.find(x=>x.id===Number(b.dataset.reply)); if(m){ replyTo=m; editingId=null; $("#chatInput").focus(); setComposerState(); } } if(b.dataset.edit){ const m=messages.find(x=>x.id===Number(b.dataset.edit)); if(m && user()?.id===m.author_id){ editingId=m.id; replyTo=null; $("#chatInput").value=m.body; updateCount(); setComposerState(); $("#chatInput").focus(); } } if(b.dataset.delete) del(Number(b.dataset.delete)); if(b.dataset.react) react(Number(b.dataset.id), b.dataset.react); }); $(document).addEventListener("click", e => { if(e.target.id === "chatCancelAction"){ editingId=null; replyTo=null; $("#chatInput").value=""; updateCount(); setComposerState(); } }); }
  function setupPreview() { const root=$("#kzChatPreview"); if(!root) return; root.innerHTML=`<div class="section-title"><h2>چت تیم</h2><p>آخرین حرف‌های اسکـواد همین‌جا.</p></div><div class="kz-chat-home"><div class="kz-chat-home-head"><div><h2>ارتباطات تیم</h2><p>یه سر بزن، شاید یکی دنبال هم‌تیمی باشه.</p></div><a class="btn ghost small" href="/chat">ورود به چت ←</a></div><div id="kzChatHomeCard" class="kz-chat-preview-card"><div class="kz-chat-home-empty">در حال دریافت پیام‌ها…</div></div></div>`; loadPreview(); }
  async function loadPreview() { const root=$("#kzChatHomeCard"); if(!root) return; const {data,error}=await sb.from(TABLE).select("id,author_name,body,created_at").order("created_at",{ascending:false}).limit(4); if(error || !data?.length){root.innerHTML=`<div class="kz-chat-home-empty">هنوز کسی چیزی نگفته. اولین پیام رو تو شروع کن.</div>`;return;} root.innerHTML=`<div class="kz-chat-preview-list">${data.reverse().map(m=>`<a class="kz-chat-preview-item" href="/chat"><div class="kz-chat-preview-avatar">${initials(m.author_name)}</div><div><div class="kz-chat-preview-meta"><strong>${esc(m.author_name)}</strong><small>${fmt(m.created_at)}</small></div><div class="kz-chat-preview-text">${esc(m.body)}</div></div></a>`).join("")}</div>`; }
  function realtime() { if(!window.sb?.channel) return; channel=sb.channel("kz-team-chat").on("postgres_changes",{event:"*",schema:"public",table:TABLE},() => load()).subscribe(); }
  function presence() { const count=$("#chatOnlineCount"); if(!count || !window.sb?.channel) return; const p=sb.channel("kz-team-chat-presence",{config:{presence:{key:String(user()?.id || crypto.randomUUID())}}}); p.on("presence",{event:"sync"},()=>{ const state=p.presenceState(); count.textContent=String(Object.keys(state).length); }).subscribe(async s=>{ if(s==="SUBSCRIBED") await p.track({username:user()?.username || "guest"}); }); }
  function boot() { bindTools(); bindMessages(); updateCount(); setComposerState(); if($("#chatMessages")){ load(); realtime(); presence(); } setupPreview(); }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();
})();