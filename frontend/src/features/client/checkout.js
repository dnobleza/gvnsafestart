import { payBooking, payPackage } from '../../api/clientPortal';

// Full-page navigation to the provider's hosted checkout. Kept in one place so
// tests can replace it.
export const goToCheckout = (url) => window.location.assign(url);

export const startPayment = async (bookingId) => {
  const { checkoutUrl } = await payBooking(bookingId);
  goToCheckout(checkoutUrl);
};

export const startPackagePayment = async (packageId) => {
  const { checkoutUrl } = await payPackage(packageId);
  goToCheckout(checkoutUrl);
};
