# KillZone Team Website

The KillZone team's home base: people, games, and team bits — fewer spreadsheets, more squad energy.
[فارسی](README.md) · [English](README.en.md)

A static website for the KillZone team, built with HTML, CSS, JavaScript, and Supabase.

## Project structure

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

## Responsibilities

- `app.js`: main lifecycle, sessions, accounts, games, and shared rendering
- `config.js`: Supabase configuration
- `account.js`: account pages, sessions, profiles, and access guards
- `join.js`: membership forms, applicant tickets, and review center
- `presence.js`: heartbeats, squad presence, and member online status
- `ui.js`: navigation, field console, UI rehydration, and guest controls
- `runtime-hardening.js`: cross-cutting runtime protections, Twemoji, upload limits, and sign-in UX

## JavaScript load order

HTML pages load Supabase first, followed by `config.js` and `app.js`. Required entry points (`account.js`, `join.js`, `ui.js`, and `presence.js`) follow, with `runtime-hardening.js` loaded last. Each entry point keeps its internal dependency order.

## Refactoring notes

The structural refactor consolidated scattered patch and fix files into domain-specific entry points:

- Account: `account-globals.js`, `account-fixes.js`, `account-fixes-2.js`, and `account-page.js` → `js/account.js`
- Presence: `presence.js`, `presence-account.js`, and `presence-members.js` → `js/presence.js`
- Membership: `membership.js`, `join-session-fix.js`, and `join-rescue.js` → `js/join.js`
- UI: `mobile-nav.js`, `hero-console.js`, `ui-rehydrate.js`, `member-visibility-fix.js`, and `guest-accounts.js` → `js/ui.js`
- Moved shared JavaScript and CSS assets into standard directories
- Removed obsolete `app-recovery.js` and `clean-url.js` files, plus the unused `field-console.css`

The goal is to keep one clear entry point per feature domain and reduce duplicated patch logic.
