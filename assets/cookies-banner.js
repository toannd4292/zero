document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_CookiesBanner', (settings) => {
    return {
      ShopifyCustomerPrivacy: null,
      shown: false,
      enabled: settings.enabled,
      sectionId: settings.sectionId,
      init() {
        if (!Shopify.designMode) {
          Shopify.loadFeatures(
            [
              {
                name: 'consent-tracking-api',
                version: '0.1',
              },
            ],
            (error) => {
              if (error) {
                throw error;
              }

              this._setUp();
            }
          );
        } else {
          if (window.theme.designMode.selected === this.sectionId) {
            if (this.enabled === true) {
              setTimeout(() => {
                this.shown = true;
              }, 200);
            } else {
              // It might be open from a previous instantiation
              setTimeout(() => {
                this.shown = false;
              }, 200);
            }
          }

          document.addEventListener('shopify:section:select', (e) => {
            if (!e.target.contains(this.$root)) return;

            if (!this.enabled) return;

            this.shown = true;
          });

          document.addEventListener('shopify:section:deselect', (e) => {
            if (!e.target.contains(this.$root)) return;

            this.shown = false;
          });
        }
      },
      _setUp() {
        this.ShopifyCustomerPrivacy = window.Shopify.customerPrivacy;

        const userCanBeTracked = this.ShopifyCustomerPrivacy.userCanBeTracked();
        const userTrackingConsent =
          this.ShopifyCustomerPrivacy.getTrackingConsent();

        if (!userCanBeTracked && userTrackingConsent === 'no_interaction' && this.enabled) {
          this.shown = true;
        }
      },
      accept() {
        this.ShopifyCustomerPrivacy.setTrackingConsent(
          true,
          () => (this.shown = false)
        );
      },
      decline() {
        this.ShopifyCustomerPrivacy.setTrackingConsent(
          false,
          () => (this.shown = false)
        );
      },
    };
  });
});
