/**
 * PrescriptionStatusCard — Hiển thị thông tin đơn thuốc điện tử BYT.
 *
 * Hiển thị ở đầu PrescriptionPanel khi examination đã COMPLETED:
 * - Mã đơn 14 ký tự (XXXXXYYYYYYY-Z)
 * - Badge loại N/H/C (màu đỏ/cam/xanh)
 * - Trạng thái đẩy lên hệ thống quốc gia
 * - Nút retry nếu lỗi
 * - QR code tra cứu nếu thành công
 * - Cảnh báo đơn đã gửi → không thể chỉnh sửa
 * - Form bổ sung thông tin bắt buộc nếu thiếu (phone, guardian, treatment dates)
 */
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { prescriptionApi } from '@api/prescription.api';
import { useAsync } from '@hooks/useAsync';
import type { PrescriptionResponse, PrescriptionType, PrescriptionPushStatus } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<PrescriptionType, { label: string; color: string; bg: string; border: string; desc: string }> = {
  N: { label: 'Đơn N — Gây nghiện',        color: '#991b1b', bg: '#fff1f2', border: '#fca5a5',  desc: 'Yêu cầu in đơn giấy + CCCD người nhận' },
  H: { label: 'Đơn H — Hướng thần',        color: '#92400e', bg: '#fffbeb', border: '#fde68a',  desc: 'Yêu cầu in đơn giấy + CCCD người nhận' },
  C: { label: 'Đơn C — Thông thường',       color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe',  desc: 'Đơn thuốc thông thường' },
};

const PUSH_CONFIG: Record<PrescriptionPushStatus, { icon: string; label: string; color: string; bg: string }> = {
  pending:   { icon: '⏳', label: 'Chờ gửi',          color: '#92400e', bg: '#fef3c7' },
  sending:   { icon: '🔄', label: 'Đang gửi...',      color: '#1e40af', bg: '#dbeafe' },
  success:   { icon: '✅', label: 'Đã gửi thành công', color: '#065f46', bg: '#d1fae5' },
  error:     { icon: '❌', label: 'Gửi thất bại',      color: '#991b1b', bg: '#fee2e2' },
  cancelled: { icon: '⛔', label: 'Đã huỷ',            color: '#6b7280', bg: '#f3f4f6' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examinationId: number;
  isCompleted:   boolean;
  onUpdated?:    () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrescriptionStatusCard({ examinationId, isCompleted, onUpdated }: Props) {
  const [rx, setRx]             = useState<PrescriptionResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showQr, setShowQr]     = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Supplementary form state
  const [phone,         setPhone]        = useState('');
  const [guardianName,  setGuardianName] = useState('');
  const [recipientCccd, setRecipientCccd] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [treatmentFrom, setTreatmentFrom] = useState('');
  const [treatmentTo,   setTreatmentTo]   = useState('');

  const retryAsync  = useAsync<PrescriptionResponse>();
  const updateAsync = useAsync<PrescriptionResponse>();

  const load = useCallback(async () => {
    if (!isCompleted) return;
    setLoading(true);
    try {
      const data = await prescriptionApi.getByExamination(examinationId);
      setRx(data);
      // Pre-fill supplement form
      setPhone(data.patient_phone ?? '');
      setGuardianName(data.guardian_name ?? '');
      setRecipientCccd(data.recipient_cccd ?? '');
      setRecipientName(data.recipient_name ?? '');
      setTreatmentFrom(data.treatment_from ?? '');
      setTreatmentTo(data.treatment_to ?? '');
    } catch {
      setRx(null); // Chưa có đơn — bình thường
    } finally {
      setLoading(false);
    }
  }, [examinationId, isCompleted]);

  useEffect(() => { load(); }, [load]);

  // Poll trạng thái khi đang sending
  useEffect(() => {
    if (rx?.push_status !== 'sending' && rx?.push_status !== 'pending') return;
    const timer = setInterval(() => load(), 5000);
    return () => clearInterval(timer);
  }, [rx?.push_status, load]);

  const handleRetry = async () => {
    if (!rx) return;
    const updated = await retryAsync.run(prescriptionApi.retry(rx.id));
    if (updated) {
      toast.success('Đã yêu cầu gửi lại đơn');
      setRx(updated);
      onUpdated?.();
    } else {
      toast.error('Retry thất bại');
    }
  };

  const handleSaveSupp = async () => {
    if (!rx) return;
    const updated = await updateAsync.run(
      prescriptionApi.update(rx.id, {
        patient_phone:  phone || null,
        guardian_name:  guardianName || null,
        recipient_cccd: recipientCccd || null,
        recipient_name: recipientName || null,
        treatment_from: treatmentFrom || null,
        treatment_to:   treatmentTo   || null,
      }),
    );
    if (updated) {
      toast.success('Đã cập nhật thông tin đơn');
      setRx(updated);
      setShowForm(false);
      onUpdated?.();
    } else {
      toast.error('Cập nhật thất bại');
    }
  };

  // ── Không hiển thị nếu chưa completed hoặc chưa load xong ───────────────
  if (!isCompleted) return null;
  if (loading) {
    return (
      <div style={{ padding: '12px 16px', background: 'var(--clr-gray-50)', borderRadius: 10, fontSize: '.83rem', color: 'var(--clr-gray-400)' }}>
        ⏳ Đang tải thông tin đơn thuốc điện tử...
      </div>
    );
  }
  if (!rx) return null;

  const typeConf = TYPE_CONFIG[rx.prescription_type];
  const pushConf = PUSH_CONFIG[rx.push_status];
  const isSuccess = rx.push_status === 'success';
  const isError   = rx.push_status === 'error';
  const isNH      = rx.prescription_type === 'N' || rx.prescription_type === 'H';

  // Missing fields check
  const missingPhone    = !rx.patient_phone;
  const missingGuardian = !rx.guardian_name && isNH;
  const missingCccd     = !rx.recipient_cccd && isNH;
  const missingTreatment = (!rx.treatment_from || !rx.treatment_to) && isNH;
  const hasMissing = missingPhone || missingGuardian || missingCccd || missingTreatment;

  return (
    <div style={{
      borderRadius: 12,
      border: `1.5px solid ${isSuccess ? '#a7f3d0' : isError ? '#fca5a5' : typeConf.border}`,
      background: isSuccess ? '#f0fdf4' : isError ? '#fff5f5' : typeConf.bg,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>

      {/* ── Header: mã đơn + type badge ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            {/* Type badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 12px', borderRadius: 9999,
              background: typeConf.bg, border: `1.5px solid ${typeConf.border}`,
              color: typeConf.color, fontSize: '.75rem', fontWeight: 800,
              textTransform: 'uppercase' as const, letterSpacing: '.08em',
            }}>
              ⚕️ {rx.prescription_type}
            </span>

            {/* Push status */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 12px', borderRadius: 9999,
              background: pushConf.bg, color: pushConf.color,
              fontSize: '.75rem', fontWeight: 700,
            }}>
              {pushConf.icon} {pushConf.label}
            </span>

            {rx.sold_at && (
              <span style={{
                padding: '3px 12px', borderRadius: 9999,
                background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                fontSize: '.72rem', fontWeight: 700,
              }}>
                🛒 Đã bán
              </span>
            )}
          </div>

          {/* Mã đơn 14 ký tự */}
          {rx.prescription_code ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.65rem', color: 'var(--clr-gray-400)', textTransform: 'uppercase' as const, letterSpacing: '.06em', fontWeight: 700 }}>
                Mã đơn
              </span>
              <code style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1rem', fontWeight: 800,
                color: typeConf.color,
                letterSpacing: '.08em',
                background: '#fff',
                padding: '3px 10px', borderRadius: 6,
                border: `1px solid ${typeConf.border}`,
              }}>
                {rx.prescription_code}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(rx.prescription_code!); toast.success('Đã copy mã đơn'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.8rem', color: 'var(--clr-gray-400)' }}
                title="Copy mã đơn"
              >📋</button>
            </div>
          ) : (
            <div style={{ fontSize: '.83rem', color: 'var(--clr-gray-400)', fontStyle: 'italic' }}>
              Chưa sinh mã đơn
            </div>
          )}

          {/* Desc */}
          <div style={{ fontSize: '.75rem', color: typeConf.color, marginTop: 4, opacity: .8 }}>
            {typeConf.desc}
          </div>
        </div>

        {/* QR toggle */}
        {isSuccess && rx.prescription_code && (
          <button
            onClick={() => setShowQr(v => !v)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '8px 12px', borderRadius: 10,
              background: '#fff', border: '1px solid #a7f3d0',
              cursor: 'pointer', color: '#065f46', flexShrink: 0,
            }}
            title="Xem / ẩn QR code tra cứu"
          >
            <span style={{ fontSize: '1.4rem' }}>📱</span>
            <span style={{ fontSize: '.65rem', fontWeight: 700 }}>{showQr ? 'Ẩn QR' : 'QR Code'}</span>
          </button>
        )}
      </div>

      {/* ── QR Code ────────────────────────────────────────────────────────── */}
      {showQr && isSuccess && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          padding: 16, background: '#fff', borderRadius: 10, border: '1px solid #a7f3d0',
        }}>
          <img
            src={prescriptionApi.qrUrl(rx.id)}
            alt={`QR code đơn thuốc ${rx.prescription_code}`}
            style={{ width: 160, height: 160, borderRadius: 8 }}
            onError={e => (e.currentTarget.style.display = 'none')}
          />
          <div style={{ fontSize: '.75rem', color: '#065f46', fontWeight: 600, textAlign: 'center' }}>
            Bệnh nhân quét để tra cứu đơn tại donthuocquocgia.vn
          </div>
          <a
            href={`https://donthuocquocgia.vn/tra-cuu/${rx.prescription_code}`}
            target="_blank" rel="noreferrer"
            style={{ fontSize: '.75rem', color: '#1e40af' }}
          >
            🔗 {`donthuocquocgia.vn/tra-cuu/${rx.prescription_code}`}
          </a>
        </div>
      )}

      {/* ── Sent info ──────────────────────────────────────────────────────── */}
      {isSuccess && rx.sent_at && (
        <div style={{ fontSize: '.78rem', color: '#065f46', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>✅ Gửi lúc: <strong>{new Date(rx.sent_at).toLocaleString('vi-VN')}</strong></span>
          {rx.national_ref_id && (
            <span>· Mã BYT: <code style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem' }}>{rx.national_ref_id}</code></span>
          )}
        </div>
      )}

      {/* ── Error retry ────────────────────────────────────────────────────── */}
      {isError && (
        <div style={{ padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #fca5a5' }}>
          <div style={{ fontSize: '.8rem', color: '#991b1b', fontWeight: 600, marginBottom: 6 }}>
            ❌ Gửi thất bại ({rx.retry_count} lần thử)
            {rx.retry_at && (
              <span style={{ fontWeight: 400, marginLeft: 8 }}>
                · Retry tiếp theo: {new Date(rx.retry_at).toLocaleString('vi-VN')}
              </span>
            )}
          </div>
          <button
            onClick={handleRetry}
            disabled={retryAsync.loading}
            style={{
              padding: '5px 14px', borderRadius: 7, border: '1px solid #fca5a5',
              background: retryAsync.loading ? '#f9fafb' : '#fff',
              color: '#991b1b', fontWeight: 700, cursor: retryAsync.loading ? 'default' : 'pointer',
              fontSize: '.8rem',
            }}
          >
            {retryAsync.loading ? '🔄 Đang gửi...' : '🔁 Gửi lại ngay'}
          </button>
        </div>
      )}

      {/* ── Locked banner khi đã thành công ────────────────────────────────── */}
      {isSuccess && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', background: '#fff', borderRadius: 8,
          border: '1px solid #a7f3d0', fontSize: '.78rem', color: '#065f46',
        }}>
          <span>🔒</span>
          <span>Đơn đã gửi thành công — không thể chỉnh sửa thuốc trong đơn này.</span>
        </div>
      )}

      {/* ── Missing fields warning & supplement form ───────────────────────── */}
      {hasMissing && !isSuccess && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
            ⚠️ Thiếu thông tin bắt buộc — đơn sẽ bị từ chối khi gửi lên BYT
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.78rem', color: '#92400e' }}>
            {missingPhone    && <li>Số điện thoại bệnh nhân</li>}
            {missingGuardian && <li>Tên bố/mẹ/người đưa trẻ (đơn {rx.prescription_type})</li>}
            {missingCccd     && <li>CCCD người nhận thuốc (đơn {rx.prescription_type})</li>}
            {missingTreatment && <li>Đợt dùng thuốc từ ngày — đến ngày (đơn {rx.prescription_type})</li>}
          </ul>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid #fde68a', background: '#fff', color: '#92400e', fontWeight: 700, fontSize: '.78rem', cursor: 'pointer' }}
            >
              ✏️ Bổ sung ngay
            </button>
          )}
        </div>
      )}

      {/* ── Supplement form ────────────────────────────────────────────────── */}
      {showForm && !isSuccess && (
        <div style={{ background: '#fff', border: '1px solid var(--clr-gray-200)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--clr-gray-700)' }}>
            Bổ sung thông tin bắt buộc
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LBL}>SĐT bệnh nhân <Req /></label>
              <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="0912345678" />
            </div>
            {isNH && (
              <div>
                <label style={LBL}>Tên người nhận thuốc <Req /></label>
                <input className="form-input" value={recipientName} onChange={e => setRecipientName(e.target.value)}
                  placeholder="Họ tên người nhận" />
              </div>
            )}
            {isNH && (
              <div>
                <label style={LBL}>CCCD người nhận <Req /></label>
                <input className="form-input" value={recipientCccd} onChange={e => setRecipientCccd(e.target.value)}
                  placeholder="12 ký tự" maxLength={12} />
              </div>
            )}
            {isNH && (
              <div>
                <label style={LBL}>Tên bố/mẹ/người đưa trẻ <Req /></label>
                <input className="form-input" value={guardianName} onChange={e => setGuardianName(e.target.value)}
                  placeholder="Họ tên" />
              </div>
            )}
          </div>

          {isNH && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LBL}>Đợt dùng thuốc từ ngày <Req /></label>
                <input type="date" className="form-input" value={treatmentFrom} onChange={e => setTreatmentFrom(e.target.value)} />
              </div>
              <div>
                <label style={LBL}>Đến ngày <Req /></label>
                <input type="date" className="form-input" value={treatmentTo} onChange={e => setTreatmentTo(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveSupp}
              disabled={updateAsync.loading}
              style={{ padding: '6px 16px', borderRadius: 7, background: 'var(--clr-primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '.83rem', cursor: updateAsync.loading ? 'default' : 'pointer' }}
            >
              {updateAsync.loading ? '⏳ Đang lưu...' : '💾 Lưu'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '6px 16px', borderRadius: 7, background: 'var(--clr-gray-100)', color: 'var(--clr-gray-600)', border: 'none', fontWeight: 600, fontSize: '.83rem', cursor: 'pointer' }}>
              Huỷ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Micro helpers ──────────────────────────────────────────────────────────────

const LBL: React.CSSProperties = {
  fontSize: '.65rem', fontWeight: 700,
  textTransform: 'uppercase' as const, letterSpacing: '.06em',
  color: 'var(--clr-gray-500)', marginBottom: 4, display: 'block',
};

function Req() {
  return <span style={{ color: 'var(--clr-danger)' }}> *</span>;
}
