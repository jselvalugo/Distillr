import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080808",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: "#fff",
      padding: "32px",
      textAlign: "center",
    }}>
      {/* Logo mark */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px",
        }}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.5L13.5 4.5V9C13.5 11.985 11.09 14.5 8 14.5C4.91 14.5 2.5 11.985 2.5 9V4.5L8 1.5Z"
              stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
          Distillr
        </p>
      </div>

      {/* 404 */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 12px" }}>
        404 — Page not found
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 12px", lineHeight: 1.2 }}>
        This page doesn't exist.
      </h1>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: "0 0 36px", maxWidth: 340, lineHeight: 1.6 }}>
        The page you're looking for may have been moved or removed. Head back to your dashboard.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            fontSize: 13, fontWeight: 700, padding: "10px 22px", borderRadius: 10,
            background: "#fff", color: "#080808", border: "none", cursor: "pointer",
          }}
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 10,
            background: "transparent", color: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
