/// <reference types="vite/client" />

/** Set by `bootstrap.bundle.min.js` in main.tsx — do not import `bootstrap` ESM elsewhere or document listeners register twice and dropdowns open+close on one click. */
declare global {
  interface Window {
    bootstrap?: {
      Modal: {
        getOrCreateInstance: (element: Element | string) => { hide: () => void; show?: () => void };
      };
    };
  }
}
export {};
