import { notFound } from 'next/navigation';
import { ClearPurchasedBag } from '../../../../components/cart';
import { lookupOrder } from '../../../../lib/orders';
import { verifyPayment } from '../../../../lib/paystack';
import { money } from '../../../../lib/types';

export const dynamic = 'force-dynamic';
export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ reference?: string }> }) {
  const { id } = await params;
  const { reference } = await searchParams;
  let result = await lookupOrder(id);
  if (!result || result.order.channel !== 'online') notFound();
  if (result.order.status === 'pending' && reference === id && result.order.payment_method === 'Paystack') {
    try { await verifyPayment(id); } catch { /* The signed webhook can still confirm the payment. */ }
    result = (await lookupOrder(id)) ?? result;
  }
  const { order, items } = result;
  const paid = order.status === 'paid';
  const expired = order.expires_at && new Date(order.expires_at).getTime() <= Date.now();
  const title = paid ? 'Order confirmed' : order.status === 'review' ? 'Payment under review' : expired || order.status === 'cancelled' ? 'Checkout expired' : 'Awaiting payment confirmation';
  return <section className="wrap section narrow"><div className="panel">
    <p className="eyebrow">ORDER {id.slice(0, 8).toUpperCase()}</p><h1>{title}</h1>
    <p className="muted">{paid ? order.method === 'pickup' ? 'Your order is for pickup at Muchroom in Nsukka.' : 'Your order is marked for delivery.'
      : order.status === 'review' ? 'Payment arrived after the reservation expired. Contact Muchroom with this order reference.'
      : 'Refresh this page if you have completed payment.'}</p>
    {items.map(item => <div className="bag-row" key={item.variant_id}><span>{item.quantity} × {item.label}</span><strong>{money(item.quantity * item.price)}</strong></div>)}
    {order.delivery_fee > 0 && <div className="bag-row"><span>Delivery</span><strong>{money(order.delivery_fee)}</strong></div>}
    <div className="subtotal"><span>Total</span><strong>{money(order.total)}</strong></div>
    {paid && <ClearPurchasedBag/>}
  </div></section>;
}
