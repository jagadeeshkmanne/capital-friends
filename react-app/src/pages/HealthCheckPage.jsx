import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, CheckCircle, AlertTriangle, XCircle, ArrowRight, Save, Loader2 } from 'lucide-react'
import { useData } from '../context/DataContext'
import * as api from '../services/api'
import * as idb from '../services/idb'

const QUESTIONS = [
  { id: 'healthIns', question: 'Does your family have Health Insurance?', tip: '₹50L to ₹1Cr family floater recommended (considering inflation & future expenses)', category: 'Insurance' },
  { id: 'termLife', question: 'Do you have adequate Term Life Insurance?', tip: 'Recommended: 10-15x annual income', category: 'Insurance' },
  { id: 'emergencyFund', question: 'Do you have an Emergency Fund?', tip: '6-12 months of monthly expenses in liquid assets', category: 'Savings' },
  { id: 'familyAware', question: 'Is your family aware of all investments?', tip: 'Ensure nominees and family know about all assets', category: 'Planning' },
  { id: 'hasWill', question: 'Do you have a Will?', tip: 'Legal document for asset distribution', category: 'Planning' },
  { id: 'nominees', question: 'Have you updated Nominees on all accounts?', tip: 'Bank, demat, insurance, MF — all should have nominees', category: 'Planning' },
  { id: 'goals', question: 'Do you have clearly defined Financial Goals?', tip: 'Retirement, education, home — with target amounts and dates', category: 'Goals' },
]

