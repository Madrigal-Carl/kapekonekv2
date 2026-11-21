import { SETTING_DEFAULTS } from '../constants/settings.js';
import { findSettingValue } from '../repositories/setting.repository.js';

/**
 * A setting's stored value, or its default when it was never saved.
 * @param {keyof typeof SETTING_DEFAULTS} key
 */
export const getSetting = async (key) => (await findSettingValue(key)) ?? SETTING_DEFAULTS[key];

/** Public delivery facts for the storefront: pickup, fee rules (without the origin pin) and ETA days. */
export async function getDeliveryInfo() {
  const [fee, eta, pickup] = await Promise.all([getSetting('delivery.fee'), getSetting('delivery.eta'), getSetting('pickup.location')]);
  const { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos, maxKm } = fee;
  const { name, address, hours, location } = pickup;
  return {
    pickup: { name, address, hours, location },
    fee: { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos, maxKm },
    eta: { minBusinessDays: eta.minBusinessDays, maxBusinessDays: eta.maxBusinessDays },
  };
}

export const getLanding = async () => ({ heroSlides: await getSetting('landing.heroSlides') });

export const getPaymentSettings = () => getSetting('payment.ewallet');
