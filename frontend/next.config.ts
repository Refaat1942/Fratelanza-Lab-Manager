import type { NextConfig } from "next";

// Same-origin /api/v1 is proxied to the backend so the browser never needs CORS.
// nginx handles /api/ first in production; this covers `npm run dev` and direct port access.
const internalApiUrl = (
  process.env.INTERNAL_API_URL ||
  (process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://localhost:8000")
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${internalApiUrl}/api/v1/:path*` }];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async redirects() {
    return [
      { source: "/referrals", destination: "/dashboard", permanent: false },
      { source: "/crm", destination: "/dashboard", permanent: false },
      { source: "/marketing", destination: "/dashboard", permanent: false },
      { source: "/purchasing", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
