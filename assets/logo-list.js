document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_LogoList', () => {
    return {
      bgColorValue: '',
      bgColorRGB: {
        r: 0,
        g: 0,
        b: 0,
      },
      bgIsDark: false,
      init() {
        this.getNewBgColor();

        this.$root.addEventListener('transitionend', () => {
          this.getNewBgColor();
        });
      },
      getNewBgColor() {
        this.bgColorValue = getComputedStyle(this.$root).backgroundColor;

        const rgbString = this.bgColorValue
          .replace('rgba(', '')
          .replace('rgb(', '')
          .replace(')', '')
          .replaceAll(',', '');

        this.bgColorRGB.r = rgbString.split(' ')[0];
        this.bgColorRGB.g = rgbString.split(' ')[1];
        this.bgColorRGB.b = rgbString.split(' ')[2];

        /**
         * Same calculation as Liquid `color_brightness` filter:
         * https://shopify.dev/api/liquid/filters#color_brightness
         *
         * cf.: https://github.com/bgrins/TinyColor/blob/2322a1a70a0cd075b98829d67dbd90228abebab4/tinycolor.js#L68
         *
         * cf.: https://www.w3.org/WAI/ER/WD-AERT/#color-contrast
         */

        const brightness =
          (this.bgColorRGB.r * 299 +
            this.bgColorRGB.g * 587 +
            this.bgColorRGB.b * 114) /
          1000;

        if (brightness < 128) {
          this.bgIsDark = true;
        } else {
          this.bgIsDark = false;
        }
      },
    };
  });
});
