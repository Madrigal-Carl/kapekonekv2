// Terms and Conditions + Privacy Policy (Change 09, PHASE-2-SPEC §3.17).
// Raising TERMS_VERSION asks every user to agree again at their next sign-in; add terms.v<N>.md and privacy.v<N>.md
// in src/legal/ for the new version.
export const TERMS_VERSION = 1;
export const TERMS_UPDATED_AT = '2026-11-28';

/** Whether this user still has to agree to the current terms. */
export const mustAcceptTerms = (user) => (user.termsVersion ?? 0) < TERMS_VERSION;
