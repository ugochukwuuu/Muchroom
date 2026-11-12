import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { demoMode } from './db';

const cookieName = 'muchroom_staff';
const duration = 8 * 60 * 60;
const key = () => process.env.SESSION_SECRET || (demoMode ? 'local-muchroom-development-only-session-key' : '');
const hmac = (value: string) => createHmac('sha256', key()).update(value).digest('hex');
const equals = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function isStaff() {
  if (!key()) return false;
  const value = (await cookies()).get(cookieName)?.value;
  if (!value || !/^\d+\.[a-f0-9]{64}$/.test(value)) return false;
  const [expiry, signature] = value.split('.');
  return Number(expiry) > Date.now() && equals(hmac(expiry), signature);
}

export async function requireStaff() {
  if (!(await isStaff())) redirect('/admin/login');
}

export async function signIn(password: string) {
  const expected = process.env.ADMIN_PASSWORD || (demoMode ? 'muchroom-demo' : '');
  if (!expected || !key() || !equals(hmac(password), hmac(expected))) return false;
  const expiry = String(Date.now() + duration * 1000);
  (await cookies()).set(cookieName, `${expiry}.${hmac(expiry)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: duration, path: '/',
  });
  return true;
}

export async function signOut() {
  (await cookies()).delete(cookieName);
}
