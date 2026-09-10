(function(){
  'use strict';
  const BUTTON_ID='kzDeleteAccountPage';
  let busy=false;

  function boot(){
    if(!document.getElementById(BUTTON_ID))return;
    document.addEventListener('click',async function(event){
      const button=event.target?.closest?.('#'+BUTTON_ID);
      if(!button||busy)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const user=window.currentUser;
      if(!user||typeof window.sb==='undefined'){
        alert('اکانت فعلی پیدا نشد.');
        return;
      }
      const confirmation=prompt(`برای حذف دائمی اکانت «${user.username}»، نام‌کاربری را دقیقاً وارد کن:`);
      if(confirmation!==user.username)return;
      if(!confirm('مطمئنی؟ اکانت، درخواست‌های عضویت، پیام‌ها، حضور و دستاوردها حذف می‌شن و این کار قابل برگشت نیست.'))return;

      busy=true;
      button.disabled=true;
      try{
        const cleanup=[
          ['team_join_messages','account_id'],
          ['team_join_requests','account_id'],
          ['member_presence','account_id'],
          ['achievements','account_id']
        ];
        for(const [table,column] of cleanup){
          const {error}=await window.sb.from(table).delete().eq(column,user.id);
          if(error)throw error;
        }
        const {error}=await window.sb.from('accounts').delete().eq('id',user.id);
        if(error)throw error;
        localStorage.removeItem('kz_session');
        window.currentUser=null;
        location.href='/';
      }catch(error){
        console.error('KillZone account deletion failed',error);
        alert(error?.message||'حذف اکانت انجام نشد.');
      }finally{
        busy=false;
        button.disabled=false;
      }
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
