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

(function () {
  "use strict";
  const install = () => {
    const nav = document.querySelector("nav.main");
    const header = document.querySelector("header");
    if (!nav || !header) return;

    if (!nav.querySelector('a[href="/news"]')) {
      const link = document.createElement("a");
      link.href = "/news";
      link.textContent = "اخبار";
      const join = nav.querySelector('a[href="/join"]');
      nav.insertBefore(link, join || null);
    }

    header.style.zIndex = "10000";
    header.style.position = "sticky";
    nav.style.position = "relative";
    nav.style.zIndex = "10002";

    const menu = document.getElementById("menuToggle");
    if (menu) {
      menu.style.position = "relative";
      menu.style.zIndex = "10003";
    }

    const styleId = "kz-mobile-nav-fix";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        header, header nav, header .menu-toggle { isolation: isolate; }
        @media (max-width: 700px) {
          header { z-index: 10000 !important; }
          header nav.main,
          header nav.main.open,
          header nav.main.is-open,
          header nav.main.show { z-index: 10002 !important; }
          header nav.main a { position: relative; z-index: 10003 !important; }
          header .menu-toggle { z-index: 10004 !important; }
        }
      `;
      document.head.appendChild(style);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();