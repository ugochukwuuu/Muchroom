import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AdminShell, StockBadge } from '../../components/admin';
import { requireStaff } from '../../lib/auth';
import { catalogue } from '../../lib/catalogue';
import { db } from '../../lib/db';
import { money } from '../../lib/types';

export const dynamic = 'force-dynamic';
export default async function Admin({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireStaff();
  const { period } = await searchParams;
  const days = period === '7' ? 7 : period === '90' ? 90 : 30;
  const database = await db();
  const [variants, totals, products, breakdown] = await Promise.all([
    catalogue(false),
    database.query<{ revenue: number; orders: number; units: number }>(`
      SELECT COALESCE(SUM(o.total - o.delivery_fee),0)::float8 AS revenue, COUNT(*)::integer AS orders,
      COALESCE(SUM((SELECT SUM(i.quantity) FROM order_items i WHERE i.order_id=o.id)),0)::integer AS units
      FROM orders o WHERE o.status='paid' AND o.paid_at >= now() - ($1 * interval '1 day')
    `, [days]),
    database.query<{ product_id: string; product: string; units: number; sales: number }>(`
      SELECT p.id AS product_id,p.name AS product,SUM(i.quantity)::integer AS units,SUM(i.price::bigint*i.quantity)::float8 AS sales
      FROM order_items i JOIN orders o ON o.id=i.order_id JOIN variants v ON v.id=i.variant_id JOIN products p ON p.id=v.product_id
      WHERE o.status='paid' AND o.paid_at >= now() - ($1 * interval '1 day')
      GROUP BY p.id,p.name ORDER BY units DESC,p.name LIMIT 8
    `, [days]),
    database.query<{ dimension: string; label: string; orders: number; sales: number }>(`
      WITH paid AS (SELECT * FROM orders WHERE status='paid' AND paid_at >= now() - ($1 * interval '1 day'))
      SELECT 'channel' AS dimension, CASE WHEN channel='in_store' THEN 'In store' ELSE 'Online' END AS label,
      COUNT(*)::integer AS orders,SUM(total-delivery_fee)::float8 AS sales FROM paid GROUP BY channel
      UNION ALL SELECT 'source', COALESCE(NULLIF(source,''),'Unknown'),COUNT(*)::integer,SUM(total-delivery_fee)::float8 FROM paid GROUP BY source
      UNION ALL SELECT 'location', location,COUNT(*)::integer,SUM(total-delivery_fee)::float8 FROM paid WHERE method='delivery' GROUP BY location
      ORDER BY sales DESC LIMIT 100
    `, [days]),
  ]);
  const summary = totals.rows[0];
  const low = variants.filter(item => item.published && item.available <= 3);
  return <AdminShell current="Overview">
    <div className="section-head"><div><p className="eyebrow">MUCHROOM</p><h1>Store overview</h1></div>
      <form className="search"><select name="period" aria-label="Report period" defaultValue={days}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select><button className="button soft">Apply</button></form></div>
    <div className="metric-grid">{[['Product sales', money(summary.revenue)], ['Paid orders', summary.orders], ['Units sold', summary.units], ['Low or out of stock', low.length]].map(([label, value]) => <div className="panel metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="admin-grid">
      <section className="panel"><h2>Stock to review</h2>
        {low.length ? low.slice(0, 8).map(item => <Link key={item.id} className="data-row" href={`/admin/inventory/${item.product_id}`}><span><strong>{item.product}</strong><small>{item.name} · {item.available} available</small></span><StockBadge item={item}/></Link>) : <p className="muted">No published items are low or out of stock.</p>}
        <Link className="inline-link" href="/admin/inventory">Open inventory <ArrowRight size={16}/></Link>
      </section>
      <section className="panel"><h2>Top products</h2>
        {products.rows.length ? products.rows.map(item => <Link key={item.product_id} className="data-row" href={`/admin/inventory/${item.product_id}`}><span><strong>{item.product}</strong><small>{item.units} sold</small></span><strong>{money(item.sales)}</strong></Link>) : <p className="muted">Paid sales will appear here.</p>}
      </section>
      {([['channel','Sales by channel'], ['source','How shoppers found Muchroom'], ['location','Sales by delivery city']]).map(([key, title]) => {
        const rows = breakdown.rows.filter(row => row.dimension === key);
        return <section className="panel" key={key}><h2>{title}</h2>{rows.length ? rows.map(row => <div className="data-row" key={row.label}><span><strong>{row.label}</strong><small>{row.orders} orders</small></span><strong>{money(row.sales)}</strong></div>) : <p className="muted">No data for this period.</p>}</section>;
      })}
    </div>
  </AdminShell>;
}
