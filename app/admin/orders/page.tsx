import { AdminShell, StaffNotice } from '../../../components/admin';
import { SaleLines } from '../../../components/sale-lines';
import { requireStaff } from '../../../lib/auth';
import { catalogue } from '../../../lib/catalogue';
import { db } from '../../../lib/db';
import { money, type Order } from '../../../lib/types';
import { fulfilOrder, recordSale } from '../actions';

export const dynamic = 'force-dynamic';
type Sale = Order & { items: string; active: boolean | null };
const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });

export default async function Orders({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; status?: string }> }) {
  await requireStaff();
  const { error, saved, status } = await searchParams;
  const database = await db();
  const [variants, result] = await Promise.all([
    catalogue(false),
    database.query<Sale>(`
      SELECT o.*, expires_at > statement_timestamp() AS active,
        (SELECT string_agg(i.quantity::text || ' × ' || i.label, ', ' ORDER BY i.label) FROM order_items i WHERE i.order_id=o.id) AS items
      FROM orders o
      WHERE $1='' OR o.status=$1 OR ($1='unfulfilled' AND o.status='paid' AND o.fulfilment='unfulfilled')
      ORDER BY o.created_at DESC LIMIT 100
    `, [status ?? '']),
  ]);
  const available = variants.filter(item => item.available > 0);
  return <AdminShell current="Orders">
    <p className="eyebrow">SALES</p><h1>Orders</h1><StaffNotice error={error} saved={saved}/>
    <details className="panel" open={error ? true : undefined}><summary>Record a walk-in sale</summary>
      {available.length ? <form className="form-stack spaced" action={recordSale}>
        <SaleLines variants={available}/>
        <div className="form-grid"><label>Payment method<select name="payment"><option>Cash</option><option>Card</option><option>Bank transfer</option></select></label>
        <label>Customer name (optional)<input name="customer" maxLength={100}/></label>
        <label>How they found us (optional)<select name="source"><option value="">Unknown</option><option>Google</option><option>Instagram</option><option>WhatsApp</option><option>Referral</option><option>Other</option></select></label></div>
        <button className="button primary">Record paid sale</button>
      </form> : <p className="muted">Receive stock before recording a sale.</p>}
    </details>
    <section className="panel spaced"><div className="section-head"><h2>Recent orders</h2>
      <form className="search"><select name="status" defaultValue={status ?? ''} aria-label="Filter order status"><option value="">All statuses</option><option value="unfulfilled">Paid, awaiting fulfilment</option><option value="pending">Pending</option><option value="review">Needs review</option><option value="paid">Paid</option></select><button className="button soft">Filter</button></form>
    </div>
    {!result.rows.length && <p className="muted">No orders match.</p>}
    {result.rows.map(order => <details className="order-record" key={order.id}><summary>
      <div><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><small>{date.format(new Date(order.created_at))} · {order.channel === 'in_store' ? 'In store' : 'Online'}</small></div>
      <span className={`status ${order.status === 'paid' ? 'green' : 'amber'}`}>{order.status === 'paid' ? order.fulfilment === 'fulfilled' ? 'Fulfilled' : 'Paid' : order.status === 'review' ? 'Needs review' : order.active ? 'Awaiting payment' : 'Expired'}</span>
      <strong>{money(order.total)}</strong>
    </summary><div className="order-detail"><p>{order.items}</p><p>{order.customer} · {order.payment_method} · {order.method}</p>
    {order.status === 'review' && <p className="notice">Payment arrived after stock was released. Reconcile the payment in Paystack before fulfilment.</p>}
    {order.email && <p>{order.email} · {order.phone}</p>}{order.address && <p>{order.address}, {order.location}</p>}
    {order.status === 'paid' && order.fulfilment === 'unfulfilled' && <form action={fulfilOrder}><input type="hidden" name="order" value={order.id}/><button className="button soft">Mark fulfilled</button></form>}
    </div></details>)}</section>
  </AdminShell>;
}
