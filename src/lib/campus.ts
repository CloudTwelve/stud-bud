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

function packRooms(building: Box, spaces: ScoredSpace[]): RoomPlot[] {
  const pad = 3;
  const gap = 2;
  const inner = {
    x: building.x + pad,
    y: building.y + pad + 4,
    w: building.w - pad * 2,
    h: building.h - pad * 2 - 4,
  };
  const columns = Math.ceil(Math.sqrt(spaces.length));
  const rows = Math.ceil(spaces.length / columns);
  const cellWidth = (inner.w - gap * (columns - 1)) / columns;
  const cellHeight = (inner.h - gap * (rows - 1)) / rows;

  return spaces.map((space, index) => ({
    space,
    x: inner.x + (index % columns) * (cellWidth + gap),
    y: inner.y + Math.floor(index / columns) * (cellHeight + gap),
    w: cellWidth,
    h: cellHeight,
  }));
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
      const box = placed.get(name) as Box;
      return { name, ...box, rooms: packRooms(box, group) };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Teal at 100, orange at 0 — the same ramp the score numbers walk. */
export function scoreFill(score: number): string {
  const mix = Math.max(0, Math.min(100, Math.round(score)));
  return `color-mix(in srgb, var(--brand) ${mix}%, var(--accent))`;
}
