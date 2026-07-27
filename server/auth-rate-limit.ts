type LoginAttemptState = {
  attempts: number;
  windowStartedAt: number;
  blockedUntil: number;
};

type LoginRateLimiterOptions = {
  maxAttempts: number;
  windowMs: number;
  blockMs: number;
};

export const LOGIN_RATE_LIMIT_OPTIONS: LoginRateLimiterOptions = {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000,
  blockMs: 15 * 60 * 1000,
};

export class LoginRateLimiter {
  private readonly attempts = new Map<string, LoginAttemptState>();
  private readonly options: LoginRateLimiterOptions;

  constructor(options?: Partial<LoginRateLimiterOptions>) {
    this.options = { ...LOGIN_RATE_LIMIT_OPTIONS, ...options };
  }

  getRetryAfterSeconds(key: string, now = Date.now()): number {
    const state = this.attempts.get(key);
    if (!state) return 0;
    if (state.blockedUntil <= now) return 0;
    return Math.ceil((state.blockedUntil - now) / 1000);
  }

  isBlocked(key: string, now = Date.now()): boolean {
    const retryAfterSeconds = this.getRetryAfterSeconds(key, now);
    if (retryAfterSeconds <= 0) {
      const state = this.attempts.get(key);
      if (state && state.blockedUntil > 0 && state.blockedUntil <= now) {
        this.attempts.delete(key);
      }
      return false;
    }
    return true;
  }

  registerFailure(key: string, now = Date.now()): void {
    this.prune(now);

    const existing = this.attempts.get(key);
    if (!existing || now - existing.windowStartedAt > this.options.windowMs) {
      this.attempts.set(key, {
        attempts: 1,
        windowStartedAt: now,
        blockedUntil: 0,
      });
      return;
    }

    if (existing.blockedUntil > now) {
      return;
    }

    existing.attempts += 1;
    if (existing.attempts >= this.options.maxAttempts) {
      existing.blockedUntil = now + this.options.blockMs;
    }
  }

  registerSuccess(key: string): void {
    this.attempts.delete(key);
  }

  private prune(now: number): void {
    this.attempts.forEach((state, key) => {
      const shouldRemove =
        (state.blockedUntil === 0 && now - state.windowStartedAt > this.options.windowMs * 2) ||
        (state.blockedUntil > 0 && now > state.blockedUntil + this.options.windowMs);
      if (shouldRemove) {
        this.attempts.delete(key);
      }
    });
  }
}

export function getLoginClientKey(req: { ip?: string; socket?: { remoteAddress?: string | undefined | null } }): string {
  const ip = req.ip?.trim();
  if (ip) return ip;
  const remote = req.socket?.remoteAddress?.trim();
  if (remote) return remote;
  return "unknown";
}
