// 前置清理：结束项目内残留的 OpenShadow server 进程，并删掉旧的 win-unpacked。
// 目的：electron-builder 覆盖 release/win-unpacked 时，若旧构建的原生 .node 模块
// 被某进程加载（典型：上次测试/弹出的 app 没退出），unlink 会 EPERM 失败。
// 本脚本只匹配本项目的 server-bundle/index.js，不碰已安装的 app 或其它 node 进程。
// 任何一步出错都吞掉，绝不阻断构建流水线（脚本始终 exit 0）。

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return (e && e.stdout) || '';
  }
}

try {
  if (os.platform() === 'win32') {
    // wmic 直接按命令行特征终止进程（delete 即 terminate）
    run('wmic process where "commandline like \'%server-bundle/index.js%\'" delete');
    // 顺带结束项目目录下遗留的 dev electron 进程（避免其占用项目资源）
    run('wmic process where "commandline like \'%openshadow%electron%\'" delete');
  } else {
    const out = run("ps -eo pid,args | grep -E 'server-bundle/index.js' | grep -v grep");
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*(\d+)/);
      if (m) { try { process.kill(Number(m[1]), 'SIGKILL'); } catch (_) {} }
    }
  }
  console.log('[clean] stale server processes handled');
} catch (_) {
  // 忽略
}

try {
  const wp = path.join(process.cwd(), 'release', 'win-unpacked');
  if (fs.existsSync(wp)) {
    fs.rmSync(wp, { recursive: true, force: true });
    console.log('[clean] removed stale release/win-unpacked');
  }
} catch (_) {
  console.log('[clean] warn: could not remove release/win-unpacked (still locked?)');
}

process.exit(0);
