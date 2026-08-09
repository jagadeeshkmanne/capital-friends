const fs = require('fs');
const file = 'youtube/long-videos/00-how-i-track-my-net-worth/script.html';

const newScript = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Vlog Outline — How I Track My Net Worth</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; }
body { margin: 0; padding: 40px; background: #0f172a; color: #cbd5e1; font-family: 'Inter', system-ui, sans-serif; line-height: 1.6; }
.container { max-width: 900px; margin: 0 auto; }
.header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #334155; }
.title { font-size: 32px; font-weight: 700; color: #f8fafc; margin: 0 0 10px 0; }
.subtitle { font-size: 18px; color: #94a3b8; margin: 0; }
.toc { display: flex; flex-direction: column; gap: 8px; margin-bottom: 40px; background: #1e293b; padding: 20px; border-radius: 12px; }
.toc-title { font-weight: 600; color: #f8fafc; margin-bottom: 8px; }
.toc-item { display: flex; gap: 16px; }
.toc-item .time { color: #f43f5e; font-family: monospace; font-size: 15px; }
.toc-item .label { color: #cbd5e1; }
.section { margin-bottom: 40px; background: #1e293b; border-radius: 12px; overflow: hidden; border-left: 4px solid #f43f5e; }
.section.blue { border-left-color: #3b82f6; }
.section.green { border-left-color: #22c55e; }
.section.amber { border-left-color: #f59e0b; }
.section-header { background: #0f172a; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
.time-badge { background: #334155; color: #f8fafc; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-size: 14px; }
.section-title { font-weight: 600; color: #f8fafc; font-size: 18px; }
.action-box { padding: 16px 24px; background: #334155; color: #facc15; font-weight: 600; font-size: 15px; border-top: 1px solid #475569; }
.narrator { padding: 24px; font-size: 20px; color: #f8fafc; line-height: 1.6; }
.highlight { color: #f43f5e; font-weight: 600; }
.blue-text { color: #3b82f6; font-weight: 600; }
.green-text { color: #22c55e; font-weight: 600; }
</style>
</head>
<body>
<div class="container">
  
<div class="header">
  <h1 class="title">How I Track My Net Worth (Full Script)</h1>
  <p class="subtitle">A complete walkthrough of the Capital Friends App</p>
</div>

<div class="toc">
  <div class="toc-title">Video Flow</div>
  <div class="toc-item"><span class="time">Step 1</span><span class="label">The Hook & My Story</span></div>
  <div class="toc-item"><span class="time">Step 2</span><span class="label">The Dashboard & The Privacy Secret</span></div>
  <div class="toc-item"><span class="time">Step 3</span><span class="label">App Menu: Family & Accounts</span></div>
  <div class="toc-item"><span class="time">Step 4</span><span class="label">App Menu: Investments & Insurance</span></div>
  <div class="toc-item"><span class="time">Step 5</span><span class="label">App Menu: Goals & Reminders</span></div>
  <div class="toc-item"><span class="time">Step 6</span><span class="label">The Free Offer & Next Videos</span></div>
</div>

<div class="section">
  <div class="section-header">
    <span class="time-badge">Step 1</span>
    <span class="section-title">The Hook & My Story</span>
  </div>
  <div class="narrator">
    "Hi, I'm Jagadeesh. I want to ask you a serious question: <span class="highlight">Do you actually know your family's true Net Worth right now?</span>
    <br><br>
    Before I show you my dashboard, I need to be completely transparent so you don't get the wrong idea. When you see the numbers on my screen today, please don't think I grew up rich. I actually grew up in a small village where my family ran a small tiffin center. We didn't have much money, so I studied B.Sc in a government degree college. I started my career in Pharma, had to resign due to severe health issues, taught myself Java, and slowly worked my way up as a software engineer. 
    <br><br>
    <span class="blue-text">(If you want to hear my full life journey and how I made that transition, let me know in the comments and I'll make a dedicated video about it!)</span>
    <br><br>
    But for today, the ₹4.23 Cr portfolio you are going to see is the result of over 10 years of hard work. The majority of it is my own savings, along with my wife—who works in software testing and invests her money too—and a small portion from my father who helped us when we were buying our flat. 
    <br><br>
    Because this wealth was built across different jobs, different people, and different platforms over a decade... it was scattered everywhere. My mutual funds are in Zerodha, my wife's are in Groww. Add in term life insurance, health insurance, physical gold, EPF, real estate, and a home loan, and it was pure chaos. I used to spend hours wrestling with messy Excel sheets. 
    <br><br>
    So, I built my own system. Today, I'm going to open up my personal laptop and reveal how I track my family's hard-earned wealth."
  </div>
  <div class="action-box">🎥 ACTION: Start with your face. Speak vulnerably about the tiffin center and govt college. Use the comment call-to-action naturally.</div>
</div>

<div class="section green">
  <div class="section-header">
    <span class="time-badge">Step 2</span>
    <span class="section-title">The Dashboard & The Privacy Secret</span>
  </div>
  <div class="narrator">
    "Welcome to Capital Friends. As you can see, this is a beautiful, modern web app. Right here on the Dashboard, I have absolute clarity. I can see my total assets versus my liabilities—like my ₹90 Lakh home loan—updating automatically. 
    <br><br>
    Look at this Asset Allocation chart. Instantly, I can see exactly how much of our wealth is in Real Estate, Equity, or Debt. 
    <br><br>
    But here is the biggest secret about this app. <span class="highlight">The entire database powering this beautiful dashboard is just a private Google Sheet sitting in my personal Google Drive.</span>
    <br><br>
    I absolutely refused to hand over my family's financial data to a random startup or third-party app. Because this app connects directly to your Google Drive, nobody else can see your data. Not advertisers, not hackers, not even me. You own your database 100%."
  </div>
  <div class="action-box">💻 ACTION: Share Screen. Hover over the Dashboard pie chart. Speak very passionately about the Google Sheet privacy. This is your biggest selling point.</div>
</div>

<div class="section blue">
  <div class="section-header">
    <span class="time-badge">Step 3</span>
    <span class="section-title">App Menu: Family & Accounts</span>
  </div>
  <div class="narrator">
    "Let me show you how powerful this is. If we go over to the App Menu on the left and click on <span class="blue-text">Family Members</span>, you'll see me, my wife Visali, and our kids, Sanjith and our youngest. 
    <br><br>
    Now, if I click on <span class="blue-text">Bank Accounts</span> and <span class="blue-text">Investment Accounts</span>, you can see how we've connected everything. I have my HDFC bank and RP Wealth broker accounts linked, and Visali has her Axis bank and Groww accounts linked. 
    <br><br>
    Instead of begging my wife to log into her Groww app to check her balances, it's all unified right here."
  </div>
  <div class="action-box">💻 ACTION: Click 'Family Members' on the sidebar. Then click 'Investment Accounts'. Point out Visali's Groww account.</div>
</div>

<div class="section amber">
  <div class="section-header">
    <span class="time-badge">Step 4</span>
    <span class="section-title">App Menu: Investments & Insurance</span>
  </div>
  <div class="narrator">
    "Next, if we go to the <span class="highlight">Mutual Funds</span> tab, I can see all our funds from different platforms side-by-side, like our Aditya Birla Large & Mid Cap fund, updating automatically.
    <br><br>
    We also have dedicated tabs in the menu for <span class="highlight">Stocks</span>, <span class="highlight">Liabilities</span>, and <span class="highlight">Other Investments</span> where I track my physical gold and EPF.
    <br><br>
    But one of the most important tabs is <span class="highlight">Insurance</span>. I have my ICICI Pru iProtect Term Life for ₹2 Crores, and our HDFC Ergo Health insurance for ₹1 Crore tracked right here. If something happens to me tomorrow, my family doesn't have to go digging through files. My wife can just log into this app with her Gmail, see this exact same dashboard, and know exactly where all our policies and investments are."
  </div>
  <div class="action-box">💻 ACTION: Click 'Mutual Funds' on the sidebar. Then click 'Insurance'. Emphasize the emotional peace of mind that comes from having insurance centralized for your spouse.</div>
</div>

<div class="section green">
  <div class="section-header">
    <span class="time-badge">Step 5</span>
    <span class="section-title">App Menu: Goals & Reminders</span>
  </div>
  <div class="narrator">
    "Finally, because all this data is unified, the app does the heavy lifting for me. 
    <br><br>
    If I click on <span class="green-text">Goals</span>, the app automatically maps my investments and tells me exactly if we are 'On Track' for my Retirement goal of ₹1.5 Cr, or Sanjith's Education goal. No guessing. Just facts.
    <br><br>
    And if I click on <span class="green-text">Reminders</span>, it automatically alerts me when my Home Loan EMI or those Term Life Insurance premiums are due. My financial life is literally on autopilot."
  </div>
  <div class="action-box">💻 ACTION: Click the 'Goals' menu. Show the progress bars. Then click 'Reminders' and point to the alerts.</div>
</div>

<div class="section">
  <div class="section-header">
    <span class="time-badge">Step 6</span>
    <span class="section-title">The Free Offer & Next Videos</span>
  </div>
  <div class="narrator">
    "I've spent hundreds of hours perfecting this system, and today, I'm opening it up to you for <span class="green-text">100% free</span>. 
    <br><br>
    This is just the beginning. I am going to be making an entire series of videos right here on this channel, walking you through every single menu and feature of this app, showing you exactly how to manage your wealth like a pro. Make sure to subscribe so you don't miss them!
    <br><br>
    If you want to finally take control of your family's wealth with absolute privacy, click the link in the description. The moment you sign in, Capital Friends will securely generate your private database right inside your Google Drive. I'll see you inside."
  </div>
  <div class="action-box">🎥 ACTION: Back to your face (camera). Strong eye contact. Speak with absolute conviction about the privacy aspect, announce the upcoming series, and tell them exactly what to do next.</div>
</div>

</div>
</body>
</html>`

fs.writeFileSync(file, newScript);
console.log("File completely rewritten based on App Menus.");
