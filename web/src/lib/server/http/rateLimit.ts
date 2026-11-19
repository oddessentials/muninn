export interface RateLimiter {
  allow(key: string, now?: number): boolean;
  reset(): void;
  size(): number;
}

export const maxTrackedKeys = 10_000;

export function createRateLimiter(
  limit: number,
  windowMs: number,
  maxKeys: number = maxTrackedKeys
): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;
  const sweep = (now: number) => {
    lastSweep = now;
    for (const [key, stamps] of hits) {
      const kept = stamps.filter((stamp) => now - stamp < windowMs);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  };
  const makeRoom = (now: number) => {
    if (hits.size < maxKeys) return;
    sweep(now);
    while (hits.size >= maxKeys) {
      const oldest = hits.keys().next();
      if (oldest.done) return;
      hits.delete(oldest.value);
    }
  };
  return {
    allow(key, now = Date.now()) {
      if (now - lastSweep >= windowMs) sweep(now);
      const known = hits.get(key);
      const stamps = (known ?? []).filter((stamp) => now - stamp < windowMs);
      if (stamps.length >= limit) {
        hits.set(key, stamps);
        return false;
      }
      if (known === undefined) makeRoom(now);
      stamps.push(now);
      hits.set(key, stamps);
      return true;
    },
    reset() {
      hits.clear();
    },
    size() {
      return hits.size;
    }
  };
}

export const publicRateLimiter = createRateLimiter(120, 60_000);
export const loginRateLimiter = createRateLimiter(5, 60_000);
