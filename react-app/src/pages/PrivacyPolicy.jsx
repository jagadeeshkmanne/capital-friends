import { Link } from 'react-router-dom'
import { Shield, Lock, Eye, Database, Mail, Trash2, ArrowLeft, Users, Globe } from 'lucide-react'

const LOGO = `${import.meta.env.BASE_URL}logo-new.png`

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: March 13, 2026</p>

        {/* Overview */}
        <Section icon={<Shield size={20} />} color="emerald" title="Overview">
          <p>Capital Friends (<strong className="text-white">capitalfriends.in</strong>) is a free, open-source family portfolio tracker built by Jagadeesh Manne. It helps you track investments, insurance, loans, and goals for your entire family using a Google Spreadsheet stored in your own Google Drive.</p>
          <p className="mt-3">Capital Friends does <strong className="text-white">not</strong> have any backend servers, databases, or analytics. Your financial data stays entirely within your Google account. The developer cannot access your financial data.</p>
        </Section>

        {/* Data Storage */}
        <Section icon={<Database size={20} />} color="violet" title="How Your Data is Stored">
          <p>When you sign in for the first time, the app automatically creates a Google Spreadsheet named <em>&ldquo;Capital Friends - Your Name&rdquo;</em> in your Google Drive. All your financial data (investments, goals, insurance, etc.) is written to this spreadsheet.</p>
          <ul className="mt-3 space-y-2">
            <Li>The spreadsheet is owned by you and stored in your Google Drive</Li>
            <Li>Only you (and people you explicitly share it with) can access it</Li>
            <Li>The developer has no server-side copy of your data</Li>
            <Li>The web app is a static site hosted on GitHub Pages — there is no backend server or database</Li>
            <Li>All data operations run via Google Apps Script (Execution API) — the script reads and writes only your Capital Friends spreadsheet</Li>
          </ul>
        </Section>

        {/* Google Permissions */}
        <Section icon={<Lock size={20} />} color="cyan" title="Google Permissions (OAuth Scopes)">
          <p>When you sign in with Google, we request the following permissions. Each is required for the app to function:</p>

          <Scope
            name="Google Sheets"
            scope="auth/spreadsheets"
            badge="Sensitive"
            badgeColor="amber"
            desc="See, edit, create and delete all your Google Sheets spreadsheets"
            why="Required to create your Capital Friends spreadsheet on first sign-in, and to read/write your portfolio data, goals, settings, family members, insurance, liabilities, and all other financial information. The app only accesses the Capital Friends spreadsheet it created — no other spreadsheets."
          />
          <Scope
            name="Google Drive (App-Created Files)"
            scope="auth/drive.file"
            badge="Non-Sensitive"
            badgeColor="emerald"
            desc="See, edit, create and delete only files created by this app"
            why={<>Used to create your Capital Friends spreadsheet via <code className="text-xs text-violet-400 bg-violet-500/10 px-1 rounded">SpreadsheetApp.create()</code> during first-time setup. This scope only grants access to the single spreadsheet the app creates — <strong className="text-white">we cannot access any other files in your Google Drive.</strong></>}
          />
          <Scope
            name="Gmail (Send Only)"
            scope="auth/gmail.send"
            badge="Sensitive"
            badgeColor="amber"
            desc="Send email on your behalf"
            why="Used to send periodic email reports containing your portfolio summary, goal progress, and fund performance. Emails are sent from your own Gmail account to yourself and/or family members you configure in Settings. We cannot and do not read, access, or delete your emails — the gmail.send scope only permits sending."
          />
          <Scope
            name="Apps Script Execution"
            scope="auth/script.scriptapp"
            badge="Sensitive"
            badgeColor="amber"
            desc="Allow this application to run when you are not present"
            why="Required for time-based triggers that automatically refresh mutual fund NAV prices daily and send scheduled email reports. These triggers run as background tasks within Google Apps Script — not on any external server."
          />
          <Scope
            name="Sign-In Identity"
            scope="openid, email, profile"
            desc="Know who you are on Google, see your email address and profile info"
            why="Standard Google Sign-In scopes used to authenticate you and display your name, email, and profile picture within the app. This information is used only in-browser and is not sent to or stored on any server."
          />

          {/* Google Limited Use Disclosure — REQUIRED for verification */}
          <div className="mt-6 p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.04]">
            <p className="text-sm text-cyan-400 font-semibold mb-2">Google API Services User Data Policy</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Capital Friends&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{' '}
              <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
          </div>

          <div className="mt-4 p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04]">
            <p className="text-sm text-emerald-400 font-semibold mb-1">No unnecessary permissions</p>
            <p className="text-sm text-slate-400">We do not request access to your contacts, calendar, browsing history, or any other Google service beyond what is listed above. Every permission is actively used and essential.</p>
          </div>
        </Section>

        {/* How We Use Google User Data */}
        <Section icon={<Eye size={20} />} color="amber" title="How We Use Google User Data">
          <p>Capital Friends accesses Google user data exclusively to provide its core portfolio tracking functionality. Below is a complete disclosure of how each type of data is used:</p>
          <ul className="mt-3 space-y-3">
            <Li><strong className="text-white">Google Sheets data:</strong> Your financial data (mutual fund holdings, stock portfolios, insurance policies, loan records, family members, goals, and transaction history) is read from and written to a single Google Spreadsheet that the app creates in your Google Drive. This data is used solely to render your dashboard, portfolio views, reports, and goal tracking within the app. It is never copied, cached on any server, or transmitted outside your browser session.</Li>
            <Li><strong className="text-white">Google Drive access:</strong> Used only to create the Capital Friends spreadsheet during first-time setup. No other files in your Drive are listed, accessed, read, or modified.</Li>
            <Li><strong className="text-white">Gmail (send only):</strong> Used exclusively to send scheduled portfolio summary emails and reminder notifications (SIP reminders, insurance renewal alerts, goal progress) from your own Gmail account to recipients you configure. Email content is generated on-the-fly from your spreadsheet data and is not stored anywhere. We do not read, search, or delete any emails.</Li>
            <Li><strong className="text-white">Apps Script triggers:</strong> Used to schedule background tasks that refresh mutual fund NAV prices daily and send automated email reports. These triggers run entirely within Google&apos;s infrastructure under your authenticated session.</Li>
            <Li><strong className="text-white">Profile information:</strong> Your name, email, and profile picture (from Google Sign-In) are displayed within the app&apos;s UI for identification purposes only. This information is not stored on any server or shared with any third party.</Li>
          </ul>
          <p className="mt-3"><strong className="text-white">Data is never used for:</strong> advertising, profiling, selling to third parties, training AI/ML models, or any purpose other than providing the portfolio tracking features described above.</p>
        </Section>

        {/* Data Protection */}
        <Section icon={<Lock size={20} />} color="rose" title="Data Protection & Security">
          <p>Capital Friends implements the following measures to protect your sensitive financial data:</p>
          <ul className="mt-3 space-y-3">
            <Li><strong className="text-white">No server-side storage:</strong> Your financial data is never transmitted to or stored on any server owned or operated by Capital Friends. All data resides exclusively in your Google Drive, protected by Google&apos;s enterprise-grade security infrastructure.</Li>
            <Li><strong className="text-white">Encryption in transit:</strong> All communication between your browser and Google APIs is encrypted using HTTPS/TLS. The app is served over HTTPS from GitHub Pages.</Li>
            <Li><strong className="text-white">Encryption at rest:</strong> Your spreadsheet data is stored in Google Drive, which encrypts all data at rest using AES-256 encryption as part of Google&apos;s standard infrastructure security.</Li>
            <Li><strong className="text-white">OAuth 2.0 authentication:</strong> The app uses Google&apos;s OAuth 2.0 protocol for authentication. Access tokens are stored only in your browser&apos;s session memory and are never persisted to disk, local storage, or any server.</Li>
            <Li><strong className="text-white">Minimal data access:</strong> The app accesses only the single spreadsheet it created. It does not scan, index, or access any other files in your Google Drive, emails in your Gmail, or data in any other Google service.</Li>
            <Li><strong className="text-white">No third-party data sharing:</strong> Your Google user data is never shared with, disclosed to, or made accessible to any third party, including analytics services, advertising networks, or data brokers.</Li>
            <Li><strong className="text-white">Open source:</strong> The entire application source code is publicly available on <a href="https://github.com/jagadeeshkmanne/capital-friends" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">GitHub</a>, allowing independent verification of all data handling practices.</Li>
          </ul>
        </Section>

        {/* Data Collection */}
        <Section icon={<Eye size={20} />} color="amber" title="Data We Collect">
          <p><strong className="text-white">We do not collect, store, or transmit any user data to our own servers.</strong></p>
          <ul className="mt-3 space-y-2">
            <Li>No analytics or tracking scripts (no Google Analytics, no Mixpanel, no Sentry, etc.)</Li>
            <Li>No cookies beyond what Google Sign-In requires for authentication</Li>
            <Li>No server-side logging of user activity or API calls</Li>
            <Li>No advertising, ad networks, or ad-related tracking</Li>
            <Li>No user data is shared with, sold to, or disclosed to any third party</Li>
            <Li>No user data is used for training machine learning or AI models</Li>
          </ul>
          <p className="mt-3">The web app is a static website hosted on GitHub Pages. It communicates directly with Google APIs from your browser. There is no intermediary server that processes or stores your data.</p>
        </Section>

        {/* Email Reports */}
        <Section icon={<Mail size={20} />} color="rose" title="Email Reports">
          <p>If you enable email reports in Settings, the app uses Google Apps Script (running under your authenticated session) to send a portfolio summary email via your Gmail account.</p>
          <ul className="mt-3 space-y-2">
            <Li>Emails are sent <strong className="text-white">from your Gmail</strong> to recipients you configure (yourself and/or family members)</Li>
            <Li>Email content is generated on-the-fly from your spreadsheet data — it is not stored anywhere</Li>
            <Li>We cannot read, access, search, or delete your emails — the <code className="text-xs text-violet-400 bg-violet-500/10 px-1 rounded">gmail.send</code> scope only permits sending</Li>
            <Li>You can disable email reports at any time from Settings</Li>
          </ul>
        </Section>

        {/* Data Deletion */}
        <Section icon={<Trash2 size={20} />} color="orange" title="Data Deletion & Account Removal">
          <p>Since all your data is stored in your own Google Drive, you have full control:</p>
          <ul className="mt-3 space-y-2">
            <Li><strong className="text-white">Delete all data:</strong> Delete the &ldquo;Capital Friends&rdquo; spreadsheet from your Google Drive. This permanently removes all your financial data.</Li>
            <Li><strong className="text-white">Revoke app access:</strong> Go to <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google Account Permissions</a> and remove Capital Friends. This revokes all OAuth permissions.</Li>
            <Li><strong className="text-white">No server-side cleanup needed:</strong> Since we store no data on any server, revoking access and deleting your spreadsheet is a complete removal.</Li>
          </ul>
        </Section>

        {/* Third Party Services */}
        <Section icon={<Globe size={20} />} color="slate" title="Third-Party Services">
          <p>Capital Friends interacts with the following third-party services:</p>
          <ul className="mt-3 space-y-2">
            <Li><strong className="text-white">Google APIs</strong> — Authentication (OAuth 2.0), Google Sheets API, Google Drive API, Gmail API, and Apps Script Execution API. Governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Google&apos;s Privacy Policy</a>.</Li>
            <Li><strong className="text-white">AMFI (amfiindia.com)</strong> — Public mutual fund NAV data is fetched daily for price updates. No personal or user data is sent to AMFI — only scheme codes are used to look up public NAV values.</Li>
            <Li><strong className="text-white">GitHub Pages</strong> — The static web app is hosted on GitHub Pages. GitHub serves the HTML/CSS/JS files but has no access to your Google data or authentication tokens.</Li>
          </ul>
        </Section>

        {/* Children's Privacy */}
        <Section icon={<Users size={20} />} color="blue" title="Children&rsquo;s Privacy">
          <p>Capital Friends is not intended for use by individuals under the age of 18. We do not knowingly collect information from children. The app is designed for adults managing family finances.</p>
        </Section>

        {/* Changes */}
        <Section icon={<Shield size={20} />} color="violet" title="Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. The &ldquo;Last updated&rdquo; date at the top of this page reflects the most recent revision. Continued use of the app after changes constitutes acceptance of the updated policy.</p>
        </Section>

        {/* Contact */}
        <Section icon={<Mail size={20} />} color="emerald" title="Contact">
          <p>If you have questions about this privacy policy, data handling, or the app:</p>
          <div className="mt-3 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <p><strong className="text-white">Developer:</strong> Jagadeesh Manne</p>
            <p className="mt-1"><strong className="text-white">Email:</strong> <a href="mailto:jagadeesh.k.manne@gmail.com" className="text-cyan-400 hover:underline">jagadeesh.k.manne@gmail.com</a></p>
            <p className="mt-1">
              <strong className="text-white">GitHub:</strong>{' '}
              <a href="https://github.com/jagadeeshkmanne/capital-friends" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">jagadeeshkmanne/capital-friends</a>
            </p>
          </div>
        </Section>

        {/* Footer links */}
        <div className="mt-12 pt-6 border-t border-white/[0.06] flex items-center justify-between text-sm text-slate-600">
          <Link to="/terms" className="hover:text-slate-400 transition-colors no-underline">Terms & Conditions</Link>
          <Link to="/" className="hover:text-slate-400 transition-colors no-underline">Home</Link>
        </div>
      </main>
    </div>
  )
}

function Section({ icon, color, title, children }) {
  const colors = {
    emerald: 'text-emerald-400', violet: 'text-violet-400', cyan: 'text-cyan-400',
    amber: 'text-amber-400', rose: 'text-rose-400', orange: 'text-orange-400',
    blue: 'text-blue-400', slate: 'text-slate-400',
  }
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white flex items-center gap-2.5 mb-4">
        <span className={`${colors[color]} shrink-0`}>{icon}</span>
        {title}
      </h2>
      <div className="text-sm text-slate-400 leading-relaxed">{children}</div>
    </section>
  )
}

function Scope({ name, scope, badge, badgeColor, desc, why }) {
  const badgeColors = {
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  }
  return (
    <div className="mt-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            {name}
            {badge && <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${badgeColors[badgeColor] || ''}`}>{badge}</span>}
          </p>
          {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
        </div>
        <code className="text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded shrink-0">{scope}</code>
      </div>
      <p className="text-sm text-slate-400 mt-2 leading-relaxed"><strong className="text-slate-300">Why we need this:</strong> {why}</p>
    </div>
  )
}

function Li({ children }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-emerald-500 mt-1 shrink-0">&#x2713;</span>
      <span>{children}</span>
    </li>
  )
}
