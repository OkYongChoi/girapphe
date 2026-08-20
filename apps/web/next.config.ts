import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, '../..');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: {
    root: monorepoRoot,
  },
  transpilePackages: ['@stem-brain/graph-engine', '@stem-brain/shared'],
};

export default nextConfig;

void initOpenNextCloudflareForDev({
  configPath: path.join(appDir, 'wrangler.dev.jsonc'),
  persist: false,
  remoteBindings: false,
});
