#!/usr/bin/env python3
"""Auto-fill missing server dependencies by copying from openhanako."""
import os
import re
import subprocess
import shutil
import sys

DST_ROOT = 'D:/src/aicoding/remu'
SRC_ROOT = 'D:/src/aicoding/openhanako'

def log(msg):
    print(msg, flush=True)

def fix_file(path):
    """Add // @ts-nocheck and fix .ts -> .js imports."""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        lines = f.readlines()
    if lines and lines[0].strip() != '// @ts-nocheck':
        with open(path, 'w', encoding='utf-8') as f:
            f.write('// @ts-nocheck\n' + ''.join(lines))
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    new = content.replace(".ts'", ".js'").replace('.ts"', '.js"')
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

def copy_cjs_to_dist():
    """Copy .cjs files to dist/."""
    count = 0
    for root, _, files in os.walk(DST_ROOT):
        if 'node_modules' in root or 'dist' in root:
            continue
        for f in files:
            if f.endswith('.cjs'):
                src_path = os.path.join(root, f)
                rel = os.path.relpath(src_path, DST_ROOT)
                dst_path = os.path.join(DST_ROOT, 'dist', rel)
                os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                shutil.copy2(src_path, dst_path)
                count += 1
    return count

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

# Main loop
for i in range(1, 200):
    log(f'[{i}] Checking server...')
    error = get_error()
    
    if not error:
        log('✅ Server loads successfully!')
        break
    
    log(f'  Error: {error[:300]}')
    
    # Parse "Cannot find module 'D:...\dist\XXX.js'"
    m = re.search(r"Cannot find module '([^']+)'", error)
    if not m:
        log(f'  Unknown error format, stopping.')
        break
    
    module_path = m.group(1).replace('\\', '/')
    
    # Extract relative path from /dist/
    if '/dist/' in module_path:
        rel = module_path.split('/dist/', 1)[1]
    elif '/remu/' in module_path:
        rel = module_path.split('/remu/', 1)[1]
    else:
        log(f'  Cannot parse path: {module_path}')
        break
    
    # Convert .js to .ts (or .cjs to .cjs)
    if rel.endswith('.js'):
        rel = rel.replace('.js', '.ts')
    # .cjs files stay as .cjs
    
    log(f'  Missing: {rel}')
    
    # Find source
    basename = os.path.basename(rel)
    src = find_source(basename)
    if not src:
        log(f'  NOT FOUND in openhanako: {basename}')
        log(f'  Searched in: {SRC_ROOT}')
        # Try to find by relative path
        for root, _, files in os.walk(SRC_ROOT):
            for f in files:
                f_rel = os.path.relpath(os.path.join(root, f), SRC_ROOT)
                if f_rel.endswith(rel) or f_rel.endswith(rel.replace('.ts', '.js')):
                    src = os.path.join(root, f)
                    break
            if src:
                break
        if not src:
            break
    
    dst = os.path.join(DST_ROOT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    log(f'  Copied: {src} -> {dst}')
    
    # Process .ts files
    if dst.endswith('.ts'):
        fix_file(dst)
    
    # Recompile
    log(f'  Compiling...')
    if not compile_ts():
        log(f'  Compile error! Checking...')
        result = subprocess.run(
            'node ./node_modules/typescript/bin/tsc --noEmit',
            cwd=DST_ROOT, capture_output=True, text=True, timeout=300, shell=True
        )
        log((result.stdout + result.stderr)[:2000])
        break
    
    # Copy .cjs files to dist/
    cjs_count = copy_cjs_to_dist()
    if cjs_count > 0:
        log(f'  Copied {cjs_count} .cjs files to dist/')

log('\nDone. Final check...')
error = get_error()
if error:
    log(f'Still missing: {error[:300]}')
else:
    log('✅ Server loads successfully!')
