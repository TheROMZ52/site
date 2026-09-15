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
    const { data, error } = await client()
      .from("accounts")
      .select(PROFILE_COLUMNS)
      .eq("auth_user_id", userId)
      .maybeSingle();
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

    const migration = await api.functions.invoke(AUTH_FUNCTION, {
      body: { action: "migrate", username, password },
    });
    if (migration.error || !migration.data?.ok) {
      return { ok: false, msg: migration.data?.msg || "ورود ناموفق است." };
    }

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
    const result = await api.functions.invoke(AUTH_FUNCTION, {
      body: { action: "register", username, password, game: game || "", photo: photo || "" },
    });
    if (result.error || !result.data?.ok) {
      return { ok: false, msg: result.data?.msg || "خطا در ثبت‌نام. دوباره تلاش کن." };
    }
    const signIn = await api.auth.signInWithPassword({ email: result.data.email, password });
    if (signIn.error || !signIn.data?.user) {
      return { ok: false, msg: "اکانت ساخته شد ولی ورود خودکار انجام نشد. دوباره وارد شو." };
    }
    const profile = await profileForAuthUser(signIn.data.user.id);
    if (!profile) return { ok: false, msg: "پروفایل اکانت پیدا نشد." };
    return { ok: true, account: profile };
  }

  async function clearSession() {
    try {
      await client().auth.signOut();
    } catch (error) {
      console.error("[KillZone Auth] signOut", error);
    }
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
    const api = client();
    const { data, error } = await api.from("public_accounts").select(PUBLIC_PROFILE_COLUMNS).order("username");
    if (error) {
      console.error("[KillZone Auth] fetchAccounts", error);
      return [];
    }
    return data || [];
  }

  async function updatePassword(password) {
    if (String(password || "").length < 6) return { ok: false, msg: "رمز عبور باید حداقل ۶ کاراکتر باشد." };
    const { error } = await client().auth.updateUser({ password });
    if (error) return { ok: false, msg: "تغییر رمز انجام نشد." };
    return { ok: true };
  }

  async function secureDeleteAccount() {
    const result = await client().functions.invoke(AUTH_FUNCTION, {
      body: { action: "delete" },
    });
    if (result.error || !result.data?.ok) throw new Error(result.data?.msg || "حذف اکانت انجام نشد.");
    await client().auth.signOut();
    exposeCurrentUser(null);
    localStorage.removeItem("kz_session");
  }

  function installAccountSelectGuard() {
    const originalFrom = client().from.bind(client());
    const safeColumns = PROFILE_COLUMNS;
    client().from = (table) => {
      const builder = originalFrom(table);
      if (table !== "accounts") return builder;
      const originalSelect = builder.select.bind(builder);
      builder.select = (columns, options) => originalSelect(columns === "*" ? safeColumns : columns, options);
      return builder;
    };
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

    client().auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) {
        exposeCurrentUser(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        try {
          const profile = await profileForAuthUser(session.user.id);
          exposeCurrentUser(profile);
          window.dispatchEvent(new CustomEvent("kz:session-ready"));
        } catch (error) {
          console.error("[KillZone Auth] auth state", error);
        }
      }
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