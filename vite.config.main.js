// vite.config.main.js
// Build desktop/main.cjs (Electron main process) with Vite lib mode.
// Output: desktop/main.bundle.cjs (CJS)
import { defineConfig } from "vite";
import { builtinModules } from "module";

const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  build: {
    lib: {
      entry: "desktop/main.cjs",
      formats: ["cjs"],
      fileName: () => "main.bundle.cjs",
    },
    outDir: "desktop",
    emptyOutDir: false,
    rollupOptions: {
      external: [
        "electron",
        ...nodeBuiltins,
        // CJS native addons / large deps: keep external
        "ws",
        "mammoth",
        "exceljs",
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
