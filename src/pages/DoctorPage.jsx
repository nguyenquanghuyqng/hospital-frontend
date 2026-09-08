import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  RefreshCw, LogOut, Search, ArrowRightLeft,
  CheckCircle2, Clock, FlaskConical, Microscope,
  RotateCcw, ChevronRight, Activity, Stethoscope, FileText,
} from 'lucide-react'

import { doctorApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useAuth } from '@/contexts/AuthContext'
import {
  fmtDate, fmtGender, today,
  VISIT_STATUS_COLOR, VISIT_STATUS_DOT, VISIT_STATUS_LABEL, calcAge,
} from '@/utils/format'

import Modal, { ConfirmModal } from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import Spinner from '@/components/ui/Spinner'
import WsStatusDot from '@/components/ui/WsStatusDot'

// ─── Hằng số trạng thái ──────────────────────────────────────────────────────
const STATUS_ACTIONS = [
  { status: 'waiting',    label: 'Chờ khám',   icon: Clock,        bg: 'bg-red-50 border-red-200 text-red-700',        active: 'bg-red-500 border-red-500 text-white' },
  { status: 'cls',        label: 'Làm CLS',     icon: FlaskConical, bg: 'bg-yellow-50 border-yellow-200 text-yellow-700', active: 'bg-yellow-500 border-yellow-500 text-white' },
  { status: 'cls_result', label: 'Có kết quả', icon: Microscope,   bg: 'bg-green-50 border-green-200 text-green-700',  active: 'bg-green-500 border-green-500 text-white' },
  { status: 'revisit',    label: 'Tái khám',    icon: RotateCcw,    bg: 'bg-blue-50 border-blue-200 text-blue-700',    active: 'bg-blue-500 border-blue-500 text-white' },
]

