import "@testing-library/jest-dom";

// jsdom doesn't implement ResizeObserver
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
