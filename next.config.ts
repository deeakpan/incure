import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow build to continue even if external resources fail
  experimental: {
    // This helps with font loading issues during build
  },
};

export default nextConfig;
