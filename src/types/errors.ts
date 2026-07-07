// ─── Error Categories ─────────────────────────────────────────────────────────
//
// Three categories let the SaaS layer triage failures without parsing strings:
//
//   user      — Bad test definition (wrong YAML, missing save:, unknown selector).
//               The user wrote something invalid. Speare is working correctly.
//
//   app       — The application under test returned unexpected behaviour
//               (wrong status, element not visible, assertion mismatch).
//               Speare is working correctly; the user's app has a regression.
//
//   framework — An unexpected error inside Speare itself.
//               Indicates a bug in the framework that the Speare team must fix.
//
// ─────────────────────────────────────────────────────────────────────────────

export type ErrorCategory = 'user' | 'app' | 'framework';

export class SpeareError extends Error {
  readonly category: ErrorCategory;

  constructor(message: string, category: ErrorCategory) {
    super(message);
    this.name = 'SpeareError';
    this.category = category;
  }
}

/** Thrown when the test definition, YAML config, or variable references are invalid. */
export class UserError extends SpeareError {
  constructor(message: string) {
    super(message, 'user');
    this.name = 'UserError';
  }
}

/** Thrown when the application under test produced an unexpected result. */
export class AppError extends SpeareError {
  constructor(message: string) {
    super(message, 'app');
    this.name = 'AppError';
  }
}

/** Thrown when Speare itself encounters an unexpected condition — indicates a framework bug. */
export class FrameworkError extends SpeareError {
  constructor(message: string) {
    super(message, 'framework');
    this.name = 'FrameworkError';
  }
}
