/** "Mama’s house", or Home / Work. */
export const addressLabel = (a) => (a.label === 'Other' && a.customLabel ? a.customLabel : a.label)

/** "Balanacan, Mogpog, Marinduque 4901" */
export const addressArea = (a) => `${a.barangay}, ${a.municipality}, ${a.province ?? 'Marinduque'} ${a.postalCode}`.trim()

/** Street plus area on one line. */
export const addressLine = (a) => `${a.street}, ${addressArea(a)}`

const QUOTE_ERRORS = {
  ADDRESS_NEEDS_PIN: 'We couldn’t find this address on the map. Add a pin to get a delivery fee.',
  OUTSIDE_DELIVERY_AREA: 'This address is outside our delivery area. We deliver anywhere in Marinduque.',
}

/** Why a saved address has no delivery quote (the API sends the 422 code). */
export const quoteErrorText = (code) => QUOTE_ERRORS[code] ?? 'The delivery fee isn’t available right now. Please try again later.'
