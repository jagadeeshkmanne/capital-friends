import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './context/DataContext'
import { FamilyProvider } from './context/FamilyContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <DataProvider>
          <FamilyProvider>
            <App />
          </FamilyProvider>
        </DataProvider>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
)
