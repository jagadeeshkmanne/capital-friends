import { describe, it, expect } from 'vitest'
import { nameFit, matchMemberName } from './nameMatch'

const fam = [
  { memberId: 'J', memberName: 'Jagadeesh Kumar Manne', pan: 'ABCPM1234K' },
  { memberId: 'V', memberName: 'Visali Manne' },
  { memberId: 'S', memberName: 'Sanjith Manne' },
  { memberId: 'R', memberName: 'Rupa Katakam' },
]
const who = (n, pan) => matchMemberName(fam, n, pan)?.memberId || null

describe('name matching', () => {
  it('ignores word order, case and titles', () => {
    expect(who('MANNE JAGADEESH KUMAR')).toBe('J')
    expect(who('Mr. Jagadeesh Kumar Manne')).toBe('J')
    expect(who('SMT VISALI MANNE')).toBe('V')
  })
  it('accepts initials', () => {
    expect(who('J K MANNE')).toBe('J')
    expect(who('MANNE J K')).toBe('J')
    expect(who('V. Manne')).toBe('V')
  })
  it('accepts close spellings and joined words', () => {
    expect(who('JAGDEESH MANNE')).toBe('J')
    expect(who('VISHALI MANNE')).toBe('V')
    expect(who('SANJIT MANNE')).toBe('S')
    expect(who('JAGADEESHKUMAR MANNE')).toBe('J')
  })
  it('a shared surname alone is never a match', () => {
    expect(who('MANNE PRASAD')).toBe(null)
    expect(who('K MANNE')).toBe(null)
    expect(nameFit('Visali Manne', 'Jagadeesh Manne')).toBe(null)
  })
  it('a middle name on one platform only still matches', () => {
    expect(who('RUPA LAKSHMI KATAKAM')).toBe('R')
    expect(who('Rupa K')).toBe('R')
  })
  it('PAN finds a changed surname and breaks ties', () => {
    expect(who('Jagadeesh Kumar Somebody', 'ABCPM1234K')).toBe('J')
    const twins = [{ memberId: 'A', memberName: 'Ravi Kumar' }, { memberId: 'B', memberName: 'Ravi Kumar', pan: 'XYZPK9999Q' }]
    expect(matchMemberName(twins, 'RAVI KUMAR')).toBe(null)
    expect(matchMemberName(twins, 'RAVI KUMAR', 'XYZPK9999Q').memberId).toBe('B')
  })
  it('different people stay different', () => {
    expect(who('Sita Devi')).toBe(null)
    expect(nameFit('Ramesh', 'Suresh')).toBe(null)
    expect(nameFit('Anil Kumar', 'Sunil Kumar')).toBe(null)
  })
})
