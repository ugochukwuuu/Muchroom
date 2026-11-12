import { notFound } from 'next/navigation';
import Link from 'next/link';
import { catalogue } from '../../../../lib/catalogue';
import { AddToBag } from '../../../../components/cart';
import { ProductGallery } from '../../../../components/product-gallery';

export const dynamic = 'force-dynamic';
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variants = (await catalogue()).filter(variant => variant.product_id === id);
  if (!variants.length) notFound();
  const product = variants[0];
  return <section className="wrap section"><Link className="inline-link" href="/#catalogue">← Back to shop</Link>
    <div className="detail"><ProductGallery key={id} variant={product}/><div><p className="eyebrow">{product.category}</p><h1>{product.product}</h1><p className="muted">{product.description}</p>
      <AddToBag variants={variants}/>
      {variants.map(variant => <div className="spec-group" key={variant.id}><h3>{variant.name} specifications</h3><dl>{Object.entries(variant.specs).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>)}
    </div></div>
  </section>;
}
