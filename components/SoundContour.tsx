/**
 * Decorative abstract contour lines inspired by Puget Sound shorelines.
 * Purely decorative — hidden from assistive technology.
 */
export function SoundContour({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 320"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <path
        d="M-20 60C120 30 200 110 340 84S560 10 700 44s140 60 140 60"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      <path
        d="M-20 120C110 90 230 170 370 140S570 70 720 104s120 50 120 50"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.4"
      />
      <path
        d="M-20 185C130 150 250 235 390 200S600 130 740 165s100 40 100 40"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.3"
      />
      <path
        d="M-20 250C140 215 260 295 400 262S610 195 750 230s90 35 90 35"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.2"
      />
    </svg>
  );
}
