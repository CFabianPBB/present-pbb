const fs = require('fs');

const files = [
  'frontend/src/components/ProgramDrawer.tsx',
  'frontend/src/components/LineItemsTable.tsx',
  'frontend/src/components/DatasetPicker.tsx',
  'frontend/src/components/MultiFileUpload.tsx',
  'frontend/src/components/ProgramTable.tsx',
  'frontend/src/pages/Attributes.tsx',
  'frontend/src/pages/PolicyQuestions.tsx',
  'frontend/src/pages/Results.tsx',
  'frontend/src/pages/TaxpayerDividend.tsx',
  'frontend/src/pages/Costing.tsx',
  'frontend/src/pages/Admin.tsx',
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Check if import already exists
  if (content.includes("import API_URL from")) {
    console.log(`✓ ${file} already has import`);
    return;
  }
  
  // Determine import path
  const isPage = file.includes('/pages/');
  const importStatement = isPage 
    ? "import API_URL from '../config/api';\n"
    : "import API_URL from '../../config/api';\n";
  
  // Find first import and add after it
  const lines = content.split('\n');
  let insertIndex = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertIndex = i + 1;
    } else if (insertIndex > 0 && !lines[i].startsWith('import ')) {
      break;
    }
  }
  
  lines.splice(insertIndex, 0, importStatement.trim());
  content = lines.join('\n');
  
  fs.writeFileSync(file, content, 'utf8');
  console.log(`✓ Added import to ${file}`);
});

console.log('\n✅ Done! Now test locally before pushing.');