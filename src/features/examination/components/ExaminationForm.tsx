/**
 * ExaminationForm — II. Thông tin vào (v4)
 *
 * Checklist đã đủ:
 *   ✅ Ngày khám tự động = thời điểm mở phiếu (exam_date, hiển thị nổi bật header)
 *   ✅ exam_start_at: auto-fill khi phiếu mới, editable
 *   ✅ exam_end_at: ghi nhận thời điểm kết thúc
 *   ✅ Đối tượng thanh toán: pill selector + số thẻ BHYT + hạn thẻ
 *   ✅ Nhận từ (loại đơn vị) + Đến từ (tên đơn vị cụ thể)
 *   ✅ CĐ nơi giới thiệu (luôn show khi có referral_from_type)
 *   ✅ Triệu chứng lâm sàng (free text, gợi ý nhanh)
 *   ✅ Auto-save on blur, saving indicator
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import type { ExaminationResponse } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECT_OPTIONS = [
  { value: '1', label: 'BHYT',             color: '#1d4ed8', bg: '#dbeafe' },
  { value: '2', label: 'Thu phí',           color: '#92400e', bg: '#fef3c7' },
  { value: '3', label: 'Yêu cầu',           color: '#5b21b6', bg: '#f3e8ff' },
  { value: '4', label: 'Khám sức khoẻ',     color: '#065f46', bg: '#dcfce7' },
  { value: '5', label: 'Miễn phí',          color: '#0369a1', bg: '#e0f2fe' },
  { value: '6', label: 'Trẻ dưới 6 tuổi',  color: '#9d174d', bg: '#fce7f3' },
  { value: '7', label: 'Tiêm chủng',        color: '#166534', bg: '#dcfce7' },
];

// Label chuẩn theo nghiệp vụ Bộ Y tế
const REFERRAL_FROM_TYPES = [
  { value: 'Trạm y tế',              label: 'Trạm y tế' },
  { value: 'Bệnh viện tuyến dưới',   label: 'Bệnh viện tuyến dưới' },
  { value: 'Bệnh viện tuyến trên',   label: 'Bệnh viện tuyến trên' },
  { value: 'Phòng khám tư',          label: 'Phòng khám tư' },
  { value: 'Cơ sở y tế khác',        label: 'Cơ sở y tế khác' },
];

const SYMPTOM_TEMPLATES = [
  'Đau đầu, sốt cao',
  'Ho, khó thở',
  'Đau bụng vùng thượng vị',
  'Tái khám định kỳ',
  'Khám sức khoẻ tổng quát',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toLocal(iso?: string | null) { return iso ? iso.slice(0, 16) : ''; }
function fromLocal(val: string) { return val ? new Date(val).toISOString() : undefined; }
function fmtViDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  exam:      ExaminationResponse;
  disabled:  boolean;
  onUpdated: () => void;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const SUB_LBL: React.CSSProperties = {
  fontSize: '.65rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '.05em',
  color: 'var(--clr-gray-400)',
  marginBottom: 4,
  display: 'block',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExaminationForm({ exam, disabled, onUpdated }: Props) {
  const saveAsync = useAsync<ExaminationResponse>();

  const [subjectType,        setSubjectType]        = useState(exam.subject_type        ?? '2');
  const [insuranceNumber,    setInsuranceNumber]    = useState(exam.insurance_number    ?? '');
  const [insuranceValidFrom, setInsuranceValidFrom] = useState(exam.insurance_valid_from ?? '');
  const [insuranceValidTo,   setInsuranceValidTo]   = useState(exam.insurance_valid_to  ?? '');
  const [examStartAt,        setExamStartAt]        = useState(toLocal(exam.exam_start_at));
  const [examEndAt,          setExamEndAt]          = useState(toLocal(exam.exam_end_at));
  const [referralFromType,   setReferralFromType]   = useState(exam.referral_from_type  ?? '');
  const [referralFromName,   setReferralFromName]   = useState(exam.referral_from_name  ?? '');
  const [referralDiagnosis,  setReferralDiagnosis]  = useState(exam.referral_diagnosis  ?? '');
  const [clinicalSymptoms,   setClinicalSymptoms]   = useState(exam.clinical_symptoms   ?? '');

  // Auto-fill exam_start_at khi phiếu mới chưa có
  useEffect(() => {
    if (!exam.exam_start_at && !disabled) {
      const now = new Date().toISOString();
      const localStr = toLocal(now);
      setExamStartAt(localStr);
      // Patch ngay mà không cần blur
      examinationApi.update(exam.id, { exam_start_at: now }).then(onUpdated).catch(() => {});
    }
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSubjectType(exam.subject_type ?? '2');
    setInsuranceNumber(exam.insurance_number ?? '');
    setInsuranceValidFrom(exam.insurance_valid_from ?? '');
    setInsuranceValidTo(exam.insurance_valid_to ?? '');
    setExamStartAt(toLocal(exam.exam_start_at));
    setExamEndAt(toLocal(exam.exam_end_at));
    setReferralFromType(exam.referral_from_type ?? '');
    setReferralFromName(exam.referral_from_name ?? '');
    setReferralDiagnosis(exam.referral_diagnosis ?? '');
    setClinicalSymptoms(exam.clinical_symptoms ?? '');
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(async (patch: Record<string, unknown>) => {
    if (disabled) return;
    const res = await saveAsync.run(examinationApi.update(exam.id, patch));
    if (res) onUpdated();
    else toast.error(saveAsync.error ?? 'Lưu thất bại');
  }, [exam.id, disabled, saveAsync, onUpdated]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBhyt = subjectType === '1';
  const selectedSubject = SUBJECT_OPTIONS.find(o => o.value === subjectType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── NGÀY KHÁM — header nổi bật ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px',
        marginBottom: 16,
        background: 'linear-gradient(90deg, #eff6ff, #e0f2fe)',
        border: '1px solid #bfdbfe',
        borderRadius: 9,
      }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>📆</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.65rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
            Ngày khám
          </div>
          <div style={{ fontWeight: 700, color: '#1e3a5f', fontSize: '.9rem', lineHeight: 1.3 }}>
            {exam.exam_date
              ? fmtViDate(exam.exam_date)
              : fmtViDate(new Date().toISOString())}
          </div>
        </div>
        {/* Trạng thái phiếu */}
        <ExamDateBadge status={exam.status} />
      </div>

      {/* ── GROUP 1: Đối tượng thanh toán ───────────────────────────────── */}
      <FieldGroup label="Đối tượng thanh toán">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SUBJECT_OPTIONS.map(o => {
            const sel = subjectType === o.value;
            return (
              <button
                key={o.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setSubjectType(o.value);
                  save({ subject_type: o.value, subject_name: o.label });
                }}
                aria-pressed={sel}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px',
                  borderRadius: 9999,
                  border: `1.5px solid ${sel ? o.color : 'var(--clr-gray-200)'}`,
                  background: sel ? o.bg : '#fff',
                  color: sel ? o.color : 'var(--clr-gray-500)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '.78rem',
                  fontWeight: sel ? 700 : 400,
                  cursor: disabled ? 'default' : 'pointer',
                  transition: 'all .12s',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {sel && <span style={{ fontSize: '.65rem' }}>✓</span>}
                <span style={{ fontSize: '.68rem', opacity: .6 }}>{o.value}.</span>
                {o.label}
              </button>
            );
          })}
        </div>

        {/* BHYT fields */}
        {isBhyt && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Số thẻ */}
            <div>
              <label style={SUB_LBL}>Số thẻ BHYT <span style={{ color: 'var(--clr-danger)' }}>*</span></label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  value={insuranceNumber}
                  disabled={disabled}
                  placeholder="VD: DN4010000000001"
                  style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.04em', paddingRight: 44 }}
                  onChange={e => setInsuranceNumber(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.insurance_number ?? ''))
                      save({ insurance_number: e.target.value || null });
                  }}
                />
                <span style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  fontSize: '.6rem', fontWeight: 700,
                  background: '#dbeafe', color: '#1d4ed8',
                  padding: '1px 5px', borderRadius: 3,
                  pointerEvents: 'none',
                }}>BHYT</span>
              </div>
            </div>

            {/* Hiệu lực */}
            <div>
              <label style={SUB_LBL}>Hiệu lực thẻ</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="date" className="form-input"
                    value={insuranceValidFrom} disabled={disabled}
                    title="Hiệu lực từ ngày"
                    onChange={e => setInsuranceValidFrom(e.target.value)}
                    onBlur={e => {
                      if (e.target.value !== (exam.insurance_valid_from ?? ''))
                        save({ insurance_valid_from: e.target.value || null });
                    }}
                  />
                </div>
                <span style={{ fontSize: '.72rem', color: 'var(--clr-gray-400)', flexShrink: 0 }}>→</span>
                <div style={{ flex: 1 }}>
                  <input
                    type="date" className="form-input"
                    value={insuranceValidTo} disabled={disabled}
                    title="Hiệu lực đến ngày"
                    onChange={e => setInsuranceValidTo(e.target.value)}
                    onBlur={e => {
                      if (e.target.value !== (exam.insurance_valid_to ?? ''))
                        save({ insurance_valid_to: e.target.value || null });
                    }}
                  />
                </div>
              </div>
              {insuranceValidTo && (
                <div style={{ marginTop: 5 }}>
                  <InsuranceStatusChip validTo={insuranceValidTo} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Non-BHYT notice */}
        {!isBhyt && selectedSubject && (
          <div style={{
            marginTop: 10,
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: selectedSubject.bg + '70',
            border: `1px solid ${selectedSubject.color}22`,
            borderRadius: 7,
          }}>
            <span style={{ fontSize: '.7rem' }}>ℹ️</span>
            <span style={{ fontSize: '.77rem', color: selectedSubject.color, fontWeight: 600 }}>
              Đối tượng {selectedSubject.label} — không cần số thẻ BHYT
            </span>
          </div>
        )}
      </FieldGroup>

      <GroupDivider />

      {/* ── GROUP 2: Thời gian khám ─────────────────────────────────────── */}
      <FieldGroup
        label="Thời gian khám"
        hint={saveAsync.loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--clr-primary)' }}>
            <span className="spinner spinner-sm" style={{ width: 9, height: 9 }} />
            Đang lưu…
          </span>
        ) : undefined}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={SUB_LBL}>
              Bắt đầu khám
              {exam.exam_date && (
                <span style={{ fontWeight: 400, marginLeft: 5, textTransform: 'none' as const, color: 'var(--clr-gray-400)' }}>
                  ({new Date(exam.exam_date).toLocaleDateString('vi-VN')})
                </span>
              )}
            </label>
            <input
              type="datetime-local" className="form-input"
              value={examStartAt} disabled={disabled}
              onChange={e => setExamStartAt(e.target.value)}
              onBlur={e => {
                const v = fromLocal(e.target.value);
                if (v !== (exam.exam_start_at ?? undefined)) save({ exam_start_at: v ?? null });
              }}
            />
          </div>
          <div>
            <label style={SUB_LBL}>Kết thúc khám</label>
            <input
              type="datetime-local" className="form-input"
              value={examEndAt} disabled={disabled}
              onChange={e => setExamEndAt(e.target.value)}
              onBlur={e => {
                const v = fromLocal(e.target.value);
                if (v !== (exam.exam_end_at ?? undefined)) save({ exam_end_at: v ?? null });
              }}
            />
          </div>
        </div>

        {/* Duration display */}
        {examStartAt && examEndAt && (
          <div style={{ marginTop: 6 }}>
            <DurationChip start={examStartAt} end={examEndAt} />
          </div>
        )}
      </FieldGroup>

      <GroupDivider />

      {/* ── GROUP 3: Nguồn chuyển đến (Nhận từ / Đến từ) ───────────────── */}
      <FieldGroup label="Nguồn chuyển đến">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Nhận từ — loại đơn vị giới thiệu */}
          <div>
            <label style={SUB_LBL}>
              Nhận từ
              <span style={{ fontWeight: 400, textTransform: 'none' as const, marginLeft: 4 }}>
                (loại đơn vị)
              </span>
            </label>
            <select
              className="form-input"
              value={referralFromType} disabled={disabled}
              onChange={e => {
                setReferralFromType(e.target.value);
                if (!e.target.value) {
                  // Clear referral fields when reset to "tự đến"
                  setReferralFromName('');
                  setReferralDiagnosis('');
                  save({ referral_from_type: null, referral_from_name: null, referral_diagnosis: null });
                } else {
                  save({ referral_from_type: e.target.value });
                }
              }}
            >
              <option value="">— Bệnh nhân tự đến —</option>
              {REFERRAL_FROM_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Đến từ — tên đơn vị cụ thể */}
          <div>
            <label style={SUB_LBL}>
              Đến từ
              <span style={{ fontWeight: 400, textTransform: 'none' as const, marginLeft: 4 }}>
                (tên đơn vị)
              </span>
            </label>
            <input
              className="form-input"
              value={referralFromName}
              disabled={disabled || !referralFromType}
              placeholder={referralFromType ? 'Nhập tên cụ thể đơn vị giới thiệu...' : '— Không áp dụng —'}
              style={!referralFromType ? {
                background: 'var(--clr-gray-50)',
                color: 'var(--clr-gray-400)',
                cursor: 'not-allowed',
              } : {}}
              onChange={e => setReferralFromName(e.target.value)}
              onBlur={e => {
                if (e.target.value !== (exam.referral_from_name ?? ''))
                  save({ referral_from_name: e.target.value || null });
              }}
            />
          </div>
        </div>

        {/* CĐ nơi giới thiệu — luôn show khi có referral_from_type */}
        {referralFromType && (
          <div style={{ marginTop: 10 }}>
            <label style={SUB_LBL}>
              CĐ nơi giới thiệu
              <span style={{ fontWeight: 400, textTransform: 'none' as const, marginLeft: 4, color: 'var(--clr-gray-500)' }}>
                (chẩn đoán / lý do từ giấy chuyển tuyến)
              </span>
            </label>
            <textarea
              className="form-input" rows={2}
              value={referralDiagnosis} disabled={disabled}
              placeholder="Chẩn đoán và lý do ghi trên giấy chuyển tuyến, giấy giới thiệu..."
              style={{ resize: 'vertical' }}
              onChange={e => setReferralDiagnosis(e.target.value)}
              onBlur={e => {
                if (e.target.value !== (exam.referral_diagnosis ?? ''))
                  save({ referral_diagnosis: e.target.value || null });
              }}
            />
          </div>
        )}

        {/* Context: bệnh nhân tự đến */}
        {!referralFromType && (
          <div style={{
            marginTop: 8,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px',
            background: 'var(--clr-gray-50)',
            border: '1px solid var(--clr-gray-200)',
            borderRadius: 6,
            fontSize: '.72rem', color: 'var(--clr-gray-500)',
          }}>
            <span>🚶</span> Bệnh nhân tự đến — không có giấy giới thiệu
          </div>
        )}
      </FieldGroup>

      <GroupDivider />

      {/* ── GROUP 4: Triệu chứng lâm sàng ───────────────────────────────── */}
      <FieldGroup
        label="Triệu chứng lâm sàng"
        required
        hint={
          saveAsync.loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--clr-primary)' }}>
              <span className="spinner spinner-sm" style={{ width: 9, height: 9 }} />
              Đang lưu
            </span>
          ) : (
            <span style={{ color: 'var(--clr-gray-400)', fontSize: '.68rem' }}>
              {clinicalSymptoms.length} ký tự
            </span>
          )
        }
      >
        <textarea
          className="form-input"
          rows={7}
          value={clinicalSymptoms}
          disabled={disabled}
          placeholder="Mô tả chi tiết triệu chứng, dấu hiệu lâm sàng, lý do vào khám, tiền sử bệnh liên quan..."
          style={{ resize: 'vertical', minHeight: 140, lineHeight: 1.7 }}
          onChange={e => setClinicalSymptoms(e.target.value)}
          onBlur={e => {
            if (e.target.value !== (exam.clinical_symptoms ?? ''))
              save({ clinical_symptoms: e.target.value || null });
          }}
        />

        {/* Quick templates — chỉ khi textarea trống */}
        {!disabled && clinicalSymptoms.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: '.65rem', color: 'var(--clr-gray-400)', flexShrink: 0 }}>Gợi ý:</span>
            {SYMPTOM_TEMPLATES.map(tpl => (
              <button
                key={tpl}
                type="button"
                onClick={() => {
                  setClinicalSymptoms(tpl);
                  save({ clinical_symptoms: tpl });
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '2px 10px',
                  border: '1px dashed var(--clr-gray-300)',
                  borderRadius: 9999,
                  background: 'transparent',
                  color: 'var(--clr-gray-500)',
                  fontSize: '.7rem',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all .12s',
                }}
              >
                {tpl}
              </button>
            ))}
          </div>
        )}
      </FieldGroup>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────────────

