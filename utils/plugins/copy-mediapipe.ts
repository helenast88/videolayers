import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { PluginOption } from "vite";

export default function copyMediaPipe(outDir: string): PluginOption {
  return {
    name: "copy-mediapipe",
    writeBundle() {
      const module = createRequire(import.meta.url).resolve("@mediapipe/tasks-vision");
      const source = resolve(dirname(module), "wasm");
      const target = resolve(outDir, "assets", "mediapipe");
      mkdirSync(target, { recursive: true });
      // The extension CSP only allows local code, including MediaPipe's loader and WebAssembly.
      for (const file of readdirSync(source)) copyFileSync(resolve(source, file), resolve(target, file));
    },
  };
}
