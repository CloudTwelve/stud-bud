"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { layoutCampus, PLAN, scoreFill } from "@/lib/campus";
import { isDemoSpace } from "@/lib/demo";
import { LIVE_SPACE } from "@/lib/live";
import { useStill } from "@/lib/motion";
import type { ScoredSpace } from "@/lib/types";
import { ArrowIcon, METRIC_ICON } from "./Icons";

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_WIDTH = 40;
const ZOOM_STEP = 1.4;
/** Pointer wander, in px, still counted as a click rather than a pan. */
const DRAG_SLOP = 4;

/** The room a gesture started on, if any. */
function roomAt(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<SVGGElement>("[data-space]")?.dataset.space ?? null;
}

function clampView(view: View, bounds: View): View {
  const w = Math.min(Math.max(view.w, MIN_WIDTH), bounds.w);
  const h = (w / bounds.w) * bounds.h;
  return {
    w,
    h,
    x: Math.min(Math.max(view.x, bounds.x), bounds.x + bounds.w - w),
    y: Math.min(Math.max(view.y, bounds.y), bounds.y + bounds.h - h),
  };
}

export default function CampusMap({ spaces }: { spaces: ScoredSpace[] }) {
  const router = useRouter();
  const still = useStill();
  const buildings = useMemo(() => layoutCampus(spaces), [spaces]);

  const bounds = useMemo<View>(() => {
    const bottom = buildings.reduce(
      (low, building) => Math.max(low, building.y + building.h + 6),
      PLAN.height,
    );
    return { x: 0, y: 0, w: PLAN.width, h: bottom };
  }, [buildings]);

  const [view, setView] = useState<View | null>(null);
  const current = view ?? bounds;
  const [activeId, setActiveId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    view: View;
    room: string | null;
    moved: boolean;
  } | null>(null);

  // spaces arrives in the dashboard's chosen order, so the first one is the
  // answer to whatever the reader is currently sorting by.
  const active = spaces.find((space) => space.id === activeId) ?? spaces[0] ?? null;

  const zoom = useCallback(
    (factor: number) => {
      setView((previous) => {
        const from = previous ?? bounds;
        const w = from.w / factor;
        return clampView(
          {
            w,
            h: w,
            x: from.x + (from.w - w) / 2,
            y: from.y + (from.h - (w / bounds.w) * bounds.h) / 2,
          },
          bounds,
        );
      });
    },
    [bounds],
  );

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      view: current,
      // Pointer capture retargets the click to the <svg>, so remember which
      // room the gesture started on and open it ourselves on release.
      room: roomAt(event.target),
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!start || !rect) return;
    const scale = start.view.w / rect.width;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_SLOP) {
      start.moved = true;
    }
    setView(
      clampView(
        {
          ...start.view,
          x: start.view.x - (event.clientX - start.x) * scale,
          y: start.view.y - (event.clientY - start.y) * scale,
        },
        bounds,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (event.type === "pointerup" && start && !start.moved && start.room) {
      router.push(`/space/${start.room}`);
    }
  };

  const zoomed = current.w < bounds.w - 0.5;

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
      <div className="panel relative isolate flex-1 overflow-hidden p-3 sm:p-4">
        <svg
          ref={svgRef}
          viewBox={`${current.x} ${current.y} ${current.w} ${current.h}`}
          className="h-[22rem] w-full cursor-grab touch-pan-y active:cursor-grabbing sm:h-[28rem]"
          role="group"
          aria-label="Campus map of monitored study spaces"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <defs>
            <pattern id="map-grid" width="8" height="8" patternUnits="userSpaceOnUse">
              <path
                d="M8 0H0v8"
                fill="none"
                stroke="var(--line)"
                strokeWidth="0.15"
                opacity="0.6"
              />
            </pattern>
          </defs>

          <rect
            x={bounds.x}
            y={bounds.y}
            width={bounds.w}
            height={bounds.h}
            fill="url(#map-grid)"
          />

          {/* One street, so the plan reads as a place rather than a chart. */}
          <line
            x1="0"
            y1="76"
            x2={bounds.w}
            y2="76"
            stroke="var(--line)"
            strokeWidth="0.6"
            strokeDasharray="4 3"
          />
          <text x="2" y="74.5" fontSize="2.4" fill="currentColor" opacity="0.4">
            MASS AVE
          </text>

          {buildings.map((building) => (
            <g key={building.name}>
              <path
                d={`M${building.x + 3} ${building.y} H${building.x + building.w} V${
                  building.y + building.h - 3
                } L${building.x + building.w - 3} ${building.y + building.h} H${
                  building.x
                } V${building.y + 3} Z`}
                fill="var(--surface-muted)"
                stroke="var(--line)"
                strokeWidth="0.3"
              />
              <text
                x={building.x + 3}
                y={building.y + 3.4}
                fontSize="2.6"
                fill="currentColor"
                opacity="0.55"
                style={{ letterSpacing: "0.12em" }}
              >
                {building.name.toUpperCase()}
              </text>

              {building.rooms.map(({ space, x, y, w, h }) => {
                const fullness = space.latest.totalSeats
                  ? space.latest.occupiedSeats / space.latest.totalSeats
                  : 0;
                const selected = space.id === activeId;
                const isLive = space.id === LIVE_SPACE.id;
                return (
                  <g
                    key={space.id}
                    role="link"
                    tabIndex={0}
                    aria-label={`${space.name}${isLive ? ", live hardware" : ""}, score ${
                      space.stale ? "unknown" : Math.round(space.verdict.score)
                    }`}
                    className={`cursor-pointer outline-none ${still ? "" : "transition-opacity"}`}
                    data-space={space.id}
                    onPointerEnter={() => setActiveId(space.id)}
                    onFocus={() => setActiveId(space.id)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      router.push(`/space/${space.id}`);
                    }}
                  >
                    <title>
                      {`${space.name}${isLive ? " (live hardware)" : ""} — ${space.verdict.headline}`}
                    </title>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={space.stale ? "var(--line)" : scoreFill(space.verdict.score)}
                      opacity={space.stale ? 0.35 : 0.85}
                    />
                    {/* Seats taken, filled from the floor up. */}
                    <rect
                      x={x}
                      y={y + h * (1 - fullness)}
                      width={w}
                      height={h * fullness}
                      fill="var(--foreground)"
                      opacity="0.18"
                    />
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill="none"
                      stroke={
                        selected
                          ? "var(--foreground)"
                          : isLive
                            ? "var(--brand)"
                            : "var(--line-strong)"
                      }
                      strokeWidth={selected ? 0.6 : isLive ? 0.5 : 0.25}
                    />
                    {/* The one room that is real gets a marker, not just a
                        tint: on a map of simulated rooms it has to be told
                        apart at a glance. */}
                    {isLive && (
                      <circle
                        cx={x + w - 1.6}
                        cy={y + 1.6}
                        r="0.9"
                        fill="var(--brand)"
                        className={still ? undefined : "map-live-pip"}
                      />
                    )}
                    <text
                      x={x + w / 2}
                      y={y + h / 2 + 1.1}
                      textAnchor="middle"
                      fontSize={Math.min(4, w / 3)}
                      fontWeight="600"
                      fill="var(--on-accent)"
                    >
                      {space.stale ? "—" : Math.round(space.verdict.score)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        <div className="absolute right-4 bottom-4 flex gap-1.5">
          <button
            type="button"
            onClick={() => zoom(ZOOM_STEP)}
            aria-label="Zoom in"
            className="panel-sm clip-tag px-3 py-1 text-sm font-semibold"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoom(1 / ZOOM_STEP)}
            aria-label="Zoom out"
            className="panel-sm clip-tag px-3 py-1 text-sm font-semibold"
          >
            −
          </button>
          {zoomed && (
            <button
              type="button"
              onClick={() => setView(null)}
              className="panel-sm clip-tag px-3 py-1 text-xs font-medium"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <aside className="panel flex w-full flex-col gap-3 p-5 lg:max-w-xs">
        <p className="eyebrow">Readout</p>
        {active ? (
          <>
            <div>
              <p className="text-lg font-semibold">{active.name}</p>
              <p className="text-sm opacity-60">
                {active.building}
                {active.id === LIVE_SPACE.id
                  ? " \u00b7 live hardware"
                  : isDemoSpace(active.id)
                    ? " \u00b7 example data"
                    : ""}
              </p>
            </div>
            <p className="text-4xl font-semibold tabular-nums">
              {active.stale ? "—" : Math.round(active.verdict.score)}
              <span className="ml-1 text-base font-normal opacity-50">/100</span>
            </p>
            <p className="text-sm opacity-80">
              {active.stale
                ? "No recent sweep, so these numbers are history rather than news."
                : active.verdict.summary}
            </p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {active.verdict.metrics.map((metric) => {
                const Icon = METRIC_ICON[metric.metric];
                return (
                <div key={metric.metric} className="panel-sm flex items-center gap-2 p-2">
                  <Icon className="h-4 w-4 text-brand" />
                  <div>
                    <dt className="text-[0.65rem] uppercase opacity-50">{metric.label}</dt>
                    <dd className="font-medium tabular-nums">{metric.value}</dd>
                  </div>
                </div>
                );
              })}
            </dl>
            <Link
              href={`/space/${active.id}`}
              className="clip-tag on-accent mt-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"
            >
              Open room
              <ArrowIcon className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <p className="text-sm opacity-60">
            No rooms on the map yet — the dog has not reported in.
          </p>
        )}
        <p className="border-t border-line pt-3 text-xs opacity-55">
          Blocks are rooms, tinted teal (go) to orange (think twice); the shaded
          part is how full the room is. Hover or tab to read one, click to open
          it, drag to pan. The block ringed in teal is {LIVE_SPACE.name} — the
          only room here reading from real hardware.
        </p>
      </aside>
    </section>
  );
}
