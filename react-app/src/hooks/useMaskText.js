import { useCallback, useMemo } from 'react'
import { useMask } from '../context/MaskContext'
import { useData } from '../context/DataContext'

// Mask family members' names inside free text such as portfolio names ("Visali – Groww" -> "V••• – Groww").
// Returns the text unchanged when Mask is off.
export function useMaskText() {
  const { masked } = useMask()
  const { members } = useData()
  const re = useMemo(() => {
    const words = new Set()
    ;(members || []).forEach((m) => String(m.memberName || '').split(/\s+/).forEach((w) => { if (w.length >= 3) words.add(w) }))
    if (!words.size) return null
    const esc = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return new RegExp(`\\b(${esc.join('|')})\\b`, 'gi')
  }, [members])
  return useCallback((text) => {
    if (!masked || !re || text == null) return text
    return String(text).replace(re, (w) => w.charAt(0) + '•••')
  }, [masked, re])
}
