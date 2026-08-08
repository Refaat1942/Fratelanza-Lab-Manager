import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
      { source: "/suppliers", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
