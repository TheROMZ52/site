// Designed & developed by TheROMZ52 for KillZone Team — 2026
// Client-side Supabase connection. The publishable key is safe for browser use when RLS protects exposed data.
const SUPABASE_URL = "https://fjzhkprnxznijwmjrlka.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OeU6Z8Yn_rPuxfKRsMApqw__kcMQIKA";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;
window.dispatchEvent(new CustomEvent("kz:supabase-ready"));

// Shared client-side lifecycle and form guards. They do not change existing game/site logic.
(function () {
  "use strict";
  const emit = (name) => {
    try {
      window.dispatchEvent(new CustomEvent(name));
    } catch (_) {}
  };
  const limits = {
    username: 24,
    password: 128,
    game: 120,
    bio: 500,
    social: 1000,
    title: 120,
    description: 4000,
    body: 4000,
    status_text: 100,
  };
  const classify = (el) => {
    const id = String(el.id || "").toLowerCase(),
      name = String(el.name || "").toLowerCase(),
      type = String(el.type || "").toLowerCase();
    if (type === "password" || id.includes("pass") || name.includes("pass"))
      return limits.password;
    if (id.includes("user") || id.includes("name") || name === "username")
      return limits.username;
    if (id.includes("bio")) return limits.bio;
    if (id.includes("social") || id.includes("photo")) return limits.social;
    if (id.includes("game")) return limits.game;
    if (id.includes("statustext") || id.includes("status_text"))
      return limits.status_text;
    if (id.includes("title")) return limits.title;
    if (
      id.includes("description") ||
      id.includes("desc") ||
      id.includes("body")
    )
      return limits.description;
    if (el.tagName === "TEXTAREA") return limits.body;
    return null;
  };
  const guard = (el) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement))
      return;
    const max = classify(el);
    if (max && el.value.length > max) el.value = el.value.slice(0, max);
  };
  document.addEventListener("input", (e) => guard(e.target), true);
  document.addEventListener("change", (e) => guard(e.target), true);
  document.addEventListener(
    "submit",
    (e) => e.target?.querySelectorAll?.("input,textarea").forEach(guard),
    true,
  );

  function wrap(name, event, onResolve) {
    const original = window[name];
    if (typeof original !== "function" || original.__kzLifecycleWrapped) return;
    const wrapped = function () {
      const result = original.apply(this, arguments);
      if (result && typeof result.then === "function")
        return result.then(
          (v) => {
            emit(event);
            onResolve?.(v);
            return v;
          },
          (e) => {
            throw e;
          },
        );
      emit(event);
      onResolve?.(result);
      return result;
    };
    wrapped.__kzLifecycleWrapped = true;
    window[name] = wrapped;
  }
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      wrap("saveSession", "kz:session-changed");
      wrap("clearSession", "kz:session-changed");
      wrap("initSession", "kz:session-ready");
    },
    { once: true },
  );
})();
