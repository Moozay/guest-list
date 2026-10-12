import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  transpilePackages: ['@workspace/api-client-react'],
};

export default nextConfig;
