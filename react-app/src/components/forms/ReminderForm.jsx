import { useState } from 'react'
import { FormField, FormInput, FormSelect, FormTextarea, FormActions, DeleteButton } from '../Modal'
import { useData } from '../../context/DataContext'

const TYPES = [
  'SIP Due Date', 'Insurance Renewal', 'FD Maturity', 'Loan EMI', 'Investment Review', 'Custom',
].map((t) => ({ value: t, label: t }))

const FREQUENCIES = [
  { value: 'One-time', label: 'One-time' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Yearly', label: 'Yearly' },
]

const PRIORITIES = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
]

export default function ReminderForm({ initial, onSave, onDelete, onCancel }) {
  const isEdit = !!initial
  const { activeMembers } = useData()
  const memberOptions = activeMembers.map((m) => ({ value: m.memberId, label: m.memberName }))

  const [form, setForm] = useState({
    reminderType: initial?.reminderType || '',
    title: initial?.title || '',
    description: initial?.description || '',
    familyMemberId: initial?.familyMemberId || '',
    dueDate: initial?.dueDate || '',
    advanceNoticeDays: initial?.advanceNoticeDays?.toString() || '7',
    frequency: initial?.frequency || 'One-time',
    priority: initial?.priority || 'Medium',
    status: initial?.status || 'Pending',
  })
  const [errors, setErrors] = useState({})

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function validate() {
    const e = {}
    if (!form.reminderType) e.reminderType = 'Required'
    if (!form.title.trim()) e.title = 'Required'
    if (!form.familyMemberId) e.familyMemberId = 'Required'
    if (!form.dueDate) e.dueDate = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSave({
      ...form,
      advanceNoticeDays: Number(form.advanceNoticeDays) || 7,
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Reminder Type" required error={errors.reminderType}>
          <FormSelect value={form.reminderType} onChange={(v) => set('reminderType', v)} options={TYPES} placeholder="Select type..." />
        </FormField>
        <FormField label="Title" required error={errors.title}>
          <FormInput value={form.title} onChange={(v) => set('title', v)} placeholder="e.g., HDFC SIP Due" />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Family Member" required error={errors.familyMemberId}>
          <FormSelect value={form.familyMemberId} onChange={(v) => set('familyMemberId', v)} options={memberOptions} placeholder="Select member..." />
        </FormField>
        <FormField label="Due Date" required error={errors.dueDate}>
          <FormInput type="date" value={form.dueDate} onChange={(v) => set('dueDate', v)} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Frequency">
          <FormSelect value={form.frequency} onChange={(v) => set('frequency', v)} options={FREQUENCIES} />
        </FormField>
        <FormField label="Priority">
          <FormSelect value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} />
        </FormField>
        <FormField label="Advance Notice (days)">
          <FormInput type="number" value={form.advanceNoticeDays} onChange={(v) => set('advanceNoticeDays', v)} placeholder="7" />
        </FormField>
      </div>

      {isEdit && (
        <FormField label="Status">
          <FormSelect value={form.status} onChange={(v) => set('status', v)} options={[
            { value: 'Pending', label: 'Pending' },
            { value: 'Completed', label: 'Completed' },
          ]} />
        </FormField>
      )}

      <FormField label="Description">
        <FormTextarea value={form.description} onChange={(v) => set('description', v)} placeholder="Optional details..." rows={2} />
      </FormField>

      <div className="flex items-center justify-between">
        {isEdit && onDelete ? <DeleteButton onClick={onDelete} label="Delete" /> : <div />}
        <FormActions onCancel={onCancel} onSubmit={handleSubmit} submitLabel={isEdit ? 'Update Reminder' : 'Add Reminder'} />
      </div>
    </div>
  )
}
