import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Native module; must stay external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // The organiser table moved into the admin interface.
  async redirects() {
    return [{ source: "/entries", destination: "/admin/entries", permanent: false }];
  },
};

export default nextConfig;
