import { type ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
}

export function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#737373] font-medium uppercase tracking-wide">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#0a0a0a] tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[#737373]">{sub}</p>}
        </div>
        {icon && <div className="text-[#737373]">{icon}</div>}
      </div>
    </div>
  );
}
