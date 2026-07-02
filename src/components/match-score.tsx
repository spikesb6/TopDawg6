import { cn } from "@/lib/utils";

/**
 * Circular match-score indicator (0–100), rendered as a conic-gradient ring.
 */
export function MatchScore({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-12 w-12 text-sm",
    md: "h-16 w-16 text-lg",
    lg: "h-20 w-20 text-xl",
  }[size];

  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#94a3b8";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full font-bold text-primary",
        dims
      )}
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, #e2e8f0 0deg)`,
      }}
      aria-label={`Match score ${score} out of 100`}
    >
      <span className="flex h-[78%] w-[78%] items-center justify-center rounded-full bg-white">
        {score}
      </span>
    </div>
  );
}
