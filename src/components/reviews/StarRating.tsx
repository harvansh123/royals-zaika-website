"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (val: number) => void;
  size?: number;
  readonly?: boolean;
  showLabel?: boolean;
  className?: string;
}

const LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};

export default function StarRating({
  value,
  onChange,
  size = 24,
  readonly = false,
  showLabel = false,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  const display = hovered > 0 ? hovered : value;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={cn(
            "transition-transform duration-100",
            !readonly && "hover:scale-110 cursor-pointer",
            readonly && "cursor-default"
          )}
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            size={size}
            className={cn(
              "transition-colors duration-100",
              star <= display
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-300 fill-transparent",
              !readonly && star <= (hovered || value) && "drop-shadow-sm"
            )}
          />
        </button>
      ))}
      {showLabel && display > 0 && (
        <span className="ml-1 text-sm font-medium text-yellow-500">
          {LABELS[display]}
        </span>
      )}
    </div>
  );
}

// Compact read-only display (e.g. on menu cards)
export function StarDisplay({
  rating,
  count,
  size = 12,
  className,
}: {
  rating: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  if (!rating || rating === 0) return null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Star size={size} className="text-yellow-400 fill-yellow-400" />
      <span className="font-semibold text-yellow-400" style={{ fontSize: size }}>
        {rating.toFixed(1)}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-gray-500" style={{ fontSize: size }}>
          ({count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count})
        </span>
      )}
    </span>
  );
}
