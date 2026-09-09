/**
 * UsersPage — Quản lý tài khoản nhân viên (admin only).
 *
 * Chức năng:
 * - Danh sách nhân viên với filter role / trạng thái / tìm kiếm
 * - Tạo tài khoản mới
 * - Chỉnh sửa thông tin (tên, role, phòng, đổi mật khẩu)
 * - Kích hoạt / vô hiệu hoá
 * - Xoá tài khoản
 */
import { useEffect, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@api/admin.api';
import type { AdminUser, UserCreatePayload, UserUpdatePayload } from '@api/admin.api';
import { useAsync } from '@hooks/useAsync';
import { usePagination } from '@hooks/usePagination';
import {
  Button, EmptyState, ErrorState, LoadingOverlay,
  Pagination, ConfirmDialog, Modal, Field,
} from '@components/ui';
import type { PaginatedResponse } from '@/types';

const ROLES = ['doctor', 'nurse', 'receptionist', 'cashier', 'admin'];
const ROLE_LABELS: Record<string, string> = {
  doctor: '🩺 Bác sĩ', nurse: '💉 Điều dưỡng',
  receptionist: '🏥 Lễ tân', cashier: '💰 Thu ngân', admin: '⚙️ Admin',
};
const CLINIC_ROOMS = ['', 'Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4', 'Phòng Tim Mạch', 'Phòng Nhi', 'Phòng Da Liễu'];

// ── Form mặc định ─────────────────────────────────────────────────────────────
const EMPTY_CREATE: UserCreatePayload = { username: '', password: '', full_name: '', role: 'doctor', clinic_room: '' };
const EMPTY_UPDATE: UserUpdatePayload & { _id?: number } = { full_name: '', role: '', clinic_room: '', password: '' };

export default function UsersPage() {
  const listAsync = useAsync<PaginatedResponse<AdminUser>>();
  const { page, pageSize, goTo } = usePagination({ initialPageSize: 20 });

  const [filterRole,   setFilterRole]   = useState('');
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('');
  const [filterSearch, setFilterSearch] = useState('');

  const [createOpen,  setCreateOpen]  = useState(false);
  const [editTarget,  setEditTarget]  = useState<AdminUser | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<AdminUser | null>(null);
  const [toggleTarget,setToggleTarget]= useState<AdminUser | null>(null);

  const [createForm, setCreateForm] = useState<UserCreatePayload>(EMPTY_CREATE);
  const [editForm,   setEditForm]   = useState<UserUpdatePayload>({});

  const actionAsync = useAsync<unknown>();

  const load = useCallback(() => {
    listAsync.run(
      adminApi.listUsers({
        role:      filterRole    || undefined,
        is_active: filterActive === '' ? undefined : filterActive === 'true',
        search:    filterSearch  || undefined,
        page, page_size: pageSize,
      }) as Promise<PaginatedResponse<AdminUser>>,
    );
  }, [filterRole, filterActive, filterSearch, page, pageSize]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!createForm.username.trim()) { toast.error('Vui lòng nhập username'); return; }
    if (!createForm.password.trim()) { toast.error('Vui lòng nhập mật khẩu'); return; }
    const res = await actionAsync.run(adminApi.createUser(createForm));
    if (res) {
      toast.success('Tạo tài khoản thành công');
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
      load();
    } else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const res = await actionAsync.run(adminApi.updateUser(editTarget.id, editForm));
    if (res) {
      toast.success('Cập nhật thành công');
      setEditTarget(null);
      load();
    } else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    const res = await actionAsync.run(adminApi.toggleUser(toggleTarget.id));
    if (res) {
      toast.success(toggleTarget.is_active ? 'Đã vô hiệu hoá' : 'Đã kích hoạt');
      setToggleTarget(null);
      load();
    } else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await actionAsync.run(adminApi.deleteUser(deleteTarget.id));
    if (res !== null) {
      toast.success('Đã xoá tài khoản');
      setDeleteTarget(null);
      load();
    } else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const data = listAsync.data;

  return (
    <div className="page-container">

      {/* Header */}
      <div className="flex items-center gap-3 mb-4" style={{ flexWrap: 'wrap' }}>
        <h1 style={{ fontWeight: 700, fontSize: '1.15rem', flex: 1 }}>👥 Quản lý nhân viên</h1>
        <Button size="sm" onClick={() => { setCreateForm(EMPTY_CREATE); setCreateOpen(true); }}>
          + Thêm tài khoản
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label className="form-label">Vai trò</label>
          <select className="form-input" style={{ marginTop: 4, minWidth: 160 }}
            value={filterRole} onChange={e => { setFilterRole(e.target.value); goTo(1); }}>
            <option value="">Tất cả vai trò</option>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Trạng thái</label>
          <select className="form-input" style={{ marginTop: 4, minWidth: 150 }}
            value={filterActive} onChange={e => { setFilterActive(e.target.value as '' | 'true' | 'false'); goTo(1); }}>
            <option value="">Tất cả</option>
            <option value="true">✅ Đang hoạt động</option>
            <option value="false">⛔ Vô hiệu hoá</option>
          </select>
        </div>
        <div>
          <label className="form-label">Tìm kiếm</label>
          <input className="form-input" style={{ marginTop: 4, minWidth: 200 }}
            placeholder="Tên hoặc username..."
            value={filterSearch}
            onChange={e => { setFilterSearch(e.target.value); goTo(1); }}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={load}>↻ Làm mới</Button>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--clr-gray-100)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {listAsync.loading && <LoadingOverlay />}
        {listAsync.error   && <ErrorState message={listAsync.error} onRetry={load} />}
        {!listAsync.loading && !listAsync.error && (data?.items.length ?? 0) === 0 && (
          <EmptyState icon="👥" title="Không có tài khoản nào" description="Thêm tài khoản mới bằng nút ở trên." />
        )}
        {(data?.items.length ?? 0) > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ background: 'var(--clr-gray-50)' }}>
                {['Tên đăng nhập', 'Họ và tên', 'Vai trò', 'Phòng khám', 'Trạng thái', 'Thao tác'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--clr-gray-500)', borderBottom: '2px solid var(--clr-gray-100)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--clr-gray-50)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--clr-gray-50)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--clr-gray-800)' }}>{u.username}</td>
                  <td style={{ padding: '12px 14px' }}>{u.full_name ?? '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: '.78rem', fontWeight: 600, background: u.role === 'admin' ? '#fef3c7' : u.role === 'doctor' ? '#dbeafe' : '#f3e8ff', color: u.role === 'admin' ? '#92400e' : u.role === 'doctor' ? '#1e40af' : '#6b21a8' }}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', color: 'var(--clr-gray-500)', fontSize: '.875rem' }}>{u.clinic_room ?? '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: '.78rem', fontWeight: 600, background: u.is_active ? '#d1fae5' : '#fee2e2', color: u.is_active ? '#065f46' : '#991b1b' }}>
                      {u.is_active ? '✅ Hoạt động' : '⛔ Vô hiệu'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditTarget(u); setEditForm({ full_name: u.full_name ?? '', role: u.role, clinic_room: u.clinic_room ?? '', password: '' }); }}
                        style={btnStyle}>✏️ Sửa</button>
                      <button onClick={() => setToggleTarget(u)}
                        style={{ ...btnStyle, background: u.is_active ? '#fee2e2' : '#d1fae5', color: u.is_active ? '#991b1b' : '#065f46' }}>
                        {u.is_active ? '⛔' : '✅'}
                      </button>
                      <button onClick={() => setDeleteTarget(u)}
                        style={{ ...btnStyle, background: '#fee2e2', color: '#991b1b' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(data?.total_pages ?? 0) > 1 && (
        <div className="flex justify-end mt-3">
          <Pagination page={page} totalPages={data?.total_pages ?? 1} onChange={goTo} />
        </div>
      )}

      {/* ── Modal: Tạo tài khoản ────────────────────────────────────── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="➕ Tạo tài khoản mới" size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Huỷ</Button>
            <Button loading={actionAsync.loading} onClick={handleCreate}>Tạo tài khoản</Button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Username *">
            <input className="form-input" value={createForm.username}
              onChange={e => setCreateForm(f => ({ ...f, username: e.target.value }))}
              placeholder="vd: bsnguyena" autoFocus />
          </Field>
          <Field label="Mật khẩu *">
            <input className="form-input" type="password" value={createForm.password}
              onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Tối thiểu 8 ký tự" />
          </Field>
          <Field label="Họ và tên">
            <input className="form-input" value={createForm.full_name ?? ''}
              onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Nguyễn Văn A" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Vai trò">
              <select className="form-input" value={createForm.role}
                onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <Field label="Phòng khám">
              <select className="form-input" value={createForm.clinic_room ?? ''}
                onChange={e => setCreateForm(f => ({ ...f, clinic_room: e.target.value || null }))}>
                {CLINIC_ROOMS.map(r => <option key={r} value={r}>{r || '— Không có —'}</option>)}
              </select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Chỉnh sửa ────────────────────────────────────────── */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)}
        title={`✏️ Sửa: ${editTarget?.username}`} size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Huỷ</Button>
            <Button loading={actionAsync.loading} onClick={handleEdit}>Lưu thay đổi</Button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Họ và tên">
            <input className="form-input" value={editForm.full_name ?? ''}
              onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} autoFocus />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Vai trò">
              <select className="form-input" value={editForm.role ?? ''}
                onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <Field label="Phòng khám">
              <select className="form-input" value={editForm.clinic_room ?? ''}
                onChange={e => setEditForm(f => ({ ...f, clinic_room: e.target.value || null }))}>
                {CLINIC_ROOMS.map(r => <option key={r} value={r}>{r || '— Không có —'}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Mật khẩu mới (để trống = không đổi)">
            <input className="form-input" type="password" value={editForm.password ?? ''}
              onChange={e => setEditForm(f => ({ ...f, password: e.target.value || null }))}
              placeholder="Để trống nếu không đổi" />
          </Field>
        </div>
      </Modal>

      {/* ── Confirm: Toggle ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!toggleTarget} onClose={() => setToggleTarget(null)} onConfirm={handleToggle}
        title={toggleTarget?.is_active ? 'Vô hiệu hoá tài khoản' : 'Kích hoạt tài khoản'}
        message={`${toggleTarget?.is_active ? 'Vô hiệu hoá' : 'Kích hoạt'} tài khoản "${toggleTarget?.username}"?`}
        confirmLabel={toggleTarget?.is_active ? 'Vô hiệu hoá' : 'Kích hoạt'}
        danger={toggleTarget?.is_active}
      />

      {/* ── Confirm: Delete ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Xoá tài khoản" danger
        message={`Xoá vĩnh viễn tài khoản "${deleteTarget?.username}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá vĩnh viễn"
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: 'var(--clr-gray-100)', color: 'var(--clr-gray-600)',
  cursor: 'pointer', fontSize: '.8125rem', fontWeight: 600,
  fontFamily: 'var(--font-sans)',
};
