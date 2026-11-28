import { renderLayout } from './layout.js';
import { peso, shortDate } from './orderFormat.js';

/**
 * To the farmer when a bean listing changes (PHASE-2-SPEC §6): approved (branch, hours, deadline), rejected or
 * cancelled (reason), expired, completed (final weight and amount).
 * @param {{ name: string, status: 'approved'|'rejected'|'cancelled'|'expired'|'completed', listingNumber: string, summary: string,
 *   reason?: string, deadline?: string, branch?: { name: string, address: string, hours: string, phone: string },
 *   final?: { weightKg: number, amountCentavos: number }, listed?: { weightKg: number, amountCentavos: number }, url: string }} data
 */
export function beanStatus({ name, status, listingNumber, summary, reason, deadline, branch, final, listed, url }) {
  const by = deadline && shortDate(deadline);
  const copy = {
    approved: {
      subject: `${listingNumber} approved: bring your beans by ${by}`,
      heading: 'Kaluppa approved your beans',
      lines: [
        `Kaluppa approved your listing ${listingNumber} (${summary}). Bring the beans to the Kaluppa branch by ${by}. Kaluppa weighs them and pays you there.`,
        branch && `${branch.name}: ${branch.address}. Open ${branch.hours}. Phone ${branch.phone}.`,
        `If the beans aren’t brought by ${by}, the listing expires.`,
      ],
    },
    rejected: { subject: `${listingNumber} wasn’t approved`, heading: 'Your listing wasn’t approved', lines: [`Kaluppa didn’t approve ${listingNumber} (${summary}).`, `Reason from Kaluppa: ${reason}`, 'You can list again any time.'] },
    cancelled: { subject: `${listingNumber} was cancelled`, heading: 'Kaluppa cancelled your sale', lines: [`Kaluppa cancelled ${listingNumber} (${summary}).`, `Reason: ${reason}`] },
    expired: { subject: `${listingNumber} expired`, heading: 'Your listing expired', lines: [`${listingNumber} (${summary}) expired because the beans weren’t brought within 7 days of approval.`, 'You can list them again.'] },
    completed: {
      subject: `${listingNumber} completed`,
      heading: 'Sale completed',
      lines: [`Kaluppa completed ${listingNumber}. Final: ${final?.weightKg} kg for ${final && peso(final.amountCentavos)} (listed ${listed?.weightKg} kg for ${listed && peso(listed.amountCentavos)}).`, 'Thank you for selling to Kaluppa.'],
    },
  }[status];
  return {
    subject: copy.subject,
    ...renderLayout({ preheader: copy.heading, heading: copy.heading, paragraphs: [`Hi ${name},`, ...copy.lines.filter(Boolean)], cta: { label: 'View the listing', url } }),
  };
}
