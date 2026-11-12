import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: { default: 'Muchroom | Campus tech in Nsukka', template: '%s | Muchroom' },
  description: 'Shop laptops, projectors and accessories for life at the University of Nigeria, Nsukka. Find in-stock tech that fits your course and budget.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
