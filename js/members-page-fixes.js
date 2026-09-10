// KillZone members page behavior fixes.
(function () {
  "use strict";
  if (document.body?.dataset.page !== "members-community") return;

  const STAFF = new Set(["admin", "developer", "co_owner", "owner"]);
  const isStaff = () => STAFF.has(window.currentUser?.rank);
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

  function feedback(message, tone = "err") {
    let box = document.getElementById("kzMembersFeedback");
    if (!box) {
      box = document.createElement("div");
      box.id = "kzMembersFeedback";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      box.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;max-width:min(92vw,520px);padding:11px 16px;border:1px solid var(--line,#3b362a);background:rgba(16,16,14,.96);color:var(--paper,#f4eddc);font:600 13px/1.7 Vazirmatn,Arial,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:opacity .18s ease,border-color .18s ease}";
      document.body.appendChild(box);
    }
    box.textContent = message;
    box.style.borderColor =
      tone === "ok" ? "var(--grass,#728b4b)" : "var(--ember,#df6330)";
    box.style.opacity = "1";
    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.opacity = "0";
    }, 3200);
  }

  async function deleteAccountCascade(id) {
    if (!isStaff() || !window.sb || !id) return false;
    if (window.currentUser?.id === id) {
      feedback("نمی‌تونی اکانت خودت رو از اینجا حذف کنی.", "err");
      return false;
    }
    const related = [
      ["team_join_messages", "account_id"],
      ["team_join_requests", "account_id"],
      ["member_presence", "account_id"],
      ["achievements", "account_id"],
    ];
    for (const [table, column] of related) {
      const { error } = await sb.from(table).delete().eq(column, id);
      if (error) throw error;
    }
    const { error } = await sb.from("accounts").delete().eq("id", id);
    if (error) throw error;
    return true;
  }

  async function approveGuest(id, overlay) {
    if (!isStaff() || !window.sb) return;
    const { error } = await sb
      .from("accounts")
      .update({ rank: "member", team_status: "approved" })
      .eq("id", id)
      .eq("rank", "guest");
    if (error) {
      console.error("KillZone guest approve", error);
      feedback("تأیید مهمان انجام نشد.");
      return;
    }
    overlay?.classList.remove("show");
    feedback("مهمان با موفقیت به عضو تأییدشده تبدیل شد.", "ok");
    window.kzMembersRefresh?.();
  }

  function bindGuestActions() {
    const box = document.getElementById("kzGuestList");
    if (!box || box.dataset.kzFixBound === "1") return;
    box.dataset.kzFixBound = "1";
    box.addEventListener(
      "click",
      async (e) => {
        const button = e.target.closest("[data-action]");
        const card = e.target.closest(".kz-runtime-guest-card");
        if (!button || !card) return;
        if (!isStaff()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const id = card.dataset.id;
        const overlay = document.getElementById("kzGuestManager");
        if (button.dataset.action === "approve") {
          button.disabled = true;
          await approveGuest(id, overlay);
          button.disabled = false;
          return;
        }
        if (button.dataset.action === "delete") {
          if (button.dataset.confirm !== "1") {
            button.dataset.confirm = "1";
            button.textContent = "تأیید حذف";
            button.classList.add("danger");
            clearTimeout(button._resetTimer);
            button._resetTimer = setTimeout(() => {
              button.dataset.confirm = "0";
              button.textContent = "حذف";
              button.classList.remove("danger");
            }, 3500);
            return;
          }
          button.disabled = true;
          try {
            await deleteAccountCascade(id);
            overlay?.classList.remove("show");
            feedback("اکانت مهمان حذف شد.", "ok");
            window.kzMembersRefresh?.();
          } catch (error) {
            console.error("KillZone guest delete", error);
            feedback("حذف مهمان انجام نشد.");
            button.disabled = false;
          }
        }
      },
      true,
    );
  }

  function bindMemberActions() {
    const root = document.getElementById("membersCommunityContainer");
    if (!root || root.dataset.kzFixBound === "1") return;
    root.dataset.kzFixBound = "1";
    root.addEventListener(
      "click",
      async (e) => {
        const deleteButton = e.target.closest(".kz-member-delete");
        if (!deleteButton || !root.contains(deleteButton) || !isStaff()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const id = deleteButton.dataset.id;
        if (!id) return;
        if (window.currentUser?.id === id) {
          feedback("نمی‌تونی اکانت خودت رو از اینجا حذف کنی.");
          return;
        }
        if (deleteButton.dataset.confirm !== "1") {
          deleteButton.dataset.confirm = "1";
          deleteButton.textContent = "تأیید حذف";
          deleteButton.classList.add("danger");
          clearTimeout(deleteButton._resetTimer);
          deleteButton._resetTimer = setTimeout(() => {
            deleteButton.dataset.confirm = "0";
            deleteButton.textContent = "حذف";
            deleteButton.classList.remove("danger");
          }, 3500);
          return;
        }
        deleteButton.disabled = true;
        try {
          await deleteAccountCascade(id);
          feedback("عضو با موفقیت حذف شد.", "ok");
          window.kzMembersRefresh?.();
        } catch (error) {
          console.error("KillZone member delete", error);
          feedback("حذف عضو انجام نشد.");
          deleteButton.disabled = false;
        }
      },
      true,
    );
  }

  function bindAddMember() {
    const button = document.getElementById("addMemberBtn");
    if (!button || button.dataset.kzFixBound === "1") return;
    button.dataset.kzFixBound = "1";
    button.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!isStaff()) return;
        if (typeof window.wireMemberModal === "function")
          window.wireMemberModal();
        if (typeof window.openMemberModal === "function")
          window.openMemberModal(null, []);
      },
      true,
    );
  }

  function bindEscapeForMemberOverlays() {
    if (document.documentElement.dataset.kzMembersEscape === "1") return;
    document.documentElement.dataset.kzMembersEscape = "1";
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Escape") return;
        ["kzGuestManager", "kzProfileOverlayFallback", "memberOverlay"].forEach(
          (id) => document.getElementById(id)?.classList.remove("show"),
        );
      },
      true,
    );
  }

  function boot() {
    bindMemberActions();
    bindAddMember();
    bindEscapeForMemberOverlays();
    const observer = new MutationObserver(() => {
      bindMemberActions();
      bindAddMember();
      bindGuestActions();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setInterval(bindGuestActions, 500);
    window.addEventListener("pagehide", () => {
      observer.disconnect();
      clearInterval(timer);
    });
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
