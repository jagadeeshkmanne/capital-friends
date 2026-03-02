import { useNavigate } from 'react-router-dom'
import DonateDialog from '../components/DonateDialog'

export default function DonatePage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)' }}>
      <DonateDialog open={true} onClose={() => navigate('/')} />
    </div>
  )
}
