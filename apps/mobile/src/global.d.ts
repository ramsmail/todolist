// Hermes has no global `crypto`, and the app's tsconfig `lib` omits DOM types.
// src/polyfills.ts installs a pure-JS `crypto.randomUUID` at runtime; declare
// the slice the app uses so callers (e.g. id generation) type-check.
declare const crypto: {
  randomUUID(): string;
};
