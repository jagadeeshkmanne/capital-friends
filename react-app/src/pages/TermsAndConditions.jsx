import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const LOGO = `${import.meta.env.BASE_URL}logo-new.png`

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0f1f]/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 max-w-4xl mx-auto">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <img src={LOGO} alt="Capital Friends" className="h-10 w-auto" />
            <span className="text-lg tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span className="font-bold text-white">Capital</span>
              <span className="font-extrabold text-emerald-400">Friends</span>
            </span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors no-underline">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Terms & Conditions</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: March 4, 2026</p>

        <Sec num="1" title="Acceptance of Terms">
          <p>By accessing and using Capital Friends (<strong className="text-white">capitalfriends.in</strong>), you agree to be bound by these Terms & Conditions and our <Link to="/privacy" className="text-cyan-400 hover:underline no-underline">Privacy Policy</Link>. If you do not agree to these terms, please do not use the app.</p>
        </Sec>

        <Sec num="2" title="Description of Service">
          <p>Capital Friends is a free, open-source family portfolio tracking tool developed by Jagadeesh Manne. It provides a web-based dashboard to help you organize and view your financial information (mutual funds, stocks, FDs, insurance, liabilities, goals) stored in a Google Spreadsheet in your own Google Drive.</p>
          <ul className="mt-3 space-y-2">
            <Li>The app is <strong className="text-white">not</strong> a financial advisor, broker, dealer, or investment platform</Li>
            <Li>It does not execute trades, manage funds, or provide personalized investment recommendations</Li>
            <Li>All financial data is manually entered by you</Li>
            <Li>The app does not have access to your bank accounts, demat accounts, or trading platforms</Li>
          </ul>
        </Sec>

        <Sec num="3" title="Eligibility">
          <ul className="space-y-2">
            <Li>You must be at least 18 years of age to use this service</Li>
            <Li>You must have a valid Google account</Li>
            <Li>You are responsible for ensuring your use of the app complies with applicable laws in your jurisdiction</Li>
          </ul>
        </Sec>

        <Sec num="4" title="User Accounts & Authentication">
          <ul className="space-y-2">
            <Li>You sign in using your Google account via Google OAuth 2.0</Li>
            <Li>You are solely responsible for the security of your Google account</Li>
            <Li>On first sign-in, the app creates a Google Spreadsheet in your Drive to store your financial data</Li>
            <Li>You may invite family members to share access to your spreadsheet — you are responsible for managing who has access</Li>
          </ul>
        </Sec>

        <Sec num="5" title="Data Ownership & Privacy">
          <ul className="space-y-2">
            <Li>All financial data you enter belongs entirely to you</Li>
            <Li>Your data is stored in your Google Drive — not on our servers</Li>
            <Li>We do not have access to, copy, transmit, or store your financial data on any server</Li>
            <Li>You can delete your data at any time by deleting the Capital Friends spreadsheet from your Google Drive</Li>
            <Li>You can revoke app access at any time from your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google Account Permissions</a></Li>
          </ul>
          <p className="mt-3">For full details, see our <Link to="/privacy" className="text-cyan-400 hover:underline no-underline">Privacy Policy</Link>.</p>
        </Sec>

        <Sec num="6" title="Google API Compliance">
          <p>Capital Friends uses Google APIs (Sheets, Drive, Gmail, Apps Script) to function. By using this app:</p>
          <ul className="mt-3 space-y-2">
            <Li>You agree to <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google&apos;s Terms of Service</a></Li>
            <Li>Our use of Google APIs complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements</Li>
            <Li>We do not use data obtained from Google APIs for advertising, training AI models, or any purpose beyond providing the app&apos;s functionality to you</Li>
          </ul>
        </Sec>

        <Sec num="7" title="No Financial Advice Disclaimer">
          <p>Capital Friends is a <strong className="text-white">tracking and organization tool only</strong>. It does not provide:</p>
          <ul className="mt-3 space-y-2">
            <Li>Investment advice or recommendations</Li>
            <Li>Tax, legal, or accounting advice</Li>
            <Li>Buy/sell/hold signals — rebalancing and allocation suggestions shown in the app are purely informational</Li>
            <Li>Financial planning, retirement planning, or wealth management services</Li>
          </ul>
          <p className="mt-3">Any calculations, projections, or suggestions shown in the app (including SIP amounts, goal projections, allocation recommendations, or de-risking alerts) are for <strong className="text-white">informational purposes only</strong> and should not be relied upon as financial advice. Always consult a qualified financial advisor (SEBI-registered investment advisor in India) before making investment decisions.</p>
        </Sec>

        <Sec num="8" title="Accuracy of Information">
          <ul className="space-y-2">
            <Li>Mutual fund NAV data is sourced from AMFI (amfiindia.com) and may be delayed by up to 24 hours</Li>
            <Li>Stock prices are indicative and may not reflect real-time market prices</Li>
            <Li>All calculations (P&L, returns, projections, XIRR, CAGR) are approximate and may contain errors</Li>
            <Li>We do not guarantee the accuracy, completeness, or timeliness of any data displayed</Li>
            <Li>You are responsible for independently verifying all financial information</Li>
          </ul>
        </Sec>

        <Sec num="9" title="Service Availability">
          <ul className="space-y-2">
            <Li>The app is provided <strong className="text-white">&ldquo;as is&rdquo;</strong> and <strong className="text-white">&ldquo;as available&rdquo;</strong> without warranty of any kind, express or implied</Li>
            <Li>We do not guarantee uninterrupted, secure, or error-free service</Li>
            <Li>The app depends on Google services (Sheets API, Drive API, Gmail API, Apps Script) — any outages or changes in Google services may affect functionality</Li>
            <Li>We reserve the right to modify, suspend, or discontinue the service at any time without notice</Li>
            <Li>We are not responsible for any data loss resulting from Google service outages or your own actions</Li>
          </ul>
        </Sec>

        <Sec num="10" title="Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, Capital Friends, its developer, and any contributors shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from or related to:</p>
          <ul className="mt-3 space-y-2">
            <Li>Your use of or inability to use the service</Li>
            <Li>Any errors, inaccuracies, or omissions in the data displayed</Li>
            <Li>Financial losses or decisions made based on information shown in the app</Li>
            <Li>Unauthorized access to or alteration of your Google account or spreadsheet</Li>
            <Li>Loss, corruption, or deletion of data in your Google Spreadsheet</Li>
            <Li>Any interruption or cessation of the service</Li>
          </ul>
        </Sec>

        <Sec num="11" title="Prohibited Uses">
          <p>You agree not to:</p>
          <ul className="mt-3 space-y-2">
            <Li>Use the app for any unlawful purpose</Li>
            <Li>Attempt to gain unauthorized access to the app, Google APIs, or other users&apos; data</Li>
            <Li>Use the app to store passwords, banking credentials, PINs, or other sensitive authentication data</Li>
            <Li>Reverse-engineer, decompile, or attempt to extract the source code of the Google Apps Script backend (the web app source code is open-source)</Li>
            <Li>Use the app for commercial redistribution or resale</Li>
            <Li>Use automated scripts or bots to access the app in a way that exceeds normal usage</Li>
          </ul>
        </Sec>

        <Sec num="12" title="Intellectual Property">
          <p>Capital Friends is open-source software. The web app source code is available on <a href="https://github.com/jagadeeshkmanne/capital-friends" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">GitHub</a>. You are free to review, fork, and modify the code under the terms of the repository&apos;s license. The Capital Friends name, logo, and branding are the property of the developer.</p>
        </Sec>

        <Sec num="13" title="Indemnification">
          <p>You agree to indemnify and hold harmless Capital Friends and its developer from any claims, damages, losses, or expenses (including legal fees) arising out of your use of the service, your violation of these Terms, or your violation of any third-party rights.</p>
        </Sec>

        <Sec num="14" title="Governing Law">
          <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes arising from these Terms or your use of the app shall be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana, India.</p>
        </Sec>

        <Sec num="15" title="Changes to Terms">
          <p>We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date at the top reflects the most recent revision. Continued use of the app after changes constitutes your acceptance of the updated terms. If we make material changes, we will notify users via the app or email.</p>
        </Sec>

        <Sec num="16" title="Contact">
          <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <p><strong className="text-white">Developer:</strong> Jagadeesh Manne</p>
            <p className="mt-1"><strong className="text-white">Email:</strong> <a href="mailto:jagadeesh.k.manne@gmail.com" className="text-cyan-400 hover:underline">jagadeesh.k.manne@gmail.com</a></p>
            <p className="mt-1">
              <strong className="text-white">GitHub:</strong>{' '}
              <a href="https://github.com/jagadeeshkmanne/capital-friends" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">jagadeeshkmanne/capital-friends</a>
            </p>
          </div>
        </Sec>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex items-center justify-between text-sm text-slate-600">
          <Link to="/privacy" className="hover:text-slate-400 transition-colors no-underline">Privacy Policy</Link>
          <Link to="/" className="hover:text-slate-400 transition-colors no-underline">Home</Link>
        </div>
      </main>
    </div>
  )
}

function Sec({ num, title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-white flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-bold shrink-0">{num}</span>
        {title}
      </h2>
      <div className="text-sm text-slate-400 leading-relaxed pl-9">{children}</div>
    </section>
  )
}

function Li({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-slate-600 mt-0.5 shrink-0">&bull;</span>
      <span>{children}</span>
    </li>
  )
}
