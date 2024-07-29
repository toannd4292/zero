window.theme = window.theme || {};
window.theme.routes = window.theme.routes || {};

function getRoutes() {
  return {
    cart_url: window.theme.routes.cart_url || "/cart.js",
    cart_add_url: window.theme.routes.cart_add_url || "/cart/add.js",
    cart_change_url: window.theme.routes.cart_change_url || "/cart/change.js",
    cart_clear_url: window.theme.routes.cart_clear_url || "/cart/clear.js"
  };
}

function getDefaultRequestConfig() {
  return JSON.parse(JSON.stringify({
    credentials: "same-origin",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type": "application/json;",
      "Accept": "application/json"
    }
  }));
}

function fetchJSON(url, config) {
  return fetch(url, config).then(function (response) {
    if (!response.ok) {
      throw response;
    }

    return response.json();
  });
}

function cart() {
  return fetchJSON(getRoutes().cart_url, getDefaultRequestConfig());
}

function cartAddFromForm(formData) {
  var config = getDefaultRequestConfig();
  delete config.headers["Content-Type"];
  config.method = "POST";
  config.body = formData;
  return fetchJSON(getRoutes().cart_add_url, config);
}

function cartChange(line, options) {
  var config = getDefaultRequestConfig();
  options = options || {};
  config.method = "POST";
  config.body = JSON.stringify({
    line: line,
    quantity: options.quantity,
    properties: options.properties
  });
  return fetchJSON(getRoutes().cart_change_url, config);
}

function cartUpdate(body) {
  var config = getDefaultRequestConfig();
  config.method = "POST";
  config.body = JSON.stringify(body);
  return fetchJSON("/cart/update.js", config);
}

function key(key) {
  if (typeof key !== 'string' || key.split(':').length !== 2) {
    throw new TypeError('Theme Cart: Provided key value is not a string with the format xxx:xxx');
  }
}

function quantity(quantity) {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    throw new TypeError('Theme Cart: An object which specifies a quantity or properties value is required');
  }
}

function id(id) {
  if (typeof id !== 'number' || isNaN(id)) {
    throw new TypeError('Theme Cart: Variant ID must be a number');
  }
}

function properties(properties) {
  if (typeof properties !== 'object') {
    throw new TypeError('Theme Cart: Properties must be an object');
  }
}

function form(form) {
  if (!(form instanceof HTMLFormElement)) {
    throw new TypeError('Theme Cart: Form must be an instance of HTMLFormElement');
  }
}

function options(options) {
  if (typeof options !== 'object') {
    throw new TypeError('Theme Cart: Options must be an object');
  }

  if (typeof options.quantity === 'undefined' && typeof options.properties === 'undefined') {
    throw new Error('Theme Cart: You muse define a value for quantity or properties');
  }

  if (typeof options.quantity !== 'undefined') {
    quantity(options.quantity);
  }

  if (typeof options.properties !== 'undefined') {
    properties(options.properties);
  }
}
/**
 * Cart Template Script
 * ------------------------------------------------------------------------------
 * A file that contains scripts highly couple code to the Cart template.
 *
 * @namespace cart
 */

/**
 * Returns the state object of the cart
 * @returns {Promise} Resolves with the state object of the cart (https://help.shopify.com/en/themes/development/getting-started/using-ajax-api#get-cart)
 */


function getState() {
  return cart();
}
/**
 * Returns the index of the cart line item
 * @param {string} key The unique key of the line item
 * @returns {Promise} Resolves with the index number of the line item
 */


function getItemIndex(key$1) {
  key(key$1);
  return cart().then(function (state) {
    var index = -1;
    state.items.forEach(function (item, i) {
      index = item.key === key$1 ? i + 1 : index;
    });

    if (index === -1) {
      return Promise.reject(new Error('Theme Cart: Unable to match line item with provided key'));
    }

    return index;
  });
}
/**
 * Add a new line item to the cart from a product form
 * @param {object} form DOM element which is equal to the <form> node
 * @returns {Promise} Resolves with the line item object (See response of cart/add.js https://help.shopify.com/en/themes/development/getting-started/using-ajax-api#add-to-cart)
 */


function addItemFromForm(form$1) {
  form(form$1);
  var formData = new FormData(form$1);
  id(parseInt(formData.get('id'), 10));
  return cartAddFromForm(formData);
}
/**
 * Changes the quantity and/or properties of an existing line item.
 * @param {string} key The unique key of the line item (https://help.shopify.com/en/themes/liquid/objects/line_item#line_item-key)
 * @param {object} options Optional values to pass to /cart/add.js
 * @param {number} options.quantity The quantity of items to be added to the cart
 * @param {object} options.properties Line item property key/values (https://help.shopify.com/en/themes/liquid/objects/line_item#line_item-properties)
 * @returns {Promise} Resolves with the state object of the cart (https://help.shopify.com/en/themes/development/getting-started/using-ajax-api#get-cart)
 */


function updateItem(key$1, options$1) {
  key(key$1);
  options(options$1);
  return getItemIndex(key$1).then(function (line) {
    return cartChange(line, options$1);
  });
}
/**
 * Sets cart note
 * @returns {Promise} Resolves with the cart state object
 */


function updateNote(note) {
  return cartUpdate({
    note: note
  });
}

window.ShopifyCart = {
  addItemFromForm,
  getState,
  updateItem,
  updateNote
};
