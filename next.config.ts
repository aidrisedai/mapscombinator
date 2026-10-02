import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained Node server for Railway (see DEPLOYMENT.md).
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  experimental: {
    serverActions: {
      // Weekly resources are uploaded through a route handler; actions stay small.
      bodySizeLimit: "1mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
