/**
 * PatientInfoSidebar — Sidebar thông tin bệnh nhân & lịch sử khám
 *
 * Hiển thị:
 * - Avatar + tên + mã BN + trạng thái phiếu khám
 * - Thông tin hành chính rút gọn: tuổi, giới tính, dân tộc, CCCD
 * - Địa chỉ đầy đủ với mã hành chính (tỉnh/huyện/xã)
 * - Bác sĩ điều trị + Điều dưỡng (mã + tên)
 * - Số điện thoại + Email
 * - Thông tin chính sách (BHYT, nghèo, ưu tiên)
 * - ExamHistoryTree (lịch sử các lần khám)
 */
import { useState } from 'react';
import { StatusBadge } from '@components/ui';
import ExamHistoryTree from './ExamHistoryTree';
import type { ExaminationResponse, ReceptionResponse, PatientResponse } from '@/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  exam:      ExaminationResponse;
  reception: ReceptionResponse | null;
  patient:   PatientResponse   | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob?: string | null, birthYear?: number | null): string {
  if (dob) {
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    return `${age} tuổi`;
  }
  if (birthYear) return `${new Date().getFullYear() - birthYear} tuổi`;
  return '—';
}

function buildAddress(p: PatientResponse | null): { full: string; code: string } {
  if (!p) return { full: '', code: '' };
  const parts = [
    p.address_street,
    p.address_village,
    p.address_ward_name,
    p.address_district_name,
    p.address_province_name,
  ].filter(Boolean);
  const codes = [
    p.address_ward_code,
    p.address_district_code,
    p.address_province_code,
  ].filter(Boolean);
  return {
    full: parts.join(', ') || p.address || '',
    code: codes.join('-'),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PatientInfoSidebar({ exam, reception, patient }: Props) {
  const [historyOpen, setHistoryOpen] = useState(true);

  const p       = patient;
  const rec     = reception;
  const addr    = buildAddress(p);
  const age     = calcAge(p?.date_of_birth, p?.birth_year);
  const genderLabel = p?.gender === 'male' ? 'Nam' : p?.gender === 'female' ? 'Nữ' : '—';

  // ── Derived flags ─────────────────────────────────────────────────────────────
  const isBhyt     = (rec?.subject_type === '1') || !!exam.insurance_number;
  const isNearPoor = exam.is_near_poor || rec?.is_near_poor;
  const isPoor     = exam.is_poor      || rec?.is_poor;
  const isPriority = exam.flag_priority || rec?.priority > 0;

  const nameLetter = (p?.full_name ?? '?')[0]?.toUpperCase() ?? '?';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%', overflowY: 'auto' }}>

      {/* ── Avatar + tên ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 14px',
        background: 'linear-gradient(135deg, var(--clr-primary-dark) 0%, var(--clr-primary) 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(255,255,255,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 800, flexShrink: 0,
          }}>
            {nameLetter}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.3 }} className="truncate">
              {p?.full_name ?? `BN #${exam.patient_id}`}
            </div>
            {p?.patient_code && (
              <div style={{ fontSize: '.75rem', opacity: .8, marginTop: 2 }}>
                Mã BN: {p.patient_code}
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              <StatusBadge status={exam.status} />
            </div>
          </div>
        </div>

        {/* Quick flags */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {isBhyt && (
            <span style={{ fontSize: '.7rem', background: 'rgba(255,255,255,.2)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
              🏥 BHYT
            </span>
          )}
          {isPriority && (
            <span style={{ fontSize: '.7rem', background: '#fbbf24', color: '#92400e', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
              ⭐ Ưu tiên
            </span>
          )}
          {(isNearPoor || isPoor) && (
            <span style={{ fontSize: '.7rem', background: '#6ee7b7', color: '#064e3b', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
              🍀 {isPoor ? 'Hộ nghèo' : 'C/H Nghèo'}
            </span>
          )}
          {rec?.is_referral && (
            <span style={{ fontSize: '.7rem', background: 'rgba(255,255,255,.2)', padding: '2px 8px', borderRadius: 999 }}>
              🔀 Chuyển tuyến
            </span>
          )}
        </div>
      </div>

      {/* ── Thông tin hành chính ─────────────────────────────────────────────── */}
      <Section title="👤 Thông tin cá nhân">
        <InfoRow label="Năm sinh" value={p?.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString('vi-VN') : (p?.birth_year ? String(p.birth_year) : '—')} />
        <InfoRow label="Tuổi"     value={age} />
        <InfoRow label="Giới tính" value={genderLabel} />
        {p?.ethnicity_name && <InfoRow label="Dân tộc" value={`${p.ethnicity_name}${p.ethnicity_code ? ` (${p.ethnicity_code})` : ''}`} />}
        {p?.nationality_name && p.nationality_name !== 'Việt Nam' && (
          <InfoRow label="Quốc tịch" value={p.nationality_name} />
        )}
        {p?.cccd && (
          <InfoRow label="CCCD/CMND" value={p.cccd} mono />
        )}
        {p?.occupation && <InfoRow label="Nghề nghiệp" value={p.occupation} />}
      </Section>

      {/* ── Liên hệ ──────────────────────────────────────────────────────────── */}
      {(p?.phone || p?.email) && (
        <Section title="📞 Liên hệ">
          {p.phone && <InfoRow label="Điện thoại" value={p.phone} />}
          {p.email && <InfoRow label="Email"      value={p.email} />}
        </Section>
      )}

      {/* ── Địa chỉ ──────────────────────────────────────────────────────────── */}
      {addr.full && (
        <Section title="🏠 Địa chỉ">
          <div style={{ fontSize: '.78rem', color: 'var(--clr-gray-700)', lineHeight: 1.6 }}>
            {addr.full}
          </div>
          {addr.code && (
            <div style={{ fontSize: '.7rem', color: 'var(--clr-gray-400)', marginTop: 4, fontFamily: 'monospace' }}>
              Mã HC: {addr.code}
            </div>
          )}
        </Section>
      )}

      {/* ── Phiếu khám hiện tại ──────────────────────────────────────────────── */}
      <Section title="🩺 Lượt khám">
        {rec?.clinic_room && <InfoRow label="Phòng khám" value={rec.clinic_room} />}
        {rec?.visit_number !== null && rec?.visit_number !== undefined && (
          <InfoRow label="STT" value={String(rec.visit_number)} />
        )}
        <InfoRow label="Ngày khám" value={new Date(exam.exam_date).toLocaleDateString('vi-VN')} />
        {exam.exam_start_at && (
          <InfoRow label="Bắt đầu" value={new Date(exam.exam_start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} />
        )}
        <InfoRow label="Mã lượt" value={`#${exam.reception_id}`} mono />
        {rec?.subject_name && <InfoRow label="Đối tượng" value={rec.subject_name} />}
        {exam.insurance_number && <InfoRow label="Số thẻ BHYT" value={exam.insurance_number} mono />}
      </Section>

      {/* ── Bác sĩ + Điều dưỡng ─────────────────────────────────────────────── */}
      {(exam.doctor_name || exam.nurse_name) && (
        <Section title="👨‍⚕️ Nhân lực phụ trách">
          {exam.doctor_id && exam.doctor_name && (
            <InfoRow label="Bác sĩ" value={`${exam.doctor_name} (ID: ${exam.doctor_id})`} />
          )}
          {!exam.doctor_id && exam.doctor_name && (
            <InfoRow label="Bác sĩ" value={exam.doctor_name} />
          )}
          {exam.nurse_name && <InfoRow label="Điều dưỡng" value={exam.nurse_name} />}
        </Section>
      )}

      {/* ── Chẩn đoán tóm tắt ───────────────────────────────────────────────── */}
      {exam.diagnoses.length > 0 && (
        <Section title="🏷️ Chẩn đoán">
          {exam.diagnoses.map(d => (
            <div key={d.id} style={{
              padding: '5px 8px', borderRadius: 6, marginBottom: 4,
              background: d.is_primary ? 'var(--clr-primary-light)' : 'var(--clr-gray-50)',
              border: `1px solid ${d.is_primary ? 'var(--clr-primary)30' : 'var(--clr-gray-100)'}`,
              fontSize: '.78rem',
            }}>
              {d.is_primary && (
                <span style={{ fontSize: '.65rem', background: 'var(--clr-primary)', color: '#fff', padding: '1px 6px', borderRadius: 999, marginRight: 5 }}>Chính</span>
              )}
              {d.icd_code && <span style={{ fontWeight: 700, color: 'var(--clr-primary-dark)', marginRight: 5 }}>{d.icd_code}</span>}
              {d.icd_name}
            </div>
          ))}
        </Section>
      )}

      {/* ── Lịch sử khám ────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid var(--clr-gray-100)' }}>
        <button
          type="button"
          onClick={() => setHistoryOpen(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '.82rem', fontWeight: 700,
            color: 'var(--clr-gray-700)',
          }}
        >
          <span>🕐 Lịch sử khám</span>
          <span style={{
            fontSize: '.7rem', transform: historyOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s', color: 'var(--clr-gray-400)',
          }}>▼</span>
        </button>

        {historyOpen && (
          <div style={{ paddingLeft: 4, paddingBottom: 8 }}>
            <ExamHistoryTree
              patientId={exam.patient_id}
              currentExamId={exam.id}
            />
          </div>
        )}
      </div>

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid var(--clr-gray-100)', padding: '10px 14px' }}>
      <div style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--clr-gray-400)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: '.78rem' }}>
      <span style={{ color: 'var(--clr-gray-400)', flexShrink: 0, minWidth: 78 }}>{label}:</span>
      <span style={{
        color: 'var(--clr-gray-800)', fontWeight: 500,
        fontFamily: mono ? 'monospace' : 'inherit',
        wordBreak: 'break-all',
      }}>{value}</span>
    </div>
  );
}
