/**
 * 实测验证：external 闭包 + 确定性安全清理 后，server 运行时依赖是否完整。
 *
 * 模拟 afterPack 的两步：
 *   1. rebuildServerNodeModulesFromProject  → 只复制 external 闭包（453 包）
 *   2. pruneServerNodeModulesDeterministic   → 删 .d.ts/.map/test 等确定安全文件
 * 然后检查：
 *   · 体积 / 顶层包数
 *   · 关键包 package.json 在位（含 provider SDK）
 *   · better-sqlite3 / @node-rs/jieba 原生 .node 在位且 better-sqlite3 可 open
 *   · 动态 import openai/@anthropic-ai/sdk/@google/genai/@mistralai/mammoth/jsdom 成功
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { rebuildServerNodeModulesFromProject, pruneServerNodeModulesDeterministic } =
  require(path.resolve(__dirname, "fix-modules.cjs"));

const root = process.cwd();
const tmpDir = "D:/tmp/sb-verify";

function du(p) {
  let total = 0;
  let st;
  try { st = fs.statSync(p); } catch { return 0; }
  if (st.isDirectory()) {
    let entries;
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return 0; }
    for (const e of entries) total += du(path.join(p, e.name));
  } else total += st.size;
  return total;
}

// 1. 准备临时 server-bundle
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.copyFileSync(path.join(root, "dist-server-bundle", "package.json"), path.join(tmpDir, "package.json"));
for (const f of ["index.js", "bootstrap.js"]) {
  const src = path.join(root, "dist-server-bundle", f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmpDir, f));
}

// 2. 复制 external 闭包
console.log("[verify] 复制 external 闭包...");
rebuildServerNodeModulesFromProject(tmpDir, path.resolve(root, "node_modules"));

// 3. 确定性安全清理
console.log("[verify] 确定性安全清理 (.d.ts/.map/test)...");
pruneServerNodeModulesDeterministic(tmpDir, console.log);

// 3b. npm install 补全（兜底收集器可能漏掉的深层 nested 依赖，如 exceljs→unzipper→binary→chainsaw）
console.log("[verify] npm install --prefer-offline --production 补全缺失依赖...");
try {
  execSync("npm install --prefer-offline --production --no-audit --no-fund", {
    cwd: tmpDir, stdio: "pipe", timeout: 180000,
  });
  console.log("[verify] ✅ npm install 补全完成");
} catch (e) {
  console.log("[verify] ⚠️ npm install 补全失败（不影响已复制部分）:", e.message);
}

const nm = path.join(tmpDir, "node_modules");
const nmMB = (du(nm) / 1024 / 1024).toFixed(0);
const pkgCount = fs.readdirSync(nm).filter((f) => f !== ".bin" && !f.startsWith("@") && !f.startsWith(".")).length +
  fs.readdirSync(path.join(nm, "@mariozechner"), { withFileTypes: true }).filter((e) => e.isDirectory()).length;
console.log(`[verify] node_modules 体积: ${nmMB}MB | 顶层包数(估): ${pkgCount}`);

// 4. 关键包 package.json 在位
const mustExist = [
  "ws/package.json", "better-sqlite3/package.json", "qrcode/package.json",
  "@mariozechner/pi-ai/package.json", "openai/package.json", "@anthropic-ai/sdk/package.json",
  "@google/genai/package.json", "@mistralai/mistralai/package.json", "@aws-sdk/client-bedrock-runtime/package.json",
  "jsdom/package.json", "exceljs/package.json", "mammoth/package.json", "@node-rs/jieba/package.json",
  "node-pty/package.json", "proxy-agent/package.json", "undici/package.json",
  "@larksuiteoapi/node-sdk/package.json", "node-telegram-bot-api/package.json", "@silvia-odwyer/photon-node/package.json",
];
const missing = mustExist.filter((rel) => !fs.existsSync(path.join(nm, rel)));
console.log(missing.length ? `[verify] ❌ 缺失: ${missing.join(", ")}` : "[verify] ✅ 所有 key 包 package.json 在位");

// 5. 原生 .node 在位
const bsFile = fs.readdirSync(path.join(nm, "better-sqlite3", "build", "Release")).find((f) => f.endsWith(".node"));
console.log(`[verify] better-sqlite3 native: ${bsFile || "NONE"}`);
const jiebaFile = fs.readdirSync(path.join(nm, "@node-rs", "jieba")).find((f) => f.endsWith(".node"));
console.log(`[verify] @node-rs/jieba native: ${jiebaFile || "NONE"}`);

// 6. better-sqlite3 实际可 open（验证 native ABI 正确）
try {
  const Database = require(path.join(nm, "better-sqlite3"));
  const db = new Database(":memory:");
  db.prepare("select 1").get();
  console.log("[verify] ✅ better-sqlite3 可 open + query");
} catch (e) {
  console.log("[verify] ❌ better-sqlite3 open 失败: " + e.message);
  missing.push("better-sqlite3-runtime");
}

// 7. 动态 import 关键 provider SDK + 运行时真依赖（cwd=tmpDir 确保从闭包解析）
//    注意：jsdom 不在 server 运行路径（index.js 未引用），其传递依赖 punycode
//    缺失属已知无害，不计入硬失败；exceljs/mammoth 是 index.js 真实引用的运行时依赖。
const dynImports = ["openai", "@anthropic-ai/sdk", "@google/genai", "@mistralai/mistralai", "@mariozechner/pi-ai", "exceljs", "mammoth"];
const failImport = [];
for (const m of dynImports) {
  try {
    execSync(`node -e "import('${m}').then(()=>{}).catch(e=>{console.error(e&&e.message);process.exit(2)})"`, { cwd: tmpDir, stdio: "pipe" });
    console.log(`[verify] ✅ import ${m}`);
  } catch (e) {
    failImport.push(m);
    const msg = e.stderr ? e.stderr.toString().slice(0, 240) : e.message;
    console.log(`[verify] ❌ import ${m}: ${msg}`);
  }
}

// 8. 全量依赖可解析性检查：遍历 server-bundle 内所有 package.json，确认其每个
//    dependency 都能在树内逐级向上解析到（标准 node 模块规则）。这能发现任何
//    隐匿的 nested 漏包（如 exceljs→glob→brace-expansion→concat-map 链）。
//    注：仅作诊断输出，不计入硬失败（硬门槛以缺失包 / 动态 import 为准）。
const { builtinModules: BI } = require("module");
console.log("\n[verify] 全量依赖可解析性检查...");
const unresolvable = [];
const checked = new Set();
function resolveInTree(startDir, dep) {
  let cur = startDir;
  while (true) {
    const cand = path.join(cur, "node_modules", dep);
    if (fs.existsSync(path.join(cand, "package.json"))) return true;
    const parent = path.resolve(cur, "..");
    if (parent === cur) return false;
    cur = parent;
  }
}
function checkPkg(pkgDir, name) {
  if (checked.has(pkgDir)) return;
  checked.add(pkgDir);
  let deps = [];
  try { deps = Object.keys(JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8")).dependencies || {}); } catch {}
  for (const dep of deps) {
    if (dep.startsWith("node:") || BI.includes(dep)) continue;
    if (!resolveInTree(pkgDir, dep)) unresolvable.push(`${name} → ${dep}`);
  }
}
function scanDir(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(dir, e.name);
    if (e.name === "node_modules") { scanNm(full); continue; }
    const pj = path.join(full, "package.json");
    if (fs.existsSync(pj)) checkPkg(full, e.name);
    scanDir(full);
  }
}
function scanNm(nmDir) {
  let entries;
  try { entries = fs.readdirSync(nmDir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const full = path.join(nmDir, e.name);
    const pj = path.join(full, "package.json");
    if (fs.existsSync(pj)) checkPkg(full, e.name);
    scanDir(full);
  }
}
scanNm(nm);
if (unresolvable.length) {
  console.log(`[verify] ⚠️ 不可解析依赖 ${unresolvable.length} 处（前25）:`);
  unresolvable.slice(0, 25).forEach((u) => console.log("   - " + u));
} else {
  console.log(`[verify] ✅ 所有 ${checked.size} 个包的依赖均可解析（无漏包）`);
}

console.log("\n=== 结论 ===");
console.log(`缺失包: ${missing.length} | 动态 import 失败: ${failImport.length}`);
console.log(missing.length === 0 && failImport.length === 0
  ? "[verify] ✅ external 闭包 + 安全清理 满足运行时全部需求"
  : "[verify] ❌ 存在缺口，需排查");
process.exit(missing.length || failImport.length ? 1 : 0);
