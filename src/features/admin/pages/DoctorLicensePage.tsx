/**
 * DoctorLicensePage — Quản lý mã liên thông quốc gia của bác sĩ (admin only).
 *
 * Tính năng:
 * - Xem danh sách bác sĩ với trạng thái mã liên thông
 * - Gán mã liên thông mới
 * - Thay đổi trạng thái: active / suspended / revoked
 * - Filter theo license_status và has_code
 * - Cảnh báo bác sĩ chưa có mã (không thể kê đơn BYT)
 */
import { useEffect, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@api/admin.api';
import type { AdminUser } from '@api/admin.api';
import { useAsync } from '@hooks/useAsync';
import { Button, EmptyState, ErrorState, LoadingOverlay, Modal, Field } from '@components/ui';
import type { LicenseStatus } from '@/types';

// ── Config ────────────────────────────────────────────────────────────────────

const LICENSE_CONFIG: Record<LicenseStatus, { label: string; color: string; bg: string; icon: string }> = {
  active:    { label: 'Đang hành nghề', color: '#065f46', bg: '#d1fae5', icon: '✅' },
  suspended: { label: 'Tạm dừng',       color: '#92400e', bg: '#fef3c7', icon: '⏸️' },
  revoked:   { label: 'Đã thu hồi',     color: '#991b1b', bg: '#fee2e2', icon: '🚫' },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DoctorLicensePage() {
  const listAsync   = useAsync<AdminUser[]>();
  const updateAsync = useAsync<AdminUser>();

  const [filterStatus, setFilterStatus] = useState<'' | LicenseStatus>('');
  const [filterHasCode, setFilterHasCode] = useState<'' | 'true' | 'false'>('');

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editCode,   setEditCode]   = useState('');
  const [editStatus, setEditStatus] = useState<LicenseStatus>('active');

  const load = useCallback(() => {
    listAsync.run(
      adminApi.listDoctorLicenseStatus({
        license_status: filterStatus || undefined,
        has_code:       filterHasCode === '' ? undefined : filterHasCode === 'true',
      }) as Promise<AdminUser[]>,
    );
  }, [filterStatus, filterHasCode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const openEdit = (user: AdminUser) => {
    setEditTarget(user);
    setEditCode(user.national_doctor_code ?? '');
    setEditStatus((user.license_status as LicenseStatus) ?? 'active');
  };

  const handleSave = async () => {
    if (!editTarget) return;
    const updated = await updateAsync.run(
      adminApi.updateLicense(editTarget.id, {
        national_doctor_code: editCode.trim() || null,
        license_status: editStatus,
      }) as Promise<AdminUser>,
    );
    if (updated) {
      toast.success(`Đã cập nhật mã liên thông cho BS. ${editTarget.full_name ?? editTarget.username}`);
      setEditTarget(null);
      load();
    } else {
      toast.error(updateAsync.error ?? 'Cập nhật thất bại');
    }
  };

  const users    = listAsync.data ?? [];
  const noCode   = users.filter(u => !u.national_doctor_code).length;
  const inactive = users.filter(u => u.license_status !== 'active').length;

  return (
    <div className="page-container">
      {updateAsync.loading && <LoadingOverlay />}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 4 }}>
          🔗 Quản lý mã liên thông bác sĩ
        </h1>
        <p style={{ fontSize: '.875rem', color: 'var(--clr-gray-500)' }}>
          Quản lý vòng đời mã liên thông quốc gia (donthuocquocgia.vn) theo từng bác sĩ.
        </p>
      </div>

      {/* ── Summary banners ─────────────────────────────────────────────────── */}
      {(noCode > 0 || inactive > 0) && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {noCode > 0 && (
            <div style={{
              flex: 1, minWidth: 220,
              padding: '12px 16px', borderRadius: 10,
              background: '#fff7ed', border: '1.5px solid #fed7aa',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: '1.4rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#9a3412', fontSize: '.875rem' }}>
                  {noCode} bác sĩ chưa có mã liên thông
                </div>
                <div style={{ fontSize: '.78rem', color: '#c2410c' }}>
                  Không thể kê đơn thuốc điện tử lên BYT
                </div>
              </div>
            </div>
          )}
          {inactive > 0 && (
            <div style={{
              flex: 1, minWidth: 220,
              padding: '12px 16px', borderRadius: 10,
              background: '#fef2f2', border: '1.5px solid #fca5a5',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: '1.4rem' }}>🚫</span>
              <div>
                <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '.875rem' }}>
                  {inactive} bác sĩ bị tạm dừng / thu hồi
                </div>
                <div style={{ fontSize: '.78rem', color: '#b91c1c' }}>
                  Không được phép kê đơn cho đến khi khôi phục
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          className="form-input"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as '' | LicenseStatus)}
          style={{ width: 200 }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">✅ Đang hành nghề</option>
          <option value="suspended">⏸️ Tạm dừng</option>
          <option value="revoked">🚫 Đã thu hồi</option>
        </select>

        <select
          className="form-input"
          value={filterHasCode}
          onChange={e => setFilterHasCode(e.target.value as '' | 'true' | 'false')}
          style={{ width: 200 }}
        >
          <option value="">Tất cả (có / chưa có mã)</option>
          <option value="true">✅ Đã có mã liên thông</option>
          <option value="false">⚠️ Chưa có mã</option>
        </select>

        <Button size="sm" variant="secondary" onClick={load} loading={listAsync.loading}>
          🔄 Làm mới
        </Button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {listAsync.loading && <LoadingOverlay />}
      {listAsync.error  && <ErrorState message={listAsync.error} onRetry={load} />}

      {!listAsync.loading && users.length === 0 && (
        <EmptyState icon="👨‍⚕️" title="Không có bác sĩ nào" description="Thử bỏ bộ lọc hoặc thêm bác sĩ từ trang quản lý người dùng." />
      )}

      {users.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(user => {
            const lsConf = LICENSE_CONFIG[(user.license_status as LicenseStatus) ?? 'active'];
            const hasCode = !!user.national_doctor_code;

            return (
              <div
                key={user.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 10,
                  background: '#fff',
                  border: `1.5px solid ${!hasCode ? '#fde68a' : lsConf.bg}`,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: hasCode ? lsConf.bg : '#fef3c7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem',
                }}>
                  {lsConf.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--clr-gray-800)' }}>
                    {user.full_name ?? user.username}
                    <span style={{ marginLeft: 8, fontWeight: 400, fontSize: '.78rem', color: 'var(--clr-gray-400)' }}>
                      @{user.username}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* License status */}
                    <span style={{
                      padding: '2px 10px', borderRadius: 9999,
                      background: lsConf.bg, color: lsConf.color,
                      fontSize: '.72rem', fontWeight: 700,
                    }}>
                      {lsConf.icon} {lsConf.label}
                    </span>

                    {/* National code */}
                    {hasCode ? (
                      <code style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '.8rem', padding: '1px 8px',
                        background: '#f0f9ff', color: '#0369a1',
                        borderRadius: 5, border: '1px solid #bae6fd',
                      }}>
                        {user.national_doctor_code}
                      </code>
                    ) : (
                      <span style={{
                        padding: '2px 10px', borderRadius: 9999,
                        background: '#fef3c7', color: '#92400e',
                        fontSize: '.72rem', fontWeight: 700,
                      }}>
                        ⚠️ Chưa có mã liên thông
                      </span>
                    )}

                    {user.clinic_room && (
                      <span style={{ fontSize: '.75rem', color: 'var(--clr-gray-400)' }}>
                        📍 {user.clinic_room}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <Button size="sm" variant="secondary" onClick={() => openEdit(user)}>
                  ✏️ {hasCode ? 'Cập nhật' : 'Gán mã'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {editTarget && (
        <Modal
          title={`Mã liên thông — ${editTarget.full_name ?? editTarget.username}`}
          onClose={() => setEditTarget(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
            <Field label="Mã liên thông quốc gia (Sở Y tế cấp)">
              <input
                className="form-input"
                value={editCode}
                onChange={e => setEditCode(e.target.value)}
                placeholder="VD: BS12345"
                autoFocus
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.05em' }}
              />
              <div style={{ marginTop: 5, fontSize: '.72rem', color: 'var(--clr-gray-400)' }}>
                Để trống để xóa mã liên thông
              </div>
            </Field>

            <Field label="Trạng thái hành nghề">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.entries(LICENSE_CONFIG) as [LicenseStatus, typeof LICENSE_CONFIG[LicenseStatus]][]).map(([k, conf]) => (
                  <button
                    key={k} type="button"
                    onClick={() => setEditStatus(k)}
                    style={{
                      flex: 1, minWidth: 120,
                      padding: '8px 12px', borderRadius: 8,
                      border: `1.5px solid ${editStatus === k ? conf.color + '80' : 'var(--clr-gray-200)'}`,
                      background: editStatus === k ? conf.bg : '#fff',
                      color: editStatus === k ? conf.color : 'var(--clr-gray-500)',
                      fontWeight: editStatus === k ? 700 : 400,
                      cursor: 'pointer', fontSize: '.83rem',
                      textAlign: 'center',
                    }}
                  >
                    {conf.icon} {conf.label}
                    {editStatus === k && <span style={{ marginLeft: 4, fontSize: '.65rem' }}>✓</span>}
                  </button>
                ))}
              </div>
            </Field>

            {editStatus === 'revoked' && (
              <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: 8, fontSize: '.8rem', color: '#991b1b' }}>
                ⚠️ Sau khi thu hồi, bác sĩ này sẽ không thể kê bất kỳ đơn thuốc điện tử nào cho đến khi được khôi phục.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
              <Button variant="ghost" onClick={() => setEditTarget(null)}>Huỷ</Button>
              <Button onClick={handleSave} loading={updateAsync.loading}>
                💾 Lưu thay đổi
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
