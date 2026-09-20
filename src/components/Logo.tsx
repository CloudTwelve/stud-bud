import Image from "next/image";

const WIDTH = 1119;
const HEIGHT = 166;

/* The wordmark is white, so light mode gets an ink-coloured copy of the same
   artwork rather than a filter. */
export default function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <span className={`inline-flex ${className}`}>
      <Image
        src="/studbud-logo-light.png"
        alt="Stud-Bud"
        width={WIDTH}
        height={HEIGHT}
        priority
        className="h-full w-auto dark:hidden"
      />
      <Image
        src="/studbud-logo-dark.png"
        alt=""
        width={WIDTH}
        height={HEIGHT}
        priority
        aria-hidden
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
