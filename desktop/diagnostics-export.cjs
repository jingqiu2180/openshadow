/**
 * diagnostics-export.cjs — 一键反馈/报错导出
 *
 * 把 ~/.openshadow 下的日志与诊断信息打包成一个可发送的文本文件，
 * 通过原生保存对话框让用户选择落盘位置。零依赖（不引入 zip 库），
 * 产出单个 .txt，便于用户直接贴到 GitHub Issue / 邮件。
 *
 * 安全边界：只收集「日志与诊断」类文件（server-info.json、launch.log、
 * logs/*、user/preferences.json、user/gpu-startup.json）。
 * 绝不收集可能含 API Key 的文件（agents/ 下的 config.yaml、auth.json 等）。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 单文件读取上限：超过则截断，避免导出文件过大
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB

function collectEntries(home) {
  const entries = [];
  const pushFile = (rel) => {
    const abs = path.join(home, rel);
    try {
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        entries.push({ rel, abs });
      }
    } catch {
      /* 忽略无权限/不存在 */
    }
  };

  // 单文件诊断
  pushFile('server-info.json');
  pushFile('launch.log');
  pushFile(path.join('user', 'preferences.json'));
  pushFile(path.join('user', 'gpu-startup.json'));

  // logs 目录整体
  const logsDir = path.join(home, 'logs');
  try {
    if (fs.existsSync(logsDir) && fs.statSync(logsDir).isDirectory()) {
      for (const name of fs.readdirSync(logsDir)) {
        const abs = path.join(logsDir, name);
        try {
          if (fs.statSync(abs).isFile()) entries.push({ rel: path.join('logs', name), abs });
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }

  return entries;
}

function readEntry(abs) {
  try {
    let content = fs.readFileSync(abs, 'utf-8');
    if (content.length > MAX_FILE_BYTES) {
      content = content.slice(0, MAX_FILE_BYTES) + `\n... [truncated: file > ${MAX_FILE_BYTES} bytes] ...`;
    }
    return content;
  } catch (err) {
    return `<failed to read: ${err && err.message ? err.message : String(err)}>`;
  }
}

function buildBundle(home, version) {
  const header = [
    'OpenShadow Diagnostics',
    `Generated: ${new Date().toISOString()}`,
    `App Version: ${version}`,
    `Platform: ${process.platform} ${process.arch}`,
    `Node: ${process.versions.node}`,
    `User Data Dir: ${home}`,
    '',
  ];

  const sections = [...header];
  const entries = collectEntries(home);
  if (entries.length === 0) {
    sections.push('(no diagnostic files found)');
  } else {
    for (const e of entries) {
      sections.push(`===== ${e.rel} =====`);
      sections.push(readEntry(e.abs));
      sections.push('');
    }
  }
  return sections.join('\n');
}

/**
 * 收集诊断信息并弹出保存对话框。
 * @param {{ openShadowHome?: string }} opts
 * @returns {Promise<{ok:boolean, canceled?:boolean, path?:string, error?:string}>}
 */
async function exportDiagnostics({ openShadowHome } = {}) {
  const { dialog, BrowserWindow, app } = require('electron');
  const home = openShadowHome || process.env.OPENSHADOW_HOME || path.join(os.homedir(), '.openshadow');
  const version = app.getVersion();

  const text = buildBundle(home, version);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `openshadow-diagnostics-${stamp}.txt`;

  const parent = BrowserWindow.getFocusedWindow() || undefined;
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    title: '导出诊断信息',
    defaultPath: path.join(app.getPath('downloads') || os.homedir(), baseName),
    filters: [{ name: 'Text', extensions: ['txt'] }],
  });

  if (canceled || !filePath) {
    return { ok: false, canceled: true };
  }

  fs.writeFileSync(filePath, text, 'utf-8');
  return { ok: true, path: filePath };
}

module.exports = { exportDiagnostics };
