/**
 * ExamInfoSection — Khung III: Thông tin khám
 *
 * Gồm:
 * - Bác sĩ điều trị + Điều dưỡng phụ trách (tự điền từ login / phân công)
 * - Chẩn đoán ICD-10 (chính + kèm theo) — delegate sang DiagnosisPanel
 * - Biến chứng (free text)
 * - Hướng xử trí: 11 checkbox loại trừ lẫn nhau
 *   Mỗi lựa chọn kích hoạt sub-form riêng:
 *     • Hẹn tái khám   → số ngày + kết quả điều trị
 *     • Nhập viện      → khoa/phòng + ưu tiên
 *     • Chuyển tuyến   → nơi chuyển + tên bệnh viện + lý do
 * - Checkbox nhanh: C/H Nghèo, Ưu tiên
 *
 * Auto-save từng field khi blur. Disposition thay đổi → save ngay.
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import { Field } from '@components/ui';
import DiagnosisPanel from './DiagnosisPanel';
import type { ExaminationResponse, DispositionType } from '@/types';

// ── Disposition definitions ────────────────────────────────────────────────────

interface DispositionDef {
  value: DispositionType;
  label: string;
  icon:  string;
  color: string;
}

const DISPOSITIONS: DispositionDef[] = [
  { value: 'emergency',       label: 'Cấp cứu',               icon: '🚨', color: '#dc2626' },
  { value: 'outpatient',      label: 'Điều trị ngoại trú',    icon: '🏠', color: '#2563eb' },
  { value: 'revisit',         label: 'Hẹn tái khám',          icon: '📅', color: '#7c3aed' },
  { value: 'inpatient_ward',  label: 'Chuyển phòng lưu',      icon: '🛏️', color: '#0891b2' },
  { value: 'inpatient',       label: 'Nhập viện',              icon: '🏥', color: '#b45309' },
  { value: 'transfer_out',    label: 'Chuyển tuyến',           icon: '🚑', color: '#be185d' },
  { value: 'deceased',        label: 'Tử vong',                icon: '🕊️', color: '#374151' },
  { value: 'transfer_clinic', label: 'Chuyển phòng khám',     icon: '🔀', color: '#0d9488' },
  { value: 'leave_ama',       label: 'Bỏ về',                  icon: '🚶', color: '#9a3412' },
  { value: 'discharged',      label: 'Khám xong cho về',       icon: '✅', color: '#065f46' },
  { value: 'chronic_script',  label: 'Cấp toa bệnh mãn tính', icon: '💊', color: '#1e3a5f' },
];

const REVISIT_RESULTS = [
  { value: 'no_change', label: 'Không thay đổi' },
  { value: 'better',    label: 'Đỡ' },
  { value: 'cured',     label: 'Khỏi' },
  { value: 'worse',     label: 'Nặng hơn' },
  { value: 'refer',     label: 'Chuyển tuyến' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  exam:      ExaminationResponse;
  disabled:  boolean;
  onUpdated: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExamInfoSection({ exam, disabled, onUpdated }: Props) {
  const saveAsync = useAsync<ExaminationResponse>();

  // ── Local state ──────────────────────────────────────────────────────────────
  const [doctorName,          setDoctorName]          = useState(exam.doctor_name          ?? '');
  const [nurseName,           setNurseName]           = useState(exam.nurse_name           ?? '');
  const [complications,       setComplications]       = useState(exam.complications        ?? '');
  const [disposition,         setDisposition]         = useState<DispositionType | ''>(exam.disposition ?? '');
  const [revisitDays,         setRevisitDays]         = useState(String(exam.revisit_days  ?? ''));
  const [revisitResult,       setRevisitResult]       = useState(exam.revisit_result       ?? '');
  const [admitWard,           setAdmitWard]           = useState(exam.admit_ward           ?? '');
  const [admitPriority,       setAdmitPriority]       = useState(exam.admit_priority       ?? false);
  const [transferToFacility,  setTransferToFacility]  = useState(exam.transfer_to_facility ?? '');
  const [transferReason,      setTransferReason]      = useState(exam.transfer_reason      ?? '');
  const [isNearPoor,          setIsNearPoor]          = useState(exam.is_near_poor         ?? false);
  const [isPoor,              setIsPoor]              = useState(exam.is_poor              ?? false);
  const [flagPriority,        setFlagPriority]        = useState(exam.flag_priority        ?? false);

  // Re-sync on exam reload
  useEffect(() => {
    setDoctorName(exam.doctor_name ?? '');
    setNurseName(exam.nurse_name ?? '');
    setComplications(exam.complications ?? '');
    setDisposition(exam.disposition ?? '');
    setRevisitDays(String(exam.revisit_days ?? ''));
    setRevisitResult(exam.revisit_result ?? '');
    setAdmitWard(exam.admit_ward ?? '');
    setAdmitPriority(exam.admit_priority ?? false);
    setTransferToFacility(exam.transfer_to_facility ?? '');
    setTransferReason(exam.transfer_reason ?? '');
    setIsNearPoor(exam.is_near_poor ?? false);
    setIsPoor(exam.is_poor ?? false);
    setFlagPriority(exam.flag_priority ?? false);
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save helper ───────────────────────────────────────────────────────────────
  const save = useCallback(async (patch: Record<string, unknown>) => {
    if (disabled) return;
    const res = await saveAsync.run(examinationApi.update(exam.id, patch));
    if (res) onUpdated();
    else toast.error(saveAsync.error ?? 'Lưu thất bại');
  }, [exam.id, disabled, saveAsync, onUpdated]);

  // ── Disposition select ────────────────────────────────────────────────────────
  const handleDisposition = (val: DispositionType) => {
    const newVal = val === disposition ? '' : val;
    setDisposition(newVal as DispositionType | '');
    save({ disposition: newVal || null });
  };

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--clr-gray-200)',
    borderRadius: 10,
    overflow: 'hidden',
  };
  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px',
    background: 'var(--clr-gray-50)',
    borderBottom: '1px solid var(--clr-gray-200)',
    fontWeight: 700, fontSize: '.85rem', color: 'var(--clr-gray-700)',
  };
  const bodyStyle: React.CSSProperties = {
    padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12,
  };

  const selectedDef = DISPOSITIONS.find(d => d.value === disposition);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Bác sĩ + Điều dưỡng ──────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>👨‍⚕️</span> Nhân lực phụ trách
        </div>
        <div style={bodyStyle}>
          <div className="form-row form-row-2">
            <Field label="Bác sĩ điều trị">
              <input
                className="form-input"
                value={doctorName}
                disabled={disabled}
                placeholder="Họ tên bác sĩ điều trị..."
                onChange={e => setDoctorName(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (exam.doctor_name ?? ''))
                    save({ doctor_name: e.target.value || null });
                }}
              />
            </Field>
            <Field label="Điều dưỡng phụ trách">
              <input
                className="form-input"
                value={nurseName}
                disabled={disabled}
                placeholder="Họ tên điều dưỡng..."
                onChange={e => setNurseName(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (exam.nurse_name ?? ''))
                    save({ nurse_name: e.target.value || null });
                }}
              />
            </Field>
          </div>

          {/* Checkbox nhanh */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', paddingTop: 4 }}>
            {[
              { label: 'C/H Nghèo',  checked: isNearPoor, key: 'is_near_poor', set: setIsNearPoor },
              { label: 'Hộ nghèo',   checked: isPoor,     key: 'is_poor',      set: setIsPoor },
              { label: 'Ưu tiên',    checked: flagPriority, key: 'flag_priority', set: setFlagPriority },
            ].map(({ label, checked, key, set }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: disabled ? 'default' : 'pointer', fontSize: '.85rem' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={e => {
                    set(e.target.checked);
                    save({ [key]: e.target.checked });
                  }}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chẩn đoán ICD-10 ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>🏷️</span> Chẩn đoán ICD-10
          <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--clr-gray-400)', fontWeight: 400 }}>
            Chính + kèm theo
          </span>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <DiagnosisPanel
            examId={exam.id}
            diagnoses={exam.diagnoses}
            disabled={disabled}
            onChanged={onUpdated}
          />
        </div>
      </div>

      {/* ── Biến chứng ────────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>⚠️</span> Biến chứng
        </div>
        <div style={bodyStyle}>
          <textarea
            className="form-input"
            rows={2}
            value={complications}
            disabled={disabled}
            placeholder="Ghi nhận biến chứng nếu có..."
            onChange={e => setComplications(e.target.value)}
            onBlur={e => {
              if (e.target.value !== (exam.complications ?? ''))
                save({ complications: e.target.value || null });
            }}
          />
        </div>
      </div>

      {/* ── Hướng xử trí ─────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>🔀</span> Hướng xử trí
          {selectedDef && (
            <span style={{
              marginLeft: 8, fontSize: '.78rem', fontWeight: 600,
              color: selectedDef.color,
              background: selectedDef.color + '18',
              padding: '2px 10px', borderRadius: 999,
            }}>
              {selectedDef.icon} {selectedDef.label}
            </span>
          )}
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Checkbox grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
          }}>
            {DISPOSITIONS.map(def => {
              const selected = disposition === def.value;
              return (
                <button
                  key={def.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleDisposition(def.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '9px 12px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
                    border: `2px solid ${selected ? def.color : 'var(--clr-gray-200)'}`,
                    background: selected ? def.color + '12' : '#fff',
                    fontFamily: 'var(--font-sans)', fontSize: '.82rem', fontWeight: selected ? 700 : 400,
                    color: selected ? def.color : 'var(--clr-gray-700)',
                    transition: 'all .12s',
                    textAlign: 'left',
                  }}
                  aria-pressed={selected}
                >
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{def.icon}</span>
                  {def.label}
                  {selected && (
                    <span style={{
                      marginLeft: 'auto', width: 16, height: 16, borderRadius: '50%',
                      background: def.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: '#fff', fontSize: '.65rem', flexShrink: 0,
                    }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Sub-form: Hẹn tái khám ──────────────────────────────────────── */}
          {disposition === 'revisit' && (
            <div style={{
              padding: 14, background: '#f5f3ff', border: '1px solid #c4b5fd',
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#5b21b6' }}>
                📅 Chi tiết hẹn tái khám
              </div>
              <div className="form-row form-row-2">
                <Field label="Số ngày hẹn tái khám">
                  <input
                    type="number" min={1} className="form-input"
                    value={revisitDays} disabled={disabled}
                    placeholder="VD: 30"
                    onChange={e => setRevisitDays(e.target.value)}
                    onBlur={e => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== exam.revisit_days) save({ revisit_days: v });
                    }}
                  />
                  {revisitDays && Number(revisitDays) > 0 && (
                    <div style={{ fontSize: '.75rem', color: '#7c3aed', marginTop: 4 }}>
                      → Hẹn lại:{' '}
                      {new Date(Date.now() + Number(revisitDays) * 86400000)
                        .toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  )}
                </Field>
                <Field label="Kết quả điều trị">
                  <select
                    className="form-input"
                    value={revisitResult} disabled={disabled}
                    onChange={e => {
                      setRevisitResult(e.target.value);
                      save({ revisit_result: e.target.value || null });
                    }}
                  >
                    <option value="">— Chọn kết quả —</option>
                    {REVISIT_RESULTS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── Sub-form: Nhập viện ─────────────────────────────────────────── */}
          {(disposition === 'inpatient' || disposition === 'inpatient_ward') && (
            <div style={{
              padding: 14, background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#b45309' }}>
                🏥 Chi tiết nhập viện / phòng lưu
              </div>
              <div className="form-row form-row-2">
                <Field label="Vào khoa / phòng (Vào KP)">
                  <input
                    className="form-input"
                    value={admitWard} disabled={disabled}
                    placeholder="VD: Khoa Nội, Phòng 201..."
                    onChange={e => setAdmitWard(e.target.value)}
                    onBlur={e => {
                      if (e.target.value !== (exam.admit_ward ?? ''))
                        save({ admit_ward: e.target.value || null });
                    }}
                  />
                </Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 22 }}>
                  <input
                    type="checkbox" id="admit_priority"
                    checked={admitPriority} disabled={disabled}
                    onChange={e => {
                      setAdmitPriority(e.target.checked);
                      save({ admit_priority: e.target.checked });
                    }}
                  />
                  <label htmlFor="admit_priority" style={{ fontSize: '.85rem', cursor: 'pointer', color: '#b45309', fontWeight: 600 }}>
                    ⚡ Ưu tiên nhập viện nhanh
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Sub-form: Chuyển tuyến ──────────────────────────────────────── */}
          {disposition === 'transfer_out' && (
            <div style={{
              padding: 14, background: '#fdf2f8', border: '1px solid #f0abfc',
              borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: '#be185d' }}>
                🚑 Chi tiết chuyển tuyến
              </div>
              <Field label="Chuyển đến bệnh viện / cơ sở">
                <input
                  className="form-input"
                  value={transferToFacility} disabled={disabled}
                  placeholder="Tên bệnh viện nhận..."
                  onChange={e => setTransferToFacility(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.transfer_to_facility ?? ''))
                      save({ transfer_to_facility: e.target.value || null });
                  }}
                />
              </Field>
              <Field label="Lý do chuyển tuyến">
                <textarea
                  className="form-input" rows={2}
                  value={transferReason} disabled={disabled}
                  placeholder="Lý do / tóm tắt bệnh án chuyển tuyến..."
                  onChange={e => setTransferReason(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.transfer_reason ?? ''))
                      save({ transfer_reason: e.target.value || null });
                  }}
                />
              </Field>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
