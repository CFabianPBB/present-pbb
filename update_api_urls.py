#!/usr/bin/env python3
import re
import os

# Files to update
files = [
    'frontend/src/components/DatasetPicker.tsx',
    'frontend/src/components/LineItemsTable.tsx',
    'frontend/src/components/MultiFileUpload.tsx',
    'frontend/src/components/ProgramDrawer.tsx',
    'frontend/src/components/ProgramTable.tsx',
    'frontend/src/pages/Attributes.tsx',
    'frontend/src/pages/Costing.tsx',
    'frontend/src/pages/PolicyQuestions.tsx',
    'frontend/src/pages/Results.tsx',
    'frontend/src/pages/TaxpayerDividend.tsx',
]

import_statement = "import { API_BASE_URL } from '../config/api';\n"

for filepath in files:
    if not os.path.exists(filepath):
        print(f"⚠️  Skipping {filepath} - file not found")
        continue
    
    print(f"📝 Updating {filepath}...")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if import already exists
    if 'API_BASE_URL' in content and "from '../config/api'" in content:
        print(f"   ✓ Import already exists")
    else:
        # Add import after the last import statement
        lines = content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
        
        lines.insert(last_import_idx + 1, import_statement.rstrip())
        content = '\n'.join(lines)
        print(f"   ✓ Added import statement")
    
    # Replace localhost:8000 references
    # Pattern: 'http://localhost:8000 or "http://localhost:8000
    replacements = 0
    
    # Replace with single quotes
    new_content = re.sub(
        r"'http://localhost:8000(/[^']*)'",
        r'`${API_BASE_URL}\1`',
        content
    )
    replacements += len(re.findall(r"'http://localhost:8000(/[^']*)'", content))
    
    # Replace with double quotes
    new_content = re.sub(
        r'"http://localhost:8000(/[^"]*)"',
        r'`${API_BASE_URL}\1`',
        new_content
    )
    replacements += len(re.findall(r'"http://localhost:8000(/[^"]*)"', content))
    
    if replacements > 0:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"   ✓ Replaced {replacements} localhost:8000 reference(s)")
    else:
        print(f"   ℹ️  No localhost:8000 references found")
    
    print()

print("✅ All files updated!")
print("\n🧪 Next steps:")
print("1. Test the app locally: npm run dev")
print("2. Check git diff: git diff")
print("3. If everything looks good, commit: git add . && git commit -m 'Update API URLs to use environment variable'")
