import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude native modules from the webpack bundle so they load at runtime.
  // better-sqlite3 contains native C++ bindings that cannot be bundled.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
