import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");
const builds = [
  {
    entryPoints: ["src/extension.ts"],
    bundle: true,
    outfile: "dist/extension.js",
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    sourcemap: true,
    target: "node20"
  },
  {
    entryPoints: ["src/webview.ts"],
    bundle: true,
    outfile: "media/main.js",
    format: "iife",
    platform: "browser",
    sourcemap: true,
    target: "es2022"
  },
  {
    entryPoints: ["src/webview.css"],
    bundle: true,
    outfile: "media/style.css",
    assetNames: "assets/[name]-[hash]",
    loader: { ".ttf": "file" }
  }
];

if (watch) {
  const contexts = await Promise.all(builds.map((options) => context(options)));
  await Promise.all(contexts.map((item) => item.watch()));
  console.log("Compass Code build watching for changes.");
} else {
  await Promise.all(builds.map((options) => build(options)));
}
