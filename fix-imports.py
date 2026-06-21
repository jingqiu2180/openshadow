import os
import re

# Find all .ts files in the source directories
source_dirs = ['core', 'server', 'shared', 'lib', 'channels', 'db', 'hub', 'plugins', 'packages']
ts_files = []

for src_dir in source_dirs:
    for root, dirs, files in os.walk(src_dir):
        if 'node_modules' in root or 'dist' in root:
            continue
        for f in files:
            if f.endswith('.ts') and not f.endswith('.d.ts'):
                ts_files.append(os.path.join(root, f))

print(f"Found {len(ts_files)} .ts files")

# Pattern to match import statements with relative paths (starting with . or ..)
# This regex matches: import ... from './foo' or import ... from "../foo"
pattern = r"from\s+['\"]((\.\.?)/[^'\"]+)['\"]"

fixed_count = 0
for ts_file in ts_files:
    with open(ts_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if there are imports without .js extension
    matches = re.findall(pattern, content)
    needs_fix = False
    for match, _ in matches:
        if not match.endswith('.js') and not match.endswith('.json'):
            needs_fix = True
            break
    
    if not needs_fix:
        continue
    
    # Add .js extension to relative imports
    def add_js_ext(m):
        import_path = m.group(1)
        if not import_path.endswith('.js') and not import_path.endswith('.json'):
            return "from '" + import_path + ".js'"
        return m.group(0)
    
    new_content = re.sub(pattern, add_js_ext, content)
    
    if new_content != content:
        with open(ts_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        fixed_count += 1
        print(f"Fixed: {ts_file}")

print(f"\nFixed {fixed_count} files")
