const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const scenesDir = path.join(os.homedir(), 'Library/Application Support/obs-studio/basic/scenes');
const untitledPath = path.join(scenesDir, 'Untitled.json');

if (!fs.existsSync(untitledPath)) {
    console.error("Untitled.json not found!");
    process.exit(1);
}

const rawData = fs.readFileSync(untitledPath, 'utf8');
let baseConfig = JSON.parse(rawData);

// Helper to generate UUIDs
function uuidv4() {
    return crypto.randomUUID();
}

// 1. Add Compressor and Limiter to Audio Input Capture
baseConfig.sources.forEach(source => {
    if (source.id === 'coreaudio_input_capture') {
        if (!source.filters) source.filters = [];
        
        // Add Compressor
        if (!source.filters.find(f => f.name === 'Compressor')) {
            source.filters.push({
                "prev_ver": 536870914,
                "name": "Compressor",
                "uuid": uuidv4(),
                "id": "compressor_filter",
                "versioned_id": "compressor_filter",
                "settings": {
                    "ratio": 3.0,
                    "threshold": -18.0,
                    "attack_time": 2,
                    "release_time": 100,
                    "output_gain": 2.0
                },
                "mixers": 255,
                "sync": 0,
                "flags": 0,
                "volume": 1.0,
                "balance": 0.5,
                "enabled": true,
                "muted": false,
                "push-to-mute": false,
                "push-to-mute-delay": 0,
                "push-to-talk": false,
                "push-to-talk-delay": 0,
                "hotkeys": {},
                "deinterlace_mode": 0,
                "deinterlace_field_order": 0,
                "monitoring_type": 0,
                "private_settings": {}
            });
        }

        // Add Limiter
        if (!source.filters.find(f => f.name === 'Limiter')) {
            source.filters.push({
                "prev_ver": 536870914,
                "name": "Limiter",
                "uuid": uuidv4(),
                "id": "limiter_filter",
                "versioned_id": "limiter_filter",
                "settings": {
                    "threshold": -3.0,
                    "release_time": 60
                },
                "mixers": 255,
                "sync": 0,
                "flags": 0,
                "volume": 1.0,
                "balance": 0.5,
                "enabled": true,
                "muted": false,
                "push-to-mute": false,
                "push-to-mute-delay": 0,
                "push-to-talk": false,
                "push-to-talk-delay": 0,
                "hotkeys": {},
                "deinterlace_mode": 0,
                "deinterlace_field_order": 0,
                "monitoring_type": 0,
                "private_settings": {}
            });
        }
    }
});

// Hide cursor on Display Capture
baseConfig.sources.forEach(source => {
    if (source.id === 'display_capture') {
        if (!source.settings) source.settings = {};
        source.settings.show_cursor = false;
    }
});

// Function to configure bounds/transform for Display Capture inside the Scene
function applySceneTransform(config, isShort) {
    const cx = isShort ? 1080 : 1920;
    const cy = isShort ? 1920 : 1080;
    
    // Set base resolution
    config.resolution = { "x": cx, "y": cy };
    
    // Adjust Display Capture scaling in the active scene
    config.sources.forEach(source => {
        if (source.id === 'scene') {
            source.settings.items.forEach(item => {
                if (item.name === 'Display Capture') {
                    // For Shorts (1080x1920), we want the 1920x1080 screen to fit.
                    // Scale it so it fits perfectly.
                    if (isShort) {
                        item.scale = { "x": 1.77777779, "y": 1.77777779 }; // 1920/1080
                        item.bounds_type = 2; // Scale to inner bounds
                        item.bounds = { "x": 1080.0, "y": 1920.0 };
                    } else {
                        item.scale = { "x": 1.0, "y": 1.0 };
                        item.bounds_type = 0; // No bounds
                    }
                }
            });
        }
    });
    return config;
}

// 2. Write CapitalFriends-Long.json
const longConfig = applySceneTransform(JSON.parse(JSON.stringify(baseConfig)), false);
longConfig.name = "CapitalFriends-Long";
fs.writeFileSync(path.join(scenesDir, 'CapitalFriends-Long.json'), JSON.stringify(longConfig, null, 4));

// 3. Write CapitalFriends-Shorts.json
const shortsConfig = applySceneTransform(JSON.parse(JSON.stringify(baseConfig)), true);
shortsConfig.name = "CapitalFriends-Shorts";
fs.writeFileSync(path.join(scenesDir, 'CapitalFriends-Shorts.json'), JSON.stringify(shortsConfig, null, 4));

console.log("Successfully created CapitalFriends-Long and CapitalFriends-Shorts scene collections!");
