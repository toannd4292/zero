document.addEventListener('alpine:init', () => {
  Alpine.data('ThemeComponent_PredictiveSearch', (resources) => {
    return {
      rootEl: null,
      cachedResults: {},
      loading: false,
      rawQuery: '',
      results: false,
      resultsMarkup: null,
      showViewAll: false,
      _currentResultsGroup: '',
      resources: resources,
      get currentResultsGroup() {
        return this._currentResultsGroup;
      },
      set currentResultsGroup(newValue) {
        if (newValue === '') {
          this._currentResultsGroup = newValue;
          return;
        }

        if (this._currentResultsGroup === '') {
          if (this.$refs[`${newValue}Results`]) {
            this.$refs[`${newValue}Results`].hidden = false;
          }

          this._currentResultsGroup = newValue;
          return;
        }

        const currentResultsGroupEl =
          this.$refs[`${this._currentResultsGroup}Results`];

        this._currentResultsGroup = newValue;

        const nextResultsGroupEl = this.$refs[`${newValue}Results`];

        this.switchResultsGroup(currentResultsGroupEl, nextResultsGroupEl);
      },
      get trimmedQuery() {
        return this.rawQuery.trim();
      },
      get shouldAnimate() {
        return window.matchMedia('(prefers-reduced-motion: no-preference)')
          .matches;
      },
      init() {
        this.rootEl = this.$root;

        this.cachedResults = {};

        const toggles = document.querySelectorAll('[data-open-search]');
        toggles.forEach((toggle) => {
          toggle.setAttribute('role', 'button');
        });

        document.addEventListener('keyup', (event) => {
          if (event.key === 'Escape') {
            this.close(false, true);
            setTimeout(() => this.$refs.input.focus(), 100);
          }
        });

        this.$watch('results', async (value) => {
          if (value === true) {
            this.$refs.results.hidden = false;
            this.showViewAll = true;
          } else {
            if (this.shouldAnimate) {
              const keyframes = {
                opacity: [1, 0],
              };
              const options = {
                duration: 200,
                easing: 'ease',
              };
              await Promise.all([
                this.$refs.results.animate(keyframes, options).finished,
                this.$refs.viewAll.animate(keyframes, options).finished,
              ]);
            }

            this.$refs.results.hidden = true;
            this.showViewAll = false;
          }
        });
      },
      close(clearSearchTerm = false, closeButton = false) {
        const instant = this.rawQuery.trim().length === 0 && clearSearchTerm;

        if (clearSearchTerm) {
          this.rawQuery = '';
          this.results = false;
        }

        if (closeButton) {
          setTimeout(
            () => {
              Alpine.store('modals').close('search');
            },
            instant ? 0 : 350
          );

          setTimeout(() => {
            const selected = this.$el.querySelector('[aria-selected="true"]');
            if (selected) selected.setAttribute('aria-selected', false);
            this.$refs.input.setAttribute('aria-activedescendant', '');
            this.$refs.input.setAttribute('aria-expanded', false);
            document.documentElement.style.overflowY = 'auto';

            const toggleSearch = document.querySelector('[data-open-search]');
            if (toggleSearch) {
              setTimeout(() => toggleSearch.focus(), 100);
            }
          }, 585);
        }
      },
      getSearchResults() {
        this.loading = true;

        const queryKey = this.trimmedQuery.replace(' ', '-').toLowerCase();

        liveRegion(window.theme.strings.loading);

        if (this.cachedResults[queryKey]) {
          this.renderSearchResults(this.cachedResults[queryKey].resultsMarkup);
          liveRegion(this.cachedResults[queryKey].liveRegionText);

          this.results = true;
          this.loading = false;

          return;
        }

        fetch(
          `${window.theme.routes.predictive_search_url}?q=${encodeURIComponent(
            this.trimmedQuery
          )}&${encodeURIComponent('resources[type]')}=${
            this.resources
          }&${encodeURIComponent(
            'resources[limit_scope]'
          )}=each&section_id=predictive-search`
        )
          .then((response) => {
            if (!response.ok) {
              const error = new Error(response.status);
              this.close();
              throw error;
            }

            return response.text();
          })
          .then((text) => {
            const resultsMarkup = new DOMParser()
              .parseFromString(text, 'text/html')
              .querySelector('#shopify-section-predictive-search').innerHTML;
            const liveRegionText = new DOMParser()
              .parseFromString(text, 'text/html')
              .querySelector('#predictive-search-count').textContent;

            this.cachedResults[queryKey] = {
              resultsMarkup: resultsMarkup,
              liveRegionText: liveRegionText,
            };

            this.renderSearchResults(resultsMarkup);
            liveRegion(liveRegionText);

            this.results = true;
            this.loading = false;
          })
          .catch((error) => {
            this.close();
            throw error;
          });
      },
      onChange() {
        if (!this.trimmedQuery.length) {
          this.close(true);
        } else {
          this.getSearchResults();
        }
      },
      onFocus() {
        if (!this.trimmedQuery.length) return;

        if (this.results !== true) {
          this.getSearchResults();
        }
      },
      onFormSubmit(event) {
        if (
          !this.trimmedQuery.length ||
          this.$el.querySelector('[aria-selected="true"] a')
        )
          event.preventDefault();
      },
      onKeyup(event) {
        event.preventDefault();
        switch (event.code) {
          case 'ArrowUp':
            this.switchOption('up');
            break;
          case 'ArrowDown':
            this.switchOption('down');
            break;
          case 'Enter':
            this.selectOption();
            break;
        }
      },
      onKeydown(event) {
        // Prevent the cursor from moving in the input when using the up and down arrow keys
        if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
          event.preventDefault();
        }
      },
      setInitialResultsGroup() {
        if (this.$refs.groupToggles) {
          this.currentResultsGroup = this.$refs.groupToggles.querySelector(
            'input[type="radio"]'
          ).value;
        } else {
          this.currentResultsGroup = 'products';
        }
      },
      renderSearchResults(resultsMarkup) {
        this.$refs.results.innerHTML = resultsMarkup;
        this.currentResultsGroup = '';

        this.$nextTick(() => {
          this.setInitialResultsGroup();
          this.$refs.resultsSlot.scrollTo(0, 0);
        });
      },
      selectOption() {
        const selectedOption = this.$root.querySelector(
          '[aria-selected="true"] a, [aria-selected="true"] button'
        );

        if (selectedOption) selectedOption.click();
      },
      async switchResultsGroup(fromEl, toEl) {
        if (this.shouldAnimate) {
          await fromEl.animate(
            {
              opacity: [1, 0],
            },
            { duration: 200, easing: 'ease' }
          ).finished;
        }

        fromEl.hidden = true;
        toEl.hidden = false;

        if (this.shouldAnimate) {
          await toEl.animate(
            {
              opacity: [0, 1],
            },
            { duration: 200, easing: 'ease' }
          ).finished;
        }

        const selectedEl = this.rootEl.querySelector('[aria-selected="true"]');

        if (selectedEl && selectedEl.offsetParent) {
          selectedEl.scrollIntoView({
            behavior: this.shouldAnimate ? 'smooth' : 'auto',
            block: 'end',
          });
        }
      },
      switchOption(direction) {
        const moveUp = direction === 'up';
        const selectedElement = this.$root.querySelector(
          '[aria-selected="true"]'
        );

        const allElements = Array.from(
          this.$root.querySelectorAll('[role="option"]')
        );
        let activeElement = this.$root.querySelector('[role="option"]');

        if (moveUp && !selectedElement) return;

        if (!moveUp && selectedElement) {
          activeElement =
            allElements[allElements.indexOf(selectedElement) + 1] ||
            allElements[0];
        } else if (moveUp) {
          activeElement =
            allElements[allElements.indexOf(selectedElement) - 1] ||
            allElements[allElements.length - 1];
        }

        if (activeElement === selectedElement) return;

        if (!activeElement.offsetParent) {
          this.currentResultsGroup = activeElement.closest(
            '[data-results-group]'
          ).dataset.resultsGroup;
        }

        activeElement.setAttribute('aria-selected', true);

        activeElement.scrollIntoView({
          behavior: this.shouldAnimate ? 'smooth' : 'auto',
          block: 'end',
        });

        if (selectedElement)
          selectedElement.setAttribute('aria-selected', false);

        this.$refs.input.setAttribute(
          'aria-activedescendant',
          activeElement.id
        );
      },
    };
  });
});
