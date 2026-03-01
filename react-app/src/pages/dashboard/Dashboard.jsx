import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Mail, Check, Loader2, Globe } from 'lucide-react'
import * as api from '../../services/api'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useData } from '../../context/DataContext'
import PageLoading from '../../components/PageLoading'
import { useFamily } from '../../context/FamilyContext'
import { useMask } from '../../context/MaskContext'
import { formatINR, splitFundName } from '../../data/familyData'

function plColor(val) { return val >= 0 ? 'text-emerald-400' : 'text-red-400' }
function plPrefix(val) { return val >= 0 ? '+' : '' }

// Infer asset category from fund name (client-side fallback)
function inferCategory(name) {
  if (!name) return 'Other'
  const n = name.toLowerCase()
  if (n.includes('gold') || n.includes('silver') || n.includes('commodity')) return 'Commodity'
  if (n.includes('liquid') || n.includes('money market') || n.includes('overnight')) return 'Liquid'
  if (n.includes('gilt') || n.includes('government securities') || n.includes('constant maturity')) return 'Gilt'
  if (n.includes('elss') || n.includes('tax saver')) return 'ELSS'
  if (n.includes('debt') || n.includes('bond') || n.includes('income fund') || n.includes('corporate bond') ||
      n.includes('banking & psu') || n.includes('short duration') || n.includes('medium duration') ||
      n.includes('long duration') || n.includes('short term') || n.includes('medium term') ||
      n.includes('floater') || n.includes('floating rate') || n.includes('credit') ||
      n.includes('accrual') || n.includes('savings fund') || n.includes('ultra short')) return 'Debt'
  if (n.includes('multi asset')) return 'Multi-Asset'
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') ||
      n.includes('arbitrage') || n.includes('retirement') ||
      n.includes('children') || n.includes('pension')) return 'Hybrid'
  if (n.includes('equity') || n.includes('flexi cap') || n.includes('large cap') || n.includes('mid cap') ||
      n.includes('small cap') || n.includes('multi cap') || n.includes('focused') || n.includes('contra') ||
      n.includes('value fund') || n.includes('thematic') || n.includes('sectoral') ||
      n.includes('consumption') || n.includes('infrastructure') || n.includes('pharma') ||
      n.includes('healthcare') || n.includes('technology') || n.includes('fmcg') ||
      n.includes('mnc') || n.includes('opportunities fund') || n.includes('midcap') ||
      n.includes('smallcap') || n.includes('largecap') || n.includes('large & mid')) return 'Equity'
  if (n.includes('index') || n.includes('etf') || n.includes('nifty') || n.includes('sensex')) return 'Index'
  if (n.includes('fund of fund') || n.includes('fof')) return 'Hybrid'
  if (n.includes('aggressive') || n.includes('conservative')) return 'Hybrid'
  return 'Other'
}

const ASSET_CLASS_HEX = { Equity: '#8b5cf6', Debt: '#60a5fa', Gold: '#fbbf24', Commodities: '#eab308', 'Real Estate': '#f97316', Hybrid: '#818cf8', Cash: '#94a3b8', Other: '#94a3b8' }

const ALLOC_TYPE_COLORS = [
  '#f97316', '#8b5cf6', '#fbbf24', '#f59e0b', '#34d399', '#ec4899', '#60a5fa', '#3b82f6',
  '#06b6d4', '#10b981', '#ef4444', '#a855f7',
]

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #8b5cf6, #6366f1)',
  'linear-gradient(135deg, #ec4899, #f43f5e)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #10b981, #34d399)',
  'linear-gradient(135deg, #ef4444, #dc2626)',
]

const ROLE_COLORS = {
  Self: { bg: 'rgba(139,92,246,0.1)', color: '#a78bfa' },
  Spouse: { bg: 'rgba(236,72,153,0.1)', color: '#ec4899' },
  Father: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
  Mother: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  Child: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
}

