import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

// Wires up local `next dev` to use the same Workers runtime bindings
// (env vars, etc.) as the deployed Cloudflare Worker.
initOpenNextCloudflareForDev();

export default nextConfig;
