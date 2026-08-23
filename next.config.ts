import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // next dev が AGENTS.md / CLAUDE.md を書き足すのを止める。
  agentRules: false,
};

export default nextConfig;
