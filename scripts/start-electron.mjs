#!/usr/bin/env node
/**
 * start-electron.mjs
 * 跨平台启动 Electron，彻底清除 ELECTRON_RUN_AS_NODE
 * 用法: node scripts/start-electron.mjs [electron-args...]
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(__dirname, '..');

// 彻底清除 ELECTRON_RUN_AS_NODE（WorkBuddy 终端会注入这个变量）
// 必须从 process.env 里 delete，这样子进程才不会继承
delete process.env.ELECTRON_RUN_AS_NODE;

// 找到 electron 二进制路径
const electronBin = process.platform === 'win32'
  ? resolve(projectRoot, 'node_modules', '.bin', 'electron.cmd')
  : resolve(projectRoot, 'node_modules', '.bin', 'electron');

const args = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['dist/desktop/electron-main.cjs'];

console.error(`[start-electron] spawn: ${electronBin} ${args.join(' ')}`);
console.error(`[start-electron] ELECTRON_RUN_AS_NODE=${process.env.ELECTRON_RUN_AS_NODE ?? '(unset)'}`);

// 关键：不传 env 选项，让子进程继承当前 process.env
// 由于上面已经 delete 了 ELECTRON_RUN_AS_NODE，子进程不会继承它
const child = spawn(electronBin, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',  // Windows 需要 shell 来跑 .cmd 文件
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[start-electron] electron killed by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[start-electron] failed to start electron:', err.message);
  console.error('[start-electron] tried:', electronBin);
  process.exit(1);
});
