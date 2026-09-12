// KillZone ticket IDs — presentation-only, based on each request's existing stable database id.
(() => {
  "use strict";

  const shortId = (value) => {
    const raw = String(value || "").replace(/[^a-zA-Z0-9]/g, "");
    return raw ? raw.slice(-8).toUpperCase() : "--------";
  };

  const addCardId = (card) => {
    if (!card || card.querySelector(".kz-ticket-id")) return;
    const id = shortId(card.dataset.requestId);
    const badge = document.createElement("span");
    badge.className = "kz-ticket-id";
    badge.textContent = `JOIN #${id}`;
    badge.setAttribute("aria-label", `شناسه تیکت ${id}`);
    const main = card.querySelector(".kz-ticket-card-main");
    (main || card).prepend(badge);
  };

  const patchModal = (modal) => {
    if (!modal) return;
    const eyebrow = modal.querySelector(".kz-ticket-head .kz-eyebrow");
    if (!eyebrow) return;
    const current = eyebrow.textContent || "";
    if (current.includes("JOIN #")) return;
    const match = current.match(/#([A-Z0-9-]+)/i);
    if (match) eyebrow.textContent = `JOIN #${match[1].toUpperCase()}`;
  };

  const scan = (root = document) => {
    root.querySelectorAll?.(".kz-ticket-card").forEach(addCardId);
    root.querySelectorAll?.(".kz-ticket-modal").forEach(patchModal);
  };

  const boot = () => {
    scan();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
