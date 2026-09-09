/**
 * ExamHistoryTree — Cây lịch sử các lần khám trước
 *
 * - Load từ API GET /examinations/history/{patientId}
 * - Hiển thị dạng accordion: mỗi dòng = ngày giờ + phòng khám + mã lượt khám
 * - Click dòng để mở rộng xem tóm tắt (chẩn đoán, bác sĩ, hướng xử trí)
 * - Nút "Xem chi tiết" để navigate tới phiếu khám cũ (reception ID)
 * - Phiếu hiện tại được đánh dấu (không click được)
 */
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import { LoadingOverlay } from '@components/ui';
import type { ExaminationListItem, DispositionType } from '@/types';

// ── Disposition labels ─────────────────────────────────────────────────────────

const DISPOSITION_LABELS: Partial<Record<DispositionType, { label: string; color: string }>> = {
  emergency:       { label: 'Cấp cứu',          color: '#dc2626' },
  outpatient:      { label: 'Ngoại trú',         color: '#2563eb' },
  revisit:         { label: 'Tái khám',          color: '#7c3aed' },
  inpatient:       { label: 'Nhập viện',         color: '#b45309' },
  inpatient_ward:  { label: 'Phòng lưu',         color: '#0891b2' },
  transfer_out:    { label: 'Chuyển tuyến',      color: '#be185d' },
  deceased:        { label: 'Tử vong',           color: '#374151' },
  transfer_clinic: { label: 'Chuyển phòng',      color: '#0d9488' },
  leave_ama:       { label: 'Bỏ về',             color: '#9a3412' },
  discharged:      { label: 'Cho về',            color: '#065f46' },
  chronic_script:  { label: 'Cấp toa mãn tính',  color: '#1e3a5f' },
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Đang khám',  bg: '#dbeafe', color: '#1d4ed8' },
  saved:     { label: 'Đã lưu',    bg: '#fef3c7', color: '#92400e' },
  completed: { label: 'Hoàn tất',  bg: '#d1fae5', color: '#065f46' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  patientId:      number;
  currentExamId?: number;  // để đánh dấu phiếu hiện tại
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExamHistoryTree({ patientId, currentExamId }: Props) {
  const navigate  = useNavigate();
  const { data: history, loading, error, run } = useAsync<ExaminationListItem[]>();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(() => {
    run(examinationApi.history(patientId, { limit: 50 }));
  }, [patientId, run]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingOverlay />;
  if (error)   return (
    <div style={{ padding: 12, color: 'var(--clr-danger)', fontSize: '.82rem' }}>
      ⚠️ Không tải được lịch sử. <button onClick={load} style={{ color: 'var(--clr-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Thử lại</button>
    </div>
  );

  const items = history ?? [];

  if (items.length === 0) {
    return (
      <div style={{ padding: '14px 12px', fontSize: '.82rem', color: 'var(--clr-gray-400)', textAlign: 'center' }}>
        📭 Chưa có lịch sử khám trước.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, idx) => {
        const isCurrent  = item.id === currentExamId;
        const isExpanded = expandedId === item.id;
        const st         = STATUS_LABELS[item.status] ?? STATUS_LABELS.completed;
        const dispDef    = item.disposition ? DISPOSITION_LABELS[item.disposition] : null;

        return (
          <div key={item.id} style={{
            borderLeft: `3px solid ${isCurrent ? 'var(--clr-primary)' : 'var(--clr-gray-200)'}`,
            marginLeft: 6,
            position: 'relative',
          }}>
            {/* Timeline dot */}
            <div style={{
              position: 'absolute', left: -7, top: 14,
              width: 10, height: 10, borderRadius: '50%',
              background: isCurrent ? 'var(--clr-primary)' : 'var(--clr-gray-300)',
              border: `2px solid ${isCurrent ? 'var(--clr-primary-dark)' : 'var(--clr-gray-200)'}`,
              zIndex: 1,
            }} />

            {/* Row */}
            <button
              type="button"
              onClick={() => !isCurrent && setExpandedId(isExpanded ? null : item.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                padding: '8px 8px 8px 14px', background: 'none', border: 'none',
                cursor: isCurrent ? 'default' : 'pointer',
                textAlign: 'left',
                borderBottom: `1px solid var(--clr-gray-100)`,
              }}
              aria-expanded={isExpanded}
            >
              {/* Expand arrow */}
              <span style={{
                fontSize: '.7rem', color: 'var(--clr-gray-400)',
                marginTop: 2, flexShrink: 0,
                transform: isExpanded ? 'rotate(90deg)' : 'none',
                transition: 'transform .15s',
                visibility: isCurrent ? 'hidden' : 'visible',
              }}>▶</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Line 1: date + mã lượt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '.82rem', fontWeight: isCurrent ? 700 : 600,
                    color: isCurrent ? 'var(--clr-primary)' : 'var(--clr-gray-800)',
                  }}>
                    {new Date(item.exam_date).toLocaleDateString('vi-VN')}
                    {item.exam_start_at && (
                      <span style={{ marginLeft: 4, fontWeight: 400, color: 'var(--clr-gray-500)' }}>
                        {new Date(item.exam_start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </span>

                  {/* Mã lượt khám */}
                  <span style={{
                    fontSize: '.7rem', fontFamily: 'monospace',
                    background: 'var(--clr-gray-100)', color: 'var(--clr-gray-500)',
                    padding: '1px 6px', borderRadius: 4,
                  }}>
                    #{item.reception_id}
                  </span>

                  {isCurrent && (
                    <span style={{
                      fontSize: '.7rem', background: 'var(--clr-primary)', color: '#fff',
                      padding: '1px 8px', borderRadius: 999, fontWeight: 700,
                    }}>
                      Hiện tại
                    </span>
                  )}

                  {/* Status */}
                  <span style={{
                    fontSize: '.7rem', background: st.bg, color: st.color,
                    padding: '1px 7px', borderRadius: 999, fontWeight: 600,
                  }}>
                    {st.label}
                  </span>
                </div>

                {/* Line 2: phòng khám + bác sĩ */}
                <div style={{ fontSize: '.75rem', color: 'var(--clr-gray-500)', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {item.clinic_room && <span>📍 {item.clinic_room}</span>}
                  {item.doctor_name && <span>👨‍⚕️ {item.doctor_name}</span>}
                  {dispDef && (
                    <span style={{ color: dispDef.color, fontWeight: 600 }}>→ {dispDef.label}</span>
                  )}
                </div>

                {/* Line 3: chẩn đoán tóm tắt */}
                {item.diagnoses_summary && (
                  <div style={{ fontSize: '.75rem', color: 'var(--clr-gray-600)', marginTop: 2, fontStyle: 'italic' }}>
                    🏷️ {item.diagnoses_summary}
                  </div>
                )}
              </div>

              <span style={{ fontSize: '.72rem', color: 'var(--clr-gray-300)', flexShrink: 0, paddingTop: 2 }}>
                {idx + 1}/{items.length}
              </span>
            </button>

            {/* ── Expanded detail ─────────────────────────────────────────── */}
            {isExpanded && !isCurrent && (
              <div style={{
                padding: '10px 14px 12px 22px',
                background: '#f8fafc',
                borderBottom: '1px solid var(--clr-gray-200)',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '.8rem' }}>
                  {item.exam_start_at && (
                    <Row label="Bắt đầu"  value={new Date(item.exam_start_at).toLocaleString('vi-VN')} />
                  )}
                  {item.exam_end_at && (
                    <Row label="Kết thúc" value={new Date(item.exam_end_at).toLocaleString('vi-VN')} />
                  )}
                  {item.doctor_name  && <Row label="Bác sĩ"     value={item.doctor_name} />}
                  {item.nurse_name   && <Row label="Điều dưỡng"  value={item.nurse_name} />}
                  {item.diagnoses_summary && <Row label="Chẩn đoán" value={item.diagnoses_summary} />}
                  {item.disposition  && dispDef && <Row label="Xử trí" value={dispDef.label} />}
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/examination/${item.reception_id}`)}
                  style={{
                    marginTop: 10, padding: '5px 14px',
                    background: 'var(--clr-primary)', color: '#fff',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    fontSize: '.78rem', fontWeight: 600,
                  }}
                >
                  🔍 Xem chi tiết lần khám này
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ color: 'var(--clr-gray-400)', flexShrink: 0, minWidth: 72 }}>{label}:</span>
      <span style={{ color: 'var(--clr-gray-700)' }}>{value}</span>
    </div>
  );
}
