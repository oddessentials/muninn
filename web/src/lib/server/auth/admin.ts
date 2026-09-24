import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import { getDb } from '../db/client';
import { adminSessions } from '../db/schema';
import { env } from '../env';
import { forbidden, unauthorized } from '../http/respond';

export const cookieName = 'admin_session';
export const sessionLifetimeMs = 12 * 60 * 60 * 1000;

function sign(id: string): string {
  return createHmac('sha256', env.adminSessionSecret).update(id).digest('base64url');
}

function cookieValue(id: string): string {
  return `${id}.${sign(id)}`;
}

function parseCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = sign(id);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

export function passwordMatches(candidate: string): boolean {
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(env.adminPassword, 'utf8');
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function cookieAttributes(maxAgeSeconds: number): string {
  const secure = env.origin.startsWith('https://') ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export async function createSession(): Promise<{ setCookie: string; expiresAt: Date }> {
  const id = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  await getDb().insert(adminSessions).values({ id, expiresAt });
  return {
    setCookie: `${cookieName}=${cookieValue(id)}; ${cookieAttributes(Math.floor(sessionLifetimeMs / 1000))}`,
    expiresAt
  };
}

export function clearedCookie(): string {
  return `${cookieName}=; ${cookieAttributes(0)}`;
}

export interface AdminSessionState {
  authenticated: boolean;
  expiresAt: Date | null;
  id: string | null;
}

export async function readSession(event: RequestEvent): Promise<AdminSessionState> {
  const id = parseCookie(event.cookies.get(cookieName));
  if (!id) return { authenticated: false, expiresAt: null, id: null };
  const rows = await getDb()
    .select({ expiresAt: adminSessions.expiresAt })
    .from(adminSessions)
    .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return { authenticated: false, expiresAt: null, id: null };
  return { authenticated: true, expiresAt: row.expiresAt, id };
}

export async function requireAdmin(event: RequestEvent): Promise<AdminSessionState> {
  const state = await readSession(event);
  if (!state.authenticated) throw unauthorized('an admin session is required');
  return state;
}

export function requireSameOrigin(event: RequestEvent): void {
  const origin = event.request.headers.get('origin');
  if (origin === null || origin !== env.origin) {
    throw forbidden('the Origin header must match the site origin');
  }
}

export async function destroySession(id: string | null): Promise<void> {
  if (!id) return;
  await getDb().delete(adminSessions).where(eq(adminSessions.id, id));
}

export async function pruneSessions(): Promise<number> {
  const deleted = await getDb()
    .delete(adminSessions)
    .where(lt(adminSessions.expiresAt, new Date()))
    .returning({ id: adminSessions.id });
  return deleted.length;
}
