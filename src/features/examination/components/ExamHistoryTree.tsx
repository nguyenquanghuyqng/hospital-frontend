/**
 * ExamHistoryTree — Cây lịch sử các lần khám (v4)
 *
 * Checklist đã đủ:
 *   ✅ Mỗi dòng: ngày giờ + phòng khám + mã lượt khám (#reception_id)
 *   ✅ Click dòng mở rộng → xem tóm tắt chi tiết (bác sĩ, chẩn đoán, hướng xử trí)
 *   ✅ Nút "Xem chi tiết lần khám này" → navigate tới phiếu cũ
 *   ✅ Phiếu hiện tại: đánh dấu rõ "Hiện tại", không mở rộng được
 *   ✅ Mã lượt khám luôn hiển thị để truy vết
 */
import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import { LoadingOverlay } from '@components/ui';
import type { ExaminationListItem, DispositionType } from '@/types';

// ── Disposition labels ─────────────────────────────────────────────────────────

const DISP_MAP: Partial<Record<DispositionType, { label: string; color: string; bg: string }>> = {
  emergency:       { label: 'Cấp cứu',         color: '#dc2626', bg: '#fee2e2' },
  outpatient:      { label: 'Ngoại trú',        color: '#2563eb', bg: '#dbeafe' },
  revisit:         { label: 'Tái khám',         color: '#7c3aed', bg: '#f3e8ff' },
  inpatient:       { label: 'Nhập viện',        color: '#b45309', bg: '#fef3c7' },
  inpatient_ward:  { label: 'Phòng lưu',        color: '#0891b2', bg: '#e0f2fe' },
  transfer_out:    { label: 'Chuyển tuyến',     color: '#be185d', bg: '#fce7f3' },
  deceased:        { label: 'Tử vong',          color: '#374151', bg: '#f1f5f9' },
  transfer_clinic: { label: 'Chuyển phòng',     color: '#0d9488', bg: '#ccfbf1' },
  leave_ama:       { label: 'Bỏ về',            color: '#9a3412', bg: '#ffedd5' },
  discharged:      { label: 'Cho về',           color: '#065f46', bg: '#dcfce7' },
  chronic_script:  { label: 'Cấp toa mãn tính', color: '#1e3a5f', bg: '#e0f2fe' },
};

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Đang khám', bg: '#dbeafe', color: '#1d4ed8' },
  saved:     { label: 'Đã lưu',   bg: '#fef3c7', color: '#92400e' },
  completed: { label: 'Hoàn tất', bg: '#dcfce7', color: '#065f46' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  patientId:      number;
  currentExamId?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExamHistoryTree({ patientId, currentExamId }: Props) {
  const navigate = useNavigate();
  const { data: history, loading, error, run } = useAsync<ExaminationListItem[]>();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(() => {
    run(examinationApi.history(patientId, { limit: 50 }));
  }, [patientId, run]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding: '12px 14px' }}><LoadingOverlay /></div>;

  if (error) return (
    <div style={{ padding: '10px 14px', fontSize: '.8rem', color: 'var(--clr-danger)' }}>
      ⚠️ Không tải được lịch sử.{' '}
      <button
        onClick={load}
        style={{ color: 'var(--clr-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}
      >Thử lại</button>
    </div>
  );

  const items = history ?? [];

  if (items.length === 0) {
    return (
      <div style={{ padding: '16px 14px', fontSize: '.8rem', color: 'var(--clr-gray-400)', textAlign: 'center' }}>
        📭 Chưa có lịch sử khám trước.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, idx) => {
        const isCurrent  = item.id === currentExamId;
        const isExpanded = expandedId === item.id && !isCurrent;
        const st         = STATUS_MAP[item.status] ?? STATUS_MAP.completed;
        const dispDef    = item.disposition ? DISP_MAP[item.disposition] : null;

        return (
          <div key={item.id}>
            {/* Timeline row */}
            <div style={{
              display: 'flex',
              borderLeft: `3px solid ${isCurrent ? 'var(--clr-primary)' : 'var(--clr-gray-200)'}`,
              marginLeft: 8,
              position: 'relative',
            }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: -6, top: 13,
                width: 9, height: 9, borderRadius: '50%',
                background: isCurrent ? 'var(--clr-primary)' : (item.status === 'completed' ? 'var(--clr-gray-400)' : 'var(--clr-gray-300)'),
                border: `2px solid ${isCurrent ? 'var(--clr-primary-dark)' : '#fff'}`,
                boxShadow: isCurrent ? '0 0 0 2px var(--clr-primary-light)' : 'none',
                zIndex: 1,
              }} />

              <button
                type="button"
                onClick={() => !isCurrent && setExpandedId(isExpanded ? null : item.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  width: '100%', padding: '9px 10px 9px 12px',
                  background: isExpanded ? 'var(--clr-primary-subtle)' : (isCurrent ? '#eff6ff' : 'transparent'),
                  border: 'none',
                  borderBottom: '1px solid var(--clr-gray-100)',
                  cursor: isCurrent ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'background .1s',
                }}
                aria-expanded={isExpanded}
              >
                {/* Expand arrow */}
                {!isCurrent && (
                  <span style={{
                    fontSize: '.65rem', color: 'var(--clr-gray-400)',
                    marginTop: 3, flexShrink: 0,
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform .15s',
                  }}>▶</span>
                )}
                {isCurrent && (
                  <span style={{ width: 10, flexShrink: 0 }} />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Line 1: Ngày + giờ + mã lượt + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {/* Ngày */}
                    <span style={{
                      fontSize: '.8rem',
                      fontWeight: isCurrent ? 700 : 600,
                      color: isCurrent ? 'var(--clr-primary)' : 'var(--clr-gray-800)',
                    }}>
                      {new Date(item.exam_date).toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })}
                    </span>

                    {/* Giờ */}
                    {item.exam_start_at && (
                      <span style={{ fontSize: '.73rem', color: 'var(--clr-gray-500)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(item.exam_start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}

                    {/* Mã lượt khám — luôn hiển thị để truy vết */}
                    <span style={{
                      fontSize: '.68rem', fontFamily: 'var(--font-mono)',
                      background: isCurrent ? 'var(--clr-primary-light)' : 'var(--clr-gray-100)',
                      color: isCurrent ? 'var(--clr-primary-dark)' : 'var(--clr-gray-500)',
                      padding: '1px 6px', borderRadius: 4,
                      fontWeight: 600,
                    }}>
                      #{item.reception_id}
                    </span>

                    {isCurrent && (
                      <span style={{
                        fontSize: '.65rem', fontWeight: 800,
                        background: 'var(--clr-primary)', color: '#fff',
                        padding: '1px 7px', borderRadius: 9999,
                      }}>Hiện tại</span>
                    )}

                    <span style={{
                      fontSize: '.65rem', fontWeight: 700,
                      background: st.bg, color: st.color,
                      padding: '1px 6px', borderRadius: 9999,
                    }}>{st.label}</span>
                  </div>

                  {/* Line 2: Phòng khám + bác sĩ + disposition */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    {item.clinic_room && (
                      <span style={{ fontSize: '.72rem', color: 'var(--clr-gray-500)' }}>
                        📍 {item.clinic_room}
                      </span>
                    )}
                    {item.doctor_name && (
                      <span style={{ fontSize: '.72rem', color: 'var(--clr-gray-500)' }}>
                        👨‍⚕️ {item.doctor_name}
                      </span>
                    )}
                    {dispDef && (
                      <span style={{
                        fontSize: '.68rem', fontWeight: 700,
                        color: dispDef.color,
                        background: dispDef.bg,
                        padding: '1px 6px', borderRadius: 3,
                      }}>
                        → {dispDef.label}
                      </span>
                    )}
                  </div>

                  {/* Line 3: Chẩn đoán tóm tắt */}
                  {item.diagnoses_summary && (
                    <div style={{
                      fontSize: '.72rem', color: 'var(--clr-gray-600)',
                      marginTop: 3, fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '100%',
                    }}>
                      🏷️ {item.diagnoses_summary}
                    </div>
                  )}
                </div>

                {/* Index badge */}
                <span style={{
                  fontSize: '.62rem', color: 'var(--clr-gray-300)',
                  flexShrink: 0, paddingTop: 2,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {idx + 1}/{items.length}
                </span>
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{
                padding: '10px 12px 12px 24px',
                background: 'var(--clr-gray-50)',
                borderBottom: '1px solid var(--clr-gray-200)',
                borderLeft: '3px solid var(--clr-primary)',
                marginLeft: 8,
              }}>
                {/* Detail rows */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', marginBottom: 10 }}>
                  {item.exam_start_at && (
                    <DetailRow label="Bắt đầu" value={new Date(item.exam_start_at).toLocaleString('vi-VN')} />
                  )}
                  {item.exam_end_at && (
                    <DetailRow label="Kết thúc" value={new Date(item.exam_end_at).toLocaleString('vi-VN')} />
                  )}
                  {item.doctor_name && (
                    <DetailRow label="Bác sĩ" value={item.doctor_name} />
                  )}
                  {item.nurse_name && (
                    <DetailRow label="Điều dưỡng" value={item.nurse_name} />
                  )}
                  {item.clinic_room && (
                    <DetailRow label="Phòng khám" value={item.clinic_room} />
                  )}
                  {dispDef && (
                    <DetailRow label="Hướng xử trí" value={dispDef.label} valueColor={dispDef.color} />
                  )}
                </div>

                {item.diagnoses_summary && (
                  <div style={{
                    padding: '6px 10px', background: '#fff',
                    border: '1px solid var(--clr-gray-200)',
                    borderRadius: 6, fontSize: '.78rem',
                    color: 'var(--clr-gray-700)', marginBottom: 10,
                  }}>
                    <span style={{ color: 'var(--clr-gray-400)', marginRight: 5 }}>Chẩn đoán:</span>
                    {item.diagnoses_summary}
                  </div>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={() => navigate(`/examination/${item.reception_id}`)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px',
                    background: 'var(--clr-primary)', color: '#fff',
                    border: 'none', borderRadius: 7, cursor: 'pointer',
                    fontSize: '.78rem', fontWeight: 700,
                    boxShadow: '0 1px 4px rgba(2,132,199,.3)',
                    transition: 'all .12s',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  🔍 Xem chi tiết lần khám #{item.reception_id}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Local helper ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: '.75rem' }}>
      <span style={{ color: 'var(--clr-gray-400)', flexShrink: 0, minWidth: 68 }}>{label}:</span>
      <span style={{ color: valueColor ?? 'var(--clr-gray-700)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}
