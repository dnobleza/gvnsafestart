import '@testing-library/jest-dom/vitest';

// jsdom ships neither of these, and motion's whileInView needs the first while
// useReducedMotion needs the second. The observer reports every target as
// visible straight away so reveal-wrapped content is assertable.
if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
    }

    observe(target) {
      this.targets.add(target);
      this.callback([{ target, isIntersecting: true, intersectionRatio: 1 }], this);
    }

    unobserve(target) {
      this.targets.delete(target);
    }

    disconnect() {
      this.targets.clear();
    }

    takeRecords() {
      return [];
    }
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  });
}
