import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/i18n';
// `output: export` has no server to build this on request, so it must be
// generated once at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
