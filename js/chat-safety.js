(function(){
  "use strict";
  const openConfirm=(text,run)=>{
    const o=document.createElement("div");
    o.className="overlay kz-chat-confirm";
    o.style.display="flex";
    o.innerHTML=`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="kzConfirmTitle"><h3 id="kzConfirmTitle">حذف پیام</h3><p style="color:var(--kz-muted);line-height:1.9;margin:0 0 18px">${text}</p><div style="display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap"><button type="button" class="btn ghost" data-cancel>لغو</button><button type="button" class="btn danger" data-ok>حذف پیام</button></div></div>`;
    document.body.appendChild(o);
    const close=()=>o.remove();
    o.querySelector("[data-cancel]").addEventListener("click",close);
    o.querySelector("[data-ok]").addEventListener("click",async()=>{close();await run();});
    o.addEventListener("click",e=>{if(e.target===o) close();});
    o.querySelector("[data-cancel]").focus();
  };
  const bind=()=>{
    const box=document.getElementById("chatMessages");
    if(!box||box.dataset.kzSafetyBound)return;
    box.dataset.kzSafetyBound="1";
    box.addEventListener("click",e=>{
      const button=e.target.closest("button[data-delete]");
      if(!button)return;
      e.stopPropagation();
      e.preventDefault();
      const me=typeof currentUser!=="undefined"?currentUser:window.currentUser||null;
      const id=Number(button.dataset.delete);
      if(!me||!id)return;
      openConfirm("این پیام برای همیشه از چت پاک می‌شه.",async()=>{
        const {error}=await sb.from("chat_messages").delete().eq("id",id).eq("author_id",me.id);
        if(error){
          const old=document.querySelector(".kz-chat-toast"); old?.remove();
          const t=document.createElement("div"); t.className="kz-chat-toast"; t.textContent="حذف پیام انجام نشد."; document.body.appendChild(t); setTimeout(()=>t.remove(),2400);
        }else{
          const old=document.querySelector(".kz-chat-toast"); old?.remove();
          const t=document.createElement("div"); t.className="kz-chat-toast"; t.textContent="پیام حذف شد."; document.body.appendChild(t); setTimeout(()=>t.remove(),2400);
          if(typeof window.kzChatReload==="function") window.kzChatReload();
        }
      });
    },true);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(bind,50),{once:true});else setTimeout(bind,50);
})();