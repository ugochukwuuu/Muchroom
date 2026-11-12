import Link from 'next/link';
import { AdminShell, ProductFields, StaffNotice, StockBadge, VariantFields } from '../../../components/admin';
import { requireStaff } from '../../../lib/auth';
import { catalogue } from '../../../lib/catalogue';
import { money } from '../../../lib/types';
import { saveProduct } from '../actions';

export const dynamic = 'force-dynamic';
export default async function Inventory({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; q?: string; stock?: string }> }) {
  await requireStaff();
  const { error, saved, q, stock } = await searchParams;
  const all = await catalogue(false);
  const items = all.filter(item => (!q || `${item.product} ${item.name} ${item.sku}`.toLowerCase().includes(q.toLowerCase()))
    && (stock !== 'out' || item.quantity === 0) && (stock !== 'low' || item.available <= 3));
  return <AdminShell current="Inventory">
    <div className="section-head"><div><p className="eyebrow">CATALOGUE</p><h1>Inventory</h1></div></div>
    <StaffNotice error={error} saved={saved}/>
    <details className="panel" open={error ? true : undefined}><summary>Add a product</summary>
      <form action={saveProduct} className="form-stack spaced"><ProductFields/><h3>First variant</h3><VariantFields/><button className="button primary">Create product</button></form>
    </details>
    <section className="panel spaced"><div className="section-head"><h2>All variants</h2>
      <form className="search"><input aria-label="Search inventory" name="q" defaultValue={q} placeholder="Product or SKU"/>
      <select aria-label="Filter by stock" name="stock" defaultValue={stock ?? ''}><option value="">All stock</option><option value="low">Low or unavailable</option><option value="out">Out of stock</option></select>
      <button className="button soft">Filter</button></form></div>
      <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Price</th><th>On hand</th><th>Available</th><th>Status</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}><td><Link className="inline-link" href={`/admin/inventory/${item.product_id}`}>{item.product}</Link><small>{item.name}{item.published ? '' : ' · Draft'}</small></td><td>{item.sku}</td><td>{money(item.price)}</td><td>{item.quantity}</td><td>{item.available}</td><td><StockBadge item={item}/></td></tr>)}</tbody></table></div>
      {!items.length && <p className="muted">No variants match.</p>}
    </section>
  </AdminShell>;
}
