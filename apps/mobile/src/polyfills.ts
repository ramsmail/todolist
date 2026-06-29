// React Native's Hermes engine has no global `crypto`, but packages/db calls
// `crypto.randomUUID()` for every new row id (shared with the web app, where it
// exists natively). Polyfill a UUID v4 generator so those writes work on-device.
//
// NOTE: this uses Math.random, which is fine for opaque row ids (not security
// tokens). If we ever need cryptographically strong ids on mobile, swap this for
// expo-crypto's randomUUID() — that pulls in native code and needs a rebuild.
const g = globalThis as { crypto?: { randomUUID?: () => string } };

if (typeof g.crypto === 'undefined') {
  g.crypto = {};
}

if (typeof g.crypto.randomUUID !== 'function') {
  g.crypto.randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (
        (Number(c) ^ (Math.random() * 16)) >>
        (Number(c) / 4)
      ).toString(16),
    ) as `${string}-${string}-${string}-${string}-${string}`;
}
