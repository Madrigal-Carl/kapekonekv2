// Every payment line in the app is built from the e-wallets Kaluppa shows at checkout (Settings → E-wallet; Change 06F).
// Never write provider names into copy: turning one on or off in Settings changes every sentence.

/** "GCash" · "GCash or cash" · "GCash, Maya or cash" (`word` "and" for a list of what is on). */
export const orList = (items, word = 'or') => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`)

/** "GCash or cash on delivery" for the shown providers (`cash` names the cash option). */
export const paymentPhrase = (providers = [], cash = 'cash on delivery') => orList([...providers, cash])

/** A seeded or saved sentence with a `{payments}` token, filled from the shown providers. */
export const fillPayments = (text, providers) => text?.replaceAll('{payments}', paymentPhrase(providers))
