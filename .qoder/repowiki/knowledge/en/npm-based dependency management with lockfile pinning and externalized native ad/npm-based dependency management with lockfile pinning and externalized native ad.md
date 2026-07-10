---
kind: dependency_management
name: npm-based dependency management with lockfile pinning and externalized native addons
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - package-lock.json
    - vite.config.server.js
    - scripts/build-server.mjs
    - scripts/build-server-deps.mjs
    - scripts/_copy-deps.cjs
    - scripts/patch-pi-sdk.cjs
---

This repository uses npm as its sole package manager for the entire monorepo. All third-party dependencies are declared in the root `package.json` under `dependencies` and `devDependencies`, and a single `package-lock.json` at the repo root serves as the canonical lockfile — there is no pnpm/yarn lock, no per-package manifests, and no vendoring of source code.

### What system/approach is used
- **npm + lockfile**: The root `package.json` declares all runtime and dev dependencies; `package-lock.json` pins exact versions across the whole tree.
- **Vite/Rollup externals**: Server-side native or incompatible packages (`better-sqlite3`, `node-pty`, `@node-rs/jieba`, `ws`, `jsdom`, `exceljs`, `mammoth`, `proxy-agent`, `undici`, `qrcode`, `fsevents`, `@larksuiteoapi/node-sdk`, `node-telegram-bot-api`, `@silvia-odwyer/photon-node`, `@mariozechner/*`) are listed in `vite.config.server.js` Rollup `external` so they are never bundled into the server bundle.
- **Standalone server packaging**: `scripts/build-server.mjs` builds a self-contained Node distribution (`dist-server/{platform}-{arch}/`) that ships an embedded pinned Node.js v24.15.0 runtime, a Vite-bundled `bundle/` directory, and a minimal `node_modules/` containing only the external deps resolved from the root lockfile.
- **Postinstall patching**: A `postinstall` hook runs `scripts/patch-pi-sdk.cjs` to harden the Pi SDK after install; the same script is re-run inside the packaged server artifact.

### Key files and packages
- `package.json` — single source of truth for all dependency declarations (runtime + dev).
- `package-lock.json` — canonical lockfile read by the build pipeline to pin exact versions.
- `vite.config.server.js` — central `external` list that defines which packages must stay as runtime npm modules instead of being bundled.
- `scripts/build-server.mjs` — orchestrates downloading a pinned Node.js runtime, running Vite/esbuild bundling, deriving the external dep set from the lockfile, installing them via the target Node's npm, then pruning unused files with `@vercel/nft`.
- `scripts/build-server-deps.mjs` — helpers that derive `buildExternalPackage()` from the lockfile, collect optional-dependency directories, and verify external entrypoints exist post-install.
- `scripts/_copy-deps.cjs` — generates a parallel `dist-server-bundle/package.json` mirroring the server externals for the Electron-packaged server.
- `scripts/patch-pi-sdk.cjs` — postinstall integrity check applied both during development installs and inside the standalone server artifact.

### Architecture and conventions
- **Single lockfile policy**: Every external dependency version comes from `package-lock.json`; the build scripts explicitly reject missing lock entries (`getLockedPackageVersion` throws if a package path is absent from `packages`).
- **Externals drive installation**: The server packaging flow computes the installed dep set by intersecting `vite.config.server.js`'s `external` array with `rootPkg.dependencies`, then adds transitive pinned deps like `lru-cache`. Nothing is manually maintained in two places.
- **Native addon ABI safety**: The build downloads a specific Node.js v24.15.0 binary, caches it under `.cache/node-runtime` (with SHA-256 verification), and runs `npm install` *inside* that environment so native addons (`better-sqlite3`, `node-pty`, `@node-rs/jieba`) compile against the correct ABI. Runtime smoke tests validate jieba tokenization and SQLite queries immediately after install.
- **Pruning & size control**: After install, `@vercel/nft` traces reachable files from the bundle entrypoint and deletes untracked artifacts; platform-specific prebuilds for `koffi` and `node-pty` are stripped, and known large dead trees (`exceljs/dist/`, `@larksuiteoapi/node-sdk/types/`) are removed.
- **Electron packaging**: `electron-builder` is configured with `npmRebuild: false` and an `afterPack` hook (`scripts/fix-modules.cjs`) that adjusts module resolution for the asar archive.

### Rules developers should follow
- Add new runtime dependencies only in the root `package.json`; do not create per-package `package.json` files in this monorepo.
- If a package cannot be bundled into the server (native addon, CJS interop issue, browser-vs-node dual entry), add it to the `external` array in `vite.config.server.js` — the build will automatically pick it up for installation.
- Keep `package-lock.json` committed; the build will fail if a required package is missing from the lockfile.
- Do not rely on transitive-only packages for server runtime; the build derives the external dep set from `rootPkg.dependencies ∩ external`, so undeclared transitive imports will cause a missing-entrypoint error.
- When adding a plugin that depends on npm packages, ensure those packages are also present in the root `dependencies`; the build checks for undeclared plugin deps and aborts.
- Avoid changing the Node.js major version without updating the pinned `NODE_VERSION` and checksums in `scripts/build-server.mjs`, since native addon ABIs are tied to it.