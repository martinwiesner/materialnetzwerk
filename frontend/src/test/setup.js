import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollTo — several components call it (e.g. to
// scroll a validation error into view) purely as a UX nicety.
Element.prototype.scrollTo = Element.prototype.scrollTo || (() => {});

