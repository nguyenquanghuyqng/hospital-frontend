import { STATUS_LABEL } from '@/utils/format'

const CONFIG = {
  WAITING:    { cls: 'bg-amber-50 text-amber-600 ring-amber-200',     dot: 'bg-amber-500',   pulse: true  },
  CALLING:    { cls: 'bg-red-50 text-red-600 ring-red-200',           dot: 'bg-red-500',     pulse: true  },
  SERVING:    { cls: 'bg-emerald-50 text-emerald-600 ring-emerald-200',dot: 'bg-emerald-500', pulse: false },
  DONE:       { cls: 'bg-gray-100 text-gray-500 ring-gray-200',       dot: 'bg-gray-400',    pulse: false },
  SKIPPED:    { cls: 'bg-gray-100 text-gray-400 ring-gray-200',       dot: 'bg-gray-300',    pulse: false },
  PENDING:    { cls: 'bg-amber-50 text-amber-600 ring-amber-200',     dot: 'bg-amber-500',   pulse: false },
  CHECKED_IN: { cls: 'bg-emerald-50 text-emerald-600 ring-emerald-200',dot: 'bg-emerald-500',pulse: false },
  COMPLETED:  { cls: 'bg-gray-100 text-gray-500 ring-gray-200',       dot: 'bg-gray-400',    pulse: false },
  CANCELLED:  { cls: 'bg-gray-100 text-gray-400 ring-gray-200',       dot: 'bg-gray-300',    pulse: false },
}

export default function StatusBadge({ status, showDot = true, className = '' }) {
  const cfg = CONFIG[status] ?? { cls: 'bg-gray-100 text-gray-500 ring-gray-200', dot: 'bg-gray-400', pulse: false }
  const label = STATUS_LABEL[status] ?? status ?? '—'

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full
        text-xs font-semibold tracking-wide ring-1 ring-inset ${cfg.cls} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${
            cfg.pulse ? 'animate-pulse' : ''
          }`}
        />
      )}
      {label}
    </span>
  )
}
