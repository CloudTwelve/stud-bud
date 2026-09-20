/**
 * The rooms the app invents for itself. Nothing in the database records where
 * a reading came from, so provenance lives here: these ids are the seeded
 * campus, and anything else arrived over the ingest API from real hardware.
 */
export const DEMO_SPACE_IDS = [
  "hayden-reading-room",
  "stud-cafe",
  "barker-dome",
  "stata-basement",
] as const;

export type DemoSpaceId = (typeof DEMO_SPACE_IDS)[number];

const IDS: ReadonlySet<string> = new Set(DEMO_SPACE_IDS);

export function isDemoSpace(id: string): boolean {
  return IDS.has(id);
}
