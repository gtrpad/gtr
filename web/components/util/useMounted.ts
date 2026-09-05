"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
/** true after hydration, false during SSR and the first client render. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
