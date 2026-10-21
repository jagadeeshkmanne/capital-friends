import React from 'react'

// After a deploy, a tab (or a cached copy of the page) can still point at the old file names, so opening a
// page fails with "Failed to fetch dynamically imported module". main.jsx reloads once by itself; if that is
// not enough (the old page came from a cache again), this shows a "new version" card with a Reload button
// instead of a blank screen. Any other crash gets the same card, so the user is never left with nothing.
export const isChunkError = (e) => /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|ChunkLoadError|Loading chunk/i.test(String(e?.message || e || ''))

export const freshReload = () => {
  const u = new URL(window.location.href)
  u.searchParams.set('v', Date.now().toString(36))
  window.location.replace(u.toString())
}

export default class UpdateBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) {
    if (isChunkError(error) && this.props.onChunkError?.()) return   // reloading
    console.error(error)
  }
  render() {
    if (!this.state.error) return this.props.children
    const update = isChunkError(this.state.error)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'var(--bg-base, #0b1020)' }}>
        <div style={{ maxWidth: 380, width: '100%', borderRadius: 16, padding: 24, textAlign: 'center', background: 'var(--bg-card, #151b2e)', border: '1px solid var(--border-light, #2a3350)', color: 'var(--text-primary, #e8ecf5)', fontFamily: 'inherit' }}>
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{update ? 'A new version of Capital Friends is ready' : 'Something went wrong on this page'}</p>
          <p style={{ fontSize: 13, opacity: 0.75, margin: '8px 0 18px' }}>{update ? 'Reload to open it. Your data is safe in your Google Sheet.' : 'Reload to try again. Your data is safe in your Google Sheet.'}</p>
          <button onClick={freshReload} style={{ padding: '10px 22px', fontSize: 13, fontWeight: 700, color: '#fff', background: '#7c3aed', border: 0, borderRadius: 10, cursor: 'pointer' }}>Reload</button>
        </div>
      </div>
    )
  }
}
