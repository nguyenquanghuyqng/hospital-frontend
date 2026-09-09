/**
 * ExamInfoSection — III. Thông tin khám (v5)
 *
 * Hướng xử trí:
 *   - 11 lựa chọn loại trừ lẫn nhau (radio semantics, checkbox UX)
 *   - 3 nhóm màu rõ ràng: Thông thường / Nhập viện-Chuyển / Đặc biệt
 *   - Mỗi lựa chọn hiển thị icon lớn + label + hint mô tả ngắn
 *   - Sub-form tự động xuất hiện (animate) bên dưới grid theo lựa chọn:
 *       revisit         → số ngày + kết quả điều trị
 *       inpatient/ward  → Vào KP (khoa/phòng) + ưu tiên
 *       transfer_out    → nơi chuyển + lý do
 *       transfer_clinic → phòng khám chuyển đến
 *       emergency       → banner cảnh báo đỏ
 *       deceased        → confirm + ghi chú
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import DiagnosisPanel from './DiagnosisPanel';
import type { ExaminationResponse, DispositionType } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Disposition master data
// ─────────────────────────────────────────────────────────────────────────────

interface DispositionDef {
  value:  DispositionType;
  label:  string;
  hint:   string;       // mô tả ngắn, giúp user mới nhận biết
  icon:   string;
  color:  string;
  bg:     string;
  border: string;
  group:  'normal' | 'admit' | 'special';
}

const DISPOSITIONS: DispositionDef[] = [
  // ── Thông thường ──────────────────────────────────────────────────────────
  {
    value: 'discharged',    group: 'normal',
    label: 'Khám xong cho về',
    hint:  'Không cần theo dõi thêm',
    icon: '✅', color: '#166534', bg: '#f0fdf4', border: '#86efac',
  },
  {
    value: 'outpatient',    group: 'normal',
    label: 'Điều trị ngoại trú',
    hint:  'Tiếp tục điều trị ngoại trú',
    icon: '🏠', color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',
  },
  {
    value: 'revisit',       group: 'normal',
    label: 'Hẹn tái khám',
    hint:  'Đặt lịch tái khám sau N ngày',
    icon: '📅', color: '#5b21b6', bg: '#faf5ff', border: '#c4b5fd',
  },
  {
    value: 'chronic_script', group: 'normal',
    label: 'Cấp toa mãn tính',
    hint:  'Cấp đơn thuốc điều trị lâu dài',
    icon: '💊', color: '#0e4f7a', bg: '#f0f9ff', border: '#bae6fd',
  },

  // ── Nhập viện / Chuyển ────────────────────────────────────────────────────
  {
    value: 'inpatient',     group: 'admit',
    label: 'Nhập viện',
    hint:  'Điều trị nội trú, chỉ định khoa/phòng',
    icon: '🏥', color: '#92400e', bg: '#fffbeb', border: '#fde68a',
  },
  {
    value: 'inpatient_ward', group: 'admit',
    label: 'Chuyển phòng lưu',
    hint:  'Lưu quan sát tại phòng lưu bệnh',
    icon: '🛏️', color: '#075985', bg: '#f0f9ff', border: '#bae6fd',
  },
  {
    value: 'transfer_out',  group: 'admit',
    label: 'Chuyển tuyến',
    hint:  'Chuyển lên tuyến trên / cơ sở khác',
    icon: '🚑', color: '#9d174d', bg: '#fdf2f8', border: '#f0abfc',
  },
  {
    value: 'transfer_clinic', group: 'admit',
    label: 'Chuyển phòng khám',
    hint:  'Chuyển sang chuyên khoa khác',
    icon: '🔀', color: '#0d7377', bg: '#f0fdfa', border: '#99f6e4',
  },

  // ── Đặc biệt ──────────────────────────────────────────────────────────────
  {
    value: 'emergency',     group: 'special',
    label: 'Cấp cứu',
    hint:  'Chuyển xử lý khẩn cấp ngay lập tức',
    icon: '🚨', color: '#991b1b', bg: '#fff1f2', border: '#fca5a5',
  },
  {
    value: 'leave_ama',     group: 'special',
    label: 'Bỏ về AMA',
    hint:  'Bệnh nhân tự ý rời khỏi cơ sở',
    icon: '🚶', color: '#9a3412', bg: '#fff7ed', border: '#fed7aa',
  },
  {
    value: 'deceased',      group: 'special',
    label: 'Tử vong',
    hint:  'Ghi nhận trường hợp tử vong',
    icon: '🕊️', color: '#374151', bg: '#f9fafb', border: '#d1d5db',
  },
];

const GROUPS: { key: DispositionDef['group']; label: string; accent: string; desc: string }[] = [
  { key: 'normal',  label: 'Kết thúc thông thường',    accent: '#16a34a', desc: 'Bệnh nhân về nhà hoặc theo dõi tiếp' },
  { key: 'admit',   label: 'Nhập viện / Chuyển tuyến', accent: '#0369a1', desc: 'Bệnh nhân cần nhập viện hoặc chuyển' },
  { key: 'special', label: 'Trường hợp đặc biệt',      accent: '#9a3412', desc: 'Cần lưu ý đặc biệt' },
];

const REVISIT_RESULTS = [
  { value: 'no_change', label: 'Không thay đổi' },
  { value: 'better',    label: 'Đỡ / cải thiện' },
  { value: 'cured',     label: 'Khỏi bệnh' },
  { value: 'worse',     label: 'Nặng hơn' },
  { value: 'refer',     label: 'Chuyển tuyến' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared styles
// ─────────────────────────────────────────────────────────────────────────────

const LBL: React.CSSProperties = {
  fontSize: '.65rem', fontWeight: 700,
  textTransform: 'uppercase' as const, letterSpacing: '.06em',
  color: 'var(--clr-gray-500)', marginBottom: 5, display: 'block',
};

const DIVIDER: React.CSSProperties = {
  height: 1, background: 'var(--clr-gray-100)', margin: '18px 0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  exam:      ExaminationResponse;
  disabled:  boolean;
  onUpdated: () => void;
}

export default function ExamInfoSection({ exam, disabled, onUpdated }: Props) {
  const saveAsync = useAsync<ExaminationResponse>();

  const [doctorName,         setDoctorName]         = useState(exam.doctor_name          ?? '');
  const [nurseName,          setNurseName]           = useState(exam.nurse_name           ?? '');
  const [complications,      setComplications]       = useState(exam.complications        ?? '');
  const [disposition,        setDisposition]         = useState<DispositionType | ''>(exam.disposition ?? '');
  const [revisitDays,        setRevisitDays]         = useState(String(exam.revisit_days  ?? ''));
  const [revisitResult,      setRevisitResult]       = useState(exam.revisit_result       ?? '');
  const [admitWard,          setAdmitWard]           = useState(exam.admit_ward           ?? '');
  const [admitPriority,      setAdmitPriority]       = useState(exam.admit_priority       ?? false);
  const [transferToFacility, setTransferToFacility]  = useState(exam.transfer_to_facility ?? '');
  const [transferReason,     setTransferReason]      = useState(exam.transfer_reason      ?? '');
  const [transferClinicRoom, setTransferClinicRoom]  = useState('');
  const [isNearPoor,         setIsNearPoor]          = useState(exam.is_near_poor         ?? false);
  const [isPoor,             setIsPoor]              = useState(exam.is_poor              ?? false);
  const [flagPriority,       setFlagPriority]        = useState(exam.flag_priority        ?? false);

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

  const save = useCallback(async (patch: Record<string, unknown>) => {
    if (disabled) return;
    const res = await saveAsync.run(examinationApi.update(exam.id, patch));
    if (res) onUpdated();
    else toast.error(saveAsync.error ?? 'Lưu thất bại');
  }, [exam.id, disabled, saveAsync, onUpdated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDisposition = (val: DispositionType) => {
    // Radio semantics: click lại = bỏ chọn
    const next = val === disposition ? '' : val;
    setDisposition(next as DispositionType | '');
    save({ disposition: next || null });
  };

  const selectedDef = DISPOSITIONS.find(d => d.value === disposition);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Bác sĩ + Điều dưỡng ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={LBL}>Bác sĩ điều trị</label>
          <input className="form-input"
            value={doctorName} disabled={disabled}
            placeholder="VD: BS. Nguyễn Văn A"
            onChange={e => setDoctorName(e.target.value)}
            onBlur={e => {
              if (e.target.value !== (exam.doctor_name ?? ''))
                save({ doctor_name: e.target.value || null });
            }}
          />
          {!doctorName && !disabled && (
            <div style={{ fontSize: '.65rem', color: 'var(--clr-gray-400)', marginTop: 3 }}>
              💡 Nhập tên bác sĩ hoặc mã BS
            </div>
          )}
        </div>
        <div>
          <label style={LBL}>Điều dưỡng phụ trách</label>
          <input className="form-input"
            value={nurseName} disabled={disabled}
            placeholder="Họ tên điều dưỡng"
            onChange={e => setNurseName(e.target.value)}
            onBlur={e => {
              if (e.target.value !== (exam.nurse_name ?? ''))
                save({ nurse_name: e.target.value || null });
            }}
          />
        </div>
      </div>

      {/* Policy flags */}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {([
          { label: 'C/H Nghèo',  val: isNearPoor,  key: 'is_near_poor',  set: setIsNearPoor,  color: '#059669', bg: '#dcfce7' },
          { label: 'Hộ nghèo',   val: isPoor,       key: 'is_poor',       set: setIsPoor,      color: '#059669', bg: '#dcfce7' },
          { label: '⭐ Ưu tiên', val: flagPriority, key: 'flag_priority', set: setFlagPriority,color: '#b45309', bg: '#fef3c7' },
        ] as const).map(item => (
          <label key={item.key} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px',
            border: `1.5px solid ${item.val ? item.color + '60' : 'var(--clr-gray-200)'}`,
            borderRadius: 9999,
            background: item.val ? item.bg : '#fff',
            cursor: disabled ? 'default' : 'pointer',
            fontSize: '.78rem', fontWeight: item.val ? 700 : 400,
            color: item.val ? item.color : 'var(--clr-gray-500)',
            userSelect: 'none', transition: 'all .12s',
          }}>
            <input
              type="checkbox" checked={item.val} disabled={disabled}
              style={{ width: 13, height: 13, accentColor: item.color, cursor: 'inherit' }}
              onChange={e => {
                (item.set as (v: boolean) => void)(e.target.checked);
                save({ [item.key]: e.target.checked });
              }}
            />
            {item.label}
          </label>
        ))}
      </div>

      <div style={DIVIDER} />

      {/* ── Chẩn đoán ICD-10 ────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: '.65rem', fontWeight: 800, color: '#dc2626',
            textTransform: 'uppercase' as const, letterSpacing: '.08em',
          }}>🏷️ Chẩn đoán ICD-10</span>
          <span style={{
            fontSize: '.62rem', color: 'var(--clr-gray-400)',
            padding: '1px 7px', borderRadius: 3, background: 'var(--clr-gray-100)',
          }}>
            {exam.diagnoses.length > 0
              ? `${exam.diagnoses.length} chẩn đoán · ${exam.diagnoses.filter(d => d.is_primary).length} chính`
              : 'Chưa có'}
          </span>
        </div>
        <DiagnosisPanel
          examId={exam.id} diagnoses={exam.diagnoses}
          disabled={disabled} onChanged={onUpdated}
        />
      </div>

      <div style={DIVIDER} />

      {/* ── Biến chứng ──────────────────────────────────────────────── */}
      <div>
        <label style={LBL}>Biến chứng</label>
        <textarea className="form-input" rows={3}
          value={complications} disabled={disabled}
          placeholder="Ghi nhận biến chứng nếu có..."
          style={{ resize: 'vertical' }}
          onChange={e => setComplications(e.target.value)}
          onBlur={e => {
            if (e.target.value !== (exam.complications ?? ''))
              save({ complications: e.target.value || null });
          }}
        />
      </div>

      <div style={DIVIDER} />

      {/* ════════════════════════════════════════════════════════════
          HƯỚNG XỬ TRÍ — Radio exclusive, visual checkbox pattern
      ════════════════════════════════════════════════════════════ */}
      <div>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '.65rem', fontWeight: 800, color: 'var(--clr-gray-500)',
            textTransform: 'uppercase' as const, letterSpacing: '.08em',
          }}>
            Hướng xử trí
          </span>
          <span style={{
            fontSize: '.62rem', color: 'var(--clr-gray-400)',
            padding: '2px 8px', borderRadius: 4,
            background: 'var(--clr-gray-100)', border: '1px solid var(--clr-gray-200)',
          }}>
            Chọn 1 — click lại để bỏ chọn
          </span>

          {/* Selected indicator */}
          {selectedDef && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px 4px 8px', borderRadius: 9999,
              background: selectedDef.bg,
              border: `1.5px solid ${selectedDef.border}`,
              color: selectedDef.color,
              fontSize: '.8rem', fontWeight: 800,
              animation: 'scaleIn .15s var(--ease-out)',
            }}>
              <span style={{ fontSize: '1rem' }}>{selectedDef.icon}</span>
              {selectedDef.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => { setDisposition(''); save({ disposition: null }); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: selectedDef.color, fontSize: '.65rem',
                    padding: '0 0 0 2px', opacity: .6, lineHeight: 1,
                    marginLeft: 2,
                  }}
                  title="Bỏ chọn (click lại vào ô)"
                >✕</button>
              )}
            </span>
          )}
        </div>

        {/* Groups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {GROUPS.map(group => {
            const items = DISPOSITIONS.filter(d => d.group === group.key);
            return (
              <div key={group.key}>

                {/* Group label */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  }}>
                    <div style={{
                      width: 3, height: 14, borderRadius: 2,
                      background: group.accent, flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: '.62rem', fontWeight: 800, color: group.accent,
                      textTransform: 'uppercase' as const, letterSpacing: '.07em',
                    }}>{group.label}</span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'var(--clr-gray-100)' }} />
                </div>

                {/* Disposition buttons grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
                  gap: 7,
                }}>
                  {items.map(def => {
                    const sel = disposition === def.value;
                    return (
                      <DispositionCard
                        key={def.value}
                        def={def}
                        selected={sel}
                        disabled={disabled}
                        onClick={() => handleSelectDisposition(def.value)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Sub-forms — animate in bên dưới grid ─────────────────── */}

        {/* Hẹn tái khám */}
        {disposition === 'revisit' && (
          <SubForm
            color="#5b21b6" bg="#faf5ff" border="#c4b5fd"
            icon="📅" title="Chi tiết hẹn tái khám"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={LBL}>Số ngày hẹn tái khám</label>
                <input type="number" min={1} max={365} className="form-input"
                  value={revisitDays} disabled={disabled} placeholder="30"
                  onChange={e => setRevisitDays(e.target.value)}
                  onBlur={e => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== exam.revisit_days) save({ revisit_days: v });
                  }}
                />
                {revisitDays && Number(revisitDays) > 0 && (
                  <div style={{ fontSize: '.72rem', color: '#7c3aed', marginTop: 5, fontWeight: 600 }}>
                    📅 {new Date(Date.now() + Number(revisitDays) * 86400000)
                      .toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                )}
              </div>
              <div>
                <label style={LBL}>Kết quả điều trị lần này</label>
                <select className="form-input"
                  value={revisitResult} disabled={disabled}
                  onChange={e => { setRevisitResult(e.target.value); save({ revisit_result: e.target.value || null }); }}
                >
                  <option value="">— Chọn kết quả —</option>
                  {REVISIT_RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
          </SubForm>
        )}

        {/* Nhập viện */}
        {(disposition === 'inpatient' || disposition === 'inpatient_ward') && (
          <SubForm
            color="#92400e" bg="#fffbeb" border="#fde68a"
            icon="🏥" title="Chi tiết nhập viện — Vào khoa phòng (KP)"
          >
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, alignItems: 'flex-end' }}>
              <div>
                <label style={LBL}>Khoa / Phòng nhập viện (Vào KP)</label>
                <input className="form-input"
                  value={admitWard} disabled={disabled}
                  placeholder="VD: Khoa Nội tổng hợp — P.201"
                  onChange={e => setAdmitWard(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.admit_ward ?? ''))
                      save({ admit_ward: e.target.value || null });
                  }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8, cursor: disabled ? 'default' : 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox" checked={admitPriority} disabled={disabled}
                  style={{ width: 15, height: 15, accentColor: '#92400e' }}
                  onChange={e => { setAdmitPriority(e.target.checked); save({ admit_priority: e.target.checked }); }}
                />
                <span style={{ fontSize: '.82rem', fontWeight: 600, color: '#92400e' }}>⚡ Ưu tiên</span>
              </label>
            </div>
          </SubForm>
        )}

        {/* Chuyển tuyến */}
        {disposition === 'transfer_out' && (
          <SubForm
            color="#9d174d" bg="#fdf2f8" border="#f0abfc"
            icon="🚑" title="Chi tiết chuyển tuyến"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={LBL}>Chuyển đến bệnh viện / cơ sở y tế</label>
                <input className="form-input"
                  value={transferToFacility} disabled={disabled}
                  placeholder="Tên bệnh viện / cơ sở nhận bệnh nhân..."
                  onChange={e => setTransferToFacility(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.transfer_to_facility ?? ''))
                      save({ transfer_to_facility: e.target.value || null });
                  }}
                />
              </div>
              <div>
                <label style={LBL}>Lý do chuyển tuyến / tóm tắt bệnh án</label>
                <textarea className="form-input" rows={3}
                  value={transferReason} disabled={disabled}
                  placeholder="Lý do chuyển, tóm tắt diễn biến và xử trí đã thực hiện..."
                  style={{ resize: 'vertical' }}
                  onChange={e => setTransferReason(e.target.value)}
                  onBlur={e => {
                    if (e.target.value !== (exam.transfer_reason ?? ''))
                      save({ transfer_reason: e.target.value || null });
                  }}
                />
              </div>
            </div>
          </SubForm>
        )}

        {/* Chuyển phòng khám */}
        {disposition === 'transfer_clinic' && (
          <SubForm
            color="#0d7377" bg="#f0fdfa" border="#99f6e4"
            icon="🔀" title="Chuyển sang phòng khám / chuyên khoa"
          >
            <div>
              <label style={LBL}>Phòng khám / chuyên khoa nhận</label>
              <input className="form-input"
                value={transferClinicRoom} disabled={disabled}
                placeholder="VD: Phòng khám Tim mạch, Khoa Mắt..."
                onChange={e => setTransferClinicRoom(e.target.value)}
              />
            </div>
          </SubForm>
        )}

        {/* Cấp cứu — cảnh báo đặc biệt */}
        {disposition === 'emergency' && (
          <SubForm
            color="#991b1b" bg="linear-gradient(135deg,#fff1f2,#fee2e2)" border="#fca5a5"
            icon="🚨" title="Chế độ cấp cứu — ưu tiên xử lý ngay"
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'rgba(220,38,38,.08)',
              border: '1px solid #fca5a5', borderRadius: 8,
            }}>
              <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</span>
              <div style={{ fontSize: '.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                <strong>Bệnh nhân được chuyển sang chế độ cấp cứu.</strong><br />
                Toàn bộ giao diện sẽ chuyển sang nền đỏ cảnh báo. Ưu tiên hoàn tất kê đơn và liên hệ ekip cấp cứu.
              </div>
            </div>
          </SubForm>
        )}

        {/* Tử vong — confirm đặc biệt */}
        {disposition === 'deceased' && (
          <SubForm
            color="#374151" bg="#f9fafb" border="#d1d5db"
            icon="🕊️" title="Ghi nhận tử vong"
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 8,
            }}>
              <span style={{ fontSize: '1.2rem' }}>📋</span>
              <div style={{ fontSize: '.82rem', color: '#374151', lineHeight: 1.5 }}>
                Vui lòng hoàn tất đầy đủ thông tin chẩn đoán và ghi chú trong hồ sơ. Trạng thái phiếu sẽ được đánh dấu đặc biệt.
              </div>
            </div>
          </SubForm>
        )}

        {/* Bỏ về AMA */}
        {disposition === 'leave_ama' && (
          <SubForm
            color="#9a3412" bg="#fff7ed" border="#fed7aa"
            icon="🚶" title="Bệnh nhân tự ý rời khỏi cơ sở (AMA)"
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              background: 'rgba(154,52,18,.06)', border: '1px solid #fed7aa', borderRadius: 8,
            }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div style={{ fontSize: '.82rem', color: '#7c2d12', lineHeight: 1.5 }}>
                Against Medical Advice — Bệnh nhân từ chối điều trị và tự ý rời khỏi cơ sở y tế. Ghi rõ thời điểm và tình trạng lúc rời.
              </div>
            </div>
          </SubForm>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DispositionCard — mỗi lựa chọn hướng xử trí
// ─────────────────────────────────────────────────────────────────────────────

function DispositionCard({
  def, selected, disabled, onClick,
}: {
  def:      DispositionDef;
  selected: boolean;
  disabled: boolean;
  onClick:  () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: `2px solid ${selected ? def.color : 'var(--clr-gray-200)'}`,
        background: selected ? def.bg : '#fff',
        fontFamily: 'var(--font-sans)',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        transition: 'all .14s',
        boxShadow: selected ? `0 0 0 3px ${def.color}20` : 'none',
        position: 'relative',
        outline: 'none',
      }}
      onMouseEnter={e => {
        if (!selected && !disabled)
          (e.currentTarget as HTMLButtonElement).style.borderColor = def.color + '80';
      }}
      onMouseLeave={e => {
        if (!selected && !disabled)
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--clr-gray-200)';
      }}
    >
      {/* Radio circle */}
      <div style={{
        width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? def.color : 'var(--clr-gray-300)'}`,
        background: selected ? def.color : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1, transition: 'all .14s',
      }}>
        {selected && (
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: '#fff',
          }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
          <span style={{ fontSize: '.9rem', lineHeight: 1, flexShrink: 0 }}>{def.icon}</span>
          <span style={{
            fontSize: '.82rem', fontWeight: selected ? 700 : 500,
            color: selected ? def.color : 'var(--clr-gray-700)',
            lineHeight: 1.3, transition: 'color .14s',
          }}>
            {def.label}
          </span>
        </div>
        {/* Hint */}
        <div style={{
          fontSize: '.68rem', color: selected ? def.color : 'var(--clr-gray-400)',
          marginTop: 3, lineHeight: 1.3, opacity: selected ? .8 : 1,
          transition: 'color .14s',
        }}>
          {def.hint}
        </div>
      </div>

      {/* Selected checkmark top-right */}
      {selected && (
        <div style={{
          position: 'absolute', top: -1, right: -1,
          width: 18, height: 18,
          background: def.color, borderRadius: '0 8px 0 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '.6rem', color: '#fff', fontWeight: 800, lineHeight: 1 }}>✓</span>
        </div>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SubForm — wrapper có animation + header
// ─────────────────────────────────────────────────────────────────────────────

function SubForm({
  icon, title, color, bg, border, children,
}: {
  icon: string; title: string;
  color: string; bg: string; border: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      marginTop: 14,
      borderRadius: 10,
      border: `1px solid ${border}`,
      overflow: 'hidden',
      animation: 'slideDown .18s var(--ease-out)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px',
        background: bg, borderBottom: `1px solid ${border}`,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '.85rem',
        }}>{icon}</div>
        <span style={{ fontSize: '.82rem', fontWeight: 700, color }}>{title}</span>
      </div>
      {/* Content */}
      <div style={{ padding: '14px 16px', background: bg }}>
        {children}
      </div>
    </div>
  );
}
