export default function Spinner({ size = 'md', className = '' }) {
  const sz = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-10 h-10 border-4' }[size] ?? 'w-6 h-6 border-2'
  return (
    <span
      className={`inline-block rounded-full border-gray-200 border-t-primary animate-spin ${sz} ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-3 text-gray-500">
      <Spinner size="lg" />
      <span className="text-sm">Đang tải…</span>
    </div>
  )
}
