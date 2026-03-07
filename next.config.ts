import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    domains: [
      process.env.NEXT_PUBLIC_SUPABASE_URL
        ?.replace("https://", "")
        .replace("http://", "")
        .split("/")[0] || "",
    ].filter(Boolean),
    formats: ["image/avif", "image/webp"],
  },
  reactStrictMode: true,
};

export default nextConfig;
