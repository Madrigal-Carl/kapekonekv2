import * as addressBookVersion from './2026-11-28-address-book-version.js';
import * as beansNoFeatured from './2026-11-28-beans-no-featured.js';
import * as dropFarmLotNumber from './2026-11-28-drop-farm-lot-number.js';

/** Every migration, oldest first. Each `up(db)` is idempotent, so a fresh database runs them as no-ops. */
export const MIGRATIONS = [dropFarmLotNumber, beansNoFeatured, addressBookVersion];
