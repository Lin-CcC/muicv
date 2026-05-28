import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  transpilePackages: ['@muicv/shared', '@muicv/ui'],
  // 关掉 X-Powered-By 头：不暴露技术栈，省一点字节
  poweredByHeader: false,
  // i.muicv.com 是证件照 R2 CDN；允许 next/image 在需要时优化它
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.muicv.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
