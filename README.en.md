<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:050505,35:171717,70:303030,100:050505&height=190&section=header&text=KillZone%20Team%20Site&fontSize=54&fontColor=ffffff&fontAlignY=38&desc=HOME%20BASE%20FOR%20THE%20SQUAD&descAlignY=62&descSize=13" width="100%" />

<br/>

<img src="https://img.shields.io/badge/HTML-111111?style=for-the-badge&logo=html5&logoColor=white" /> <img src="https://img.shields.io/badge/SUPABASE-111111?style=for-the-badge&logo=supabase&logoColor=white" /> <img src="https://img.shields.io/badge/VERCEL-111111?style=for-the-badge&logo=vercel&logoColor=white" /> <img src="https://img.shields.io/github/stars/TheROMZ52/site?style=for-the-badge&color=111111&labelColor=050505&logo=github" /> <img src="https://img.shields.io/github/last-commit/TheROMZ52/site?style=for-the-badge&color=111111&labelColor=050505" />

<br/>

## KillZone Team Website

[فارسی](README.md) · [English](README.en.md)

### The KillZone team's home base: people, games, and team bits — fewer spreadsheets, more squad energy.

<img src="https://skillicons.dev/icons?i=html,css,js,supabase,vercel&theme=dark" />

</div>

---

A static website for the KillZone team, built with HTML, CSS, JavaScript, and Supabase.

---

## 01 / PROJECT STRUCTURE

```text
/
├─ index.html
├─ games.html
├─ members.html
├─ register.html
├─ account.html
├─ join.html
├─ 404.html
├─ DESIGN.md
├─ vercel.json
│
├─ js/
│  ├─ app.js
│  ├─ config.js
│  ├─ account.js
│  ├─ join.js
│  ├─ presence.js
│  ├─ ui.js
│  └─ runtime-hardening.js
│
└─ css/
   ├─ style.css
   ├─ revamp.css
   ├─ account.css
   ├─ presence.css
   ├─ join-tickets.css
   └─ buttons.css
```

---

## 02 / RESPONSIBILITIES

- `app.js`: main lifecycle, sessions, accounts, games, and shared rendering
- `config.js`: Supabase configuration
- `account.js`: account pages, sessions, profiles, and access guards
- `join.js`: membership forms, applicant tickets, and review center
- `presence.js`: heartbeats, squad presence, and member online status
- `ui.js`: navigation, field console, UI rehydration, and guest controls
- `runtime-hardening.js`: cross-cutting runtime protections, Twemoji, upload limits, and sign-in UX

---

<details>
<summary><b>03 / JAVASCRIPT LOAD ORDER</b></summary>
<br/>

HTML pages load Supabase first, followed by `config.js` and `app.js`. Required entry points (`account.js`, `join.js`, `ui.js`, and `presence.js`) follow, with `runtime-hardening.js` loaded last. Each entry point keeps its internal dependency order.

</details>

---

<details>
<summary><b>04 / REFACTORING NOTES</b></summary>
<br/>

The structural refactor consolidated scattered patch and fix files into domain-specific entry points:

- Account: `account-globals.js`, `account-fixes.js`, `account-fixes-2.js`, and `account-page.js` → `js/account.js`
- Presence: `presence.js`, `presence-account.js`, and `presence-members.js` → `js/presence.js`
- Membership: `membership.js`, `join-session-fix.js`, and `join-rescue.js` → `js/join.js`
- UI: `mobile-nav.js`, `hero-console.js`, `ui-rehydrate.js`, `member-visibility-fix.js`, and `guest-accounts.js` → `js/ui.js`
- Moved shared JavaScript and CSS assets into standard directories
- Removed obsolete `app-recovery.js` and `clean-url.js` files, plus the unused `field-console.css`

The goal is to keep one clear entry point per feature domain and reduce duplicated patch logic.

</details>

---

<div align="center">

<a href="https://github.com/TheROMZ52?tab=repositories"><img src="https://img.shields.io/badge/MORE%20PROJECTS-111111?style=for-the-badge&logo=github&logoColor=white" /></a>

<br/><br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:050505,50:202020,100:050505&height=110&section=footer" width="100%" />

<sub>© TheROMZ52 • Built with code, curiosity, and a suspicious number of tabs.</sub>

</div>
