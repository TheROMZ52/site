(() => {
  "use strict";
  function boot() {
    const button = document.getElementById("menuToggle");
    const nav = document.querySelector("nav.main");
    if (!button || !nav) return;
    const sync = () => {
      const open = nav.classList.contains("open");
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
      button.textContent = open ? "✕" : "☰";
    };
    const observer = new MutationObserver(sync);
    observer.observe(nav, { attributes: true, attributeFilter: ["class"] });
    sync();
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1180 && nav.classList.contains("open")) nav.classList.remove("open");
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("open")) nav.classList.remove("open");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
