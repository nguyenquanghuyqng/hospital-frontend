/**
 * ConfigPage — Cấu hình cơ sở y tế + Audit log (admin only).
 *
 * Tab 1: Cấu hình — chỉnh sửa các thông số cơ sở
 * Tab 2: Audit log — xem nhật ký thay đổi
 */
import { useEffect, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@api/admin.api';
import type { SystemConfig, AuditLog } from '@api/admin.api';
import { useAsync } from '@hooks/useAsync';
import { usePagination } from '@hooks/usePagination';
import { Button, EmptyState, ErrorState, LoadingOverlay, Pagination } from '@components/ui';
import { fmtDateTime } from '@lib/utils';
import type { PaginatedResponse } from '@/types';

type TabId = 'config' | 'national' | 'audit';

const GROUP_LABELS: Record<string, string> = {
  facility: '🏥 Thông tin cơ sở',
  bhyt:     '🎫 Bảo hiểm y tế',
  invoice:  '🧾 Hoá đơn',
  system:   '⚙️ Hệ thống',
};
const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  CREATE: { bg: '#d1fae5', color: '#065f46' },
  UPDATE: { bg: '#dbeafe', color: '#1e40af' },
  DELETE: { bg: '#fee2e2', color: '#991b1b' },
  LOGIN:  { bg: '#f3e8ff', color: '#6b21a8' },
};

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('config');
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-4">
        <h1 style={{ fontWeight: 700, fontSize: '1.15rem', flex: 1 }}>⚙️ Cấu hình & Nhật ký</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--clr-gray-100)', marginBottom: 20 }}>
        {([
          { id: 'config',  label: '⚙️ Cấu hình cơ sở' },
          { id: 'national', label: '🔗 Liên thông BYT' },
          { id: 'audit',   label: '📋 Nhật ký thay đổi' },
        ] as { id: TabId; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '.9rem', fontWeight: 600,
              color: activeTab === t.id ? 'var(--clr-primary)' : 'var(--clr-gray-500)',
              borderBottom: `2px solid ${activeTab === t.id ? 'var(--clr-primary)' : 'transparent'}`,
              marginBottom: -2,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'config'   && <ConfigTab />}
      {activeTab === 'national' && <NationalConfigTab />}
      {activeTab === 'audit'    && <AuditTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB CẤU HÌNH
// ─────────────────────────────────────────────────────────────────────────────
function ConfigTab() {
  const listAsync   = useAsync<SystemConfig[]>();
  const actionAsync = useAsync<unknown>();
  const [editing, setEditing] = useState<Record<number, string>>({});
  const [dirty,   setDirty]   = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    listAsync.run(adminApi.getConfig() as Promise<SystemConfig[]>);
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const handleChange = (id: number, val: string) => {
    setEditing(prev => ({ ...prev, [id]: val }));
    setDirty(prev => new Set(prev).add(id));
  };

  const handleSave = async (cfg: SystemConfig) => {
    const newVal = editing[cfg.id] ?? cfg.value ?? '';
    const res = await actionAsync.run(adminApi.updateConfig(cfg.key, newVal));
    if (res) {
      toast.success(`Đã lưu: ${cfg.label}`);
      setDirty(prev => { const s = new Set(prev); s.delete(cfg.id); return s; });
      load();
    } else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const configs = listAsync.data ?? [];

  // Group by group field
  const grouped = configs.reduce<Record<string, SystemConfig[]>>((acc, c) => {
    (acc[c.group] ||= []).push(c);
    return acc;
  }, {});

  if (listAsync.loading) return <LoadingOverlay />;
  if (listAsync.error)   return <ErrorState message={listAsync.error} onRetry={load} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--clr-gray-100)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--clr-gray-100)', background: 'var(--clr-gray-50)', fontWeight: 700, fontSize: '.875rem', color: 'var(--clr-gray-700)' }}>
            {GROUP_LABELS[group] ?? group}
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {items.map(cfg => (
              <div key={cfg.id} style={{ display: 'grid', gridTemplateColumns: '240px 1fr auto', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.875rem', color: 'var(--clr-gray-700)' }}>{cfg.label}</div>
                  {cfg.description && <div style={{ fontSize: '.75rem', color: 'var(--clr-gray-400)', marginTop: 2 }}>{cfg.description}</div>}
                  <code style={{ fontSize: '.7rem', color: 'var(--clr-gray-400)' }}>{cfg.key}</code>
                </div>
                <input
                  className="form-input"
                  value={editing[cfg.id] ?? cfg.value ?? ''}
                  onChange={e => handleChange(cfg.id, e.target.value)}
                  style={{ borderColor: dirty.has(cfg.id) ? 'var(--clr-primary)' : undefined }}
                />
                <Button
                  size="sm"
                  variant={dirty.has(cfg.id) ? 'primary' : 'secondary'}
                  loading={actionAsync.loading}
                  onClick={() => handleSave(cfg)}
                  disabled={!dirty.has(cfg.id)}
                >
                  {dirty.has(cfg.id) ? '💾 Lưu' : '✓ Đã lưu'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB AUDIT LOG
// ─────────────────────────────────────────────────────────────────────────────
function AuditTab() {
  const listAsync = useAsync<PaginatedResponse<AuditLog>>();
  const { page, pageSize, goTo } = usePagination({ initialPageSize: 50 });

  const [filterAction,    setFilterAction]    = useState('');
  const [filterTableName, setFilterTableName] = useState('');

  const load = useCallback(() => {
    listAsync.run(
      adminApi.getAuditLogs({
        action:     filterAction    || undefined,
        table_name: filterTableName || undefined,
        page, page_size: pageSize,
      }) as Promise<PaginatedResponse<AuditLog>>,
    );
  }, [filterAction, filterTableName, page, pageSize]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const data = listAsync.data;

  return (
    <>
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">Hành động</label>
          <select className="form-input" style={{ marginTop: 4 }} value={filterAction}
            onChange={e => { setFilterAction(e.target.value); goTo(1); }}>
            <option value="">Tất cả</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="LOGIN">LOGIN</option>
            <option value="LOGOUT">LOGOUT</option>
          </select>
        </div>
        <div>
          <label className="form-label">Bảng dữ liệu</label>
          <input className="form-input" style={{ marginTop: 4, minWidth: 160 }} placeholder="examinations..."
            value={filterTableName} onChange={e => { setFilterTableName(e.target.value); goTo(1); }} />
        </div>
        <Button size="sm" variant="ghost" onClick={load}>↻</Button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--clr-gray-100)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {listAsync.loading && <LoadingOverlay />}
        {listAsync.error   && <ErrorState message={listAsync.error} onRetry={load} />}
        {!listAsync.loading && !listAsync.error && (data?.items.length ?? 0) === 0 && (
          <EmptyState icon="📋" title="Chưa có nhật ký nào" description="Các thay đổi sẽ xuất hiện ở đây." />
        )}
        {(data?.items.length ?? 0) > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8375rem' }}>
            <thead>
              <tr style={{ background: 'var(--clr-gray-50)' }}>
                {['Thời gian', 'Người dùng', 'Hành động', 'Bảng', 'ID', 'Mô tả', 'IP'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--clr-gray-500)', borderBottom: '2px solid var(--clr-gray-100)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map(log => {
                const ac = ACTION_COLORS[log.action] ?? { bg: '#f3f4f6', color: '#374151' };
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--clr-gray-50)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--clr-gray-50)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                    <td style={{ padding: '9px 12px', color: 'var(--clr-gray-500)', fontSize: '.8rem', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(log.created_at)}
                    </td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{log.username ?? '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: '.75rem', fontWeight: 700, background: ac.bg, color: ac.color }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <code style={{ fontSize: '.8rem', color: 'var(--clr-gray-600)' }}>{log.table_name ?? '—'}</code>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--clr-gray-500)' }}>{log.record_id ?? '—'}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--clr-gray-700)', maxWidth: 300 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {log.description ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--clr-gray-400)', fontSize: '.8rem' }}>{log.ip_address ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(data?.total_pages ?? 0) > 1 && (
        <div className="flex justify-end mt-3">
          <Pagination page={page} totalPages={data?.total_pages ?? 1} onChange={goTo} />
        </div>
      )}
    </>
  );
}
