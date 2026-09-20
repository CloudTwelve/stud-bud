"use client";

import { setLiteMode, useLiteMode } from "@/lib/motion";
import { WifiIcon, WifiLowIcon } from "./Icons";

export default function LiteToggle() {
  const lite = useLiteMode();

  return (
    <button
      type="button"
      onClick={() => setLiteMode(!lite)}
      aria-label="Toggle low-WiFi mode"
      aria-pressed={lite}
      title={
        lite
          ? "Low-WiFi mode: animations and background effects are off."
          : "Low-WiFi mode: drop the animations, keep the data. For bad WiFi, old laptops, and the unimpressed."
      }
      className="panel-sm clip-tag flex items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong active:translate-y-0"
    >
      {lite ? (
        <WifiLowIcon className="h-4 w-4 text-accent" />
      ) : (
        <WifiIcon className="h-4 w-4 text-brand" />
      )}
      <span className="hidden sm:inline">Low-WiFi {lite ? "on" : "off"}</span>
    </button>
  );
}
