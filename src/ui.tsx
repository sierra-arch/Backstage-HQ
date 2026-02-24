// ui.tsx
import React from "react";
import { CompanyName, DBTask } from "./types";

export function LevelRing({
  level,
  value,
  max,
  showStats = true,
  size = 132,
  stroke = 16,
}: {
  level: number;
  value: number;
  max: number;
  showStats?: boolean;
  size?: number;
  stroke?: number;
}) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const r = size / 2 - stroke - 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);

  const ringSvg = (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} stroke="#E5E7EB" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
        stroke="#0F766E" fill="none" strokeLinecap="round"
        style={{ strokeDasharray: c, strokeDashoffset: off, transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
      />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        fontSize={Math.max(12, Math.round(size * 0.18))} fill="#0F172A">
        L{level}
      </text>
    </svg>
  );

  if (!showStats) return <div>{ringSvg}</div>;
  return (
    <div className="flex items-center gap-3">
      {ringSvg}
      <div>
        <div className="text-lg font-semibold">{pct}%</div>
        <div className="text-xs text-neutral-500">to next level</div>
      </div>
    </div>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[12px] rounded-full border bg-teal-50 text-teal-900/80 px-3 py-1">
      {children}
    </span>
  );
}

export function Card({
  title,
  subtitle,
  children,
  className = "",
  variant = "default",
  onClick,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "compact";
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <section
      onClick={onClick}
      className={`rounded-2xl border border-neutral-200 bg-white ${
        variant === "compact" ? "p-4 md:p-5" : "p-5 md:p-6"
      } shadow-sm ${className} ${
        onClick ? "cursor-pointer hover:border-teal-300 transition-colors" : ""
      }`}
    >
      {(title || subtitle || action) && (
        <header className="mb-2 md:mb-3 flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[14px] md:text-[15px] font-semibold leading-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs md:text-[13px] text-neutral-500">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Avatar({
  name,
  size = 24,
  photoUrl,
}: {
  name: string;
  size?: number;
  photoUrl?: string;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        title={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initials = name
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
  const palette = ["#0F766E", "#166534", "#065F46", "#064E3B", "#0B4D4B"];
  const color =
    palette[
      (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % palette.length
    ];
  return (
    <div
      title={name}
      className="flex items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(10, Math.round(size * 0.4)),
      }}
    >
      {initials}
    </div>
  );
}

export function CompanyChip({
  name,
  showLogo = true,
}: {
  name: string;
  showLogo?: boolean;
}) {
  const map: any = {
    "Prose Florals": {
      bg: "bg-lime-50",
      text: "text-lime-900/80",
      border: "border-lime-200",
      logo: "🌸",
    },
    Backstage: {
      bg: "bg-teal-100",
      text: "text-teal-900/90",
      border: "border-teal-300",
      logo: "🎯",
    },
    "Mairé": {
      bg: "bg-emerald-50",
      text: "text-emerald-900/80",
      border: "border-emerald-200",
      logo: "✨",
    },
  };
  const s = map[name] || {
    bg: "bg-neutral-50",
    text: "text-neutral-800",
    border: "border-neutral-200",
    logo: "📦",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full border ${s.bg} ${s.text} ${s.border} inline-flex items-center gap-1`}
    >
      {name}
    </span>
  );
}

// Shared helper: remaining breakdown
export function remainingBreakdown(companyName: string, tasks: DBTask[]) {
  const remaining = tasks.filter(
    (t) =>
      t.company_name === companyName &&
      t.status !== "completed" &&
      t.status !== "archived"
  );
  return {
    small: remaining.filter((t) => t.impact === "small").length,
    medium: remaining.filter((t) => t.impact === "medium").length,
    large: remaining.filter((t) => t.impact === "large").length,
    total: remaining.length,
  };
}
