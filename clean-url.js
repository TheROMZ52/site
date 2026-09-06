// KillZone clean URL safety net for dynamically generated links.
(function(){
  'use strict';

  const cleanMap = {
    'index.html': '/',
    'games.html': '/games',
    'members.html': '/members',
    'join.html': '/join',
    'register.html': '/register',
    'account.html': '/account'
  };

  function cleanLinks(root=document){
    root.querySelectorAll?.('a[href]').forEach(link=>{
      const raw=link.getAttribute('href');
      if(!raw || raw.startsWith('#') || raw.startsWith('http://') || raw.startsWith('https://')) return;
      const [path, query=''] = raw.split('?');
      const clean=cleanMap[path];
      if(clean) link.setAttribute('href', clean + (query ? '?' + query : ''));
    });
  }

  cleanLinks();
  new MutationObserver(()=>cleanLinks()).observe(document.documentElement,{childList:true,subtree:true});
})();
