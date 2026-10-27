import { BRAND, FONT_DISPLAY } from "../../brand";

type Variant = "primary" | "reversed" | "mono-white";

/** Full lockup: funnel mark + "distillr" wordmark. 241.92 × 49.216 viewBox. */
export function DistillrLogo({ variant = "primary", height = 28, className, title = "Distillr" }: { variant?: Variant; height?: number; className?: string; title?: string }) {
  return <img src={`/brand/logo-${variant}.svg`} alt={title} height={height} style={{ height, width: "auto", display: "block" }} className={className} draggable={false} />;
}

/** The funnel mark on its own. 44 × 37 viewBox. */
export function DistillrMark({ variant = "primary", size = 22, className, title = "Distillr" }: { variant?: Variant; size?: number; className?: string; title?: string }) {
  return <img src={`/brand/mark-${variant}.svg`} alt={title} width={size} height={Math.round((size * 37) / 44)} style={{ display: "block" }} className={className} draggable={false} />;
}

/** "distillr" wordmark only. 167.424 × 49.216 viewBox. */
export function DistillrWordmark({ variant = "primary", height = 20, className }: { variant?: Variant; height?: number; className?: string }) {
  return <img src={`/brand/wordmark-${variant}.svg`} alt="distillr" height={height} style={{ height, width: "auto", display: "block" }} className={className} draggable={false} />;
}

/** Inline mark drawn in any color (for places that need currentColor, e.g. the app header on a tenant's color). */
export function DistillrMarkInline({ size = 22, color = BRAND.indigo, className }: { size?: number; color?: string; className?: string }) {
  const h = (size * 37) / 44;
  return (
    <svg width={size} height={h} viewBox="0 0 44 37" role="img" aria-label="Distillr" className={className}>
      <rect x="0" y="0" width="44" height="9" rx="4.5" fill={color} />
      <rect x="7" y="14" width="30" height="9" rx="4.5" fill={color} fillOpacity="0.75" />
      <rect x="15" y="28" width="14" height="9" rx="4.5" fill={color} fillOpacity="0.5" />
    </svg>
  );
}

/** "Powered by distillr" tag for tenant-branded surfaces. */
export function PoweredBy({ tone = "light" }: { tone?: "light" | "dark" }) {
  const color = tone === "light" ? "rgba(255,255,255,0.55)" : BRAND.inkMuted;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color, fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      Powered by
      <img src={tone === "light" ? "/brand/wordmark-mono-white.svg" : "/brand/wordmark-primary.svg"} alt="distillr" style={{ height: 11, width: "auto", opacity: tone === "light" ? 0.8 : 1 }} draggable={false} />
    </span>
  );
}
