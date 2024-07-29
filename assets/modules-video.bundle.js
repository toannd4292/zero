import { L as LibraryLoader } from './shared-import-index.bundle.js';

window['ThemeModule_Video'] = (id, type, host, autoplay) => {
  return {
    enabled: false,
    shown: false,
    id: id,
    type: type,
    host: host,
    autoplay: autoplay,
    youtubeReady: false,
    productMediaWrapper: null,
    ytPlayer: null,
    vimeoPlayer: null,
    playing: false,

    init() {
      const isSplide = this.$el.closest('.splide');

      if (isSplide !== null) {
        this.id = this.id + '--splide';
      }

      this.$watch('enabled', value => {
        this.$nextTick(() => {
          this.shown = value;
        });
      });
      document.addEventListener('touchstart', function () {
        window.setTouch();
      });
      document.body.addEventListener('pauseAllMedia', e => {
        if (e.detail !== null) {
          if (e.detail.id !== this.id) {
            this.pause();
          }
        } else {
          this.pause();
        }
      }); // check if this is product media

      this.productMediaWrapper = this.$root.closest('[data-product-single-media-wrapper]');

      if (this.productMediaWrapper !== null) {
        this.setUpProductMediaListeners();
        this.setUpMatchMedia();
      } else {
        if (this.autoplay) {
          this.enableVideo();
        }
      }
    },

    enableVideo() {
      this.enabled = true;
      this.$nextTick(() => {
        if (this.type === 'video') {
          const video = this.$root.querySelector('.video');

          video.onplay = () => {
            this.playing = true;
            this.dispatchPauseEvent();
          };
        } else {
          if (this.host === 'youtube') {
            const youtubeFrame = this.$root.querySelector('.js-youtube');

            const initYTPlayer = () => {
              this.ytPlayer = new YT.Player(youtubeFrame, {
                events: {
                  onStateChange: function (e) {
                    if (e.data === 1) {
                      this.playing = true;
                      this.dispatchPauseEvent();
                    }
                  }.bind(this)
                }
              });
            };

            if (typeof YT !== 'undefined') {
              initYTPlayer();
            } else {
              document.body.addEventListener('youtubeiframeapiready', () => {
                this.youtubeReady = true;
                initYTPlayer();
              });
              LibraryLoader.load('youtubeSdk');
            }
          }

          if (this.host === 'vimeo') {
            const vimeoFrame = this.$root.querySelector('.js-vimeo');

            const initVimeoPlayer = () => {
              this.vmPlayer = new Vimeo.Player(vimeoFrame);
              Alpine.raw(this.vmPlayer).on('play', () => {
                this.playing = true;
                this.dispatchPauseEvent();
              });
            };

            if (typeof Vimeo !== 'undefined') {
              initVimeoPlayer();
            } else {
              // Unlike the YouTube API, Vimeo does not
              // offer a 'ready' event so initing in a callback
              // to LibraryLoader.load()
              LibraryLoader.load('vimeoSdk', () => {
                if (typeof Vimeo !== 'undefined') {
                  initVimeoPlayer();
                } else {
                  // This is a safety fallback: if Vimeo is still undefined,
                  // will check every 300 ms and timeout after ~ 2 seconds
                  let attempts = 0;
                  const vimeoInterval = setInterval(() => {
                    if (typeof Vimeo !== 'undefined') {
                      clearInterval(vimeoInterval);
                      initVimeoPlayer();
                    } else {
                      attempts++;

                      if (attempts === 7) {
                        // give up
                        clearInterval(vimeoInterval);
                      }
                    }
                  }, 300);
                }
              });
            }
          }
        }
      });
    },

    dispatchPauseEvent() {
      document.body.dispatchEvent(new CustomEvent('pauseAllMedia', {
        detail: {
          id: this.id
        }
      }));
    },

    pause() {
      if (!this.enabled) {
        return false;
      }

      if (this.type === 'video') {
        this.$root.querySelector('video').pause();
      } else {
        switch (this.host) {
          case 'youtube':
            this.ytPlayer.pauseVideo();
            break;

          case 'vimeo':
            Alpine.raw(this.vmPlayer).pause();
            break;
        }
      }

      this.playing = false;
    },

    play() {
      if (!this.enabled) {
        return false;
      }

      if (this.type === 'video') {
        this.$root.querySelector('video').play();
      } else {
        switch (this.host) {
          case 'youtube':
            this.ytPlayer.playVideo();
            break;

          case 'vimeo':
            Alpine.raw(this.vmPlayer).play();
            break;
        }
      }

      this.playing = true;
      this.dispatchPauseEvent();
    },

    setUpProductMediaListeners() {
      this.productMediaWrapper.addEventListener('mediaHidden', () => {
        this.pause();
      });
      this.productMediaWrapper.addEventListener('xrLaunch', () => {
        this.pause();
      });
      this.productMediaWrapper.addEventListener('mediaVisible', () => {
        if (window.isTouch()) return;

        if (!this.enabled && this.autoplay) {
          this.enableVideo();
        } else {
          this.play();
        }
      });
    },

    setUpMatchMedia() {
      const mql = window.matchMedia('(min-width: 768px)');

      const screenChange = () => {
        if (this.$el.offsetParent === null) {
          this.pause();
        }
      };

      mql.addEventListener('change', screenChange);
    }

  };
};
