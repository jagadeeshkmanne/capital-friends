const fs = require('fs');
const path = require('path');
const os = require('os');

const scenesDir = path.join(os.homedir(), 'Library/Application Support/obs-studio/basic/scenes');
const shortsFile = path.join(scenesDir, 'CapitalFriends-Shorts.json');

if (fs.existsSync(shortsFile)) {
    let config = JSON.parse(fs.readFileSync(shortsFile, 'utf8'));

    config.sources.forEach(source => {
        if (source.id === 'scene') {
            source.settings.items.forEach(item => {
                if (item.name === 'Display Capture') {
                    // Remove the bounding box so it can stretch freely
                    item.bounds_type = 0; 
                    
                    // The magic math: 
                    // To make a 1080 tall slide (inside a 1920x1080 monitor) fill a 1920 tall OBS canvas, 
                    // we must scale the whole monitor by 1920/1080 = 1.77777778
                    item.scale = { "x": 1.77777778, "y": 1.77777778 }; 
                    
                    // The monitor will now be 3413 pixels wide. 
                    // To center it on the 1080 canvas, we push it to the left by half the extra width.
                    // (3413 - 1080) / 2 = 1166
                    item.pos = { "x": -1166.5, "y": 0.0 };
                }
            });
        }
    });

    fs.writeFileSync(shortsFile, JSON.stringify(config, null, 4));
    console.log("Fixed the bounding box and applied perfect mathematical centering for the Shorts profile!");
}
