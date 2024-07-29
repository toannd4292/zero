document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('a[href]').forEach((linkEl) => {
    if (linkEl.hostname !== location.hostname) {
      linkEl.target = '_blank';
    }
  });
});