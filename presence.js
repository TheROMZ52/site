// KillZone presence — automatic online state + manual activity status.
(function(){
  'use strict';
  const HEARTBEAT_MS = 30000;
  const ONLINE_MS = 90000;
  const AWAY_MS = 5 * 60 * 1000;
  const STATUS_LABELS = {
    playing: ['در حال بازی','playing','🎮'],
    competitive: ['در حال رقابت','competitive','🏆'],
    ready: ['آماده برای بازی','ready','🟢'],
    busy: ['مشغول','busy','🔴'],
    away: ['AFK','away','💤']
  };
  let timer = null;
  let lastAccountId = null;

  window.kzPresence = window.kzPresence || {
    ONLINE_MS,
    AWAY_MS,
    STATUS_LABELS,
    formatStatus(status, game, text){
      const item = STATUS_LABELS[status] || STATUS_LABELS.ready;
      return { label:item[0], tone:item[1], icon:item[2], game:game||'', text:text||'' };
    },
    isOnline(row){ return !!row && (Date.now() - new Date(row.last_seen).getTime()) <= ONLINE_MS * 1.25; },
    isAway(row){ return !!row && !this.isOnline(row) && (Date.now() - new Date(row.last_seen).getTime()) <= AWAY_MS; }
  };

  async function getUser(){
    if(typeof initSession==='function' && !window.currentUser) await initSession();
    return window.currentUser || null;
  }

  async function heartbeat(){
    const u = await getUser();
    if(!u || u.team_status!=='approved') return;
    if(lastAccountId && lastAccountId !== u.id) return;
    lastAccountId = u.id;
    const { data:old } = await sb.from('member_presence').select('status,game,status_text').eq('account_id',u.id).maybeSingle();
    const payload = {
      account_id:u.id,
      status:old?.status || 'ready',
      game:old?.game || u.game || '',
      status_text:old?.status_text || '',
      last_seen:new Date().toISOString(),
      updated_at:new Date().toISOString()
    };
    const { error } = await sb.from('member_presence').upsert(payload,{onConflict:'account_id'});
    if(error) console.warn('KillZone presence heartbeat:',error);
  }

  async function boot(){
    if(!window.sb) return setTimeout(boot,1000);
    await heartbeat();
    if(!timer) timer=setInterval(heartbeat,HEARTBEAT_MS);
  }

  window.kzPresence.refresh = heartbeat;
  window.kzPresence.setStatus = async function(status, game, statusText){
    const u=await getUser();
    if(!u || u.team_status!=='approved') return {ok:false,msg:'فقط اعضای تأییدشده می‌تونن وضعیت اسکواد رو تنظیم کنن.'};
    if(!STATUS_LABELS[status]) return {ok:false,msg:'وضعیت نامعتبره.'};
    const payload={account_id:u.id,status,game:(game||'').trim(),status_text:(statusText||'').trim(),last_seen:new Date().toISOString(),updated_at:new Date().toISOString()};
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
