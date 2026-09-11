import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Native module; must stay external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
