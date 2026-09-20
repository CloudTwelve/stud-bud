import type { ScoredSpace } from "./types";

/**
 * The map is a schematic, not a survey: rooms have no coordinates in the
 * ingest payload, so a building gets a plot on an abstract campus and its
 * rooms are laid out inside that plot. Known buildings keep a fixed plot so
 * the map looks the same between sweeps; anything the hardware invents takes
 * the next free plot, in name order, so a new room never lands on top of an
 * existing one.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoomPlot extends Box {
  space: ScoredSpace;
}

export interface BuildingPlot extends Box {
  name: string;
  rooms: RoomPlot[];
}

export const PLAN = { width: 160, height: 104 };

/** Ordered plots. Named ones are reserved; the rest absorb unknown buildings. */
const PLOTS: { name?: string; box: Box }[] = [
  { name: "Building 32", box: { x: 10, y: 8, w: 40, h: 26 } },
  { name: "Building 26", box: { x: 56, y: 8, w: 30, h: 22 } },
  { name: "Building 7", box: { x: 92, y: 8, w: 26, h: 22 } },
  { name: "W20", box: { x: 8, y: 42, w: 32, h: 30 } },
  { name: "Building 10", box: { x: 62, y: 38, w: 34, h: 26 } },
  { name: "Building 14", box: { x: 104, y: 38, w: 30, h: 26 } },
  { name: "Building 2", box: { x: 124, y: 8, w: 26, h: 22 } },
  { box: { x: 8, y: 80, w: 30, h: 18 } },
  { box: { x: 46, y: 80, w: 30, h: 18 } },
  { box: { x: 84, y: 80, w: 30, h: 18 } },
  { box: { x: 122, y: 80, w: 30, h: 18 } },
];

/** Overflow plots, generated below the plan so the map simply grows. */
function overflowPlot(index: number): Box {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 8 + column * 38, y: 104 + row * 24, w: 30, h: 18 };
}

const PAD = 3;
const GAP = 2;
/** Below this a block is too small to hit, so the plot grows instead. */
const MIN_CELL = 5;

/**
 * Lay rooms out inside a plot, widening the grid before it runs out of height
 * and then growing the plot itself, so a block never collapses to nothing.
 */
function packRooms(
  building: Box,
  spaces: ScoredSpace[],
): { box: Box; rooms: RoomPlot[] } {
  const inner = {
    x: building.x + PAD,
    y: building.y + PAD + 4,
    w: building.w - PAD * 2,
    h: building.h - PAD * 2 - 4,
  };
  const fits = (extent: number) => Math.max(1, Math.floor((extent + GAP) / (MIN_CELL + GAP)));
  const columns = Math.max(
    1,
    Math.min(
      fits(inner.w),
      Math.max(Math.ceil(Math.sqrt(spaces.length)), Math.ceil(spaces.length / fits(inner.h))),
    ),
  );
  const rows = Math.ceil(spaces.length / columns);
  const height = Math.max(inner.h, rows * MIN_CELL + (rows - 1) * GAP);
  const cellWidth = (inner.w - GAP * (columns - 1)) / columns;
  const cellHeight = (height - GAP * (rows - 1)) / rows;

  return {
    box: { ...building, h: building.h + (height - inner.h) },
    rooms: spaces.map((space, index) => ({
      space,
      x: inner.x + (index % columns) * (cellWidth + GAP),
      y: inner.y + Math.floor(index / columns) * (cellHeight + GAP),
      w: cellWidth,
      h: cellHeight,
    })),
  };
}

export function layoutCampus(spaces: ScoredSpace[]): BuildingPlot[] {
  const byBuilding = new Map<string, ScoredSpace[]>();
  for (const space of spaces) {
    const key = space.building || "Unmapped";
    const group = byBuilding.get(key);
    if (group) group.push(space);
    else byBuilding.set(key, [space]);
  }

  const taken = new Set<number>();
  const placed = new Map<string, Box>();

  for (const name of byBuilding.keys()) {
    const index = PLOTS.findIndex((plot) => plot.name === name);
    if (index === -1) continue;
    taken.add(index);
    placed.set(name, PLOTS[index].box);
  }

  const free = PLOTS.map((plot, index) => ({ plot, index }))
    .filter(({ plot, index }) => !plot.name && !taken.has(index))
    .map(({ plot }) => plot.box);

  const unplaced = [...byBuilding.keys()].filter((name) => !placed.has(name)).sort();
  unplaced.forEach((name, index) => {
    placed.set(name, free[index] ?? overflowPlot(index - free.length));
  });

  return [...byBuilding.entries()]
    .map(([name, group]) => {
      const { box, rooms } = packRooms(placed.get(name) as Box, group);
      return { name, ...box, rooms };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Teal at 100, orange at 0 — the same ramp the score numbers walk. */
export function scoreFill(score: number): string {
  const mix = Math.max(0, Math.min(100, Math.round(score)));
  return `color-mix(in srgb, var(--brand) ${mix}%, var(--accent))`;
}
