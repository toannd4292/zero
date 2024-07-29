document.addEventListener('alpine:init', () => {
  Alpine.data('ThemeSection_DownArrow', () => {
    return {
      init() {
        this.$nextTick(() => {
          setTimeout(() => {
            this.$refs.scrollButton.classList.remove(
              'translate-y-1',
              'opacity-0'
            );
          });
        });
      },
      sctollToNextSection() {
        const nextSection = this.$el.closest('.shopify-section').nextSibling;
        if (nextSection !== null || nextSection !== undefined) {
          nextSection.scrollIntoView({
            block: 'start',
            inline: 'nearest',
            behavior: 'smooth',
          });
        }
      },
    };
  });
});
