'use server';
import { redirect } from 'next/navigation';
import { createOrder, confirmPayment, InputError } from '../lib/orders';
import { demoMode } from '../lib/db';
import { paymentEnabled, startPayment } from '../lib/paystack';
import { deliveryFee } from '../lib/settings';

export async function checkout(_previous: { error: string }, form: FormData) {
  if (!demoMode && !paymentEnabled()) return { error: 'Online payments are currently unavailable.' };
  const customer = String(form.get('customer') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const phone = String(form.get('phone') ?? '').trim();
  const method = form.get('method') === 'delivery' ? 'delivery' : 'pickup';
  const fee = deliveryFee();
  const address = method === 'delivery' ? String(form.get('address') ?? '').trim() : '';
  const location = method === 'delivery' ? String(form.get('location') ?? '').trim() : 'Nsukka';
  const source = String(form.get('source') ?? '').trim().slice(0, 80);
  if (!customer || customer.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150 || !phone || phone.length > 30) {
    return { error: 'Enter a name, valid email address and phone number.' };
  }
  if (method === 'delivery' && (fee === null || !address || address.length > 300 || !location || location.length > 80)) {
    return { error: 'Choose pickup or enter a city and address for delivery.' };
  }
  let destination: string;
  try {
    const lines: unknown = JSON.parse(String(form.get('lines') ?? '[]'));
    if (!Array.isArray(lines) || lines.some(line => !line || typeof line.id !== 'string')) throw new InputError('Check your bag and try again.');
    const online = paymentEnabled();
    const order = await createOrder({
      channel: 'online', payment: online ? 'Paystack' : 'Demo', customer, email, phone, method,
      address, location, source, lines, deliveryFee: method === 'delivery' ? fee ?? 0 : 0,
    });
    if (online) destination = await startPayment(order.id, order.total, email);
    else {
      await confirmPayment(order.id, order.total, order.id);
      destination = `/orders/${order.id}`;
    }
  } catch (error) {
    if (error instanceof InputError) return { error: error.message };
    console.error('Checkout failed', error);
    return { error: 'Checkout could not start. Please try again shortly.' };
  }
  redirect(destination);
}
