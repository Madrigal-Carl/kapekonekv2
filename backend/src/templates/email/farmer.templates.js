import { renderLayout } from './layout.js';

/** To the Group Manager (or Kaluppa): a farmer asked to join. @param {{ name: string, farmerName: string, associationName: string, url: string }} data */
export const farmerRequest = ({ name, farmerName, associationName, url }) => ({
  subject: `${farmerName} wants to join ${associationName}`,
  ...renderLayout({
    preheader: 'A farmer is waiting for approval.',
    heading: 'A farmer is waiting for approval',
    paragraphs: [`Hi ${name},`, `${farmerName} asked to join ${associationName} and sent their valid ID and proof of land ownership.`],
    cta: { label: 'Review the request', url },
  }),
});

/** To the farmer: approved, or rejected with the reason. @param {{ name: string, approved: boolean, associationName: string, reason?: string, url: string }} data */
export const farmerDecision = ({ name, approved, associationName, reason, url }) => ({
  subject: approved ? `You're now an approved farmer of ${associationName}` : `Your request to join ${associationName} wasn't approved`,
  ...renderLayout({
    preheader: approved ? 'Your association request was approved.' : 'Your association request needs another look.',
    heading: approved ? 'You’re approved' : 'Your request wasn’t approved',
    paragraphs: approved
      ? [`Hi ${name},`, `${associationName} approved you. You can now sell more than 5 kg of beans to Kaluppa and chat with your association.`]
      : [`Hi ${name},`, `${associationName} didn't approve your request. Reason: ${reason}`, 'You can fix it and send a new request.'],
    cta: { label: approved ? 'Open your dashboard' : 'Send a new request', url },
  }),
});

/** To the farmer: transfer approved or rejected. @param {{ name: string, approved: boolean, associationName: string, reason?: string, url: string }} data */
export const transferDecision = ({ name, approved, associationName, reason, url }) => ({
  subject: approved ? `You moved to ${associationName}` : `Your transfer to ${associationName} wasn't approved`,
  ...renderLayout({
    preheader: approved ? 'Your transfer was approved.' : 'Your transfer wasn’t approved.',
    heading: approved ? 'Transfer approved' : 'Transfer not approved',
    paragraphs: approved
      ? [`Hi ${name},`, `You're now part of ${associationName}. You're still an approved farmer.`]
      : [`Hi ${name},`, `${associationName} didn't approve your transfer. Reason: ${reason}`, 'You stay in your current association.'],
    cta: { label: 'Open your association', url },
  }),
});
