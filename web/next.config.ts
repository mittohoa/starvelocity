import type { NextConfig } from 'next';

/**
 * GitHub Pages serves a project repository at /<repo>/ rather than at the
 * domain root. Set BASE_PATH=/<repo> in that case; leave it unset for a user
 * page, an org page, or a custom domain.
 */
const basePath = process.env.BASE_PATH ?? '';

const config: NextConfig = {
  // Fully static output: the collector runs twice a day, so there is nothing to
  // compute per request. No database, no server, no runtime cost — which is what
  // keeps the whole deployment inside free tiers.
  output: 'export',

  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  // Static export cannot run the image optimiser. GitHub avatars are served
  // straight from avatars.githubusercontent.com.
  images: { unoptimized: true },

  // Directory-style URLs so a static host serves /trending/daily/index.html
  // without needing rewrite rules.
  trailingSlash: true,
};

export default config;
