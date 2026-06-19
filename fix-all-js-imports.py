import os, re

dirs = [
    'D:/src/aicoding/remu/server',
    'D:/src/aicoding/remu/core',
    'D:/src/aicoding/remu/lib',
    'D:/src/aicoding/remu/channels',
]

fixed = 0
for d in dirs:
    for root, _, files in os.walk(d):
        for f in files:
            if not f.endswith('.ts'):
                continue
            fp = os.path.join(root, f)
            try:
                with open(fp, 'r', encoding='utf-8') as fh:
                    content = fh.read()
            except:
                continue
            # 替换 from 'xxx.js' 或 from "xxx.js" 为 from 'xxx' / from "xxx"
            new_content = re.sub(r"from\s+['\"](.+?)\.js['\"]", r"from '\1'", content)
            if new_content != content:
                with open(fp, 'w', encoding='utf-8') as fh:
                    fh.write(new_content)
                fixed += 1
                rel = fp.replace('D:/src/aicoding/remu/', 'remu/')
                print(f'Fixed: {rel}')

print(f'Total fixed: {fixed} files')
