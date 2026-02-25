export default function PageLoading({ title = 'Loading' }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-3">
      <span className="w-7 h-7 border-[2.5px] border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
      <span className="text-sm font-semibold text-[var(--text-primary)]">{title}...</span>
    </div>
  )
}
