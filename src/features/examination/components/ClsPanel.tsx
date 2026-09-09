/**
 * ClsPanel — Chỉ định và kết quả cận lâm sàng (CLS).
 *
 * Hiển thị danh sách chỉ định CLS kèm trạng thái kết quả thực từ API.
 * Cho phép bác sĩ / KTV điền kết quả từng chỉ số (ClsResultValues).
 */
import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { clinicalApi } from '@api/clinical.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field, EmptyState, Badge } from '@components/ui';
import type {
  PrescriptionItemResponse,
  ClsResultResponse,
  ClsResultStatus,
} from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLS_CATEGORIES = [
  '-- Tự nhập --',
  'Xét nghiệm máu tổng quát (CBC)',
  'Xét nghiệm nước tiểu tổng quát',
  'Siêu âm bụng tổng quát',
  'Siêu âm tim',
  'X-Quang ngực thẳng',
  'Điện tâm đồ (ECG)',
  'Chụp CT Scanner',
  'Chụp MRI',
  'Nội soi dạ dày',
  'Xét nghiệm đường huyết',
  'Xét nghiệm HbA1c',
  'Xét nghiệm lipid máu',
  'Xét nghiệm chức năng gan (AST, ALT)',
  'Xét nghiệm chức năng thận (Creatinine, Ure)',
];

const STATUS_LABELS: Record<ClsResultStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: '⏳ Chờ thực hiện', color: '#92400e', bg: '#fef3c7' },
  in_process: { label: '🔬 Đang xử lý',   color: '#1d4ed8', bg: '#dbeafe' },
  completed:  { label: '✅ Có kết quả',    color: '#065f46', bg: '#d1fae5' },
  cancelled:  { label: '❌ Đã huỷ',        color: '#991b1b', bg: '#fee2e2' },
};

// ── Add form schema ────────────────────────────────────────────────────────────

const addSchema = z.object({
  item_code:    z.string().optional(),
  item_name:    z.string().min(1, 'Tên chỉ định là bắt buộc'),
  unit:         z.string().optional(),
  quantity:     z.coerce.number().positive().default(1),
  unit_price:   z.coerce.number().min(0).optional().or(z.literal('')),
  payment_type: z.string().default('bhyt'),
});
type AddForm = z.infer<typeof addSchema>;

// ── Result form schema ────────────────────────────────────────────────────────

const resultValueSchema = z.object({
  indicator_name: z.string().min(1, 'Bắt buộc'),
  value_numeric:  z.coerce.number().optional().or(z.literal('')),
  value_text:     z.string().optional(),
  unit:           z.string().optional(),
  ref_min:        z.coerce.number().optional().or(z.literal('')),
  ref_max:        z.coerce.number().optional().or(z.literal('')),
  ref_text:       z.string().optional(),
});

