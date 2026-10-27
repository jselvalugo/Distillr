import { Toaster } from "sonner";
import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";

/**
 * App-wide notifications, styled with the organization's dashboard color
 * (the --brand CSS variable set from Settings → Branding). Falls back to the
 * default navy on pages rendered before the brand color loads (e.g. login).
 */
const BRAND = "var(--brand, #4F46E5)";

function StatusIcon({ children, tint }: { children: React.ReactNode; tint: string }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15"
      style={{ color: tint }}
    >
      {children}
    </span>
  );
}

export function BrandToaster() {
  return (
    <Toaster
      position="top-right"
      offset={16}
      gap={10}
      icons={{
        success: (
          <StatusIcon tint="#86efac">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
          </StatusIcon>
        ),
        error: (
          <StatusIcon tint="#fca5a5">
            <AlertCircle className="h-4 w-4" strokeWidth={2.25} />
          </StatusIcon>
        ),
        warning: (
          <StatusIcon tint="#fcd34d">
            <TriangleAlert className="h-4 w-4" strokeWidth={2.25} />
          </StatusIcon>
        ),
        info: (
          <StatusIcon tint="#ffffff">
            <Info className="h-4 w-4" strokeWidth={2.25} />
          </StatusIcon>
        ),
        loading: (
          <StatusIcon tint="#ffffff">
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          </StatusIcon>
        ),
      }}
      toastOptions={{
        unstyled: true,
        style: { background: BRAND },
        classNames: {
          toast:
            "group flex w-[356px] max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl px-4 py-3 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)] ring-1 ring-white/10 font-[inherit]",
          icon: "flex shrink-0 items-center",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "text-[13px] font-medium leading-snug text-white",
          description: "text-xs leading-snug text-white/70",
          actionButton:
            "ml-auto shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[var(--brand,#4F46E5)] hover:bg-white/90",
          cancelButton:
            "shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20",
          closeButton: "text-white/70 hover:text-white",
          // Thin status stripe on the left so errors still read as errors at a glance.
          error: "border-l-[3px] border-l-[#f87171]",
          success: "border-l-[3px] border-l-[#4ade80]",
          warning: "border-l-[3px] border-l-[#fbbf24]",
        },
      }}
    />
  );
}
