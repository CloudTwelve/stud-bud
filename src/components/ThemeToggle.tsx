"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("studbud-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={dark}
      className="card group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition hover:scale-[1.03] active:scale-95"
    >
      <span className="text-base leading-none" aria-hidden="true">
        {dark ? "🌙" : "☀️"}
      </span>
      <span className="hidden sm:inline">{dark ? "Dark" : "Light"} mode</span>
    </button>
  );
}
