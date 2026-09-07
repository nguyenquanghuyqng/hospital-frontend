import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  PhoneCall, ClipboardList, Users, Clock, CheckCircle,
  RefreshCw, Plus, Bell, Table2, ChevronDown, ChevronUp,
  Printer, CreditCard,
} from 'lucide-react'

import { queueApi, receptionApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  today, fmtDate, fmtDateTime, fmtTime, fmtGender,
  fmtPriority, fmtStatus, PRIORITY_COLOR,
} from '@/utils/format'

import StatusBadge from '@/components/ui/StatusBadge'
import Modal, { ConfirmModal } from '@/components/ui/Modal'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import WsStatusDot from '@/components/ui/WsStatusDot'
import Spinner from '@/components/ui/Spinner'
import FormField from '@/components/ui/FormField'
import SearchInput from '@/components/ui/SearchInput'

// ─── Danh mục cố định ────────────────────────────────────────────────────────
const SUBJECT_TYPES = [
  { code: '1', name: 'BHYT' },
  { code: '2', name: 'Dịch vụ' },
  { code: '3', name: 'Miễn phí' },
  { code: '4', name: 'Thu phí' },
]

const SPECIAL_STATUS_OPTIONS = [
  'Không', 'Liệt', 'Tâm thần', 'Ung thư', 'Nhiễm HIV', 'Khác',
]

// ─────────────────────────────────────────────────────────────────────────────
// 1. SCAN CCCD MODAL
// ─────────────────────────────────────────────────────────────────────────────
function ScanCccdModal({ open, onClose, onPatientFound }) {
  const [cccd, setCccd] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data) => receptionApi.scanCccd(data),
    onSuccess: (data) => {
      onPatientFound(data)
      onClose()
      setCccd('')
      setError('')
      toast.success(
        data.is_new_patient
          ? `Đã tạo hồ sơ mới — Mã BN: ${data.patient.patient_code ?? data.patient.id}`
          : `Tìm thấy: ${data.patient.full_name}`
      )
    },
    onError: (err) => setError(err.message),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (!cccd.trim()) { setError('Vui lòng nhập số CCCD'); return }
    mutation.mutate({ cccd: cccd.trim(), full_name: 'Bệnh nhân' })
  }

  // Reset khi modal đóng
  useEffect(() => { if (!open) { setCccd(''); setError('') } }, [open])

  return (
    <Modal open={open} onClose={onClose} title="🪪 Quét / Nhập CCCD" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Nhập số CCCD/CMND để tra cứu hoặc tạo mới hồ sơ bệnh nhân.
        </p>
        <FormField label="Số CCCD / CMND" required error={error}>
          <input
            autoFocus
            className={`form-control ${error ? 'is-error' : ''}`}
            placeholder="VD: 012345678901"
            value={cccd}
            onChange={(e) => { setCccd(e.target.value); setError('') }}
            maxLength={12}
          />
        </FormField>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <><Spinner size="sm" /> Đang tra cứu…</> : 'Tra cứu'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. REGISTER VISIT MODAL — đầy đủ Section I + Section II
// ─────────────────────────────────────────────────────────────────────────────
const INIT_PATIENT = {
  full_name: '', date_of_birth: '', birth_year: '', gender: '',
  cccd: '', cccd_issued_by: '', cccd_issued_date: '',
  occupation: '', ethnicity_code: '', ethnicity_name: '',
  nationality_code: 'VN', nationality_name: 'VIET NAM',
  address_street: '', address_village: '',
  address_ward_code: '', address_ward_name: '',
  address_district_code: '', address_district_name: '',
  address_province_code: '', address_province_name: '',
  workplace: '', phone: '', email: '', policy_type: '',
  contact_name: '', contact_address: '', contact_phone: '', contact_cccd: '',
}

const INIT_VISIT = {
  clinic_room: '', subject_type: '1', subject_name: 'BHYT',
  insurance_number: '', insurance_valid_from: '', insurance_valid_to: '',
  initial_registration: '', referral_note: '', referral_facility: '',
  is_appointment: false, is_online: false, is_referral: false,
  high_tech_service: false, insurance_5years: false, insurance_5years_date: '',
  special_status: 'Không', is_near_poor: false, is_poor: false,
  patient_category: 'Người lớn', patient_type: 'Cũ',
  reason: '', priority: 0, receptionist_name: '', internal_note: '',
}

function SectionHeader({ title, icon }) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 bg-primary-50 rounded-lg mb-3">
      <span className="text-base">{icon}</span>
      <h3 className="font-bold text-sm text-primary-700 uppercase tracking-wide">{title}</h3>
    </div>
  )
}

function CheckboxField({ label, checked, onChange, disabled }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer select-none text-sm
                       ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        className="w-4 h-4 accent-primary-600 rounded"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="text-gray-700">{label}</span>
    </label>
  )
}

