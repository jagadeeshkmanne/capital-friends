const fs = require('fs');
const path = require('path');

const longVideosDir = path.join(__dirname, 'youtube', 'long-videos');

const newScript = `<script>
function autoScale(){
  const vw=window.innerWidth,vh=window.innerHeight;
  const scale=Math.min(vw/1920,vh/1080);
  document.querySelectorAll('.slide').forEach(s=>{
    s.style.position = 'absolute';
    s.style.left = '50%';
    s.style.top = '50%';
    s.style.transform = 'translate(-50%, -50%) scale('+scale+')';
    s.style.transformOrigin = 'center center';
  });
}
autoScale();window.addEventListener('resize',autoScale);
</script>`;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Replace the old autoScale script block
    const oldScriptRegex = /<script>\s*function autoScale\(\)\{[\s\S]*?\}[\s\S]*?<\/script>/;
    if (oldScriptRegex.test(content)) {
        content = content.replace(oldScriptRegex, newScript);
        changed = true;
    }

    // 2. Change background: #000 to background: #060a16 to match header/footer
    if (content.includes('background: #000;')) {
        content = content.replace(/background: #000;/g, 'background: #060a16;');
        changed = true;
    }
    if (content.includes('background:#000}')) {
        content = content.replace(/background:#000\}/g, 'background:#060a16}');
        changed = true;
    }
    if (content.includes('background:#000;')) {
        content = content.replace(/background:#000;/g, 'background:#060a16;');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed centering and background for:', filePath);
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
console.log('Finished fixing full-screen centering.');
