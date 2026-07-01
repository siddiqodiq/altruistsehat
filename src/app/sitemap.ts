import { MetadataRoute } from 'next'
 
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: 'https://altruistsehat.vercel.app',
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://altruistsehat.vercel.app/leaderboard',
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
