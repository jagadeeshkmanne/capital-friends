const fs = require('fs');
const path = require('path');

const longVideosDir = path.join(__dirname, 'youtube', 'long-videos');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Remove overflow: hidden from body
    if (content.includes('body { overflow: hidden;')) {
        content = content.replace('body { overflow: hidden;', 'body {');
        changed = true;
    }

    // Remove the autoScale script block completely
    const scriptBlock = `<script>
function autoScale(){
  const vw=window.innerWidth,vh=window.innerHeight;
  const scale=Math.min(vw/1920,vh/1080);
  document.querySelectorAll('.slide').forEach(s=>{
    s.style.transform='scale('+scale+')';
    s.style.transformOrigin='top left';
  });
  document.body.style.width=(1920*scale)+'px';
  document.body.style.height=(1080*scale)+'px';
}
autoScale();window.addEventListener('resize',autoScale);
</script>`;
    
    if (content.includes(scriptBlock)) {
        content = content.replace(scriptBlock, '');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed:', filePath);
    }
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (file === 'script.html' || file === 'intro-script.html') {
            processFile(fullPath);
        }
    }
}

traverseDir(longVideosDir);
console.log('Finished fixing script files.');
