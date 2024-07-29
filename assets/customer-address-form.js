function customerAddressForm() {
  var newAddressForm = document.getElementById('AddressNewForm');
  var newAddressFormButton = document.getElementById('AddressNewButton');
  if (!newAddressForm) {
    return;
  }
  // Initialize observers on address selectors, defined in shopify_common.js
  if (Shopify) {
    // eslint-disable-next-line no-new
    new Shopify.CountryProvinceSelector(
      'AddressCountryNew',
      'AddressProvinceNew',
      {
        hideElement: 'AddressProvinceContainerNew',
      }
    );
  }
  // Initialize each edit form's country/province selector
  document
    .querySelectorAll('.address-country-option')
    .forEach(function (option) {
      var formId = option.dataset.formId;
      var countrySelector = 'AddressCountry_' + formId;
      var provinceSelector = 'AddressProvince_' + formId;
      var containerSelector = 'AddressProvinceContainer_' + formId;
      // eslint-disable-next-line no-new
      new Shopify.CountryProvinceSelector(countrySelector, provinceSelector, {
        hideElement: containerSelector,
      });
    });
  // Toggle new/edit address forms
  document.querySelectorAll('[data-address-new]').forEach(function (button) {
    button.addEventListener('click', function () {
      var isExpanded =
        newAddressFormButton.getAttribute('aria-expanded') === 'true';
      newAddressForm.classList.toggle('hidden');
      newAddressFormButton.setAttribute('aria-expanded', !isExpanded);
      newAddressFormButton.focus();
    });
  });
  document.querySelectorAll('[data-address-edit]').forEach(function (button) {
    button.addEventListener('click', function (evt) {
      var formId = evt.target.dataset.addressEdit;
      var editButton = document.getElementById('EditFormButton_' + formId);
      var editAddress = document.getElementById('EditAddress_' + formId);
      var isExpanded = editButton.getAttribute('aria-expanded') === 'true';
      editAddress.classList.toggle('hidden');
      editButton.setAttribute('aria-expanded', !isExpanded);
      editButton.focus();
    });
  });
  document
    .querySelectorAll('[data-address-delete-form]')
    .forEach(function (button) {
      button.addEventListener('click', function (evt) {
        evt.preventDefault();
        var target = evt.target.dataset.target;
        var confirmMessage = evt.target.dataset.confirmMessage;
        // eslint-disable-next-line no-alert
        if (
          confirm(
            confirmMessage || 'Are you sure you wish to delete this address?'
          )
        ) {
          Shopify.postLink(target, {
            parameters: { _method: 'delete' },
          });
        }
      });
    });
}

document.addEventListener('DOMContentLoaded', () => {
  customerAddressForm();
});
