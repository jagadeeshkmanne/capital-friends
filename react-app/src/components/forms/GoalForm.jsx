import { useState, useMemo, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Target, DollarSign, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react'
import { FormField, FormInput, FormDateInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

const GOAL_TYPES = [
  'Retirement', 'Emergency Fund', 'Child Education', 'Home Purchase',
  'Car', 'Travel', 'Wedding', 'Custom',
].map((t) => ({ value: t, label: t }))

// Glide path: recommended equity % by years to goal
const GLIDE_PATH = [
  { maxYears: 1,  equity: 10, label: 'Short-term' },
  { maxYears: 3,  equity: 30, label: 'Short-term' },
  { maxYears: 5,  equity: 50, label: 'Medium-term' },
  { maxYears: 7,  equity: 65, label: 'Medium-term' },
  { maxYears: 10, equity: 75, label: 'Long-term' },
  { maxYears: Infinity, equity: 85, label: 'Long-term' },
]

function getRecommendedAllocation(goalType, yearsLeft) {
  if (goalType === 'Emergency Fund') return { equity: 0, debt: 100, label: 'Safety' }
  const step = GLIDE_PATH.find(s => yearsLeft <= s.maxYears)
  return { equity: step.equity, debt: 100 - step.equity, label: step.label }
}

const PRIORITIES = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
]

// Default inflation & CAGR per goal type (India-specific)
const TYPE_DEFAULTS = {
  'Retirement':      { inflation: 6,  cagr: 12 },
  'Emergency Fund':  { inflation: 0,  cagr: 7  },
  'Child Education': { inflation: 10, cagr: 12 },
  'Home Purchase':   { inflation: 8,  cagr: 12 },
  'Wedding':         { inflation: 6,  cagr: 12 },
  'Car':             { inflation: 5,  cagr: 10 },
  'Travel':          { inflation: 6,  cagr: 10 },
  'Custom':          { inflation: 6,  cagr: 12 },
}

const STEPS = [
  { label: 'Basics', icon: Target },
  { label: 'Financials', icon: DollarSign },
  { label: 'Review', icon: CheckCircle2 },
]

// Safe Withdrawal Rate based on post-retirement duration (assumes life expectancy 85)
const LIFE_EXPECTANCY = 85
function getSWR(retirementAge) {
  const postRet = Math.max(5, LIFE_EXPECTANCY - (retirementAge || 60))
  if (postRet >= 40) return { rate: 0.030, pct: '3.0', multiplier: 33, label: 'Very early retirement' }
  if (postRet >= 35) return { rate: 0.033, pct: '3.3', multiplier: 30, label: 'Early retirement' }
  if (postRet >= 25) return { rate: 0.040, pct: '4.0', multiplier: 25, label: 'Standard (Trinity study)' }
  if (postRet >= 18) return { rate: 0.050, pct: '5.0', multiplier: 20, label: 'Late retirement' }
  return { rate: 0.060, pct: '6.0', multiplier: 17, label: 'Very late retirement' }
}

// Extract DOB from member dynamicFields (checks common key names)
const DOB_KEYS = ['dob', 'date of birth', 'dateofbirth', 'birthday', 'birth date', 'date_of_birth']
function getMemberDOB(member) {
  if (!member?.dynamicFields) return null
  const key = Object.keys(member.dynamicFields).find(k => DOB_KEYS.includes(k.toLowerCase().trim()))
  if (!key) return null
  const d = new Date(member.dynamicFields[key])
  return isNaN(d.getTime()) ? null : d
}

export default function GoalForm({ initial, onSave, onDelete, onCancel, linkingContent }) {
  const isEdit = !!initial
  const { activeMembers } = useData()
  const memberOptions = (activeMembers || []).map((m) => ({
    value: m.memberId,
    label: m.relationship ? `${m.memberName} (${m.relationship})` : m.memberName,
  }))

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => {
    if (isEdit) {
      const inflation = (initial.expectedInflation || 0.06) * 100
      const cagr = (initial.expectedCAGR || 0.12) * 100

      // Use stored initialCost if available; fall back to reverse-calculating from inflated target
      let todaysCost = initial.initialCost || 0
      if (!todaysCost) {
        const yearsToGo = initial.targetDate
          ? Math.max(0, (new Date(initial.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000))
          : 0
        const inflationRate = inflation / 100
        todaysCost = initial.targetAmount || 0
        if (inflationRate > 0 && yearsToGo > 0 && initial.goalType !== 'Emergency Fund') {
          todaysCost = initial.targetAmount / Math.pow(1 + inflationRate, yearsToGo)
        }
      }

      // Look up memberId from familyMemberName (backend only stores the name, not the ID)
      const matchedMember = activeMembers.find((m) => m.memberName === initial.familyMemberName)

      // Back-calculate retirement age from targetDate + member DOB (retirementAge is not stored in GAS)
      let storedRetirementAge = ''
      if (initial.goalType === 'Retirement' && initial.targetDate) {
        const dob = getMemberDOB(matchedMember)
        if (dob) {
          const calculatedAge = Math.round((new Date(initial.targetDate) - dob) / (365.25 * 24 * 60 * 60 * 1000))
          if (calculatedAge > 0) storedRetirementAge = calculatedAge.toString()
        }
      }
      let editCurrentAge = ''
      if (storedRetirementAge && initial.targetDate) {
        const yearsLeft = Math.round((new Date(initial.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000))
        editCurrentAge = Math.max(0, Number(storedRetirementAge) - yearsLeft).toString()
      }

      return {
        goalType: initial.goalType || '',
        goalName: initial.goalName || '',
        familyMemberId: matchedMember?.memberId || '',
        todaysCost: Math.round(todaysCost).toString(),
        targetDate: initial.targetDate || '',
        lumpsum: (initial.lumpsumInvested || 0).toString(),
        monthlySIP: (initial.monthlyInvestment || 0).toString(),
        inflation: inflation.toString(),
        cagr: cagr.toString(),
        priority: initial.priority || 'Medium',
        notes: initial.notes || '',
        // Retirement / Emergency specific
        monthlyExpenses: (initial.monthlyExpenses || '').toString(),
        emergencyMonths: (initial.emergencyMonths || 6).toString(),
        // Retirement age
        retirementAge: storedRetirementAge.toString(),
        currentAge: editCurrentAge,
      }
    }

    return {
      goalType: '',
      goalName: '',
      familyMemberId: '',
      todaysCost: '',
      targetDate: '',
      lumpsum: '',
      monthlySIP: '',
      inflation: '6',
      cagr: '12',
      priority: 'Medium',
      notes: '',
      monthlyExpenses: '',
      emergencyMonths: '6',
      retirementAge: '60',
      currentAge: '',
    }
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  // Auto-set inflation & CAGR when goal type changes (only for new goals)
  useEffect(() => {
    if (isEdit || !form.goalType) return
    const defaults = TYPE_DEFAULTS[form.goalType] || TYPE_DEFAULTS['Custom']
    setForm((f) => ({
      ...f,
      inflation: defaults.inflation.toString(),
      cagr: defaults.cagr.toString(),
    }))
  }, [form.goalType, isEdit])

  const isRetirement = form.goalType === 'Retirement'
  const isEmergency = form.goalType === 'Emergency Fund'

  // Retirement: derive member DOB + age for auto date calculation
  const selectedMember = isRetirement
    ? (activeMembers || []).find(m => m.memberId === form.familyMemberId)
    : null
  const memberDOB = selectedMember ? getMemberDOB(selectedMember) : null
  const memberCurrentAge = memberDOB
    ? Math.floor((Date.now() - memberDOB.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  // Auto-set targetDate for Retirement when age inputs or member change
  useEffect(() => {
    if (!isRetirement) return
    const retAge = Number(form.retirementAge)
    if (!retAge || retAge <= 0) return

    if (memberDOB) {
      // Preferred: calculate from DOB
      const curAge = Math.floor((Date.now() - memberDOB.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      if (retAge <= curAge) {
        // Retire now — set target date to today
        setForm(f => ({ ...f, targetDate: new Date().toISOString().split('T')[0] }))
        return
      }
      const d = new Date(memberDOB)
      d.setFullYear(d.getFullYear() + retAge)
      setForm(f => ({ ...f, targetDate: d.toISOString().split('T')[0] }))
    } else {
      // Fallback: calculate from current age input
      const curAge = Number(form.currentAge)
      if (!curAge || curAge <= 0) return
      if (retAge <= curAge) {
        setForm(f => ({ ...f, targetDate: new Date().toISOString().split('T')[0] }))
        return
      }
      const years = retAge - curAge
      const d = new Date()
      d.setFullYear(d.getFullYear() + years)
      setForm(f => ({ ...f, targetDate: d.toISOString().split('T')[0] }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.retirementAge, form.currentAge, form.familyMemberId, isRetirement])

  // ── Calculations ──
  const calc = useMemo(() => {
    const inflationRate = (Number(form.inflation) || 0) / 100
    const cagrRate = (Number(form.cagr) || 0) / 100
    const monthlyRate = cagrRate / 12
    const lumpsum = Number(form.lumpsum) || 0
    const monthlyExp = Number(form.monthlyExpenses) || 0
    const emoMonths = Number(form.emergencyMonths) || 6

    // Years to goal
    const yearsToGo = form.targetDate
      ? Math.max(0, (new Date(form.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000))
      : 0
    const months = Math.round(yearsToGo * 12)

    // Calculate inflated target based on goal type
    let todaysCost = 0
    let inflatedTarget = 0

    if (isRetirement) {
      const retAge = Number(form.retirementAge) || 60
      const swr = getSWR(retAge)
      const annualExp = monthlyExp * 12
      todaysCost = annualExp / swr.rate   // e.g. 25x for 4% SWR, 33x for 3% SWR
      inflatedTarget = todaysCost * Math.pow(1 + inflationRate, yearsToGo)
    } else if (isEmergency) {
      todaysCost = monthlyExp * emoMonths
      inflatedTarget = todaysCost
    } else {
      todaysCost = Number(form.todaysCost) || 0
      inflatedTarget = inflationRate > 0 && yearsToGo > 0
        ? todaysCost * Math.pow(1 + inflationRate, yearsToGo)
        : todaysCost
    }

    inflatedTarget = Math.round(inflatedTarget)

    // FV of lumpsum investment
    const fvLumpsum = lumpsum > 0 && months > 0
      ? lumpsum * Math.pow(1 + monthlyRate, months)
      : lumpsum

    // Required SIP to reach target (after accounting for lumpsum growth)
    let requiredSIP = 0
    if (inflatedTarget > 0 && months > 0) {
      const remaining = inflatedTarget - fvLumpsum
      if (remaining > 0 && monthlyRate > 0) {
        requiredSIP = remaining / ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      } else if (remaining > 0) {
        requiredSIP = remaining / months
      }
      requiredSIP = Math.max(0, Math.ceil(requiredSIP))
    }

    // Projection: what happens if you follow the required SIP
    const fvRequiredSIP = requiredSIP > 0 && monthlyRate > 0 && months > 0
      ? requiredSIP * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : requiredSIP * months
    const planTotalInvested = Math.round(lumpsum + requiredSIP * months)
    const planReturns = Math.round(inflatedTarget - planTotalInvested)
    const lumpsumCoversGoal = lumpsum > 0 && fvLumpsum >= inflatedTarget

    // Lumpsum-only path: total lumpsum today that reaches the target (no SIP)
    // If months = 0 (retire now), need the full corpus now
    const totalRequiredLumpsum = inflatedTarget > 0
      ? (months > 0 ? Math.round(inflatedTarget / Math.pow(1 + monthlyRate, months)) : inflatedTarget)
      : 0
    // Net of what user already plans to invest as lumpsum
    const requiredLumpsum = Math.max(0, totalRequiredLumpsum - lumpsum)

    const retAge = isRetirement ? (Number(form.retirementAge) || 60) : null
    const swr = isRetirement ? getSWR(retAge) : null
    const postRetYears = isRetirement ? Math.max(5, LIFE_EXPECTANCY - retAge) : null

    return {
      todaysCost, inflatedTarget, yearsToGo, months,
      fvLumpsum: Math.round(fvLumpsum),
      requiredSIP, fvRequiredSIP: Math.round(fvRequiredSIP),
      planTotalInvested, planReturns, lumpsumCoversGoal, requiredLumpsum,
      hasTarget: inflatedTarget > 0,
      swr, postRetYears,
    }
  }, [form.todaysCost, form.targetDate, form.lumpsum,
      form.inflation, form.cagr, form.monthlyExpenses, form.emergencyMonths,
      form.retirementAge, isRetirement, isEmergency])

  // ── Validation ──
  function validateStep(s) {
    const e = {}
    if (s === 0) {
      if (!form.goalType) e.goalType = 'Required'
      if (!form.goalName.trim()) e.goalName = 'Required'
    }
    if (s === 1) {
      if (!form.targetDate) e.targetDate = 'Required'
      if (isRetirement) {
        if (!form.retirementAge || Number(form.retirementAge) <= 0) e.retirementAge = 'Required'
        if (!form.monthlyExpenses || Number(form.monthlyExpenses) <= 0) e.monthlyExpenses = 'Required'
      } else if (isEmergency) {
        if (!form.monthlyExpenses || Number(form.monthlyExpenses) <= 0) e.monthlyExpenses = 'Required'
      } else {
        if (!form.todaysCost || Number(form.todaysCost) <= 0) e.todaysCost = 'Must be > 0'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function validateAll() {
    const e = {}
    if (!form.goalType) e.goalType = 'Required'
    if (!form.goalName.trim()) e.goalName = 'Required'
    if (!form.targetDate) e.targetDate = 'Required'
    if (isRetirement) {
      if (!form.retirementAge || Number(form.retirementAge) <= 0) e.retirementAge = 'Required'
      if (!form.monthlyExpenses || Number(form.monthlyExpenses) <= 0) e.monthlyExpenses = 'Required'
    } else if (isEmergency) {
      if (!form.monthlyExpenses || Number(form.monthlyExpenses) <= 0) e.monthlyExpenses = 'Required'
    } else {
      if (!form.todaysCost || Number(form.todaysCost) <= 0) e.todaysCost = 'Must be > 0'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (!validateStep(step)) return
    setStep((s) => Math.min(s + 1, 2))
  }

  async function handleSubmit() {
    if (!validateAll()) return
    const memberName = form.familyMemberId
      ? activeMembers.find((m) => m.memberId === form.familyMemberId)?.memberName || 'Family'
      : 'Family'
    setSaving(true)
    try {
      await onSave({
        goalType: form.goalType,
        goalName: form.goalName,
        familyMemberId: form.familyMemberId || '',
        familyMember: memberName,
        targetAmount: calc.inflatedTarget,
        targetDate: form.targetDate,
        priority: form.priority,
        notes: form.notes,
        expectedInflation: (Number(form.inflation) || 0) / 100,
        expectedCAGR: (Number(form.cagr) || 0) / 100,
        monthlyInvestment: calc.requiredSIP || 0,
        lumpsumInvested: Number(form.lumpsum) || 0,
        monthlyExpenses: (isRetirement || isEmergency) ? Number(form.monthlyExpenses) || 0 : undefined,
        emergencyMonths: isEmergency ? Number(form.emergencyMonths) || 6 : undefined,
        isRetirement: isRetirement,
        initialCost: (!isRetirement && !isEmergency) ? calc.todaysCost : undefined,
      })
    } finally { setSaving(false) }
  }

  // Computed for review
  const memberName = form.familyMemberId
    ? activeMembers.find((m) => m.memberId === form.familyMemberId)?.memberName || 'Family'
    : 'Family'

  // ── Edit mode: single form ──
  if (isEdit) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Goal Type" required error={errors.goalType}>
            <FormSelect value={form.goalType} onChange={(v) => set('goalType', v)} options={GOAL_TYPES} placeholder="Select type..." />
          </FormField>
          <FormField label="Goal Name" required error={errors.goalName}>
            <FormInput value={form.goalName} onChange={(v) => set('goalName', v)} placeholder="e.g., Retirement Fund (2045)" />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="For" error={errors.familyMemberId}>
            <FormSelect value={form.familyMemberId} onChange={(v) => set('familyMemberId', v)} options={memberOptions} placeholder="Family (Default)" />
          </FormField>
          <FormField label={isRetirement ? 'Target Date (auto-calculated)' : 'Target Date'} required error={errors.targetDate}>
            <FormDateInput value={form.targetDate} onChange={(v) => set('targetDate', v)} maxDate={null} />
          </FormField>
        </div>

        {/* Type-specific fields */}
        {(isRetirement || isEmergency) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isRetirement && (
              <>
                <FormField label="Retire at Age" required error={errors.retirementAge}>
                  <FormInput type="number" value={form.retirementAge} onChange={(v) => set('retirementAge', v)} placeholder="60" />
                </FormField>
                {memberDOB ? (
                  <div className="flex flex-col justify-center px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <p className="text-xs font-semibold text-emerald-400">DOB detected</p>
                    <p className="text-xs text-[var(--text-muted)]">Currently {memberCurrentAge} yrs · {Math.round(calc.yearsToGo)} yrs to retirement</p>
                  </div>
                ) : (
                  <FormField label="Current Age">
                    <FormInput type="number" value={form.currentAge} onChange={(v) => set('currentAge', v)} placeholder="e.g., 35" />
                  </FormField>
                )}
              </>
            )}
            <FormField label="Monthly Expenses" required error={errors.monthlyExpenses}>
              <FormInput type="number" value={form.monthlyExpenses} onChange={(v) => set('monthlyExpenses', v)} placeholder="e.g., 50000" />
            </FormField>
            {isEmergency && (
              <FormField label="Emergency Months">
                <FormInput type="number" value={form.emergencyMonths} onChange={(v) => set('emergencyMonths', v)} placeholder="6" />
              </FormField>
            )}
            {isRetirement && calc.swr && (
              <SWRPanel swr={calc.swr} postRetYears={calc.postRetYears} />
            )}
          </div>
        ) : (
          <FormField label="Today's Cost" required error={errors.todaysCost}>
            <FormInput type="number" value={form.todaysCost} onChange={(v) => set('todaysCost', v)} placeholder="e.g., 1000000" />
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label="Inflation %">
            <FormInput type="number" value={form.inflation} onChange={(v) => set('inflation', v)} placeholder="6" />
          </FormField>
          <FormField label="Expected CAGR %">
            <FormInput type="number" value={form.cagr} onChange={(v) => set('cagr', v)} placeholder="12" />
          </FormField>
          <FormField label="Lumpsum Invested">
            <FormInput type="number" value={form.lumpsum} onChange={(v) => set('lumpsum', v)} placeholder="0" />
          </FormField>
        </div>

        {/* Inflated target info */}
        {calc.hasTarget && (
          <InflatedInfo calc={calc} inflation={form.inflation} isRetirement={isRetirement} isEmergency={isEmergency} />
        )}

        {/* SIP projection + Glide Path (edit mode) */}
        {calc.hasTarget && calc.months > 0 && (
          <ProjectionPanel calc={calc} lumpsum={form.lumpsum} compact />
        )}
        {calc.hasTarget && calc.yearsToGo > 0 && form.goalType && (
          <GlidePathRecommendation goalType={form.goalType} yearsLeft={calc.yearsToGo} />
        )}

        {/* Linking section (passed from GoalsPage) */}
        {linkingContent}

        <FormField label="Priority">
          <FormSelect value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} />
        </FormField>
        <FormField label="Notes">
          <FormTextarea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." rows={2} />
        </FormField>
        {!linkingContent && (
          <div className="flex items-center justify-between">
            {onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
            <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Update Goal" loading={saving} />
          </div>
        )}
      </div>
    )
  }

  // ── Wizard mode: 3 steps ──
  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === step
          const isDone = i < step
          return (
            <div key={s.label} className="flex items-center flex-1">
              <button
                onClick={() => { if (i < step) setStep(i) }}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  isActive ? 'text-violet-400' : isDone ? 'text-emerald-400 cursor-pointer' : 'text-[var(--text-dim)]'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${
                  isActive ? 'border-violet-400 bg-violet-500/15' : isDone ? 'border-emerald-400 bg-emerald-500/15' : 'border-[var(--border)] bg-[var(--bg-inset)]'
                }`}>
                  {isDone ? <CheckCircle2 size={12} /> : <Icon size={12} />}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${isDone ? 'bg-emerald-400/40' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1: Basics */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">Tell us about your financial goal</p>
          <FormField label="Goal Type" required error={errors.goalType}>
            <FormSelect value={form.goalType} onChange={(v) => set('goalType', v)} options={GOAL_TYPES} placeholder="Select type..." />
          </FormField>
          {form.goalType && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--bg-inset)] border border-[var(--border-light)]">
              <TrendingUp size={12} className="text-[var(--text-dim)] shrink-0" />
              <p className="text-xs text-[var(--text-muted)]">
                Default: {TYPE_DEFAULTS[form.goalType]?.inflation || 6}% inflation, {TYPE_DEFAULTS[form.goalType]?.cagr || 12}% CAGR
                {isRetirement && ' · SWR-based corpus calculation'}
                {isEmergency && ' · No inflation applied'}
              </p>
            </div>
          )}
          <FormField label="Goal Name" required error={errors.goalName}>
            <FormInput value={form.goalName} onChange={(v) => set('goalName', v)} placeholder="e.g., Retirement Fund (2045)" />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="For" error={errors.familyMemberId}>
              <FormSelect value={form.familyMemberId} onChange={(v) => set('familyMemberId', v)} options={memberOptions} placeholder="Family (Default)" />
            </FormField>
            <FormField label="Priority">
              <FormSelect value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} />
            </FormField>
          </div>
        </div>
      )}

      {/* Step 2: Financials + Live Calculator */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            {isRetirement ? 'Set your retirement timeline and monthly expenses' :
             isEmergency ? 'Set your emergency fund requirements' :
             'Set your target and investment plan'}
          </p>

          {/* Target Date + Type-specific primary fields */}
          {(isRetirement || isEmergency) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isRetirement ? (
                <>
                  {/* Retire at Age + Current Age (if no DOB) */}
                  <FormField label="Retire at Age" required error={errors.retirementAge}>
                    <FormInput type="number" value={form.retirementAge} onChange={(v) => set('retirementAge', v)} placeholder="60" />
                  </FormField>
                  {memberDOB ? (
                    <div className="flex flex-col justify-center px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                      <p className="text-xs font-semibold text-emerald-400">DOB detected</p>
                      <p className="text-xs text-[var(--text-muted)]">Currently {memberCurrentAge} yrs · Retiring in {Math.round(calc.yearsToGo)} yrs</p>
                    </div>
                  ) : (
                    <FormField label="Current Age" error={errors.currentAge}>
                      <FormInput type="number" value={form.currentAge} onChange={(v) => set('currentAge', v)} placeholder="e.g., 35" />
                    </FormField>
                  )}
                  <FormField label="Target Date (auto-calculated)" error={errors.targetDate}>
                    <FormDateInput value={form.targetDate} onChange={(v) => set('targetDate', v)} maxDate={null} />
                  </FormField>
                  <FormField label="Monthly Expenses (Today)" required error={errors.monthlyExpenses}>
                    <FormInput type="number" value={form.monthlyExpenses} onChange={(v) => set('monthlyExpenses', v)} placeholder="e.g., 50000" />
                  </FormField>
                  {calc.swr && (
                    <SWRPanel swr={calc.swr} postRetYears={calc.postRetYears} />
                  )}
                </>
              ) : (
                <>
                  <FormField label="Target Date" required error={errors.targetDate}>
                    <FormDateInput value={form.targetDate} onChange={(v) => set('targetDate', v)} maxDate={null} />
                  </FormField>
                  <FormField label="Monthly Expenses (Today)" required error={errors.monthlyExpenses}>
                    <FormInput type="number" value={form.monthlyExpenses} onChange={(v) => set('monthlyExpenses', v)} placeholder="e.g., 50000" />
                  </FormField>
                  <FormField label="Emergency Fund (Months)">
                    <FormInput type="number" value={form.emergencyMonths} onChange={(v) => set('emergencyMonths', v)} placeholder="6" />
                  </FormField>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Target Date" required error={errors.targetDate}>
                <FormDateInput value={form.targetDate} onChange={(v) => set('targetDate', v)} maxDate={null} />
              </FormField>
              <FormField label="Today's Cost" required error={errors.todaysCost}>
                <FormInput type="number" value={form.todaysCost} onChange={(v) => set('todaysCost', v)} placeholder="e.g., 1000000" />
              </FormField>
            </div>
          )}

          {/* Inflation & CAGR */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={`Inflation Rate (%)${isEmergency ? ' — N/A' : ''}`}>
              <FormInput type="number" value={form.inflation} onChange={(v) => set('inflation', v)} placeholder="6" />
            </FormField>
            <FormField label="Expected Returns (CAGR %)">
              <FormInput type="number" value={form.cagr} onChange={(v) => set('cagr', v)} placeholder="12" />
            </FormField>
          </div>

          {/* Inflated target info */}
          {calc.hasTarget && (
            <InflatedInfo calc={calc} inflation={form.inflation} isRetirement={isRetirement} isEmergency={isEmergency} />
          )}

          {/* Lumpsum investment */}
          <FormField label="Lumpsum You Plan to Invest (Optional)">
            <FormInput type="number" value={form.lumpsum} onChange={(v) => set('lumpsum', v)} placeholder="e.g., 500000" />
          </FormField>

          {/* Required SIP Panel */}
          {calc.hasTarget && calc.months > 0 && (
            <ProjectionPanel calc={calc} lumpsum={form.lumpsum} />
          )}

          {/* Glide Path Recommendation */}
          {calc.hasTarget && calc.yearsToGo > 0 && form.goalType && (
            <GlidePathRecommendation goalType={form.goalType} yearsLeft={calc.yearsToGo} />
          )}

          <FormField label="Notes">
            <FormTextarea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." rows={2} />
          </FormField>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-muted)]">Review your goal before saving</p>

          <div className="bg-[var(--bg-inset)] rounded-lg border border-[var(--border-light)] p-4 space-y-3">
            <ReviewRow label="Goal" value={form.goalName} bold />
            <ReviewRow label="Type" value={form.goalType} color="violet" />
            <ReviewRow label="Member" value={memberName} />
            <ReviewRow label="Priority" value={form.priority} badge={
              form.priority === 'High' ? 'rose' : form.priority === 'Low' ? 'blue' : 'amber'
            } />

            <div className="border-t border-[var(--border-light)] pt-3 space-y-2">
              {(isRetirement || isEmergency) && (
                <ReviewRow label="Monthly Expenses" value={formatINR(Number(form.monthlyExpenses) || 0)} />
              )}
              {isRetirement && calc.swr && (
                <ReviewRow label="SWR" value={`${calc.swr.pct}% (${calc.swr.multiplier}x · ${calc.postRetYears} yrs)`} color="violet" />
              )}
              {isEmergency && (
                <ReviewRow label="Emergency Months" value={form.emergencyMonths} />
              )}
              {!isRetirement && !isEmergency && (
                <ReviewRow label="Today's Cost" value={formatINR(calc.todaysCost)} />
              )}
              <ReviewRow label="Inflation" value={`${form.inflation}% p.a.`} />
              <ReviewRow label="Expected CAGR" value={`${form.cagr}% p.a.`} />
              <ReviewRow label="Future Value (Inflated)" value={formatINR(calc.inflatedTarget)} bold color="violet" />
            </div>

            <div className="border-t border-[var(--border-light)] pt-3 space-y-2">
              <ReviewRow label="Lumpsum" value={formatINR(Number(form.lumpsum) || 0)} />
              <ReviewRow label="Required SIP" value={`${formatINR(calc.requiredSIP)}/mo`} color="emerald" />
              <ReviewRow label="Target Date" value={form.targetDate} />
              <ReviewRow label="Time Remaining" value={calc.yearsToGo > 0 ? `${calc.yearsToGo.toFixed(1)} years` : '—'} />
            </div>
          </div>

          {/* Projection summary */}
          {calc.hasTarget && calc.months > 0 && (
            <ProjectionPanel calc={calc} lumpsum={form.lumpsum} compact />
          )}

          {/* Glide Path on review */}
          {calc.hasTarget && calc.yearsToGo > 0 && form.goalType && (
            <GlidePathRecommendation goalType={form.goalType} yearsLeft={calc.yearsToGo} />
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-light)]">
        <div>
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-1 px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
              <ChevronLeft size={14} /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            Cancel
          </button>
          {step < 2 ? (
            <button onClick={handleNext} className="flex items-center gap-1 px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors">
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? 'Saving...' : 'Create Goal'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function InflatedInfo({ calc, inflation, isRetirement, isEmergency }) {
  if (isEmergency) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/15">
        <p className="text-xs text-[var(--text-muted)]">
          Emergency Fund: <span className="font-bold text-[var(--text-primary)]">{formatINR(calc.inflatedTarget)}</span>
          <span className="text-[var(--text-dim)]"> (no inflation applied)</span>
        </p>
      </div>
    )
  }

  if (isRetirement && calc.swr) {
    const annualExp = Math.round((calc.todaysCost * calc.swr.rate))
    const monthlyExp = Math.round(annualExp / 12)
    return (
      <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 p-3 space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-400">How we calculated your corpus</p>
        {/* Step 1 */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">
            <span className="text-[var(--text-muted)] font-semibold">Step 1</span> — Annual expenses
            <span className="text-[var(--text-dim)]"> ({formatINR(monthlyExp)}/mo × 12)</span>
          </span>
          <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(annualExp)}</span>
        </div>
        {/* Step 2 */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs text-[var(--text-muted)] font-semibold">Step 2</span>
            <span className="text-xs text-[var(--text-dim)]"> — Divide by {calc.swr.pct}% SWR = corpus today</span>
            <p className="text-xs text-[var(--text-dim)] mt-0.5 leading-snug">
              Retiring at {LIFE_EXPECTANCY - calc.postRetYears}, your money must last ~{calc.postRetYears} years (until age {LIFE_EXPECTANCY}).
              A {calc.swr.pct}% withdrawal rate is safe for this duration ({calc.swr.label}).
            </p>
          </div>
          <span className="text-xs font-bold text-[var(--text-primary)] tabular-nums shrink-0">{formatINR(calc.todaysCost)}</span>
        </div>
        {/* Step 3 */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs text-[var(--text-muted)] font-semibold">Step 3</span>
            <span className="text-xs text-[var(--text-dim)]"> — Inflate by {inflation}% for {calc.yearsToGo.toFixed(0)} yrs</span>
            <p className="text-xs text-[var(--text-dim)] mt-0.5 leading-snug">
              Today's ₹1 lakh will cost ~{formatINR(Math.round(100000 * Math.pow(1 + Number(inflation)/100, calc.yearsToGo)))} at retirement.
            </p>
          </div>
          <span className="text-xs font-bold text-violet-400 tabular-nums shrink-0">{formatINR(calc.inflatedTarget)}</span>
        </div>
        <div className="border-t border-violet-500/15 pt-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-400">Target corpus at retirement</span>
          <span className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(calc.inflatedTarget)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/15">
      <div>
        <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider">Today's Cost</p>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{formatINR(calc.todaysCost)}</p>
      </div>
      <div className="text-center">
        <p className="text-xs text-[var(--text-dim)]">{inflation}% x {calc.yearsToGo.toFixed(1)}yrs</p>
        <ChevronRight size={12} className="text-violet-400 mx-auto" />
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Future Value</p>
        <p className="text-xs font-bold text-[var(--text-primary)]">{formatINR(calc.inflatedTarget)}</p>
      </div>
    </div>
  )
}

function ProjectionPanel({ calc, lumpsum, compact }) {
  const lsNum = Number(lumpsum) || 0

  if (compact) {
    return (
      <div className="rounded-lg border p-3 bg-violet-500/5 border-violet-500/15">
        {calc.lumpsumCoversGoal ? (
          <p className="text-sm font-bold text-emerald-400">Lumpsum alone covers this goal!</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-xs text-violet-400 font-semibold mb-0.5">SIP Required</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(calc.requiredSIP)}<span className="text-xs font-normal">/mo</span></p>
            </div>
            <div className="text-center">
              <p className="text-xs text-amber-400 font-semibold mb-0.5">{lsNum > 0 ? 'Additional Lumpsum' : 'Lumpsum Today'}</p>
              <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(calc.requiredLumpsum)}</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-violet-500/5 border-violet-500/15">

      {/* Two options: SIP vs Lumpsum */}
      {calc.lumpsumCoversGoal ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-400" />
          <p className="text-sm font-bold text-emerald-400">Lumpsum alone covers this goal!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-3 bg-violet-500/10 border border-violet-500/20 text-center">
            <p className="text-xs text-violet-400 font-semibold mb-1">SIP Required</p>
            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(calc.requiredSIP)}<span className="text-xs font-normal text-[var(--text-dim)]">/mo</span></p>
          </div>
          <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-xs text-amber-400 font-semibold mb-1">{lsNum > 0 ? 'Additional Lumpsum' : 'Lumpsum Today'}</p>
            <p className="text-base font-bold text-[var(--text-primary)] tabular-nums">{formatINR(calc.requiredLumpsum)}</p>
          </div>
        </div>
      )}

      {/* Breakdown */}
      {calc.planTotalInvested > 0 && (
        <div className="border-t border-[var(--border-light)] pt-3 space-y-1.5">
          {lsNum > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-dim)]">Lumpsum {formatINR(lsNum)} grows to</span>
              <span className="text-xs font-semibold text-emerald-400 tabular-nums">{formatINR(calc.fvLumpsum)}</span>
            </div>
          )}
          {calc.requiredSIP > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-dim)]">SIP {formatINR(calc.requiredSIP)}/mo × {calc.months} months</span>
              <span className="text-xs font-semibold text-blue-400 tabular-nums">{formatINR(calc.fvRequiredSIP)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-dim)]">Total You Invest</span>
            <span className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(calc.planTotalInvested)}</span>
          </div>
          {calc.planReturns > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-dim)]">Wealth Created</span>
              <span className="text-xs font-semibold text-emerald-400 tabular-nums">+{formatINR(calc.planReturns)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SWR_TIERS = [
  { label: 'Retire ≤45', ageRange: '≤45', postRet: 40, rate: '3.0%', multiplier: '33×', note: 'Very early' },
  { label: 'Retire 46–50', ageRange: '46–50', postRet: 35, rate: '3.3%', multiplier: '30×', note: 'Early' },
  { label: 'Retire 51–60', ageRange: '51–60', postRet: 25, rate: '4.0%', multiplier: '25×', note: 'Standard' },
  { label: 'Retire 61–67', ageRange: '61–67', postRet: 18, rate: '5.0%', multiplier: '20×', note: 'Late' },
  { label: 'Retire 68+', ageRange: '68+', postRet: 0, rate: '6.0%', multiplier: '17×', note: 'Very late' },
]

function SWRPanel({ swr, postRetYears }) {
  return (
    <div className="sm:col-span-2 rounded-lg bg-violet-500/5 border border-violet-500/15 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-violet-400">Why this corpus size?</p>
        <span className="text-xs font-bold text-[var(--text-primary)]">{swr.pct}% SWR · {swr.multiplier}×</span>
      </div>
      <p className="text-xs text-[var(--text-dim)] leading-relaxed">
        Your corpus must last <span className="text-[var(--text-muted)] font-semibold">~{postRetYears} years</span> (retire → age {LIFE_EXPECTANCY}).
        Research shows <span className="text-[var(--text-muted)] font-semibold">{swr.pct}%</span> is a safe annual withdrawal for this duration — so you need <span className="text-[var(--text-muted)] font-semibold">{swr.multiplier}×</span> your annual expenses as corpus today.
        {swr.multiplier !== 25 && <span className="text-violet-400"> (Standard 4% / 25× is only for 25-yr retirements.)</span>}
      </p>

      {/* SWR reference table */}
      <div className="border-t border-violet-500/15 pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1.5">Safe Withdrawal Rate by retirement age</p>
        <div className="space-y-0.5">
          {SWR_TIERS.map((tier) => {
            const isActive = postRetYears >= tier.postRet &&
              postRetYears < (SWR_TIERS[SWR_TIERS.indexOf(tier) - 1]?.postRet ?? Infinity)
            return (
              <div key={tier.ageRange}
                className={`flex items-center justify-between px-2 py-1 rounded text-xs transition-colors ${
                  isActive ? 'bg-violet-500/20 text-[var(--text-primary)]' : 'text-[var(--text-dim)]'
                }`}>
                <span className={isActive ? 'font-semibold' : ''}>{tier.ageRange}</span>
                <span className="flex items-center gap-3">
                  <span className={isActive ? 'text-violet-400 font-bold' : ''}>{tier.rate}</span>
                  <span className={isActive ? 'font-bold' : ''}>{tier.multiplier} annual exp</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-violet-500/30 text-violet-300' : 'bg-[var(--bg-inset)] text-[var(--text-dim)]'}`}>
                    {tier.note}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GlidePathRecommendation({ goalType, yearsLeft }) {
  const rec = getRecommendedAllocation(goalType, yearsLeft)
  const labelColor = rec.label === 'Short-term' ? '#60a5fa'
    : rec.label === 'Medium-term' ? '#fbbf24'
    : rec.label === 'Long-term' ? '#34d399' : '#94a3b8'

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-blue-500/5 border-blue-500/15">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={12} className="text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Suggested Allocation</span>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${labelColor}15`, color: labelColor }}>
          {rec.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--bg-inset)' }}>
          <div className="h-full rounded-l-full" style={{ width: `${rec.equity}%`, background: '#8b5cf6' }} />
          <div className="h-full rounded-r-full" style={{ width: `${rec.debt}%`, background: '#60a5fa' }} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-xs text-[var(--text-dim)]">Equity {rec.equity}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-xs text-[var(--text-dim)]">Debt {rec.debt}%</span>
          </div>
        </div>
        <span className="text-xs text-[var(--text-dim)]">{yearsLeft.toFixed(1)} yrs</span>
      </div>
      <p className="text-xs text-[var(--text-dim)]">
        {rec.label === 'Safety' ? 'Keep in liquid/debt funds for instant access.' :
         rec.label === 'Short-term' ? 'Focus on debt/hybrid funds to preserve capital.' :
         rec.label === 'Medium-term' ? 'Balanced mix — gradually shift to debt as deadline nears.' :
         'Growth-oriented — can take higher equity exposure.'}
      </p>
    </div>
  )
}

function ReviewRow({ label, value, bold, color, badge }) {
  const textClass = color === 'violet' ? 'text-violet-400' :
    color === 'emerald' ? 'text-emerald-400' :
    'text-[var(--text-primary)]'

  if (badge) {
    const badgeClass = badge === 'rose' ? 'bg-rose-500/15 text-rose-400' :
      badge === 'blue' ? 'bg-blue-500/15 text-blue-400' :
      'bg-amber-500/15 text-amber-400'
    return (
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-dim)]">{label}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${badgeClass}`}>{value}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--text-dim)]">{label}</span>
      <span className={`text-xs ${bold ? 'font-bold text-sm' : 'font-semibold'} ${textClass}`}>{value}</span>
    </div>
  )
}
