import { build } from "esbuild";

await build({ entryPoints: ["src/extension.ts"], bundle: true, format: "cjs", platform: "node", outfile: "dist/extension.js", external: ["vscode"], sourcemap: true, minify: false });
await build({ entryPoints: ["src/webview/main.tsx"], bundle: true, format: "iife", platform: "browser", outfile: "media/main.js", sourcemap: true, jsx: "automatic", minify: false });
