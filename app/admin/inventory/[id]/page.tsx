import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminShell, ProductFields, StaffNotice, StockBadge, VariantFields } from '../../../../components/admin';
import { AdminPhotos } from '../../../../components/admin-photos';
import { requireStaff } from '../../../../lib/auth';
import { catalogue } from '../../../../lib/catalogue';
import { db } from '../../../../lib/db';
import { uuidPattern } from '../../../../lib/types';
import { saveProduct, saveVariant, updateStock } from '../../actions';

export const dynamic = 'force-dynamic';
type Movement = { id: string; sku: string; change: number; reason: string; actor: string; created_at: Date };
const date = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' });

export default async function ProductAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const { error, saved } = await searchParams;
  if (!uuidPattern.test(id)) notFound();
  const items = (await catalogue(false)).filter(item => item.product_id === id);
  if (!items.length) notFound();
  const history = await (await db()).query<Movement>(`
    SELECT sm.*,v.sku FROM stock_movements sm JOIN variants v ON v.id=sm.variant_id
    WHERE v.product_id=$1 ORDER BY sm.created_at DESC LIMIT 50
  `, [id]);
  return <AdminShell current="Inventory">
    <Link className="inline-link" href="/admin/inventory">← All inventory</Link><h1>{items[0].product}</h1>
    <StaffNotice error={error} saved={saved}/>
    <details className="panel"><summary>Edit listing</summary><form className="form-stack spaced" action={saveProduct}><ProductFields product={items[0]}/><button className="button primary">Save listing</button></form></details>
    <AdminPhotos product={id} listingCount={items[0].images.length}/>
    <div className="admin-grid spaced">{items.map(item => <section className="panel" key={item.id}>
      <div className="section-head"><div><p className="eyebrow">{item.sku}</p><h2>{item.name}</h2></div><StockBadge item={item}/></div>
      <p className="muted">{item.quantity} on hand · {item.quantity - item.available} reserved · {item.available} available</p>
      <form action={updateStock} className="form-stack"><input type="hidden" name="variant" value={item.id}/><input type="hidden" name="product" value={id}/>
        <div className="form-grid"><label>Stock action<select name="mode"><option value="receive">Receive stock</option><option value="count">Correct physical count</option></select></label>
        <label>Units added or total counted<input type="number" name="quantity" min="0" max="1000000" required/></label></div>
        <label>Note <span className="muted">(required for corrections)</span><input name="note" maxLength={200}/></label><button className="button primary">Update stock</button>
      </form>
      <details className="spaced"><summary>Edit variant</summary><form className="form-stack spaced" action={saveVariant}><input type="hidden" name="product" value={id}/><VariantFields variant={item}/><button className="button soft">Save variant</button></form></details>
    </section>)}</div>
    <details className="panel spaced"><summary>Add another variant</summary><form action={saveVariant} className="form-stack spaced"><input type="hidden" name="product" value={id}/><VariantFields/><button className="button primary">Create variant</button></form></details>
    <section className="panel spaced"><h2>Stock history</h2>
      {history.rows.length ? history.rows.map(item => <div className="data-row" key={item.id}><span><strong>{item.reason}</strong><small>{item.sku} · {item.actor} · {date.format(new Date(item.created_at))}</small></span><strong>{item.change > 0 ? '+' : ''}{item.change}</strong></div>) : <p className="muted">No movements recorded.</p>}
    </section>
  </AdminShell>;
}
