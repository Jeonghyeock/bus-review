"use client";

export default function RatingStars({
  value,
  onChange,
  size = 20,
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
          className={n <= value ? "text-yellow-400" : "text-gray-300"}
          style={{ fontSize: size, lineHeight: 1, cursor: onChange ? "pointer" : "default" }}
          aria-label={`${n}점`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
