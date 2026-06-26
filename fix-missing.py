import os
import re
import subprocess
import shutil
import sys

DST_ROOT = 'D:/src/aicoding/openshadow'
SRC_ROOT = 'D:/src/aicoding/openhanako'

def fix_file(path):
    """Add // @ts-nocheck and fix .ts -> .js imports."""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    if lines and lines[0].strip() != '// @ts-nocheck':
        with open(path, 'w', encoding='utf-8') as f:
            f.write('// @ts-nocheck\n' + ''.join(lines))
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    new = content.replace('.ts\'', '.js\'').replace('.ts"', '.js"')
    if new != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)

def find_source(basename):
    """Find source file in openhanako by basename."""
    for root, _, files in os.walk(SRC_ROOT):
        for f in files:
            if f == basename:
                return os.path.join(root, f)
    return None

def compile_ts():
    """Compile TypeScript."""
    result = subprocess.run(
        'node ./node_modules/typescript/bin/tsc',
        cwd=DST_ROOT, capture_output=True, text=True, timeout=300, shell=True
    )
    return result.returncode == 0

def get_error():
    """Get missing module error."""
    result = subprocess.run(
        ['node', '-e', "try { require('./dist/server/index.js'); } catch(e) { console.error(e.message); }"],
        cwd=DST_ROOT, capture_output=True, text=True, timeout=10
    )
    return result.stderr.strip()

for i in range(1, 100):
    print(f'[{i}] Checking server...', flush=True)
    error = get_error()
    
    if not error:
        print('✅ Server loads successfully!')
        break
    
    print(f'  Error: {error[:200]}')
    
    # Parse "Cannot find module 'D:/.../dist/lib/foo.js'"
    m = re.search(r"Cannot find module '([^']+)'", error)
    if not m:
        print(f'  Unknown error, stopping.')
        break
    
    module_path = m.group(1).replace('\', '/')
    # Extract relative path from /dist/
    if '/dist/' in module_path:
        rel = module_path.split('/dist/', 1)[1]
    else:
        rel = module_path.split('/openshadow/', 1)[1] if '/openshadow/' in module_path else module_path
    
    # Convert .js to .ts
    rel = rel.replace('.js', '.ts')
    print(f'  Missing: {rel}')
    
    # Find source
    basename = os.path.basename(rel)
    src = find_source(basename)
    if not src:
        print(f'  NOT FOUND: {basename}')
        break
    
    dst = os.path.join(DST_ROOT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    print(f'  Copied: {src} -> {dst}')
    
    fix_file(dst)
    
    print(f'  Compiling...', flush=True)
    if not compile_ts():
        print(f'  Compile error!')
        break

print('\nDone.')
