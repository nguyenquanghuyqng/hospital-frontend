/**
 * CatalogPage — Quản lý danh mục thuốc + dịch vụ CLS (admin only).
 *
 * Layout 2 tab: Thuốc | Dịch vụ CLS
 */
import { useEffect, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { catalogApi } from '@api/catalog.api';
import type { DrugList, DrugPayload, ClsServiceList, ClsServicePayload } from '@api/catalog.api';
import { useAsync } from '@hooks/useAsync';
import { usePagination } from '@hooks/usePagination';
import {
  Button, EmptyState, ErrorState, LoadingOverlay,
  Pagination, ConfirmDialog, Modal, Field,
} from '@components/ui';
import type { PaginatedResponse } from '@/types';

type TabId = 'drugs' | 'cls';

const CLS_GROUPS = [
  { value: 'lab',       label: '🧪 Xét nghiệm' },
  { value: 'imaging',   label: '🩻 Chẩn đoán hình ảnh' },
  { value: 'procedure', label: '🔬 Thủ thuật' },
  { value: 'other',     label: '📋 Khác' },
];

const fmtMoney = (v: string | number | null) =>
  v == null ? '—' : Number(v).toLocaleString('vi-VN') + ' ₫';

// ── EMPTY FORMS ───────────────────────────────────────────────────────────────
const EMPTY_DRUG: DrugPayload = {
  drug_code: '', drug_name: '', unit: 'viên', unit_price: 0,
  is_active: true, is_bhyt: false,
};
const EMPTY_CLS: ClsServicePayload = {
  service_code: '', service_name: '', unit: 'lần', unit_price: 0,
  is_active: true, is_bhyt: false,
};

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<TabId>('drugs');
  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-4">
        <h1 style={{ fontWeight: 700, fontSize: '1.15rem', flex: 1 }}>📦 Danh mục</h1>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--clr-gray-100)', marginBottom: 20 }}>
        {([
          { id: 'drugs', label: '💊 Thuốc' },
          { id: 'cls',   label: '🔬 Dịch vụ CLS' },
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

      {activeTab === 'drugs' && <DrugTab />}
      {activeTab === 'cls'   && <ClsTab />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB THUỐC
// ─────────────────────────────────────────────────────────────────────────────
function DrugTab() {
  const listAsync = useAsync<PaginatedResponse<DrugList>>();
  const actionAsync = useAsync<unknown>();
  const { page, pageSize, goTo } = usePagination({ initialPageSize: 20 });

  const [keyword,  setKeyword]  = useState('');
  const [isBhyt,   setIsBhyt]   = useState<'' | 'true' | 'false'>('');
  const [formOpen, setFormOpen]  = useState(false);
  const [editId,   setEditId]    = useState<number | null>(null);
  const [form,     setForm]      = useState<DrugPayload>(EMPTY_DRUG);
  const [delTarget,setDelTarget] = useState<DrugList | null>(null);

  const load = useCallback(() => {
    listAsync.run(
      catalogApi.listDrugs({
        keyword, page, page_size: pageSize,
        is_bhyt: isBhyt === '' ? undefined : isBhyt === 'true',
      }) as Promise<PaginatedResponse<DrugList>>,
    );
  }, [keyword, isBhyt, page, pageSize]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm(EMPTY_DRUG); setFormOpen(true); };
  const openEdit   = (d: DrugList) => {
    setEditId(d.id);
    setForm({
      drug_code: d.drug_code, drug_name: d.drug_name,
      generic_name: d.generic_name ?? '', active_ingredient: d.active_ingredient ?? '',
      unit: d.unit, unit_price: Number(d.unit_price),
      bhyt_price: d.bhyt_price ? Number(d.bhyt_price) : undefined,
      bhyt_ratio: d.bhyt_ratio ? Number(d.bhyt_ratio) : undefined,
      stock_quantity: d.stock_quantity, is_active: d.is_active, is_bhyt: d.is_bhyt,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.drug_code.trim()) { toast.error('Vui lòng nhập mã thuốc'); return; }
    if (!form.drug_name.trim()) { toast.error('Vui lòng nhập tên thuốc'); return; }
    const res = editId
      ? await actionAsync.run(catalogApi.updateDrug(editId, form))
      : await actionAsync.run(catalogApi.createDrug(form));
    if (res) { toast.success(editId ? 'Đã cập nhật' : 'Đã thêm thuốc'); setFormOpen(false); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    const res = await actionAsync.run(catalogApi.deleteDrug(delTarget.id));
    if (res !== null) { toast.success('Đã vô hiệu hoá'); setDelTarget(null); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const data = listAsync.data;

  return (
    <>
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label">Tìm kiếm</label>
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Tên, mã, hoạt chất..."
            value={keyword} onChange={e => { setKeyword(e.target.value); goTo(1); }} />
        </div>
        <div>
          <label className="form-label">BHYT</label>
          <select className="form-input" style={{ marginTop: 4 }} value={isBhyt}
            onChange={e => { setIsBhyt(e.target.value as '' | 'true' | 'false'); goTo(1); }}>
            <option value="">Tất cả</option>
            <option value="true">✅ Có BHYT</option>
            <option value="false">❌ Không BHYT</option>
          </select>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>↻</Button>
        <Button size="sm" onClick={openCreate}>+ Thêm thuốc</Button>
      </div>

      <CatalogTable
        loading={listAsync.loading} error={listAsync.error} onRetry={load}
        emptyIcon="💊" emptyTitle="Chưa có thuốc nào"
        headers={['Mã', 'Tên thuốc', 'Hoạt chất', 'Đơn vị', 'Giá bán', 'BHYT', 'Tồn kho', 'Trạng thái', '']}
        rows={(data?.items ?? []).map(d => ({
          key: d.id,
          cells: [
            <code style={{ fontSize: '.8rem', color: 'var(--clr-primary-dark)' }}>{d.drug_code}</code>,
            <div>
              <div style={{ fontWeight: 600 }}>{d.drug_name}</div>
              {d.generic_name && <div style={{ fontSize: '.8rem', color: 'var(--clr-gray-400)' }}>{d.generic_name}</div>}
            </div>,
            <span style={{ fontSize: '.8rem', color: 'var(--clr-gray-500)' }}>{d.active_ingredient ?? '—'}</span>,
            d.unit,
            fmtMoney(d.unit_price),
            d.is_bhyt
              ? <span style={pill('#d1fae5','#065f46')}>✅ BHYT</span>
              : <span style={pill('#f3f4f6','#6b7280')}>—</span>,
            <span style={{ color: d.stock_quantity <= 0 ? '#dc2626' : 'inherit', fontWeight: d.stock_quantity <= 0 ? 700 : 400 }}>
              {d.stock_quantity}
            </span>,
            d.is_active
              ? <span style={pill('#d1fae5','#065f46')}>Hoạt động</span>
              : <span style={pill('#fee2e2','#991b1b')}>Vô hiệu</span>,
            <div className="flex gap-2">
              <button onClick={() => openEdit(d)} style={smallBtn}>✏️</button>
              <button onClick={() => setDelTarget(d)} style={{ ...smallBtn, background: '#fee2e2', color: '#991b1b' }}>🗑️</button>
            </div>,
          ],
        }))}
      />

      {(data?.total_pages ?? 0) > 1 && (
        <div className="flex justify-end mt-3">
          <Pagination page={page} totalPages={data?.total_pages ?? 1} onChange={goTo} />
        </div>
      )}

      {/* Form Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)}
        title={editId ? '✏️ Sửa thuốc' : '➕ Thêm thuốc'} size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Huỷ</Button>
            <Button loading={actionAsync.loading} onClick={handleSave}>Lưu</Button>
          </div>
        }>
        <DrugForm form={form} onChange={setForm} />
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}
        title="Vô hiệu hoá thuốc" danger
        message={`Vô hiệu hoá thuốc "${delTarget?.drug_name}"?`}
        confirmLabel="Vô hiệu hoá" />
    </>
  );
}

function DrugForm({ form, onChange }: { form: DrugPayload; onChange: (f: DrugPayload) => void }) {
  const set = (k: keyof DrugPayload, v: unknown) => onChange({ ...form, [k]: v });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Field label="Mã thuốc *"><input className="form-input" value={form.drug_code} onChange={e => set('drug_code', e.target.value)} placeholder="TH001" /></Field>
      <Field label="Đơn vị *"><input className="form-input" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="viên" /></Field>
      <Field label="Tên thương mại *" style={{ gridColumn: '1 / -1' }}><input className="form-input" value={form.drug_name} onChange={e => set('drug_name', e.target.value)} /></Field>
      <Field label="Tên generic"><input className="form-input" value={form.generic_name ?? ''} onChange={e => set('generic_name', e.target.value)} /></Field>
      <Field label="Hoạt chất"><input className="form-input" value={form.active_ingredient ?? ''} onChange={e => set('active_ingredient', e.target.value)} /></Field>
      <Field label="Hàm lượng"><input className="form-input" value={(form as DrugPayload & {strength?: string}).strength ?? ''} onChange={e => set('strength' as keyof DrugPayload, e.target.value)} placeholder="500mg" /></Field>
      <Field label="Dạng bào chế"><input className="form-input" value={(form as DrugPayload & {dosage_form?: string}).dosage_form ?? ''} onChange={e => set('dosage_form' as keyof DrugPayload, e.target.value)} placeholder="Viên nén" /></Field>
      <Field label="Giá bán (VND) *"><input className="form-input" type="number" value={form.unit_price} onChange={e => set('unit_price', Number(e.target.value))} /></Field>
      <Field label="Giá BHYT (VND)"><input className="form-input" type="number" value={form.bhyt_price ?? ''} onChange={e => set('bhyt_price', e.target.value ? Number(e.target.value) : null)} /></Field>
      <Field label="Tỷ lệ BHYT (0–1)"><input className="form-input" type="number" step="0.05" min="0" max="1" value={form.bhyt_ratio ?? ''} onChange={e => set('bhyt_ratio', e.target.value ? Number(e.target.value) : null)} placeholder="0.80" /></Field>
      <Field label="Tồn kho"><input className="form-input" type="number" value={form.stock_quantity ?? 0} onChange={e => set('stock_quantity', Number(e.target.value))} /></Field>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 20 }}>
        <label style={{ display: 'flex', gap: 6, cursor: 'pointer', fontSize: '.875rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.is_bhyt} onChange={e => set('is_bhyt', e.target.checked)} /> Thuộc DM BHYT
        </label>
        <label style={{ display: 'flex', gap: 6, cursor: 'pointer', fontSize: '.875rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Đang hoạt động
        </label>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB DỊCH VỤ CLS
// ─────────────────────────────────────────────────────────────────────────────
function ClsTab() {
  const listAsync   = useAsync<PaginatedResponse<ClsServiceList>>();
  const actionAsync = useAsync<unknown>();
  const { page, pageSize, goTo } = usePagination({ initialPageSize: 20 });

  const [keyword,   setKeyword]   = useState('');
  const [group,     setGroup]     = useState('');
  const [formOpen,  setFormOpen]  = useState(false);
  const [editId,    setEditId]    = useState<number | null>(null);
  const [form,      setForm]      = useState<ClsServicePayload>(EMPTY_CLS);
  const [delTarget, setDelTarget] = useState<ClsServiceList | null>(null);

  const load = useCallback(() => {
    listAsync.run(
      catalogApi.listCls({ keyword, service_group: group || undefined, page, page_size: pageSize }) as Promise<PaginatedResponse<ClsServiceList>>,
    );
  }, [keyword, group, page, pageSize]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditId(null); setForm(EMPTY_CLS); setFormOpen(true); };
  const openEdit   = (s: ClsServiceList) => {
    setEditId(s.id);
    setForm({
      service_code: s.service_code, service_name: s.service_name,
      service_group: s.service_group ?? '', unit: s.unit,
      unit_price: Number(s.unit_price),
      bhyt_price: s.bhyt_price ? Number(s.bhyt_price) : undefined,
      bhyt_ratio: s.bhyt_ratio ? Number(s.bhyt_ratio) : undefined,
      is_active: s.is_active, is_bhyt: s.is_bhyt,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.service_code.trim()) { toast.error('Vui lòng nhập mã dịch vụ'); return; }
    if (!form.service_name.trim()) { toast.error('Vui lòng nhập tên dịch vụ'); return; }
    const res = editId
      ? await actionAsync.run(catalogApi.updateCls(editId, form))
      : await actionAsync.run(catalogApi.createCls(form));
    if (res) { toast.success(editId ? 'Đã cập nhật' : 'Đã thêm dịch vụ'); setFormOpen(false); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    const res = await actionAsync.run(catalogApi.deleteCls(delTarget.id));
    if (res !== null) { toast.success('Đã vô hiệu hoá'); setDelTarget(null); load(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const data = listAsync.data;

  return (
    <>
      <div className="flex gap-3 mb-4" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label">Tìm kiếm</label>
          <input className="form-input" style={{ marginTop: 4 }} placeholder="Tên hoặc mã dịch vụ..."
            value={keyword} onChange={e => { setKeyword(e.target.value); goTo(1); }} />
        </div>
        <div>
          <label className="form-label">Nhóm</label>
          <select className="form-input" style={{ marginTop: 4 }} value={group}
            onChange={e => { setGroup(e.target.value); goTo(1); }}>
            <option value="">Tất cả nhóm</option>
            {CLS_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>↻</Button>
        <Button size="sm" onClick={openCreate}>+ Thêm dịch vụ</Button>
      </div>

      <CatalogTable
        loading={listAsync.loading} error={listAsync.error} onRetry={load}
        emptyIcon="🔬" emptyTitle="Chưa có dịch vụ CLS nào"
        headers={['Mã', 'Tên dịch vụ', 'Nhóm', 'Đơn vị', 'Giá', 'BHYT', 'Trạng thái', '']}
        rows={(data?.items ?? []).map(s => ({
          key: s.id,
          cells: [
            <code style={{ fontSize: '.8rem', color: 'var(--clr-primary-dark)' }}>{s.service_code}</code>,
            <span style={{ fontWeight: 600 }}>{s.service_name}</span>,
            <span style={{ fontSize: '.8rem' }}>{CLS_GROUPS.find(g => g.value === s.service_group)?.label ?? s.service_group ?? '—'}</span>,
            s.unit,
            fmtMoney(s.unit_price),
            s.is_bhyt
              ? <span style={pill('#d1fae5','#065f46')}>✅ BHYT</span>
              : <span style={pill('#f3f4f6','#6b7280')}>—</span>,
            s.is_active
              ? <span style={pill('#d1fae5','#065f46')}>Hoạt động</span>
              : <span style={pill('#fee2e2','#991b1b')}>Vô hiệu</span>,
            <div className="flex gap-2">
              <button onClick={() => openEdit(s)} style={smallBtn}>✏️</button>
              <button onClick={() => setDelTarget(s)} style={{ ...smallBtn, background: '#fee2e2', color: '#991b1b' }}>🗑️</button>
            </div>,
          ],
        }))}
      />

      {(data?.total_pages ?? 0) > 1 && (
        <div className="flex justify-end mt-3">
          <Pagination page={page} totalPages={data?.total_pages ?? 1} onChange={goTo} />
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)}
        title={editId ? '✏️ Sửa dịch vụ CLS' : '➕ Thêm dịch vụ CLS'} size="md"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Huỷ</Button>
            <Button loading={actionAsync.loading} onClick={handleSave}>Lưu</Button>
          </div>
        }>
        <ClsForm form={form} onChange={setForm} />
      </Modal>

      <ConfirmDialog open={!!delTarget} onClose={() => setDelTarget(null)} onConfirm={handleDelete}
        title="Vô hiệu hoá dịch vụ" danger
        message={`Vô hiệu hoá dịch vụ "${delTarget?.service_name}"?`}
        confirmLabel="Vô hiệu hoá" />
    </>
  );
}

function ClsForm({ form, onChange }: { form: ClsServicePayload; onChange: (f: ClsServicePayload) => void }) {
  const set = (k: keyof ClsServicePayload, v: unknown) => onChange({ ...form, [k]: v });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <Field label="Mã dịch vụ *"><input className="form-input" value={form.service_code} onChange={e => set('service_code', e.target.value)} placeholder="XN001" /></Field>
      <Field label="Đơn vị *"><input className="form-input" value={form.unit ?? 'lần'} onChange={e => set('unit', e.target.value)} /></Field>
      <Field label="Tên dịch vụ *" style={{ gridColumn: '1 / -1' }}><input className="form-input" value={form.service_name} onChange={e => set('service_name', e.target.value)} /></Field>
      <Field label="Nhóm">
        <select className="form-input" value={form.service_group ?? ''} onChange={e => set('service_group', e.target.value || null)}>
          <option value="">— Chọn nhóm —</option>
          {CLS_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </Field>
      <Field label="Khoa/phòng thực hiện"><input className="form-input" value={(form as ClsServicePayload & {department?: string}).department ?? ''} onChange={e => set('department' as keyof ClsServicePayload, e.target.value)} /></Field>
      <Field label="Giá dịch vụ (VND) *"><input className="form-input" type="number" value={form.unit_price} onChange={e => set('unit_price', Number(e.target.value))} /></Field>
      <Field label="Giá BHYT (VND)"><input className="form-input" type="number" value={form.bhyt_price ?? ''} onChange={e => set('bhyt_price', e.target.value ? Number(e.target.value) : null)} /></Field>
      <Field label="Tỷ lệ BHYT (0–1)"><input className="form-input" type="number" step="0.05" min="0" max="1" value={form.bhyt_ratio ?? ''} onChange={e => set('bhyt_ratio', e.target.value ? Number(e.target.value) : null)} placeholder="0.80" /></Field>
      <Field label="Thời gian trả KQ (giờ)"><input className="form-input" type="number" value={(form as ClsServicePayload & {turnaround_hours?: number}).turnaround_hours ?? ''} onChange={e => set('turnaround_hours' as keyof ClsServicePayload, e.target.value ? Number(e.target.value) : null)} /></Field>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 20, gridColumn: '1 / -1' }}>
        <label style={{ display: 'flex', gap: 6, cursor: 'pointer', fontSize: '.875rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.is_bhyt} onChange={e => set('is_bhyt', e.target.checked)} /> Thuộc DM BHYT
        </label>
        <label style={{ display: 'flex', gap: 6, cursor: 'pointer', fontSize: '.875rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Đang hoạt động
        </label>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared table component
// ─────────────────────────────────────────────────────────────────────────────
function CatalogTable({ loading, error, onRetry, emptyIcon, emptyTitle, headers, rows }: {
  loading: boolean; error: string | null; onRetry: () => void;
  emptyIcon: string; emptyTitle: string;
  headers: string[];
  rows: { key: number; cells: React.ReactNode[] }[];
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--clr-gray-100)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      {loading && <LoadingOverlay />}
      {error   && <ErrorState message={error} onRetry={onRetry} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState icon={emptyIcon} title={emptyTitle} description="Nhấn + Thêm để tạo mới." />
      )}
      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--clr-gray-50)' }}>
              {headers.map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--clr-gray-500)', borderBottom: '2px solid var(--clr-gray-100)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} style={{ borderBottom: '1px solid var(--clr-gray-50)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--clr-gray-50)')}
                onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                {row.cells.map((cell, i) => (
                  <td key={i} style={{ padding: '10px 14px', verticalAlign: 'middle' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const pill = (bg: string, color: string): React.CSSProperties => ({
  padding: '2px 8px', borderRadius: 9999, fontSize: '.75rem', fontWeight: 600, background: bg, color,
});
const smallBtn: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 6, border: 'none',
  background: 'var(--clr-gray-100)', color: 'var(--clr-gray-600)',
  cursor: 'pointer', fontSize: '.8rem', fontFamily: 'var(--font-sans)',
};
