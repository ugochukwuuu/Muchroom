import Link from 'next/link';
import { ArrowDown, ArrowRight, Sparkles } from 'lucide-react';
import { catalogue } from '../../lib/catalogue';
import { categories } from '../../lib/types';
import { ProductCard, categoryIcons } from '../../components/product';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const all = await catalogue();
  const filtered = all.filter(v => (!category || v.category === category) && (!q || `${v.product} ${v.brand} ${v.category} ${v.name}`.toLowerCase().includes(q.trim().toLowerCase())));
  const products = [...new Map([...filtered].reverse().map(v => [v.product_id, v])).values()].reverse();

  return <>
    <section className="wrap hero-shell"><div className="hero">
      <div className="hero-copy">
      <h1>Tech for<br/>campus.</h1>
      <p>Shopping for UNN? Find laptops for lectures and final-year projects, projectors for group presentations, and speakers for your room.</p>
      <div className="hero-actions"><Link className="button hero-primary" href="/finder"><Sparkles size={17}/> Find my gear <ArrowRight size={17}/></Link><Link className="button ghost" href="/#catalogue">Shop products <ArrowDown size={16}/></Link></div></div>
    </div></section>
    <section className="wrap section categories" aria-labelledby="category-heading"><h2 id="category-heading">Shop by category</h2>
      <div className="category-grid">{categories.map(c => {
        const Icon = categoryIcons[c];
        return <Link href={`/?category=${encodeURIComponent(c)}#catalogue`} key={c} className="category-card"><span className="category-icon"><Icon size={23}/></span><strong>{c}</strong><ArrowRight size={17} className="category-arrow"/></Link>;
      })}</div>
    </section>
    <section className="wrap section inventory-section" id="catalogue">
      <div className="section-head"><div><p className="eyebrow">THE CATALOGUE</p><h2>{category || 'Shop in-stock gear'}</h2></div>
        <form action="/#catalogue" className="search">{category && <input type="hidden" name="category" value={category}/>}<input aria-label="Search products" placeholder="Search products" name="q" defaultValue={q}/><button className="button soft">Search</button></form>
      </div>
      {(category || q) && <p><Link className="inline-link" href="/#catalogue">Clear filters</Link></p>}
      {products.length ? <div className="product-grid">{products.map(variant => <ProductCard key={variant.id} variant={variant}/>)}</div> : <div className="empty">No products match this search. <Link href="/#catalogue">View all available products</Link>.</div>}
    </section>
  </>;
}
