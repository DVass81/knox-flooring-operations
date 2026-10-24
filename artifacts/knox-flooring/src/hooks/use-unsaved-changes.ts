import { useCallback, useEffect, useState } from "react";

/** Protect unfinished edits on close, link navigation, and browser reload. */
export function useUnsavedChanges(dirty: boolean) {
  const confirmDiscard = useCallback(() => !dirty || window.confirm("Discard your unsaved changes?"), [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const beforeNavigate = (rawEvent: Event) => {
      const event = rawEvent as Event & { destination: { url: string }; canIntercept: boolean };
      if (!event.canIntercept || !event.cancelable) return;
      const target = new URL(event.destination.url);
      if (target.pathname === window.location.pathname) {
        const current = new URLSearchParams(window.location.search);
        const next = target.searchParams;
        const opensEditor = (next.get("create") === "1" && ["create", "new", "jobId", "leadId", "customerId", "siteId"].some(key => next.get(key) !== current.get(key))) || ["draft", "invoice"].some(key => next.has(key) && next.get(key) !== current.get(key));
        if (!opensEditor) return;
      }
      if (!confirmDiscard()) event.preventDefault();
    };
    const beforeLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const target = new URL(anchor.href, window.location.href);
      if (!/^https?:$/.test(target.protocol)) return;
      if (target.href === window.location.href || (target.pathname === window.location.pathname && target.search === window.location.search)) return;
      if (!confirmDiscard()) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    if (navigation) navigation.addEventListener("navigate", beforeNavigate);
    else document.addEventListener("click", beforeLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); navigation?.removeEventListener("navigate", beforeNavigate); document.removeEventListener("click", beforeLink, true); };
  }, [dirty, confirmDiscard]);
  return confirmDiscard;
}

/** Call reset with the loaded/empty form whenever an editor opens. */
export function useUnsavedForm<T>(active: boolean, value: T) {
  const [baseline, setBaseline] = useState(() => JSON.stringify(value));
  const dirty = active && JSON.stringify(value) !== baseline;
  const confirmDiscard = useUnsavedChanges(dirty);
  const reset = useCallback((initial: T) => setBaseline(JSON.stringify(initial)), []);
  return { dirty, confirmDiscard, reset };
}
