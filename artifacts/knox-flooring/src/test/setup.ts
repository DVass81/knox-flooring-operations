import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false }),
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { writable: true, value: () => undefined });
Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", { writable: true, value: () => false });
Object.defineProperty(window.HTMLElement.prototype, "setPointerCapture", { writable: true, value: () => undefined });
Object.defineProperty(window.HTMLElement.prototype, "releasePointerCapture", { writable: true, value: () => undefined });
if (!globalThis.CSS) Object.defineProperty(globalThis, "CSS", { value: {} });
if (!CSS.escape) Object.defineProperty(CSS, "escape", { value: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "\\$&") });
if (!globalThis.PointerEvent) Object.defineProperty(globalThis, "PointerEvent", { value: MouseEvent });
