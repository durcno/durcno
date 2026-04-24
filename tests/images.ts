export const images = {
  "postgres:14-alpine": "postgres:14-alpine",
  "postgres:15-alpine": "postgres:15-alpine",
  "postgres:16-alpine": "postgres:16-alpine",
  "postgres:17-alpine": "postgres:17-alpine",
  "postgres:18-alpine": "postgres:18-alpine",
  "postgis/postgis:18-3.6-alpine": "postgis/postgis:18-3.6-alpine",
} as const;

export type Image = keyof typeof images;
