import * as dropFarmLotNumber from './2026-11-28-drop-farm-lot-number.js';

/** Every migration, oldest first. Each `up(db)` is idempotent, so a fresh database runs them as no-ops. */
export const MIGRATIONS = [dropFarmLotNumber];
