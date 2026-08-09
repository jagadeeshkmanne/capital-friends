const fs = require('fs');
const path = require('path');

const longVideosDir = path.join(__dirname, 'youtube', 'long-videos');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if autoScale already exists
    if (content.includes('function autoScale()')) {
        return;
    }

    // Determine type based on width/height in CSS or file name. 
    // Most long video HTML files are 1920x1080. 
    // Let's add the script right before </script>
    
    const autoScaleScript = `
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
`;

    if (content.includes('</script>')) {
        content = content.replace('</script>', autoScaleScript + '\n</script>');
    } else {
        // If there's no script tag, add one before </body>
        if (content.includes('</body>')) {
            content = content.replace('</body>', `<script>${autoScaleScript}</script>\n</body>`);
        }
    }

    // Also, we need to make sure the body doesn't add scrollbars if it perfectly fits
    if (content.includes('body {')) {
        // Just make sure overflow is hidden
        if (!content.includes('overflow: hidden')) {
            content = content.replace('body {', 'body { overflow: hidden;');
        }
    }

    fs.writeFileSync(filePath, content);
    console.log('Added autoScale to:', filePath);
}

function traverseDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverseDir(fullPath);
        } else if (fullPath.endsWith('.html')) {
            processFile(fullPath);
        }
    }
}

traverseDir(longVideosDir);
console.log('Finished processing long videos.');
