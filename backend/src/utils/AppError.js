const CODE_BY_STATUS = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

/** An expected error with an HTTP status, an API code and optional field errors. */
export class AppError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {{ code?: string, errors?: Record<string, string>, data?: object }} [options] `data` is sent as the response's `data`
   */
  constructor(statusCode, message, { code, errors = {}, data } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? CODE_BY_STATUS[statusCode] ?? 'SERVER_ERROR';
    this.errors = errors;
    this.data = data;
  }
}
