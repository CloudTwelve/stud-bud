"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./Icons";

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
      className="panel-sm clip-tag flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong active:translate-y-0"
    >
      {dark ? (
        <MoonIcon className="h-4 w-4 text-brand" />
      ) : (
        <SunIcon className="h-4 w-4 text-accent" />
      )}
      <span className="hidden sm:inline">{dark ? "Dark" : "Light"} mode</span>
    </button>
  );
}
