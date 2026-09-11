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
  // The scoring service worker (public/sw.js) must never be served from a cache,
  // or phones keep running an old worker.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
