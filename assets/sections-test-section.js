document.addEventListener('alpine:init', () => {
  Alpine.directive('ThemeSection_testSection', () => ({
    footerMessage: 'footer message',
  }))
});