import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

function offlineCache(): Plugin {
  let output: string;
  let root: string;
  return {
    name: "lulian-offline",
    apply: "build",
    configResolved(config) {
      root = config.root;
      output = resolve(root, config.build.outDir);
    },
    closeBundle() {
      const files = [
        "index.html",
        "deer.svg",
        ...readdirSync(resolve(output, "assets")).map(
          (file) => `assets/${file}`,
        ),
      ];
      const worker = readFileSync(resolve(root, "src/sw.js"), "utf8");
      const hash = createHash("sha256").update(worker);
      files
        .sort()
        .forEach((file) =>
          hash.update(file).update(readFileSync(resolve(output, file))),
        );
      const config = `const BUILD_ID = ${JSON.stringify(hash.digest("hex").slice(0, 16))};\nconst PRECACHE = ${JSON.stringify(files.map((file) => `./${file}`))};\n`;
      writeFileSync(resolve(output, "sw.js"), config + worker);
    },
  };
}

export default defineConfig({
  plugins: [react(), offlineCache()],
  base: "./",
  server: { port: 5173, strictPort: true },
});
