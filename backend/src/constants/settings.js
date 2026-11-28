/** Setting values used until Kaluppa changes them (PRODUCT-SPEC §2). The settings seeder writes these. */
export const SETTING_DEFAULTS = {
  'delivery.fee': {
    baseFeeCentavos: 5000,
    baseKm: 3,
    perKmCentavos: 1000,
    roundUpToCentavos: 500,
    maxKm: 60,
    roadFactorFallback: 1.35,
  },
  'delivery.eta': { minBusinessDays: 3, maxBusinessDays: 5 },
  // The Kaluppa branch (PHASE-2-SPEC §3.13; replaces Phase 1's pickup.location): delivery-fee origin, pickup card, pickup orders, bean drop-off.
  // hours[0] is Monday … hours[6] Sunday. Sample hours until Kaluppa confirms (phase-1-questions #24).
  branch: {
    name: 'Kaluppa',
    phone: '0917 800 1122',
    contactEmail: null, // Change 08: Contact us messages are emailed here once Kaluppa sets it
    street: '',
    barangay: 'Pantayin',
    municipality: 'Santa Cruz',
    location: { lat: 13.467, lng: 122.044 },
    hours: [...Array(6).fill({ open: true, from: '08:00', to: '17:00' }), { open: false, from: '08:00', to: '17:00' }],
  },
  // One account per provider. Sample until Kaluppa saves its own in Settings → E-wallet.
  'payment.ewallet': {
    // GCash only for now: Maya stays saved, off at checkout (Change 06F). Kaluppa switches providers in Settings → E-wallet.
    accounts: ['GCash', 'Maya'].map((provider) => ({ provider, accountName: 'Kaluppa Coffee (sample)', accountNumber: '0917 000 0000', showAtCheckout: provider === 'GCash', qr: null })),
    qrPayload: 'KAPEKONEK-SAMPLE-EWALLET-QR',
    isSample: true,
  },
  'landing.heroSlides': [],
};
