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
  <p class="subtitle">A simple, easy-to-read script for your video</p>
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
    "Hi, I'm Jagadeesh. I want to ask you a serious question: <span class="highlight">Do you actually know your family's true Net Worth right now?</span> Do you know exactly how much money you have in total?
    <br><br>
    Before I show you my screen, I want to be very honest with you. When you see the numbers today, please don't think I grew up rich. I actually grew up in a small village where my family ran a small tiffin center. We didn't have much money, so I studied B.Sc in a government college. I started my career in Pharma, but I had to resign because of severe health issues. After that, I taught myself Java, and slowly worked my way up as a software engineer. 
    <br><br>
    <span class="blue-text">(If you want to hear my full life story, let me know in the comments and I will make a separate video about it!)</span>
    <br><br>
    But for today, the ₹4.23 Crore number you are going to see is the result of over 10 years of hard work. It is my own savings, plus my wife's savings—she works in software testing—and also a small amount from my father who helped us buy our flat. 
    <br><br>
    Because this money came from different jobs and different people over ten years, it was scattered all over the place. My mutual funds are in Zerodha, my wife's are in Groww. We also have term life insurance, health insurance, physical gold, EPF, real estate, and a home loan. It was a big mess. 
    <br><br>
    I tried using other finance apps, but I quickly found three big problems. First, each app only tracks one thing at a time. Second, to use those apps, you have to give them your PAN card and Aadhaar card details. I did not want to give my personal details to a random company. 
    <br><br>
    But the biggest problem was my family. If you use broker apps, all the emails and messages only go to *you*. My family had absolutely no idea where our money was. If something happened to me, they would be completely lost.
    <br><br>
    That is exactly why I built Capital Friends. This app sends an automatic daily email to my family, showing our total money and investments. Even better, if my wife logs in with her own Gmail account, she sees this *exact same screen*. She doesn't need to ask me for passwords. She can see everything.
    <br><br>
    Today, I'm going to open up my personal laptop and show you exactly how I track my family's hard-earned money."
  </div>
  <div class="action-box">🎥 ACTION: Start with your face. Speak very simply and honestly about the tiffin center and govt college.</div>
</div>

<div class="section green">
  <div class="section-header">
    <span class="time-badge">Step 2</span>
    <span class="section-title">The Dashboard & The Privacy Secret</span>
  </div>
  <div class="narrator">
    "Welcome to Capital Friends. As you can see, this is a beautiful, easy-to-use app. Right here on the Dashboard, I can see everything clearly. I can see my total assets and my loans—like my ₹90 Lakh home loan—updating automatically. 
    <br><br>
    Look at this chart here. Instantly, I can see exactly how much of our money is in Real Estate, Equity, or Debt. 
    <br><br>
    But here is the biggest secret about this app. <span class="highlight">The database behind this beautiful app is just a private Google Sheet sitting in my personal Google Drive.</span>
    <br><br>
    Because this app connects directly to your Google Drive, nobody else can see your data. Not advertisers, not hackers, not even me. Your data is 100% safe."
  </div>
  <div class="action-box">💻 ACTION: Share Screen. Point out the charts. Speak very passionately about the Google Sheet privacy.</div>
</div>

<div class="section blue">
  <div class="section-header">
    <span class="time-badge">Step 3</span>
    <span class="section-title">App Menu: Family & Accounts</span>
  </div>
  <div class="narrator">
    "Let me show you how easy this is. If we go to the menu on the left and click on <span class="blue-text">Family Members</span>, you will see me, my wife Visali, and our kids. 
    <br><br>
    Now, if I click on <span class="blue-text">Bank Accounts</span> and <span class="blue-text">Investment Accounts</span>, you can see how we linked everything. I have my HDFC bank and RP Wealth accounts here, and Visali has her Axis bank and Groww accounts here. 
    <br><br>
    Instead of asking my wife to log into her Groww app to check her balance, we can see everything together in one place."
  </div>
  <div class="action-box">💻 ACTION: Click 'Family Members' on the sidebar. Then click 'Investment Accounts'.</div>
</div>

<div class="section amber">
  <div class="section-header">
    <span class="time-badge">Step 4</span>
    <span class="section-title">App Menu: Investments & Insurance</span>
  </div>
  <div class="narrator">
    "Next, if we go to the <span class="highlight">Mutual Funds</span> tab, I can see all our funds from different apps side-by-side, updating automatically.
    <br><br>
    We also have separate tabs in the menu for <span class="highlight">Stocks</span>, <span class="highlight">Liabilities</span>, and <span class="highlight">Other Investments</span> where I track my physical gold and EPF.
    <br><br>
    But one of the most important tabs is <span class="highlight">Insurance</span>. I have my ICICI Term Life policy and our HDFC Health insurance tracked right here. Like I said before, if something happens to me tomorrow, my family does not have to go searching for papers. Because my wife can log in and see this screen, she knows exactly who to call and what policies we have."
  </div>
  <div class="action-box">💻 ACTION: Click 'Mutual Funds' on the sidebar. Then click 'Insurance'.</div>
</div>

<div class="section green">
  <div class="section-header">
    <span class="time-badge">Step 5</span>
    <span class="section-title">App Menu: Goals & Reminders</span>
  </div>
  <div class="narrator">
    "Finally, because all this data is in one place, the app does all the hard work for me. 
    <br><br>
    If I click on <span class="green-text">Goals</span>, the app checks my investments and tells me exactly if we are 'On Track' for my Retirement goal, or Sanjith's Education goal. No guessing. 
    <br><br>
    And if I click on <span class="green-text">Reminders</span>, it alerts me when my Home Loan EMI or Insurance premiums are due. My financial life runs automatically."
  </div>
  <div class="action-box">💻 ACTION: Click the 'Goals' menu. Show the progress bars. Then click 'Reminders'.</div>
</div>

<div class="section">
  <div class="section-header">
    <span class="time-badge">Step 6</span>
    <span class="section-title">The Free Offer & Next Videos</span>
  </div>
  <div class="narrator">
    "I have spent hundreds of hours building this app, and today, I am giving it to you for <span class="green-text">100% free</span>. 
    <br><br>
    This is just the beginning. I am going to make a series of videos right here on this channel, showing you exactly how to use every single menu in this app. Make sure to subscribe so you don't miss them!
    <br><br>
    If you want to take control of your family's money safely, click the link in the description to get started. When you sign in, Capital Friends will create your private Google Sheet right inside your Google Drive. Thanks for watching, and I will see you in the next video!"
  </div>
  <div class="action-box">🎥 ACTION: Back to your face. Tell them exactly what to do next.</div>
</div>

</div>
</body>
</html>`

fs.writeFileSync(file, newScript);
console.log("Script simplified successfully.");
