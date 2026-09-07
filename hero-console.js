// KillZone hero field console — mirrors the homepage stats with live Supabase data.
(function(){
  'use strict';

  async function loadConsole(){
    if(typeof sb === 'undefined') return;
    try{
      const [accounts,games,modes] = await Promise.all([
        sb.from('accounts').select('id').eq('team_status','approved'),
        sb.from('game_blocks').select('id'),
        sb.from('game_modes').select('id')
      ]);
      const values = {
        consoleMembers: accounts.error ? null : (accounts.data || []).length,
        consoleGames: games.error ? null : (games.data || []).length,
        consoleModes: modes.error ? null : (modes.data || []).length
      };
      Object.entries(values).forEach(([id,value])=>{
        const el=document.getElementById(id);
        if(el && value !== null) el.textContent=value;
      });
    }catch(e){ console.warn('KillZone field console load failed',e); }
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(typeof sb !== 'undefined'){
        clearInterval(timer);
        loadConsole();
      }else if(tries>=40) clearInterval(timer);
    },250);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
