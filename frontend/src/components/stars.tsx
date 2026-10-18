import { cn } from "@/lib/cn";

const STAR_PATH =
  "M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z";

/** One star; `fill` from 0 to 1 draws partial stars (e.g. 0.5 for 4.5). */
export function StarIcon({ fill, className }: { fill: number; className?: string }) {
  return (
    <span className={cn("relative inline-block", className)}>
      <svg viewBox="0 0 20 20" className="absolute inset-0 size-full text-slate-200" aria-hidden>
        <path d={STAR_PATH} fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 20 20"
        className="absolute inset-0 size-full text-amber-400"
        style={{ clipPath: `inset(0 ${100 - fill * 100}% 0 0)` }}
        aria-hidden
      >
        <path d={STAR_PATH} fill="currentColor" />
      </svg>
    </span>
  );
}

export function Stars({
  value,
  size = "md",
  className,
}: {
  value: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-3.5", md: "size-4", lg: "size-6" };
  const rating = value ?? 0;
  return (
    <span
      role="img"
      aria-label={value === null ? "Not rated yet" : `${value.toFixed(1)} out of 5 stars`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          className={sizes[size]}
          fill={Math.max(0, Math.min(1, rating - star + 1))}
        />
      ))}
    </span>
  );
}
