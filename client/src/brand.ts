/**
 * Distillr brand tokens — from the brand kit README.
 * Use these instead of ad-hoc hex values so every surface stays on-brand.
 */
export const BRAND = {
  indigo: "#4F46E5", // mark, primary accent, app icon
  indigoLight: "#818CF8", // mark on dark backgrounds
  indigoDeep: "#3730A3", // hover / pressed
  ink: "#0F172A", // Slate Ink — wordmark, body text
  inkSoft: "#475569",
  inkMuted: "#94A3B8",
  paper: "#F8FAFC", // Paper — light backgrounds
  paperEdge: "#E2E8F0",
  night: "#0B0D12", // Night — dark backgrounds
  nightRaised: "#13161F",
} as const;

/** Plus Jakarta Sans for headings and the wordmark; system sans for body. */
export const FONT_DISPLAY = "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_BODY = "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Default dashboard color for organizations that haven't chosen their own. */
export const DEFAULT_DASHBOARD_COLOR = BRAND.indigo;
