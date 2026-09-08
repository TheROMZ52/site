/* Designed & developed by TheROMZ52 for KillZone Team — 2026 */
/* ================= KILLZONE GAME HUB ================= */
(function(){
  'use strict';

  const GAMES = [
    {
      key: 'minecraft', title: 'ماینکرفت', tag: 'MINECRAFT', tone: 'green', icon: '⛏️',
      description: 'ساخت‌وساز، بقا و بازی مشترک در دنیای کیل‌زون.',
      single: {
        title: 'Singleplayer', status: 'قابل اجرا',
        description: 'نسخهٔ سه‌بعدی تک‌نفره برای بازی مستقیم داخل مرورگر.',
        href: '/games/minecraft.html', mobileHref: '/games/minecraft-mobile.html', action: 'اجرای PC', mobileAction: 'اجرای موبایل'
      },
      multi: {
        title: 'Multiplayer SMP', status: 'در حال آماده‌سازی',
        description: 'یک SMP دائماً فعال با دنیای مشترک، ساخت‌وساز و پیشرفت تیمی.',
        bullets: ['دنیای مشترک', 'بازی دائمی', 'چت و همکاری', 'مرگ و Respawn'],
        disabled: true, action: 'به‌زودی'
      }
    },
    {
      key: 'counter-strike', title: 'کانتر استرایک', tag: 'COUNTER-STRIKE', tone: 'ember', icon: '🔫',
      description: 'مبارزهٔ سریع در یک میدان سه‌بعدی با حال‌وهوای FPS.',
      single: {
        title: 'Singleplayer', status: 'قابل اجرا',
        description: 'نسخهٔ تک‌نفرهٔ سه‌بعدی برای تمرین و بازی مستقیم.',
        href: '/games/counter-strike.html', mobileHref: '/games/counter-strike-mobile.html', action: 'اجرای PC', mobileAction: 'اجرای موبایل'
      },
      multi: {
        title: 'Multiplayer Respawn', status: 'در حال آماده‌سازی',
        description: 'مچ سریع کیل‌زون؛ هر بازیکن بعد از مرگ دوباره Spawn می‌شود و بازی تا پایان تایمر ادامه دارد.',
        bullets: ['Respawn بعد از مرگ', 'Kill Feed', 'امتیاز بر اساس Kill', 'تایمر مچ'],
        disabled: true, action: 'به‌زودی'
      }
    }
  ];

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }

  function modeCard(game, mode, kind){
    const bullets = (mode.bullets || []).map(x => `<span class="kz-hub-chip">${escapeHtml(x)}</span>`).join('');
    const actions = mode.href
      ? `<div class="kz-hub-actions">
          <a class="btn primary small kz-hub-action" href="${escapeHtml(mode.href)}">${escapeHtml(mode.action)} <span aria-hidden="true">←</span></a>
          ${mode.mobileHref ? `<a class="btn ghost small kz-hub-action" href="${escapeHtml(mode.mobileHref)}">📱 ${escapeHtml(mode.mobileAction || 'موبایل')}</a>` : ''}
        </div>`
      : `<div class="kz-hub-actions"><button class="btn ghost small kz-hub-action" type="button" disabled>${escapeHtml(mode.action)}</button></div>`;

    return `
      <article class="kz-hub-mode ${kind}">
        <div class="kz-hub-mode-top">
          <div>
            <span class="kz-hub-mode-kicker">${kind === 'single' ? 'SOLO OPS' : 'SQUAD OPS'}</span>
            <h4>${escapeHtml(mode.title)}</h4>
          </div>
          <span class="kz-hub-status ${mode.disabled ? 'soon' : 'live'}"><i></i>${escapeHtml(mode.status)}</span>
        </div>
        <p>${escapeHtml(mode.description)}</p>
        ${bullets ? `<div class="kz-hub-chips">${bullets}</div>` : ''}
        <div class="kz-hub-mode-footer">${actions}</div>
      </article>
    `;
  }

  function gameCard(game){
    return `
      <article class="kz-hub-game kz-hub-${escapeHtml(game.tone)}">
        <div class="kz-hub-game-head">
          <div class="kz-hub-game-mark" aria-hidden="true">${game.icon}</div>
          <div class="kz-hub-game-title">
            <span>${escapeHtml(game.tag)}</span>
            <h3>${escapeHtml(game.title)}</h3>
            <p>${escapeHtml(game.description)}</p>
          </div>
        </div>
        <div class="kz-hub-divider"></div>
        <div class="kz-hub-modes">
          ${modeCard(game, game.single, 'single')}
          ${modeCard(game, game.multi, 'multi')}
        </div>
      </article>
    `;
  }

  function render(){
    const container = document.getElementById('gameHubContainer');
    if(!container) return;
    container.innerHTML = `
      <div class="kz-hub-grid">${GAMES.map(gameCard).join('')}</div>
      <div class="kz-hub-note">
        <span class="kz-hub-note-mark">KZ //</span>
        <p>نسخهٔ PC و موبایل هر دو همان بازی کامل را اجرا می‌کنند؛ موبایل فقط یک لایهٔ کنترل لمسی اضافه دارد. بخش Multiplayer بعداً با زیرساخت آنلاین واقعی فعال می‌شود.</p>
      </div>
    `;
  }

  function boot(){ render(); document.documentElement.classList.add('kz-hub-ready'); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
