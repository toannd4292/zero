document.addEventListener('alpine:init', () => {
  Alpine.data('QuantityDropdown', () => {
    return {
      dropdownQuantity: '1',
      enableNumberInput: false,
      init() {
        this.$watch('dropdownQuantity', (value) => {
          // Begränsa antalet produkter till 20
          if (parseInt(value) > 20) {
            this.dropdownQuantity = '20';
          }

          if (value === '10+') {
            this.enableNumberInput = true;

            this.$nextTick(() => {
              const numberInputEl =
                this.$root.querySelector('[name="quantity"]');

              this.$focus.focus(numberInputEl);
              numberInputEl.select();

            });
          }
        });
      },
    };
  });
});
