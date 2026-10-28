// Firefox exposes the promise-based API as `browser`; Chrome's `chrome` returns promises in MV3.
export const ext = globalThis.browser ?? globalThis.chrome;
