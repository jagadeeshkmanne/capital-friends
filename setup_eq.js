const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const scenesDir = path.join(os.homedir(), 'Library/Application Support/obs-studio/basic/scenes');
const files = ['CapitalFriends-Long.json', 'CapitalFriends-Shorts.json'];

function uuidv4() {
    return crypto.randomUUID();
}

files.forEach(file => {
    const filePath = path.join(scenesDir, file);
    if (fs.existsSync(filePath)) {
        let config = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        config.sources.forEach(source => {
            if (source.id === 'coreaudio_input_capture') {
                if (!source.filters) source.filters = [];
                
                // Add 3-Band EQ if not present
                if (!source.filters.find(f => f.name === '3-Band Equalizer')) {
                    source.filters.push({
                        "prev_ver": 536870914,
                        "name": "3-Band Equalizer",
                        "uuid": uuidv4(),
                        "id": "three_band_eq",
                        "versioned_id": "three_band_eq",
                        "settings": {
                            "low_gain": 4.0,
                            "mid_gain": -1.0,
                            "high_gain": 3.0
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

        fs.writeFileSync(filePath, JSON.stringify(config, null, 4));
        console.log(`Updated ${file} with 3-Band Equalizer.`);
    }
});
