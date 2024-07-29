let availabilityStoreRegistered = false,
  availabilityContextRegistered = false;

const registerAvailabilityStore = () => {
  if (availabilityStoreRegistered) return;

  Alpine.store('availability', {
    loading: false,
    current_variant: null,
    availability: {},
  });

  availabilityStoreRegistered = true;
};

const registerAvailabilityContext = () => {
  if (availabilityContextRegistered) return;

  const productIDs = [];

  Alpine.data('ThemeComponent_StoreAvailabilityDrawer', (productID) => {
    return {
      init() {
        if (productID) {
          if (productIDs.includes(productID)) {
            // Drawer contents for product already set up in
            // another product form
            this.$root.remove();
            return;
          }

          productIDs.push(productID);
        }

        Alpine.store('modals').register('availability', 'rightDrawer');

        initTeleport(this.$root);
      },
      get currentVariantAvailabilityList() {
        // this is on a lag to the actual current variant so that we can display an intermediary state while the fetch request is happening
        if (window.Alpine.store('availability').current_variant) {
          const id = window.Alpine.store('availability').current_variant;
          const storeData = window.Alpine.store('availability').availability[
            id
          ];
          if (storeData) {
            return storeData.list;
          }
        }
        return [];
      },
    };
  });

  availabilityContextRegistered = true;
}

document.addEventListener('alpine:init', () => {
  registerAvailabilityStore();
  registerAvailabilityContext();
});

document.addEventListener('cascade:productquickbuy:willadd', () => {
  registerAvailabilityStore();
  registerAvailabilityContext();
});
