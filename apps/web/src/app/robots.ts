import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/*/admin', '/my-knowledge', '/*/my-knowledge', '/topics', '/topics/*', '/*/topics', '/*/topics/*', '/knowledge-inbox', '/knowledge-inbox/*', '/*/knowledge-inbox', '/*/knowledge-inbox/*'],
    },
    sitemap: 'https://www.girapphe.com/sitemap.xml',
  };
}
