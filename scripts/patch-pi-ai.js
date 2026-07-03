/**
 * scripts/patch-pi-ai.js
 *
 * 打补丁修复 @mariozechner/pi-ai 中的空指针 bug：
 * 当 tool.parameters 为 undefined 时，convertTools / coerceWithJsonSchema
 * 会崩溃。minimax 返回不带 tool calls 的普通文本响应时不触发此路径，
 * 但因为热路径在构建 API 请求时必须遍历全部 tool 定义，任何工具
 * 的 parameters 为 undefined 都会导致整个请求失败。
 *
 * 运行: npm postinstall 自动调用
 */

const fs = require('fs');
const path = require('path');

const patches = [
  {
    file: 'node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js',
    fix: (content) => content.replace(
      'const schema = tool.parameters;',
      'const schema = tool.parameters || {};'
    ),
  },
  {
    file: 'node_modules/@mariozechner/pi-ai/dist/utils/validation.js',
    fix: (content) => {
      // 1. coerceWithJsonSchema: 首行添加 null guard
      content = content.replace(
        'function coerceWithJsonSchema(value, schema) {\n    let nextValue = value;',
        'function coerceWithJsonSchema(value, schema) {\n    if (!schema) return value;\n    let nextValue = value;'
      );
      // 2. validateToolArguments: 添加 null guard
      content = content.replace(
        'export function validateToolArguments(tool, toolCall) {\n    const args = structuredClone(toolCall.arguments);',
        'export function validateToolArguments(tool, toolCall) {\n    if (!tool.parameters) return toolCall.arguments;\n    const args = structuredClone(toolCall.arguments);'
      );
      return content;
    },
  },
];

for (const { file, fix } of patches) {
  const fp = path.join(__dirname, '..', file);
  if (!fs.existsSync(fp)) {
    console.log(`[patch-pi-ai] skip (not found): ${file}`);
    continue;
  }
  const original = fs.readFileSync(fp, 'utf-8');
  const patched = fix(original);
  if (patched !== original) {
    fs.writeFileSync(fp, patched, 'utf-8');
    console.log(`[patch-pi-ai] patched: ${file}`);
  } else {
    console.log(`[patch-pi-ai] already patched: ${file}`);
  }
}
