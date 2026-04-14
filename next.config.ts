import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  distDir: process.env.SLC_NEXT_DIST_DIR ?? ".next",
  typescript: {
    tsconfigPath: process.env.SLC_NEXT_TSCONFIG_PATH ?? "tsconfig.json",
  },
  serverExternalPackages: ["lighthouse", "chrome-launcher"],
};

export default nextConfig;
