if (!window.theme.cascadeAnimationsInitialized) {
  Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (
      ((this - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
    );
  };

  class CascadeAnimations {
    setPosition() {
      let oldPosition = this.position;
      this.position =
        (document.documentElement || document.body.parentNode || document.body)
          .scrollTop || window.pageYOffset;

      if (oldPosition != this.position) {
        // scroll changed, return true
        return true;
      }
      return false;
    }

    updatePosition(percentage, speed) {
      let value = speed * (100 * (1 - percentage));
      return Math.round(value);
    }

    cacheParallaxContainers() {
      for (var i = 0; i < this.parallaxContainers.length; i++) {
        var item = this.createParallaxItem(this.parallaxContainers[i]);
        this.parallaxItems.push(item);
      }
    }

    inViewport(element) {
      if (!element) return false;
      if (1 !== element.nodeType) return false;

      var html = document.documentElement;
      var rect = element.getBoundingClientRect();

      return (
        !!rect &&
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.left <= html.clientWidth &&
        rect.top <= html.clientHeight
      );
    }

    createParallaxItem(el) {
      const id = el.getAttribute('data-parallax-id');
      const container = el;
      const item = el.querySelector('[data-parallax-element]');
      let speed = parseInt(el.getAttribute('data-parallax-speed'));

      speed = speed * -1;

      const blockHeight =
        item.clientHeight || item.offsetHeight || item.scrollHeight;
      const isInViewPort = this.inViewport(el);

      return {
        id: id,
        container: container,
        item: item,
        height: blockHeight,
        speed: speed,
        visible: isInViewPort,
        item: item,
      };
    }

    observeCascadeItems(enable_parallax, enable_fade_in) {
      if (enable_parallax) {
        this.parallaxObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (this.enable_parallax) {
                const parallaxItemIndex = this.parallaxItems.findIndex(
                  (item) =>
                    item.id === entry.target.getAttribute('data-parallax-id')
                );
                if (parallaxItemIndex > -1) {
                  this.parallaxItems[parallaxItemIndex].visible =
                    entry.isIntersecting;
                }
              }
            });
          },
          {
            rootMargin: '0px 0px 20% 0px',
            threshold: 0,
          }
        );
      }

      if (enable_fade_in) {
        this.revealObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.intersectionRatio !== 0) {
                entry.target.classList.add('revealed');
              }
            });
          },
          {
            rootMargin: '0px 0px -20% 0px',
            threshold: 0,
          }
        );
      }

      for (var i = 0; i < this.cascadeItems.length; i++) {
        if (enable_parallax) {
          this.parallaxObserver.observe(this.cascadeItems[i]);
        }
        if (enable_fade_in) {
          this.revealObserver.observe(this.cascadeItems[i]);
        }
      }
    }

    animate() {
      for (var i = 0; i < this.parallaxContainers.length; i++) {
        if (this.parallaxItems[i].visible) {
          const scrollPercentage =
            (this.screenHeight -
              this.parallaxItems[i].item.getBoundingClientRect().top) /
              (this.screenHeight + this.parallaxItems[i].height) -
            0.5;

          const baseValue =
            this.intensity *
            (this.parallaxItems[i].speed * (scrollPercentage * 100));

          const valueY = Math.round(baseValue * 100 + Number.EPSILON) / 100;

          this.parallaxItems[
            i
          ].item.style.transform = `translateY(${valueY}px)`;
        }
      }
      this.firstAnimate = true;
    }

    initParallax() {
      this.screenHeight = window.innerHeight;
      this.parallaxItems = [];
      this.parallaxContainers = document.querySelectorAll(
        '[data-parallax-container]'
      );
      this.setPosition();
      this.cacheParallaxContainers();

      this.intensity =
        window.theme.settings.cascade_parallax_intensity.map(0, 100, 1, 110) /
        100;

      this.animate();
      document.addEventListener(
        'scroll',
        () => {
          if (this.setPosition()) {
            requestAnimationFrame(this.animate.bind(this));
          }
        },
        { passive: true }
      );
    }

    init() {
      this.enable_parallax = window.theme.settings.cascade_enable_parallax;
      this.enable_fade_in = window.theme.settings.cascade_fade_in_items;
      this.cascadeItems = document.querySelectorAll('[data-cascade-item]');
      this.observeCascadeItems(this.enable_parallax, this.enable_fade_in);
      if (this.enable_parallax) {
        this.initParallax();
      }

      window.addEventListener('resize', () => {
        if (this.enable_parallax) {
          this.initParallax();
        }
      });

      window.addEventListener(
        'cascade:section:hasmutated',
        debounce(() => {
          this.init();
        }, 300)
      );
    }
  }

  const cascadeAnimations = new CascadeAnimations();

  if (
    window.theme.settings.cascade_enable_parallax ||
    window.theme.settings.cascade_fade_in_items
  ) {
    if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      document.addEventListener('DOMContentLoaded', function () {
        cascadeAnimations.init();
      });

      document.addEventListener('shopify:section:load', () => {
        cascadeAnimations.init();
      });

      const mutationHandler = debounce(() => {
        cascadeAnimations.init();
      }, 500);

      document.addEventListener('dev:hotreloadmutation', mutationHandler);
    }
  }
}

window.theme.cascadeAnimationsInitialized = true;
