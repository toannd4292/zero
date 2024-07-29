window['Theme_Product'] = ({
  product,
  variant,
  featuredMediaID,
  enableImageZoom = false,
}) => {
  return {
    productForms: null,
    productRoot: null,
    product: product,
    current_variant: variant,
    featured_media_id: featuredMediaID,
    current_media_id: featuredMediaID,
    loading: false,
    quantity: '1',
    optionHandles: [],
    storeAvailability: null,
    addedToCart: false,
    stickyAddToCartShown: false,
    variantChanged: false,
    updateStoreAvailability: null,
    video_in_view: false,
    currentOption1: variant.option1,
    currentOption2: variant.option2,
    currentOption3: variant.option3,
    get options() {
      let arr = [];
      if (this.currentOption1) {
        arr.push(this.currentOption1);
      }
      if (this.currentOption2) {
        arr.push(this.currentOption2);
      }
      if (this.currentOption3) {
        arr.push(this.currentOption3);
      }
      return arr;
    },
    get currentVariantId() {
      if (this.current_variant) {
        return this.current_variant.id;
      } else {
        return null;
      }
    },
    get currentVariantAvailabilityClosestLocation() {
      // this is on a lag to the actual current variant so that we can display an intermediary state while the fetch request is happening
      if (!Alpine.store('availability')) return null;

      const id = this.currentVariantId;
      const storeData = Alpine.store('availability').availability[id];

      if (storeData) {
        return storeData.closest_location;
      } else {
        return null;
      }
    },
    get currentVariantAvailable() {
      if (this.current_variant) {
        return this.current_variant.available;
      } else {
        return null;
      }
    },
    get currentVariantTitle() {
      if (this.current_variant && this.current_variant.title) {
        if (!this.current_variant.title.includes('Default')) {
          return this.current_variant.title;
        }
      }
      return '';
    },
    get current_price() {
      return this.current_variant.price;
    },
    get isUsingSlideshowToDisplayMedia() {
      const splideEl = this.productRoot.querySelector('.splide');

      return splideIsNotDestroyed(splideEl);
    },
    formatMoney(price, moneyFormat = theme.defaultMoneyFormat) {
      return formatMoney(price, moneyFormat);
    },
   init() {
  this.productRoot = this.$root;
  this.updateStoreAvailability = debounce(
    this.__updateStoreAvailability.bind(this),
    150
  );

  this.productForm = this.$root.querySelector('[data-product-form-container]');
  if (theme.settings.cart_type === 'drawer') {
    const formEl = this.productForm.querySelector('.product-form');
    formEl.addEventListener('submit', this.submitForm.bind(this));
  }

  const addToCartBtnEl = this.$root.querySelector('.add-to-cart-btn');
  if (addToCartBtnEl.offsetHeight) {
    document.documentElement.style.setProperty(
      '--add-to-cart-button-height',
      `${addToCartBtnEl.offsetHeight}px`
    );
  }

  this.getOptionHandles();

  this.$root.addEventListener('cascade:product:slidechange', (e) => {
    this.current_media_id = parseInt(e.detail.current_media_id);
  });

  this.$watch('current_media_id', (value, oldValue) => {
    const currentMediaObject = this.product.media.filter((media) => {
      return media.id === value;
    });

    this.video_in_view =
      currentMediaObject[0].media_type === 'video' ||
      currentMediaObject[0].media_type === 'external_video'
        ? true
        : false;

    if (this.isUsingSlideshowToDisplayMedia) return;

    this.$root
      .querySelectorAll(`[data-product-single-media-wrapper="${oldValue}"]`)
      .forEach((mediaWrapperEl) => {
        if (mediaWrapperEl.offsetHeight) {
          mediaWrapperEl.dispatchEvent(new CustomEvent('mediaHidden'));
        }
      });
    this.$root
      .querySelectorAll(`[data-product-single-media-wrapper="${value}"]`)
      .forEach((mediaWrapperEl) => {
        if (mediaWrapperEl.offsetHeight) {
          mediaWrapperEl.dispatchEvent(new CustomEvent('mediaVisible'));
        }
      });
  });

  // Watch for changes to the current variant and update the UI accordingly
  this.$watch('current_variant', (newVariant) => {
    this.updateAvailabilityMessage(newVariant);
  });

  // Initial update for the default variant
  this.updateAvailabilityMessage(this.current_variant);

  this.updateStoreAvailability(this.current_variant);
},

// Function to update the availability message based on the variant's availability
updateAvailabilityMessage(variant) {
  const addToCartBtn = this.$root.querySelector('.add-to-cart-btn');
  if (!variant.available) {
    // Variant is sold out
    addToCartBtn.textContent = 'Sold Out - kommer snart';
    addToCartBtn.disabled = true;
  } else {
    // Variant is available
    addToCartBtn.textContent = 'KÖP NU'; // Replace with your original text for the available button
    addToCartBtn.disabled = false;
  }
},

getOptionHandles() {
  // Your existing logic to get option handles
},

__updateStoreAvailability(variant) {
  // Your existing logic to update store availability
},

submitForm(evt) {
  // Your existing logic to handle form submission
},

isUsingSlideshowToDisplayMedia() {
  // Your existing logic to check if using a slideshow to display media
},

//... any other methods or properties ...

    __updateStoreAvailability(variant) {
      if (!this.$refs.storeAvailabilityContainer) return;

      this.storeAvailability =
        this.storeAvailability ||
        new StoreAvailability(this.$refs.storeAvailabilityContainer);

      if (this.storeAvailability && variant) {
        this.storeAvailability.fetchContent(variant);
      }
    },
    optionChange() {
      this.getOptionHandles();

      const matchedVariant = ShopifyProduct.getVariantFromOptionArray(
        this.product,
        this.options
      );

      this.current_variant = matchedVariant;

      if (this.current_variant) {
        variantLiveRegion(this.current_variant);
        this.updateStoreAvailability(this.current_variant);

        if (this.current_variant.featured_media) {
          this.current_media_id = this.current_variant.featured_media.id;
        }

        const url = ShopifyProductForm.getUrlWithVariant(
          window.location.href,
          this.current_variant.id
        );

        this.$root.dispatchEvent(
          new CustomEvent('product-url-update', {
            bubbles: true,
            detail: { url: url },
          })
        );

        const inFormNameEl =
          this.$refs.singleVariantSelector || this.$refs.productFormNameField;

        inFormNameEl.dispatchEvent(new Event('change', { bubbles: true }));

        this.$root.dispatchEvent(
          new CustomEvent('cascade:product:variantchange', {
            bubbles: true,
            detail: { variant: this.current_variant },
          })
        );

        this.variantChanged = true;
      }
    },
    getOptionHandles() {
      this.optionHandles = [];

      const selectorEl = this.productForm.querySelectorAll(
        '[data-single-option-selector]'
      );

      if (selectorEl.nodeName === 'SELECT') {
        this.optionHandles.push(
          selectorEl.options[selectorEl.selectedIndex].dataset.handle
        );
      } else {
        if (selectorEl.checked) {
          this.optionHandles.push(selectorEl.dataset.handle);
        }
      }
    },
    submitForm(evt) {
      evt.preventDefault();
      this.loading = true;

      liveRegion(window.theme.strings.loading);

      const formData = new FormData(evt.target);
      const formId = evt.target.getAttribute('id');

      let modalCart = theme.settings.cart_type === 'drawer';

      const config = fetchConfigDefaults('javascript');

      if (modalCart) {
        formData.append('sections', 'cart-items,cart-footer,cart-item-count');
        formData.append('sections_url', window.location.pathname);
      }

      config.body = formData;

      config.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete config.headers['Content-Type'];

      fetch(`${theme.routes.cart_add_url}`, config)
        .then((res) => res.json())
        .then((data) => {
          if (data.status) {
            this.loading = false;
            document.body.dispatchEvent(
              new CustomEvent('cascade:cart:adderror', {
                detail: {
                  source: 'product-form',
                  sourceId: formId,
                  variantId: formData.get('id'),
                  errors: data.description,
                  errorMessage: data.message,
                },
              })
            );
            return;
          }

          this.loading = false;
          this.addedToCart = true;

          if (modalCart) {
            document.body.dispatchEvent(
              new CustomEvent('cascade:modalcart:afteradditem', {
                bubbles: true,
                detail: { response: data },
              })
            );
          }

          if (!document.querySelector('[data-show-on-add="true"]')) {
            if (this.$refs.added)
              this.$nextTick(() => this.$refs.added.focus());
          }
        })
        .catch((error) => {
          console.log(error);
        });
    },
    openZoom(mediaId) {
      const zoomModalId = `image-zoom-${this.productRoot.id}`;

      if (!this.$store.modals.modals[zoomModalId]) {
        this.$store.modals.register(zoomModalId, 'modal');
      }

      this.$watch('$store.modals.modal.contents', (val) => {
        if (val === zoomModalId) {
          this.$nextTick(() => {
            const zoomModalEl = document.getElementById(zoomModalId);

            waitForContent(zoomModalEl).then(() => {
              const mediaEl = zoomModalEl.querySelector(
                `[data-media-id="${mediaId}"]`
              );

              if (mediaEl) {
                mediaEl.scrollIntoView();
              }
            });
          });
        }
      });

      this.$store.modals.open(zoomModalId);
    },
  };
};
