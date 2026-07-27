"use client";

import { Star } from "lucide-react";

export default function RatingStars({
  value,
  onChange,
  size = 18,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
          aria-label={`${n}점`}
        >
          <Star
            size={size}
            className={n <= value ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
          />
        </button>
      ))}
    </div>
  );
}
