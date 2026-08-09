const fs = require('fs');
const file = 'youtube/long-videos/00-how-i-track-my-net-worth/script.html';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('Start with your face. Speak very simply and honestly about the tiffin center and govt college.', 
  'Start by showing the Capital Friends Dashboard on your screen. You do not need to show your face. Speak very simply and honestly about your background while the viewers look at your dashboard.');

content = content.replace("💻 ACTION: Share Screen. Point out the charts. Speak very passionately about the Google Sheet privacy.",
  "💻 ACTION: Show the charts on the Dashboard. Then, open a new browser tab, go to your Google Drive, and open the actual 'Capital Friends' Google Sheet. Show them the raw data to PROVE that the app is just a shell and their data lives entirely in a Google Sheet.");

content = content.replace("🎥 ACTION: Back to your face. Tell them exactly what to do next.",
  "💻 ACTION: Stay on the Capital Friends app screen. Zoom in slightly or highlight the 'Sign In' button, and tell them exactly what to do next.");

fs.writeFileSync(file, content);
console.log('Action boxes updated for faceless video.');
