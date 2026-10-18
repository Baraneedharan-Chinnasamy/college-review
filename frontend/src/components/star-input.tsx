"use client";

import { useState } from "react";

import { StarIcon } from "./stars";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Accessible 1–5 star picker (a radio group). */
export function StarInput({
  value,
  onChange,
  invalid,
}: {
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Rating"
        aria-invalid={invalid || undefined}
        className="flex gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            className="rounded p-0.5 transition-transform hover:scale-110"
          >
            <StarIcon className="size-7" fill={star <= shown ? 1 : 0} />
          </button>
        ))}
      </div>
      <span className="text-sm text-slate-500">{LABELS[shown] || "Select a rating"}</span>
    </div>
  );
}
