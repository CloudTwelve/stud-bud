import Link from "next/link";
import { LIVE_SPACE } from "@/lib/live";

/**
 * Every room except {@link LIVE_SPACE} is simulated, and a dashboard that
 * looks this live has to say so unprompted — the numbers are plausible enough
 * that nobody would otherwise ask.
 */
export default function DemoDataNotice({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs opacity-60">
        Simulated room — not wired to a real space yet.{" "}
        <Link href="/rooms" className="underline hover:opacity-100">
          {LIVE_SPACE.label}
        </Link>{" "}
        is the one running on hardware.
      </p>
    );
  }

  return (
    <aside className="panel-sm border-l-2 border-l-[var(--accent)] p-4 text-sm sm:p-5">
      <p className="eyebrow">Example data</p>
      <p className="mt-2 opacity-80">
        These rooms are simulated. The readings are generated so the scoring,
        trends and map have something to chew on — they are{" "}
        <strong className="font-semibold">not</strong> measurements of the real
        rooms at MIT, and nothing here is in those buildings today.
      </p>
      <p className="mt-2 opacity-80">
        The one exception is{" "}
        <strong className="font-semibold">{LIVE_SPACE.label}</strong> — its own
        tab, and the block ringed in teal on the map: for this project&apos;s
        demo the Arduino and robot dog sit in {LIVE_SPACE.where} and report what
        they can actually sense there. Point the same hardware at any room on
        this page and it stops being an example.
      </p>
    </aside>
  );
}
