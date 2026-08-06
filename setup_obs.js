const fs = require('fs');
const path = require('path');
const os = require('os');

const profilesDir = path.join(os.homedir(), 'Library/Application Support/obs-studio/basic/profiles');
const untitledDir = path.join(profilesDir, 'Untitled');
const longDir = path.join(profilesDir, 'CapitalFriends-Long');
const shortsDir = path.join(profilesDir, 'CapitalFriends-Shorts');

if (!fs.existsSync(untitledDir)) {
    console.error("Default profile not found!");
    process.exit(1);
}

// Ensure output dirs exist
if (!fs.existsSync(longDir)) fs.mkdirSync(longDir, { recursive: true });
if (!fs.existsSync(shortsDir)) fs.mkdirSync(shortsDir, { recursive: true });

const basicIniPath = path.join(untitledDir, 'basic.ini');
const basicIniContent = fs.readFileSync(basicIniPath, 'utf8');

function buildIni(name, isShort) {
    let ini = basicIniContent;
    const cx = isShort ? 1080 : 1920;
    const cy = isShort ? 1920 : 1080;
    
    // Update Name
    ini = ini.replace(/^Name=.*$/m, `Name=${name}`);
    
    // Output Settings
    ini = ini.replace(/^Mode=.*$/m, 'Mode=Advanced');
    ini = ini.replace(/^RecFormat2=.*$/mg, 'RecFormat2=mkv');
    ini = ini.replace(/^RecEncoder=.*$/mg, 'RecEncoder=com.apple.videotoolbox.videoencoder.ave.avc');
    
    // Video Canvas & FPS
    ini = ini.replace(/^BaseCX=.*$/m, `BaseCX=${cx}`);
    ini = ini.replace(/^BaseCY=.*$/m, `BaseCY=${cy}`);
    ini = ini.replace(/^OutputCX=.*$/m, `OutputCX=${cx}`);
    ini = ini.replace(/^OutputCY=.*$/m, `OutputCY=${cy}`);
    ini = ini.replace(/^FPSCommon=.*$/m, `FPSCommon=60`);
    ini = ini.replace(/^FPSInt=.*$/m, `FPSInt=60`);
    ini = ini.replace(/^FPSNum=.*$/m, `FPSNum=60`);

    return ini;
}

const longIni = buildIni('CapitalFriends-Long', false);
const shortsIni = buildIni('CapitalFriends-Shorts', true);

fs.writeFileSync(path.join(longDir, 'basic.ini'), longIni);
fs.writeFileSync(path.join(shortsDir, 'basic.ini'), shortsIni);

// Also copy streamEncoder.json or recordEncoder.json if they exist
['streamEncoder.json', 'recordEncoder.json'].forEach(file => {
    const src = path.join(untitledDir, file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(longDir, file));
        fs.copyFileSync(src, path.join(shortsDir, file));
    }
});

console.log("Successfully created CapitalFriends-Long and CapitalFriends-Shorts profiles!");
