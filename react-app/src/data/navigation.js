import {
  Users,
  Landmark,
  Briefcase,
  Shield,
  Wallet,
  BarChart3,
  Package,
  CreditCard,
  Target,
  Settings,
} from 'lucide-react'

const navigation = [
  { label: 'Family', icon: Users, path: '/family' },
  {
    label: 'Accounts',
    icon: CreditCard,
    children: [
      { label: 'Bank Accounts',  icon: Landmark,   path: '/accounts/bank' },
      { label: 'Investment A/c', icon: Briefcase,  path: '/accounts/investment' },
    ],
  },
  { label: 'Insurance', icon: Shield, path: '/insurance' },
  {
    label: 'Investments',
    icon: Wallet,
    children: [
      { label: 'Mutual Funds',      icon: Wallet,   path: '/investments/mutual-funds' },
      { label: 'Stocks',            icon: BarChart3, path: '/investments/stocks' },
      { label: 'Other Investments', icon: Package,   path: '/investments/other' },
    ],
  },
  { label: 'Liabilities', icon: CreditCard, path: '/liabilities' },
  { label: 'Goals',       icon: Target,     path: '/goals' },
  { label: 'Settings',    icon: Settings,   path: '/settings' },
]

export default navigation
