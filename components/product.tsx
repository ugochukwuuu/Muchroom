import Link from 'next/link';
import { ArrowUpRight, Headphones, Laptop, Mouse, Projector } from 'lucide-react';
import { money, type Variant } from '../lib/types';

export const categoryIcons = { Laptops: Laptop, Projectors: Projector, Audio: Headphones, Accessories: Mouse };

export function ProductPhoto({ variant, source = variant.images[0], position }: { variant: Variant; source?: string; position?: number }) {
  const Icon = categoryIcons[variant.category] ?? Laptop;
  return <div className="product-image">
    {source ? <img src={source} alt={position === undefined ? variant.product : `${variant.product}, photo ${position + 1}`}/> : <Icon size={70} strokeWidth={1.1} aria-hidden/>}
  </div>;
}

export function ProductCard({ variant, reasons }: { variant: Variant; reasons?: string[] }) {
  return <article className="product-card">
    <Link href={`/product/${variant.product_id}`}><ProductPhoto variant={variant}/></Link>
    <div className="product-info">
      <p className="eyebrow">{variant.category}</p>
      <Link href={`/product/${variant.product_id}`} className="product-title">{variant.product}</Link>
      <p className="muted variant-label">{variant.name}</p>
      {reasons?.length ? <ul className="reasons">{reasons.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul> : null}
      <div className="card-bottom"><strong>{money(variant.price)}</strong><Link className="round-link" href={`/product/${variant.product_id}`} aria-label={`View ${variant.product}`}><ArrowUpRight size={17}/></Link></div>
    </div>
  </article>;
}