function FieldGroup({
  label, required, hint, children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '2px 0 14px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 9,
      }}>
        <div style={{
          fontSize: '.72rem', fontWeight: 700,
          color: 'var(--clr-gray-600)',
          textTransform: 'uppercase' as const,
          letterSpacing: '.06em',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {label}
          {required && <span style={{ color: 'var(--clr-danger)' }}>*</span>}
        </div>
        {hint && (
          <div style={{ fontSize: '.68rem' }}>{hint}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function GroupDivider() {
  return <div style={{ height: 1, background: 'var(--clr-gray-100)', margin: '4px 0 14px' }} />;
}

/** Badge trạng thái exam nhỏ gọn */
function ExamDateBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:     { label: 'Đang khám',  bg: '#dbeafe', color: '#1d4ed8' },
    saved:     { label: 'Đã lưu',    bg: '#fef3c7', color: '#92400e' },
    completed: { label: 'Hoàn tất',  bg: '#dcfce7', color: '#15803d' },
  };
  const s = map[status] ?? map.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 9999,
      background: s.bg, color: s.color,
      fontSize: '.72rem', fontWeight: 700,
      flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

/** Hiển thị thời gian khám (start → end = X phút) */
function DurationChip({ start, end }: { start: string; end: string }) {
  const startMs = new Date(start).getTime();
  const endMs   = new Date(end).getTime();
  if (endMs <= startMs) return null;
  const mins = Math.round((endMs - startMs) / 60000);
  const hrs  = Math.floor(mins / 60);
  const rem  = mins % 60;
  const label = hrs > 0 ? `${hrs}h${rem > 0 ? ` ${rem}ph` : ''}` : `${mins} phút`;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      background: '#f0fdf4', border: '1px solid #86efac',
      borderRadius: 6,
      fontSize: '.72rem', color: '#166534', fontWeight: 600,
    }}>
      ⏱ Thời gian khám: <strong>{label}</strong>
    </div>
  );
}

/** InsuranceStatusChip — compact */
function InsuranceStatusChip({ validTo }: { validTo: string }) {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const expiry   = new Date(validTo);
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  const expired  = daysLeft < 0;
  const warning  = !expired && daysLeft <= 30;

  const cfg = expired
    ? { icon: '❌', bg: '#fee2e2', border: '#fca5a5', color: '#991b1b',
        text: `Hết hạn ${Math.abs(daysLeft)} ngày trước` }
    : warning
      ? { icon: '⚠️', bg: '#fef3c7', border: '#fcd34d', color: '#92400e',
          text: `Còn ${daysLeft} ngày — sắp hết hạn` }
      : { icon: '✅', bg: '#dcfce7', border: '#86efac', color: '#166534',
          text: `Còn hiệu lực đến ${new Date(validTo).toLocaleDateString('vi-VN')}` };

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 11px', borderRadius: 7,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      color: cfg.color, fontSize: '.77rem', fontWeight: 600,
    }}>
      <span>{cfg.icon}</span>
      <span>{cfg.text}</span>
    </div>
  );
}
