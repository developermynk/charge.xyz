/**
 * Shared error base.
 *
 * `Error` already declares an optional `cause`, so redeclaring it as a
 * parameter property in each subclass trips `noImplicitOverride` (TS4115).
 * Passing it through the standard ErrorOptions channel keeps `err.cause`
 * working, preserves stack chaining, and avoids the override entirely.
 */
export class ChargeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}
