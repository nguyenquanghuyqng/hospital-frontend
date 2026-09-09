/**
 * OrdersTable — Bảng kê đơn gộp (Thuốc + CLS)
 *
 * Tính năng:
 * - Hiển thị tất cả prescription_items (drug + cls) trong một bảng duy nhất
 * - Phân nhóm theo phòng khám / ngày / bác sĩ kê (group header)
 * - Cột "Loại chi trả" dropdown per-row: BHYT/Thu phí/Yêu cầu/Khám sức khỏe/
 *   Hao phí/Trẻ dưới 6/Tiêm chủng/Miễn/Trả sau
 * - Hiển thị khoảng thời gian hiệu lực đơn thuốc (valid_from → valid_to)
 * - Tổng chi phí real-time: tách Thuốc / CLS / BHYT / Bệnh nhân CCT
 * - Nút thêm thuốc và thêm CLS tích hợp trong bảng
 * - Xoá từng dòng khi không bị disabled
 */
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field, EmptyState } from '@components/ui';
import type { PrescriptionItemResponse, PaymentType } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  bhyt:    '🏥 BHYT',
  fee:     '💵 Thu phí',
  request: '⭐ Yêu cầu',
  health:  '💊 KSK',
  consume: '🔧 Hao phí',
  under6:  '👶 Trẻ < 6t',
  vaccine: '💉 Tiêm chủng',
  free:    '🎁 Miễn',
  defer:   '📋 Trả sau',
};

const PAYMENT_TYPE_COLORS: Record<PaymentType, { bg: string; color: string }> = {
  bhyt:    { bg: '#dbeafe', color: '#1d4ed8' },
  fee:     { bg: '#fef3c7', color: '#92400e' },
  request: { bg: '#fce7f3', color: '#9d174d' },
  health:  { bg: '#d1fae5', color: '#065f46' },
  consume: { bg: '#f3f4f6', color: '#374151' },
  under6:  { bg: '#ede9fe', color: '#5b21b6' },
  vaccine: { bg: '#ecfdf5', color: '#065f46' },
  free:    { bg: '#f0fdf4', color: '#15803d' },
  defer:   { bg: '#f8fafc', color: '#475569' },
};

// ── Add-item form schema ───────────────────────────────────────────────────────

const addSchema = z.object({
  item_type:         z.enum(['drug', 'cls']),
  item_code:         z.string().optional(),
  item_name:         z.string().min(1, 'Tên là bắt buộc'),
  unit:              z.string().optional(),
  quantity:          z.coerce.number().positive().default(1),
  unit_price:        z.coerce.number().min(0).optional().or(z.literal('')),
  usage_instruction: z.string().optional(),
  valid_from:        z.string().optional(),
  valid_to:          z.string().optional(),
  payment_type:      z.string().default('bhyt'),
});
type AddForm = z.infer<typeof addSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examId:    number;
  items:     PrescriptionItemResponse[];
  disabled:  boolean;
  onChanged: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(v?: number | string | null): string {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('vi-VN') + ' ₫';
}

function fmtDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Nhóm items theo groupKey = room_name + doctor_name */
function groupItems(items: PrescriptionItemResponse[]): Array<{
  key: string; label: string; items: PrescriptionItemResponse[];
}> {
  const map = new Map<string, PrescriptionItemResponse[]>();
  for (const it of items) {
    const key = [it.room_name ?? '', it.doctor_name ?? ''].join('|');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries()).map(([key, its]) => {
    const [room, doctor] = key.split('|');
    const parts = [room, doctor].filter(Boolean);
    return { key, label: parts.length > 0 ? parts.join(' — ') : 'Phòng khám hiện tại', items: its };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrdersTable({ examId, items, disabled, onChanged }: Props) {
  const [addingType, setAddingType] = useState<'drug' | 'cls' | null>(null);
  const addAsync = useAsync<PrescriptionItemResponse>();
  const delAsync = useAsync<void>();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: { item_type: 'drug', quantity: 1, payment_type: 'bhyt' },
  });

  const watchType = watch('item_type');

  // ── Totals ────────────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let drug = 0, cls = 0, bhyt = 0, patient = 0;
    for (const it of items) {
      const total = Number(it.total_amount ?? 0);
      if (it.item_type === 'drug') drug += total;
      else cls += total;
      bhyt    += Number(it.bhyt_amount    ?? 0);
      patient += Number(it.patient_amount ?? 0);
    }
    return { drug, cls, total: drug + cls, bhyt, patient };
  }, [items]);

  // ── Groups ────────────────────────────────────────────────────────────────────
  const groups = useMemo(() => groupItems(items), [items]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const onAdd = async (data: AddForm) => {
    const res = await addAsync.run(
      examinationApi.addItem(examId, {
        item_type:         data.item_type,
        item_name:         data.item_name,
        item_code:         data.item_code  || undefined,
        unit:              data.unit       || undefined,
        quantity:          data.quantity,
        unit_price:        data.unit_price ? Number(data.unit_price) : undefined,
        usage_instruction: data.usage_instruction || undefined,
        valid_from:        data.valid_from || undefined,
        valid_to:          data.valid_to   || undefined,
        payment_type:      data.payment_type as PaymentType,
      }),
    );
    if (res) {
      toast.success(`Đã thêm ${data.item_type === 'drug' ? 'thuốc' : 'CLS'}`);
      reset({ item_type: data.item_type, quantity: 1, payment_type: 'bhyt' });
      setAddingType(null);
      onChanged();
    } else {
      toast.error(addAsync.error ?? 'Thêm thất bại');
    }
  };

  const onDelete = async (id: number, name: string) => {
    await delAsync.run(examinationApi.deleteItem(examId, id));
    toast.success(`Đã xoá: ${name}`);
    onChanged();
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Toolbar ──────────────────────────────────────────────────────────── */}
      {!disabled && (
        <div style={{
          display: 'flex', gap: 8, padding: '10px 0 10px',
          borderBottom: '1px solid var(--clr-gray-100)',
        }}>
          <Button
            size="sm"
            variant={addingType === 'drug' ? 'primary' : 'secondary'}
            onClick={() => { setAddingType(addingType === 'drug' ? null : 'drug'); reset({ item_type: 'drug', quantity: 1, payment_type: 'bhyt' }); }}
          >
            💊 + Thêm thuốc
          </Button>
          <Button
            size="sm"
            variant={addingType === 'cls' ? 'primary' : 'secondary'}
            onClick={() => { setAddingType(addingType === 'cls' ? null : 'cls'); reset({ item_type: 'cls', quantity: 1, payment_type: 'bhyt' }); }}
          >
            🔬 + Thêm CLS
          </Button>
        </div>
      )}

      {/* ── Add form ─────────────────────────────────────────────────────────── */}
      {addingType && !disabled && (
        <form
          onSubmit={handleSubmit(onAdd)}
          style={{
            padding: '14px 16px', background: addingType === 'drug' ? '#f0fdf4' : '#eff6ff',
            border: `1px solid ${addingType === 'drug' ? '#86efac' : '#bfdbfe'}`,
            borderRadius: 10, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '.875rem', color: addingType === 'drug' ? '#166534' : '#1e40af' }}>
            {addingType === 'drug' ? '💊 Thêm thuốc' : '🔬 Thêm chỉ định CLS'}
          </div>
          <input type="hidden" {...register('item_type')} value={addingType} />

          <div className="form-row form-row-3">
            <Field label="Mã">
              <input {...register('item_code')} className="form-input" placeholder={addingType === 'drug' ? 'Mã thuốc' : 'Mã dịch vụ'} />
            </Field>
            <Field label={addingType === 'drug' ? 'Tên thuốc *' : 'Tên chỉ định *'} required error={errors.item_name?.message}>
              <input {...register('item_name')} className={`form-input${errors.item_name ? ' error' : ''}`}
                placeholder={addingType === 'drug' ? 'VD: Paracetamol 500mg' : 'VD: Xét nghiệm công thức máu'} autoFocus />
            </Field>
            <Field label="Đơn vị">
              <input {...register('unit')} className="form-input" placeholder={addingType === 'drug' ? 'viên, gói...' : 'lần, xét nghiệm...'} />
            </Field>
          </div>

          <div className="form-row form-row-3">
            <Field label="Số lượng *" error={errors.quantity?.message}>
              <input {...register('quantity')} type="number" min={1} className="form-input" />
            </Field>
            <Field label="Đơn giá (₫)">
              <input {...register('unit_price')} type="number" min={0} className="form-input" placeholder="0" />
            </Field>
            <Field label="Loại chi trả">
              <select {...register('payment_type')} className="form-input">
                {(Object.entries(PAYMENT_TYPE_LABELS) as [PaymentType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          {watchType === 'drug' && (
            <div className="form-row form-row-3">
              <Field label="Cách dùng">
                <input {...register('usage_instruction')} className="form-input" placeholder="Sáng 1v, tối 1v sau ăn..." />
              </Field>
              <Field label="Hiệu lực từ ngày">
                <input {...register('valid_from')} type="date" className="form-input" />
              </Field>
              <Field label="Hiệu lực đến ngày">
                <input {...register('valid_to')} type="date" className="form-input" />
              </Field>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={addAsync.loading}>
              ✚ Thêm
            </Button>
            <Button type="button" size="sm" variant="ghost"
              onClick={() => { setAddingType(null); reset(); }}>
              Huỷ
            </Button>
          </div>
        </form>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <EmptyState icon="📋" title="Chưa có kê đơn" description="Thêm thuốc hoặc chỉ định CLS ở trên." />
      )}

      {/* ── Items table by group ─────────────────────────────────────────────── */}
      {groups.map(group => (
        <div key={group.key} style={{ marginBottom: 4 }}>
          {/* Group header */}
          {groups.length > 1 && (
            <div style={{
              padding: '6px 10px', background: 'var(--clr-gray-100)',
              fontSize: '.78rem', fontWeight: 700, color: 'var(--clr-gray-500)',
              borderRadius: '6px 6px 0 0',
            }}>
              📍 {group.label}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['#', 'Loại', 'Tên', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'BHYT', 'BN CCT', 'Chi trả', 'Hiệu lực', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 8px', textAlign: 'left', whiteSpace: 'nowrap',
                      color: 'var(--clr-gray-500)', fontWeight: 600, fontSize: '.75rem',
                      borderBottom: '2px solid var(--clr-gray-200)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.map((it, idx) => {
                  const ptStyle = PAYMENT_TYPE_COLORS[it.payment_type] ?? { bg: '#f3f4f6', color: '#374151' };
                  const isDrug  = it.item_type === 'drug';
                  return (
                    <tr key={it.id} style={{
                      borderBottom: '1px solid var(--clr-gray-100)',
                      background: idx % 2 === 0 ? '#fff' : '#fafafa',
                    }}>
                      <td style={{ padding: '8px 8px', color: 'var(--clr-gray-400)', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{
                          fontSize: '.7rem', padding: '2px 6px', borderRadius: 999,
                          background: isDrug ? '#d1fae5' : '#dbeafe',
                          color:      isDrug ? '#065f46' : '#1e40af',
                          fontWeight: 700, whiteSpace: 'nowrap',
                        }}>
                          {isDrug ? '💊 Thuốc' : '🔬 CLS'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 8px', maxWidth: 200 }}>
                        <div style={{ fontWeight: 600, color: 'var(--clr-gray-800)' }}>{it.item_name}</div>
                        {it.item_code && (
                          <div style={{ fontSize: '.72rem', color: 'var(--clr-gray-400)' }}>{it.item_code}</div>
                        )}
                        {isDrug && it.usage_instruction && (
                          <div style={{ fontSize: '.72rem', color: 'var(--clr-gray-500)', fontStyle: 'italic', marginTop: 1 }}>
                            {it.usage_instruction}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 6px', color: 'var(--clr-gray-500)' }}>{it.unit ?? '—'}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 600 }}>{it.quantity}</td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{fmtMoney(it.unit_price)}</td>
                      <td style={{ padding: '8px 6px', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(it.total_amount)}</td>
                      <td style={{ padding: '8px 6px', color: '#059669', whiteSpace: 'nowrap' }}>{fmtMoney(it.bhyt_amount)}</td>
                      <td style={{ padding: '8px 6px', color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMoney(it.patient_amount)}</td>
                      <td style={{ padding: '8px 6px' }}>
                        <span style={{
                          fontSize: '.72rem', padding: '2px 8px', borderRadius: 999,
                          background: ptStyle.bg, color: ptStyle.color,
                          fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          {PAYMENT_TYPE_LABELS[it.payment_type]}
                        </span>
                      </td>
                      <td style={{ padding: '8px 6px', whiteSpace: 'nowrap', color: 'var(--clr-gray-500)', fontSize: '.72rem' }}>
                        {isDrug && (it.valid_from || it.valid_to) ? (
                          <span>
                            {fmtDate(it.valid_from)} → {fmtDate(it.valid_to) || '?'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '8px 6px' }}>
                        {!disabled && (
                          <button
                            onClick={() => onDelete(it.id, it.item_name)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--clr-danger)', fontSize: '1rem', padding: '2px 4px',
                              borderRadius: 4, lineHeight: 1,
                            }}
                            aria-label={`Xoá ${it.item_name}`}
                            title="Xoá dòng này"
                          >✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Cost summary bar ─────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
          borderRadius: 10,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
        }}>
          {[
            { label: '💊 Thuốc',        value: totals.drug,    color: '#93c5fd' },
            { label: '🔬 CLS',          value: totals.cls,     color: '#93c5fd' },
            { label: '📋 Tổng cộng',    value: totals.total,   color: '#fff', bold: true },
            { label: '🏥 BHYT chi trả', value: totals.bhyt,    color: '#6ee7b7' },
            { label: '👤 BN chi trả',   value: totals.patient, color: '#fca5a5', bold: true },
          ].map(row => (
            <div key={row.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.72rem', color: '#93c5fd', marginBottom: 4 }}>{row.label}</div>
              <div style={{
                fontSize: row.bold ? '1rem' : '.9rem',
                fontWeight: row.bold ? 800 : 600,
                color: row.color,
              }}>
                {Number(row.value).toLocaleString('vi-VN')} ₫
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
