import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Tell Next.js/Turbopack our app root to silence the multi-lockfile warning
  turbopack: {
    // Use this folder (frontend) as the project root
    root: __dirname,
  },
};

export default nextConfig;