const resultSchema = z.object({
  status:         z.enum(['pending', 'in_process', 'completed', 'cancelled']),
  performed_by:   z.string().optional(),
  result_summary: z.string().optional(),
  result_note:    z.string().optional(),
  values:         z.array(resultValueSchema),
});
type ResultForm = z.infer<typeof resultSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examId:   number;
  items:    PrescriptionItemResponse[];
  disabled: boolean;
  onChanged: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ClsPanel({ examId, items, disabled, onChanged }: Props) {
  const [adding, setAdding]  = useState(false);
  const [category, setCategory] = useState(CLS_CATEGORIES[0] ?? '');
  const [editingResultId, setEditingResultId] = useState<number | null>(null); // cls_result.id
  const [clsResults, setClsResults] = useState<ClsResultResponse[]>([]);
  const addAsync  = useAsync<PrescriptionItemResponse>();
  const delAsync  = useAsync<void>();
  const loadAsync = useAsync<ClsResultResponse[]>();

  const { register: regAdd, handleSubmit: handleAdd, reset: resetAdd, setValue: setAddVal, formState: { errors: addErrors } } =
    useForm<AddForm>({ resolver: zodResolver(addSchema), defaultValues: { quantity: 1, payment_type: 'bhyt' } });

  // Load CLS results từ API
  const loadResults = useCallback(async () => {
    const res = await loadAsync.run(clinicalApi.listClsByExam(examId));
    if (res) setClsResults(res);
  }, [examId]);

  useEffect(() => { loadResults(); }, [loadResults]);

  // Map prescription_item_id → ClsResult
  const resultByItemId = Object.fromEntries(
    clsResults.map(r => [r.prescription_item_id, r])
  );

  const onCategoryChange = (cat: string) => {
    setCategory(cat);
    if (cat !== '-- Tự nhập --') setAddVal('item_name', cat);
  };

  const onAdd = async (data: AddForm) => {
    const res = await addAsync.run(
      examinationApi.addItem(examId, {
        item_type:    'cls',
        item_name:    data.item_name,
        item_code:    data.item_code || undefined,
        unit:         data.unit || undefined,
        quantity:     data.quantity,
        unit_price:   data.unit_price ? Number(data.unit_price) : undefined,
        payment_type: data.payment_type,
      }),
    );
    if (res) {
      toast.success('Đã thêm chỉ định CLS');
      resetAdd(); setAdding(false); setCategory(CLS_CATEGORIES[0] ?? '');
      onChanged();
      // Reload results để hiện ClsResult mới tạo
      setTimeout(loadResults, 300);
    } else toast.error(addAsync.error ?? 'Thêm thất bại');
  };

  const onDelete = async (id: number) => {
    await delAsync.run(examinationApi.deleteItem(examId, id));
    toast.success('Đã xoá');
    onChanged();
    setTimeout(loadResults, 300);
  };

  const fmtMoney = (v?: number | null) =>
    v !== undefined && v !== null ? Number(v).toLocaleString('vi-VN') + ' ₫' : '';

  // Stats
  const pending   = clsResults.filter(r => r.status === 'pending' || r.status === 'in_process').length;
  const completed = clsResults.filter(r => r.status === 'completed').length;
  const abnormal  = clsResults.filter(r => r.is_abnormal).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Tổng chỉ định', value: items.length, bg: 'var(--clr-primary-light)', color: 'var(--clr-primary-dark)' },
          { label: 'Có kết quả',   value: completed,     bg: '#d1fae5', color: '#065f46' },
          { label: 'Chờ kết quả',  value: pending,       bg: '#fef3c7', color: '#92400e' },
          { label: '⚠️ Bất thường', value: abnormal,     bg: '#fee2e2', color: '#991b1b' },
        ].map(s => (
          <div key={s.label} style={{ padding: '8px 16px', background: s.bg, borderRadius: 8, minWidth: 100 }}>
            <div style={{ fontSize: '.72rem', color: s.color, fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* List */}
      {items.length === 0 && !adding ? (
        <EmptyState icon="🔬" title="Chưa có chỉ định CLS" description="Nhấn '+ Thêm chỉ định' để tạo chỉ định cận lâm sàng." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, idx) => {
            const clsResult = resultByItemId[item.id];
            const status = clsResult?.status ?? 'pending';
            const st = STATUS_LABELS[status];
            const isEditingThis = editingResultId === clsResult?.id;

            return (
              <div key={item.id} style={{
                background: '#fff',
                border: `1px solid ${clsResult?.is_abnormal ? '#fca5a5' : 'var(--clr-gray-100)'}`,
                borderRadius: 10, overflow: 'hidden',
                boxShadow: clsResult?.is_abnormal ? '0 0 0 2px #fee2e2' : 'none',
              }}>
                {/* Main row */}
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    minWidth: 28, height: 28, borderRadius: '50%', background: 'var(--clr-gray-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '.8rem', fontWeight: 700, color: 'var(--clr-gray-600)', flexShrink: 0,
                  }}>{idx + 1}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm font-medium" style={{ color: 'var(--clr-gray-800)' }}>
                      {item.item_name}
                      {clsResult?.is_abnormal && (
                        <span style={{ marginLeft: 8, fontSize: '.72rem', background: '#fee2e2', color: '#991b1b', padding: '1px 8px', borderRadius: 999, fontWeight: 700 }}>
                          ⚠️ BẤT THƯỜNG
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                      {item.item_code && <span className="text-xs text-muted">{item.item_code}</span>}
                      <span className="text-xs text-muted">SL: {item.quantity} {item.unit ?? 'lần'}</span>
                      <Badge variant={item.payment_type}>{item.payment_type.toUpperCase()}</Badge>
                    </div>
                    {clsResult?.performed_by && (
                      <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                        KTV: {clsResult.performed_by}
                        {clsResult.result_at && ` • ${new Date(clsResult.result_at).toLocaleString('vi-VN')}`}
                      </div>
                    )}
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {item.total_amount != null && (
                      <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--clr-primary-dark)' }}>
                        {fmtMoney(item.total_amount)}
                      </span>
                    )}
                    <span style={{
                      fontSize: '.72rem', fontWeight: 700, padding: '3px 10px',
                      borderRadius: 9999, background: st.bg, color: st.color, whiteSpace: 'nowrap',
                    }}>
                      {st.label}
                    </span>
                    {clsResult && (
                      <Button size="sm" variant="ghost"
                        onClick={() => setEditingResultId(isEditingThis ? null : clsResult.id)}>
                        {isEditingThis ? '▲ Đóng' : '📝 Kết quả'}
                      </Button>
                    )}
                    {!disabled && (
                      <button
                        onClick={() => onDelete(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--clr-danger)', cursor: 'pointer', padding: '2px 6px', fontSize: '1rem' }}
                        aria-label="Xoá"
                      >✕</button>
                    )}
                  </div>
                </div>

                {/* Result summary (collapsed) */}
                {clsResult?.result_summary && !isEditingThis && (
                  <div style={{ padding: '10px 16px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
                    <span className="text-xs" style={{ color: '#166534', fontWeight: 700 }}>Tóm tắt: </span>
                    <span className="text-xs" style={{ color: '#15803d' }}>{clsResult.result_summary}</span>
                  </div>
                )}

                {/* Values preview (compact) */}
                {clsResult?.values && clsResult.values.length > 0 && !isEditingThis && (
                  <div style={{ padding: '8px 16px', background: '#f8fafc', borderTop: '1px solid var(--clr-gray-100)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {clsResult.values.map(v => (
                      <span key={v.id} style={{
                        fontSize: '.75rem', padding: '2px 10px', borderRadius: 8,
                        background: v.is_abnormal ? '#fee2e2' : '#f1f5f9',
                        color: v.is_abnormal ? '#991b1b' : 'var(--clr-gray-700)',
                        fontWeight: v.is_abnormal ? 700 : 400,
                        border: `1px solid ${v.is_abnormal ? '#fca5a5' : 'var(--clr-gray-200)'}`,
                      }}>
                        {v.indicator_name}: {v.value_numeric ?? v.value_text ?? '—'}
                        {v.unit ? ` ${v.unit}` : ''}
                        {v.is_abnormal ? ' ⚠️' : ''}
                      </span>
                    ))}
                  </div>
                )}

                {/* Result editor (expanded) */}
                {isEditingThis && clsResult && (
                  <ClsResultEditor
                    clsResult={clsResult}
                    onSaved={() => { setEditingResultId(null); loadResults(); }}
                    onCancel={() => setEditingResultId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {!disabled && (
        adding ? (
          <form onSubmit={handleAdd(onAdd)}
            style={{ padding: 16, background: 'var(--clr-gray-50)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem' }}>Thêm chỉ định CLS</div>

            <div className="form-row form-row-2">
              <Field label="Chọn nhanh">
                <select className="form-input" value={category}
                  onChange={e => onCategoryChange(e.target.value)}>
                  {CLS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Loại chi trả">
                <select {...regAdd('payment_type')} className="form-input">
                  <option value="bhyt">BHYT</option>
                  <option value="fee">Dịch vụ</option>
                  <option value="free">Miễn phí</option>
                </select>
              </Field>
            </div>

            <Field label="Tên chỉ định CLS" required error={addErrors.item_name?.message}>
              <input {...regAdd('item_name')} className={`form-input${addErrors.item_name ? ' error' : ''}`}
                placeholder="Tên xét nghiệm / chụp chiếu..." autoFocus />
            </Field>

            <div className="form-row form-row-3">
              <Field label="Mã dịch vụ">
                <input {...regAdd('item_code')} className="form-input" placeholder="Mã (tuỳ chọn)" />
              </Field>
              <Field label="Số lượng" required>
                <input {...regAdd('quantity')} type="number" min={1} className="form-input" />
              </Field>
              <Field label="Đơn giá (VNĐ)">
                <input {...regAdd('unit_price')} type="number" min={0} className="form-input" placeholder="0" />
              </Field>
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={addAsync.loading}>Thêm chỉ định</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); resetAdd(); }}>Huỷ</Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            + Thêm chỉ định CLS
          </Button>
        )
      )}
    </div>
  );
}

// ── ClsResultEditor ────────────────────────────────────────────────────────────

function ClsResultEditor({
  clsResult,
  onSaved,
  onCancel,
}: {
  clsResult: ClsResultResponse;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const saveAsync = useAsync<ClsResultResponse>();

  const { register, handleSubmit, control, watch, formState: { errors } } =
    useForm<ResultForm>({
      resolver: zodResolver(resultSchema),
      defaultValues: {
        status:         clsResult.status,
        performed_by:   clsResult.performed_by ?? '',
        result_summary: clsResult.result_summary ?? '',
        result_note:    clsResult.result_note ?? '',
        values: clsResult.values.length > 0
          ? clsResult.values.map(v => ({
              indicator_name: v.indicator_name,
              value_numeric:  v.value_numeric ?? '',
              value_text:     v.value_text ?? '',
              unit:           v.unit ?? '',
              ref_min:        v.ref_min ?? '',
              ref_max:        v.ref_max ?? '',
              ref_text:       v.ref_text ?? '',
            }))
          : [{ indicator_name: '', value_numeric: '', value_text: '', unit: '', ref_min: '', ref_max: '', ref_text: '' }],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'values' });

  const onSubmit = async (data: ResultForm) => {
    const payload = {
      status:         data.status,
      performed_by:   data.performed_by || undefined,
      result_summary: data.result_summary || undefined,
      result_note:    data.result_note || undefined,
      values: data.values
        .filter(v => v.indicator_name.trim())
        .map((v, i) => ({
          indicator_name: v.indicator_name,
          value_numeric:  v.value_numeric !== '' && v.value_numeric !== undefined ? Number(v.value_numeric) : undefined,
          value_text:     (v.value_text || undefined) as string | undefined,
          unit:           (v.unit || undefined) as string | undefined,
          ref_min:        v.ref_min !== '' && v.ref_min !== undefined ? Number(v.ref_min) : undefined,
          ref_max:        v.ref_max !== '' && v.ref_max !== undefined ? Number(v.ref_max) : undefined,
          ref_text:       (v.ref_text || undefined) as string | undefined,
          sort_order:     i,
        })),
    };
    const res = await saveAsync.run(clinicalApi.updateClsResult(clsResult.id, payload));
    if (res) {
      toast.success('Đã lưu kết quả CLS');
      onSaved();
    } else toast.error(saveAsync.error ?? 'Lưu thất bại');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}
      style={{ padding: '16px 20px', background: '#fffbeb', borderTop: '1px solid #fde68a' }}>

      <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 14, color: '#92400e' }}>
        📋 Kết quả CLS — {clsResult.service_name}
      </div>

      <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
        <Field label="Trạng thái">
          <select {...register('status')} className="form-input">
            <option value="pending">⏳ Chờ thực hiện</option>
            <option value="in_process">🔬 Đang xử lý</option>
            <option value="completed">✅ Hoàn thành</option>
            <option value="cancelled">❌ Huỷ</option>
          </select>
        </Field>
        <Field label="KTV thực hiện">
          <input {...register('performed_by')} className="form-input" placeholder="Tên kỹ thuật viên..." />
        </Field>
      </div>

      {/* Values table */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: '.85rem', color: '#92400e' }}>📊 Chỉ số kết quả</span>
          <Button type="button" size="sm" variant="ghost"
            onClick={() => append({ indicator_name: '', value_numeric: '', value_text: '', unit: '', ref_min: '', ref_max: '', ref_text: '' })}>
            + Thêm chỉ số
          </Button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
            <thead>
              <tr style={{ background: '#fef3c7' }}>
                {['Chỉ số *', 'Giá trị số', 'Đơn vị', 'TK thấp', 'TK cao', 'Văn bản', ''].map(h => (
                  <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#92400e', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => (
                <tr key={field.id} style={{ borderBottom: '1px solid #fde68a' }}>
                  <td style={{ padding: '4px 4px' }}>
                    <input {...register(`values.${idx}.indicator_name`)}
                      className="form-input" style={{ minWidth: 100 }} placeholder="VD: HGB" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input {...register(`values.${idx}.value_numeric`)} type="number" step="any"
                      className="form-input" style={{ width: 80 }} placeholder="120" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input {...register(`values.${idx}.unit`)}
                      className="form-input" style={{ width: 70 }} placeholder="g/dL" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input {...register(`values.${idx}.ref_min`)} type="number" step="any"
                      className="form-input" style={{ width: 70 }} placeholder="120" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input {...register(`values.${idx}.ref_max`)} type="number" step="any"
                      className="form-input" style={{ width: 70 }} placeholder="160" />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <input {...register(`values.${idx}.value_text`)}
                      className="form-input" style={{ minWidth: 100 }} placeholder="Dương tính..." />
                  </td>
                  <td style={{ padding: '4px 4px' }}>
                    <button type="button" onClick={() => remove(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--clr-danger)', cursor: 'pointer', fontSize: '1rem' }}
                      aria-label="Xoá chỉ số">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Field label="Tóm tắt kết quả" style={{ marginBottom: 10 }}>
        <textarea {...register('result_summary')} className="form-input" rows={2}
          placeholder="Tóm tắt kết quả (in phiếu)..." />
      </Field>

      <Field label="Ghi chú / Nhận xét">
        <textarea {...register('result_note')} className="form-input" rows={2}
          placeholder="Ghi chú thêm của KTV..." />
      </Field>

      <div className="flex gap-2" style={{ marginTop: 12 }}>
        <Button type="submit" size="sm" loading={saveAsync.loading}>💾 Lưu kết quả</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Huỷ</Button>
      </div>
    </form>
  );
}
