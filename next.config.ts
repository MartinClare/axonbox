import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening via LAN IP / tunnel hostnames in Chrome
  allowedDevOrigins: ["*"],
  experimental: {
    // Meeting minutes / evidence uploads (JSON base64 payloads)
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
