import { a as api } from './shared-import-js.cookie.bundle.js';
document.addEventListener('alpine:init', () => {
  Alpine.data('ThemeSection_AgeCheck', settings => {
    return {
      authenticated: false,
      mode: settings.mode,
      date_format: settings.date_format,
      minimum_age: settings.minimum_age,
      redirect_url: settings.redirect_url,
      month: '',
      day: '',
      year: '',
      date: '',
      cookie: api.get('ageGateAuthenticated'),
      isSelected: false,
      enabled: settings.enabled,
      sectionId: settings.sectionId,

      get fullDate() {
        return `${this.month}/${this.day}/${this.year}`;
      },

      mounted() {
        // Prevent age check on Shopify robot challenge page
        if (window.location.pathname === '/challenge') return;
        initTeleport(this.$root);
        Alpine.store('modals').register('ageCheck', 'modal');

        if (!Shopify.designMode) {
          if (this.cookie !== 'true') {
            Alpine.store('modals').open('ageCheck');
          }
        } else {
          if (window.theme.designMode.selected === this.sectionId) {
            if (this.enabled === true) {
              Alpine.store('modals').open('ageCheck');
            } else {
              // It might be open from a previous instantiation
              Alpine.store('modals').close('ageCheck');
            }
          }

          document.addEventListener('shopify:section:select', e => {
            if (!e.target.contains(this.$root)) return;
            if (!this.enabled) return;
            Alpine.store('modals').open('ageCheck');
          });
          document.addEventListener('shopify:section:deselect', e => {
            if (!e.target.contains(this.$root)) return;
            this.$store.modals.close('ageCheck');
          });
        }

        if (this.redirect_url === null) {
          this.redirect_url = 'https://www.google.com';
        }

        if (this.mode === 'dob') {
          this.date = new Date();
          setTimeout(() => this.setUpDOB(), 100);
        }
      },

      approveEntry() {
        Alpine.store('modals').close('ageCheck');

        if (this.isSelected) {
          api.remove('ageGateAuthenticated');
          return;
        }

        api.set('ageGateAuthenticated', 'true', {
          expires: 30
        });
      },

      denyEntry() {
        window.location = this.redirect_url;
      },

      checkInput(name) {
        switch (name) {
          case 'day':
            return parseInt(this.day) > 0 && parseInt(this.day) < 32 ? true : false;

          case 'month':
            return parseInt(this.month) > 0 && parseInt(this.month) < 13 ? true : false;

          case 'year':
            return parseInt(this.year) < this.date.getFullYear() && parseInt(this.year) > 1900 ? true : false;
        }

        return true;
      },

      checkAge() {
        const current_date = Math.round(this.date.getTime() / 1000);
        const entered_date = Math.round(new Date(`${this.fullDate}`).getTime() / 1000);
        const difference = Math.floor((current_date - entered_date) / 31536000);

        if (difference > parseInt(this.minimum_age, 10)) {
          this.approveEntry();
        } else {
          this.denyEntry();
        }
      },

      setUpDOB() {
        const container = document.getElementById('dob-form');
        container.addEventListener('input', e => {
          const target = e.srcElement || e.target;
          const maxLength = parseInt(target.attributes['maxlength'].value, 10);
          const targetLength = target.value.length;

          if (targetLength >= maxLength) {
            const valid = this.checkInput(target.getAttribute('name'));

            if (!valid) {
              target.value = '';
              return false;
            }

            let next = target.closest('.input-grid-item');

            while (next = next.nextElementSibling) {
              if (next == null) break;
              let input = next.querySelector('input');

              if (input !== null) {
                input.focus();
                break;
              }
            }
          } // Move to previous field if empty (user pressed backspace)
          else if (targetLength === 0) {
            let previous = target.closest('.input-grid-item');

            while (previous = previous.previousElementSibling) {
              if (previous == null) break;
              const input = previous.querySelector('input');

              if (input !== null) {
                input.focus();
                break;
              }
            }
          }

          if (this.checkInput('day') && this.checkInput('month') && this.checkInput('year')) {
            setTimeout(() => this.checkAge(), 500);
          }
        });
      }

    };
  });
});
