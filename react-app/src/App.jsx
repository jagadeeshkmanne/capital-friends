import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import HomePage from './components/HomePage'
import LandingPage from './pages/LandingPage'
import Placeholder from './pages/Placeholder'
import BankAccountsPage from './pages/accounts/BankAccountsPage'
import InvestmentAccountsPage from './pages/accounts/InvestmentAccountsPage'
import InsurancePage from './pages/accounts/InsurancePage'
import LiabilitiesTab from './pages/accounts/LiabilitiesTab'
import OtherInvestmentsTab from './pages/accounts/OtherInvestmentsTab'
import MutualFundsPage from './pages/investments/MutualFundsPage'
import StocksPage from './pages/investments/StocksPage'
import Family from './pages/family/Family'
import GoalsPage from './pages/goals/GoalsPage'
import MorePage from './pages/MorePage'
import SettingsPage from './pages/SettingsPage'
import RemindersPage from './pages/RemindersPage'
import ReportsPage from './pages/ReportsPage'
import HealthCheckPage from './pages/HealthCheckPage'
import AboutPage from './pages/AboutPage'
import TestPage from './pages/TestPage'

export default function App() {
  return (
    <Routes>
      {/* Home: Landing if not logged in, Dashboard if logged in */}
      <Route index element={<HomePage />} />
      <Route path="login" element={<LandingPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* Dashboard redirects to Mutual Funds */}
          <Route path="dashboard" element={<Navigate to="/investments/mutual-funds" replace />} />

          {/* Family */}
          <Route path="family" element={<Family />} />

          {/* Accounts */}
          <Route path="accounts/bank" element={<BankAccountsPage />} />
          <Route path="accounts/investment" element={<InvestmentAccountsPage />} />

          {/* Insurance */}
          <Route path="insurance" element={<InsurancePage />} />

          {/* Investments */}
          <Route path="investments/mutual-funds" element={<MutualFundsPage />} />
          <Route path="investments/stocks" element={<StocksPage />} />
          <Route path="investments/other" element={<OtherInvestmentsTab />} />

          {/* Liabilities */}
          <Route path="liabilities" element={<LiabilitiesTab />} />

          {/* Goals */}
          <Route path="goals" element={<GoalsPage />} />

          {/* Reports & Tools */}
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="health-check" element={<HealthCheckPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="test" element={<TestPage />} />

          {/* Settings */}
          <Route path="settings" element={<SettingsPage />} />

          {/* More (mobile) */}
          <Route path="more" element={<MorePage />} />

          {/* Legacy — old /accounts route redirects to bank */}
          <Route path="accounts" element={<BankAccountsPage />} />

          {/* 404 */}
          <Route path="*" element={<Placeholder />} />
        </Route>
      </Route>
    </Routes>
  )
}
