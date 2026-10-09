import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  // Dark by default. Light only if the user picked it with the toggle ('cf-theme-choice' is written
  // only on a click, so the old auto-saved 'cf-theme' value from the OS setting no longer decides).
  const [theme, setTheme] = useState(() => {
    const chosen = localStorage.getItem('cf-theme-choice')
    return chosen === 'light' || chosen === 'dark' ? chosen : 'dark'
  })

  useEffect(() => {
    localStorage.setItem('cf-theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => {
    const next = t === 'dark' ? 'light' : 'dark'
    localStorage.setItem('cf-theme-choice', next)
    return next
  })

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
