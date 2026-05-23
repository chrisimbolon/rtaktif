// frontend/next.config.ts
// IMPORTANT: output: "standalone" is REQUIRED for Docker multi-stage build
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",   // ← REQUIRED for Docker

  images: {
    domains: ["sgp1.digitaloceanspaces.com"],
  },

  async rewrites() {
    return [
      {
        source:      "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
