import {
  Users,
  Landmark,
  Briefcase,
  Shield,
  Wallet,
  BarChart3,
  ScanSearch,
  Package,
  CreditCard,
  Target,
  Bell,
  Settings,
} from 'lucide-react'

const navigation = [
  { label: 'Family Members',     icon: Users,      path: '/family' },
  { label: 'Bank Accounts',     icon: Landmark,   path: '/accounts/bank' },
  { label: 'Investment Accounts', icon: Briefcase, path: '/accounts/investment' },
  { label: 'Insurance',         icon: Shield,     path: '/insurance' },
  { label: 'Mutual Funds',      icon: Wallet,     path: '/investments/mutual-funds' },
  { label: 'Stocks',            icon: BarChart3,  path: '/investments/stocks' },
  { label: 'Screener',          icon: ScanSearch,  path: '/investments/screener' },
  { label: 'Other Investments', icon: Package,    path: '/investments/other' },
  { label: 'Liabilities',       icon: CreditCard, path: '/liabilities' },
  { label: 'Goals',             icon: Target,     path: '/goals' },
  { label: 'Reminders',         icon: Bell,       path: '/reminders' },
  { label: 'Settings',          icon: Settings,   path: '/settings' },
]

export default navigation
