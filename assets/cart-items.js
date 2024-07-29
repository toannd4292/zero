document.addEventListener("alpine:init", () => {
  Alpine.data("ThemeModule_CartItems", () => {
    return {
      itemsRoot: null,
      locked: null,
      init() {
        this.itemsRoot = this.$root;

        window.addEventListener("cascade:modalcart:afteradditem", (e) => {
          Alpine.morph(
            this.itemsRoot,
            querySelectorInHTMLString(
              "[data-cart-items]",
              e.detail.response.sections["cart-items"]
            ).outerHTML
          );
        });

        window.addEventListener("cascade:modalcart:cartqtychange", (e) => {
          Alpine.morph(
            this.itemsRoot,
            querySelectorInHTMLString(
              "[data-cart-items]",
              e.detail.response.sections["cart-items"]
            ).outerHTML
          );

          this.$nextTick(() => {
            this.itemsRoot.querySelectorAll("input").forEach((inputEl) => {
              inputEl.value = inputEl.getAttribute("value");
            });
          });

          const liveRegionText = parseDOMFromString(
            e.detail.response.sections["cart-live-region"]
          ).firstElementChild.textContent;

          const cartStatus = document.getElementById("cart-live-region-text");

          cartStatus.textContent = liveRegionText;

          cartStatus.setAttribute("aria-hidden", false);

          setTimeout(() => {
            cartStatus.setAttribute("aria-hidden", true);
          }, 1000);

          if (e.detail.originalTarget) {
            this.$nextTick(() => {
              if (!this.itemsRoot.contains(e.detail.originalTarget)) {
                let focusRoot;

                if (this.itemsRoot.closest('[role="dialog"]')) {
                  focusRoot =
                    this.itemsRoot.closest('[role="dialog"]').parentNode;
                } else {
                  focusRoot = this.itemsRoot;
                }

                this.$focus.within(focusRoot).first();
              }
            });
          }
        });
      },
      itemQuantityChange(key, value) {
        if (this.locked) return;

        const lineItemEl = this.$el.closest("li[data-cart-item-key]");
        const id = key ? key : lineItemEl.getAttribute("data-cart-item-key"),
          quantity = parseInt(!isNaN(value) ? value : this.$el.value, 10),
          sections = "cart-items,cart-footer,cart-item-count,cart-live-region";

        const config = fetchConfigDefaults();

        config.headers.Accept = "application/javascript";

        config.body = JSON.stringify({
          id,
          quantity,
          sections,
          sections_url: window.location.pathname,
        });

        const lastValue = parseInt(this.$el.dataset.lastValue, 10);

        if (quantity !== lastValue) {
          lineItemEl.classList.add("opacity-50", "cursor-progress");

          const currentCount = Alpine.raw(Alpine.store("cart_count").count);

          this.locked = lineItemEl;

          fetch(theme.routes.cart_change_url, config)
            .then((res) => res.json())
            .then((data) => {
              if (data.item_count === currentCount) {
                // Quantity change had no effect -- most likely, there is no more inventory
                const errorEl = lineItemEl.querySelector(
                  "[data-cart-quantity-error]"
                );

                errorEl.textContent = theme.strings.cartAddError.replace(
                  "{{ title }}",
                  errorEl.dataset.itemTitle
                );

                errorEl.classList.remove("hidden");
              } else {
                document.body.dispatchEvent(
                  new CustomEvent("cascade:modalcart:cartqtychange", {
                    bubbles: true,
                    detail: { response: data, originalTarget: lineItemEl },
                  })
                );
              }
            })
            .catch(() => {
              document.getElementById("cart-errors").textContent =
                theme.strings.cartError;
            })
            .finally(() => {
              this.locked = null;
            });
        }
      },
      removeItem(key) {
        this.itemQuantityChange(key, 0);
      },
      _adjustQty(el, operation) {
        const inputEl = el
          .closest("li[data-cart-item-key]")
          .querySelector('input[type="number"]');
        const lastValue = parseInt(inputEl.value, 10);
        let newValue;

        if (operation === "increment") {
          newValue = lastValue + 1;
        } else if (operation === "decrement") {
          newValue = lastValue - 1;
          if (newValue <= 0) {
            this.removeItem(
              el
                .closest("li[data-cart-item-key]")
                .getAttribute("data-cart-item-key")
            );
            return; // Exit the function if item is removed
          }
        }
        // Define a function to recalculate the total discount
        function recalculateTotalDiscount() {
          let totalDiscount = 0;

          // Loop through each cart item and calculate the total discount
          document
            .querySelectorAll("[data-cart-item-key]")
            .forEach((itemEl) => {
              const originalPrice = parseFloat(
                itemEl.dataset.originalPrice || 0
              );
              const finalPrice = parseFloat(itemEl.dataset.finalPrice || 0);
              const lineDiscount = originalPrice - finalPrice;

              totalDiscount += lineDiscount;
            });

          // Update the total discount in the DOM
          document.getElementById("total-savings").textContent =
            formatMoney(totalDiscount);
        }

        // Add event listeners to recalculate the discount when the cart is updated
        window.addEventListener(
          "cascade:modalcart:afteradditem",
          recalculateTotalDiscount
        );
        window.addEventListener(
          "cascade:modalcart:cartqtychange",
          recalculateTotalDiscount
        );

        // Function to format the money value (customize this as per your requirement)
        function formatMoney(amount) {
          return "$" + amount.toFixed(2); // Modify this to match your currency formatting
        }

        inputEl.value = newValue;
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
      },
      increment() {
        this._adjustQty(this.$el, "increment");
      },
      decrement() {
        this._adjustQty(this.$el, "decrement");
      },
      remove() {
        this._adjustQty(this.$el, "remove");
      },
    };
  });
});