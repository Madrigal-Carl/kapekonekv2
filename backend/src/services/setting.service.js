import { SETTING_DEFAULTS } from '../constants/settings.js';
import { findSettingValue } from '../repositories/setting.repository.js';

/**
 * A setting's stored value, or its default when it was never saved.
 * @param {keyof typeof SETTING_DEFAULTS} key
 */
export const getSetting = async (key) => (await findSettingValue(key)) ?? SETTING_DEFAULTS[key];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** "17:00" → "5:00 PM" */
const clock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/**
 * Opening hours as one line, consecutive days with the same hours grouped: "Mon–Fri, 8:00 AM – 5:00 PM · Sat, 8:00 AM – 12:00 PM".
 * @param {{ open: boolean, from: string, to: string }[]} hours Monday first
 */
export function formatHours(hours) {
  const runs = [];
  hours.forEach((h, day) => {
    const last = runs.at(-1);
    if (!h.open) return;
    if (last && last.end === day - 1 && last.from === h.from && last.to === h.to) last.end = day;
    else runs.push({ start: day, end: day, from: h.from, to: h.to });
  });
  if (!runs.length) return 'Closed';
  return runs.map((r) => `${DAYS[r.start]}${r.end > r.start ? `–${DAYS[r.end]}` : ''}, ${clock(r.from)} – ${clock(r.to)}`).join(' · ');
}

/** "Km 3, Pantayin, Santa Cruz, Marinduque" */
export const branchAddress = (b) => [b.street, b.barangay, b.municipality, 'Marinduque'].filter(Boolean).join(', ');

/** The branch as pickup orders save it (orders keep this copy when the branch changes later). */
export async function getPickup() {
  const branch = await getSetting('branch');
  // Saved as 09178001122 (phoneRule); shown as 0917 800 1122.
  const phone = branch.phone?.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 $2 $3') ?? null;
  return { name: branch.name, address: branchAddress(branch), hours: formatHours(branch.hours), phone, location: branch.location };
}

/** Public delivery facts for the storefront: pickup, fee rules (without the origin pin) and ETA days. */
export async function getDeliveryInfo() {
  const [fee, eta, pickup] = await Promise.all([getSetting('delivery.fee'), getSetting('delivery.eta'), getPickup()]);
  const { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos, maxKm } = fee;
  return {
    pickup,
    fee: { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos, maxKm },
    eta: { minBusinessDays: eta.minBusinessDays, maxBusinessDays: eta.maxBusinessDays },
  };
}

export const getLanding = async () => ({ heroSlides: await getSetting('landing.heroSlides') });

/** The e-wallet accounts; a value saved before Phase 2 (one account for both providers) reads as two. */
export async function getEwallet() {
  const value = await getSetting('payment.ewallet');
  if (value.accounts) return value;
  const { providers = ['GCash', 'Maya'], accountName, accountNumber, qrImageUrl, qrPayload, isSample } = value;
  const qr = qrImageUrl ? { url: qrImageUrl, publicId: null } : null;
  return { accounts: providers.map((provider) => ({ provider, accountName, accountNumber, enabled: true, qr })), qrPayload, isSample };
}

/** What checkout shows: the providers Kaluppa shows, each with its account and QR. */
export async function getPaymentSettings() {
  const { accounts, qrPayload, isSample } = await getEwallet();
  const shown = accounts.filter((a) => a.enabled);
  return {
    providers: shown.map((a) => a.provider),
    accounts: Object.fromEntries(shown.map((a) => [a.provider, { accountName: a.accountName, accountNumber: a.accountNumber, qrImageUrl: a.qr?.url ?? null }])),
    qrPayload,
    isSample,
  };
}
