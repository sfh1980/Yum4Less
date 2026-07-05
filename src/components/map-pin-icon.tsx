type MapPinIconProps = {
  className?: string;
  size?: number;
  "aria-hidden"?: boolean;
};

/** Lucide-style map pin (inline SVG — avoids lucide-react peer conflict with React 19). */
export function MapPinIcon({
  className,
  size = 16,
  "aria-hidden": ariaHidden = true,
}: MapPinIconProps) {
  return (
    <svg
      aria-hidden={ariaHidden}
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2.25}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
