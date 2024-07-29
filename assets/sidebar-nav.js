document.addEventListener('alpine:init', () => {
  Alpine.data('ThemeSection_SidebarNav', () => {
    return {
      init() {
        initTeleport(this.$root);
        Alpine.store('modals').register('mobile-sidebar-nav', 'leftDrawer');
      },
    };
  });
});
