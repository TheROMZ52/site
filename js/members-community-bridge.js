// KillZone members/community bridge — legacy refresh requests now refresh the community page safely.
(function(){
  'use strict';
  window.KZ_COMMUNITY_MEMBERS_PAGE = true;
  window.renderMembersPage = async function(){
    window.dispatchEvent(new CustomEvent('kz:community-refresh'));
  };
})();
