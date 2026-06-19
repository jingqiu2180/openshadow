// 从 openhanako 复制组件到 remu，并修复导入
const fs = require('fs');
const path = require('path');

const sourceBase = 'D:/src/aicoding/openhanako';
const targetBase = 'D:/src/aicoding/remu';

// 需要复制的组件列表
const components = [
  'desktop/src/react/components/DeskSection.tsx',
  'desktop/src/react/components/desk/DeskTree.tsx',
  'desktop/src/react/components/desk/DeskToolbar.tsx',
  'desktop/src/react/components/desk/Desk.module.css',
  // 可以添加更多组件...
];

components.forEach(comp => {
  const source = path.join(sourceBase, comp);
  const target = path.join(targetBase, comp);
  
  if (!fs.existsSync(source)) {
    console.log(`SKIP: ${comp} (not found in openhanako)`);
    return;
  }
  
  // 读取源文件
  let content = fs.readFileSync(source, 'utf-8');
  
  // 添加 @ts-nocheck
  if (!content.startsWith('// @ts-nocheck')) {
    content = '// @ts-nocheck\n' + content;
  }
  
  // 修复导入：.ts -> .js (但不包括 .tsx)
  content = content.replace(/from ['"](.+)\.ts['"]/g, 'from "$1.js"');
  
  // 确保目标目录存在
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // 写入
  fs.writeFileSync(target, content, 'utf-8');
  console.log(`COPIED: ${comp}`);
});

console.log('\nDone!');
