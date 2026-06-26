import os, re

dirs = [
    'D:/src/aicoding/openshadow/server',
    'D:/src/aicoding/openshadow/core',
    'D:/src/aicoding/openshadow/lib',
    'D:/src/aicoding/openshadow/channels',
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
                rel = fp.replace('D:/src/aicoding/openshadow/', 'remu/')
                print(f'Fixed: {rel}')

print(f'Total fixed: {fixed} files')
