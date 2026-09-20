"use client";

import Link from "next/link";
import { LIVE_SPACE } from "@/lib/live";
import type { ScoredSpace } from "@/lib/types";
import { ArrowIcon, DogIcon, SignalIcon } from "./Icons";
import SpaceCard, { timeAgo } from "./SpaceCard";

const PAYLOAD = `POST /api/readings
{
  "spaceId": "${LIVE_SPACE.id}",
  "name": "${LIVE_SPACE.name}",
  "building": "${LIVE_SPACE.building}",
  "temperature": 21.4,
  "humidity": 42,
  "sound": 34,
  "light": 520,
  "occupiedSeats": 6,
  "totalSeats": 18
}`;

interface LiveRoomProps {
  space: ScoredSpace | null;
}

/**
 * The hardware tab. No seed data ever lands here, so an empty state is the
 * honest answer until the board posts — a fake number on this tab would be the
 * one lie the demo can't afford.
 */
export default function LiveRoom({ space }: LiveRoomProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="panel border-l-2 border-l-[var(--brand)] p-5 sm:p-6">
        <p className="eyebrow">
          <DogIcon className="h-4 w-4" />
          Live hardware
        </p>
        <p className="mt-2 text-xl font-semibold sm:text-2xl">{LIVE_SPACE.label}</p>
        <p className="mt-1 max-w-2xl text-sm opacity-75">
          {space
            ? `Real sensors, real seats, no synthetic data — last sweep ${timeAgo(
                space.latest.recordedAt,
              )}.`
            : "Real sensors only. Nothing has posted yet, so there is nothing to show — this tab stays empty rather than inventing a room."}
        </p>
      </div>

      {space ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 md:gap-6">
            <SpaceCard space={space} />
          </div>
          <Link
            href={`/space/${space.id}`}
            className="panel-sm clip-tag flex w-fit items-center gap-2 px-4 py-2 text-sm font-medium transition hover:-translate-y-0.5 hover:border-line-strong"
          >
            Open the full history
            <ArrowIcon className="h-4 w-4 text-accent" />
          </Link>
        </>
      ) : (
        <div className="panel p-5 text-sm sm:p-6">
          <p className="eyebrow">
            <SignalIcon className="h-4 w-4" />
            Waiting for the first sweep
          </p>
          <p className="mt-2 opacity-75">
            Point the UNO Q (and the dog, for seats) at this server and post the
            payload below. The room appears the moment it arrives — no restart,
            no config on this side. The first post has to carry seat counts;
            after that either device can send only what it measures.
          </p>
          <pre className="clip-tag mt-3 overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-xs text-[color:var(--brand-soft)]">
            {PAYLOAD}
          </pre>
          <p className="mt-3 opacity-75">
            Full wiring steps are in{" "}
            <code className="font-mono text-xs">docs/LIVE-DEMO.md</code>, and{" "}
            <Link href="/test" className="text-brand underline-offset-2 hover:underline">
              the test bench
            </Link>{" "}
            can post a sweep for you if you want to prove the path before the
            hardware is ready.
          </p>
        </div>
      )}
    </section>
  );
}
