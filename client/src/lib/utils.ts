import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(date: string | null | undefined) {
  if (!date) return "—";
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by Date(),
  // causing off-by-one in any timezone behind UTC. Append local midnight instead.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(date + "T00:00:00")
    : new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtNum(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}
