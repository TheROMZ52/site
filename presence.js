// KillZone presence — automatic online state + manual activity status.
(function(){
  'use strict';
  // Mobile browsers may throttle background timers, so keep a wider online window
  // and refresh immediately whenever the page becomes active again.
  const HEARTBEAT_MS = 30000;
  const ONLINE_MS = 5 * 60 * 1000;
  const AWAY_MS = 10 * 60 * 1000;
  const STATUS_LABELS = {
    playing: ['در حال بازی','playing','🎮'],
    competitive: ['در حال رقابت','competitive','🏆'],
    ready: ['آماده برای بازی','ready','🟢'],
    busy: ['مشغول','busy','🔴'],
    away: ['AFK','away','💤']
  };
  let timer = null;
  let lastAccountId = null;
  let heartbeatRunning = false;

  window.kzPresence = window.kzPresence || {
    ONLINE_MS,
    AWAY_MS,
    STATUS_LABELS,
    formatStatus(status, game, text){
      const item = STATUS_LABELS[status] || STATUS_LABELS.ready;
      return { label:item[0], tone:item[1], icon:item[2], game:game||'', text:text||'' };
    },
    isOnline(row){ return !!row && (Date.now() - new Date(row.last_seen).getTime()) <= ONLINE_MS; },
    isAway(row){ return !!row && !this.isOnline(row) && (Date.now() - new Date(row.last_seen).getTime()) <= AWAY_MS; }
  };

  async function getUser(){
    if(typeof initSession==='function' && !window.currentUser) await initSession();
    return window.currentUser || null;
  }

  async function heartbeat(){
    if(heartbeatRunning) return;
    heartbeatRunning = true;
    try{
      const u = await getUser();
      if(!u || u.team_status!=='approved') return;
      if(lastAccountId && lastAccountId !== u.id) return;
      lastAccountId = u.id;
      const { data:old } = await sb.from('member_presence').select('status,game,status_text').eq('account_id',u.id).maybeSingle();
      const now = new Date().toISOString();
      const payload = {
        account_id:u.id,
        status:old?.status || 'ready',
        game:old?.game || u.game || '',
        status_text:old?.status_text || '',
        last_seen:now,
        updated_at:now
      };
      const { error } = await sb.from('member_presence').upsert(payload,{onConflict:'account_id'});
      if(error) console.warn('KillZone presence heartbeat:',error);
    }finally{
      heartbeatRunning = false;
    }
  }

  function scheduleHeartbeat(){
    if(timer) clearTimeout(timer);
    timer = setTimeout(async function tick(){
      await heartbeat();
      scheduleHeartbeat();
    }, HEARTBEAT_MS);
  }

  async function boot(){
    if(!window.sb) return setTimeout(boot,1000);
    await heartbeat();
    scheduleHeartbeat();
  }

  // Browser/mobile lifecycle hooks: refresh presence immediately when the page
  // becomes visible, focused, or the network connection returns.
  ['focus','pageshow','online'].forEach(eventName=>{
    window.addEventListener(eventName,()=>{ heartbeat(); },{passive:true});
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') heartbeat();
  });

  window.kzPresence.refresh = heartbeat;
  window.kzPresence.setStatus = async function(status, game, statusText){
    const u=await getUser();
    if(!u || u.team_status!=='approved') return {ok:false,msg:'فقط اعضای تأییدشده می‌تونن وضعیت اسکواد رو تنظیم کنن.'};
    if(!STATUS_LABELS[status]) return {ok:false,msg:'وضعیت نامعتبره.'};
    const now=new Date().toISOString();
    const payload={account_id:u.id,status,game:(game||'').trim(),status_text:(statusText||'').trim(),last_seen:now,updated_at:now};
    const {data,error}=await sb.from('member_presence').upsert(payload,{onConflict:'account_id'}).select('*').maybeSingle();
    if(error) return {ok:false,msg:error.message};
    return {ok:true,data};
  };
  window.kzPresence.fetchAll = async function(){
    const {data,error}=await sb.from('member_presence').select('*');
    if(error){console.warn('KillZone presence fetch:',error);return [];} return data||[];
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
