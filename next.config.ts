import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: process.cwd() },
  devIndicators: false,
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
};

export default config;
