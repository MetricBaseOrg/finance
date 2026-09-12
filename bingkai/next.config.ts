import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Standalone bundles the server plus only the traced dependencies, which is what
  // the Docker runtime stage copies. Same arrangement as apps/platform.
  output: "standalone",
  // Frames are small PNGs held as data URLs in Postgres for v1, so the create
  // endpoint takes a larger body than the default.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default config;
