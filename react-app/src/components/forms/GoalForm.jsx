import { useState, useMemo, useEffect } from 'react'
import { ChevronRight, ChevronLeft, Target, DollarSign, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react'
import { FormField, FormInput, FormDateInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'
import { useData } from '../../context/DataContext'
import { formatINR } from '../../data/familyData'

const GOAL_TYPES = [
  'Retirement', 'Emergency Fund', 'Child Education', 'Home Purchase',
  'Car', 'Travel', 'Wedding', 'Custom',
].map((t) => ({ value: t, label: t }))

const PRIORITIES = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
]

const STATUSES = [
  { value: 'On Track', label: 'On Track' },
  { value: 'Needs Attention', label: 'Needs Attention' },
  { value: 'Achieved', label: 'Achieved' },
  { value: 'Paused', label: 'Paused' },
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

export default function GoalForm({ initial, onSave, onDelete, onCancel }) {
  const isEdit = !!initial
  const { activeMembers } = useData()
  const memberOptions = activeMembers.map((m) => ({
    value: m.memberId,
    label: m.relationship ? `${m.memberName} (${m.relationship})` : m.memberName,
  }))

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => {
    if (isEdit) {
      // Reverse-calculate today's cost from inflated target
      const inflation = (initial.expectedInflation || 0.06) * 100
      const cagr = (initial.expectedCAGR || 0.12) * 100
      const yearsToGo = initial.targetDate
        ? Math.max(0, (new Date(initial.targetDate) - new Date()) / (365.25 * 24 * 60 * 60 * 1000))
        : 0
      const inflationRate = inflation / 100
      let todaysCost = initial.targetAmount || 0
      if (inflationRate > 0 && yearsToGo > 0 && initial.goalType !== 'Emergency Fund') {
        todaysCost = initial.targetAmount / Math.pow(1 + inflationRate, yearsToGo)
      }

      return {
        goalType: initial.goalType || '',
        goalName: initial.goalName || '',
        familyMemberId: initial.familyMemberId || '',
        todaysCost: Math.round(todaysCost).toString(),
        targetDate: initial.targetDate || '',
        lumpsum: (initial.lumpsumInvested || 0).toString(),
        monthlySIP: (initial.monthlyInvestment || 0).toString(),
        inflation: inflation.toString(),
        cagr: cagr.toString(),
        priority: initial.priority || 'Medium',
        status: initial.status || 'On Track',
        notes: initial.notes || '',
        // Retirement / Emergency specific
        monthlyExpenses: (initial.monthlyExpenses || '').toString(),
        emergencyMonths: (initial.emergencyMonths || 6).toString(),
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
      status: 'On Track',
      notes: '',
      monthlyExpenses: '',
      emergencyMonths: '6',
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
      const annualExp = monthlyExp * 12
      todaysCost = annualExp * 25
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

    return {
      todaysCost, inflatedTarget, yearsToGo, months,
      fvLumpsum: Math.round(fvLumpsum),
      requiredSIP, fvRequiredSIP: Math.round(fvRequiredSIP),
      planTotalInvested, planReturns, lumpsumCoversGoal,
      hasTarget: inflatedTarget > 0,
    }
  }, [form.todaysCost, form.targetDate, form.lumpsum,
      form.inflation, form.cagr, form.monthlyExpenses, form.emergencyMonths,
      isRetirement, isEmergency])

  // ── Validation ──
  function validateStep(s) {
    const e = {}
    if (s === 0) {
      if (!form.goalType) e.goalType = 'Required'
      if (!form.goalName.trim()) e.goalName = 'Required'
    }
    if (s === 1) {
      if (!form.targetDate) e.targetDate = 'Required'
      if (isRetirement || isEmergency) {
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
    if (isRetirement || isEmergency) {
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
        status: form.status,
        notes: form.notes,
        expectedInflation: (Number(form.inflation) || 0) / 100,
        expectedCAGR: (Number(form.cagr) || 0) / 100,
        monthlyInvestment: calc.requiredSIP || 0,
        lumpsumInvested: Number(form.lumpsum) || 0,
        monthlyExpenses: (isRetirement || isEmergency) ? Number(form.monthlyExpenses) || 0 : undefined,
        emergencyMonths: isEmergency ? Number(form.emergencyMonths) || 6 : undefined,
        isRetirement: isRetirement,
        currentCost: calc.todaysCost,
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
          <FormField label="Target Date" required error={errors.targetDate}>
            <FormDateInput value={form.targetDate} onChange={(v) => set('targetDate', v)} maxDate={null} />
          </FormField>
        </div>

        {/* Type-specific fields */}
        {(isRetirement || isEmergency) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Monthly Expenses" required error={errors.monthlyExpenses}>
              <FormInput type="number" value={form.monthlyExpenses} onChange={(v) => set('monthlyExpenses', v)} placeholder="e.g., 50000" />
            </FormField>
            {isEmergency && (
              <FormField label="Emergency Months">
                <FormInput type="number" value={form.emergencyMonths} onChange={(v) => set('emergencyMonths', v)} placeholder="6" />
              </FormField>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Priority">
            <FormSelect value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} />
          </FormField>
          <FormField label="Status">
            <FormSelect value={form.status} onChange={(v) => set('status', v)} options={STATUSES} />
          </FormField>
        </div>
        <FormField label="Notes">
          <FormTextarea value={form.notes} onChange={(v) => set('notes', v)} placeholder="Optional notes..." rows={2} />
        </FormField>
        <div className="flex items-center justify-between">
          {onDelete ? <DeleteButton onClick={onDelete} /> : <div />}
          <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel="Update Goal" loading={saving} />
        </div>
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
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
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
              <p className="text-[11px] text-[var(--text-muted)]">
                Default: {TYPE_DEFAULTS[form.goalType]?.inflation || 6}% inflation, {TYPE_DEFAULTS[form.goalType]?.cagr || 12}% CAGR
                {isRetirement && ' · Uses 25x annual expenses rule'}
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
              <FormField label="Target Date" required error={errors.targetDate}>
                <FormDateInput value={form.targetDate} onChange={(v) => set('targetDate', v)} maxDate={null} />
              </FormField>
              <FormField label="Monthly Expenses (Today)" required error={errors.monthlyExpenses}>
                <FormInput type="number" value={form.monthlyExpenses} onChange={(v) => set('monthlyExpenses', v)} placeholder="e.g., 50000" />
              </FormField>
              {isEmergency && (
                <FormField label="Emergency Fund (Months)">
                  <FormInput type="number" value={form.emergencyMonths} onChange={(v) => set('emergencyMonths', v)} placeholder="6" />
                </FormField>
              )}
              {isRetirement && (
                <div className="sm:col-span-2">
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Corpus = Monthly Expenses x 12 x 25 = {formatINR(calc.todaysCost)} (today)
                  </p>
                </div>
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

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-violet-500/5 border border-violet-500/15">
      <div>
        <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">
          {isRetirement ? 'Corpus Today' : "Today's Cost"}
        </p>
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{formatINR(calc.todaysCost)}</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-[var(--text-dim)]">{inflation}% x {calc.yearsToGo.toFixed(1)}yrs</p>
        <ChevronRight size={12} className="text-violet-400 mx-auto" />
      </div>
      <div className="text-right">
        <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Future Value</p>
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
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-dim)]">Required Monthly SIP</span>
          <span className="text-sm font-bold text-violet-400 tabular-nums">
            {calc.lumpsumCoversGoal ? '₹0' : formatINR(calc.requiredSIP)}/mo
          </span>
        </div>
        {calc.lumpsumCoversGoal && (
          <p className="text-[10px] text-emerald-400 mt-1">Lumpsum alone covers this goal!</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-violet-500/5 border-violet-500/15">
      {calc.lumpsumCoversGoal ? (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-emerald-400" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Lumpsum Covers Goal</p>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Required Monthly SIP</p>
          <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">{formatINR(calc.requiredSIP)}/mo</p>
        </div>
      )}

      {calc.planTotalInvested > 0 && (
        <div className="border-t border-[var(--border-light)] pt-2 space-y-1">
          {lsNum > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-dim)]">Lumpsum {formatINR(lsNum)} grows to</span>
              <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">{formatINR(calc.fvLumpsum)}</span>
            </div>
          )}
          {calc.requiredSIP > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-dim)]">SIP {formatINR(calc.requiredSIP)}/mo x {calc.months} months</span>
              <span className="text-[11px] font-semibold text-blue-400 tabular-nums">{formatINR(calc.fvRequiredSIP)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-dim)]">Total You Invest</span>
            <span className="text-[11px] font-semibold text-[var(--text-primary)] tabular-nums">{formatINR(calc.planTotalInvested)}</span>
          </div>
          {calc.planReturns > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-dim)]">Wealth Created</span>
              <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">+{formatINR(calc.planReturns)}</span>
            </div>
          )}
        </div>
      )}
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