export default function HealthCheckPage() {
  const navigate = useNavigate()
  const { members, insurancePolicies, goalList, otherInvList, healthCheckCompleted, completeHealthCheck } = useData()
  const activeMembers = members.filter((m) => m.status === 'Active')
  const isFirstTime = healthCheckCompleted === false
  const [saving, setSaving] = useState(false)
  const [loadingPrevious, setLoadingPrevious] = useState(true)
  const [previousAnswers, setPreviousAnswers] = useState(null)

  // Auto-detect answers from existing data
  const autoDetected = useMemo(() => {
    const hints = {}
    const healthPolicies = insurancePolicies.filter((p) => p.policyType === 'Health' && p.status === 'Active')
    hints.healthIns = healthPolicies.length > 0
    const termPolicies = insurancePolicies.filter((p) => p.policyType === 'Term Life' && p.status === 'Active')
    hints.termLife = termPolicies.length > 0
    const emergencyGoals = goalList.filter((g) => g.goalType === 'Emergency Fund' && g.isActive)
    const emergencyInv = otherInvList.filter((i) => i.investmentType === 'FD' || i.investmentType === 'PPF')
    hints.emergencyFund = emergencyGoals.length > 0 || emergencyInv.length > 0
    hints.goals = goalList.filter((g) => g.isActive).length >= 2
    return hints
  }, [insurancePolicies, goalList, otherInvList])

  // Load previous answers: IDB first (instant), then background API refresh
  useEffect(() => {
    let cancelled = false

    async function loadAnswers() {
      // Step 1: Try IndexedDB cache (instant)
      const cached = await idb.get('healthCheckAnswers')
      if (!cancelled && cached) {
        setPreviousAnswers(cached)
        setLoadingPrevious(false)
      }

      // Step 2: Background refresh from API
      try {
        const data = await api.getHealthCheckAnswers()
        if (!cancelled && data) {
          setPreviousAnswers(data)
          idb.put('healthCheckAnswers', data)
        }
      } catch { /* silent */ }

      if (!cancelled) setLoadingPrevious(false)
    }

    loadAnswers()
    return () => { cancelled = true }
  }, [])

  const [answers, setAnswers] = useState(() => {
    const initial = {}
    QUESTIONS.forEach((q) => {
      initial[q.id] = autoDetected[q.id] ? 'yes' : ''
    })
    return initial
  })

  // Once previous answers load, merge them in (overrides auto-detected)
  useEffect(() => {
    if (previousAnswers) {
      setAnswers((prev) => {
        const merged = { ...prev }
        QUESTIONS.forEach((q) => {
          const saved = previousAnswers[q.id]
          if (saved === 'Yes') merged[q.id] = 'yes'
          else if (saved === 'No') merged[q.id] = 'no'
        })
        return merged
      })
    }
  }, [previousAnswers])

  const answeredCount = Object.values(answers).filter((v) => v).length
  const yesCount = Object.values(answers).filter((v) => v === 'yes').length
  const allAnswered = answeredCount === QUESTIONS.length
  const score = answeredCount > 0 ? Math.round((yesCount / QUESTIONS.length) * 100) : 0

  function getScoreColor() {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 50) return 'text-[var(--accent-amber)]'
    return 'text-[var(--accent-rose)]'
  }

  function getScoreLabel() {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Needs Work'
    return 'Critical'
  }

  const recommendations = useMemo(() => {
    const recs = []
    if (answers.healthIns !== 'yes') recs.push({ severity: 'critical', text: 'Get Health Insurance for your family', action: 'Minimum ₹5L cover recommended' })
    if (answers.termLife !== 'yes') recs.push({ severity: 'critical', text: 'Get Term Life Insurance (10-15x annual income)', action: 'Compare plans online' })
    if (answers.emergencyFund !== 'yes') recs.push({ severity: 'warning', text: 'Build an Emergency Fund', action: 'Save 6-12 months expenses in liquid fund/FD' })
    if (answers.familyAware !== 'yes') recs.push({ severity: 'warning', text: 'Share investment details with family', action: 'Create a document with all account info' })
    if (answers.hasWill !== 'yes') recs.push({ severity: 'warning', text: 'Create a legal Will', action: 'Consult a lawyer for Will registration' })
    if (answers.nominees !== 'yes') recs.push({ severity: 'warning', text: 'Update nominees on all accounts', action: 'Check bank, demat, insurance, MF accounts' })
    if (answers.goals !== 'yes') recs.push({ severity: 'info', text: 'Define clear financial goals', action: 'Use the Goal Planner to set targets' })
    return recs
  }, [answers])

  const handleSave = useCallback(async () => {
    if (!allAnswered) return
    setSaving(true)
    try {
      const payload = {}
      QUESTIONS.forEach((q) => {
        payload[q.id] = answers[q.id] === 'yes' ? 'Yes' : 'No'
      })
      payload.score = yesCount
      payload.total = QUESTIONS.length
      await completeHealthCheck(payload)
      navigate('/dashboard')
    } catch (err) {
      console.error('Failed to save health check:', err)
    } finally {
      setSaving(false)
    }
  }, [allAnswered, answers, yesCount, completeHealthCheck, navigate])

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* First-time banner */}
      {isFirstTime && (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <h2 className="text-base font-bold text-violet-400 mb-1">Welcome to Capital Friends!</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Before you start, please complete this quick Financial Health Check. It takes less than a minute and helps you understand where your family stands financially.
          </p>
        </div>
      )}

      {/* Score Card */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} className="text-violet-400" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Financial Health Score</h2>
          </div>
          <span className="text-xs text-[var(--text-dim)]">{answeredCount}/{QUESTIONS.length} answered</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border)" strokeWidth="3" />
              <path d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${score}, 100`} className={getScoreColor()} strokeLinecap="round" />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${getScoreColor()}`}>{score}%</span>
          </div>
          <div>
            <p className={`text-base font-bold ${getScoreColor()}`}>{getScoreLabel()}</p>
            <p className="text-xs text-[var(--text-dim)] mt-0.5">{yesCount} of {QUESTIONS.length} checks passed</p>
            <p className="text-xs text-[var(--text-dim)]">{activeMembers.length} family members tracked</p>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Health Check Questions</h3>
        </div>
        <div className="divide-y divide-[var(--border-light)]">
          {QUESTIONS.map((q, idx) => (
            <div key={q.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-[var(--text-primary)]">
                    <span className="text-[var(--text-dim)] mr-2">{idx + 1}.</span>
                    {q.question}
                  </p>
                  <p className="text-xs text-[var(--text-dim)] mt-0.5 ml-5">{q.tip}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: 'yes' }))}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      answers[q.id] === 'yes'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[var(--bg-inset)] text-[var(--text-dim)] border border-[var(--border)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: 'no' }))}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      answers[q.id] === 'no'
                        ? 'bg-rose-500/20 text-[var(--accent-rose)] border border-rose-500/30'
                        : 'bg-[var(--bg-inset)] text-[var(--text-dim)] border border-[var(--border)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              {autoDetected[q.id] && (
                <p className="text-xs text-violet-400 mt-1 ml-5">
                  Auto-detected from your data
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && allAnswered && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-light)] bg-[var(--bg-inset)]">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Recommendations</h3>
          </div>
          <div className="divide-y divide-[var(--border-light)]">
            {recommendations.map((r, idx) => {
              const icon = r.severity === 'critical' ? <XCircle size={14} className="text-[var(--accent-rose)]" /> :
                r.severity === 'warning' ? <AlertTriangle size={14} className="text-[var(--accent-amber)]" /> :
                  <CheckCircle size={14} className="text-[var(--accent-blue)]" />
              return (
                <div key={idx} className="flex items-start gap-3 px-4 py-3">
                  <span className="shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1">
                    <p className="text-sm text-[var(--text-primary)]">{r.text}</p>
                    <p className="text-xs text-[var(--text-dim)] mt-0.5">{r.action}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
        {!allAnswered && (
          <p className="text-xs text-[var(--accent-amber)] mb-3">
            Please answer all {QUESTIONS.length} questions before saving.
          </p>
        )}
        <button
          onClick={handleSave}
          disabled={!allAnswered || saving}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-colors ${
            allAnswered && !saving
              ? 'bg-violet-600 hover:bg-violet-500 text-white'
              : 'bg-[var(--bg-inset)] text-[var(--text-dim)] cursor-not-allowed'
          }`}
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : isFirstTime ? (
            <>
              Save & Continue to Dashboard
              <ArrowRight size={16} />
            </>
          ) : (
            <>
              <Save size={16} />
              Update Health Check
            </>
          )}
        </button>
      </div>
    </div>
  )
}
