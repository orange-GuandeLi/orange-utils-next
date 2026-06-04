import type { MetadataRoute } from "next";

const BASE_URL = "https://utils.orange-ai.site";

const tools = [
  { path: "/tools/html-selector", priority: 0.9 },
  { path: "/tools/api-request", priority: 0.9 },
  { path: "/tools/code-compare", priority: 0.9 },
  { path: "/tools/regex-tester", priority: 0.9 },
  { path: "/tools/markdown", priority: 0.9 },
  { path: "/tools/resource-manager", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...tools.map((tool) => ({
      url: `${BASE_URL}${tool.path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: tool.priority,
    })),
  ];
}
