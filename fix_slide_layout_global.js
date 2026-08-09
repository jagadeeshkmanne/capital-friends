const fs = require('fs');
const path = require('path');

const longVideosDir = path.join(__dirname, 'youtube', 'long-videos');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Fix .row CSS
    const oldRow = '.row { display: flex; gap: 32px; align-items: center; width: 100%; }';
    const newRow = '.row { display: flex; gap: 60px; align-items: center; justify-content: center; width: 100%; max-width: 1300px; }';
    if (content.includes(oldRow)) {
        content = content.replace(oldRow, newRow);
        changed = true;
    }

    // 2. Remove flex1 from col gaps to prevent them from stretching and pushing things to edges
    const col24flex1 = 'class="col gap-24 flex1"';
    const col24 = 'class="col gap-24" style="max-width: 600px;"';
    if (content.includes(col24flex1)) {
        content = content.replaceAll(col24flex1, col24);
        changed = true;
    }
    
    const col32flex1 = 'class="col gap-32 flex1"';
    const col32 = 'class="col gap-32" style="max-width: 600px;"';
    if (content.includes(col32flex1)) {
        content = content.replaceAll(col32flex1, col32);
        changed = true;
    }

    // Just in case there are plain flex1
    if (content.includes('class="col flex1"')) {
        content = content.replaceAll('class="col flex1"', 'class="col" style="max-width: 600px;"');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed layout for:', filePath);
    }
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (file === 'slides.html' || file === 'intro-slide.html') {
            processFile(fullPath);
        }
    }
}

traverseDir(longVideosDir);
console.log('Finished fixing global layouts.');
