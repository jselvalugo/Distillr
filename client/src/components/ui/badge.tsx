import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--brand)] text-white",
  success: "bg-[#f0faf0] text-[#166534] border border-[#bbf7d0]",
  warning: "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]",
  danger: "bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]",
  muted: "bg-[#f7f7f7] text-[#737373] border border-[#e5e5e5]",
};

export function Badge({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

export function statusBadge(status: string): ReactNode {
  const s = status?.toLowerCase() ?? "";
  if (["active", "approved", "fulfilled", "completed", "filled", "aging", "ready", "in bond"].includes(s))
    return <Badge variant="success">{status}</Badge>;
  if (["draft", "scheduled", "in progress", "pending review", "expiring soon"].includes(s))
    return <Badge variant="warning">{status}</Badge>;
  if (["expired", "missing", "blocked", "retired", "cancelled", "revoked"].includes(s))
    return <Badge variant="danger">{status}</Badge>;
  if (["inactive", "prospective", "superseded", "dumped"].includes(s))
    return <Badge variant="muted">{status}</Badge>;
  return <Badge variant="default">{status}</Badge>;
}
