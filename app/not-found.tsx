import Link from 'next/link';

export default function NotFound() {
  return <section className="wrap section narrow"><div className="panel"><h1>Page unavailable</h1><p className="muted">This page may have moved, or the item may be out of stock.</p><Link className="button primary" href="/">Back to Muchroom</Link></div></section>;
}
