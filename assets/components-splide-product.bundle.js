import { E as EventInterface } from './shared-import-splide.esm.bundle.js';

function SplideProduct(Splide) {
  const {
    on,
    off,
    bind,
    unbind
  } = EventInterface(Splide);
  Splide.root.addEventListener('click', event => {
    if (event.target.classList.contains('splide__pagination__page')) {
      Splide.paginationClicked = true;
    }
  });

  function _goToFirstSlideForMediaWithId(mediaId) {
    const targetSlides = Splide.Components.Slides.filter(slide => slide.slide.dataset.mediaId === mediaId.toString());
    if (!targetSlides.length) return;
    Splide.go(targetSlides[0].index);
  }

  bind(document.body, 'cascade:product:variantchange', e => {
    if (!e.target.contains(Splide.root)) return;

    if (e.detail.variant.featured_media !== undefined) {
      const mediaId = e.detail.variant.featured_media.id;

      _goToFirstSlideForMediaWithId(mediaId);
    }
  });

  function _resizeTrackForSlideAtIndex(index) {
    const slides = Splide.Components.Slides;
    const targetSlideObject = slides.getAt(index);
    if (!targetSlideObject) return;
    const targetSlide = targetSlideObject.slide;
    const targetSlideMedia = targetSlide.querySelector('[data-product-single-media-wrapper]'); // Splide.root.dispatchEvent(new CustomEvent('productSplideChange'));

    Splide.root.querySelector('.splide__track').style.maxHeight = targetSlideMedia.offsetHeight + 'px';
  }

  const resizeHandler = e => {
    _resizeTrackForSlideAtIndex(Splide.index);
  };

  const _debouncedResizeHandler = debounce(resizeHandler, 150);

  bind(window, 'resize', _debouncedResizeHandler);

  function handleDestroy() {
    Splide.root.querySelectorAll('[aria-hidden]').forEach(ariaHiddenEl => {
      ariaHiddenEl.removeAttribute('aria-hidden');
    });
    unbind(document.body, 'cascade:product:variantchange');
  }

  function handleMounted() {
    if (Splide.root.dataset.firstMedia) {
      if (Splide.splides) {
        // If there are synced splides (e.g. thumbnails),
        // wait for them to mount before going to the first slide
        const mountPromises = [];

        for (const syncedSplide of Splide.splides) {
          const mountPromise = new Promise((resolve, reject) => {
            syncedSplide.on('mount', resolve());
          });
          mountPromises.push(mountPromise);
        }

        Promise.all(mountPromises).then(() => {
          _goToFirstSlideForMediaWithId(Splide.root.dataset.firstMedia);
        });
      } else {
        _goToFirstSlideForMediaWithId(Splide.root.dataset.firstMedia);
      }
    }

    _resizeTrackForSlideAtIndex(Splide.index);
  }

  function handleMoved(newIndex, oldIndex) {
    const slides = Splide.Components.Slides;
    const oldSlide = slides.getAt(oldIndex).slide.querySelector('[data-product-single-media-wrapper]');
    const newSlide = slides.getAt(newIndex).slide.querySelector('[data-product-single-media-wrapper]');
    if (oldSlide) oldSlide.dispatchEvent(new CustomEvent('mediaHidden'));
    if (newSlide && !!newSlide.offsetHeight) newSlide.dispatchEvent(new CustomEvent('mediaVisible'));
  }

  function handleMove(newIndex
  /* , oldIndex */
  ) {
    _resizeTrackForSlideAtIndex(newIndex);
  }

  return {
    mount() {
      on('mounted', handleMounted);
      on('moved', handleMoved);
      on('move', handleMove);
      on('destroy', handleDestroy);
    }

  };
}

export { SplideProduct };
