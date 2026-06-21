#!/usr/bin/env python3
"""
Copy all non-source files to dist directory.
This script copies all files except .ts, .ts.map, .js.map, .d.ts, .js to dist.
Note: .cjs and .mjs files ARE copied (they are source files, not compiled output).
"""

import os
import shutil
import sys

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(PROJECT_ROOT, 'dist')

# Source directories to copy from
SOURCE_DIRS = ['core', 'server', 'shared', 'lib', 'channels', 'db', 'hub', 'plugins', 'packages', 'desktop', 'scripts']

def should_copy_file(filepath):
    """Check if file should be copied to dist."""
    _, ext = os.path.splitext(filepath)
    
    # Skip TypeScript source files and map files
    if ext in ['.ts', '.ts.map', '.js.map', '.d.ts']:
        return False
    
    # Skip .js files (compiled output, already in dist)
    if ext == '.js':
        return False
    
    # DO copy .cjs and .mjs files (they are source files)
    # (no need to explicitly allow them, just don't skip them)
    
    return True

def copy_assets():
    """Copy all non-source files to dist."""
    copied = 0
    errors = 0
    
    for src_dir in SOURCE_DIRS:
        src_path = os.path.join(PROJECT_ROOT, src_dir)
        if not os.path.exists(src_path):
            continue
        
        for root, dirs, files in os.walk(src_path):
            # Skip node_modules and dist in source
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'dist', '.git', '.codebuddy']]
            
            for f in files:
                src_file = os.path.join(root, f)
                
                # Skip if should not copy
                if not should_copy_file(src_file):
                    continue
                
                # Calculate destination path
                rel_path = os.path.relpath(src_file, PROJECT_ROOT)
                dst_file = os.path.join(DIST_DIR, rel_path)
                
                try:
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    shutil.copy2(src_file, dst_file)
                    copied += 1
                except Exception as e:
                    errors += 1
                    if errors <= 5:
                        print(f'Error copying {rel_path}: {e}', file=sys.stderr)
    
    print(f'Copied {copied} files to dist ({errors} errors)')

if __name__ == '__main__':
    copy_assets()
