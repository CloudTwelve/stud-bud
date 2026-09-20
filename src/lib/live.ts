/**
 * The one room wired to real hardware right now. Everything else on the
 * dashboard is the idealized campus we demo; this is the room the dog and the
 * UNO Q are actually standing in, so it is never seeded and shows nothing at
 * all until the hardware posts.
 */
export const LIVE_SPACE = {
  id: "stud-5-lounge",
  name: "Stud 5 Lounge",
  building: "W20",
  /** What the tab calls it. */
  label: "Stud 5 Lounge (W20)",
} as const;
