import { createHmac, timingSafeEqual } from 'node:crypto';
import { confirmPayment } from './orders';
import { uuidPattern } from './types';

const key = () => process.env.PAYSTACK_SECRET_KEY;
export const paymentEnabled = () => Boolean(key() && process.env.APP_URL);

async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`https://api.paystack.co/transaction/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json() as { status: boolean; data: T };
  if (!response.ok || !data.status) throw new Error('Paystack request failed.');
  return data.data;
}

export async function startPayment(id: string, amount: number, email: string) {
  const callback = new URL(`/orders/${id}`, process.env.APP_URL);
  const data = await request<{ authorization_url: string }>('initialize', {
    email, amount: amount * 100, currency: 'NGN', reference: id, callback_url: callback.href,
  });
  const url = new URL(data.authorization_url);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.paystack.com') throw new Error('Unexpected payment URL.');
  return url.href;
}

export async function verifyPayment(reference: string) {
  if (!key() || !uuidPattern.test(reference)) return;
  const data = await request<{ status: string; amount: number; currency: string; reference: string }>(
    `verify/${encodeURIComponent(reference)}`,
  );
  if (data.status === 'success' && data.reference === reference && data.currency === 'NGN') {
    await confirmPayment(reference, data.amount / 100, reference);
  }
}

export function validSignature(payload: string, signature: string | null) {
  const secret = key();
  if (!secret || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac('sha512', secret).update(payload).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
