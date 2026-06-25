// vite.config.preload.js
// Build desktop/preload.cjs (Electron preload script) with Vite lib mode.
// Output: desktop/preload.bundle.cjs (CJS)
import { defineConfig } from "vite";
import { builtinModules } from "module";

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  build: {
    lib: {
      entry: "desktop/preload.cjs",
      formats: ["cjs"],
      fileName: () => "preload.bundle.cjs",
    },
    outDir: "desktop",
    emptyOutDir: false,
    rollupOptions: {
      external: [
        "electron",
        ...nodeBuiltins,
      ],
    },
    target: "node22",
    minify: false,
    sourcemap: false,
  },
  resolve: {
    conditions: ["node", "import", "module", "require", "default"],
    mainFields: ["main", "module"],
  },
});
