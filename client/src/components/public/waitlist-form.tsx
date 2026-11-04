import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { apiRequest } from "../../lib/queryClient";

/**
 * Compact waitlist capture for the landing hero. Distillr is licensed —
 * there is no self-service signup; submissions land in the admin
 * dashboard's Waitlist and accounts are provisioned by hand.
 */
export function HeroWaitlistForm({ onSignIn }: { onSignIn: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", distilleryName: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and work email are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("/api/waitlist", { method: "POST", body: JSON.stringify({ ...form, source: "home-hero" }) });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="pub-waitlist pub-waitlist--done" role="status">
        <span className="pub-waitlist__ok">
          <Check size={18} strokeWidth={2.5} />
        </span>
        <div>
          <p className="pub-waitlist__title">You're on the waitlist.</p>
          <p className="pub-waitlist__sub">We'll reach out personally to set up your distillery's license.</p>
        </div>
      </div>
    );
  }

  return (
    <form className="pub-waitlist" onSubmit={handleSubmit} noValidate>
      <p className="pub-waitlist__title">Join the waitlist</p>
      <p className="pub-waitlist__sub">Distillr is licensed per distillery. Tell us who you are and we'll reach out to set you up.</p>
      <div className="pub-waitlist__fields">
        <input
          className="pub-waitlist__input"
          aria-label="Your name"
          placeholder="Your name"
          autoComplete="name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={120}
          required
        />
        <input
          className="pub-waitlist__input"
          aria-label="Distillery name"
          placeholder="Distillery name"
          autoComplete="organization"
          value={form.distilleryName}
          onChange={(e) => set("distilleryName", e.target.value)}
          maxLength={160}
        />
        <input
          className="pub-waitlist__input pub-waitlist__input--wide"
          type="email"
          aria-label="Work email"
          placeholder="Work email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          maxLength={254}
          required
        />
      </div>
      {error && (
        <p className="pub-waitlist__error" role="alert">
          {error}
        </p>
      )}
      <div className="pub-waitlist__actions">
        <button type="submit" className="pub-btn pub-btn--primary pub-btn--lg" disabled={loading}>
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              Join the waitlist <ArrowRight size={16} />
            </>
          )}
        </button>
        <p className="pub-waitlist__signin">
          Already licensed?{" "}
          <button type="button" onClick={onSignIn}>
            Sign in
          </button>
        </p>
      </div>
    </form>
  );
}
