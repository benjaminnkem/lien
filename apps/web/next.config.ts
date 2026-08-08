import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["lien-sdk", "@repo/ui"],
};

export default nextConfig;
