import { format, parseISO, isValid } from 'date-fns'
import { vi } from 'date-fns/locale'

// ── Date / Time ───────────────────────────────────────────────
function safeDate(value) {
  if (!value) return null
  const d = typeof value === 'string' ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

export function fmtDate(value) {
  const d = safeDate(value)
  return d ? format(d, 'dd/MM/yyyy') : '—'
}

export function fmtDateTime(value) {
  const d = safeDate(value)
  return d ? format(d, 'HH:mm dd/MM/yyyy') : '—'
}

export function fmtTime(value) {
  const d = safeDate(value)
  return d ? format(d, 'HH:mm') : '—'
}

export function today() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function fmtDateLong(value) {
  const d = safeDate(value)
  return d
    ? format(d, "EEEE, dd/MM/yyyy", { locale: vi })
    : '—'
}

// ── Labels ────────────────────────────────────────────────────
export const GENDER_LABEL = { male: 'Nam', female: 'Nữ', other: 'Khác' }
export function fmtGender(g) {
  return GENDER_LABEL[g] ?? '—'
}

export const PRIORITY_LABEL = ['Bình thường', 'Ưu tiên', 'Cấp cứu']
export const PRIORITY_COLOR = [
  'text-emerald-600',
  'text-amber-600',
  'text-red-600',
]
export function fmtPriority(p) {
  return PRIORITY_LABEL[+p] ?? '—'
}

export const STATUS_LABEL = {
  WAITING:    'Chờ',
  CALLING:    'Đang gọi',
  SERVING:    'Đang phục vụ',
  DONE:       'Hoàn thành',
  SKIPPED:    'Bỏ qua',
  PENDING:    'Chờ tiếp nhận',
  CHECKED_IN: 'Đã tiếp nhận',
  COMPLETED:  'Hoàn thành',
  CANCELLED:  'Đã huỷ',
}
export function fmtStatus(s) {
  return STATUS_LABEL[s] ?? s ?? '—'
}

// ── Misc ──────────────────────────────────────────────────────
export function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase()
}

export function pad(n, len = 3) {
  return String(n).padStart(len, '0')
}
