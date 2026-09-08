/**
 * ExaminationPage — Phiếu khám bệnh đầy đủ
 * Route: /examination/:receptionId
 *
 * Layout 3 cột:
 *  [LEFT  ~280px] Hành chính BN + Lịch sử khám
 *  [MID   ~480px] Khung II (thông tin vào) + Khung III (thông tin khám)
 *  [RIGHT ~380px] Kê đơn / CLS + Tổng chi phí
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Save, CheckCircle2, SkipForward, Printer, ArrowLeft,
  Plus, Trash2, ChevronDown, ChevronRight, Stethoscope,
  FlaskConical, Pill, AlertCircle, Clock, History,
  ArrowRightLeft, FileText,
} from 'lucide-react'

import { examinationApi, receptionApi, patientApi } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import {
  fmtDate, fmtDateTime, fmtGender, fmtCurrency,
  DISPOSITION_LABEL, PAYMENT_TYPE_LABEL, PAYMENT_TYPE_COLOR, calcAge,
} from '@/utils/format'
import Spinner from '@/components/ui/Spinner'
import FormField from '@/components/ui/FormField'
import { ConfirmModal } from '@/components/ui/Modal'

// ─── Constants ────────────────────────────────────────────────────────────────
const SUBJECT_TYPES = [
  { code: '1', name: 'BHYT' }, { code: '2', name: 'Dịch vụ' },
  { code: '3', name: 'Miễn phí' }, { code: '4', name: 'Thu phí' },
]

const DISPOSITIONS = [
  { value: 'emergency',       label: 'Cấp cứu',              color: 'text-red-600 border-red-300 bg-red-50' },
  { value: 'outpatient',      label: 'Điều trị ngoại trú',   color: 'text-green-700 border-green-300 bg-green-50' },
  { value: 'revisit',         label: 'Hẹn tái khám',         color: 'text-blue-700 border-blue-300 bg-blue-50' },
  { value: 'inpatient_ward',  label: 'Chuyển phòng lưu',     color: 'text-indigo-700 border-indigo-300 bg-indigo-50' },
  { value: 'inpatient',       label: 'Nhập viện',             color: 'text-purple-700 border-purple-300 bg-purple-50' },
  { value: 'transfer_out',    label: 'Chuyển tuyến',          color: 'text-orange-700 border-orange-300 bg-orange-50' },
  { value: 'transfer_clinic', label: 'Chuyển phòng khám',    color: 'text-teal-700 border-teal-300 bg-teal-50' },
  { value: 'discharged',      label: 'Khám xong cho về',     color: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
  { value: 'chronic_script',  label: 'Cấp toa mãn tính',     color: 'text-cyan-700 border-cyan-300 bg-cyan-50' },
  { value: 'leave_ama',       label: 'Bỏ về',                color: 'text-yellow-700 border-yellow-300 bg-yellow-50' },
  { value: 'deceased',        label: 'Tử vong',               color: 'text-gray-700 border-gray-300 bg-gray-50' },
]

const REVISIT_RESULTS = ['Không thay đổi', 'Đỡ', 'Khỏi', 'Nặng hơn', 'Biến chứng']
const PAYMENT_TYPES = Object.entries(PAYMENT_TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))
const ITEM_TYPES = [{ value: 'drug', label: 'Thuốc' }, { value: 'cls', label: 'CLS' }]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, iconCls = 'text-teal-600', children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5
                   bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-600 uppercase tracking-wider">
          {Icon && <Icon size={13} className={iconCls} />}
          {title}
        </span>
        {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
      </button>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </div>
  )
}

const FieldRow = ({ label, value, className = '' }) => (
  value ? (
    <div className={className}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
    </div>
  ) : null
)

function useDebounce(value, delay = 800) {
  const [dv, setDv] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDv(value), delay); return () => clearTimeout(t) }, [value, delay])
  return dv
}

// ─── Left panel: Hành chính ───────────────────────────────────────────────────
function PatientPanel({ patient, history = [], receptionId }) {
  const [histOpen, setHistOpen] = useState(false)
  if (!patient) return <div className="p-4 text-gray-400 text-sm">Đang tải…</div>

  const age = patient.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : patient.birth_year ? new Date().getFullYear() - patient.birth_year : null

  const addr = [patient.address_street, patient.address_village,
    patient.address_ward_name, patient.address_district_name].filter(Boolean).join(', ')

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-2 p-2">
      {/* Avatar card */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl p-3 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center
                          text-xl font-black flex-shrink-0">
            {patient.full_name?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">{patient.full_name}</p>
            <p className="text-teal-100 text-xs font-mono">{patient.patient_code}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {[
            { label: 'Tuổi', value: age ?? '—' },
            { label: 'Giới', value: fmtGender(patient.gender) },
            { label: 'Dân tộc', value: patient.ethnicity_name ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[9px] text-teal-200 uppercase">{label}</p>
              <p className="text-xs font-bold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Thông tin chi tiết */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hành chính</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <FieldRow label="Sinh ngày"  value={patient.date_of_birth ? fmtDate(patient.date_of_birth) : (patient.birth_year ?? null)} />
          <FieldRow label="Nghề nghiệp" value={patient.occupation} />
          <FieldRow label="CCCD"       value={patient.cccd} />
          <FieldRow label="Quốc tịch"  value={patient.nationality_name} />
          <FieldRow label="Điện thoại" value={patient.phone} className="col-span-2" />
          {addr && <FieldRow label="Địa chỉ" value={addr} className="col-span-2" />}
          <FieldRow label="Nơi làm việc" value={patient.workplace} className="col-span-2" />
        </div>
        {(patient.contact_name || patient.contact_phone) && (
          <div className="border-t border-gray-100 pt-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Người thân</p>
            <FieldRow label="Họ tên" value={patient.contact_name} />
            <FieldRow label="SĐT"    value={patient.contact_phone} />
          </div>
        )}
      </div>

      {/* Lịch sử khám */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button onClick={() => setHistOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5
                     bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors">
          <span className="flex items-center gap-1.5 text-xs font-bold text-gray-600 uppercase tracking-wider">
            <History size={12} className="text-indigo-500" /> Lịch sử khám ({history.length})
          </span>
          {histOpen ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
        </button>
        {histOpen && (
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 p-3 text-center">Chưa có lịch sử</p>
            ) : history.map(h => (
              <div key={h.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-800">{fmtDate(h.exam_date)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                    ${h.status === 'completed' ? 'bg-green-100 text-green-700'
                      : h.status === 'saved' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'}`}>
                    {h.status === 'completed' ? 'Hoàn tất' : h.status === 'saved' ? 'Đã lưu' : 'Nháp'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {h.doctor_name ?? '—'} · #{h.id}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Middle panel: Khung II + III ─────────────────────────────────────────────
function ExaminationForm({ form, setForm, receptionData }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const disposition = form.disposition

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-2 p-2">

      {/* ── Khung II: Thông tin vào ── */}
      <Section title="II. Thông tin vào" icon={FileText} iconCls="text-blue-500">
        {/* Đối tượng + BHYT */}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Đối tượng">
            <select className="form-control text-sm py-1.5" value={form.subject_type ?? ''}
              onChange={e => {
                const found = SUBJECT_TYPES.find(s => s.code === e.target.value)
                set('subject_type', e.target.value)
                set('subject_name', found?.name ?? '')
              }}>
              <option value="">-- Chọn --</option>
              {SUBJECT_TYPES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
            </select>
          </FormField>
          <FormField label="Số thẻ BHYT">
            <input className="form-control text-sm py-1.5" placeholder="DN401..."
              value={form.insurance_number ?? ''}
              onChange={e => set('insurance_number', e.target.value)} />
          </FormField>
          <FormField label="Từ ngày">
            <input type="date" className="form-control text-sm py-1.5"
              value={form.insurance_valid_from ?? ''}
              onChange={e => set('insurance_valid_from', e.target.value)} />
          </FormField>
          <FormField label="Đến ngày">
            <input type="date" className="form-control text-sm py-1.5"
              value={form.insurance_valid_to ?? ''}
              onChange={e => set('insurance_valid_to', e.target.value)} />
          </FormField>
        </div>

        {/* Nhận từ / chuyển tuyến */}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Nhận từ (loại đơn vị)">
            <input className="form-control text-sm py-1.5" placeholder="VD: Trạm y tế, Bệnh viện..."
              value={form.referral_from_type ?? ''}
              onChange={e => set('referral_from_type', e.target.value)} />
          </FormField>
          <FormField label="Đến từ (tên cụ thể)">
            <input className="form-control text-sm py-1.5" placeholder="Tên đơn vị giới thiệu"
              value={form.referral_from_name ?? ''}
              onChange={e => set('referral_from_name', e.target.value)} />
          </FormField>
        </div>
        <FormField label="CĐ nơi giới thiệu">
          <input className="form-control text-sm py-1.5" placeholder="Chẩn đoán từ nơi giới thiệu"
            value={form.referral_diagnosis ?? ''}
            onChange={e => set('referral_diagnosis', e.target.value)} />
        </FormField>

        {/* Lâm sàng */}
        <FormField label="Triệu chứng lâm sàng">
          <textarea className="form-control text-sm py-1.5 resize-none" rows={3}
            placeholder="Mô tả triệu chứng, diễn biến bệnh..."
            value={form.clinical_symptoms ?? ''}
            onChange={e => set('clinical_symptoms', e.target.value)} />
        </FormField>

        {/* Ngày khám */}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Ngày bắt đầu khám">
            <input type="date" className="form-control text-sm py-1.5"
              value={form.exam_date ?? ''}
              onChange={e => set('exam_date', e.target.value)} />
          </FormField>
          <FormField label="Ngày kết thúc">
            <input type="date" className="form-control text-sm py-1.5"
              value={form.exam_end_date ?? ''}
              onChange={e => set('exam_end_date', e.target.value)} />
          </FormField>
        </div>
      </Section>

      {/* ── Khung III: Thông tin khám ── */}
      <Section title="III. Thông tin khám" icon={Stethoscope} iconCls="text-teal-600">
        {/* Bác sĩ / Điều dưỡng */}
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Bác sĩ điều trị">
            <input className="form-control text-sm py-1.5" placeholder="Họ tên bác sĩ"
              value={form.doctor_name ?? ''}
              onChange={e => set('doctor_name', e.target.value)} />
          </FormField>
          <FormField label="Điều dưỡng">
            <input className="form-control text-sm py-1.5" placeholder="Họ tên điều dưỡng"
              value={form.nurse_name ?? ''}
              onChange={e => set('nurse_name', e.target.value)} />
          </FormField>
        </div>

        {/* Chẩn đoán — quản lý bên DiagnosesSection */}
        <DiagnosesSection diagnoses={form.diagnoses ?? []}
          onChange={diags => set('diagnoses', diags)} />

        {/* Biến chứng */}
        <FormField label="Biến chứng">
          <input className="form-control text-sm py-1.5" placeholder="Ghi nếu có"
            value={form.complications ?? ''}
            onChange={e => set('complications', e.target.value)} />
        </FormField>

        {/* Hướng xử trí */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Hướng xử trí</p>
          <div className="grid grid-cols-2 gap-1.5">
            {DISPOSITIONS.map(({ value, label, color }) => (
              <button key={value} type="button"
                onClick={() => set('disposition', disposition === value ? null : value)}
                className={`text-xs font-medium px-2.5 py-2 rounded-lg border text-left
                             transition-all duration-100
                             ${disposition === value
                               ? color + ' ring-2 ring-offset-1 ring-current'
                               : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                             }`}>
                {disposition === value && '✓ '}{label}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-forms theo hướng xử trí */}
        {disposition === 'revisit' && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-2 border border-blue-200">
            <p className="text-xs font-bold text-blue-700">📅 Tái khám</p>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Số ngày hẹn">
                <input type="number" className="form-control text-sm py-1.5" placeholder="7"
                  value={form.revisit_days ?? ''}
                  onChange={e => set('revisit_days', e.target.value ? Number(e.target.value) : null)} />
              </FormField>
              <FormField label="Kết quả điều trị">
                <select className="form-control text-sm py-1.5"
                  value={form.revisit_result ?? ''}
                  onChange={e => set('revisit_result', e.target.value)}>
                  <option value="">-- Chọn --</option>
                  {REVISIT_RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
            </div>
          </div>
        )}

        {(disposition === 'transfer_out') && (
          <div className="bg-orange-50 rounded-lg p-3 space-y-2 border border-orange-200">
            <p className="text-xs font-bold text-orange-700">🔀 Chuyển tuyến</p>
            <FormField label="Nơi chuyển đến">
              <input className="form-control text-sm py-1.5" placeholder="Tên bệnh viện/cơ sở nhận"
                value={form.transfer_to_facility ?? ''}
                onChange={e => set('transfer_to_facility', e.target.value)} />
            </FormField>
            <FormField label="Lý do chuyển">
              <textarea className="form-control text-sm py-1.5 resize-none" rows={2}
                placeholder="Lý do chuyển tuyến..."
                value={form.transfer_reason ?? ''}
                onChange={e => set('transfer_reason', e.target.value)} />
            </FormField>
          </div>
        )}

        {(disposition === 'inpatient' || disposition === 'inpatient_ward') && (
          <div className="bg-purple-50 rounded-lg p-3 space-y-2 border border-purple-200">
            <p className="text-xs font-bold text-purple-700">🏥 Nhập viện</p>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Vào khoa/phòng" className="col-span-2">
                <input className="form-control text-sm py-1.5" placeholder="VD: Khoa Nội - Phòng 3"
                  value={form.admit_ward ?? ''}
                  onChange={e => set('admit_ward', e.target.value)} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 accent-purple-600 rounded"
                checked={form.admit_priority ?? false}
                onChange={e => set('admit_priority', e.target.checked)} />
              <span className="text-purple-700 font-medium">Ưu tiên nhập viện</span>
            </label>
          </div>
        )}

        {/* Checkbox nhanh */}
        <div className="flex items-center gap-4 pt-1 pb-0.5">
          {[
            { key: 'is_near_poor', label: 'C.Nghèo' },
            { key: 'is_poor',      label: 'H.Nghèo' },
            { key: 'flag_priority', label: 'Ưu tiên' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-gray-700">
              <input type="checkbox" className="w-3.5 h-3.5 accent-teal-600 rounded"
                checked={form[key] ?? false}
                onChange={e => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ─── Diagnoses section (trong form) ──────────────────────────────────────────
function DiagnosesSection({ diagnoses, onChange }) {
  const add = () => onChange([...diagnoses, { icd_code: '', icd_name: '', is_primary: diagnoses.length === 0, note: '' }])
  const remove = (idx) => onChange(diagnoses.filter((_, i) => i !== idx))
  const update = (idx, k, v) => onChange(diagnoses.map((d, i) => i === idx ? { ...d, [k]: v } : d))
  const setPrimary = (idx) => onChange(diagnoses.map((d, i) => ({ ...d, is_primary: i === idx })))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-600">Chẩn đoán (ICD-10)</p>
        <button type="button" onClick={add}
          className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium">
          <Plus size={12} /> Thêm chẩn đoán
        </button>
      </div>
      {diagnoses.length === 0 ? (
        <button type="button" onClick={add}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-xs
                     text-gray-400 hover:border-teal-300 hover:text-teal-600 transition-colors">
          + Thêm chẩn đoán
        </button>
      ) : (
        <div className="space-y-2">
          {diagnoses.map((d, idx) => (
            <div key={idx}
              className={`rounded-lg border p-2.5 space-y-2
                ${d.is_primary ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPrimary(idx)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-bold flex-shrink-0
                    ${d.is_primary
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'text-gray-400 border-gray-300 hover:border-teal-400 hover:text-teal-600'}`}>
                  {d.is_primary ? '● Chính' : '○ Kèm'}
                </button>
                <input className="form-control text-xs py-1 w-24 flex-shrink-0" placeholder="Mã ICD"
                  value={d.icd_code ?? ''} onChange={e => update(idx, 'icd_code', e.target.value)} />
                <input className="form-control text-xs py-1 flex-1" placeholder="Tên bệnh / chẩn đoán *"
                  value={d.icd_name ?? ''} onChange={e => update(idx, 'icd_name', e.target.value)} />
                <button type="button" onClick={() => remove(idx)}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              <input className="form-control text-xs py-1" placeholder="Ghi chú thêm (tuỳ chọn)"
                value={d.note ?? ''} onChange={e => update(idx, 'note', e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Right panel: Kê đơn / CLS + Chi phí ─────────────────────────────────────
function PrescriptionPanel({ items, onChange, costSummary }) {
  const addItem = (type) => onChange([...items, {
    item_type: type, item_code: '', item_name: '',
    unit: type === 'drug' ? 'viên' : 'lần',
    quantity: 1, unit_price: null,
    usage_instruction: '', payment_type: 'bhyt',
    valid_from: '', valid_to: '',
  }])
  const removeItem = (idx) => onChange(items.filter((_, i) => i !== idx))
  const updateItem = (idx, k, v) => onChange(items.map((it, i) => i === idx ? { ...it, [k]: v } : it))

  const drugs = items.filter(i => i.item_type === 'drug')
  const cls   = items.filter(i => i.item_type === 'cls')

  const ItemRow = ({ item, idx }) => (
    <div className={`rounded-lg border p-2.5 space-y-2
        ${item.item_type === 'drug' ? 'border-emerald-200 bg-emerald-50/40' : 'border-violet-200 bg-violet-50/40'}`}>
      <div className="flex items-center gap-1.5">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
            ${item.item_type === 'drug' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
          {item.item_type === 'drug' ? 'THUỐC' : 'CLS'}
        </span>
        <input className="form-control text-xs py-1 w-20 flex-shrink-0" placeholder="Mã"
          value={item.item_code ?? ''} onChange={e => updateItem(idx, 'item_code', e.target.value)} />
        <input className="form-control text-xs py-1 flex-1" placeholder="Tên thuốc / dịch vụ *"
          value={item.item_name ?? ''} onChange={e => updateItem(idx, 'item_name', e.target.value)} />
        <button type="button" onClick={() => removeItem(idx)}
          className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0">
          <Trash2 size={12} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <input className="form-control text-xs py-1" placeholder="ĐVT" title="Đơn vị tính"
          value={item.unit ?? ''} onChange={e => updateItem(idx, 'unit', e.target.value)} />
        <input type="number" className="form-control text-xs py-1" placeholder="SL" title="Số lượng"
          value={item.quantity ?? 1} min={0} step={0.5}
          onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
        <input type="number" className="form-control text-xs py-1" placeholder="Đơn giá"
          value={item.unit_price ?? ''} min={0}
          onChange={e => updateItem(idx, 'unit_price', e.target.value ? Number(e.target.value) : null)} />
        <select className="form-control text-xs py-1" value={item.payment_type ?? 'bhyt'}
          onChange={e => updateItem(idx, 'payment_type', e.target.value)}>
          {PAYMENT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {item.item_type === 'drug' && (
        <div className="grid grid-cols-3 gap-1.5">
          <input className="form-control text-xs py-1 col-span-3" placeholder="Cách dùng: sáng 1v, trưa 1v..."
            value={item.usage_instruction ?? ''}
            onChange={e => updateItem(idx, 'usage_instruction', e.target.value)} />
          <input type="date" className="form-control text-xs py-1" title="Từ ngày"
            value={item.valid_from ?? ''}
            onChange={e => updateItem(idx, 'valid_from', e.target.value)} />
          <input type="date" className="form-control text-xs py-1 col-span-2" title="Đến ngày"
            value={item.valid_to ?? ''}
            onChange={e => updateItem(idx, 'valid_to', e.target.value)} />
        </div>
      )}

      {/* Hiển thị thành tiền */}
      {item.unit_price && (
        <div className="flex justify-end">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
              ${PAYMENT_TYPE_COLOR[item.payment_type] ?? 'bg-gray-100 text-gray-600'}`}>
            {PAYMENT_TYPE_LABEL[item.payment_type]} · {fmtCurrency(Number(item.quantity || 1) * Number(item.unit_price || 0))}
          </span>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Add buttons */}
      <div className="flex gap-2 p-2 border-b border-gray-200 flex-shrink-0">
        <button onClick={() => addItem('drug')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2
                     border-dashed border-emerald-300 text-xs font-semibold text-emerald-700
                     hover:bg-emerald-50 transition-colors">
          <Pill size={13} /> + Thêm thuốc
        </button>
        <button onClick={() => addItem('cls')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2
                     border-dashed border-violet-300 text-xs font-semibold text-violet-700
                     hover:bg-violet-50 transition-colors">
          <FlaskConical size={13} /> + Thêm CLS
        </button>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-300">
            <Pill size={32} strokeWidth={1} />
            <p className="text-xs">Chưa có kê đơn</p>
          </div>
        ) : (
          items.map((item, idx) => <ItemRow key={idx} item={item} idx={idx} />)
        )}
      </div>

      {/* Cost summary */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 p-3 space-y-1.5">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Tổng chi phí</p>
        {[
          { label: 'Thuốc', value: costSummary?.drug_total ?? 0, color: 'text-emerald-700' },
          { label: 'CLS',   value: costSummary?.cls_total  ?? 0, color: 'text-violet-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold ${color}`}>{fmtCurrency(value)}</span>
          </div>
        ))}
        <div className="border-t border-gray-200 pt-1.5 mt-1.5 space-y-1">
          <div className="flex justify-between text-sm font-bold">
            <span className="text-gray-700">Tổng cộng</span>
            <span className="text-gray-900">{fmtCurrency(costSummary?.grand_total ?? 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-blue-600">BHYT thanh toán</span>
            <span className="text-blue-700 font-semibold">{fmtCurrency(costSummary?.bhyt_pays ?? 0)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-red-600">Bệnh nhân CCT</span>
            <span className="text-red-700 font-semibold">{fmtCurrency(costSummary?.patient_pays ?? 0)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main ExaminationPage ─────────────────────────────────────────────────────
export default function ExaminationPage() {
  const { receptionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [form, setForm] = useState(null)        // null = chưa init
  const [prescItems, setPrescItems] = useState([])
  const [confirmAction, setConfirmAction] = useState(null)
  const [isDirty, setIsDirty] = useState(false)

  // ── Load / tạo phiếu khám ──────────────────────────────────────────────────
  const { data: reception } = useQuery({
    queryKey: ['reception', Number(receptionId)],
    queryFn:  () => receptionApi.get(Number(receptionId)),
    enabled:  !!receptionId,
  })

  const { data: examination, isLoading } = useQuery({
    queryKey: ['examination', 'by-reception', Number(receptionId)],
    queryFn:  () => examinationApi.getByReception(Number(receptionId)),
    enabled:  !!receptionId,
    retry:    false,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['exam-history', reception?.patient_id],
    queryFn:  () => examinationApi.history(reception.patient_id),
    enabled:  !!reception?.patient_id,
  })

  // Tạo phiếu mới nếu chưa có
  const createMutation = useMutation({
    mutationFn: (data) => examinationApi.create(data),
    onSuccess: (ex) => {
      qc.setQueryData(['examination', 'by-reception', Number(receptionId)], ex)
      initForm(ex)
    },
    onError: (err) => toast.error(err.message),
  })

  // Init form từ examination data
  const initForm = useCallback((ex) => {
    if (!ex) return
    setForm({
      exam_date:           ex.exam_date ?? '',
      exam_end_date:       ex.exam_end_date ?? '',
      subject_type:        ex.subject_type ?? '',
      subject_name:        ex.subject_name ?? '',
      insurance_number:    ex.insurance_number ?? '',
      insurance_valid_from: ex.insurance_valid_from ?? '',
      insurance_valid_to:  ex.insurance_valid_to ?? '',
      referral_from_type:  ex.referral_from_type ?? '',
      referral_from_name:  ex.referral_from_name ?? '',
      referral_diagnosis:  ex.referral_diagnosis ?? '',
      clinical_symptoms:   ex.clinical_symptoms ?? '',
      doctor_name:         ex.doctor_name ?? user?.full_name ?? '',
      nurse_name:          ex.nurse_name ?? '',
      complications:       ex.complications ?? '',
      disposition:         ex.disposition ?? null,
      revisit_days:        ex.revisit_days ?? null,
      revisit_result:      ex.revisit_result ?? '',
      transfer_to_facility: ex.transfer_to_facility ?? '',
      transfer_reason:     ex.transfer_reason ?? '',
      admit_ward:          ex.admit_ward ?? '',
      admit_priority:      ex.admit_priority ?? false,
      is_near_poor:        ex.is_near_poor ?? false,
      is_poor:             ex.is_poor ?? false,
      flag_priority:       ex.flag_priority ?? false,
      diagnoses:           ex.diagnoses?.map(d => ({
        icd_code: d.icd_code ?? '', icd_name: d.icd_name, is_primary: d.is_primary, note: d.note ?? '',
      })) ?? [],
    })
    setPrescItems(ex.prescription_items?.map(p => ({
      item_type: p.item_type, item_code: p.item_code ?? '', item_name: p.item_name,
      unit: p.unit ?? '', quantity: Number(p.quantity), unit_price: p.unit_price ? Number(p.unit_price) : null,
      usage_instruction: p.usage_instruction ?? '', payment_type: p.payment_type,
      valid_from: p.valid_from ?? '', valid_to: p.valid_to ?? '',
    })) ?? [])
    setIsDirty(false)
  }, [user?.full_name])

  useEffect(() => {
    if (examination) {
      initForm(examination)
    } else if (reception && !isLoading && !examination) {
      // Tự động tạo phiếu khi bác sĩ vào
      createMutation.mutate({
        reception_id: Number(receptionId),
        patient_id:   reception.patient_id,
        subject_type:  reception.subject_type ?? '',
        subject_name:  reception.subject_name ?? '',
        insurance_number:     reception.insurance_number ?? '',
        insurance_valid_from: reception.insurance_valid_from ?? null,
        insurance_valid_to:   reception.insurance_valid_to   ?? null,
        referral_from_name:   reception.referral_facility ?? '',
        doctor_name:          user?.full_name ?? '',
        diagnoses:            [],
        prescription_items:   [],
      })
    }
  }, [examination, reception, isLoading])

  // Đánh dấu dirty khi form thay đổi
  const handleFormChange = useCallback((newForm) => {
    setForm(newForm)
    setIsDirty(true)
  }, [])
  const handleItemsChange = useCallback((items) => {
    setPrescItems(items)
    setIsDirty(true)
  }, [])

  // ── Auto-save debounced ────────────────────────────────────────────────────
  const debouncedForm  = useDebounce(form, 1500)
  const debouncedItems = useDebounce(prescItems, 1500)

  const saveMutation = useMutation({
    mutationFn: ({ id, payload }) => examinationApi.update(id, payload),
    onSuccess: () => setIsDirty(false),
    onError: () => {},  // silent auto-save
  })

  useEffect(() => {
    if (!examination?.id || !debouncedForm || !isDirty) return
    saveMutation.mutate({
      id: examination.id,
      payload: {
        ...debouncedForm,
        diagnoses: (debouncedForm.diagnoses ?? []).filter(d => d.icd_name?.trim()),
        prescription_items: debouncedItems.filter(p => p.item_name?.trim()),
      },
    })
  }, [debouncedForm, debouncedItems])

  // ── Action mutations ───────────────────────────────────────────────────────
  const manualSaveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, diagnoses: (form.diagnoses ?? []).filter(d => d.icd_name?.trim()),
                        prescription_items: prescItems.filter(p => p.item_name?.trim()) }
      return Promise.all([
        examinationApi.update(examination.id, payload),
        examinationApi.save(examination.id),
      ])
    },
    onSuccess: () => { toast.success('Đã lưu phiếu khám'); setIsDirty(false) },
    onError: (err) => toast.error(err.message),
  })

  const completeMutation = useMutation({
    mutationFn: () => examinationApi.complete(examination.id),
    onSuccess: () => {
      toast.success('✅ Đã kết thúc khám')
      qc.invalidateQueries({ queryKey: ['doctor-queue'] })
      navigate(-1)
    },
    onError: (err) => toast.error(err.message),
  })

  const skipMutation = useMutation({
    mutationFn: () => examinationApi.skip(examination.id),
    onSuccess: () => { toast('Đã bỏ qua — BN quay lại hàng đợi'); navigate(-1) },
    onError: (err) => toast.error(err.message),
  })

  // ── Cost summary (tính local từ prescItems) ────────────────────────────────
  const costSummary = useMemo(() => {
    let drugTotal = 0, clsTotal = 0, bhytPays = 0, patientPays = 0
    for (const it of prescItems) {
      const total = Number(it.quantity || 1) * Number(it.unit_price || 0)
      if (it.item_type === 'drug') drugTotal += total; else clsTotal += total
      if (it.payment_type === 'bhyt') bhytPays += total * 0.8   // ước tính 80%
      else patientPays += total
    }
    const grandTotal = drugTotal + clsTotal
    patientPays += bhytPays > 0 ? grandTotal * 0.2 : 0  // CCT 20%
    return { drug_total: drugTotal, cls_total: clsTotal, grand_total: grandTotal,
             bhyt_pays: bhytPays, patient_pays: patientPays }
  }, [prescItems])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading || createMutation.isPending || !form) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <div className="text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Đang mở phiếu khám…</p>
        </div>
      </div>
    )
  }

  const isCompleted = examination?.status === 'completed'
  const p = reception?.patient

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-gray-100">

      {/* ── Top action bar ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              Phiếu khám
              {examination?.id && <span className="text-xs font-mono text-gray-400">#{examination.id}</span>}
              {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Chưa lưu" />}
            </h1>
            <p className="text-xs text-gray-500">
              {p?.full_name ?? '…'} · {reception?.clinic_room ?? '—'} · {fmtDate(examination?.exam_date)}
            </p>
          </div>
          {isCompleted && (
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
              ✓ Hoàn tất
            </span>
          )}
        </div>

        {/* Action buttons */}
        {!isCompleted && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 accent-teal-600"
                checked={form.is_near_poor || form.is_poor}
                onChange={() => {}} readOnly />
              C/H Nghèo
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer">
              <input type="checkbox" className="w-3.5 h-3.5 accent-teal-600"
                checked={form.flag_priority}
                onChange={e => handleFormChange({ ...form, flag_priority: e.target.checked })} />
              Ưu tiên
            </label>

            <div className="w-px h-5 bg-gray-200" />

            <button onClick={() => setConfirmAction({ type: 'skip', label: 'Bỏ qua bệnh nhân' })}
              disabled={skipMutation.isPending}
              className="btn btn-ghost btn-sm gap-1 text-yellow-600 hover:bg-yellow-50">
              <SkipForward size={14} /> Bỏ qua
            </button>
            <button onClick={() => manualSaveMutation.mutate()}
              disabled={manualSaveMutation.isPending}
              className="btn btn-outline btn-sm gap-1">
              {manualSaveMutation.isPending ? <Spinner size="sm" /> : <Save size={14} />}
              Lưu
            </button>
            <button onClick={() => setConfirmAction({ type: 'complete', label: 'Kết thúc khám' })}
              disabled={completeMutation.isPending}
              className="btn btn-primary btn-sm gap-1 bg-teal-600 hover:bg-teal-700">
              <CheckCircle2 size={14} /> Kết thúc
            </button>
          </div>
        )}
      </div>

      {/* ── 3-panel body ── */}
      <div className="flex-1 flex overflow-hidden gap-1 p-1">

        {/* LEFT: Hành chính */}
        <div className="w-[270px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <PatientPanel patient={p} history={history} receptionId={Number(receptionId)} />
        </div>

        {/* MID: Khung II + III */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <ExaminationForm
            form={form}
            setForm={handleFormChange}
            receptionData={reception}
          />
        </div>

        {/* RIGHT: Kê đơn + Chi phí */}
        <div className="w-[360px] flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <PrescriptionPanel
            items={prescItems}
            onChange={handleItemsChange}
            costSummary={costSummary}
          />
        </div>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction.type === 'complete') completeMutation.mutate()
          else if (confirmAction.type === 'skip') skipMutation.mutate()
        }}
        title={confirmAction?.label}
        message={`Xác nhận: ${confirmAction?.label}?`}
        danger={confirmAction?.type === 'skip'}
        loading={completeMutation.isPending || skipMutation.isPending}
      />
    </div>
  )
}
