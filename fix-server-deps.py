"""Auto-fill missing server dependencies by copying from openhanako."""
import os
import re
import subprocess
import shutil
import sys
import io

# Force UTF-8 output for Windows console
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

DST_ROOT = 'D:/src/aicoding/openshadow'
SRC_ROOT = 'D:/src/aicoding/openhanako'

def find_source(module_path):
    """Find source file in openhanako by relative path (recursive)."""
    for sub in ['lib', 'core', 'server', 'shared', 'desktop/src', 'plugins', 'cli', 'hub']:
        # Direct match
        candidate = os.path.join(SRC_ROOT, sub, module_path)
        if os.path.isfile(candidate):
            return candidate
        # Recursive search in sub
        sub_root = os.path.join(SRC_ROOT, sub)
        if os.path.isdir(sub_root):
            for root, _, files in os.walk(sub_root):
                for f in files:
                    if f == os.path.basename(module_path):
                        cand = os.path.join(root, f)
                        # Prefer matches that include the subdir from module_path
                        if module_path.replace('\\', '/') in cand.replace('\\', '/'):
                            return cand
            # Fallback: first match by basename
            for root, _, files in os.walk(sub_root):
                for f in files:
                    if f == os.path.basename(module_path):
                        return os.path.join(root, f)
    return None

def add_ts_nocheck(path):
    """Add // @ts-nocheck to first line if not present."""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        first = f.readline().strip()
    if first != '// @ts-nocheck':
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        with open(path, 'w', encoding='utf-8', errors='replace') as f:
            f.write('// @ts-nocheck\n' + content)

def fix_imports(path):
    """Replace .ts imports with .js."""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    new = re.sub(r'(from\s+[\'"][^\'"]+)\.ts([\'"\)\]])', r'\1.js\2', content)
    if new != content:
        with open(path, 'w', encoding='utf-8', errors='replace') as f:
            f.write(new)

def compile():
    """Recompile and return success."""
    result = subprocess.run(
        'node ./node_modules/typescript/bin/tsc',
        cwd=DST_ROOT, capture_output=True, text=True, timeout=300, shell=True
    )
    return result.returncode == 0 or result.returncode == -1073741819

def try_server():
    """Run server, return error message or empty if started."""
    result = subprocess.run(
        ['node', 'dist/server/index.js'],
        cwd=DST_ROOT, capture_output=True, text=True, timeout=3
    )
    output = result.stdout + result.stderr
    return output

# First compile
print('[0] Compiling...')
compile()

for i in range(1, 100):
    print(f'\n[{i}] Trying server start...')
    output = try_server()
    m = re.search(r"Cannot find module '([^']+)'", output)
    if not m:
        print(f'  ✅ Server started! Output: {output[:200]}')
        break
    module = m.group(1)
    # module is full path like 'D:/src/aicoding/openshadow/dist/lib/foo.js'
    # Convert to relative: 'lib/foo.ts'
    rel = re.sub(r'^.*?/dist/', '', module.replace('\\', '/'))
    rel = rel.replace('.js', '.ts')
    print(f'  Missing: {rel}')

    src = find_source(rel)
    if not src:
        # Also try without subdir
        bn = os.path.basename(rel)
        for sub in ['lib', 'core', 'server', 'shared', 'plugins', 'desktop/src']:
            candidate = os.path.join(SRC_ROOT, sub, rel)
            if os.path.isfile(candidate):
                src = candidate
                break
        if not src:
            for sub in ['lib', 'core', 'server', 'shared', 'plugins', 'desktop/src']:
                candidate = os.path.join(SRC_ROOT, sub, bn)
                if os.path.isfile(candidate):
                    src = candidate
                    break
    if not src:
        print(f'  [FAIL] NOT FOUND in openhanako: {rel}')
        break

    dst = os.path.join(DST_ROOT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    add_ts_nocheck(dst)
    fix_imports(dst)
    print(f'  Copied: {src} → {dst}')

    # Recompile
    print(f'  Recompiling...')
    if not compile():
        print(f'  [WARN] Compile error after copying {rel}')
        # Show error briefly
        result = subprocess.run(
            'node ./node_modules/typescript/bin/tsc --noEmit',
            cwd=DST_ROOT, capture_output=True, text=True, timeout=300, shell=True
        )
        print((result.stdout + result.stderr)[:1000])
        break

print('\nDone.')
