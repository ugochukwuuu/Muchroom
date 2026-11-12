import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
  experimental: { serverActions: { bodySizeLimit: '13mb' } },
};
export default config;
