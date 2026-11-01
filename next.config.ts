import type { NextConfig } from "next";
import cloud from "./aicos.config.json";

// GitHub Pages serves a project site under /<repo>/. CI sets NEXT_PUBLIC_BASE_PATH
// (e.g. "/ai-company-os"); local dev and `npm run preview` leave it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  // /tasks/ -> tasks/index.html, so a hard refresh on any route resolves on a static host.
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_COMMIT_SHA: process.env.GITHUB_SHA ?? "",
    // Cloud sync settings come from aicos.config.json; an env var (even empty) overrides, e.g. to test local-only mode.
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? cloud.supabaseUrl,
    NEXT_PUBLIC_SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_KEY ?? cloud.supabasePublishableKey,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
