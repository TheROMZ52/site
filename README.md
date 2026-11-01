<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:050505,35:171717,70:303030,100:050505&height=190&section=header&text=KillZone%20Team%20Site&fontSize=54&fontColor=ffffff&fontAlignY=38&desc=HOME%20BASE%20FOR%20THE%20SQUAD&descAlignY=62&descSize=13" width="100%" />

<br/>

<img src="https://img.shields.io/badge/HTML-111111?style=for-the-badge&logo=html5&logoColor=white" /> <img src="https://img.shields.io/badge/SUPABASE-111111?style=for-the-badge&logo=supabase&logoColor=white" /> <img src="https://img.shields.io/badge/VERCEL-111111?style=for-the-badge&logo=vercel&logoColor=white" /> <img src="https://img.shields.io/github/stars/TheROMZ52/site?style=for-the-badge&color=111111&labelColor=050505&logo=github" /> <img src="https://img.shields.io/github/last-commit/TheROMZ52/site?style=for-the-badge&color=111111&labelColor=050505" />

<br/>

## KillZone Team Site پر

[فارسی](README.md) · [English](README.en.md)

### یه پایگاه برای تیم KillZone؛ از معرفی اعضا تا مدیریت ماجراهای تیم، بدون نیاز به جلسه‌ی سه‌ساعته.

<img src="https://skillicons.dev/icons?i=html,css,js,supabase,vercel&theme=dark" />

</div>

---

سایت استاتیک KillZone با HTML/CSS/JS و Supabase.

---

## 01 / ساختار

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
│  ├─ app.js                    # هسته سایت، session، اکانت‌ها، بازی‌ها و رندرهای اصلی
│  ├─ config.js                 # تنظیمات Supabase
│  ├─ account.js                # منطق دامنه account + session/profile guards
│  ├─ join.js                   # منطق فرم عضویت، تیکت متقاضی و مرکز بررسی
│  ├─ presence.js               # heartbeat، وضعیت Squad و نمایش حضور اعضا
│  ├─ ui.js                     # navigation، field console، rehydrate و guest controls
│  └─ runtime-hardening.js      # محافظت runtime، Twemoji، محدودیت آپلود و UX ورود
│
└─ css/
   ├─ style.css                # توکن‌ها و استایل پایه مشترک
   ├─ revamp.css               # استایل‌های بازطراحی مشترک
   ├─ account.css              # صفحه اکانت
   ├─ presence.css             # وضعیت آنلاین و Squad Presence
   ├─ join-tickets.css         # مرکز تیکت‌های عضویت
   └─ buttons.css              # سیستم دکمه‌ها
```

---

## 02 / مسئولیت فایل‌ها

`app.js` صاحب lifecycle اصلی، session، حساب‌ها، بازی‌ها و رندرهای عمومی است. فایل‌های `account.js`، `join.js`، `presence.js` و `ui.js` هرکدام یک entrypoint واحد برای دامنه خود هستند و کد patchهای قبلی در همان فایل به بخش‌های مشخص ادغام شده است. `runtime-hardening.js` برای منطق cross-cutting باقی مانده و وابسته به یک feature خاص نیست.

---

<details>
<summary><b>03 / ترتیب اجرای JS</b></summary>
<br/>

در HTMLها ابتدا Supabase، سپس `config.js` و `app.js` لود می‌شوند. بعد entrypointهای لازم (`account.js`، `join.js`، `ui.js`، `presence.js`) و در پایان `runtime-hardening.js` قرار گرفته‌اند. داخل هر entrypoint نیز ترتیب منطقی اجرای بخش‌های قبلی حفظ شده تا dependencyهای موجود جابه‌جا نشوند.

</details>

---

<details>
<summary><b>04 / Refactor و Changelog</b></summary>
<br/>

این commit یک بازسازی structural است: فایل‌های patch/fix پراکنده حذف و منطق آن‌ها بر اساس domain ادغام شده، مسیر JS/CSSها استاندارد شده و HTMLها به entrypointهای جدید اشاره می‌کنند.

- ادغام account: `account-globals.js` + `account-fixes.js` + `account-fixes-2.js` + `account-page.js` → `js/account.js`
- ادغام presence: `presence.js` + `presence-account.js` + `presence-members.js` → `js/presence.js`
- ادغام join: `membership.js` + `join-session-fix.js` + `join-rescue.js` → `js/join.js`
- ادغام UI: `mobile-nav.js` + `hero-console.js` + `ui-rehydrate.js` + `member-visibility-fix.js` + `guest-accounts.js` → `js/ui.js`
- انتقال `app.js` و `config.js` و CSSهای موجود به پوشه‌های استاندارد
- حذف `app-recovery.js` و `clean-url.js` که دیگر مصرف مستقیمی نداشتند
- حذف `field-console.css` چون styleهای کنسول در منطق فعلی توسط `hero-console` مدیریت می‌شد
- حفظ منطق Twemoji 17.0.3 و Lion & Sun برای 🇮🇷 در `runtime-hardening.js`
باحاله نه؟

</details>

---

<div align="center">

<a href="https://github.com/TheROMZ52?tab=repositories"><img src="https://img.shields.io/badge/MORE%20PROJECTS-111111?style=for-the-badge&logo=github&logoColor=white" /></a>

<br/><br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:050505,50:202020,100:050505&height=110&section=footer" width="100%" />

<sub>© TheROMZ52 • ساخته‌شده با کد، کنجکاوی و تعداد مشکوکی تب باز.</sub>

</div>
