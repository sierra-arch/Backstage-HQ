// ui.tsx
import React from "react";
import { CompanyName, DBTask } from "./types";

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
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "compact";
  onClick?: () => void;
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
      {(title || subtitle) && (
        <header className="mb-2 md:mb-3">
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
