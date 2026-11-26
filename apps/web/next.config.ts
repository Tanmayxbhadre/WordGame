import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@wordshift/shared-types',
    '@wordshift/ui-tokens',
    '@wordshift/word-dictionary',
    '@wordshift/game-engine',
  ],
};

export default nextConfig;
