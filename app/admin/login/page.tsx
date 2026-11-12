import Link from 'next/link';
import { redirect } from 'next/navigation';
import { demoMode } from '../../../lib/db';
import { isStaff } from '../../../lib/auth';
import { staffLogin } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  if (await isStaff()) redirect('/admin');
  const { invalid } = await searchParams;
  return <main className="wrap section narrow"><Link className="inline-link" href="/">← Storefront</Link><form action={staffLogin} className="panel form-stack">
    <p className="eyebrow">MUCHROOM STAFF</p><h1>Sign in</h1>
    <label>Password<input type="password" name="password" required autoComplete="current-password" maxLength={250}/></label>
    {invalid && <p className="notice error" role="alert">Sign-in failed. Check the password and try again shortly.</p>}
    {demoMode && <p className="notice">Local demo password: <code>muchroom-demo</code></p>}
    <button className="button primary">Sign in</button>
  </form></main>;
}
