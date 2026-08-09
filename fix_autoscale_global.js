const fs = require('fs');
const path = require('path');

const longVideosDir = path.join(__dirname, 'youtube', 'long-videos');

const newAutoScale = `function autoScale(){
  const vw=window.innerWidth,vh=window.innerHeight;
  const scale=Math.min(vw/1920,vh/1080);
  document.querySelectorAll('.slide').forEach(s=>{
    s.style.position = 'absolute';
    s.style.left = '50%';
    s.style.top = '50%';
    s.style.transform = 'translate(-50%, -50%) scale('+scale+')';
    s.style.transformOrigin = 'center center';
  });
}`;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Match the exact function block, no matter what is around it.
    // We match from "function autoScale(){" until the closing brace of the function block.
    // The previous implementation was:
    /*
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
    */
    
    // We can just use a regex to replace the function definition
    const regex = /function autoScale\(\)\s*\{[\s\S]*?document\.body\.style\.height[\s\S]*?\}/;
    if (regex.test(content)) {
        content = content.replace(regex, newAutoScale);
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed autoScale in:', filePath);
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
console.log('Done fixing autoScale.');
