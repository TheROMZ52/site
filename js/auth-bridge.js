(() => {
  "use strict";

  const PROFILE_COLUMNS = "id,username,rank,game,photo,team_status,nickname,bio,social,joined_at,staff_tag,auth_user_id";
  const PUBLIC_PROFILE_COLUMNS = "id,username,rank,game,photo,team_status,nickname,bio,social,joined_at,staff_tag";
  const AUTH_FUNCTION = "killzone-auth-v2";
  const normalize = (value) => String(value ?? "").trim().toLowerCase();
  const emailFor = (username) => `${normalize(username)}@auth.killzone.team`;
  const client = () => window.sb;

  function exposeCurrentUser(profile) {
    window.currentUser = profile || null;
    return window.currentUser;
  }

  async function profileForAuthUser(userId) {
    if (!userId) return null;
    const { data, error } = await client().from("accounts").select(PROFILE_COLUMNS).eq("auth_user_id", userId).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function initSession() {
    try {
      const { data, error } = await client().auth.getUser();
      if (error || !data?.user) {
        exposeCurrentUser(null);
        return null;
      }
      const profile = await profileForAuthUser(data.user.id);
      if (!profile) {
        await client().auth.signOut();
        exposeCurrentUser(null);
        return null;
      }
      exposeCurrentUser(profile);
      return profile;
    } catch (error) {
      console.error("[KillZone Auth] initSession", error);
      exposeCurrentUser(null);
      return null;
    }
  }

  async function loginUser(username, password) {
    const api = client();
    const email = emailFor(username);
    const first = await api.auth.signInWithPassword({ email, password });
    if (first.data?.user) {
      const profile = await profileForAuthUser(first.data.user.id);
      if (!profile) return { ok: false, msg: "پروفایل اکانت پیدا نشد." };
      return { ok: true, account: profile };
    }

    const migration = await api.functions.invoke(AUTH_FUNCTION, { body: { action: "migrate", username, password } });
    if (migration.error || !migration.data?.ok) return { ok: false, msg: migration.data?.msg || "ورود ناموفق است." };

    const second = await api.auth.signInWithPassword({ email: migration.data.email, password });
    if (second.error || !second.data?.user) {
      console.error("[KillZone Auth] post-migration sign in", second.error);
      return { ok: false, msg: "ورود ناموفق است." };
    }
    const profile = await profileForAuthUser(second.data.user.id);
    if (!profile) return { ok: false, msg: "پروفایل اکانت پیدا نشد." };
    return { ok: true, account: profile };
  }

  async function registerUser(username, password, game, photo) {
    const api = client();
    const result = await api.functions.invoke(AUTH_FUNCTION, { body: { action: "register", username, password, game: game || "", photo: photo || "" } });
    if (result.error || !result.data?.ok) return { ok: false, msg: result.data?.msg || "خطا در ثبت‌نام. دوباره تلاش کن." };
    const signIn = await api.auth.signInWithPassword({ email: result.data.email, password });
    if (signIn.error || !signIn.data?.user) return { ok: false, msg: "اکانت ساخته شد ولی ورود خودکار انجام نشد. دوباره وارد شو." };
    const profile = await profileForAuthUser(signIn.data.user.id);
    if (!profile) return { ok: false, msg: "پروفایل اکانت پیدا نشد." };
    return { ok: true, account: profile };
  }

  async function clearSession() {
    try { await client().auth.signOut(); } catch (error) { console.error("[KillZone Auth] signOut", error); }
    localStorage.removeItem("kz_session");
    exposeCurrentUser(null);
  }

  async function saveSession(account) {
    if (account?.auth_user_id) {
      const session = await client().auth.getSession();
      if (session.data?.session) localStorage.removeItem("kz_session");
    }
    exposeCurrentUser(account || null);
  }

  async function fetchAccounts() {
    const { data, error } = await client().from("public_accounts").select(PUBLIC_PROFILE_COLUMNS).order("username");
    if (error) {
      console.error("[KillZone Auth] fetchAccounts", error);
      return [];
    }
    return data || [];
  }

  async function updatePassword(password) {
    const value = String(password || "");
    if (value.length < 6 || value.length > 128) return { ok: false, msg: "رمز عبور باید بین ۶ تا ۱۲۸ کاراکتر باشد." };
    const { error } = await client().auth.updateUser({ password: value });
    if (error) return { ok: false, msg: "تغییر رمز انجام نشد." };
    return { ok: true };
  }

  async function secureDeleteAccount() {
    const result = await client().functions.invoke(AUTH_FUNCTION, { body: { action: "delete" } });
    if (result.error || !result.data?.ok) throw new Error(result.data?.msg || "حذف اکانت انجام نشد.");
    await client().auth.signOut();
    exposeCurrentUser(null);
    localStorage.removeItem("kz_session");
  }

  async function saveAccountFromUi() {
    const u = window.currentUser;
    if (!u) return;
    const updates = {};
    const fields = [
      ["game", "kzProfileGame", "kzAccountGame"],
      ["nickname", "kzProfileNickname", "kzAccountNickname"],
      ["bio", "kzProfileBio", "kzAccountBio"],
      ["social", "kzProfileSocial", "kzAccountSocial"],
    ];
    for (const [column, ...ids] of fields) {
      const input = ids.map((id) => document.getElementById(id)).find(Boolean);
      if (input) updates[column] = String(input.value || "").trim();
    }
    const file = ["kzProfilePhoto", "kzAccountPhoto"].map((id) => document.getElementById(id)).map((el) => el?.files?.[0]).find(Boolean);
    if (file && typeof window.uploadPhoto === "function") {
      const url = await window.uploadPhoto(file, () => {});
      if (!url) throw new Error("آپلود عکس ناموفق بود.");
      updates.photo = url;
    }
    const password = ["kzProfilePass", "kzAccountPass"].map((id) => document.getElementById(id)?.value || "").find(Boolean) || "";
    if (password) {
      const result = await updatePassword(password);
      if (!result.ok) throw new Error(result.msg);
    }
    delete updates.auth_user_id;
    delete updates.rank;
    delete updates.team_status;
    delete updates.is_admin;
    delete updates.staff_permission;
    delete updates.staff_tag;
    delete updates.pass_hash;
    if (Object.keys(updates).length) {
      const { error } = await client().from("accounts").update(updates).eq("id", u.id).select(PROFILE_COLUMNS).maybeSingle();
      if (error) throw error;
    }
    const fresh = await profileForAuthUser(u.auth_user_id);
    exposeCurrentUser(fresh || { ...u, ...updates });
    if (typeof window.renderUserBox === "function") window.renderUserBox();
  }

  function installAccountSelectGuard() {
    const api = client();
    const originalFrom = api.from.bind(api);
    api.from = (table) => {
      const builder = originalFrom(table);
      if (table !== "accounts") return builder;
      const originalSelect = builder.select.bind(builder);
      builder.select = (columns, options) => originalSelect(columns === "*" ? PROFILE_COLUMNS : columns, options);
      return builder;
    };
  }

  function installUiGuards() {
    document.addEventListener("click", async (event) => {
      const button = event.target?.closest?.("button");
      if (!button || !window.currentUser) return;
      const id = String(button.id || "").toLowerCase();
      const text = String(button.textContent || "").trim();
      if (id === "kzprofilesave" || id === "kzaccountsave") {
        event.preventDefault();
        event.stopImmediatePropagation();
        button.disabled = true;
        try {
          await saveAccountFromUi();
          document.getElementById("kzAccountMsg")?.replaceChildren(Object.assign(document.createElement("div"), { className: "account-msg ok", textContent: "تغییرات با موفقیت ذخیره شد ✔" }));
          document.getElementById("kzProfileMsg")?.replaceChildren(Object.assign(document.createElement("div"), { className: "form-msg ok", textContent: "تغییرات با موفقیت ذخیره شد ✔" }));
        } catch (error) {
          console.error("[KillZone Auth] profile save", error);
          document.getElementById("kzAccountMsg")?.replaceChildren(Object.assign(document.createElement("div"), { className: "account-msg err", textContent: error.message || "ذخیره تغییرات ناموفق بود." }));
        } finally {
          button.disabled = false;
        }
      }
      if (id.includes("delete") || /حذف اکانت|حذف دائمی/.test(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!confirm(`برای حذف «${window.currentUser.username}» مطمئنی؟`)) return;
        try {
          await secureDeleteAccount();
          location.href = "/";
        } catch (error) {
          alert(error.message || "حذف اکانت انجام نشد.");
        }
      }
    }, true);
  }

  function wireLegacyUI() {
    window.initSession = initSession;
    window.loginUser = loginUser;
    window.registerUser = registerUser;
    window.clearSession = clearSession;
    window.saveSession = saveSession;
    window.fetchAccounts = fetchAccounts;
    window.kzUpdatePassword = updatePassword;
    window.kzSecureDeleteAccount = secureDeleteAccount;
    installAccountSelectGuard();
    installUiGuards();

    client().auth.onAuthStateChange((event, session) => {
      window.setTimeout(async () => {
        if (!session?.user) {
          exposeCurrentUser(null);
          return;
        }
        if (!["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) return;
        try {
          exposeCurrentUser(await profileForAuthUser(session.user.id));
          window.dispatchEvent(new CustomEvent("kz:session-ready"));
        } catch (error) {
          console.error("[KillZone Auth] auth state", error);
        }
      }, 0);
    });
  }

  function start() {
    if (!client()) return;
    wireLegacyUI();
    initSession().then(() => {
      window.dispatchEvent(new CustomEvent("kz:session-ready"));
      if (typeof window.renderUserBox === "function") window.renderUserBox();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();