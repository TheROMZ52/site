# KillZone Team Site

سایت استاتیک KillZone با HTML/CSS/JS و Supabase.

## ساختار

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

## مسئولیت فایل‌ها

`app.js` صاحب lifecycle اصلی، session، حساب‌ها، بازی‌ها و رندرهای عمومی است. فایل‌های `account.js`، `join.js`، `presence.js` و `ui.js` هرکدام یک entrypoint واحد برای دامنه خود هستند و کد patchهای قبلی در همان فایل به بخش‌های مشخص ادغام شده است. `runtime-hardening.js` برای منطق cross-cutting باقی مانده و وابسته به یک feature خاص نیست.

## ترتیب اجرای JS

در HTMLها ابتدا Supabase، سپس `config.js` و `app.js` لود می‌شوند. بعد entrypointهای لازم (`account.js`، `join.js`، `ui.js`، `presence.js`) و در پایان `runtime-hardening.js` قرار گرفته‌اند. داخل هر entrypoint نیز ترتیب منطقی اجرای بخش‌های قبلی حفظ شده تا dependencyهای موجود جابه‌جا نشوند.

## Refactor و Changelog

این commit یک بازسازی structural است: فایل‌های patch/fix پراکنده حذف و منطق آن‌ها بر اساس domain ادغام شده، مسیر JS/CSSها استاندارد شده و HTMLها به entrypointهای جدید اشاره می‌کنند.

- ادغام account: `account-globals.js` + `account-fixes.js` + `account-fixes-2.js` + `account-page.js` → `js/account.js`
- ادغام presence: `presence.js` + `presence-account.js` + `presence-members.js` → `js/presence.js`
- ادغام join: `membership.js` + `join-session-fix.js` + `join-rescue.js` → `js/join.js`
- ادغام UI: `mobile-nav.js` + `hero-console.js` + `ui-rehydrate.js` + `member-visibility-fix.js` + `guest-accounts.js` → `js/ui.js`
- انتقال `app.js` و `config.js` و CSSهای موجود به پوشه‌های استاندارد
- حذف `app-recovery.js` و `clean-url.js` که دیگر مصرف مستقیمی نداشتند
- حذف `field-console.css` چون styleهای کنسول در منطق فعلی توسط `hero-console` مدیریت می‌شد
- حفظ منطق Twemoji 17.0.3 و Lion & Sun برای 🇮🇷 در `runtime-hardening.js`