// Section header component
function SectionHeader({ label, color, badge, linkText, onClick }) {
  return (
    <div className="-mx-6 -mt-6 px-6 py-3.5 mb-4 flex items-center justify-between rounded-t-xl"
         style={{ background: 'rgba(128,128,128,0.04)', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
      <div className="flex items-center gap-2">
        <span className="w-[3px] h-3.5 rounded-sm opacity-60" style={{ background: color || 'currentColor' }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: color || 'var(--text-muted)' }}>{label}</span>
        {badge != null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: color ? `${color}15` : 'rgba(128,128,128,0.1)', color: color || 'var(--text-muted)' }}>
            {badge}
          </span>
        )}
      </div>
      {linkText && (
        <button onClick={onClick} className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
          {linkText} ›
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { selectedMember, familyMembers } = useFamily()
  const { masked, mv } = useMask()
  const {
    mfPortfolios, mfHoldings,
    stockPortfolios, stockHoldings,
    otherInvList, liabilityList,
    banks, investmentAccounts, insurancePolicies,
    reminderList, goalList,
    assetAllocations,
    activeMembers, activeBanks, activeInvestmentAccounts,
  } = useData()

  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfToast, setPdfToast] = useState(null)
  const dashboardRef = useRef(null)
  const pdfFooterRef = useRef(null)
  const pdfLibsRef = useRef(null)

  // Prefetch PDF libraries on mount — if chunks are stale, reload now (not on click)
  useEffect(() => {
    Promise.all([import('html2canvas-pro'), import('jspdf')])
      .then(([h2cMod, jsPDFMod]) => {
        pdfLibsRef.current = { html2canvas: h2cMod.default, jsPDF: jsPDFMod.jsPDF }
      })
      .catch((err) => {
        if (err.message?.includes('dynamically imported module')) {
          window.location.reload()
        }
      })
  }, [])

  // Get PAN of primary member (Self) for PDF password protection
  const primaryPAN = useMemo(() => {
    const self = (activeMembers || []).find(m => m.relationship === 'Self')
    return self?.pan || ''
  }, [activeMembers])

  // Shared: generate PDF from dashboard and return { pdf, fileName }
  // forEmail: use lower quality (JPEG, reduced scale) to keep payload under GAS API limits
  const generatePDF = useCallback(async ({ forEmail = false } = {}) => {
    if (!dashboardRef.current) throw new Error('Dashboard not ready')
    // Use prefetched libs, or fetch on demand as fallback
    let html2canvas, jsPDF
    if (pdfLibsRef.current) {
      ({ html2canvas, jsPDF } = pdfLibsRef.current)
    } else {
      const [h2cMod, jsPDFMod] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])
      html2canvas = h2cMod.default
      jsPDF = jsPDFMod.jsPDF
    }
    const el = dashboardRef.current

    // Temporarily reveal PDF-only footer for capture
    if (pdfFooterRef.current) pdfFooterRef.current.style.display = 'block'

    // Small delay to ensure images (QR code) are rendered
    await new Promise(r => setTimeout(r, 100))

    const canvas = await html2canvas(el, {
      scale: forEmail ? 1 : 2,
      useCORS: true,
      backgroundColor: '#0f172a',
      logging: false,
    })

    // Hide PDF-only footer again
    if (pdfFooterRef.current) pdfFooterRef.current.style.display = 'none'

    // PDF setup — password-protect with PAN for downloads only (not email — encrypted PDFs break MailApp)
    const pdfOpts = { orientation: 'p', unit: 'mm', format: 'a4' }
    if (primaryPAN && !forEmail) {
      pdfOpts.encryption = {
        userPassword: primaryPAN,
        ownerPassword: primaryPAN,
        userPermissions: ['print', 'copy'],
      }
    }
    const pdf = new jsPDF(pdfOpts)
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 6
    const contentW = pageW - margin * 2
    const contentH = pageH - margin * 2

    // Scale: mm per canvas pixel
    const pxScale = contentW / canvas.width
    // How many canvas pixels fit in one page's content area
    const pagePixelH = Math.floor(contentH / pxScale)

    let yPixel = 0
    let page = 0
    while (yPixel < canvas.height) {
      if (page > 0) pdf.addPage()

      // Fill entire page with dark background to match theme
      pdf.setFillColor(15, 23, 42) // #0f172a
      pdf.rect(0, 0, pageW, pageH, 'F')

      // Crop this page's slice from the full canvas
      const sliceH = Math.min(pagePixelH, canvas.height - yPixel)
      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceH
      const ctx = pageCanvas.getContext('2d')
      ctx.drawImage(canvas, 0, yPixel, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

      const sliceImg = forEmail
        ? pageCanvas.toDataURL('image/jpeg', 0.65)
        : pageCanvas.toDataURL('image/png')
      const sliceMM = sliceH * pxScale
      pdf.addImage(sliceImg, forEmail ? 'JPEG' : 'PNG', margin, margin, contentW, sliceMM)

      yPixel += pagePixelH
      page++
    }

    const memberLabel = selectedMember === 'all' ? 'Family' : (familyMembers?.find(m => m.memberId === selectedMember)?.name || 'Dashboard')
    const date = new Date().toISOString().slice(0, 10)
    const fileName = `Capital-Friends-${memberLabel}-${date}.pdf`
    return { pdf, fileName }
  }, [selectedMember, familyMembers, primaryPAN])

  const handlePDFExport = useCallback(async () => {
    if (pdfExporting) return
    setPdfExporting(true)
    // Show password hint immediately before generating
    const panHint = primaryPAN ? `${primaryPAN.slice(0, 2)}****${primaryPAN.slice(-2)}` : ''
    if (primaryPAN) {
      setPdfToast({ status: 'generating', panHint })
    }
    try {
      const { pdf, fileName } = await generatePDF()
      pdf.save(fileName)
      // Update toast to confirm download
      if (primaryPAN) {
        setPdfToast({ status: 'done', panHint })
        setTimeout(() => setPdfToast(null), 8000)
      }
    } catch (err) {
      console.error('PDF export failed:', err)
      setPdfToast(null)
      window.print()
    } finally {
      setPdfExporting(false)
    }
  }, [pdfExporting, generatePDF, primaryPAN])

  const handleSendEmail = useCallback(async () => {
    if (emailSending || emailSent) return
    setEmailSending(true)
    try {
      const { pdf, fileName } = await generatePDF({ forEmail: true })
      // Convert to base64 and send via GAS
      const pdfBase64 = pdf.output('datauristring').split(',')[1]
      await api.sendDashboardPDF(pdfBase64, fileName)
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch (err) {
      alert('Failed to send email: ' + err.message)
    } finally {
      setEmailSending(false)
    }
  }, [emailSending, emailSent, generatePDF])

  const pdfTitle = primaryPAN
    ? `Download as PDF (password: your PAN)`
    : 'Download as PDF'

  // ── Filter helper ──
  const filterOwner = (items, ownerKey) =>
    selectedMember === 'all' ? items : items.filter((i) => i[ownerKey] === selectedMember)

  // ── Core data computation ──
  const data = useMemo(() => {
    // MF
    const activeMFPortfolios = filterOwner((mfPortfolios || []).filter((p) => p.status === 'Active'), 'ownerId')
    const mfPortfolioIds = new Set(activeMFPortfolios.map((p) => p.portfolioId))
    const activeMFHoldings = (mfHoldings || []).filter((h) => mfPortfolioIds.has(h.portfolioId) && h.units > 0)
    const mfInvested = activeMFHoldings.reduce((s, h) => s + h.investment, 0)
    const mfCurrentValue = activeMFHoldings.reduce((s, h) => s + h.currentValue, 0)
    const mfPL = mfCurrentValue - mfInvested

    // Stocks
    const activeStockPortfolios = filterOwner((stockPortfolios || []).filter((p) => p.status === 'Active'), 'ownerId')
    const stkPortfolioIds = new Set(activeStockPortfolios.map((p) => p.portfolioId))
    const activeStockHoldings = (stockHoldings || []).filter((h) => stkPortfolioIds.has(h.portfolioId))
    const stkInvested = activeStockHoldings.reduce((s, h) => s + h.totalInvestment, 0)
    const stkCurrentValue = activeStockHoldings.reduce((s, h) => s + h.currentValue, 0)
    const stkPL = stkCurrentValue - stkInvested

    // Other Investments
    const activeOther = filterOwner((otherInvList || []).filter((i) => i.status === 'Active'), 'familyMemberId')
    const otherInvested = activeOther.reduce((s, i) => s + i.investedAmount, 0)
    const otherCurrentValue = activeOther.reduce((s, i) => s + i.currentValue, 0)
    const otherPL = otherCurrentValue - otherInvested

    // Liabilities
    const activeLiabilities = filterOwner((liabilityList || []).filter((l) => l.status === 'Active'), 'familyMemberId')
    const totalLiabilities = activeLiabilities.reduce((s, l) => s + l.outstandingBalance, 0)
    const totalEMI = activeLiabilities.reduce((s, l) => s + l.emiAmount, 0)

    // Insurance
    const activeInsurance = filterOwner((insurancePolicies || []).filter((p) => p.status === 'Active'), 'memberId')
    const lifeCover = activeInsurance.filter((p) => p.policyType === 'Term Life').reduce((s, p) => s + p.sumAssured, 0)
    const healthCover = activeInsurance.filter((p) => p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)
    const totalPremium = activeInsurance.reduce((s, p) => s + (p.premium || 0), 0)

    // Bank accounts
    const filteredBanks = filterOwner((banks || []).filter((b) => b.status === 'Active'), 'memberId')

    // Investment accounts
    const filteredInvAccounts = filterOwner((investmentAccounts || []).filter((a) => a.status === 'Active'), 'memberId')

    // Goals
    const activeGoals = filterOwner((goalList || []).filter((g) => g.isActive !== false), 'familyMemberId')

    // Reminders
    const activeReminders = filterOwner((reminderList || []).filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')

    // Members
    const filteredMembers = selectedMember === 'all'
      ? (activeMembers || [])
      : (activeMembers || []).filter((m) => m.memberId === selectedMember)

    // Totals
    const totalAssets = mfCurrentValue + stkCurrentValue + otherCurrentValue
    const netWorth = totalAssets - totalLiabilities
    const totalInvested = mfInvested + stkInvested + otherInvested
    const totalPL = totalAssets - totalInvested
    const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

    // Asset class breakdown (Equity/Debt/Gold/Hybrid/etc.)
    const allocMap = {}
    if (assetAllocations) {
      for (const a of assetAllocations) {
        if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation
      }
    }

    const assetClasses = { Equity: 0, Debt: 0, Gold: 0, Hybrid: 0, Commodities: 0, 'Real Estate': 0, Cash: 0, Other: 0 }

    activeMFHoldings.forEach((h) => {
      const detailed = allocMap[h.schemeCode || h.fundCode]
      if (detailed) {
        for (const [cls, pct] of Object.entries(detailed)) {
          if (cls in assetClasses) assetClasses[cls] += h.currentValue * (pct / 100)
          else assetClasses.Other += h.currentValue * (pct / 100)
        }
      } else {
        let cat = h.category
        if (!cat || cat === 'Other') cat = inferCategory(h.fundName)
        if (cat === 'Equity' || cat === 'ELSS' || cat === 'Index') assetClasses.Equity += h.currentValue
        else if (cat === 'Debt' || cat === 'Gilt') assetClasses.Debt += h.currentValue
        else if (cat === 'Liquid') assetClasses.Cash += h.currentValue
        else if (cat === 'Commodity') assetClasses.Commodities += h.currentValue
        else if (cat === 'Multi-Asset') {
          assetClasses.Equity += h.currentValue * 0.50
          assetClasses.Debt += h.currentValue * 0.30
          assetClasses.Commodities += h.currentValue * 0.20
        } else if (cat === 'Hybrid' || cat === 'FoF') {
          assetClasses.Equity += h.currentValue * 0.65
          assetClasses.Debt += h.currentValue * 0.35
        } else assetClasses.Other += h.currentValue
      }
    })
    assetClasses.Equity += stkCurrentValue
    activeOther.forEach((inv) => {
      const t = (inv.investmentType || '').toLowerCase()
      if (t.includes('gold') || t.includes('sgb') || t.includes('sovereign gold')) assetClasses.Gold += inv.currentValue
      else if (t.includes('silver') || t.includes('commodity')) assetClasses.Commodities += inv.currentValue
      else if (t.includes('fd') || t.includes('fixed') || t.includes('bond') || t.includes('ppf') || t.includes('epf') || t.includes('nps') || t.includes('rd') || t.includes('nsc') || t.includes('ssy')) assetClasses.Debt += inv.currentValue
      else if (t.includes('real estate') || t.includes('property')) assetClasses['Real Estate'] += inv.currentValue
      else assetClasses.Other += inv.currentValue
    })

    const assetClassList = Object.entries(assetClasses)
      .filter(([, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cls, val]) => ({ name: cls, value: val, pct: totalAssets > 0 ? (val / totalAssets) * 100 : 0, fill: ASSET_CLASS_HEX[cls] || '#94a3b8' }))

    // Asset allocation by investment TYPE (for donut chart)
    const typeMap = {}
    if (mfCurrentValue > 0) typeMap['Mutual Funds'] = (typeMap['Mutual Funds'] || 0) + mfCurrentValue
    if (stkCurrentValue > 0) typeMap['Stocks'] = (typeMap['Stocks'] || 0) + stkCurrentValue
    activeOther.forEach((inv) => {
      const t = inv.investmentType || 'Other'
      typeMap[t] = (typeMap[t] || 0) + inv.currentValue
    })
    const allocByType = Object.entries(typeMap)
      .filter(([, val]) => val > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], idx) => ({ name, value, pct: totalAssets > 0 ? (value / totalAssets) * 100 : 0, fill: ALLOC_TYPE_COLORS[idx % ALLOC_TYPE_COLORS.length] }))

    // Buy opportunities (MF holdings 5%+ below ATH)
    const buyOpportunities = []
    activeMFPortfolios.forEach((p) => {
      const pHoldings = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      pHoldings.forEach((h) => {
        if (h.athNav > 0 && h.belowATHPct >= 5) {
          const { main } = splitFundName(h.fundName)
          buyOpportunities.push({
            fundName: main,
            portfolioName: p.portfolioName,
            ownerName: p.ownerName,
            belowATHPct: h.belowATHPct,
            isStrongBuy: h.belowATHPct >= 10,
          })
        }
      })
    })
    buyOpportunities.sort((a, b) => b.belowATHPct - a.belowATHPct)

    // Rebalance needed (MF holdings with allocation drift beyond threshold)
    const rebalanceItems = []
    activeMFPortfolios.forEach((p) => {
      const pHoldings = (mfHoldings || []).filter((h) => h.portfolioId === p.portfolioId && h.units > 0)
      const pValue = pHoldings.reduce((s, h) => s + h.currentValue, 0)
      const threshold = (p.rebalanceThreshold || 0.05) * 100
      pHoldings.forEach((h) => {
        if (h.targetAllocationPct > 0 && pValue > 0) {
          const currentPct = (h.currentValue / pValue) * 100
          const drift = currentPct - h.targetAllocationPct
          if (Math.abs(drift) > threshold) {
            const { main } = splitFundName(h.fundName)
            rebalanceItems.push({
              fundName: main,
              portfolioName: p.portfolioName,
              ownerName: p.ownerName,
              currentPct: Math.round(currentPct),
              targetPct: Math.round(h.targetAllocationPct),
              drift: Math.round(drift),
            })
          }
        }
      })
    })
    rebalanceItems.sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))

    // Investments table rows (grouped by type)
    const investmentRows = []

    // MF row
    if (mfCurrentValue > 0) {
      const mfOwners = [...new Set(activeMFPortfolios.map((p) => p.ownerName))].join(', ')
      const mfPlatforms = [...new Set(activeMFPortfolios.map((p) => {
        const ia = (investmentAccounts || []).find((a) => a.accountId === p.investmentAccountId)
        return ia ? ia.platformBroker : p.investmentAccountName || ''
      }).filter(Boolean))].join(', ')
      investmentRows.push({ type: 'Mutual Funds', platform: mfPlatforms, owner: mfOwners, invested: mfInvested, current: mfCurrentValue, pl: mfPL })
    }

    // Stocks row
    if (stkCurrentValue > 0) {
      const stkOwners = [...new Set(activeStockPortfolios.map((p) => p.ownerName))].join(', ')
      const stkPlatforms = [...new Set(activeStockPortfolios.map((p) => {
        const ia = (investmentAccounts || []).find((a) => a.accountId === p.investmentAccountId)
        return ia ? ia.platformBroker : p.investmentAccountName || ''
      }).filter(Boolean))].join(', ')
      investmentRows.push({ type: 'Stocks', platform: stkPlatforms, owner: stkOwners, invested: stkInvested, current: stkCurrentValue, pl: stkPL })
    }

    // Other investments (grouped by type)
    const otherByType = {}
    activeOther.forEach((inv) => {
      const t = inv.investmentType || 'Other'
      if (!otherByType[t]) otherByType[t] = { invested: 0, current: 0, owners: new Set(), platforms: new Set() }
      otherByType[t].invested += inv.investedAmount
      otherByType[t].current += inv.currentValue
      otherByType[t].owners.add(inv.familyMemberName)
      // Use investment name as platform placeholder for other investments
      if (inv.investmentName) otherByType[t].platforms.add(inv.investmentName)
    })
    Object.entries(otherByType).forEach(([type, d]) => {
      const pl = d.current - d.invested
      investmentRows.push({
        type,
        platform: d.platforms.size <= 2 ? [...d.platforms].join(', ') : `${d.platforms.size} investments`,
        owner: [...d.owners].join(', '),
        invested: d.invested,
        current: d.current,
        pl: d.invested > 0 ? pl : null,
      })
    })

    // Per-member net worth computation
    const memberNetWorth = {}
    // MF by owner
    activeMFPortfolios.forEach((p) => {
      const ph = activeMFHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const val = ph.reduce((s, h) => s + h.currentValue, 0)
      memberNetWorth[p.ownerId] = (memberNetWorth[p.ownerId] || 0) + val
    })
    // Stocks by owner
    activeStockPortfolios.forEach((p) => {
      const ph = activeStockHoldings.filter((h) => h.portfolioId === p.portfolioId)
      const val = ph.reduce((s, h) => s + h.currentValue, 0)
      memberNetWorth[p.ownerId] = (memberNetWorth[p.ownerId] || 0) + val
    })
    // Other investments by member
    activeOther.forEach((inv) => {
      memberNetWorth[inv.familyMemberId] = (memberNetWorth[inv.familyMemberId] || 0) + inv.currentValue
    })
    // Subtract liabilities
    activeLiabilities.forEach((l) => {
      memberNetWorth[l.familyMemberId] = (memberNetWorth[l.familyMemberId] || 0) - l.outstandingBalance
    })

    return {
      mfCurrentValue, mfInvested, mfPL,
      stkCurrentValue, stkInvested, stkPL,
      otherCurrentValue, otherInvested, otherPL,
      totalLiabilities, totalEMI,
      lifeCover, healthCover, totalPremium,
      totalAssets, totalInvested, totalPL, plPct, netWorth,
      assetClassList, allocByType,
      buyOpportunities, rebalanceItems,
      investmentRows,
      activeLiabilities, activeInsurance, activeGoals, activeReminders,
      filteredBanks, filteredInvAccounts, filteredMembers,
      memberNetWorth,
      activeMFPortfolios, activeStockPortfolios,
    }
  }, [selectedMember, mfPortfolios, mfHoldings, stockPortfolios, stockHoldings, otherInvList, liabilityList, banks, investmentAccounts, insurancePolicies, goalList, reminderList, assetAllocations, activeMembers])

  // ── Action Items (computed from real data) ──
  const actionItems = useMemo(() => {
    const items = []
    const activeInsurance = filterOwner((insurancePolicies || []).filter((p) => p.status === 'Active'), 'memberId')

    // Check term life insurance
    const hasTermLife = activeInsurance.some((p) => p.policyType === 'Term Life')
    if (!hasTermLife) {
      items.push({
        type: 'critical', title: 'No Term Life Insurance',
        description: 'Family loses its sole income source if primary earner passes away. Get 10-15x annual income cover.',
        action: 'Add Policy', navigateTo: '/insurance',
      })
    }

    // Check health insurance
    const healthCover = activeInsurance.filter((p) => p.policyType === 'Health').reduce((s, p) => s + p.sumAssured, 0)
    if (healthCover === 0) {
      items.push({
        type: 'critical', title: 'No Health Insurance',
        description: 'Medical emergencies without cover can wipe out years of savings. Get minimum 10L family cover.',
        action: 'Add Policy', navigateTo: '/insurance',
      })
    } else if (healthCover < 500000) {
      items.push({
        type: 'warning', title: 'Inadequate Health Insurance',
        description: `Current cover ${formatINR(healthCover)} may not cover a single hospital stay. Consider upgrading.`,
        navigateTo: '/insurance',
      })
    }

    // Check emergency fund goals
    const emergencyGoals = filterOwner((goalList || []).filter((g) => g.isActive !== false && g.goalType === 'Emergency Fund'), 'familyMemberId')
    emergencyGoals.forEach((g) => {
      const pct = g.targetAmount > 0 ? (g.currentValue / g.targetAmount) * 100 : 0
      if (pct < 100) {
        const remaining = g.targetAmount - g.currentValue
        items.push({
          type: pct >= 75 ? 'warning' : 'warning',
          title: `Emergency Fund at ${pct.toFixed(0)}%`,
          description: `Job loss or medical emergency forces debt. ${formatINR(remaining)} more needed for full cushion.`,
          action: 'View Goal', navigateTo: '/goals',
        })
      }
    })

    // Overdue reminders
    const activeReminders = filterOwner((reminderList || []).filter((r) => r.isActive !== false), 'familyMemberId')
    activeReminders.filter((r) => new Date(r.dueDate) < new Date()).forEach((r) => {
      const days = Math.ceil((new Date() - new Date(r.dueDate)) / (24 * 60 * 60 * 1000))
      items.push({
        type: 'critical', title: r.title,
        description: `${days} day${days !== 1 ? 's' : ''} overdue. ${r.description || ''}`.trim(),
        navigateTo: '/reminders',
      })
    })

    // Goals needing attention
    const needsAttention = filterOwner((goalList || []).filter((g) => g.isActive !== false && g.status === 'Needs Attention'), 'familyMemberId')
    needsAttention.forEach((g) => {
      items.push({
        type: 'warning', title: `${g.goalName} needs attention`,
        description: `Progress is behind schedule. Consider increasing monthly investment.`,
        action: 'View Goal', navigateTo: '/goals',
      })
    })

    return items.slice(0, 6)
  }, [selectedMember, insurancePolicies, goalList, reminderList])

  // ── Upcoming Reminders (sorted by due date) ──
  const upcomingReminders = useMemo(() => {
    const active = filterOwner((reminderList || []).filter((r) => r.isActive !== false && r.status !== 'Completed'), 'familyMemberId')
    const now = new Date()
    return active
      .map((r) => {
        const diff = new Date(r.dueDate) - now
        const days = Math.ceil(diff / (24 * 60 * 60 * 1000))
        return { ...r, days }
      })
      .filter((r) => r.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 5)
  }, [selectedMember, reminderList])

  if (mfPortfolios === null || mfHoldings === null) return <PageLoading title="Loading dashboard" cards={4} />

  return (
    <>
      {/* PDF password modal overlay — outside dashboardRef so it doesn't appear in PDF */}
      {pdfToast && (
        <div className="fixed inset-0 z-50 flex items-center justify-center print:hidden"
             style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
             onClick={() => pdfToast.status === 'done' && setPdfToast(null)}>
          <div className="w-[340px] rounded-2xl border border-[var(--border)] p-6 shadow-2xl"
               style={{ background: 'var(--bg-card)' }}
               onClick={(e) => e.stopPropagation()}>
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                   style={{
                     background: pdfToast.status === 'done' ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.12)',
                     border: `1px solid ${pdfToast.status === 'done' ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.2)'}`,
                   }}>
                {pdfToast.status === 'done'
                  ? <Check size={28} className="text-emerald-400" />
                  : <Loader2 size={28} className="text-violet-400 animate-spin" />
                }
              </div>
            </div>

            {/* Title */}
            <p className="text-center text-base font-bold text-[var(--text-primary)]">
              {pdfToast.status === 'done' ? 'PDF Downloaded' : 'Generating PDF...'}
            </p>

            {/* Password info */}
            <div className="mt-4 rounded-xl px-4 py-3 text-center"
                 style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <p className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] font-semibold">PDF Password</p>
              <p className="text-lg font-bold text-violet-400 mt-1 tracking-wider">Your PAN</p>
              <p className="text-xs text-[var(--text-dim)] mt-1">{pdfToast.panHint}</p>
            </div>

            {/* Dismiss button */}
            {pdfToast.status === 'done' && (
              <button onClick={() => setPdfToast(null)}
                      className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
                      style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                Got it
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1280px] mx-auto" ref={dashboardRef}>
        {/* Print styles — fallback for window.print() */}
        <style>{`
          @media print {
            @page { margin: 8mm; size: A4; }
            *, *::before, *::after { color-adjust: exact !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { background: #0f172a !important; color: #e2e8f0 !important; overflow: visible !important; height: auto !important; }
            nav, header, footer, .print\\:hidden, [class*="BottomNav"], [class*="Sidebar"],
            [class*="safe-bottom"] { display: none !important; }
            div, main, section { overflow: visible !important; height: auto !important; max-height: none !important; }
            .flex.flex-col.h-dvh { height: auto !important; overflow: visible !important; display: block !important; }
            main.flex-1 { overflow: visible !important; padding-bottom: 0 !important; }
            .max-w-\\[1280px\\], .max-w-7xl { max-width: 100% !important; padding: 0 !important; margin: 0 auto !important; }
            .grid.grid-cols-1.md\\:grid-cols-2 { display: flex !important; flex-direction: column !important; gap: 8px !important; }
            .grid.grid-cols-1.md\\:grid-cols-2 > * { width: 100% !important; }
            .grid.grid-cols-1.md\\:grid-cols-3 { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
            .grid.grid-cols-1.md\\:grid-cols-3 > * { flex: 1 1 30% !important; min-width: 180px !important; }
            .rounded-xl { break-inside: avoid; page-break-inside: avoid; }
            [class*="fixed"] { position: static !important; display: none !important; }
          }
        `}</style>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ═══ NET WORTH ═══ */}
        <div className="md:col-span-2 rounded-xl border border-[var(--border)] p-7"
             style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card) 100%)' }}>
          <div className="-mx-7 -mt-7 px-7 py-3.5 mb-4 flex items-center justify-between rounded-t-xl"
               style={{ background: 'rgba(128,128,128,0.04)', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
            <div className="flex items-center gap-2">
              <span className="w-[3px] h-3.5 rounded-sm opacity-60" style={{ background: 'var(--text-muted)' }} />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Net Worth</span>
            </div>
            <div className="flex items-center gap-1.5 print:hidden">
              <button onClick={handlePDFExport} disabled={pdfExporting}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
                      title={pdfTitle}>
                {pdfExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span className="hidden sm:inline">{pdfExporting ? 'Exporting...' : 'PDF'}</span>
              </button>
              <button onClick={handleSendEmail} disabled={emailSending}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      style={{ color: emailSent ? '#34d399' : 'var(--text-secondary)' }}
                      title="Email wealth report">
                {emailSent ? <Check size={13} /> : <Mail size={13} />}
                <span className="hidden sm:inline">{emailSending ? 'Sending...' : emailSent ? 'Sent!' : 'Email'}</span>
              </button>
            </div>
          </div>


          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[34px] font-bold text-[var(--text-primary)] tabular-nums leading-tight">
                {formatINR(data.netWorth)}
              </div>
              {data.totalInvested > 0 && (
                <div className="text-sm mt-1.5">
                  <span className={`font-semibold ${plColor(data.totalPL)}`}>
                    {plPrefix(data.totalPL)}{formatINR(Math.abs(data.totalPL))}
                  </span>
                  <span className="text-[var(--text-dim)] ml-1">
                    ({plPrefix(data.totalPL)}{data.plPct.toFixed(1)}% returns)
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--text-dim)]">Total Assets</div>
              <div className="text-lg font-semibold text-[var(--text-secondary)] tabular-nums">{formatINR(data.totalAssets)}</div>
              {data.totalLiabilities > 0 && (
                <>
                  <div className="text-xs text-[var(--text-dim)] mt-2">Liabilities</div>
                  <div className="text-lg font-semibold text-red-400 tabular-nums">{formatINR(data.totalLiabilities)}</div>
                </>
              )}
            </div>
          </div>

          {/* Asset class composition bar */}
          {data.assetClassList.length > 0 && (
            <div className="mt-4">
              <div className="flex h-2.5 rounded-[5px] overflow-hidden gap-0.5">
                {data.assetClassList.map((ac) => (
                  <div key={ac.name} style={{ width: `${ac.pct}%`, background: ac.fill }} title={`${ac.name} ${ac.pct.toFixed(0)}%`} />
                ))}
              </div>
              <div className="flex gap-4 mt-2 text-xs flex-wrap">
                {data.assetClassList.map((ac) => (
                  <span key={ac.name} className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: ac.fill }} />
                    <span className="text-[var(--text-secondary)] font-medium">{ac.name} {ac.pct.toFixed(0)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══ ASSET ALLOCATION ═══ */}
        {data.allocByType.length > 0 && (
          <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6" style={{ padding: '20px' }}>
            <SectionHeader label="Asset Allocation" color="var(--text-muted)" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              {/* Donut chart */}
              <div className="flex flex-col items-center justify-center">
                <div className="relative w-[240px] h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.allocByType} dataKey="value" nameKey="name" cx="50%" cy="50%"
                           innerRadius={67} outerRadius={110} paddingAngle={2} stroke="none">
                        {data.allocByType.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null
                          const d = payload[0].payload
                          return (
                            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 shadow-lg text-xs">
                              <span className="font-semibold text-[var(--text-primary)]">{d.name}</span>
                              <span className="text-[var(--text-muted)] ml-1.5">{formatINR(d.value)} ({d.pct.toFixed(0)}%)</span>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Net Worth</div>
                    <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{formatINR(data.netWorth)}</div>
                  </div>
                </div>
                {/* Summary cards below donut */}
                <div className="w-full max-w-[280px] mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(139,92,246,0.08)' }}>
                    <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Assets</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{formatINR(data.totalAssets)}</p>
                    {data.totalInvested > 0 && (
                      <p className="text-[10px] tabular-nums mt-0.5" style={{ color: data.totalPL >= 0 ? '#34d399' : '#f87171' }}>
                        {data.totalPL >= 0 ? '+' : ''}{formatINR(data.totalPL)} P&L
                      </p>
                    )}
                  </div>
                  {data.totalLiabilities > 0 ? (
                    <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(244,63,94,0.08)' }}>
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Liabilities</p>
                      <p className="text-sm font-bold text-rose-400 tabular-nums mt-0.5">{formatINR(data.totalLiabilities)}</p>
                      <p className="text-[10px] text-[var(--text-dim)] mt-0.5">
                        {data.activeLiabilities.length} {data.activeLiabilities.length === 1 ? 'Loan' : 'Loans'}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg px-3 py-2.5 text-center" style={{ backgroundColor: 'rgba(16,185,129,0.08)' }}>
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Invested</p>
                      <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums mt-0.5">{formatINR(data.totalInvested)}</p>
                      {data.totalInvested > 0 && (
                        <p className="text-[10px] tabular-nums mt-0.5" style={{ color: data.totalPL >= 0 ? '#34d399' : '#f87171' }}>
                          {data.plPct >= 0 ? '+' : ''}{data.plPct.toFixed(1)}% returns
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Breakdown rows */}
              <div>
                {data.allocByType.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2.5 px-3.5 mb-1.5 rounded-lg text-[13px]"
                       style={{ background: 'rgba(128,128,128,0.05)' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: item.fill }} />
                      <span className="text-[var(--text-secondary)] font-medium">{item.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--text-secondary)] font-semibold tabular-nums">{formatINR(item.value)}</span>
                      <span className="inline-flex items-center justify-center min-w-[36px] px-2 py-0.5 rounded-[5px] text-xs font-semibold tabular-nums"
                            style={{ background: 'rgba(128,128,128,0.08)', color: item.fill }}>
                        {item.pct.toFixed(0)}%
                      </span>
                    </span>
                  </div>
                ))}
                {/* Loans row */}
                {data.totalLiabilities > 0 && (
                  <div className="flex items-center justify-between py-2.5 px-3.5 mb-1.5 rounded-lg text-[13px]"
                       style={{ background: 'rgba(248,113,113,0.06)' }}>
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-red-400 font-medium">
                        {data.activeLiabilities.length} {data.activeLiabilities.length === 1 ? 'Loan' : 'Loans'}
                      </span>
                    </span>
                    <span className="text-red-400 font-semibold tabular-nums">&minus;{formatINR(data.totalLiabilities)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACTION REQUIRED ═══ */}
        {actionItems.length > 0 && (
          <div className="md:col-span-2 rounded-xl border bg-[var(--bg-card)] p-6"
               style={{ borderColor: 'rgba(244,63,94,0.12)' }}>
            <SectionHeader label="Action Required" color="#fb7185" badge={actionItems.length} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {actionItems.map((item, idx) => {
                const isCritical = item.type === 'critical'
                const isLastOdd = actionItems.length % 2 === 1 && idx === actionItems.length - 1
                return (
                  <div key={idx}
                       className={`rounded-[10px] p-3.5 ${isLastOdd ? 'md:col-span-2' : ''}`}
                       style={{
                         background: isCritical ? 'rgba(244,63,94,0.07)' : 'rgba(251,191,36,0.05)',
                         border: `1px solid ${isCritical ? 'rgba(244,63,94,0.18)' : 'rgba(251,191,36,0.12)'}`,
                       }}>
                    <div className="flex items-start gap-2">
                      <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center text-[13px] shrink-0"
                           style={{
                             background: isCritical ? 'rgba(244,63,94,0.12)' : 'rgba(251,191,36,0.1)',
                             color: isCritical ? '#fb7185' : '#fbbf24',
                           }}>
                        {isCritical ? '\u2717' : '\u26A0'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold" style={{ color: isCritical ? '#fb7185' : '#fbbf24' }}>
                          {item.title}
                        </div>
                        {item.description && (
                          <div className="text-[13px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
                            {item.description}
                          </div>
                        )}
                        {item.action && item.navigateTo && (
                          <button onClick={() => navigate(item.navigateTo)}
                                  className="text-xs font-medium mt-1.5 cursor-pointer"
                                  style={{ color: isCritical ? '#fb7185' : '#fbbf24' }}>
                            {item.action} ›
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ BUY OPPORTUNITIES (left) ═══ */}
        {data.buyOpportunities.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${data.rebalanceItems.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/investments/mutual-funds')}>
            <SectionHeader label="Buy Opportunities" color="#34d399" badge={data.buyOpportunities.length}
                           linkText="Mutual Funds" onClick={(e) => { e.stopPropagation(); navigate('/investments/mutual-funds') }} />
            <div className="text-xs text-[var(--text-dim)] mb-2.5">Funds trading below All-Time High</div>

            {data.buyOpportunities.map((opp, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5"
                   style={{ borderBottom: idx < data.buyOpportunities.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                <div className="min-w-0">
                  <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{opp.fundName}</div>
                  <div className="text-xs text-[var(--text-dim)] mt-1.5">{opp.ownerName}'s {opp.portfolioName}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                        style={{
                          background: opp.isStrongBuy ? 'rgba(34,211,238,0.12)' : 'rgba(251,191,36,0.10)',
                          color: opp.isStrongBuy ? '#22d3ee' : '#fbbf24',
                        }}>
                    {opp.isStrongBuy ? 'Strong Buy' : 'Buy'}
                  </span>
                  <div className="text-xs mt-0.5 font-medium tabular-nums"
                       style={{ color: opp.isStrongBuy ? '#22d3ee' : '#fbbf24' }}>
                    &#9660; {opp.belowATHPct.toFixed(1)}% below ATH
                  </div>
                </div>
              </div>
            ))}

            {/* Disclaimer */}
            <div className="mt-3.5 py-3 px-3.5 rounded-r-md text-[11px] text-[var(--text-muted)] leading-relaxed"
                 style={{ background: 'rgba(251,191,36,0.06)', borderLeft: '3px solid rgba(251,191,36,0.3)' }}
                 onClick={(e) => e.stopPropagation()}>
              <span className="text-amber-400 font-semibold">Note:</span> A fund significantly below ATH may indicate market correction <em>or</em> fund-specific issues (poor management, regulatory action, etc.). Always research before investing.
            </div>
          </div>
        )}

        {/* ═══ REBALANCE NEEDED (right) ═══ */}
        {data.rebalanceItems.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${data.buyOpportunities.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/investments/mutual-funds')}>
            <SectionHeader label="Rebalance Needed" color="#a78bfa" badge={data.rebalanceItems.length}
                           linkText="Portfolios" onClick={(e) => { e.stopPropagation(); navigate('/investments/mutual-funds') }} />
            <div className="text-xs text-[var(--text-dim)] mb-2.5">Allocation drifted beyond threshold</div>

            {data.rebalanceItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-2.5"
                   style={{ borderBottom: idx < data.rebalanceItems.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                <div className="min-w-0">
                  <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{item.fundName}</div>
                  <div className="text-xs text-[var(--text-dim)] mt-1.5">{item.ownerName}'s {item.portfolioName}</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-xs text-violet-400 font-semibold tabular-nums">
                    {item.currentPct}% → {item.targetPct}%
                  </div>
                  <div className="text-xs text-[var(--text-dim)] tabular-nums">
                    {item.drift > 0 ? '+' : ''}{item.drift}% {item.drift > 0 ? 'over' : 'under'} target
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══ INVESTMENTS TABLE ═══ */}
        {data.investmentRows.length > 0 && (
          <div className="md:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors"
               onClick={() => navigate('/investments/mutual-funds')}>
            <SectionHeader label="Investments" color="var(--text-muted)"
                           linkText="View All" onClick={(e) => { e.stopPropagation(); navigate('/investments/mutual-funds') }} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                        style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Type</th>
                    <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                        style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Platform</th>
                    <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                        style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Owner</th>
                    <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                        style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Invested</th>
                    <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                        style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Current</th>
                    <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-right pb-2"
                        style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {data.investmentRows.map((row, idx) => {
                    const plVal = row.pl
                    const plPctVal = row.invested > 0 && plVal != null ? (plVal / row.invested) * 100 : null
                    return (
                      <tr key={idx}>
                        <td className="text-[13px] font-medium text-[var(--text-primary)] py-3.5"
                            style={{ borderBottom: idx < data.investmentRows.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {row.type}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] py-3.5"
                            style={{ borderBottom: idx < data.investmentRows.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {row.platform || '\u2014'}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] py-3.5"
                            style={{ borderBottom: idx < data.investmentRows.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {row.owner}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] py-3.5 tabular-nums"
                            style={{ borderBottom: idx < data.investmentRows.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {row.invested > 0 ? formatINR(row.invested) : '\u2014'}
                        </td>
                        <td className="text-[13px] font-semibold text-[var(--text-primary)] py-3.5 tabular-nums"
                            style={{ borderBottom: idx < data.investmentRows.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {formatINR(row.current)}
                        </td>
                        <td className="text-[13px] py-3.5 text-right tabular-nums"
                            style={{ borderBottom: idx < data.investmentRows.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {plVal != null && row.invested > 0 ? (
                            <span className={`font-semibold ${plColor(plVal)}`}>
                              {plPrefix(plVal)}{formatINR(Math.abs(plVal))}
                              {plPctVal != null && (
                                <span className="text-[var(--text-dim)] font-normal ml-1">
                                  ({plPrefix(plVal)}{plPctVal.toFixed(1)}%)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--text-dim)]">&mdash;</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ LIABILITIES (left) ═══ */}
        {data.activeLiabilities.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${upcomingReminders.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/liabilities')}>
            <SectionHeader label="Liabilities" color="#f87171"
                           linkText="View" onClick={(e) => { e.stopPropagation(); navigate('/liabilities') }} />

            <div className="flex items-center justify-between mb-3">
              <div className="text-[22px] font-bold text-red-400 tabular-nums">{formatINR(data.totalLiabilities)}</div>
              {data.totalEMI > 0 && (
                <div className="text-xs text-right">
                  <span className="text-[var(--text-dim)]">Total EMI:</span>{' '}
                  <span className="text-red-400 font-semibold tabular-nums">{formatINR(data.totalEMI)}/m</span>
                </div>
              )}
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Loan</th>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>EMI</th>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-right pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {data.activeLiabilities.map((l, idx) => (
                  <tr key={l.liabilityId || idx}>
                    <td className="py-3.5" style={{ borderBottom: idx < data.activeLiabilities.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                      <div className="text-[13px] font-medium text-[var(--text-primary)]">{l.lenderName} {l.liabilityType}</div>
                      <div className="text-xs text-[var(--text-dim)] mt-1.5">
                        {l.familyMemberName}
                        {l.notes ? ` \u00B7 ${l.notes}` : ''}
                      </div>
                    </td>
                    <td className="text-xs text-[var(--text-secondary)] py-3.5 tabular-nums"
                        style={{ borderBottom: idx < data.activeLiabilities.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                      {l.emiAmount > 0 ? `${formatINR(l.emiAmount)}/m` : '\u2014'}
                    </td>
                    <td className="text-sm font-semibold text-red-400 py-3.5 text-right tabular-nums"
                        style={{ borderBottom: idx < data.activeLiabilities.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                      {formatINR(l.outstandingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ UPCOMING REMINDERS (right) ═══ */}
        {upcomingReminders.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${data.activeLiabilities.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/reminders')}>
            <SectionHeader label="Upcoming Reminders" color="var(--text-muted)" badge={upcomingReminders.length}
                           linkText="View All" onClick={(e) => { e.stopPropagation(); navigate('/reminders') }} />

            {upcomingReminders.map((r, idx) => {
              let badgeColor, badgeBg, badgeText
              if (r.days === 0) {
                badgeColor = '#fbbf24'; badgeBg = 'rgba(251,191,36,0.1)'; badgeText = 'Today'
              } else if (r.days <= 7) {
                badgeColor = '#60a5fa'; badgeBg = 'transparent'; badgeText = `${r.days} day${r.days !== 1 ? 's' : ''}`
              } else {
                badgeColor = '#94a3b8'; badgeBg = 'transparent'; badgeText = `${r.days} days`
              }

              return (
                <div key={r.reminderId || idx} className="flex items-center justify-between py-2.5"
                     style={{ borderBottom: idx < upcomingReminders.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                  <div className="min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] font-medium truncate">{r.title}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1.5">
                      {r.familyMemberName}
                      {r.frequency ? ` \u00B7 ${r.frequency}` : ''}
                    </div>
                  </div>
                  {r.days === 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold shrink-0"
                          style={{ background: badgeBg, color: badgeColor }}>
                      {badgeText}
                    </span>
                  ) : (
                    <span className="text-xs font-medium shrink-0 tabular-nums" style={{ color: badgeColor }}>
                      {badgeText}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ═══ INSURANCE COVERAGE (left) ═══ */}
        {data.activeInsurance.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${data.activeGoals.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/insurance')}>
            <SectionHeader label="Insurance Coverage" color="var(--text-muted)"
                           linkText="View All" onClick={(e) => { e.stopPropagation(); navigate('/insurance') }} />

            {/* Summary row */}
            <div className="flex gap-3 mb-4 flex-wrap">
              {data.lifeCover > 0 && (
                <div className="flex items-center gap-1 text-[13px]">
                  <span className="text-[var(--text-dim)]">Life:</span>
                  <span className="font-semibold text-cyan-400">{formatINR(data.lifeCover)}</span>
                </div>
              )}
              {data.healthCover > 0 && (
                <div className="flex items-center gap-1 text-[13px]">
                  <span className="text-[var(--text-dim)]">Health:</span>
                  <span className="font-semibold text-emerald-400">{formatINR(data.healthCover)}</span>
                </div>
              )}
              {data.totalPremium > 0 && (
                <div className="flex items-center gap-1 text-[13px]">
                  <span className="text-[var(--text-dim)]">Premium:</span>
                  <span className="font-medium text-[var(--text-muted)]">{formatINR(data.totalPremium)}/yr</span>
                </div>
              )}
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Policy</th>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Nominee</th>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Policy No.</th>
                  <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-right pb-2"
                      style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Cover</th>
                </tr>
              </thead>
              <tbody>
                {data.activeInsurance.map((p, idx) => {
                  const coverColor = p.policyType === 'Term Life' ? '#22d3ee'
                    : p.policyType === 'Health' ? '#34d399'
                    : '#94a3b8'
                  return (
                    <tr key={p.policyId || idx}>
                      <td className="py-3.5" style={{ borderBottom: idx < data.activeInsurance.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">{p.policyName}</div>
                        <div className="text-xs text-[var(--text-dim)] mt-1.5">{p.policyType} &middot; {p.insuredMember}</div>
                      </td>
                      <td className="text-xs text-[var(--text-secondary)] py-3.5"
                          style={{ borderBottom: idx < data.activeInsurance.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                        {p.nominee || '\u2014'}
                      </td>
                      <td className="text-xs text-[var(--text-secondary)] font-medium py-3.5 tabular-nums"
                          style={{ borderBottom: idx < data.activeInsurance.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                        {mv(p.policyNumber, 'policy')}
                      </td>
                      <td className="text-sm font-semibold py-3.5 text-right tabular-nums"
                          style={{ color: coverColor, borderBottom: idx < data.activeInsurance.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                        {formatINR(p.sumAssured)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ═══ GOALS (right) ═══ */}
        {data.activeGoals.length > 0 && (
          <div className={`rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors ${data.activeInsurance.length === 0 ? 'md:col-span-2' : ''}`}
               onClick={() => navigate('/goals')}>
            <SectionHeader label="Financial Goals" color="var(--text-muted)"
                           linkText="View All" onClick={(e) => { e.stopPropagation(); navigate('/goals') }} />

            {data.activeGoals.map((g, idx) => {
              const pct = g.targetAmount > 0 ? Math.min((g.currentValue / g.targetAmount) * 100, 100) : 0
              const year = g.targetDate ? new Date(g.targetDate).getFullYear() : null

              let statusColor, statusText
              if (pct >= 100) {
                statusColor = '#34d399'; statusText = 'Achieved'
              } else if (g.status === 'Needs Attention') {
                statusColor = '#fbbf24'; statusText = 'Needs Attention'
              } else if (g.status === 'On Track') {
                statusColor = '#60a5fa'; statusText = 'On Track'
              } else {
                statusColor = '#a78bfa'; statusText = g.status || 'In Progress'
              }

              return (
                <div key={g.goalId || idx} className={idx < data.activeGoals.length - 1 ? 'mb-4' : ''}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-[var(--text-secondary)]">{g.goalName}</span>
                    <span className="text-[var(--text-muted)] font-medium tabular-nums">
                      {formatINR(g.currentValue)} <span className="text-[var(--text-dim)] font-normal">/ {formatINR(g.targetAmount)}</span>
                    </span>
                  </div>
                  <div className="h-[5px] rounded-[3px] overflow-hidden mt-2" style={{ background: 'var(--bg-inset)' }}>
                    <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: statusColor }} />
                  </div>
                  <div className="flex items-center justify-between text-xs mt-2">
                    <span className="font-medium" style={{ color: statusColor }}>{statusText}</span>
                    <span className="text-[var(--text-dim)] tabular-nums">
                      {pct.toFixed(pct >= 100 ? 0 : 1)}%{year ? ` \u00B7 ${year}` : ''}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ═══ BOTTOM 3 TABLES ═══ */}
        <div className="md:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* FAMILY MEMBERS */}
            {data.filteredMembers.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors"
                   onClick={() => navigate('/family')}>
                <SectionHeader label="Family Members" color="var(--text-muted)"
                               linkText="View" onClick={(e) => { e.stopPropagation(); navigate('/family') }} />
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Member</th>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Role</th>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-right pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Net Worth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.filteredMembers.map((m, idx) => {
                      const nw = data.memberNetWorth[m.memberId] || 0
                      const totalNW = data.netWorth || 1
                      const nwPct = totalNW > 0 ? Math.round((nw / totalNW) * 100) : 0
                      const roleStyle = ROLE_COLORS[m.relationship] || ROLE_COLORS.Child
                      return (
                        <tr key={m.memberId}>
                          <td className="py-3.5" style={{ borderBottom: idx < data.filteredMembers.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                            <div className="flex items-center gap-2">
                              <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                   style={{ background: AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length] }}>
                                {m.memberName?.charAt(0) || '?'}
                              </div>
                              <span className="text-[13px] font-medium text-[var(--text-primary)]">{m.memberName}</span>
                            </div>
                          </td>
                          <td className="py-3.5" style={{ borderBottom: idx < data.filteredMembers.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                                  style={{ background: roleStyle.bg, color: roleStyle.color }}>
                              {m.relationship}
                            </span>
                          </td>
                          <td className="text-[13px] font-semibold text-[var(--text-primary)] py-3.5 text-right tabular-nums"
                              style={{ borderBottom: idx < data.filteredMembers.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                            {formatINR(nw)}
                            {data.filteredMembers.length > 1 && (
                              <span className="text-[var(--text-dim)] font-normal ml-1">({nwPct}%)</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* BANK ACCOUNTS */}
            {data.filteredBanks.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors"
                   onClick={() => navigate('/accounts/bank')}>
                <SectionHeader label="Bank Accounts" color="var(--text-muted)"
                               linkText="View" onClick={(e) => { e.stopPropagation(); navigate('/accounts/bank') }} />
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Account</th>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Owner</th>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-right pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>A/C Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.filteredBanks.map((b, idx) => (
                      <tr key={b.accountId || idx}>
                        <td className="text-[13px] font-medium text-[var(--text-primary)] py-3.5"
                            style={{ borderBottom: idx < data.filteredBanks.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {b.accountName}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] py-3.5"
                            style={{ borderBottom: idx < data.filteredBanks.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {b.memberName}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] font-medium py-3.5 text-right tabular-nums"
                            style={{ borderBottom: idx < data.filteredBanks.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {mv(b.accountNumber, 'account')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* INVESTMENT ACCOUNTS */}
            {data.filteredInvAccounts.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 cursor-pointer hover:border-[var(--border-light)] transition-colors"
                   onClick={() => navigate('/accounts/investment')}>
                <SectionHeader label="Investment Accounts" color="var(--text-muted)"
                               linkText="View" onClick={(e) => { e.stopPropagation(); navigate('/accounts/investment') }} />
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Platform</th>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-left pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Owner</th>
                      <th className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wide text-right pb-2"
                          style={{ borderBottom: '1px solid rgba(128,128,128,0.08)' }}>Client ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.filteredInvAccounts.map((a, idx) => (
                      <tr key={a.accountId || idx}>
                        <td className="text-[13px] font-medium text-[var(--text-primary)] py-3.5"
                            style={{ borderBottom: idx < data.filteredInvAccounts.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {a.platformBroker}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] py-3.5"
                            style={{ borderBottom: idx < data.filteredInvAccounts.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {a.memberName}
                        </td>
                        <td className="text-[13px] text-[var(--text-secondary)] font-medium py-3.5 text-right tabular-nums"
                            style={{ borderBottom: idx < data.filteredInvAccounts.length - 1 ? '1px solid rgba(128,128,128,0.06)' : 'none' }}>
                          {mv(a.accountClientId, 'clientId')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </div>

        {/* ═══ PDF-ONLY FOOTER — hidden on web, revealed during PDF capture ═══ */}
        <div ref={pdfFooterRef} className="md:col-span-2 mt-4 rounded-xl border border-[var(--border)] overflow-hidden"
             style={{ display: 'none', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(16,185,129,0.03) 100%)' }}>
          {/* Brand row */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo-new.png" alt="Capital Friends" className="h-8 w-auto" />
              <div>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '14px' }}>
                  <span className="font-bold text-[var(--text-primary)]">Capital</span>
                  <span className="font-extrabold text-emerald-400">Friends</span>
                </span>
                <p className="text-[10px] text-[var(--text-dim)] -mt-0.5">Family Portfolio Manager</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                 style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <Globe size={13} className="text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">capitalfriends.in</span>
            </div>
          </div>
          {/* Donate section */}
          <div className="border-t border-[var(--border-light)]" />
          <div className="px-6 py-5 text-center"
               style={{ background: 'linear-gradient(180deg, rgba(245,158,11,0.05) 0%, rgba(139,92,246,0.05) 100%)' }}>
            <p className="text-sm font-semibold text-amber-400">
              {'\u2764'} Support the Developer
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Capital Friends is free and always will be. If it helps your family, a small donation means a lot!
            </p>
            <div className="mt-4 inline-block bg-white rounded-xl p-3">
              <img src="/upi-qr-code.png" alt="UPI QR Code" className="w-40 h-40 object-contain" />
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-2">Scan with any UPI app</p>
            <div className="mt-2 inline-block bg-[var(--bg-inset)] rounded-lg px-4 py-2 border border-[var(--border)]">
              <p className="text-[10px] text-[var(--text-dim)]">UPI ID</p>
              <p className="text-sm font-mono font-semibold text-[var(--text-primary)]">jagadeeshmanne.hdfc@kphdfc</p>
            </div>
            <p className="text-[11px] text-[var(--text-dim)] mt-3">
              Built with {'\u2764'} by Jagadeesh Manne
            </p>
          </div>
        </div>

      </div>
      </div>

    </>
  )
}
