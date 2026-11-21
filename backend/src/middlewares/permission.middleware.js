import { userCan, userCanAny } from '../services/permission.service.js';
import { AppError } from '../utils/AppError.js';

const forbidden = () => new AppError(403, "You don't have permission to do that.");

/** Allow only these roles (for routing; features use `can`). Use after `authenticate`. */
export const role = (...slugs) => (req, _res, next) =>
  next(slugs.some((slug) => req.user.roles.includes(slug)) ? undefined : forbidden());

/** Require every one of these permissions. Kaluppa always passes. */
export const can = (...slugs) => async (req, _res, next) => {
  try {
    next((await userCan(req.user, ...slugs)) ? undefined : forbidden());
  } catch (error) {
    next(error);
  }
};

/** Require at least one of these permissions. */
export const canAny = (...slugs) => async (req, _res, next) => {
  try {
    next((await userCanAny(req.user, ...slugs)) ? undefined : forbidden());
  } catch (error) {
    next(error);
  }
};
