import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollTo — several components call it (e.g. to
// scroll a validation error into view) purely as a UX nicety.
Element.prototype.scrollTo = Element.prototype.scrollTo || (() => {});

// jsdom doesn't implement matchMedia — used e.g. for the WASM-capability
// device check (coarse-pointer heuristic) on the CAD embed.
window.matchMedia = window.matchMedia || (() => ({
  matches: false,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
}));

