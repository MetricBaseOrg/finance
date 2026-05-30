import type { NextConfig } from "next"

const devOrigins = (process.env.DEV_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const nextConfig: NextConfig = {
  // Standalone output so the Docker image stays small (only the server +
  // traced deps are copied into the runtime stage).
  output: 'standalone',
  // Pin the workspace root — the repo has multiple lockfiles, and Next would
  // otherwise infer D:\MetricBase as root and mis-trace standalone output.
  turbopack: { root: __dirname },
  ...(devOrigins.length > 0 && { allowedDevOrigins: devOrigins }),
}

export default nextConfig
