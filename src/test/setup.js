// Vitest setup file (see vite.config.js -> test.setupFiles). Runs once
// before each test file. Adds the jest-dom DOM matchers (toBeInTheDocument,
// toBeDisabled, etc.) globally so individual test files don't each import
// them by hand.
import "@testing-library/jest-dom";

// jsdom does not implement window.matchMedia. Several components (e.g.
// src/components/auth/AuthShell.jsx) call it to detect a mobile breakpoint.
// A minimal stub (always reporting "not matched", i.e. desktop) is enough
// for components to render without crashing; it does not simulate real
// media-query change events.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
