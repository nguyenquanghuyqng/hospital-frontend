/**
 * PatientInfoSidebar — Sidebar thông tin bệnh nhân (v3)
 *
 * Design principles:
 *   • Data-dense but scannable: thông tin quan trọng nhất ở trên cùng
 *   • Clinical hierarchy: avatar → name → flags → demographics → contact → visit
 *   • Progressive disclosure: lịch sử khám collapsible để tránh vertical overflow
 *   • Color-coded sections: mỗi nhóm có icon + màu riêng để scan nhanh
 *   • Sticky header: BN name + flags luôn visible khi scroll
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

function buildAddress(p: PatientResponse | null): string {
  if (!p) return '';
  const parts = [
    p.address_street,
    p.address_village,
    p.address_ward_name,
    p.address_district_name,
    p.address_province_name,
  ].filter(Boolean);
  return parts.join(', ') || p.address || '';
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN');
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PatientInfoSidebar({ exam, reception, patient }: Props) {
  const [historyOpen, setHistoryOpen] = useState(true);

  const p   = patient;
  const rec = reception;

  const age         = calcAge(p?.date_of_birth, p?.birth_year);
  const genderLabel = p?.gender === 'male' ? 'Nam' : p?.gender === 'female' ? 'Nữ' : '—';
  const address     = buildAddress(p);
  const nameLetter  = (p?.full_name ?? '?')[0]?.toUpperCase() ?? '?';

  // Flags
  const isBhyt     = exam.subject_type === '1' || !!exam.insurance_number;
  const isPriority  = exam.flag_priority || (rec?.priority ?? 0) > 0;
  const isNearPoor  = exam.is_near_poor || rec?.is_near_poor;
  const isPoor      = exam.is_poor || rec?.is_poor;
  const isReferral  = rec?.is_referral;
  const isEmergency = exam.disposition === 'emergency';

  // Insurance validity
  const today       = new Date(); today.setHours(0, 0, 0, 0);
  const insExpiry   = exam.insurance_valid_to ? new Date(exam.insurance_valid_to) : null;
  const insDaysLeft = insExpiry ? Math.round((insExpiry.getTime() - today.getTime()) / 86400000) : null;
  const insStatus   = insDaysLeft === null ? null
    : insDaysLeft < 0   ? 'expired'
    : insDaysLeft <= 30 ? 'warning'
    : 'valid';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100%',
      background: '#fff',
    }}>

      {/* ── Sticky patient header ──────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: isEmergency
          ? 'linear-gradient(160deg, #7f1d1d 0%, #991b1b 100%)'
          : 'linear-gradient(160deg, #075985 0%, #0284c7 100%)',
        padding: '14px 14px 12px',
        flexShrink: 0,
      }}>
        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Avatar */}
          <div style={{
            width: 44, height: 44,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.2)',
            border: '2px solid rgba(255,255,255,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '1.1rem', color: '#fff',
            flexShrink: 0,
            letterSpacing: '-.02em',
          }}>
            {nameLetter}
          </div>

          {/* Name + code + status */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 800, fontSize: '.95rem', color: '#fff',
              lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {p?.full_name ?? `BN #${exam.patient_id}`}
            </div>

            {p?.patient_code && (
              <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.6)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                #{p.patient_code}
              </div>
            )}

            <div style={{ marginTop: 5 }}>
              <StatusBadge status={exam.status} />
            </div>
          </div>
        </div>

        {/* Clinical flags row */}
        <div style={{ display: 'flex', gap: 5, marginTop: 10, flexWrap: 'wrap' }}>
          {isEmergency && (
            <FlagChip label="🚨 CẤP CỨU" bg="rgba(255,255,255,.25)" color="#fff" bold />
          )}
          {isPriority && !isEmergency && (
            <FlagChip label="⭐ Ưu tiên" bg="#fef3c7" color="#92400e" bold />
          )}
          {isBhyt && (
            <FlagChip label="🏥 BHYT" bg="rgba(255,255,255,.18)" color="rgba(255,255,255,.9)" />
          )}
          {(isPoor || isNearPoor) && (
            <FlagChip
              label={isPoor ? '🍀 Hộ nghèo' : '🍀 C/H Nghèo'}
              bg="rgba(110,231,183,.25)" color="#6ee7b7"
            />
          )}
          {isReferral && (
            <FlagChip label="🔀 Chuyển tuyến" bg="rgba(255,255,255,.12)" color="rgba(255,255,255,.75)" />
          )}
        </div>

        {/* Insurance validity strip */}
        {isBhyt && insStatus && (
          <div style={{
            marginTop: 8,
            padding: '5px 9px',
            borderRadius: 6,
            background: insStatus === 'expired' ? 'rgba(220,38,38,.25)'
              : insStatus === 'warning'  ? 'rgba(217,119,6,.25)'
              : 'rgba(22,163,74,.2)',
            border: `1px solid ${
              insStatus === 'expired' ? 'rgba(252,165,165,.4)'
              : insStatus === 'warning'  ? 'rgba(253,230,138,.4)'
              : 'rgba(134,239,172,.3)'}`,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <span style={{ fontSize: '.75rem' }}>
              {insStatus === 'expired' ? '❌' : insStatus === 'warning' ? '⚠️' : '✅'}
            </span>
            <div>
              {exam.insurance_number && (
                <div style={{ fontSize: '.65rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,.75)', letterSpacing: '.02em' }}>
                  {exam.insurance_number}
                </div>
              )}
              <div style={{ fontSize: '.68rem', color: 'rgba(255,255,255,.85)', fontWeight: 600 }}>
                {insStatus === 'expired'
                  ? `Hết hạn ${Math.abs(insDaysLeft!)} ngày trước`
                  : insStatus === 'warning'
                    ? `Còn ${insDaysLeft} ngày (sắp hết hạn)`
                    : `BHYT còn hiệu lực đến ${fmtDate(exam.insurance_valid_to)}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── Thông tin nhân khẩu ─────────────────────────────────── */}
        <SidebarSection icon="👤" title="Thông tin cá nhân" accent="#0284c7">
          <InfoGrid>
            <InfoCell label="Ngày sinh" value={
              p?.date_of_birth
                ? fmtDate(p.date_of_birth)
                : p?.birth_year ? String(p.birth_year) : '—'
            } />
            <InfoCell label="Tuổi" value={age} highlight />
            <InfoCell label="Giới tính" value={genderLabel} />
            {p?.cccd && <InfoCell label="CCCD/CMND" value={p.cccd} mono />}
            {p?.ethnicity_name && <InfoCell label="Dân tộc" value={p.ethnicity_name} />}
            {p?.occupation && <InfoCell label="Nghề nghiệp" value={p.occupation} />}
          </InfoGrid>
        </SidebarSection>

        {/* ── Liên hệ ─────────────────────────────────────────────── */}
        {(p?.phone || p?.email) && (
          <SidebarSection icon="📞" title="Liên hệ" accent="#7c3aed">
            <InfoGrid>
              {p.phone && <InfoCell label="Điện thoại" value={p.phone} span2 />}
              {p.email && <InfoCell label="Email" value={p.email} span2 />}
            </InfoGrid>
          </SidebarSection>
        )}

        {/* ── Địa chỉ ─────────────────────────────────────────────── */}
        {address && (
          <SidebarSection icon="🏠" title="Địa chỉ" accent="#059669">
            <div style={{ fontSize: '.77rem', color: 'var(--clr-gray-700)', lineHeight: 1.65 }}>
              {address}
            </div>
          </SidebarSection>
        )}

        {/* ── Lượt khám hiện tại ──────────────────────────────────── */}
        <SidebarSection icon="🩺" title="Lượt khám" accent="#d97706">
          <InfoGrid>
            {rec?.clinic_room && <InfoCell label="Phòng khám" value={rec.clinic_room} span2 />}
            <InfoCell label="Ngày khám" value={fmtDate(exam.exam_date)} />
            {exam.exam_start_at && (
              <InfoCell label="Giờ bắt đầu" value={
                new Date(exam.exam_start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
              } />
            )}
            <InfoCell label="Mã lượt" value={`#${exam.reception_id}`} mono />
            {rec?.visit_number != null && (
              <InfoCell label="STT" value={String(rec.visit_number)} />
            )}
            {rec?.subject_name && <InfoCell label="Đối tượng" value={rec.subject_name} span2 />}
          </InfoGrid>
        </SidebarSection>

        {/* ── Bác sĩ / Điều dưỡng ─────────────────────────────────── */}
        {(exam.doctor_name || exam.nurse_name) && (
          <SidebarSection icon="👨‍⚕️" title="Nhân lực phụ trách" accent="#0369a1">
            <InfoGrid>
              {exam.doctor_name && (
                <InfoCell label="Bác sĩ" value={exam.doctor_name} span2 />
              )}
              {exam.nurse_name && (
                <InfoCell label="Điều dưỡng" value={exam.nurse_name} span2 />
              )}
            </InfoGrid>
          </SidebarSection>
        )}

        {/* ── Chẩn đoán tóm tắt ───────────────────────────────────── */}
        {exam.diagnoses.length > 0 && (
          <SidebarSection icon="🏷️" title="Chẩn đoán" accent="#dc2626">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {exam.diagnoses.map(d => (
                <div key={d.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  padding: '6px 9px',
                  borderRadius: 7,
                  background: d.is_primary ? '#fef2f2' : 'var(--clr-gray-50)',
                  border: `1px solid ${d.is_primary ? '#fca5a5' : 'var(--clr-gray-200)'}`,
                }}>
                  {d.is_primary && (
                    <span style={{
                      flexShrink: 0,
                      fontSize: '.6rem', fontWeight: 800,
                      background: '#dc2626', color: '#fff',
                      padding: '1px 5px', borderRadius: 3,
                      lineHeight: 1.6,
                      marginTop: 1,
                    }}>CĐ chính</span>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {d.icd_code && (
                      <span style={{
                        fontSize: '.7rem', fontWeight: 700,
                        color: 'var(--clr-primary-dark)',
                        fontFamily: 'var(--font-mono)',
                        marginRight: 5,
                      }}>{d.icd_code}</span>
                    )}
                    <span style={{ fontSize: '.77rem', color: 'var(--clr-gray-700)', lineHeight: 1.4 }}>
                      {d.icd_name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SidebarSection>
        )}

        {/* ── Lịch sử khám ─────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--clr-gray-100)' }}>
          <button
            type="button"
            onClick={() => setHistoryOpen(v => !v)}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 14px',
              background: historyOpen ? 'var(--clr-gray-50)' : '#fff',
              border: 'none',
              borderBottom: historyOpen ? '1px solid var(--clr-gray-100)' : 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20,
                background: '#e0f2fe', borderRadius: 5,
                fontSize: '.65rem',
              }}>🕐</span>
              <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--clr-gray-700)' }}>
                Lịch sử khám
              </span>
            </div>
            <span style={{
              fontSize: '.68rem', color: 'var(--clr-gray-400)',
              transform: historyOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform .15s',
              display: 'inline-block',
            }}>▼</span>
          </button>

          {historyOpen && (
            <div style={{ padding: '4px 4px 8px' }}>
              <ExamHistoryTree patientId={exam.patient_id} currentExamId={exam.id} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function FlagChip({ label, bg, color, bold }: { label: string; bg: string; color: string; bold?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontSize: '.65rem',
      fontWeight: bold ? 800 : 600,
      padding: '2px 7px',
      borderRadius: 9999,
      background: bg,
      color,
      lineHeight: 1.5,
    }}>
      {label}
    </span>
  );
}

function SidebarSection({
  icon, title, accent, children,
}: {
  icon: string; title: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: '1px solid var(--clr-gray-100)' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 14px 5px',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18,
          background: accent + '18',
          borderRadius: 4,
          fontSize: '.62rem',
          flexShrink: 0,
        }}>{icon}</span>
        <span style={{
          fontSize: '.65rem',
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: '.07em',
          color: accent,
        }}>{title}</span>
      </div>

      {/* Content */}
      <div style={{ padding: '0 14px 10px' }}>
        {children}
      </div>
    </div>
  );
}

/**
 * InfoGrid — 2-column grid for label/value pairs
 */
function InfoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4px 8px',
    }}>
      {children}
    </div>
  );
}

function InfoCell({
  label, value, mono, highlight, span2,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  span2?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 1,
      gridColumn: span2 ? 'span 2' : undefined,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: '.6rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '.05em',
        color: 'var(--clr-gray-400)',
      }}>{label}</span>
      <span style={{
        fontSize: '.77rem',
        fontWeight: highlight ? 700 : 500,
        color: highlight ? 'var(--clr-gray-900)' : 'var(--clr-gray-700)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: span2 ? 'normal' : 'nowrap' as const,
        lineHeight: 1.4,
      }}>
        {value || '—'}
      </span>
    </div>
  );
}
