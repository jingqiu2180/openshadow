---
kind: build_system
name: Monorepo Build, Packaging & Release Pipeline
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.server.js
    - scripts/build-server.mjs
    - scripts/build-server-deps.mjs
    - scripts/build-server-plugin-runtime-deps.mjs
    - scripts/build-server-runtime-assets.mjs
    - scripts/start-electron.mjs
    - vite.config.ts
    - vite.config.main.js
    - vite.config.preload.js
    - tsconfig.build.json
    - .github/workflows/release.yml
    - playwright.config.ts
    - vitest.config.ts
---

## What system/approach is used

OpenShadow uses a Node.js + Vite + Electron Builder monorepo build pipeline with three distinct output targets:

- Standalone Node server bundle: Vite bundles server/index.ts into a single ESM file (dist-server-bundle/index.js) with native addons and heavy CJS packages externalized; a custom scripts/build-server.mjs downloads a pinned Node.js v24 runtime, installs only the external deps against that runtime (ensuring ABI match for better-sqlite3, node-pty, @node-rs/jieba), runs @vercel/nft to prune unused files from node_modules, then ships a self-contained dist-server/{platform}-{arch}/ directory with wrapper scripts.
- Electron desktop app: React renderer built by vite.config.ts into desktop/dist-renderer/; main/preload bundled via vite.config.main.js / vite.config.preload.js; packaged by electron-builder (NSIS on Windows, AppImage/deb on Linux, dmg/zip on macOS) with platform-specific extra resources (the standalone server binary).
- Plugin ecosystem: Built-in plugins ship as source under plugins/ and are dynamically imported at runtime; their npm dependencies are collected and installed alongside the server bundle.

CI is GitHub Actions (.github/workflows/release.yml) triggered on v* tags, building all three platforms in parallel and publishing artifacts to a GitHub Release.

## Key files and packages

Root package and npm scripts: package.json
Server bundling entry: vite.config.server.js
Standalone server packager: scripts/build-server.mjs
External-dep derivation utilities: scripts/build-server-deps.mjs
Plugin-runtime dep copier: scripts/build-server-plugin-runtime-deps.mjs
Runtime asset copier: scripts/build-server-runtime-assets.mjs
Electron launcher helper: scripts/start-electron.mjs
Renderer build config: vite.config.ts
Main/preload configs: vite.config.main.js, vite.config.preload.js
TypeScript build surface: tsconfig.build.json
CI release workflow: .github/workflows/release.yml
Unit tests: vitest.config.ts, vitest.setup.ts
Playwright E2E: playwright.config.ts, playwright.functional.config.ts
Electron packaging manifest: package.json build.* section

## Architecture and conventions

Two-tier dependency model:
- Bundled code: everything except native addons and known problematic CJS/browser dual-entry packages is inlined into one chunk (inlineDynamicImports: true). This avoids TDZ ReferenceErrors caused by circular imports across core/, lib/, hub/, and shared/.
- External dependencies: declared in vite.config.server.js rollupOptions.external list. The packager derives the exact set of npm packages to install by intersecting this list with package.json dependencies, pinning versions from package-lock.json. This eliminates manual duplication between bundler externals and installer manifests.

Pinned Node.js runtime:
The packager downloads a specific Node.js v24.15.0 distribution per target platform/architecture (with SHA-256 verification) and runs npm install against it. This guarantees that native addon ABIs (better-sqlite3, node-pty, @node-rs/jieba) match the shipped runtime, regardless of the host machine's Node version.

Post-bundle pruning:
After npm install, @vercel/nft traces the actual import graph from bundle/index.js and deletes every file in node_modules not reached, while protecting entire directories for packages whose dynamic exports can't be statically traced. Additional targeted cleanups remove multi-platform prebuilt binaries from koffi and node-pty, browser bundles from exceljs, and type declarations from @larksuiteoapi/node-sdk.

Electron packaging:
electron-builder consumes the already-built server bundle (dist-server-bundle/**) plus the renderer (desktop/dist-renderer/**) and copies them into the app bundle under resources/server-bundle/ and resources/assets/. Platform-specific extra resources embed the standalone server binary for each arch. A post-pack hook (scripts/fix-modules.cjs) fixes executable bits on native helpers.

Dev vs. production surfaces:
Development: tsx watch start.ts runs the raw TS server; npm run dev:web starts the Vite dev server; npm run electron:dev concurrently launches server + Vite + Electron.
Production: npm run build produces dist-server-bundle/ and desktop/dist-renderer/; npm run dist:* triggers full cross-platform packaging.

Test orchestration:
Vitest runs unit tests against the compiled core/lib/shared surface. Playwright spins up both the prebuilt server (dist-server-bundle/index.js) and the Vite dev server as child processes, serving the renderer at http://127.0.0.1:5280 and the API at http://127.0.0.1:3000.

## Rules developers should follow

1. Adding an external dependency: Declare it in package.json and add its package name (or regex) to the external array in vite.config.server.js. The packager will derive the install manifest automatically; forgetting either side breaks the standalone server at runtime.
2. Native addons: Do not try to bundle better-sqlite3, node-pty, or @node-rs/*. They must stay external so the pinned Node runtime can compile/download the correct ABI during npm install.
3. CJS / dual-entry packages: If a package has separate browser and Node entry points (e.g. qrcode, ws), mark it external so Node resolution picks the Node variant. Bundling these often breaks because Rollup/Vite pick the browser entry.
4. Runtime data files: Files read via fromRoot() at runtime (templates, i18n JSON, default models) must be copied by scripts/build-server-runtime-assets.mjs; they cannot be inlined into the bundle.
5. Cross-platform builds: Use npm run dist:win, dist:linux, or dist:mac (or dist:all) rather than invoking electron-builder directly; the scripts ensure the server bundle is built first and extra resources are wired correctly.
6. Versioning: The version lives in root package.json and is propagated into the packaged server's own package.json and artifact filenames via ${version} placeholders. Tagging vX.Y.Z triggers the GitHub Actions release pipeline.
7. Plugin dependencies: Any npm package imported by a plugin under plugins/ must also appear in root dependencies; the packager validates this and fails if a bundled plugin references an undeclared package.