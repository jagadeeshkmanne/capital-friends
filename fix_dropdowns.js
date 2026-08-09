const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'react-app', 'src', 'components', 'forms');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if memberOptions is in the file
  if (content.includes('memberOptions =')) {
    let changed = false;

    // Ensure useMask is imported
    if (!content.includes('useMask')) {
      // Find the last import
      const importMatches = [...content.matchAll(/^import .*;?$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertIndex = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertIndex) + "\nimport { useMask } from '../../context/MaskContext'" + content.slice(insertIndex);
        changed = true;
      }
    }

    // Ensure mv is extracted from useMask inside the component
    if (!content.includes('const { mv } = useMask()')) {
      // Find the component signature
      const compMatch = content.match(/export default function [a-zA-Z0-9_]+\s*\([^)]*\)\s*\{/);
      if (compMatch) {
        const insertIndex = compMatch.index + compMatch[0].length;
        content = content.slice(0, insertIndex) + "\n  const { mv } = useMask()" + content.slice(insertIndex);
        changed = true;
      }
    }

    // Replace the memberName with mv(memberName, 'name') in memberOptions
    // Usually it looks like: label: `${m.memberName} (${m.relationship})` or label: m.memberName
    if (content.includes('${m.memberName}')) {
      content = content.replace(/\$\{m\.memberName\}/g, "${mv(m.memberName, 'name')}");
      changed = true;
    } else if (content.includes('label: m.memberName')) {
      content = content.replace(/label:\s*m\.memberName/g, "label: mv(m.memberName, 'name')");
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
