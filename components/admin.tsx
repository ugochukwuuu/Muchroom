import Link from 'next/link';
import { ArrowUpRight, Boxes, ChartNoAxesCombined, ClipboardList, LogOut, Package } from 'lucide-react';
import { staffLogout } from '../app/admin/actions';
import { categories, type Variant } from '../lib/types';
import { photoUploadsEnabled } from '../lib/cloudinary';
import { geminiEnabled } from '../lib/gemini';
import { ProductAiFill } from './product-ai-fill';

export function AdminShell({ current, children }: { current: string; children: React.ReactNode }) {
  const links = [
    { name: 'Overview', href: '/admin', icon: ChartNoAxesCombined },
    { name: 'Inventory', href: '/admin/inventory', icon: Package },
    { name: 'Orders', href: '/admin/orders', icon: ClipboardList },
  ];
  return <div className="admin-shell">
    <aside className="admin-nav"><Link href="/admin" className="brand"><span className="brand-icon"><Boxes size={22}/></span> muchroom<span className="dot">.</span></Link>
      <p className="eyebrow">STORE ADMIN</p>
      <nav aria-label="Admin navigation">{links.map(({ name, href, icon: Icon }) => <Link key={href} href={href} aria-current={name === current ? 'page' : undefined}><Icon size={18}/>{name}</Link>)}</nav>
      <div className="admin-nav-bottom"><Link href="/">Storefront <ArrowUpRight size={15}/></Link><form action={staffLogout}><button className="text-button"><LogOut size={16}/> Sign out</button></form></div>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}

export function StaffNotice({ error, saved }: { error?: string; saved?: string }) {
  return error ? <p className="notice error" role="alert">{error}</p> : saved ? <p className="notice success" role="status">Saved successfully.</p> : null;
}

export function ProductFields({ product }: { product?: Variant }) {
  return <>
    {product && <input type="hidden" name="product" value={product.product_id}/>}
    <ProductAiFill enabled={geminiEnabled()} canAttachPhoto={photoUploadsEnabled()} savedPhotos={product?.images.length ?? 0}/>
    <div className="form-grid"><label>Product name<input name="name" defaultValue={product?.product} required maxLength={100}/></label>
    <label>Brand<input name="brand" defaultValue={product?.brand} required maxLength={100}/></label>
    <label>Category<select name="category" defaultValue={product?.category}>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
    <label>Image URL<input name="image" defaultValue={product?.image} maxLength={500} placeholder="https://…"/></label></div>
    <label>Description<textarea name="description" defaultValue={product?.description} required maxLength={2000}/></label>
    <label className="checkbox"><input type="checkbox" name="published" defaultChecked={product?.published ?? true}/> Publish to the storefront when stock is available</label>
  </>;
}

export function VariantFields({ variant }: { variant?: Variant }) {
  return <>
    {variant && <input type="hidden" name="variant" value={variant.id}/>}
    <div className="form-grid">
    <label>Variant name<input name="variant name" defaultValue={variant?.name} placeholder="16 GB / 512 GB" required maxLength={100}/></label>
    <label>SKU<input name="sku" defaultValue={variant?.sku} required maxLength={100}/></label>
    <label>Price in naira<input type="number" name="price" defaultValue={variant?.price} min="1" max="100000000" required/></label>
    {!variant && <label>Opening quantity<input type="number" name="quantity" min="0" max="1000000" defaultValue="0" required/></label>}
    </div>
    <label>Use cases, separated by commas<input name="uses" defaultValue={variant?.uses.join(', ')} maxLength={300} placeholder="Coding, Study, Office"/></label>
    <label>Specifications, one per line<textarea name="specs" defaultValue={variant && Object.entries(variant.specs).map(([key, value]) => `${key}: ${value}`).join('\n')} placeholder={'RAM: 16 GB\nWeight: 1.4 kg'} maxLength={2000}/></label>
  </>;
}

export function StockBadge({ item }: { item: Variant }) {
  const status = item.quantity === 0 ? 'Out of stock' : item.available === 0 ? 'All reserved' : item.available <= 3 ? 'Low stock' : 'In stock';
  return <span className={`status ${item.quantity === 0 ? 'red' : item.available <= 3 ? 'amber' : 'green'}`}>{status}</span>;
}
