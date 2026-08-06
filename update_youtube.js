const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      filelist.push(dirFile);
    }
  });
  return filelist;
};

const allFiles = walkSync('youtube');

const nameReplacements = [
  { regex: /INDMoney/gi, replace: 'Paid Tracker A' },
  { regex: /Wealthy/gi, replace: 'Paid Tracker B' },
  { regex: /Perfios/gi, replace: 'Paid Tracker C' },
  { regex: /Groww/gi, replace: 'Broker A' },
  { regex: /Zerodha/gi, replace: 'Broker B' },
  { regex: /Kuvera/gi, replace: 'Broker C' },
  { regex: /Upstox/gi, replace: 'Broker D' },
  { regex: /Zerodha Coin|Coin investments/gi, replace: 'Direct Funds' }
];

let updatedCount = 0;

allFiles.forEach(file => {
  if (file.endsWith('.html') || file.endsWith('.txt')) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // 1. Scrub Names
    nameReplacements.forEach(r => {
      content = content.replace(r.regex, r.replace);
    });

    // 2. Fix Shorts CSS if it's a short slide or thumbnail
    if (file.includes('shorts/') && file.endsWith('.html')) {
      // Make text massive and use space-evenly to fill vertical space
      content = content.replace(/\.content\{text-align:center;max-width:900px\}/g, '.content{text-align:center;max-width:960px;width:100%;height:100%;display:flex;flex-direction:column;justify-content:space-evenly;padding:120px 0}');
      content = content.replace(/\.big\{font-size:52px;/g, '.big{font-size:100px;');
      content = content.replace(/\.sub\{font-size:32px;/g, '.sub{font-size:60px;');
      content = content.replace(/\.platform-card\{background:#1a2240;border-radius:16px;padding:24px 30px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;font-size:28px;/g, '.platform-card{background:#1a2240;border-radius:24px;padding:40px 50px;margin-top:30px;display:flex;justify-content:space-between;align-items:center;font-size:50px;');
      content = content.replace(/\.platform-card \.shows\{color:#94a3b8;font-size:22px\}/g, '.platform-card .shows{color:#94a3b8;font-size:40px}');
      content = content.replace(/\.pill\{background:#1a2240;border:2px solid #8b5cf6;border-radius:40px;padding:14px 30px;font-size:26px;/g, '.pill{background:#1a2240;border:4px solid #8b5cf6;border-radius:60px;padding:24px 50px;font-size:50px;');
    }

    if (content !== original) {
      fs.writeFileSync(file, content);
      updatedCount++;
      console.log(`Updated: ${file}`);
    }
  }
});

console.log(`\nSuccessfully updated ${updatedCount} files.`);