const STATS_CONFIG = [
  { key: 'total',      label: 'Tổng',     cls: 'text-gray-800',   dot: 'bg-gray-400' },
  { key: 'waiting',    label: 'Chờ khám', cls: 'text-red-600',    dot: 'bg-red-500' },
  { key: 'cls',        label: 'CLS',      cls: 'text-yellow-600', dot: 'bg-yellow-500' },
  { key: 'cls_result', label: 'Có KQ',    cls: 'text-green-600',  dot: 'bg-green-500' },
  { key: 'revisit',    label: 'Tái khám', cls: 'text-blue-600',   dot: 'bg-blue-500' },
  { key: 'done',       label: 'Xong',     cls: 'text-gray-400',   dot: 'bg-gray-300' },
]

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginForm() {
  const { login } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setError('') }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) { setError('Vui lòng nhập đầy đủ'); return }
    setLoading(true)
    try { await login(form.username, form.password) }
    catch (err) { setError(err.message || 'Đăng nhập thất bại') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-teal-500 to-teal-700 px-8 pt-10 pb-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur">
            <Stethoscope size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold">Phòng khám bác sĩ</h1>
          <p className="text-teal-100 text-sm mt-1">Hệ thống quản lý bệnh nhân</p>
        </div>

        {/* Form */}
        <div className="px-8 py-8 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Tên đăng nhập</label>
            <input autoFocus className="form-control" placeholder="VD: bsphong1"
              value={form.username} onChange={e => set('username', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Mật khẩu</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={form.password} onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit(e)} />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
          <button onClick={handleSubmit} disabled={loading}
            className="btn btn-primary w-full py-3 text-base mt-2 rounded-xl">
            {loading ? <><Spinner size="sm" /> Đang đăng nhập…</> : 'Đăng nhập'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Transfer modal ───────────────────────────────────────────────────────────
function TransferModal({ open, onClose, reception, onSuccess }) {
  const [targetRoom, setTargetRoom] = useState('')
  const [note, setNote]             = useState('')

  const mutation = useMutation({
    mutationFn: () => doctorApi.transfer(reception.id, { clinic_room: targetRoom, note }),
    onSuccess: () => { toast.success(`Đã chuyển sang ${targetRoom}`); onSuccess?.(); onClose() },
    onError: (err) => toast.error(err.message),
  })
  useEffect(() => { if (!open) { setTargetRoom(''); setNote('') } }, [open])

  return (
    <Modal open={open} onClose={onClose} title="🔀 Chuyển khám" size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Huỷ</button>
          <button className="btn btn-primary" disabled={!targetRoom || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Spinner size="sm" /> : <><ArrowRightLeft size={14} /> Chuyển</>}
          </button>
        </>
      }>
      <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">
          {reception?.patient?.full_name?.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-sm text-gray-900">{reception?.patient?.full_name}</p>
          <p className="text-xs text-gray-500">Số khám #{reception?.visit_number}</p>
        </div>
      </div>
      <div className="space-y-3">
        <FormField label="Phòng khám đích" required>
          <input autoFocus className="form-control" placeholder="VD: Phòng 2"
            value={targetRoom} onChange={e => setTargetRoom(e.target.value)} />
        </FormField>
        <FormField label="Lý do chuyển">
          <input className="form-control" placeholder="Ghi chú (tuỳ chọn)"
            value={note} onChange={e => setNote(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}

// ─── Queue row — compact, action ngay trên dòng ───────────────────────────────
function QueueRow({ item, active, onClick, onStatusChange, onDone, onTransfer, onExamine, isPending }) {
  const p = item.patient
  const birthYear = p?.birth_year ?? (p?.date_of_birth ? new Date(p.date_of_birth).getFullYear() : null)
  const currentAction = STATUS_ACTIONS.find(a => a.status === item.visit_status)

  return (
    <div className={`rounded-2xl border-2 transition-all duration-150 overflow-hidden
                     ${active ? 'border-teal-400 shadow-md shadow-teal-100' : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Dòng chính — click để chọn */}
      <div onClick={onClick} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer bg-white">
        {/* STT badge */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0
                         ${item.priority >= 2 ? 'bg-red-500 text-white'
                           : item.priority === 1 ? 'bg-amber-500 text-white'
                           : 'bg-gray-100 text-gray-700'}`}>
          {item.visit_number ?? '—'}
        </div>

        {/* Tên + năm sinh */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm text-gray-900 truncate">{p?.full_name ?? '—'}</p>
            {birthYear && <span className="text-xs text-gray-400 flex-shrink-0">({birthYear})</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {p?.patient_code && (
              <span className="text-[10px] font-mono text-teal-600 bg-teal-50 px-1 rounded">{p.patient_code}</span>
            )}
            {item.patient_type && (
              <span className={`text-[10px] px-1.5 py-px rounded font-medium
                               ${item.patient_type === 'Mới' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                {item.patient_type}
              </span>
            )}
            {item.subject_name && (
              <span className="text-[10px] text-gray-400">{item.subject_name}</span>
            )}
          </div>
        </div>

        {/* Trạng thái hiện tại */}
        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border flex-shrink-0
                         ${VISIT_STATUS_COLOR[item.visit_status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${VISIT_STATUS_DOT[item.visit_status] ?? 'bg-gray-400'}`} />
          {VISIT_STATUS_LABEL[item.visit_status] ?? item.visit_status}
        </div>

        <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${active ? 'text-teal-500 rotate-90' : 'text-gray-300'}`} />
      </div>

      {/* Panel thao tác nhanh — chỉ hiện khi active */}
      {active && (
        <div className="bg-gray-50 border-t border-gray-100 px-3 py-3 space-y-3">
          {/* Nút chuyển trạng thái — 2 cột, lớn dễ click */}
          <div className="grid grid-cols-2 gap-1.5">
            {STATUS_ACTIONS.map(({ status, label, icon: Icon, bg, active: activeCls }) => {
              const isCurrent = item.visit_status === status
              return (
                <button key={status}
                  onClick={e => { e.stopPropagation(); if (!isCurrent) onStatusChange(status) }}
                  disabled={isCurrent || isPending}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold
                               transition-all duration-100
                               ${isCurrent ? activeCls : bg + ' hover:opacity-80'}`}>
                  <Icon size={13} />
                  {label}
                  {isCurrent && <CheckCircle2 size={12} className="ml-auto opacity-80" />}
                </button>
              )
            })}
          </div>

          {/* Nút hành động chính */}
          <div className="flex gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); onExamine() }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-2
                         bg-teal-600 text-white rounded-xl text-xs font-bold
                         hover:bg-teal-700 transition-all">
              <FileText size={12} /> Phiếu khám
            </button>
            <button
              onClick={e => { e.stopPropagation(); onTransfer() }}
              className="flex items-center justify-center gap-1 px-2.5 py-2
                         border-2 border-gray-200 rounded-xl text-xs font-semibold text-gray-600
                         hover:border-gray-400 hover:bg-white transition-all">
              <ArrowRightLeft size={12} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDone() }}
              disabled={item.visit_status === 'done' || isPending}
              className="flex items-center justify-center gap-1 px-2.5 py-2
                         border-2 border-emerald-300 text-emerald-700 rounded-xl text-xs font-bold
                         hover:bg-emerald-50 disabled:opacity-40 transition-all">
              <CheckCircle2 size={12} />
            </button>
          </div>        </div>
      )}
    </div>
  )
}

// ─── Detail panel — thông tin hành chính đầy đủ khi chọn BN ─────────────────
function PatientDetailPanel({ item }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-4">
        <Activity size={56} strokeWidth={1} />
        <div className="text-center">
          <p className="font-semibold text-gray-400">Chọn bệnh nhân</p>
          <p className="text-sm">Click vào tên bệnh nhân bên trái</p>
        </div>
        <p className="text-xs bg-gray-100 px-3 py-1.5 rounded-full text-gray-400">
          <kbd className="font-mono">F1</kbd> để chọn bệnh nhân đầu tiên
        </p>
      </div>
    )
  }

  const p = item.patient
  const age = p?.date_of_birth
    ? new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()
    : p?.birth_year ? new Date().getFullYear() - p.birth_year : null

  const addressParts = [p?.address_street, p?.address_village, p?.address_ward_name, p?.address_district_name].filter(Boolean)

  return (
    <div className="space-y-4 h-full overflow-y-auto pr-1">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center
                          text-2xl font-black flex-shrink-0 backdrop-blur">
            {p?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{p?.full_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {p?.patient_code && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-mono">{p.patient_code}</span>
              )}
              {age && <span className="text-teal-100 text-sm">{age} tuổi</span>}
              {p?.gender && <span className="text-teal-100 text-sm">· {fmtGender(p.gender)}</span>}
            </div>
          </div>
        </div>

        {/* Visit info strip */}
        <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-teal-200 text-[10px] uppercase tracking-wide">Số khám</p>
            <p className="font-black text-xl">#{item.visit_number ?? '—'}</p>
          </div>
          <div>
            <p className="text-teal-200 text-[10px] uppercase tracking-wide">Giờ vào</p>
            <p className="font-bold text-base">{item.visit_time ?? '—'}</p>
          </div>
          <div>
            <p className="text-teal-200 text-[10px] uppercase tracking-wide">Ưu tiên</p>
            <p className="font-bold text-base">
              {item.priority >= 2 ? '🔴 Khẩn' : item.priority === 1 ? '🟡 Ưu tiên' : '⚪ Thường'}
            </p>
          </div>
        </div>
      </div>

      {/* Thông tin hành chính */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hành chính</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: 'Sinh ngày',   value: p?.date_of_birth ? fmtDate(p.date_of_birth) : (p?.birth_year ?? null) },
            { label: 'Giới tính',   value: fmtGender(p?.gender) },
            { label: 'Dân tộc',     value: p?.ethnicity_name },
            { label: 'Quốc tịch',   value: p?.nationality_name },
            { label: 'Nghề nghiệp', value: p?.occupation },
            { label: 'Điện thoại',  value: p?.phone },
          ].filter(r => r.value && r.value !== '—').map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="font-semibold text-gray-800">{value}</p>
            </div>
          ))}

          {addressParts.length > 0 && (
            <div className="col-span-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Địa chỉ</p>
              <p className="font-semibold text-gray-800">{addressParts.join(', ')}</p>
            </div>
          )}
        </div>
      </div>

      {/* BHYT + đăng ký */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin đăng ký</span>
        </div>
        <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: 'Đối tượng',   value: item.subject_name },
            { label: 'Loại BN',     value: item.patient_type },
            { label: 'Số BHYT',     value: item.insurance_number },
            { label: 'Đối tượng KM', value: item.patient_category },
            { label: 'Hạn thẻ từ',  value: item.insurance_valid_from ? fmtDate(item.insurance_valid_from) : null },
            { label: 'Hạn thẻ đến', value: item.insurance_valid_to   ? fmtDate(item.insurance_valid_to)   : null },
          ].filter(r => r.value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
              <p className="font-semibold text-gray-800">{value}</p>
            </div>
          ))}

          {/* Cờ đặc biệt */}
          <div className="col-span-2 flex flex-wrap gap-1.5 mt-1">
            {item.is_referral      && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">🔀 Chuyển tuyến</span>}
            {item.insurance_5years && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">✓ BHYT &gt;5 năm</span>}
            {item.high_tech_service && <span className="text-[10px] bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">⚡ DVKT cao</span>}
            {item.is_near_poor     && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Cận nghèo</span>}
            {item.is_poor          && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Hộ nghèo</span>}
            {item.is_appointment   && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">📅 Hẹn khám</span>}
          </div>
        </div>
      </div>

      {/* Lý do khám */}
      {item.reason && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">Lý do khám</p>
          <p className="text-sm text-amber-900 font-medium">{item.reason}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// ─── Main — split into guard + workspace to satisfy Rules of Hooks ────────────
// DoctorPage: auth guard only — no hooks after conditional return
export default function DoctorPage() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <LoginForm />
  return <DoctorWorkspace />
}

// DoctorWorkspace: all hooks live here — always rendered when authenticated
function DoctorWorkspace() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [selectedId,   setSelectedId]   = useState(null)
  const [searchNum,    setSearchNum]     = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [confirmDone,  setConfirmDone]  = useState(false)
  // Input state (raw) vs committed state (used for queries)
  const [clinicRoomInput, setClinicRoomInput] = useState(user?.clinic_room ?? '')
  const [clinicRoom,      setClinicRoom]      = useState(user?.clinic_room ?? '')
  const searchRef = useRef(null)

  // Sync phòng từ user profile (e.g. after auth refresh)
  useEffect(() => {
    if (user?.clinic_room) {
      setClinicRoomInput(user.clinic_room)
      setClinicRoom(user.clinic_room)
    }
  }, [user?.clinic_room])

  // Commit clinicRoom on blur / Enter so we don't fire a query on every keystroke
  const commitRoom = () => setClinicRoom(clinicRoomInput.trim())

  // Phím tắt F1 — correct dependency array
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'F1') {
        e.preventDefault()
        setSelectedId(prev => {
          const items = filtered  // captured from outer scope via closure
          return items.length ? items[0].id : prev
        })
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally empty; F1 always picks first visible item

  // WebSocket
  const { status: wsStatus, on } = useWebSocket('reception')
  useEffect(() => {
    const off = on('doctor_queue_update', (data) => {
      if (!clinicRoom || data?.clinic_room === clinicRoom) {
        qc.invalidateQueries({ queryKey: ['doctor-queue'] })
        qc.invalidateQueries({ queryKey: ['doctor-stats'] })
      }
    })
    return () => off()
  }, [on, qc, clinicRoom])

  // Queries
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['doctor-queue', clinicRoom, today()],
    queryFn:  () => doctorApi.queue({ clinic_room: clinicRoom || undefined }),
    enabled:  !!clinicRoom,
    refetchInterval: 20_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['doctor-stats', clinicRoom, today()],
    queryFn:  () => doctorApi.queueStats({ clinic_room: clinicRoom || undefined }),
    enabled:  !!clinicRoom,
    refetchInterval: 20_000,
  })

  // Mutations
  const statusMutation = useMutation({
    mutationFn: ({ id, visit_status }) => doctorApi.updateVisitStatus(id, visit_status),
    onSuccess: (data) => {
      qc.setQueryData(['doctor-queue', clinicRoom, today()], (old = []) =>
        old.map(item => item.id === data.id ? { ...item, visit_status: data.visit_status } : item)
      )
      qc.invalidateQueries({ queryKey: ['doctor-stats'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const doneMutation = useMutation({
    mutationFn: (id) => doctorApi.done(id),
    onSuccess: (data) => {
      toast.success('✅ Đã kết thúc khám')
      qc.setQueryData(['doctor-queue', clinicRoom, today()], (old = []) =>
        old.filter(item => item.id !== data.id)
      )
      qc.invalidateQueries({ queryKey: ['doctor-stats'] })
      setSelectedId(null)
      setConfirmDone(false)
    },
    onError: (err) => { toast.error(err.message); setConfirmDone(false) },
  })

  const filtered = searchNum.trim()
    ? queue.filter(i => String(i.visit_number).includes(searchNum.trim()) ||
                        i.patient?.full_name?.toLowerCase().includes(searchNum.toLowerCase()))
    : queue

  const selectedItem = queue.find(i => i.id === selectedId) ?? null
  const total = stats?.total ?? queue.length

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Doctor info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
              <Stethoscope size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 truncate">{user?.full_name ?? user?.username}</span>
                {total > 0 && (
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-black
                                   flex items-center justify-center flex-shrink-0">{total}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">{clinicRoom || 'Chưa chọn phòng'}</span>
                <WsStatusDot status={wsStatus} />
              </div>
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <input
              className="form-control text-xs w-28 py-1.5"
              placeholder="Phòng khám"
              value={clinicRoomInput}
              onChange={e => setClinicRoomInput(e.target.value)}
              onBlur={commitRoom}
              onKeyDown={e => e.key === 'Enter' && commitRoom()}
            />
            <button className="btn btn-ghost btn-sm p-1.5"
              onClick={() => { qc.invalidateQueries({ queryKey: ['doctor-queue'] }); qc.invalidateQueries({ queryKey: ['doctor-stats'] }) }}
              title="Làm mới">
              <RefreshCw size={14} />
            </button>
            <button className="btn btn-ghost btn-sm p-1.5 text-gray-400" onClick={logout} title="Đăng xuất">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {STATS_CONFIG.map(({ key, label, cls, dot }) => {
            const val = key === 'total' ? total : (stats?.[key] ?? 0)
            return (
              <div key={key} className="flex items-center gap-1 bg-gray-50 border border-gray-100
                                        px-2.5 py-1 rounded-lg">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                <span className={`text-xs font-black tabular-nums ${cls}`}>{val}</span>
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Body: 2 panel ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Queue */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input ref={searchRef}
              className="text-sm flex-1 outline-none bg-transparent placeholder:text-gray-400"
              placeholder="Tìm tên / số khám…"
              value={searchNum} onChange={e => setSearchNum(e.target.value)} />
            {searchNum && (
              <button onClick={() => setSearchNum('')} className="text-gray-300 hover:text-gray-500 text-xs">✕</button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {!clinicRoom ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                <Stethoscope size={36} strokeWidth={1} />
                <p className="text-sm">Nhập tên phòng khám ở trên</p>
              </div>
            ) : isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
                <CheckCircle2 size={36} strokeWidth={1} className="text-teal-300" />
                <p className="text-sm font-medium text-gray-500">
                  {searchNum ? 'Không tìm thấy' : 'Hàng đợi trống'}
                </p>
              </div>
            ) : (
              filtered.map(item => (
                <QueueRow key={item.id} item={item}
                  active={item.id === selectedId}
                  onClick={() => setSelectedId(prev => prev === item.id ? null : item.id)}
                  onStatusChange={(status) => statusMutation.mutate({ id: item.id, visit_status: status })}
                  onDone={() => { setSelectedId(item.id); setConfirmDone(true) }}
                  onTransfer={() => { setSelectedId(item.id); setShowTransfer(true) }}
                  onExamine={() => navigate(`/examination/${item.id}`)}
                  isPending={statusMutation.isPending || doneMutation.isPending}
                />
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
            <span className="text-[10px] text-gray-400">{filtered.length} bệnh nhân</span>
            <span className="text-[10px] text-gray-400">
              <kbd className="bg-gray-100 px-1 py-px rounded text-gray-500 font-mono">F1</kbd> chọn đầu · Enter xác nhận phòng
            </span>
          </div>
        </div>

        {/* RIGHT: Detail */}
        <div className="flex-1 overflow-hidden p-4 bg-gray-50">
          <PatientDetailPanel item={selectedItem} />
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        open={confirmDone}
        onClose={() => setConfirmDone(false)}
        onConfirm={() => doneMutation.mutate(selectedItem?.id)}
        title="Kết thúc khám"
        message={`Xác nhận đã khám xong cho bệnh nhân ${selectedItem?.patient?.full_name}?`}
        loading={doneMutation.isPending}
      />
      <TransferModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        reception={selectedItem}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ['doctor-queue'] })
          setSelectedId(null)
        }}
      />
    </div>
  )
}
