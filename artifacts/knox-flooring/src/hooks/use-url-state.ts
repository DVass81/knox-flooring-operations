import { useCallback, type SetStateAction } from "react";
import { useLocation, useSearch } from "wouter";

/** List state belongs in the URL so refresh, shared links, and Back keep context. */
export function useUrlState<T extends string>(key: string, fallback: T): [T, (value: SetStateAction<T>) => void] {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const value = (new URLSearchParams(search).get(key) ?? fallback) as T;
  const setValue = useCallback((next: SetStateAction<T>) => {
    const params = new URLSearchParams(window.location.search);
    const current = (params.get(key) ?? fallback) as T;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved === fallback || resolved === "") params.delete(key); else params.set(key, resolved);
    const query = params.toString();
    navigate(`${location}${query ? `?${query}` : ""}`, { replace: true });
  }, [fallback, key, location, navigate]);
  return [value, setValue];
}

export function useQueryControls() {
  const [location, navigate] = useLocation();
  const search = useSearch();
  const update = useCallback((changes: Record<string, string | null>, replace = true) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(changes).forEach(([key, value]) => value == null || value === "" ? params.delete(key) : params.set(key, value));
    const query = params.toString();
    navigate(`${location}${query ? `?${query}` : ""}`, { replace });
  }, [location, navigate]);
  return { params: new URLSearchParams(search), update };
}
