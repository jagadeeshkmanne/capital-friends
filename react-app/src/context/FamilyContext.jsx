import { createContext, useContext, useState } from 'react'
import { useData } from './DataContext'

const FamilyContext = createContext()

export function FamilyProvider({ children }) {
  const { activeMembers } = useData()
  const [selectedMember, setSelectedMember] = useState('all')

  const member = activeMembers.find((m) => m.memberId === selectedMember) || null

  return (
    <FamilyContext.Provider value={{ selectedMember, setSelectedMember, member, familyMembers: activeMembers }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  return useContext(FamilyContext)
}
