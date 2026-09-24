import { describe, expect, it } from 'vitest';
import { hashPassword, parseNewPassword, passwordMatchesHash } from '$lib/server/auth/secrets';

describe('the admin password hash', () => {
  it('matches only the password it was made from', async () => {
    const hash = await hashPassword('ravens of Odin');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await passwordMatchesHash('ravens of Odin', hash)).toBe(true);
    expect(await passwordMatchesHash('ravens of odin', hash)).toBe(false);
    expect(await passwordMatchesHash('ravens of Odin', 'plain-text')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'));
  });
});

describe('a new admin password', () => {
  it('is 8 to 200 characters', () => {
    expect(parseNewPassword({ password: 'longenough' })).toBe('longenough');
    expect(() => parseNewPassword({ password: 'short' })).toThrow(/8 to 200 characters/);
    expect(() => parseNewPassword({ password: 'x'.repeat(201) })).toThrow(/8 to 200 characters/);
    expect(() => parseNewPassword({})).toThrow(/password is required/);
    expect(() => parseNewPassword(null)).toThrow(/password is required/);
  });
});
