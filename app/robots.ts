import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/panel', '/api/', '/dala-clone'],
      },
    ],
    sitemap: 'https://rifx-marketing.com/sitemap.xml',
  };
}
