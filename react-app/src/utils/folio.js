/** The folio of a fund holding, read from its imported statement rows ("CAMS · folio 1234567/89 · ..."); null if none. */
export function folioOf(txns) {
  for (const t of txns || []) {
    const m = /folio\s+([0-9A-Z/ -]+?)(?:\s*·|$)/i.exec(String(t.notes || ''))
    if (m) return m[1].trim()
  }
  return null
}
/** masked: only the last 4 characters */
export const maskFolio = (f) => `•••• ${String(f || '').replace(/\s/g, '').slice(-4)}`
