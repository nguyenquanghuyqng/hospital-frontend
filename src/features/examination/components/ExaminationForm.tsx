/**
 * ExaminationForm — Khung II: Thông tin vào
 *
 * Gồm:
 * - Thời điểm bắt đầu / kết thúc khám (ngày khám tự động = lúc mở phiếu)
 * - Đối tượng thanh toán (BHYT/Thu phí/...) + số thẻ + hạn thẻ
 * - Nguồn chuyển đến: Nhận từ (loại đơn vị) + Đến từ (tên đơn vị)
 * - Chẩn đoán nơi giới thiệu (CĐ nơi giới thiệu)
 * - Triệu chứng lâm sàng (free text, auto-save onBlur)
 *
 * Tất cả field auto-save riêng lẻ khi blur để tránh mất dữ liệu.
 * Controlled form: nhận `exam` từ parent, gọi `onUpdated` sau mỗi lưu.
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import { Field } from '@components/ui';
import type { ExaminationResponse } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUBJECT_OPTIONS = [
  { value: '1', label: '1 - BHYT' },
  { value: '2', label: '2 - Thu phí' },
  { value: '3', label: '3 - Yêu cầu' },
  { value: '4', label: '4 - Khám sức khỏe' },
  { value: '5', label: '5 - Miễn phí' },
  { value: '6', label: '6 - Trẻ dưới 6 tuổi' },
  { value: '7', label: '7 - Tiêm chủng' },
];

const REFERRAL_FROM_TYPES = [
  'Trạm y tế',
  'Bệnh viện tuyến dưới',
  'Bệnh viện tuyến trên',
  'Phòng khám tư',
  'Cơ sở y tế khác',
  'Tự đến',
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  exam:       ExaminationResponse;
  disabled:   boolean;
  onUpdated:  () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Chuyển datetime ISO → "datetime-local" input value (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 16); // "2026-01-15T09:30"
}

/** Chuyển "datetime-local" input value → ISO string */
function fromDatetimeLocal(val: string): string | undefined {
  if (!val) return undefined;
  return new Date(val).toISOString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExaminationForm({ exam, disabled, onUpdated }: Props) {
  const saveAsync = useAsync<ExaminationResponse>();

  // ── Local state (mirror exam fields) ────────────────────────────────────────
  const [subjectType,        setSubjectType]        = useState(exam.subject_type        ?? '1');
  const [insuranceNumber,    setInsuranceNumber]    = useState(exam.insurance_number    ?? '');
  const [insuranceValidFrom, setInsuranceValidFrom] = useState(exam.insurance_valid_from ?? '');
  const [insuranceValidTo,   setInsuranceValidTo]   = useState(exam.insurance_valid_to  ?? '');
  const [examStartAt,        setExamStartAt]        = useState(toDatetimeLocal(exam.exam_start_at));
  const [examEndAt,          setExamEndAt]          = useState(toDatetimeLocal(exam.exam_end_at));
  const [referralFromType,   setReferralFromType]   = useState(exam.referral_from_type  ?? '');
  const [referralFromName,   setReferralFromName]   = useState(exam.referral_from_name  ?? '');
  const [referralDiagnosis,  setReferralDiagnosis]  = useState(exam.referral_diagnosis  ?? '');
  const [clinicalSymptoms,   setClinicalSymptoms]   = useState(exam.clinical_symptoms   ?? '');

  // Re-sync nếu parent reload exam
  useEffect(() => {
    setSubjectType(exam.subject_type ?? '1');
    setInsuranceNumber(exam.insurance_number ?? '');
    setInsuranceValidFrom(exam.insurance_valid_from ?? '');
    setInsuranceValidTo(exam.insurance_valid_to ?? '');
    setExamStartAt(toDatetimeLocal(exam.exam_start_at));
    setExamEndAt(toDatetimeLocal(exam.exam_end_at));
    setReferralFromType(exam.referral_from_type ?? '');
    setReferralFromName(exam.referral_from_name ?? '');
    setReferralDiagnosis(exam.referral_diagnosis ?? '');
    setClinicalSymptoms(exam.clinical_symptoms ?? '');
  }, [exam.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save helpers ─────────────────────────────────────────────────────────────

  const save = useCallback(async (patch: Record<string, unknown>, successMsg?: string) => {
    if (disabled) return;
    const res = await saveAsync.run(examinationApi.update(exam.id, patch));
    if (res) {
      if (successMsg) toast.success(successMsg);
      onUpdated();
    } else {
      toast.error(saveAsync.error ?? 'Lưu thất bại');
    }
  }, [exam.id, disabled, saveAsync, onUpdated]);

  // ── Derived: hiển thị BHYT fields ────────────────────────────────────────────
  const isBhyt = subjectType === '1';

  // ── Sub-section: header ───────────────────────────────────────────────────────
  const sectionStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid var(--clr-gray-200)',
    borderRadius: 10,
    overflow: 'hidden',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
    background: 'var(--clr-gray-50)',
    borderBottom: '1px solid var(--clr-gray-200)',
    fontWeight: 700,
    fontSize: '.85rem',
    color: 'var(--clr-gray-700)',
  };

  const bodyStyle: React.CSSProperties = {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Thời điểm khám ──────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>🕐</span> Thời điểm khám
        </div>
        <div style={bodyStyle}>
          <div className="form-row form-row-2">
            <Field label="Bắt đầu khám">
              <input
                type="datetime-local"
                className="form-input"
                value={examStartAt}
                disabled={disabled}
                onChange={e => setExamStartAt(e.target.value)}
                onBlur={e => {
                  const v = fromDatetimeLocal(e.target.value);
                  if (v !== (exam.exam_start_at ?? undefined)) save({ exam_start_at: v });
                }}
              />
            </Field>
            <Field label="Kết thúc khám">
              <input
                type="datetime-local"
                className="form-input"
                value={examEndAt}
                disabled={disabled}
                onChange={e => setExamEndAt(e.target.value)}
                onBlur={e => {
                  const v = fromDatetimeLocal(e.target.value);
                  if (v !== (exam.exam_end_at ?? undefined)) save({ exam_end_at: v });
                }}
              />
            </Field>
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--clr-gray-400)' }}>
            📅 Ngày khám: <strong>{new Date(exam.exam_date).toLocaleDateString('vi-VN')}</strong>
            {exam.exam_start_at && (
              <span style={{ marginLeft: 12 }}>
                ⏱ Ghi nhận lúc: <strong>{new Date(exam.exam_start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Đối tượng thanh toán ─────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>💳</span> Đối tượng thanh toán
        </div>
        <div style={bodyStyle}>
          <div className="form-row form-row-2">
            <Field label="Đối tượng">
              <select
                className="form-input"
                value={subjectType}
                disabled={disabled}
                onChange={e => setSubjectType(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== exam.subject_type)
                    save({
                      subject_type: e.target.value,
                      subject_name: SUBJECT_OPTIONS.find(o => o.value === e.target.value)?.label ?? '',
                    });
                }}
              >
                {SUBJECT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Số thẻ BHYT">
              <input
                className="form-input"
                value={insuranceNumber}
                disabled={disabled || !isBhyt}
                placeholder={isBhyt ? 'VD: DN4010000000001' : '— Không áp dụng —'}
                style={!isBhyt ? { background: 'var(--clr-gray-100)', color: 'var(--clr-gray-400)' } : {}}
                onChange={e => setInsuranceNumber(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (exam.insurance_number ?? ''))
                    save({ insurance_number: e.target.value || null });
                }}
              />
            </Field>
          </div>

          {isBhyt && (
            <div className="form-row form-row-2">
              <Field label="Từ ngày (BHYT)">
                <input
                  type="date"
                  className="form-input"
                  value={insuranceValidFrom}
                  disabled={disabled}
                  onChange={e => setInsuranceValidFrom(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.insurance_valid_from ?? ''))
                      save({ insurance_valid_from: e.target.value || null });
                  }}
                />
              </Field>
              <Field label="Đến ngày (BHYT)">
                <input
                  type="date"
                  className="form-input"
                  value={insuranceValidTo}
                  disabled={disabled}
                  onChange={e => setInsuranceValidTo(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.insurance_valid_to ?? ''))
                      save({ insurance_valid_to: e.target.value || null });
                  }}
                />
              </Field>
            </div>
          )}

          {/* Hiển thị trạng thái BHYT */}
          {isBhyt && insuranceValidTo && (
            <InsuranceStatus validTo={insuranceValidTo} cardNumber={insuranceNumber} />
          )}
        </div>
      </div>

      {/* ── Nguồn chuyển đến ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>🏥</span> Nguồn chuyển đến / giới thiệu
        </div>
        <div style={bodyStyle}>
          <div className="form-row form-row-2">
            <Field label='Nhận từ (loại đơn vị)'>
              <select
                className="form-input"
                value={referralFromType}
                disabled={disabled}
                onChange={e => setReferralFromType(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (exam.referral_from_type ?? ''))
                    save({ referral_from_type: e.target.value || null });
                }}
              >
                <option value="">— Bệnh nhân tự đến —</option>
                {REFERRAL_FROM_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            <Field label='Đến từ (tên đơn vị cụ thể)'>
              <input
                className="form-input"
                value={referralFromName}
                disabled={disabled || !referralFromType}
                placeholder={referralFromType ? 'Tên cơ sở y tế giới thiệu...' : '— Không có —'}
                style={!referralFromType ? { background: 'var(--clr-gray-100)', color: 'var(--clr-gray-400)' } : {}}
                onChange={e => setReferralFromName(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (exam.referral_from_name ?? ''))
                    save({ referral_from_name: e.target.value || null });
                }}
              />
            </Field>
          </div>

          {referralFromType && referralFromType !== 'Tự đến' && (
            <Field label='CĐ nơi giới thiệu (chẩn đoán từ nơi giới thiệu)'>
              <textarea
                className="form-input"
                rows={2}
                value={referralDiagnosis}
                disabled={disabled}
                placeholder="Chẩn đoán / lý do theo giấy chuyển tuyến..."
                onChange={e => setReferralDiagnosis(e.target.value)}
                onBlur={e => {
                  if (e.target.value !== (exam.referral_diagnosis ?? ''))
                    save({ referral_diagnosis: e.target.value || null });
                }}
              />
            </Field>
          )}
        </div>
      </div>

      {/* ── Triệu chứng lâm sàng ─────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span>📋</span> Triệu chứng lâm sàng
          {saveAsync.loading && (
            <span style={{ marginLeft: 'auto', fontSize: '.75rem', color: 'var(--clr-gray-400)' }}>
              Đang lưu...
            </span>
          )}
        </div>
        <div style={bodyStyle}>
          <textarea
            className="form-input"
            rows={5}
            value={clinicalSymptoms}
            disabled={disabled}
            placeholder="Mô tả triệu chứng, dấu hiệu lâm sàng, tiền sử bệnh, lý do vào khám..."
            onChange={e => setClinicalSymptoms(e.target.value)}
            onBlur={e => {
              if (e.target.value !== (exam.clinical_symptoms ?? ''))
                save({ clinical_symptoms: e.target.value || null });
            }}
          />
          <div style={{ fontSize: '.78rem', color: 'var(--clr-gray-400)', textAlign: 'right' }}>
            {clinicalSymptoms.length} ký tự
          </div>
        </div>
      </div>

    </div>
  );
}

// ── InsuranceStatus (helper) ──────────────────────────────────────────────────

function InsuranceStatus({ validTo, cardNumber }: { validTo: string; cardNumber: string }) {
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry   = new Date(validTo);
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  const expired  = daysLeft < 0;
  const warning  = daysLeft >= 0 && daysLeft <= 30;

  const bg    = expired ? '#fee2e2' : warning ? '#fef3c7' : '#d1fae5';
  const color = expired ? '#991b1b' : warning ? '#92400e' : '#065f46';
  const icon  = expired ? '❌' : warning ? '⚠️' : '✅';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', borderRadius: 8, background: bg,
      fontSize: '.8rem', color,
    }}>
      <span>{icon}</span>
      <div>
        {cardNumber && (
          <span style={{ fontWeight: 700, marginRight: 10 }}>{cardNumber}</span>
        )}
        {expired
          ? `Thẻ đã hết hạn ${Math.abs(daysLeft)} ngày trước`
          : warning
            ? `Thẻ còn hiệu lực ${daysLeft} ngày (sắp hết hạn)`
            : `Thẻ còn hiệu lực đến ${new Date(validTo).toLocaleDateString('vi-VN')}`
        }
      </div>
    </div>
  );
}
