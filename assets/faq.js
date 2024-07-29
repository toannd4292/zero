document.addEventListener('alpine:init', () => {
  Alpine.data(
    'ThemeSection_FAQ',
    ({ tabsCount, oneTabAtATime, firstTabOpen }) => {
      return {
        oneTabAtATime,
        firstTabOpen,
        tabOpen: {},
        init() {
          for (let i = 0; i < tabsCount; i++) {
            this.tabOpen['tab' + i] = i === 0 && firstTabOpen;
          }
        },
        openTab(index) {
          if (oneTabAtATime) {
            for (let i = 0; i < tabsCount; i++) {
              if (index !== i) {
                this.tabOpen['tab' + i] = false;
              }
            }
          }

          this.tabOpen['tab' + index] = !this.tabOpen['tab' + index];
        },
      };
    }
  );
});
