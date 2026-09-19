"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("studbud-theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      aria-pressed={mounted ? dark : undefined}
      className="card group flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-sm transition hover:scale-[1.03] active:scale-95"
    >
      <span className="text-base leading-none" aria-hidden="true">
        {mounted && dark ? "🌙" : "☀️"}
      </span>
      <span className="hidden sm:inline">
        {mounted && dark ? "Dark" : "Light"} mode
      </span>
    </button>
  );
}
