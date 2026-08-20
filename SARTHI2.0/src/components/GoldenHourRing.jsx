import { useEffect, useState } from "react";

const GOLDEN_HOUR_MS = 60 * 60 * 1000;
const SIZE = 52;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

// The pitch's central idea is the "golden hour" — this ring makes that
// literal on every referral card: it fills as time elapses since the
// referral was created, and its color shifts calm -> urgent as the
// clinically meaningful hour runs out. Frozen once the case is resolved.
export default function GoldenHourRing({ createdAt, resolved }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (resolved) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resolved]);

  const elapsed = (resolved ? resolved : now) - createdAt;
  const fraction = Math.min(1, elapsed / GOLDEN_HOUR_MS);
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  const color = resolved
    ? "#22B573"
    : fraction < 0.5
    ? "#22B573"
    : fraction < 0.85
    ? "#F2A93B"
    : "#FF6B4A";

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke="#E3E9E8" strokeWidth={STROKE} fill="none" />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - fraction)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
        />
      </svg>
      <span className="absolute text-[10px] font-bold font-display leading-none" style={{ color }}>
        {mins}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  );
}
