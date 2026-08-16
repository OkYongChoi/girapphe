import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin', '/*/admin', '/my-knowledge', '/*/my-knowledge'],
    },
    sitemap: 'https://www.girapphe.com/sitemap.xml',
  };
}
