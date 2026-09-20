"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** useLayoutEffect warns when the tree is rendered on the server. */
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const LITE_KEY = "studbud-lite";
const LITE_CLASS = "lite";

/**
 * Low-WiFi mode lives as a class on <html>, the same way the theme does, so a
 * blocking script can apply it before first paint and CSS can switch effects
 * off without any component knowing about it.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export function useLiteMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains(LITE_CLASS),
    () => false,
  );
}

export function setLiteMode(on: boolean): void {
  document.documentElement.classList.toggle(LITE_CLASS, on);
  try {
    localStorage.setItem(LITE_KEY, on ? "1" : "0");
  } catch {}
}

const REDUCED = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Low-WiFi mode and the OS reduced-motion setting mean the same thing here. */
export function useStill(): boolean {
  const lite = useLiteMode();
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );

  return lite || reduced;
}

const DURATION = 650;

/**
 * Eases a displayed number towards a new one so a score change is watchable.
 * `shown` is null whenever nothing is in flight, so the target is the single
 * source of truth at rest — a leftover value can't resurface when motion is
 * switched back on after a score changed with the animation disabled.
 */
export function useAnimatedNumber(target: number): number {
  const still = useStill();
  const [shown, setShown] = useState<number | null>(null);
  const from = useRef(target);

  useEffect(() => {
    if (still) {
      from.current = target;
      return;
    }
    const origin = from.current;
    if (origin === target) {
      const settle = requestAnimationFrame(() => setShown(null));
      return () => cancelAnimationFrame(settle);
    }

    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - progress) ** 3;
      const value = origin + (target - origin) * eased;
      from.current = progress < 1 ? value : target;
      setShown(progress < 1 ? value : null);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, still]);

  return still ? target : (shown ?? target);
}

/**
 * FLIP: measure where each card was, let React reorder the DOM, then animate
 * each card from its old box to its new one. Without this a room overtaking
 * another just teleports, which is the moment the ranking is doing its job.
 */
export function useReorderAnimation(order: string[]): (
  id: string,
) => (node: HTMLElement | null) => void {
  const still = useStill();
  const nodes = useRef(new Map<string, HTMLElement>());
  const boxes = useRef(new Map<string, DOMRect>());
  const key = order.join("|");

  useBeforePaint(() => {
    for (const [id, node] of nodes.current) {
      const previous = boxes.current.get(id);
      const next = node.getBoundingClientRect();
      boxes.current.set(id, next);
      if (still || !previous) continue;

      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

      node.animate(
        [{ transform: `translate3d(${dx}px, ${dy}px, 0)` }, { transform: "none" }],
        { duration: 520, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
      );
    }
  }, [key, still]);

  // Cached so each card keeps the same callback identity across renders:
  // a fresh function would be detached and reattached every render, and the
  // detach would throw away the position this animation is measured against.
  const callbacks = useRef(new Map<string, (node: HTMLElement | null) => void>());

  return (id: string) => {
    const existing = callbacks.current.get(id);
    if (existing) return existing;
    const callback = (node: HTMLElement | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    };
    callbacks.current.set(id, callback);
    return callback;
  };
}
