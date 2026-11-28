/** Bean sales to Kaluppa (PHASE-2-SPEC §3.5). */
export const BEAN_FORMS = { fresh_cherry: 'Fresh cherry', dried_cherry: 'Dried cherry', parchment: 'Parchment', green_beans: 'Green beans' };
export const BEAN_STATUSES = ['pending', 'approved', 'completed', 'rejected', 'cancelled', 'expired'];
/** Listings that use up an unapproved farmer's cap. */
export const CAP_STATUSES = ['pending', 'approved', 'completed'];
export const BEAN_CAP_KG = 5;
/** The Status filter's groups: "Closed" covers every ending that isn't a sale. */
export const BEAN_STATUS_GROUPS = { pending: ['pending'], approved: ['approved'], completed: ['completed'], closed: ['rejected', 'cancelled', 'expired'] };
