import Link from 'next/link';
import { ArrowUpRight, Boxes, MapPin, ShoppingBag } from 'lucide-react';
import { demoMode } from '../../lib/db';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>
    <div className="topline"><MapPin size={13}/> Nsukka, Enugu <span>·</span> {demoMode ? 'Demo catalogue' : 'Shop pickup available'}</div>
    <header className="site-header">
      <div className="wrap nav">
        <Link className="brand" href="/"><span className="brand-icon"><Boxes size={22}/></span> muchroom<span className="dot">.</span></Link>
        <nav aria-label="Main navigation"><Link href="/#catalogue">Shop</Link><Link href="/finder">Product finder</Link></nav>
        <Link className="bag-link" href="/cart" aria-label="Shopping bag"><ShoppingBag size={19}/><span>Bag</span></Link>
      </div>
    </header>
    <main>{children}</main>
    <footer className="site-footer"><div className="wrap footer-row"><Link className="brand" href="/">muchroom<span className="dot">.</span></Link><span>University Road, Nsukka</span><Link href="/admin">Staff access <ArrowUpRight size={14}/></Link></div></footer>
  </>;
}
