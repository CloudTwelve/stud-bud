import type { SVGProps } from "react";
import type { Metric } from "@/lib/types";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * One stroke weight, one 24-unit grid, straight cuts over curves: the icons are
 * drawn to sit on the same grid as the layout.
 */
function Frame({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      className="h-4 w-4"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ThermometerIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M10 4h4v10l2 2v4H8v-4l2-2V4Z" />
      <path d="M12 8v6" />
    </Frame>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 3 6 11v4l6 6 6-6v-4L12 3Z" />
      <path d="M9 13h6" />
    </Frame>
  );
}

export function SoundIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" />
    </Frame>
  );
}

export function LightIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 3 5 12h14L12 3Z" />
      <path d="M8 12v3h8v-3" />
      <path d="M12 15v6" />
    </Frame>
  );
}

export function SeatIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M7 4h10v8H7z" />
      <path d="M5 12h14v4H5z" />
      <path d="M7 16v4M17 16v4" />
    </Frame>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 4h7v16H4z" />
      <path d="M13 4h7v16h-7z" />
      <path d="M7 8h1M16 8h1" />
    </Frame>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </Frame>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </Frame>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 20h4v-6H4zM10 20h4V8h-4zM16 20h4V4h-4z" />
    </Frame>
  );
}

export function DogIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 9h12l4 3v5H4z" />
      <path d="M8 17v3M16 17v3" />
      <path d="M4 9 6 4l4 2" />
      <path d="M16 12h2" />
    </Frame>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M8 8h8v8H8z" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
    </Frame>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z" />
    </Frame>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Frame>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M13 2 5 13h6l-1 9 9-12h-7l1-8Z" />
    </Frame>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M3 8h18M6 13h12M10 18h4" />
    </Frame>
  );
}

export function WifiLowIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M10 18h4" />
      <path d="M3 8h4M17 8h4M6 13h2M16 13h2" opacity="0.4" />
    </Frame>
  );
}

export const METRIC_ICON: Record<Metric, (props: IconProps) => React.ReactElement> = {
  temperature: ThermometerIcon,
  humidity: DropletIcon,
  sound: SoundIcon,
  light: LightIcon,
  occupancy: SeatIcon,
};
