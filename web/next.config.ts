import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-contained server bundle for Docker deployment
  output: "standalone",
};

export default nextConfig;
