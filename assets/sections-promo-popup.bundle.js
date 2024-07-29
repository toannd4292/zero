import { a as api } from './shared-import-js.cookie.bundle.js';
document.addEventListener('alpine:init', () => {
  Alpine.data('ThemeSection_PromoPopup', settings => {
    return {
      delay: settings.delay,
      frequency: settings.frequency,
      enabled: settings.enabled,
      sectionId: settings.sectionId,
      cookie: api.get('promoPopup'),

      mounted() {
        // Prevent popup on Shopify robot challenge page
        if (window.location.pathname === '/challenge') return;
        initTeleport(this.$root);
        Alpine.store('modals').register('promoPopup', 'promo');
        document.body.addEventListener('promo-is-closed', e => {
          api.set('promoPopup', 'opened', {
            path: '/',
            expires: this.frequency
          });
        });

        if (this.$root.querySelectorAll('.errors,.form-message').length > 0) {
          this.open();
        }

        if (this.$root.querySelectorAll('.form-message').length > 0) {
          api.set('promoPopup', 'opened', {
            path: '/',
            expires: 200
          });
        }

        if (!Shopify.designMode) {
          if (this.cookie !== 'opened') {
            setTimeout(() => {
              this.open();

              const escapeHandler = e => {
                if (e.code.toUpperCase() !== 'ESCAPE') return;
                this.$store.modals.close('promoPopup');
                document.body.removeEventListener('keydown', escapeHandler);
              };

              document.body.addEventListener('keydown', escapeHandler);
            }, this.delay * 1000);
          }
        } else {
          if (window.theme.designMode.selected === this.sectionId) {
            if (this.enabled === true) {
              this.open();
            } else {
              // It might be open from a previous instantiation
              Alpine.store('modals').close('promoPopup');
            }
          }

          document.addEventListener('shopify:section:select', e => {
            if (!e.target.contains(this.$root)) return;
            if (!this.enabled) return;
            this.open();
          });
          document.addEventListener('shopify:section:deselect', e => {
            if (!e.target.contains(this.$root)) return;
            this.$store.modals.close('promoPopup');
          });
        }
      },

      open() {
        this.$store.modals.open('promoPopup');
        this.$focus.first();
      }

    };
  });
});
