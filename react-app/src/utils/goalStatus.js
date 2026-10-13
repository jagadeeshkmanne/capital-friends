// One place for what a goal card says about a goal: badge, gap, time left — so the goal list, the goal card and
// the goal page never disagree (e.g. a retired goal "₹2 Cr short" on one screen and "Covered" on another).
import { formatINR } from '../data/familyData'

const L = (v) => formatINR(Math.round(v || 0))
const MONTH_MS = 30.44 * 86400000

/** Whole months since the goal's date (0 when the date is still ahead). */
export function monthsPast(goal, now = new Date()) {
  const t = new Date(goal?.targetDate).getTime()
  return Number.isFinite(t) && t < now.getTime() ? Math.floor((now.getTime() - t) / MONTH_MS) : 0
}

/** "3 months ago", "1 yr 2 months ago", "this month" */
export function agoText(months) {
  if (months < 1) return 'this month'
  const y = Math.floor(months / 12), m = months % 12
  return `${y ? `${y} yr${y > 1 ? 's' : ''}${m ? ' ' : ''}` : ''}${m ? `${m} month${m > 1 ? 's' : ''}` : ''} ago`
}

/**
 * @param p a goal plan (buildGoalPlan): { goal, isRet, years, state, has, need, gap, target, sip }
 * @returns { tone: 'ok'|'warn'|'due', badge, gap: [tone, text], gapNote, short, due, retired, overdue, when, needNote }
 */
export function goalStatus(p, now = new Date()) {
  const g = p.goal || {}
  const retired = !!p.isRet && p.years <= 0
  const due = p.state === 'due' && !p.isRet
  const past = monthsPast(g, now)
  const tol = Math.max(1000, 0.02 * (p.target || 0))
  // paid over several years: on the date it needs this year's part + the later parts (p.need), not all of it
  const dueNeed = Number(g.payYears) > 1 && p.need > 0 ? p.need : (p.target || 0)
  const dueShort = due ? Math.max(0, dueNeed - (p.has || 0)) : 0
  const retShort = retired ? Math.max(0, (p.target || 0) - (p.has || 0)) : 0
  let tone = 'ok', badge = 'On track', gap = ['ok', 'On track'], gapNote = 'nothing to add', short = 0
  if (due) {
    if ((p.has || 0) < 1) { tone = 'warn'; badge = 'Date reached · nothing saved'; gap = ['warn', `${L(dueNeed)} short`]; gapNote = 'move the date or the amount'; short = dueNeed }
    else if (dueShort > tol) { tone = 'warn'; badge = `Date reached · ${L(dueShort)} short`; gap = ['warn', `${L(dueShort)} short`]; gapNote = 'use it, or move the date'; short = dueShort }
    else { tone = 'due'; badge = 'Money ready'; gap = ['ok', 'Ready']; gapNote = 'nothing to add' }
  } else if (retired) {
    if (retShort > 1000) { tone = 'warn'; badge = `Retired · ${L(retShort)} short`; gap = ['warn', `${L(retShort)} short`]; gapNote = 'of the goal amount'; short = retShort }
    else { badge = 'Retired · on track' }
  } else if (p.state === 'short') {
    tone = 'warn'; short = -p.gap; badge = `${L(short)} short`; gap = ['warn', badge]; gapNote = 'today'
  } else if (p.state === 'achieved') {
    badge = 'Fully funded 🎉'; gap = ['ok', 'Covered']; gapNote = 'the full amount is set aside'
  } else if (p.state === 'extra' && p.gap > Math.max(10000, 0.05 * (p.target || 0))) { // small surpluses just read "On track"
    badge = `On track · ${L(p.gap)} ahead`; gap = ['ok', `${L(p.gap)} ahead`]; gapNote = 'more than needed today'
  }
  const when = retired ? (past >= 12 ? `retired ${Math.floor(past / 12)} yr${past >= 24 ? 's' : ''} ago` : 'retired')
    : due ? `date reached ${agoText(past)}`
    : p.years < 1 ? `${Math.max(1, Math.round(p.years * 12))} months left` : `${Math.round(p.years * 2) / 2} years left`
  const ef = g.goalType === 'Emergency Fund'
  const needNote = due ? 'the goal amount' : ef ? 'all of it, today' : (p.sip || 0) > 0 ? `with your SIP ${L(p.sip)}/mo` : 'no SIP running'
  return { tone, badge, gap, gapNote, short, due, retired, overdue: due && past >= 1 ? past : 0, when, needNote }
}

export const GOAL_ICON = {
  Retirement: '🌴', 'Emergency Fund': '🛟', 'Child Education': '🎓', Education: '🎓', 'Home Purchase': '🏠', Home: '🏠', 'House Purchase': '🏠',
  Car: '🚗', Vehicle: '🚗', Travel: '✈️', Wedding: '💍', Marriage: '💍', Custom: '🎯',
}
export const goalIcon = (g) => GOAL_ICON[g?.goalType] || '🎯'
