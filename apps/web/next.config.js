/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");

// Local development runs from apps/web, while the shared ignored .env lives at the repository root.
loadEnvConfig(path.resolve(__dirname, "..", ".."));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone"
};

module.exports = nextConfig;
