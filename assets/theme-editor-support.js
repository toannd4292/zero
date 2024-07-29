/**
 *
 */

window.theme.designMode = window.theme.designMode || {};
window.theme.designMode.selected = '';

document.addEventListener('shopify:section:select', (e) => {
  window.theme.designMode.selected = e.detail.sectionId;
});

document.addEventListener('shopify:section:deselect', () => {
  window.theme.designMode.selected = '';
});

/**
 * Observe mutations in sections and fire an event
 * when they are added, removed, reordered or
 * have blocks added, removed, or reordered
 */

// const mainContent = document.getElementById('MainContent');

// window.mainContentMO = new MutationObserver(() => {
//   document.body.dispatchEvent(
//     new CustomEvent('cascade:childlistmutation:main', { bubbles: true })
//   );
// });

// window.mainContentMO.observe(mainContent, { childList: true });

/**
 * XR Button management
 */

document.addEventListener('shopify:section:load', (e) => {
  if (!e.target.querySelector('[data-shopify-xr-hidden]')) return;

  document
    .querySelectorAll('[data-shopify-xr-hidden]')
    .forEach((element) => element.classList.add('hidden'));
});

/**
 * Slideshow management
 */

document.addEventListener('shopify:section:load', (e) => {
  if (!e.target.querySelector('.splide')) return;

  e.target.querySelectorAll('.splide').forEach((splideRoot) => {
    makeSlideshow(splideRoot);
  });
});

document.addEventListener('shopify:section:unload', (e) => {
  if (!e.target.querySelector('.splide')) return;

  e.target.querySelectorAll('.splide').forEach((splideRoot) => {
    destroySlideshow(splideRoot);
  });
});

document.addEventListener('shopify:block:select', (e) => {
  if (!e.target.matches('.splide__slide')) return;

  const block = e.target,
    splideRoot = e.target.closest('.splide'),
    slideshowSplide = window.slideshows[splideRoot.id];

  const slideIndex = Array.from(
    block.closest('.splide__list').children
  ).indexOf(block);

  if (splideIsNotDestroyed(splideRoot)) {
    slideshowSplide.go(slideIndex);
  }
});

/**
 * Sidebar management
 */

document.addEventListener('shopify:section:select', (e) => {
  if (!e.target.querySelector('[x-data="ThemeSection_SidebarNav"]')) return;

  Alpine.store('modals').open('mobile-sidebar-nav');
});

document.addEventListener('shopify:section:deselect', (e) => {
  if (!e.target.querySelector('[x-data="ThemeSection_SidebarNav"]')) return;

  Alpine.store('modals').close('mobile-sidebar-nav');
});

/**
 * Responsive block management
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_BlockRoot', (mediaQuery) => {
    return {
      mql: null,
      blockRootShown: false,
      init() {
        if (!mediaQuery) {
          this.blockRootShown = true;
          return;
        }

        this.mql = window.matchMedia(mediaQuery);
        this.blockRootShown = this.mql.matches;

        this.mql.addEventListener('change', (e) => {
          this.blockRootShown = e.matches;
        });
      },
    };
  });
});
