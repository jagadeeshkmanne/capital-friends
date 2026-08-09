const fs = require('fs');
const file = 'youtube/long-videos/00-how-i-track-my-net-worth/script.html';
const content = fs.readFileSync(file, 'utf8');

const newScript = `
<div class="header">
  <h1 class="title">How I Track My Net Worth (Vlog Outline)</h1>
  <p class="subtitle">A personal walkthrough of your real portfolio</p>
</div>

<div class="toc">
  <div class="toc-title">Video Flow (Since you are showing real data, this is an outline, not a strict script)</div>
  <div class="toc-item"><span class="time">Step 1</span><span class="label">The Hook & Intro (The Pain)</span></div>
  <div class="toc-item"><span class="time">Step 2</span><span class="label">The Dashboard (Showing Real Numbers)</span></div>
  <div class="toc-item"><span class="time">Step 3</span><span class="label">The Complete Picture (Walking through the Tabs)</span></div>
  <div class="toc-item"><span class="time">Step 4</span><span class="label">The Ultimate Peace of Mind (Family Sharing & Emails)</span></div>
  <div class="toc-item"><span class="time">Step 5</span><span class="label">The Irresistible Offer (Free & Private)</span></div>
</div>

<div class="section">
  <div class="section-header">
    <span class="time-badge">Step 1</span>
    <span class="section-title">The Hook & Intro (The Pain)</span>
  </div>
  <div class="narrator">
    "Hi, I'm Jagadeesh. I'm a software engineer and an active investor, and I want to ask you a serious question: <span class="highlight">Do you actually know your family's true Net Worth right now?</span>
    <br><br>
    If you're like me, your money is scattered everywhere. My mutual funds are in Zerodha, my wife's are in Groww, and I have term and health insurance policies hidden in different portals. Add in physical gold, EPF, real estate, and a crushing home loan, and it's chaos.
    <br><br>
    I used to spend hours every month wrestling with messy Excel sheets. I tried third-party apps, but I absolutely refused to hand over my bank passwords to a random startup. 
    <br><br>
    So, I built my own system. Today, I'm going to open up my personal laptop, show you my exact ₹4.23 Cr portfolio, and reveal how I track my entire family's wealth in one highly secure place."
  </div>
  <div class="action-box">🎥 ACTION: Start with your face. Speak passionately about the frustration of scattered accounts and the fear of giving data to random apps.</div>
</div>

<div class="section green">
  <div class="section-header">
    <span class="time-badge">Step 2</span>
    <span class="section-title">The Big Reveal (The Dashboard)</span>
  </div>
  <div class="narrator">
    "Welcome to Capital Friends. This looks like a beautiful modern web app, but under the hood, it's actually powered by a private Google Sheet.
    <br><br>
    Right here on the dashboard, I have absolute clarity. I can see my total assets versus my liabilities—like my ₹90 Lakh home loan—updating automatically. 
    <br><br>
    Look at this Asset Allocation chart. Instantly, without doing any math, I can see that 49% of our wealth is in Real Estate, and 30% is in Equity. It tells me exactly where I am over-exposed."
  </div>
  <div class="action-box">💻 ACTION: Share Screen. Hover over the beautiful pie chart. Emphasize that there is ZERO math involved for the user.</div>
</div>

<div class="section amber">
  <div class="section-header">
    <span class="time-badge">Step 3</span>
    <span class="section-title">The Complete Picture (Walking through the Tabs)</span>
  </div>
  <div class="narrator">
    "The reason this works is because it tracks *everything*. Let me show you. 
    <br><br>
    I can see all my <span class="highlight">Family Members</span>. I can track all our <span class="highlight">Bank Accounts</span> and <span class="highlight">Investment Accounts</span> across different brokers. 
    <br><br>
    I have dedicated tabs for my <span class="highlight">Insurance</span>, <span class="highlight">Mutual Funds</span>, and <span class="highlight">Stocks</span>. I can even track <span class="highlight">Other Investments</span> like Gold and EPF, alongside my <span class="highlight">Liabilities</span> and Home Loans. 
    <br><br>
    It even has <span class="highlight">Goals</span> to tell me if I'm on track for retirement, and <span class="highlight">Reminders</span> so I never miss a premium payment. It is a complete, unified picture of my financial life."
  </div>
  <div class="action-box">💻 ACTION: Rapidly click through the tabs on the sidebar as you mention them to show how comprehensive the tool is.</div>
</div>

<div class="section blue">
  <div class="section-header">
    <span class="time-badge">Step 4</span>
    <span class="section-title">The Ultimate Peace of Mind (Family Sharing)</span>
  </div>
  <div class="narrator">
    "But here is my biggest fear as an investor: <span class="blue-text">If something happens to me tomorrow, will my family even know where all the money is?</span>
    <br><br>
    That is exactly why I built Capital Friends. 
    <br><br>
    This app sends an automated daily email to my family, summarizing our entire net worth and investments. Even better, if my wife logs in with her own Gmail account, she sees this *exact same dashboard*. She doesn't need to ask me for passwords or search for spreadsheets. She has full visibility and control."
  </div>
  <div class="action-box">💻 ACTION: Click the 'Family' tab. Speak directly to the camera about the emotional peace of mind this brings. This is your strongest selling point.</div>
</div>

<div class="section">
  <div class="section-header">
    <span class="time-badge">Step 5</span>
    <span class="section-title">The Irresistible Offer (Free & Private)</span>
  </div>
  <div class="narrator">
    "I built this for my own family because I demand absolute privacy. Because Capital Friends is built on Google Workspace, <span class="highlight">your data stays physically inside your personal Google Drive.</span> Nobody else can see it. Not advertisers. Not hackers. Not even me. You own your database.
    <br><br>
    I've spent hundreds of hours perfecting this system, and today, I'm opening it up to you for <span class="green-text">100% free</span>. 
    <br><br>
    If you want to finally take control of your family's wealth, click the link in the description. The moment you sign in, Capital Friends will securely generate your private database right inside your Google Drive. I'll see you inside."
  </div>
  <div class="action-box">🎥 ACTION: Back to your face (camera). Strong eye contact. Speak with absolute conviction about the privacy aspect. Tell them exactly what to do next.</div>
</div>
`;

const startIndex = content.indexOf('<div class="header">');
const endIndex = content.indexOf('</div>\n</body>') + 6;

if (startIndex !== -1 && endIndex !== -1) {
  const finalContent = content.substring(0, startIndex) + newScript + content.substring(endIndex);
  fs.writeFileSync(file, finalContent);
  console.log('Script updated successfully!');
} else {
  console.log('Could not find boundaries.');
}
