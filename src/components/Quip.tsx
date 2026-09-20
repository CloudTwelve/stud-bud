"use client";

import { useEffect, useState } from "react";
import { useStill } from "@/lib/motion";

const QUIPS = [
  "IHTFP — I Have Truly Found Paradise. It was the third floor of Hayden, 2 a.m., 38 dB.",
  "Measured in dB, lux and °C. Regrettably, not in Smoots.",
  "Built at HackMIT, mostly in rooms this thing would have scored a 41.",
  "If every room is loud and full, that is not a bug. That is finals.",
  "The dog does the walking so you can stay hosed in one place.",
  "Drinking from the firehose goes down easier at 35 dB.",
];

const ROTATE_MS = 15000;

/**
 * Starts on the first line so the server's HTML matches, then rotates on a
 * timer — picking at random during render would be a hydration mismatch.
 */
export default function Quip() {
  const [index, setIndex] = useState(0);
  const still = useStill();

  useEffect(() => {
    if (still) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % QUIPS.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [still]);

  return (
    <p className="mt-4 border-t border-line pt-3 text-xs italic opacity-50">
      {QUIPS[index]}
    </p>
  );
}
