/** Stable `extensions.code` values clients can branch on. */
export const ErrorCode = {
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  EMPLOYEE_REQUIRED: 'EMPLOYEE_REQUIRED',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
  /** Anything unexpected. The message is masked in production; `extensions.requestId` points to the log entry. */
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;
