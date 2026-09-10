// KillZone account logout relocation
(function () {
  "use strict";
  const boot = () => {
    const style = document.createElement("style");
    style.textContent = "#userBox #logoutBtn{display:none!important}.kz-account-logout{margin-top:18px!important}";
    document.head.appendChild(style);
    const root = document.getElementById("kzAccountApp");
    if (!root || root.querySelector("#kzAccountLogout")) return;
    const section = document.createElement("section");
    section.className = "account-card kz-account-logout";
    section.innerHTML = '<div class="account-card-head"><span class="mini-label">SESSION</span></div><div class="kz-profile-actions"><button class="btn danger" id="kzAccountLogout">خروج از اکانت</button></div>';
    root.appendChild(section);
    document.getElementById("kzAccountLogout").addEventListener("click", () => {
      currentUser = null;
      if (typeof clearSession === "function") clearSession();
      if (typeof renderUserBox === "function") renderUserBox();
      location.href = "/";
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 50), { once: true });
  else setTimeout(boot, 50);
})();
