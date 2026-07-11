import { MetadataRoute } from 'next';

const BASE_URL = 'https://rifx-marketing.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    { path: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { path: '/servicios', priority: 0.9, changeFrequency: 'weekly' as const },
    { path: '/servicios/anuncios-de-alta-velocidad', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/servicios/diseno-web-inmersivo', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/servicios/ecommerce-interestelar', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/servicios/whatsapp-ai', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/sobre-nosotros', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/contacto', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/formulario', priority: 0.6, changeFrequency: 'monthly' as const },
    { path: '/politica-privacidad', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terminos', priority: 0.3, changeFrequency: 'yearly' as const },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
