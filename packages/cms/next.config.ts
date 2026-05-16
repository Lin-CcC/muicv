import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
import { withPayload } from '@payloadcms/next/withPayload';

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  transpilePackages: ['@muicv/shared'],
};

export default withPayload(nextConfig);
