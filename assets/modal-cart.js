document.addEventListener('alpine:init', () => {
  Alpine.data('ThemeModule_ModalCart', ({ openOnAddToCart }) => {
    return {
      init() {
        if (openOnAddToCart === true) {
          document.body.addEventListener(
            'cascade:modalcart:afteradditem',
            () => {
              Alpine.store('modals').open('cart');
            }
          );
        }

        Alpine.store('modals').register('cart', 'rightDrawer');
      },
    };
  });
});
