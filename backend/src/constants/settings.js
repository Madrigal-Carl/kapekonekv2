/** Setting values used until Kaluppa changes them (PRODUCT-SPEC §2). The settings seeder writes these. */
export const SETTING_DEFAULTS = {
  'delivery.fee': {
    origin: { lat: 13.467, lng: 122.044 }, // approximate; Kaluppa sets the exact pin later
    baseFeeCentavos: 5000,
    baseKm: 3,
    perKmCentavos: 1000,
    roundUpToCentavos: 500,
    maxKm: 60,
    roadFactorFallback: 1.35,
  },
  'delivery.eta': { minBusinessDays: 3, maxBusinessDays: 5 },
  'pickup.location': {
    name: 'Kaluppa',
    address: 'Pantayin, Santa Cruz, Marinduque',
    hours: 'Monday to Saturday, 8:00 AM to 5:00 PM', // sample until Kaluppa confirms (phase-1-questions #24)
    location: { lat: 13.467, lng: 122.044 },
  },
  'payment.ewallet': {
    providers: ['GCash', 'Maya'],
    accountName: 'Kaluppa Coffee (sample)',
    accountNumber: '0917 000 0000',
    qrImageUrl: null,
    qrPayload: 'KAPEKONEK-SAMPLE-EWALLET-QR',
    isSample: true,
  },
  'landing.heroSlides': [],
};
