document.addEventListener('alpine:init', () => {
  Alpine.data('QuantityStepper', () => {
    return {
      quantity: 1,
      init() {
        if (this.dropdownQuantity) {
          if (this.dropdownQuantity === '10+') {
            this.quantity = 10;
          } else {
            this.quantity = parseInt(this.dropdownQuantity, 10);
          }
        }
      },
      dispatchInputChange() {
        this.$refs.quantityInput.dispatchEvent(
          new Event('change', { bubbles: true })
        );
      },
      decreaseQuantity() {
        this.quantity > 1 && this.quantity--;
        this.dispatchInputChange();
      },
      increaseQuantity() {
        if (this.quantity < 20) {  // Lägg till denna rad
          this.quantity++;
        }
        this.dispatchInputChange();
      },
    };
  });
});
