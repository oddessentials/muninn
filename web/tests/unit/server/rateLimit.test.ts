import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../../src/lib/server/http/rateLimit';
import { clientAddress } from '../../../src/lib/server/http/routes';

describe('createRateLimiter', () => {
  it('allows the limit inside a window and refuses the next request', () => {
    const limiter = createRateLimiter(3, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('a', 100)).toBe(true);
    expect(limiter.allow('a', 200)).toBe(true);
    expect(limiter.allow('a', 300)).toBe(false);
    expect(limiter.allow('b', 300)).toBe(true);
  });

  it('allows again once the earliest request leaves the window', () => {
    const limiter = createRateLimiter(2, 1000);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('a', 500)).toBe(true);
    expect(limiter.allow('a', 999)).toBe(false);
    expect(limiter.allow('a', 1000)).toBe(true);
    expect(limiter.allow('a', 1001)).toBe(false);
  });

  it('drops addresses whose requests have all expired', () => {
    const limiter = createRateLimiter(2, 1000);
    limiter.allow('a', 0);
    limiter.allow('b', 0);
    limiter.allow('c', 1500);
    expect(limiter.size()).toBe(1);
  });

  it('never tracks more addresses than its cap, dropping the oldest first', () => {
    const limiter = createRateLimiter(1, 1000, 3);
    expect(limiter.allow('a', 0)).toBe(true);
    expect(limiter.allow('b', 1)).toBe(true);
    expect(limiter.allow('c', 2)).toBe(true);
    expect(limiter.allow('d', 3)).toBe(true);
    expect(limiter.size()).toBe(3);
    expect(limiter.allow('b', 4)).toBe(false);
    expect(limiter.allow('a', 5)).toBe(true);
    expect(limiter.size()).toBe(3);
  });
});

describe('clientAddress', () => {
  it('is the address the server reports', () => {
    expect(clientAddress({ getClientAddress: () => '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('is unknown when the server cannot tell', () => {
    expect(
      clientAddress({
        getClientAddress: () => {
          throw new Error('no address');
        }
      })
    ).toBe('unknown');
  });
});
