import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@muicv/shared', '@muicv/ui'],
};

export default nextConfig;
