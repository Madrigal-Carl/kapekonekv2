import { saveSetting } from '../repositories/setting.repository.js';
import { record } from './audit.service.js';
import { fieldError } from './farmerProfile.service.js';
import { getEwallet, getSetting } from './setting.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

// Changes apply to new orders and listings only: orders keep their own copy of the pickup, fee and payment details.
const audit = (actor, doc, label, before, after) =>
  record({ actor, area: 'settings', action: 'update', entity: { type: 'setting', id: doc._id, label }, before, after, fields: Object.keys(after) });

export const getBranchSetting = () => getSetting('branch');

/** @param {object} actor @param {object} branch branchSettingSchema output */
export async function saveBranchSetting(actor, branch) {
  const before = await getSetting('branch');
  const doc = await saveSetting('branch', branch);
  await audit(actor, doc, 'Branch', before, branch);
  return doc.value;
}

/** The fee rules and ETA as one form (the road-distance fallback factor stays as set). */
export async function getDeliverySetting() {
  const [fee, eta] = await Promise.all([getSetting('delivery.fee'), getSetting('delivery.eta')]);
  const { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos, maxKm, roadFactorFallback } = fee;
  return { baseFeeCentavos, baseKm, perKmCentavos, roundUpToCentavos, maxKm, roadFactorFallback, ...eta };
}

export async function saveDeliverySetting(actor, { minBusinessDays, maxBusinessDays, ...fee }) {
  const before = await getDeliverySetting();
  const doc = await saveSetting('delivery.fee', { ...fee, roadFactorFallback: before.roadFactorFallback });
  await saveSetting('delivery.eta', { minBusinessDays, maxBusinessDays });
  const after = { ...fee, minBusinessDays, maxBusinessDays };
  await audit(actor, doc, 'Delivery fee', before, after);
  return { ...after, roadFactorFallback: before.roadFactorFallback };
}

export const getEwalletSetting = async () => ({ accounts: (await getEwallet()).accounts });

const accountLines = (accounts) =>
  accounts.map((a) => `${a.provider}: ${a.accountName} · ${a.accountNumber}${a.showAtCheckout ? '' : ' (hidden)'}${a.qr ? ' · QR' : ''}`);

/** New QR images must be the actor's own `wallet_qr` uploads (re-checked on Cloudinary); unchanged ones stay. */
export async function saveEwalletSetting(actor, { accounts }) {
  const before = await getEwallet();
  const kept = new Set(before.accounts.map((a) => a.qr?.publicId).filter(Boolean));
  for (const [i, { qr }] of accounts.entries()) {
    if (!qr || kept.has(qr.publicId)) continue;
    if (!isOwnUpload(actor, 'wallet_qr', qr)) throw fieldError(`accounts.${i}.qr`, 'Upload this QR code again.');
    await assertUploadAllowed('wallet_qr', qr.publicId, `accounts.${i}.qr`);
  }
  const doc = await saveSetting('payment.ewallet', { accounts, qrPayload: before.qrPayload, isSample: false });
  await audit(actor, doc, 'E-wallet', { accounts: accountLines(before.accounts) }, { accounts: accountLines(accounts) });
  return { accounts };
}
