import { useEffect, useState } from 'react'
import { LogoMark } from './Brand'
import { Bust } from './StoryHero'

// Landing header: just our logo, plus a Sign in button that appears once you scroll past the hero, on a light glass bar that gains a shadow once you scroll.
export default function LandingHeader({ signIn, isMobile, youtube, instagram, families }) {
  const [scrolled, setScrolled] = useState(false)
  const [past, setPast] = useState(false)   // the hero has its own button; the header one shows once you scroll past it
  useEffect(() => {
    const f = () => { setScrolled(window.scrollY > 8); setPast(window.scrollY > window.innerHeight * 0.6) }
    f(); window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  return (
    <header className={`lh ${scrolled ? 'sc' : ''} ${isMobile ? 'm' : ''}`}>
      <style>{CSS}</style>
      <div className="lh-in">
        <a href="#" className="lh-logo" aria-label="Capital Friends home"><LogoMark size={isMobile ? 30 : 34} />{!isMobile && <span className="lh-wm">Capital <em>Friends</em></span>}</a>
        <div className="lh-r">
          {families ? (
            <span className="lh-fam" title="Families using Capital Friends">
              <svg width={isMobile ? 52 : 64} height={isMobile ? 26 : 30} viewBox="-16 -16 84 32" aria-hidden="true">
                {['mother', 'spouse', 'you'].map((k, n) => <g key={k} transform={`translate(${n * 24} 0)`}><circle r="15.5" fill="#25215e" /><Bust k={k} r={14} /></g>)}
              </svg>
              <span className="lh-famt"><b>{families.toLocaleString('en-IN')}</b>{!isMobile && <> families use it</>}<i className="lh-live" /></span>
            </span>
          ) : null}
          {youtube && <a className="lh-ic yt" href={youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" /></svg></a>}
          {instagram && <a className="lh-ic ig" href={instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg></a>}
          <button className={`lh-go ${past ? 'on' : ''}`} onClick={signIn} tabIndex={past ? 0 : -1} aria-hidden={!past}>Sign in</button>
        </div>
        <i className="lh-line" aria-hidden="true" />
      </div>
    </header>
  )
}

const CSS = `
.lh{position:sticky;top:0;z-index:100;overflow:hidden;background:#1e1b4b;box-shadow:0 1px 0 rgba(255,255,255,.06) inset;transition:box-shadow .25s}
.lh.sc{box-shadow:0 12px 30px -18px rgba(30,27,75,.75)}
.lh-in{position:relative;max-width:1360px;margin:0 auto;height:60px;padding:0 40px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box}
.lh-logo{text-decoration:none;display:inline-flex;align-items:center;gap:10px}
.lh-wm{font-family:Inter,system-ui,sans-serif;font-size:17px;font-weight:700;letter-spacing:-.02em;color:#fff;white-space:nowrap}.lh-wm em{font-style:normal;color:#34d399}
.lh-r{display:flex;align-items:center;gap:8px}
.lh-fam{display:inline-flex;align-items:center;gap:9px;margin-right:10px;padding:4px 16px 4px 5px;border-radius:999px;background:linear-gradient(90deg,rgba(52,211,153,.22),rgba(52,211,153,.08));box-shadow:inset 0 0 0 1px rgba(52,211,153,.5),0 0 18px -4px rgba(52,211,153,.45);animation:lhFam 3s ease-in-out infinite}
@keyframes lhFam{50%{box-shadow:inset 0 0 0 1px rgba(52,211,153,.75),0 0 26px -2px rgba(52,211,153,.55)}}
.lh-famt{display:inline-flex;align-items:center;gap:6px;font-family:Inter,system-ui,sans-serif;font-size:13px;font-weight:600;color:#d1fae5;white-space:nowrap}.lh-famt b{color:#fff;font-weight:800;font-size:15px}
.lh-live{width:7px;height:7px;border-radius:50%;background:#34d399;animation:lhLive 1.8s infinite}
@keyframes lhLive{0%{box-shadow:0 0 0 0 rgba(52,211,153,.6)}70%{box-shadow:0 0 0 6px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
.lh-tag{display:inline-flex;align-items:center;gap:8px;margin-right:10px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08);font-family:Inter,system-ui,sans-serif;font-size:12.5px;font-weight:500;color:#cbd5e1;white-space:nowrap}
.lh-tag i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.18)}
.lh-ic{width:36px;height:36px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.18);transition:transform .15s,box-shadow .15s}
/* filled brand circles with white marks, so they stand out on the dark bar */
.lh-ic.yt{background:#ff0000}
.lh-ic.ig{background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285aeb 90%)}
.lh-ic:hover{transform:translateY(-1px);box-shadow:0 0 0 3px rgba(255,255,255,.35)}
.lh-go{display:inline-flex;align-items:center;height:36px;padding:0 16px;margin-left:6px;border-radius:999px;border:0;cursor:pointer;color:#0b1120;font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:13.5px;background:#fff;opacity:0;width:0;padding:0;margin:0;overflow:hidden;pointer-events:none;transition:opacity .25s,width .25s,padding .25s,margin .25s}
.lh-go.on{opacity:1;width:auto;padding:0 16px;margin-left:6px;pointer-events:auto}
.lh-line{display:none;background:linear-gradient(90deg,#14b8a6,#7c3aed,#0ea5e9,#f59e0b,#10b981,#14b8a6);background-size:200% 100%;animation:lhLine 12s linear infinite;opacity:.9}
@keyframes lhLine{to{background-position:200% 0}}
.lh.m .lh-in{height:54px;padding:0 12px}.lh.m .lh-ic{width:34px;height:34px}.lh.m .lh-r{gap:6px}.lh.m .lh-fam{margin-right:2px}.lh.m .lh-wm{font-size:15.5px}
@media (prefers-reduced-motion:reduce){.lh-line{animation:none}}
`