export function RegisterVisitModal({ open, onClose, patient: initPatient, onSuccess }) {
  const qc = useQueryClient()

  // Tách form thành 2 phần: thông tin BN + thông tin đăng ký
  const [patientForm, setPatientForm]   = useState({ ...INIT_PATIENT })
  const [visitForm,   setVisitForm]     = useState({ ...INIT_VISIT })
  const [activeTab,   setActiveTab]     = useState('section1') // 'section1' | 'section2'
  const [errors,      setErrors]        = useState({})

  // Nếu đã có patient từ scan CCCD → prefill Section I (readonly nếu bệnh nhân cũ)
  const isExistingPatient = !!initPatient?.id
  useEffect(() => {
    if (!open) return
    if (initPatient) {
      setPatientForm({
        full_name:            initPatient.full_name         ?? '',
        date_of_birth:        initPatient.date_of_birth     ?? '',
        birth_year:           initPatient.birth_year        ?? '',
        gender:               initPatient.gender            ?? '',
        cccd:                 initPatient.cccd              ?? '',
        cccd_issued_by:       initPatient.cccd_issued_by    ?? '',
        cccd_issued_date:     initPatient.cccd_issued_date  ?? '',
        occupation:           initPatient.occupation        ?? '',
        ethnicity_code:       initPatient.ethnicity_code    ?? '',
        ethnicity_name:       initPatient.ethnicity_name    ?? '',
        nationality_code:     initPatient.nationality_code  ?? 'VN',
        nationality_name:     initPatient.nationality_name  ?? 'VIET NAM',
        address_street:       initPatient.address_street        ?? '',
        address_village:      initPatient.address_village       ?? '',
        address_ward_code:    initPatient.address_ward_code     ?? '',
        address_ward_name:    initPatient.address_ward_name     ?? '',
        address_district_code: initPatient.address_district_code ?? '',
        address_district_name: initPatient.address_district_name ?? '',
        address_province_code: initPatient.address_province_code ?? '',
        address_province_name: initPatient.address_province_name ?? '',
        workplace:    initPatient.workplace    ?? '',
        phone:        initPatient.phone        ?? '',
        email:        initPatient.email        ?? '',
        policy_type:  initPatient.policy_type  ?? '',
        contact_name:    initPatient.contact_name    ?? '',
        contact_address: initPatient.contact_address ?? '',
        contact_phone:   initPatient.contact_phone   ?? '',
        contact_cccd:    initPatient.contact_cccd    ?? '',
      })
      // Bệnh nhân cũ → mặc định "Cũ"
      setVisitForm((v) => ({ ...v, patient_type: 'Cũ' }))
    } else {
      setPatientForm({ ...INIT_PATIENT })
      setVisitForm({ ...INIT_VISIT, patient_type: 'Mới' })
    }
    setErrors({})
    setActiveTab('section1')
  }, [open, initPatient])

  const setP = (k, v) => setPatientForm((f) => ({ ...f, [k]: v }))
  const setV = (k, v) => setVisitForm((f) => ({ ...f, [k]: v }))

  // Đồng bộ subject_name khi thay subject_type
  const handleSubjectType = (code) => {
    const found = SUBJECT_TYPES.find((s) => s.code === code)
    setV('subject_type', code)
    setV('subject_name', found?.name ?? '')
  }

  // Validate cơ bản
  const validate = () => {
    const e = {}
    if (!patientForm.full_name.trim()) e.full_name = 'Vui lòng nhập họ tên'
    if (!visitForm.clinic_room.trim()) e.clinic_room = 'Vui lòng chọn phòng khám'
    setErrors(e)
    if (Object.keys(e).length > 0) {
      // Chuyển sang tab chứa lỗi
      if (e.full_name) setActiveTab('section1')
      else if (e.clinic_room) setActiveTab('section2')
      return false
    }
    return true
  }

  const mutation = useMutation({
    mutationFn: (data) => receptionApi.create(data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['receptions'] })
      qc.invalidateQueries({ queryKey: ['reception-stats'] })
      qc.invalidateQueries({ queryKey: ['clinic-stats'] })
      toast.success(`Đã đăng ký — Số khám: ${data.visit_number ?? '—'}`)
      onSuccess?.(data)
      onClose()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSubmit = () => {
    if (!validate()) return

    const payload = {
      // Nếu bệnh nhân đã có → chỉ gửi patient_id
      ...(isExistingPatient
        ? { patient_id: initPatient.id }
        : { patient_data: { ...patientForm } }
      ),
      // Section II
      ...visitForm,
      priority: Number(visitForm.priority),
    }
    mutation.mutate(payload)
  }

  const tabCls = (tab) =>
    `px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer
     ${activeTab === tab
       ? 'border-primary-600 text-primary-700'
       : 'border-transparent text-gray-500 hover:text-gray-700'}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📋 Đăng ký tiếp đón bệnh nhân"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            {initPatient?.patient_code && (
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                Mã BN: {initPatient.patient_code}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn btn-ghost" onClick={onClose}>Huỷ</button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <><Spinner size="sm" /> Đang xử lý…</> : '💾 Đăng ký'}
            </button>
          </div>
        </div>
      }
    >
      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 mb-5 -mt-1">
        <button className={tabCls('section1')} onClick={() => setActiveTab('section1')}>
          I. Hành chính
        </button>
        <button className={tabCls('section2')} onClick={() => setActiveTab('section2')}>
          II. Đăng ký khám {Object.keys(errors).some((k) => !['full_name'].includes(k)) && '⚠️'}
        </button>
      </div>

      {/* ── SECTION I: HÀNH CHÍNH ─────────────────────────────────── */}
      {activeTab === 'section1' && (
        <div className="space-y-5">
          {isExistingPatient && (
            <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center
                              justify-center font-bold text-sm flex-shrink-0">
                {initPatient.full_name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{initPatient.full_name}</p>
                <p className="text-xs text-gray-500">
                  {initPatient.patient_code && `Mã BN: ${initPatient.patient_code} · `}
                  {initPatient.cccd && `CCCD: ${initPatient.cccd}`}
                </p>
              </div>
              <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
                Bệnh nhân cũ
              </span>
            </div>
          )}

          {/* Thông tin cá nhân */}
          <div>
            <SectionHeader title="Thông tin cá nhân" icon="👤" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Họ và tên" required error={errors.full_name} className="md:col-span-2">
                <input
                  className={`form-control ${errors.full_name ? 'is-error' : ''}`}
                  placeholder="Nguyễn Văn A"
                  value={patientForm.full_name}
                  onChange={(e) => setP('full_name', e.target.value)}
                  disabled={isExistingPatient}
                />
              </FormField>
              <FormField label="Giới tính">
                <select className="form-control" value={patientForm.gender}
                  onChange={(e) => setP('gender', e.target.value)} disabled={isExistingPatient}>
                  <option value="">-- Chọn --</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </FormField>
              <FormField label="Ngày sinh">
                <input type="date" className="form-control"
                  value={patientForm.date_of_birth}
                  onChange={(e) => {
                    setP('date_of_birth', e.target.value)
                    if (e.target.value) setP('birth_year', new Date(e.target.value).getFullYear())
                  }}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Năm sinh">
                <input type="number" className="form-control" placeholder="1990"
                  value={patientForm.birth_year}
                  onChange={(e) => setP('birth_year', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Nghề nghiệp">
                <input className="form-control" placeholder="Nông dân, Công nhân..."
                  value={patientForm.occupation}
                  onChange={(e) => setP('occupation', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Dân tộc (mã)">
                <input className="form-control" placeholder="25"
                  value={patientForm.ethnicity_code}
                  onChange={(e) => setP('ethnicity_code', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Tên dân tộc">
                <input className="form-control" placeholder="Kinh"
                  value={patientForm.ethnicity_name}
                  onChange={(e) => setP('ethnicity_name', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Mã quốc tịch">
                <input className="form-control" placeholder="VN"
                  value={patientForm.nationality_code}
                  onChange={(e) => setP('nationality_code', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Quốc tịch">
                <input className="form-control" placeholder="VIET NAM"
                  value={patientForm.nationality_name}
                  onChange={(e) => setP('nationality_name', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
            </div>
          </div>

          {/* CCCD */}
          <div>
            <SectionHeader title="CCCD / CMND" icon="🪪" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Số CCCD / CMND">
                <input className="form-control" placeholder="012345678901"
                  value={patientForm.cccd}
                  onChange={(e) => setP('cccd', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Nơi cấp" className="md:col-span-2">
                <input className="form-control" placeholder="Cục Cảnh sát QLHC về TTXH"
                  value={patientForm.cccd_issued_by}
                  onChange={(e) => setP('cccd_issued_by', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Ngày cấp">
                <input type="date" className="form-control"
                  value={patientForm.cccd_issued_date}
                  onChange={(e) => setP('cccd_issued_date', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Đối tượng chính sách" className="md:col-span-2">
                <input className="form-control" placeholder="Hộ nghèo / Cận nghèo / Không..."
                  value={patientForm.policy_type}
                  onChange={(e) => setP('policy_type', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
            </div>
          </div>

          {/* Địa chỉ */}
          <div>
            <SectionHeader title="Địa chỉ thường trú" icon="📍" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Số nhà, đường" className="md:col-span-2">
                <input className="form-control" placeholder="123 Đường Lê Lợi"
                  value={patientForm.address_street}
                  onChange={(e) => setP('address_street', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Thôn / Phố">
                <input className="form-control" placeholder="Thôn 3"
                  value={patientForm.address_village}
                  onChange={(e) => setP('address_village', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Mã phường/xã">
                <input className="form-control" placeholder="00123"
                  value={patientForm.address_ward_code}
                  onChange={(e) => setP('address_ward_code', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Phường / Xã">
                <input className="form-control" placeholder="Phường Nghĩa Lộ"
                  value={patientForm.address_ward_name}
                  onChange={(e) => setP('address_ward_name', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Mã quận/huyện">
                <input className="form-control" placeholder="505xx"
                  value={patientForm.address_district_code}
                  onChange={(e) => setP('address_district_code', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Quận / Huyện">
                <input className="form-control" placeholder="Thành phố Quảng Ngãi"
                  value={patientForm.address_district_name}
                  onChange={(e) => setP('address_district_name', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Mã tỉnh/TP">
                <input className="form-control" placeholder="505"
                  value={patientForm.address_province_code}
                  onChange={(e) => setP('address_province_code', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Tỉnh / TP" className="md:col-span-2">
                <input className="form-control" placeholder="Tỉnh Quảng Ngãi"
                  value={patientForm.address_province_name}
                  onChange={(e) => setP('address_province_name', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Nơi làm việc" className="md:col-span-3">
                <input className="form-control" placeholder="Công ty, trường học..."
                  value={patientForm.workplace}
                  onChange={(e) => setP('workplace', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
            </div>
          </div>

          {/* Liên hệ */}
          <div>
            <SectionHeader title="Liên hệ" icon="📞" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Di động">
                <input className="form-control" placeholder="0912 345 678"
                  value={patientForm.phone}
                  onChange={(e) => setP('phone', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
              <FormField label="Email" className="md:col-span-2">
                <input type="email" className="form-control" placeholder="email@example.com"
                  value={patientForm.email}
                  onChange={(e) => setP('email', e.target.value)}
                  disabled={isExistingPatient} />
              </FormField>
            </div>
          </div>

          {/* Người thân */}
          <div>
            <SectionHeader title="Người thân / Người đi cùng" icon="👨‍👩‍👧" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Họ tên người thân" className="md:col-span-2">
                <input className="form-control" placeholder="Nguyễn Thị B"
                  value={patientForm.contact_name}
                  onChange={(e) => setP('contact_name', e.target.value)} />
              </FormField>
              <FormField label="SĐT người thân">
                <input className="form-control" placeholder="0987 654 321"
                  value={patientForm.contact_phone}
                  onChange={(e) => setP('contact_phone', e.target.value)} />
              </FormField>
              <FormField label="Địa chỉ người thân" className="md:col-span-2">
                <input className="form-control" placeholder="Địa chỉ..."
                  value={patientForm.contact_address}
                  onChange={(e) => setP('contact_address', e.target.value)} />
              </FormField>
              <FormField label="CMND người thân">
                <input className="form-control" placeholder="CMND/CCCD"
                  value={patientForm.contact_cccd}
                  onChange={(e) => setP('contact_cccd', e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setActiveTab('section2')}
            >
              Tiếp theo: Thông tin đăng ký →
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION II: THÔNG TIN ĐĂNG KÝ KHÁM ─────────────────────── */}
      {activeTab === 'section2' && (
        <div className="space-y-5">
          {/* Thông tin cơ bản */}
          <div>
            <SectionHeader title="Thông tin đăng ký" icon="📋" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Phòng khám" required error={errors.clinic_room}>
                <input
                  className={`form-control ${errors.clinic_room ? 'is-error' : ''}`}
                  placeholder="VD: Phòng 1"
                  value={visitForm.clinic_room}
                  onChange={(e) => { setV('clinic_room', e.target.value); setErrors((er) => ({ ...er, clinic_room: '' })) }}
                />
              </FormField>
              <FormField label="Bệnh nhân">
                <select className="form-control" value={visitForm.patient_type}
                  onChange={(e) => setV('patient_type', e.target.value)}>
                  <option value="Mới">Mới</option>
                  <option value="Cũ">Cũ</option>
                </select>
              </FormField>
              <FormField label="Đối tượng khám">
                <select className="form-control" value={visitForm.patient_category}
                  onChange={(e) => setV('patient_category', e.target.value)}>
                  <option value="Người lớn">Người lớn</option>
                  <option value="Trẻ em">Trẻ em</option>
                </select>
              </FormField>
              <FormField label="Mức độ ưu tiên">
                <select className="form-control" value={visitForm.priority}
                  onChange={(e) => setV('priority', Number(e.target.value))}>
                  <option value={0}>Bình thường</option>
                  <option value={1}>Ưu tiên</option>
                  <option value={2}>Cấp cứu</option>
                </select>
              </FormField>
              <FormField label="Lý do khám" className="md:col-span-2">
                <input className="form-control" placeholder="Triệu chứng, lý do đến khám..."
                  value={visitForm.reason}
                  onChange={(e) => setV('reason', e.target.value)} />
              </FormField>
            </div>

            {/* Checkbox loại đăng ký */}
            <div className="flex flex-wrap gap-5 mt-3 p-3 bg-gray-50 rounded-lg">
              <CheckboxField label="Hẹn khám"     checked={visitForm.is_appointment} onChange={(v) => setV('is_appointment', v)} />
              <CheckboxField label="Online"        checked={visitForm.is_online}      onChange={(v) => setV('is_online', v)} />
              <CheckboxField label="Chuyển tuyến" checked={visitForm.is_referral}    onChange={(v) => setV('is_referral', v)} />
            </div>
          </div>

          {/* BHYT */}
          <div>
            <SectionHeader title="Bảo hiểm y tế (BHYT)" icon="🏥" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Đối tượng">
                <select className="form-control" value={visitForm.subject_type}
                  onChange={(e) => handleSubjectType(e.target.value)}>
                  {SUBJECT_TYPES.map((s) => (
                    <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Số thẻ BHYT" className="md:col-span-2">
                <input className="form-control" placeholder="DN4010000000000"
                  value={visitForm.insurance_number}
                  onChange={(e) => setV('insurance_number', e.target.value)} />
              </FormField>
              <FormField label="Từ ngày">
                <input type="date" className="form-control"
                  value={visitForm.insurance_valid_from}
                  onChange={(e) => setV('insurance_valid_from', e.target.value)} />
              </FormField>
              <FormField label="Đến ngày">
                <input type="date" className="form-control"
                  value={visitForm.insurance_valid_to}
                  onChange={(e) => setV('insurance_valid_to', e.target.value)} />
              </FormField>
              <FormField label="ĐKKCB (nơi KCB ban đầu)">
                <input className="form-control" placeholder="BV Quảng Ngãi"
                  value={visitForm.initial_registration}
                  onChange={(e) => setV('initial_registration', e.target.value)} />
              </FormField>
            </div>

            {/* Checkbox quyền lợi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 p-3 bg-blue-50 rounded-lg">
              <CheckboxField
                label="Được hưởng DVKT cao"
                checked={visitForm.high_tech_service}
                onChange={(v) => setV('high_tech_service', v)}
              />
              <CheckboxField
                label="BHYT > 5 năm liên tục"
                checked={visitForm.insurance_5years}
                onChange={(v) => setV('insurance_5years', v)}
              />
              {visitForm.insurance_5years && (
                <FormField label="Từ ngày (BHYT > 5 năm)" className="md:col-span-2">
                  <input type="date" className="form-control"
                    value={visitForm.insurance_5years_date}
                    onChange={(e) => setV('insurance_5years_date', e.target.value)} />
                </FormField>
              )}
              <CheckboxField
                label="Hộ cận nghèo"
                checked={visitForm.is_near_poor}
                onChange={(v) => setV('is_near_poor', v)}
              />
              <CheckboxField
                label="Hộ nghèo"
                checked={visitForm.is_poor}
                onChange={(v) => setV('is_poor', v)}
              />
            </div>
          </div>

          {/* Chuyển tuyến / Giới thiệu */}
          {visitForm.is_referral && (
            <div>
              <SectionHeader title="Thông tin chuyển tuyến" icon="🔀" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Giới thiệu">
                  <input className="form-control" placeholder="Nội dung giới thiệu"
                    value={visitForm.referral_note}
                    onChange={(e) => setV('referral_note', e.target.value)} />
                </FormField>
                <FormField label="Cơ sở giới thiệu / chuyển tuyến">
                  <input className="form-control" placeholder="Tên cơ sở y tế"
                    value={visitForm.referral_facility}
                    onChange={(e) => setV('referral_facility', e.target.value)} />
                </FormField>
              </div>
            </div>
          )}

          {/* Trạng thái đặc biệt */}
          <div>
            <SectionHeader title="Trạng thái & Ghi chú" icon="📝" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FormField label="Trạng thái đặc biệt">
                <select className="form-control" value={visitForm.special_status}
                  onChange={(e) => setV('special_status', e.target.value)}>
                  {SPECIAL_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Nhân viên tiếp nhận" className="md:col-span-2">
                <input className="form-control" placeholder="Họ tên nhân viên"
                  value={visitForm.receptionist_name}
                  onChange={(e) => setV('receptionist_name', e.target.value)} />
              </FormField>
              <FormField label="Ghi chú nội bộ" className="md:col-span-3">
                <textarea className="form-control" rows={2} placeholder="Ghi chú thêm..."
                  value={visitForm.internal_note}
                  onChange={(e) => setV('internal_note', e.target.value)} />
              </FormField>
            </div>
          </div>

          <div className="flex justify-between">
            <button type="button" className="btn btn-ghost" onClick={() => setActiveTab('section1')}>
              ← Quay lại: Hành chính
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CLINIC ROOM STATS TABLE
// ─────────────────────────────────────────────────────────────────────────────
function ClinicStatsTable({ visitDate }) {
  const { data, isLoading } = useQuery({
    queryKey: ['clinic-stats', visitDate],
    queryFn: () => receptionApi.clinicStats({ visit_date: visitDate }),
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>
  if (!data?.rooms?.length) {
    return <p className="text-sm text-gray-400 text-center py-4">Chưa có dữ liệu phòng khám</p>
  }

  const rows = data.rooms ?? []

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <th className="text-left py-2.5 px-3 font-semibold">Phòng khám</th>
            <th className="text-center py-2.5 px-3 font-semibold">Tổng số</th>
            <th className="text-center py-2.5 px-3 font-semibold">Chưa TN</th>
            <th className="text-center py-2.5 px-3 font-semibold">BHYT</th>
            <th className="text-center py-2.5 px-3 font-semibold">Dịch vụ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.clinic_room} className="hover:bg-gray-50 transition-colors">
              <td className="py-2 px-3 font-medium text-gray-800">{r.clinic_room}</td>
              <td className="py-2 px-3 text-center font-bold text-gray-900">{r.total}</td>
              <td className="py-2 px-3 text-center text-amber-600">{r.pending}</td>
              <td className="py-2 px-3 text-center text-blue-600">{r.bhyt}</td>
              <td className="py-2 px-3 text-center text-emerald-600">{r.service}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
            <td className="py-2 px-3 text-gray-700">Tổng cộng</td>
            <td className="py-2 px-3 text-center text-gray-900">{data.total_all}</td>
            <td className="py-2 px-3 text-center text-amber-600">{data.total_pending}</td>
            <td className="py-2 px-3 text-center text-blue-600">{data.total_bhyt}</td>
            <td className="py-2 px-3 text-center text-emerald-600">{data.total_service}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. VISIT DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function InfoRow({ label, value, className = '' }) {
  if (!value && value !== 0 && value !== false) return null
  return (
    <div className={className}>
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className="font-medium text-gray-800 text-sm">{value}</p>
    </div>
  )
}

function BoolBadge({ label, value }) {
  if (!value) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700
                     px-2 py-0.5 rounded-full border border-blue-200">
      ✓ {label}
    </span>
  )
}

function VisitDetail({ receptionId, onUpdate }) {
  const qc = useQueryClient()
  const [confirmAction, setConfirmAction] = useState(null)
  const [counterInput, setCounterInput] = useState(1)
  const [showPatient, setShowPatient] = useState(false)

  const { data: visit, isLoading } = useQuery({
    queryKey: ['reception', receptionId],
    queryFn: () => receptionApi.get(receptionId),
    enabled: !!receptionId,
  })

  const actionMutation = useMutation({
    mutationFn: async ({ type }) => {
      if (type === 'checkin')  return receptionApi.checkIn(receptionId, {})
      if (type === 'complete') return receptionApi.complete(receptionId)
      if (type === 'cancel')   return receptionApi.cancel(receptionId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reception', receptionId] })
      qc.invalidateQueries({ queryKey: ['receptions'] })
      qc.invalidateQueries({ queryKey: ['reception-stats'] })
      qc.invalidateQueries({ queryKey: ['clinic-stats'] })
      toast.success('Cập nhật thành công')
      setConfirmAction(null)
      onUpdate?.()
    },
    onError: (err) => { toast.error(err.message); setConfirmAction(null) },
  })

  const callMutation = useMutation({
    mutationFn: () => queueApi.callNext(counterInput),
    onSuccess: (data) => {
      toast.success(`Đã gọi số ${data.ticket_number}`)
      qc.invalidateQueries({ queryKey: ['queue-summary'] })
    },
    onError: (err) => toast.error(err.message),
  })

  if (!receptionId) {
    return (
      <EmptyState icon="📋" title="Chọn lượt khám"
        description="Chọn một lượt khám từ danh sách bên trái để xem chi tiết." />
    )
  }
  if (isLoading) return <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
  if (!visit) return null

  const p = visit.patient
  const canCheckIn  = visit.status === 'pending'
  const canComplete = visit.status === 'checked_in'
  const canCancel   = ['pending', 'checked_in'].includes(visit.status)

  return (
    <>
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => actionMutation.mutate(confirmAction)}
        title={confirmAction?.label}
        message={`Xác nhận: "${confirmAction?.label}"?`}
        danger={confirmAction?.type === 'cancel'}
        loading={actionMutation.isPending}
      />

      <div className="space-y-4">
        {/* Patient header */}
        <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl p-4 flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center
                          justify-center text-lg font-bold flex-shrink-0">
            {p?.full_name?.charAt(0) ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{p?.full_name ?? '—'}</h2>
              <StatusBadge status={visit.status} />
              {visit.priority > 0 && (
                <span className={`text-xs font-bold ${PRIORITY_COLOR[visit.priority]}`}>
                  ● {fmtPriority(visit.priority)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-gray-500">
              {p?.patient_code && <span className="font-mono font-semibold text-primary-700">Mã: {p.patient_code}</span>}
              {p?.cccd && <span>CCCD: {p.cccd}</span>}
              {p?.gender && <span>{fmtGender(p.gender)}</span>}
              {(p?.date_of_birth || p?.birth_year) && (
                <span>{p.date_of_birth ? fmtDate(p.date_of_birth) : p.birth_year}</span>
              )}
              {p?.phone && <span>{p.phone}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Đăng ký: {fmtDateTime(visit.created_at)}
              {visit.visit_time && ` lúc ${visit.visit_time}`}
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm text-xs flex-shrink-0"
            onClick={() => setShowPatient((v) => !v)}
          >
            {showPatient ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Hành chính
          </button>
        </div>

        {/* Expanded patient details */}
        {showPatient && p && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-xs text-gray-600 uppercase tracking-wide">
                I. Thông tin hành chính
              </h3>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <InfoRow label="Họ và tên"    value={p.full_name} />
              <InfoRow label="Ngày sinh"    value={p.date_of_birth ? fmtDate(p.date_of_birth) : p.birth_year} />
              <InfoRow label="Giới tính"    value={fmtGender(p.gender)} />
              <InfoRow label="CCCD / CMND"  value={p.cccd} />
              <InfoRow label="Nơi cấp"      value={p.cccd_issued_by} />
              <InfoRow label="Ngày cấp"     value={fmtDate(p.cccd_issued_date)} />
              <InfoRow label="Nghề nghiệp"  value={p.occupation} />
              <InfoRow label="Dân tộc"      value={p.ethnicity_code && p.ethnicity_name ? `${p.ethnicity_code} - ${p.ethnicity_name}` : (p.ethnicity_name ?? p.ethnicity_code)} />
              <InfoRow label="Quốc tịch"    value={p.nationality_code && p.nationality_name ? `${p.nationality_code} - ${p.nationality_name}` : (p.nationality_name ?? p.nationality_code)} />
              <InfoRow label="Địa chỉ"      className="col-span-2 md:col-span-3"
                value={[p.address_street, p.address_village, p.address_ward_name, p.address_district_name, p.address_province_name].filter(Boolean).join(', ')} />
              <InfoRow label="Nơi làm việc" value={p.workplace} />
              <InfoRow label="Di động"      value={p.phone} />
              <InfoRow label="Email"        value={p.email} />
              <InfoRow label="Đối tượng CS" value={p.policy_type} />
              {(p.contact_name || p.contact_phone) && (
                <div className="col-span-2 md:col-span-3 border-t border-gray-100 pt-3 mt-1">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Người thân</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <InfoRow label="Họ tên" value={p.contact_name} />
                    <InfoRow label="SĐT"    value={p.contact_phone} />
                    <InfoRow label="CMND"   value={p.contact_cccd} />
                    <InfoRow label="Địa chỉ" className="col-span-2" value={p.contact_address} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visit info */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <h3 className="font-semibold text-xs text-gray-600 uppercase tracking-wide">
              II. Thông tin đăng ký khám
            </h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoRow label="Ngày đăng ký"  value={fmtDate(visit.visit_date)} />
              <InfoRow label="Giờ đăng ký"   value={visit.visit_time} />
              <InfoRow label="Phòng khám"    value={visit.clinic_room} />
              <InfoRow label="Số khám"       value={visit.visit_number} />
              <InfoRow label="Đối tượng"     value={visit.subject_name ? `${visit.subject_type} - ${visit.subject_name}` : visit.subject_type} />
              <InfoRow label="BHYT"          value={visit.insurance_number} />
              <InfoRow label="Từ ngày"       value={fmtDate(visit.insurance_valid_from)} />
              <InfoRow label="Đến ngày"      value={fmtDate(visit.insurance_valid_to)} />
              <InfoRow label="ĐKKCB"         value={visit.initial_registration} className="col-span-2" />
              <InfoRow label="Loại BN"       value={visit.patient_type} />
              <InfoRow label="Đối tượng khám" value={visit.patient_category} />
            </div>

            {/* Cờ bool */}
            <div className="flex flex-wrap gap-2 pt-1">
              <BoolBadge label="Hẹn khám"     value={visit.is_appointment} />
              <BoolBadge label="Online"        value={visit.is_online} />
              <BoolBadge label="Chuyển tuyến" value={visit.is_referral} />
              <BoolBadge label="DVKT cao"      value={visit.high_tech_service} />
              <BoolBadge label="BHYT > 5 năm" value={visit.insurance_5years} />
              <BoolBadge label="Cận nghèo"    value={visit.is_near_poor} />
              <BoolBadge label="Hộ nghèo"     value={visit.is_poor} />
            </div>

            {visit.is_referral && (visit.referral_note || visit.referral_facility) && (
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                <InfoRow label="Giới thiệu"  value={visit.referral_note} />
                <InfoRow label="Cơ sở GT"    value={visit.referral_facility} />
              </div>
            )}

            {(visit.special_status && visit.special_status !== 'Không') && (
              <div className="pt-1 border-t border-gray-100">
                <InfoRow label="Trạng thái đặc biệt" value={visit.special_status} />
              </div>
            )}

            {visit.reason && (
              <div className="pt-1 border-t border-gray-100">
                <InfoRow label="Lý do khám" value={visit.reason} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
              <InfoRow label="Nhân viên TN" value={visit.receptionist_name} />
              <InfoRow label="Check-in lúc" value={fmtDateTime(visit.checked_in_at)} />
            </div>
          </div>
        </div>

        {/* Queue ticket */}
        {visit.queue_ticket && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="font-semibold text-xs text-gray-600 uppercase tracking-wide mb-3">
              Số thứ tự hàng đợi
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-black text-primary-600 tabular-nums">
                {visit.queue_ticket.ticket_number}
              </div>
              <div className="space-y-1">
                <StatusBadge status={visit.queue_ticket.status} />
                {visit.queue_ticket.counter_number && (
                  <p className="text-sm text-gray-500">Quầy {visit.queue_ticket.counter_number}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-2">
          {canCheckIn && (
            <button className="btn btn-success w-full"
              onClick={() => setConfirmAction({ type: 'checkin', label: 'Tiếp nhận bệnh nhân' })}>
              <CheckCircle size={16} /> Tiếp nhận bệnh nhân
            </button>
          )}
          {canComplete && (
            <button className="btn btn-primary w-full"
              onClick={() => setConfirmAction({ type: 'complete', label: 'Hoàn thành lượt khám' })}>
              <CheckCircle size={16} /> Hoàn thành lượt khám
            </button>
          )}
          {canCancel && (
            <button className="btn btn-danger w-full"
              onClick={() => setConfirmAction({ type: 'cancel', label: 'Huỷ lượt khám' })}>
              Huỷ lượt khám
            </button>
          )}
        </div>

        {/* Gọi số */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="font-semibold text-xs text-gray-600 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Bell size={14} className="text-primary-600" /> Gọi số tiếp theo
          </h3>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Quầy số</label>
              <input type="number" min={1} max={99} className="form-control"
                value={counterInput}
                onChange={(e) => setCounterInput(Number(e.target.value))} />
            </div>
            <div className="flex items-end">
              <button className="btn btn-warning" onClick={() => callMutation.mutate()}
                disabled={callMutation.isPending}>
                {callMutation.isPending ? <Spinner size="sm" /> : <PhoneCall size={16} />}
                Gọi
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. VISIT LIST ITEM
// ─────────────────────────────────────────────────────────────────────────────
function VisitListItem({ visit, active, onClick }) {
  const p = visit.patient
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-150
                  ${active
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-100 bg-white hover:border-primary-200 hover:shadow-sm'
                  }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-gray-900 truncate">{p?.full_name ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {p?.patient_code && <span className="font-mono text-primary-600 mr-1">{p.patient_code}</span>}
            {visit.clinic_room && <span>{visit.clinic_room} · </span>}
            {visit.visit_number && <span className="font-bold">#{visit.visit_number} · </span>}
            {fmtDate(visit.visit_date)}
          </p>
          {visit.subject_name && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {visit.subject_name}
              {visit.insurance_number && ` · ${visit.insurance_number}`}
            </p>
          )}
        </div>
        <StatusBadge status={visit.status} showDot={false} className="flex-shrink-0 text-[10px]" />
      </div>
      {visit.priority > 0 && (
        <p className={`text-xs font-semibold mt-1 ${PRIORITY_COLOR[visit.priority]}`}>
          ● {fmtPriority(visit.priority)}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. MAIN RECEPTION PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceptionPage() {
  const qc = useQueryClient()

  const [selectedId,      setSelectedId]      = useState(null)
  const [page,            setPage]            = useState(1)
  const [statusFilter,    setStatusFilter]    = useState('')
  const [clinicFilter,    setClinicFilter]    = useState('')
  const [searchKeyword,   setSearchKeyword]   = useState('')
  const [showScanModal,   setShowScanModal]   = useState(false)
  const [showRegister,    setShowRegister]    = useState(false)
  const [pendingPatient,  setPendingPatient]  = useState(null)
  const [showClinicStats, setShowClinicStats] = useState(false)

  // WebSocket
  const { status: wsStatus, on } = useWebSocket('reception')
  useEffect(() => {
    const offUpdate = on('reception_update', () => {
      qc.invalidateQueries({ queryKey: ['receptions'] })
      qc.invalidateQueries({ queryKey: ['reception-stats'] })
      qc.invalidateQueries({ queryKey: ['clinic-stats'] })
    })
    const offCall = on('calling', (data) => {
      if (data?.ticket_number) {
        toast(`🔔 Gọi: ${data.ticket_number} — Quầy ${data.counter_number}`, { duration: 5000, icon: '📢' })
      }
    })
    return () => { offUpdate(); offCall() }
  }, [on, qc])

  // Queries
  const { data: statsData } = useQuery({
    queryKey: ['reception-stats'],
    queryFn: () => receptionApi.stats(),
    refetchInterval: 30_000,
  })

  const { data: queueSummary } = useQuery({
    queryKey: ['queue-summary', today()],
    queryFn: () => queueApi.summary({ issue_date: today() }),
    refetchInterval: 30_000,
  })

  const { data: visitList, isLoading: listLoading } = useQuery({
    queryKey: ['receptions', page, statusFilter, clinicFilter, today()],
    queryFn: () => receptionApi.list({
      visit_date:  today(),
      status:      statusFilter || undefined,
      clinic_room: clinicFilter || undefined,
      page,
      page_size:   15,
    }),
    keepPreviousData: true,
  })

  const handlePatientFound = useCallback((data) => {
    setPendingPatient(data.patient)
    setShowRegister(true)
  }, [])

  const handleRegisterSuccess = useCallback((newVisit) => {
    setSelectedId(newVisit.id)
    qc.invalidateQueries({ queryKey: ['receptions'] })
    qc.invalidateQueries({ queryKey: ['clinic-stats'] })
  }, [qc])

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ['receptions'] })
    qc.invalidateQueries({ queryKey: ['reception-stats'] })
    qc.invalidateQueries({ queryKey: ['queue-summary'] })
    qc.invalidateQueries({ queryKey: ['clinic-stats'] })
  }

  const stats = statsData ?? {}
  const qs    = queueSummary ?? {}

  // Mở form đăng ký mới không qua scan
  const handleNewDirect = () => {
    setPendingPatient(null)
    setShowRegister(true)
  }

  const filteredItems = (visitList?.items ?? []).filter((v) =>
    !searchKeyword ||
    v.patient?.full_name?.toLowerCase().includes(searchKeyword.toLowerCase()) ||
    v.patient?.patient_code?.toLowerCase().includes(searchKeyword.toLowerCase())
  )

  return (
    <>
      <ScanCccdModal
        open={showScanModal}
        onClose={() => setShowScanModal(false)}
        onPatientFound={handlePatientFound}
      />
      <RegisterVisitModal
        open={showRegister}
        onClose={() => setShowRegister(false)}
        patient={pendingPatient}
        onSuccess={handleRegisterSuccess}
      />

      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">

        {/* ── Top bar ── */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex-shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList size={22} className="text-violet-500" />
                Bàn tiếp nhận
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <WsStatusDot status={wsStatus} />
              <button className="btn btn-ghost btn-sm" onClick={handleRefresh}>
                <RefreshCw size={13} /> Làm mới
              </button>
              <button
                className="btn btn-ghost btn-sm gap-1"
                onClick={() => setShowClinicStats((v) => !v)}
              >
                <Table2 size={14} /> Thống kê PK
              </button>
              <button className="btn btn-secondary btn-sm gap-1" onClick={() => setShowScanModal(true)}>
                <CreditCard size={14} /> Quét CCCD
              </button>
              <button className="btn btn-primary gap-1" onClick={handleNewDirect}>
                <Plus size={15} /> Tiếp nhận mới
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-2.5 flex-shrink-0
                         overflow-x-auto flex gap-3 items-center">
          {[
            { icon: <Users size={16} className="text-gray-500" />,    iconBg: 'bg-gray-100',    value: stats.total ?? 0,      label: 'Tổng hôm nay',    valueColor: 'text-gray-700' },
            { icon: <Clock size={16} className="text-amber-500" />,   iconBg: 'bg-amber-50',    value: stats.pending ?? 0,    label: 'Chờ tiếp nhận',   valueColor: 'text-amber-600' },
            { icon: <CheckCircle size={16} className="text-emerald-500" />, iconBg: 'bg-emerald-50', value: stats.checked_in ?? 0, label: 'Đã tiếp nhận', valueColor: 'text-emerald-600' },
            { icon: <CheckCircle size={16} className="text-gray-400" />,    iconBg: 'bg-gray-100',   value: stats.completed ?? 0,  label: 'Hoàn thành',   valueColor: 'text-gray-500' },
            { icon: <PhoneCall size={16} className="text-red-500" />,  iconBg: 'bg-red-50',     value: qs.waiting ?? 0,       label: 'Hàng đợi',        valueColor: 'text-blue-600' },
          ].map(({ icon, iconBg, value, label, valueColor }) => (
            <div key={label} className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2
                                        shadow-sm border border-gray-100 flex-shrink-0">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                {icon}
              </div>
              <div>
                <div className={`text-lg font-black tabular-nums leading-none ${valueColor}`}>{value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Clinic Stats (toggle) ── */}
        {showClinicStats && (
          <div className="bg-white border-b border-gray-200 px-6 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
                <Table2 size={15} className="text-primary-600" />
                Thống kê phòng khám — {new Date().toLocaleDateString('vi-VN')}
              </h3>
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setShowClinicStats(false)}>
                Ẩn
              </button>
            </div>
            <ClinicStatsTable visitDate={today()} />
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT: Visit list */}
          <aside className="w-72 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white overflow-hidden">
            <div className="px-3 py-2.5 border-b border-gray-100 space-y-2">
              <SearchInput
                value={searchKeyword}
                onChange={setSearchKeyword}
                placeholder="Tên, mã BN…"
              />
              <div className="flex gap-2">
                <select className="form-control text-xs flex-1" value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
                  <option value="">Tất cả</option>
                  <option value="pending">Chờ TN</option>
                  <option value="checked_in">Đã TN</option>
                  <option value="completed">Hoàn thành</option>
                  <option value="cancelled">Đã huỷ</option>
                </select>
                <input
                  className="form-control text-xs w-24"
                  placeholder="Phòng…"
                  value={clinicFilter}
                  onChange={(e) => { setClinicFilter(e.target.value); setPage(1) }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {listLoading ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : !filteredItems.length ? (
                <EmptyState icon="📋" title="Chưa có lượt khám" description="Nhấn 'Tiếp nhận mới'" />
              ) : (
                filteredItems.map((v) => (
                  <VisitListItem
                    key={v.id}
                    visit={v}
                    active={v.id === selectedId}
                    onClick={() => setSelectedId(v.id)}
                  />
                ))
              )}
            </div>

            {visitList?.total_pages > 1 && (
              <div className="border-t border-gray-100 px-3 py-2 flex justify-center">
                <Pagination page={page} totalPages={visitList.total_pages} onChange={setPage} />
              </div>
            )}
          </aside>

          {/* RIGHT: Detail */}
          <main className="flex-1 overflow-y-auto p-5 bg-gray-50">
            <VisitDetail
              receptionId={selectedId}
              onUpdate={() => {
                qc.invalidateQueries({ queryKey: ['receptions'] })
                qc.invalidateQueries({ queryKey: ['clinic-stats'] })
              }}
            />
          </main>
        </div>
      </div>
    </>
  )
}
