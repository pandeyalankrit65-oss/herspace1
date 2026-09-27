import { NextFunction, Request, Response } from 'express';

// Tests make every request from one IP; they set this so IP limits don't interfere.
const byIp = (req: Request) => (process.env.DISABLE_IP_RATE_LIMIT === '1' ? undefined : req.ip || 'unknown');

// Minimal fixed-window, in-memory rate limiter. Keyed by client IP unless `key` is given
// (e.g. per account). Requests where `key` returns undefined are not limited.
export function rateLimit({
  windowMs,
  max,
  key = byIp,
  message = 'Too many requests. Please wait a moment and try again.',
}: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string | undefined;
  message?: string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  // Forget finished windows so the map doesn't grow with every IP address ever seen.
  setInterval(() => {
    const now = Date.now();
    for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
  }, Math.max(windowMs, 60_000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const k = key(req);
    if (k === undefined) return next();
    const now = Date.now();
    const entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

export const perUser = (req: Request) => (req.user ? `user:${req.user.id}` : undefined);
