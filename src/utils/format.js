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

export function calcAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const d = safeDate(dateOfBirth)
  if (!d) return null
  return new Date().getFullYear() - d.getFullYear()
}

// ── Visit Status (trạng thái xử lý tại phòng khám bác sĩ) ────
export const VISIT_STATUS_LABEL = {
  waiting:    'Chờ khám',
  cls:        'Đi làm CLS',
  cls_result: 'Có kết quả',
  revisit:    'Tái khám',
  done:       'Đã khám xong',
}

export const VISIT_STATUS_COLOR = {
  waiting:    'bg-red-100 text-red-700 border-red-200',
  cls:        'bg-yellow-100 text-yellow-700 border-yellow-200',
  cls_result: 'bg-green-100 text-green-700 border-green-200',
  revisit:    'bg-blue-100 text-blue-700 border-blue-200',
  done:       'bg-gray-100 text-gray-500 border-gray-200',
}

export const VISIT_STATUS_DOT = {
  waiting:    'bg-red-500',
  cls:        'bg-yellow-500',
  cls_result: 'bg-green-500',
  revisit:    'bg-blue-500',
  done:       'bg-gray-400',
}

export function fmtVisitStatus(s) {
  return VISIT_STATUS_LABEL[s] ?? s ?? '—'
}

// ── Số tiền ───────────────────────────────────────────────────
export function fmtCurrency(val) {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  return n.toLocaleString('vi-VN') + ' đ'
}

// ── Disposition (hướng xử trí) ───────────────────────────────
export const DISPOSITION_LABEL = {
  emergency:       'Cấp cứu',
  outpatient:      'Điều trị ngoại trú',
  revisit:         'Hẹn tái khám',
  inpatient_ward:  'Chuyển phòng lưu',
  inpatient:       'Nhập viện',
  transfer_out:    'Chuyển tuyến',
  deceased:        'Tử vong',
  transfer_clinic: 'Chuyển phòng khám',
  leave_ama:       'Bỏ về',
  discharged:      'Khám xong cho về',
  chronic_script:  'Cấp toa bệnh mãn tính',
}

export const PAYMENT_TYPE_LABEL = {
  bhyt:    'BHYT',
  fee:     'Thu phí',
  request: 'Yêu cầu',
  health:  'KSK',
  consume: 'Hao phí',
  under6:  'Trẻ < 6t',
  vaccine: 'Tiêm chủng',
  free:    'Miễn',
  defer:   'Trả sau',
}

export const PAYMENT_TYPE_COLOR = {
  bhyt:    'bg-blue-100 text-blue-700',
  fee:     'bg-purple-100 text-purple-700',
  request: 'bg-indigo-100 text-indigo-700',
  health:  'bg-teal-100 text-teal-700',
  consume: 'bg-gray-100 text-gray-600',
  under6:  'bg-pink-100 text-pink-700',
  vaccine: 'bg-green-100 text-green-700',
  free:    'bg-orange-100 text-orange-700',
  defer:   'bg-yellow-100 text-yellow-700',
}
