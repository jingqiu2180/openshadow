import os, re, sys

core_dir = 'D:/src/aicoding/remu/core'
count = 0
for fname in os.listdir(core_dir):
    if fname.endswith('.ts'):
        fpath = os.path.join(core_dir, fname)
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        # 把 from './foo.js' 或 from '../foo.js' 改成 from './foo' / from '../foo'
        new_content = re.sub(r"from '(\.\.?)/([^']+)\.js'", r"from '\1/\2'", content)
        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            count += 1
            print(f'Fixed: {fname}')

print(f'Total fixed: {count} files')
