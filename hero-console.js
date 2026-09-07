// KillZone hero field console — live data + terminal-style boot sequence.
(function(){
  'use strict';

  const CONSOLE_CSS = `
.field-console{grid-column:2!important;grid-row:1!important;justify-self:stretch!important;align-self:center!important;width:min(100%,430px)!important;position:relative!important;z-index:5;direction:ltr;padding:22px 22px 18px!important;background:linear-gradient(150deg,rgba(33,31,24,.98),rgba(11,11,9,.985));border:1px solid var(--kz-stroke-strong)!important;box-shadow:0 30px 80px rgba(0,0,0,.38),0 0 0 1px rgba(223,99,48,.05),inset 0 1px 0 rgba(255,255,255,.04);overflow:hidden;clip-path:polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,18px 100%,0 calc(100% - 18px));isolation:isolate}.field-console:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(223,99,48,.10) 1px,transparent 1px),linear-gradient(rgba(223,99,48,.045) 1px,transparent 1px);background-size:28px 28px;mask-image:linear-gradient(120deg,rgba(0,0,0,.9),transparent 72%);opacity:.55;z-index:-2}.field-console:after{content:"";position:absolute;inset:10px;border:1px solid rgba(223,99,48,.10);pointer-events:none;z-index:-1}.console-top,.console-status,.console-stats,.console-section-label,.console-ops,.console-action,.console-rule{position:relative;z-index:1}.console-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font:700 11px/1.4 'Press Start 2P',monospace;color:var(--kz-text);letter-spacing:.4px}.console-code{font-size:8px;color:var(--kz-muted)}.console-rule{height:1px;margin:17px 0;background:linear-gradient(90deg,var(--kz-orange),rgba(89,80,62,.7),transparent)}.console-status{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:8px;font:700 10px/1 'Press Start 2P',monospace;color:var(--kz-muted)}.console-status strong{justify-self:end;color:#b8d58e;font-size:9px}.console-live-dot{width:7px;height:7px;border-radius:50%;background:var(--kz-green);box-shadow:0 0 14px rgba(114,139,75,.75);animation:kzConsolePulse 1.8s ease-in-out infinite}.console-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.console-stats>div{padding:12px 10px;background:rgba(255,255,255,.018);border:1px solid rgba(255,255,255,.055)}.console-stats span{display:block;font:700 8px/1.4 'Press Start 2P',monospace;color:var(--kz-muted);margin-bottom:8px}.console-stats b{display:block;font:700 22px/1 'Press Start 2P',monospace;color:var(--kz-text)}.console-section-label{margin-bottom:12px;font:700 9px/1 'Press Start 2P',monospace;color:var(--kz-orange);letter-spacing:.7px}.console-ops{display:grid;gap:8px}.console-ops>div{display:grid;grid-template-columns:auto 1fr;column-gap:9px;padding:10px 11px;border-inline-start:2px solid rgba(223,99,48,.45);background:rgba(255,255,255,.018)}.console-ops .op-mark{grid-row:1 / span 2;width:7px;height:7px;margin-top:4px;background:var(--kz-orange);box-shadow:0 0 10px rgba(223,99,48,.3)}.console-ops span:not(.op-mark){font:700 12px/1.4 'Vazirmatn',sans-serif;color:var(--kz-text)}.console-ops small{font:700 7px/1.5 'Press Start 2P',monospace;color:var(--kz-muted)}.console-action{display:flex;justify-content:space-between;align-items:center;margin-top:18px;padding:11px 13px;border:1px solid rgba(223,99,48,.35);background:rgba(223,99,48,.07);color:var(--kz-text);font:700 9px/1 'Press Start 2P',monospace;text-decoration:none;transition:transform .18s ease,background .18s ease,border-color .18s ease}.console-action:hover{transform:translateX(-3px);background:rgba(223,99,48,.12);border-color:rgba(223,99,48,.55)}.field-console.console-boot .console-top,.field-console.console-boot .console-status,.field-console.console-boot .console-section-label,.field-console.console-boot .console-action{opacity:0;transform:translateY(7px);animation:kzConsoleLine .42s cubic-bezier(.22,1,.36,1) forwards}.field-console.console-boot .console-top{animation-delay:.12s}.field-console.console-boot .console-status{animation-delay:.34s}.field-console.console-boot .console-section-label{animation-delay:.82s}.field-console.console-boot .console-action{animation-delay:1.42s}.field-console.console-boot .console-rule{opacity:0;transform:scaleX(.15);transform-origin:left;animation:kzConsoleRule .5s cubic-bezier(.22,1,.36,1) forwards}.field-console.console-boot .console-rule:nth-of-type(1){animation-delay:.23s}.field-console.console-boot .console-rule:nth-of-type(2){animation-delay:.68s}.field-console.console-boot .console-stats>div,.field-console.console-boot .console-ops>div{opacity:0;transform:translateX(-12px);animation:kzConsoleLine .38s cubic-bezier(.22,1,.36,1) forwards}.field-console.console-boot .console-stats>div:nth-child(1){animation-delay:.47s}.field-console.console-boot .console-stats>div:nth-child(2){animation-delay:.56s}.field-console.console-boot .console-stats>div:nth-child(3){animation-delay:.65s}.field-console.console-boot .console-ops>div:nth-child(1){animation-delay:1.02s}.field-console.console-boot .console-ops>div:nth-child(2){animation-delay:1.16s}@keyframes kzConsoleLine{to{opacity:1;transform:none}}@keyframes kzConsoleRule{to{opacity:1;transform:none}}@keyframes kzConsolePulse{0%,100%{opacity:.55;transform:scale(.9)}50%{opacity:1;transform:scale(1.16)}}
@media(min-width:981px){.hero{grid-template-columns:minmax(0,1.18fr) minmax(300px,.82fr)!important;gap:58px!important;align-items:center!important;direction:ltr!important}.hero-copy{grid-column:1!important;grid-row:1!important;direction:rtl!important;text-align:right}.field-console{grid-column:2!important;grid-row:1!important;transform:translateY(30px)}.hero .stats{grid-column:1!important;grid-row:2!important;align-self:start!important;direction:rtl!important;margin-top:18px!important}.kz-app-ready .field-console{animation:kzConsoleEnter .75s .12s cubic-bezier(.22,1,.36,1) both}.kz-app-ready .hero .stats{animation:kzConsoleStatsDrop .65s .4s cubic-bezier(.22,1,.36,1) both}}@keyframes kzConsoleEnter{from{opacity:0;transform:translateX(28px) translateY(44px) rotate(.8deg)}to{opacity:1;transform:translateX(0) translateY(30px) rotate(0)}}@keyframes kzConsoleStatsDrop{from{opacity:0;transform:translateY(-8px)}to{opacity:.68;transform:translateY(0)}}@media(max-width:980px){.hero{direction:rtl!important}.field-console{grid-column:1!important;grid-row:2!important;transform:none!important;width:100%!important}.hero .stats{grid-column:1!important;grid-row:3!important;transform:none!important;scale:1!important;opacity:1!important}}@media(max-width:620px){.field-console{padding:18px 17px!important}.console-top{font-size:9px}.console-stats b{font-size:17px}.console-action{font-size:8px}}@media(prefers-reduced-motion:reduce){.field-console.console-boot .console-top,.field-console.console-boot .console-status,.field-console.console-boot .console-section-label,.field-console.console-boot .console-action,.field-console.console-boot .console-rule,.field-console.console-boot .console-stats>div,.field-console.console-boot .console-ops>div,.kz-app-ready .field-console,.kz-app-ready .hero .stats{animation:none!important;opacity:1;transform:none}.console-live-dot{animation:none}}
`;

  function injectStyles(){
    if(document.getElementById('kz-field-console-styles')) return;
    const style=document.createElement('style');
    style.id='kz-field-console-styles';
    style.textContent=CONSOLE_CSS;
    document.head.appendChild(style);
  }

  async function loadConsole(){
    if(typeof sb === 'undefined') return;
    try{
      const [accounts,games,modes] = await Promise.all([
        sb.from('accounts').select('id').eq('team_status','approved'),
        sb.from('game_blocks').select('id'),
        sb.from('game_modes').select('id')
      ]);
      const values={consoleMembers:accounts.error?null:(accounts.data||[]).length,consoleGames:games.error?null:(games.data||[]).length,consoleModes:modes.error?null:(modes.data||[]).length};
      Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el&&value!==null)el.textContent=value;});
    }catch(e){console.warn('KillZone field console load failed',e);}
  }

  function bootConsole(){
    const consoleEl=document.querySelector('.field-console');
    if(!consoleEl) return;
    consoleEl.classList.remove('console-boot');
    void consoleEl.offsetWidth;
    consoleEl.classList.add('console-boot');
  }

  function boot(){
    injectStyles();
    bootConsole();
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(typeof sb!=='undefined'){clearInterval(timer);loadConsole();}
      else if(tries>=40)clearInterval(timer);
    },250);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
