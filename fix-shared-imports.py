import os
import re

desktop_src = 'D:/src/aicoding/remu/desktop/src'

for root, dirs, files in os.walk(desktop_src):
    dirs[:] = [d for d in dirs if d not in ('node_modules', 'dist', 'dist-renderer')]
    for fname in files:
        if not fname.endswith(('.ts', '.tsx')):
            continue
        fpath = os.path.join(root, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            continue

        # 把 from '.../shared/xxx' 改成 from '@shared/xxx'
        pattern = r"""(from\s+['"])(\.\./)+shared/(.+?)(['"])"""
        replacement = r"""@shared/\2"""
        new_content = re.sub(pattern, replacement, content)

        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            rel = os.path.relpath(fpath, desktop_src)
            print(f'Fixed: {rel}')

print('Done')
