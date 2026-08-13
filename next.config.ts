import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening via LAN IP / tunnel hostnames in Chrome
  allowedDevOrigins: ["*"],
};

export default nextConfig;
