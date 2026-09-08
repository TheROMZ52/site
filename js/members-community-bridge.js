// KillZone members/community bridge — keep the legacy account members renderer from competing with the community renderer.
(function(){
  'use strict';
  window.KZ_COMMUNITY_MEMBERS_PAGE = true;
  // app.js exposes renderMembersPage globally; community.js owns the members view now.
  window.renderMembersPage = async function(){ return; };
})();
