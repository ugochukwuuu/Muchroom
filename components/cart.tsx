'use client';
import { useSyncExternalStore } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useActionState } from 'react';
import Link from 'next/link';
import { money, type Variant } from '../lib/types';
import { checkout } from '../app/actions';

type Line = { id: string; quantity: number };
const key = 'muchroom-bag';
const event = 'muchroom-bag-change';
const read = () => localStorage.getItem(key) ?? '[]';
function listen(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener('storage', callback);
  return () => { window.removeEventListener(event, callback); window.removeEventListener('storage', callback); };
}
function setLines(lines: Line[]) {
  localStorage.setItem(key, JSON.stringify(lines));
  window.dispatchEvent(new Event(event));
}
function parse(raw: string): Line[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(line => typeof line?.id === 'string' && Number.isInteger(line.quantity) && line.quantity > 0 && line.quantity <= 99);
  } catch { return []; }
}
export function AddToBag({ variants }: { variants: Variant[] }) {
  const raw = useSyncExternalStore(listen, read, () => '[]');
  const lines = parse(raw);
  return <div className="variant-list">{variants.map(variant => {
    const quantity = lines.find(line => line.id === variant.id)?.quantity ?? 0;
    return <div className="variant-row" key={variant.id}><div><strong>{variant.name}</strong><div className="muted">{variant.available} available · {money(variant.price)}</div></div>
      <button className="button primary" disabled={quantity >= Math.min(variant.available, 99)} onClick={() => {
        const current = parse(read());
        const existing = current.find(line => line.id === variant.id);
        if (existing) existing.quantity += 1;
        else current.push({ id: variant.id, quantity: 1 });
        setLines(current);
      }}><ShoppingBag size={17}/>{quantity ? `In bag (${quantity})` : 'Add to bag'}</button>
    </div>;
  })}</div>;
}

export function Bag({ variants, deliveryFee, demo, online }: { variants: Variant[]; deliveryFee: number | null; demo: boolean; online: boolean }) {
  const raw = useSyncExternalStore(listen, read, () => '[]');
  const lines = parse(raw);
  const [state, action, pending] = useActionState(checkout, { error: '' });
  const entries = lines.map(line => ({ line, variant: variants.find(v => v.id === line.id) }));
  const subtotal = entries.reduce((sum, { line, variant }) => sum + (variant?.price ?? 0) * line.quantity, 0);
  const invalid = entries.some(({ line, variant }) => !variant || line.quantity > variant.available);
  if (!lines.length) return <div className="empty">Your bag is empty. <Link href="/#catalogue">Browse the catalogue</Link>.</div>;
  return <div className="checkout-grid">
    <div className="panel"><h2>Order items</h2>{entries.map(({ line, variant }) => <div className="bag-row" key={line.id}>
      <div><strong>{variant?.product ?? 'Item unavailable'}</strong><p className="muted">{variant?.name}{variant ? ` · ${money(variant.price)} each` : ''}</p>
      {variant && line.quantity > variant.available && <small>Only {variant.available} available.</small>}</div>
      <div className="qty"><button type="button" aria-label="Decrease quantity" onClick={() => setLines(lines.map(item => item.id === line.id ? { ...item, quantity: item.quantity - 1 } : item).filter(item => item.quantity > 0))}>−</button><span>{line.quantity}</span><button type="button" aria-label="Increase quantity" disabled={!variant || line.quantity >= Math.min(variant.available, 99)} onClick={() => setLines(lines.map(item => item.id === line.id ? { ...item, quantity: item.quantity + 1 } : item))}>+</button></div>
      <button className="text-button" type="button" onClick={() => setLines(lines.filter(item => item.id !== line.id))}>Remove</button>
    </div>)}<div className="subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></div></div>
    <form action={action} className="panel form-stack"><h2>Checkout</h2>
      <input type="hidden" name="lines" value={JSON.stringify(lines)}/>
      <label>Full name<input name="customer" required maxLength={100} autoComplete="name"/></label>
      <label>Email<input type="email" name="email" required maxLength={150} autoComplete="email"/></label>
      <label>Phone<input type="tel" name="phone" required maxLength={30} autoComplete="tel"/></label>
      <label>Receive your order<select name="method"><option value="pickup">Pick up in Nsukka</option>{deliveryFee !== null && <option value="delivery">Delivery · {money(deliveryFee)}</option>}</select></label>
      {deliveryFee !== null && <><label>City for delivery<input name="location" maxLength={80} autoComplete="address-level2"/></label><label>Delivery address<textarea name="address" maxLength={300} autoComplete="street-address"/></label></>}
      <label>How did you hear about us? <span className="muted">(optional)</span><select name="source"><option value="">Select a source</option><option>Google</option><option>Instagram</option><option>WhatsApp</option><option>Referral</option><option>Other</option></select></label>
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      {!online && <p className="notice">Online payments are currently unavailable.</p>}
      <button className="button primary" disabled={invalid || pending || !online}>{pending ? 'Preparing checkout…' : demo ? 'Place demo order' : 'Continue to payment'}</button>
    </form>
  </div>;
}

export function ClearPurchasedBag() {
  return <button className="button soft" onClick={() => { setLines([]); window.location.href = '/#catalogue'; }}>Clear bag and continue shopping</button>;
}
