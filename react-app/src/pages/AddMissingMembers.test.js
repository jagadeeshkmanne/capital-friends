import { describe, it, expect } from 'vitest'
import { groupHolders } from './AddMissingMembers'

describe('groupHolders (CAS names not in Family)', () => {
  const missing = [
    { holder: 'Jagadeesh Kumar Manne', folios: 10 }, { holder: 'Hanshith Manne', folios: 3 },
    { holder: 'Manne Sanjith', folios: 3 }, { holder: 'MANNE JAGADEESH KUMAR', folios: 2 },
  ]
  const folios = [
    { holder: 'Jagadeesh Kumar Manne', pan: 'ABCDE1234F' }, { holder: 'MANNE JAGADEESH KUMAR', pan: 'ABCDE1234F' },
    { holder: 'Hanshith Manne', pan: 'ABCDE1234F' }, { holder: 'Manne Sanjith', pan: 'ABCDE1234F' },
  ]
  it('same words in another order are one person; kids with the parent PAN stay separate', () => {
    const g = groupHolders(missing, folios)
    expect(g.map((p) => p.name)).toEqual(['Jagadeesh Kumar Manne', 'Hanshith Manne', 'Sanjith Manne'.split(' ').reverse().join(' ')])
    expect(g[0].names).toEqual(['Jagadeesh Kumar Manne', 'MANNE JAGADEESH KUMAR'])
    expect(g[0].folios).toBe(12)
  })
  it('a shorter name with the same PAN joins the full name; with another PAN it does not', () => {
    const m = [{ holder: 'JAGADEESH MANNE', folios: 1 }, { holder: 'Jagadeesh Kumar Manne', folios: 1 }]
    expect(groupHolders(m, [{ holder: 'JAGADEESH MANNE', pan: 'P1' }, { holder: 'Jagadeesh Kumar Manne', pan: 'P1' }])).toHaveLength(1)
    expect(groupHolders(m, [{ holder: 'JAGADEESH MANNE', pan: 'P1' }, { holder: 'Jagadeesh Kumar Manne', pan: 'P2' }])).toHaveLength(2)
  })
  it('all-caps only names get title case', () => {
    expect(groupHolders([{ holder: 'MANNE SANJITH', folios: 1 }], [])[0].name).toBe('Manne Sanjith')
  })
})
