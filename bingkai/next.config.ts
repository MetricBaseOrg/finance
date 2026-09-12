import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Frames are small PNGs held as data URLs in Postgres for v1, so the create
  // endpoint takes a larger body than the default.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default config;
