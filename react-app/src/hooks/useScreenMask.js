import { useEffect } from 'react'
import { useMask } from '../context/MaskContext'
import { useData } from '../context/DataContext'

// Screen-share safety: when "Mask data" is on, every family member's name shown anywhere on the page
// (portfolio names, statement accounts, dropdown options, past imports, tooltips) becomes "V•••".
// Works on the rendered text, so new screens are covered without touching each page.
// Input fields are never changed. Turning Mask off puts the original text back.
// Recording mode (?record=1 in the address once, remembered for the tab): hides hover tooltips too.
const ORIG = new WeakMap()
const ORIG_TITLE = new WeakMap()

export function useScreenMask() {
  const { masked } = useMask()
  const { members } = useData()
  useEffect(() => {
    const root = document.body
    try { if (new URLSearchParams(location.search).get('record') === '1') sessionStorage.setItem('cf-record', '1') } catch { /* ignore */ }
    let rec = false; try { rec = sessionStorage.getItem('cf-record') === '1' } catch { /* ignore */ }
    const words = new Set()
    ;(members || []).forEach((m) => String(m.memberName || '').split(/\s+/).forEach((w) => { if (w.length >= 3) words.add(w) }))
    const re = words.size ? new RegExp(`\\b(${[...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi') : null
    const mask = (s) => s.replace(re, (w) => w.charAt(0) + '•••')
    const skip = (n) => { const p = n.parentElement; return !p || p.closest('input,textarea,script,style,[contenteditable="true"],[data-no-mask]') }
    const doText = (n) => {
      if (skip(n)) return
      const v = n.nodeValue
      if (!masked || !re) { if (ORIG.has(n)) { const o = ORIG.get(n); ORIG.delete(n); if (v === o.masked) n.nodeValue = o.orig } return }
      if (ORIG.has(n) && ORIG.get(n).masked === v) return
      re.lastIndex = 0
      if (!re.test(v)) return
      const m = mask(v); ORIG.set(n, { orig: v, masked: m }); n.nodeValue = m
    }
    const doEl = (el) => {
      if (!el.getAttribute) return
      const t = el.getAttribute('title')
      if (t != null) {
        if (rec) { ORIG_TITLE.set(el, t); el.removeAttribute('title') }
        else if (masked && re) { re.lastIndex = 0; if (re.test(t)) { ORIG_TITLE.set(el, t); el.setAttribute('title', mask(t)) } }
      } else if (!rec && !masked && ORIG_TITLE.has(el)) { el.setAttribute('title', ORIG_TITLE.get(el)); ORIG_TITLE.delete(el) }
    }
    const walk = (node) => {
      if (node.nodeType === 3) return doText(node)
      if (node.nodeType !== 1) return
      doEl(node)
      const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
      for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeType === 3 ? doText(n) : doEl(n)
    }
    walk(root)
    if (!masked && !rec) return
    const mo = new MutationObserver((list) => { for (const r of list) { if (r.type === 'characterData') doText(r.target); else if (r.type === 'attributes') doEl(r.target); else r.addedNodes.forEach(walk) } })
    mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title'] })
    return () => mo.disconnect()
  }, [masked, members])
}
