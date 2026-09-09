/**
 * PrescriptionPanel — Đơn thuốc.
 * Hiển thị 2 nhóm: Thuốc BHYT và Thuốc ngoài BHYT.
 * Tích hợp cảnh báo tương tác / trùng hoạt chất thuốc real-time.
 */
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { clinicalApi } from '@api/clinical.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field, EmptyState, Badge } from '@components/ui';
import type { PrescriptionItemResponse, DrugWarning } from '@/types';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  item_code:         z.string().optional(),
  item_name:         z.string().min(1, 'Tên thuốc là bắt buộc'),
  unit:              z.string().optional(),
  quantity:          z.coerce.number().positive().default(1),
  unit_price:        z.coerce.number().min(0).optional().or(z.literal('')),
  usage_instruction: z.string().optional(),
  payment_type:      z.string().default('bhyt'),
  morning:           z.string().optional(),
  noon:              z.string().optional(),
  afternoon:         z.string().optional(),
  evening:           z.string().optional(),
  how_to_use:        z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const UNITS = ['viên', 'nang', 'gói', 'ống', 'chai', 'lọ', 'tuýp', 'hộp'];

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  danger:  { bg: '#fff1f2', border: '#fca5a5', color: '#991b1b', icon: '🚨' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠️' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'ℹ️' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examId:    number;
  items:     PrescriptionItemResponse[];
  disabled:  boolean;
  onChanged: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrescriptionPanel({ examId, items, disabled, onChanged }: Props) {
  const [adding,      setAdding]   = useState(false);
  const [activeGroup, setActiveGroup] = useState<'bhyt' | 'ngoai_bhyt'>('bhyt');
  const [warnings,    setWarnings] = useState<DrugWarning[]>([]);
  const [showWarnings, setShowWarnings] = useState(true);
  const addAsync = useAsync<PrescriptionItemResponse>();
  const delAsync = useAsync<void>();

  // Kiểm tra tương tác mỗi khi items thay đổi
  const checkInteractions = useCallback(async () => {
    const drugCodes = items
      .filter(i => i.item_type === 'drug' && i.item_code)
      .map(i => i.item_code as string);
    if (drugCodes.length < 2) { setWarnings([]); return; }
    try {
      const res = await clinicalApi.checkInteractionsForExam(examId);
      setWarnings(res.warnings);
      if (res.has_warnings) setShowWarnings(true);
    } catch {
      // Không block workflow khi check thất bại
    }
  }, [examId, items]);

  useEffect(() => { checkInteractions(); }, [checkInteractions]);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { quantity: 1, payment_type: 'bhyt' },
  });

  // Group items
  const drugsOnly    = items.filter(i => i.item_type === 'drug');
  const bhytDrugs    = drugsOnly.filter(i => i.payment_type === 'bhyt');
  const nonBhytDrugs = drugsOnly.filter(i => i.payment_type !== 'bhyt');

  const morning   = watch('morning');
  const noon      = watch('noon');
  const afternoon = watch('afternoon');
  const evening   = watch('evening');
  const howToUse  = watch('how_to_use');

  const buildInstruction = () => {
    const parts = [];
    if (morning)   parts.push(`Sáng ${morning}`);
    if (noon)      parts.push(`Trưa ${noon}`);
    if (afternoon) parts.push(`Chiều ${afternoon}`);
    if (evening)   parts.push(`Tối ${evening}`);
    return [[...parts].join(', '), howToUse].filter(Boolean).join(' — ');
  };

  const onAdd = async (data: FormValues) => {
    const instruction = buildInstruction() || data.usage_instruction || undefined;
    const res = await addAsync.run(
      examinationApi.addItem(examId, {
        item_type:         'drug',
        item_name:         data.item_name,
        item_code:         data.item_code || undefined,
        unit:              data.unit || undefined,
        quantity:          data.quantity,
        unit_price:        data.unit_price ? Number(data.unit_price) : undefined,
        usage_instruction: instruction,
        payment_type:      data.payment_type,
      }),
    );
    if (res) {
      toast.success('Đã thêm thuốc');
      reset(); setAdding(false); onChanged();
    } else toast.error(addAsync.error ?? 'Thêm thất bại');
  };

  const onDelete = async (id: number) => {
    await delAsync.run(examinationApi.deleteItem(examId, id));
    toast.success('Đã xoá');
    onChanged();
  };

  const fmtMoney = (v?: number | null) =>
    v != null ? Number(v).toLocaleString('vi-VN') + ' ₫' : '';

  const bhytTotal    = bhytDrugs.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
  const nonBhytTotal = nonBhytDrugs.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Drug interaction warnings ──────────────────────────────────────── */}
      {warnings.length > 0 && showWarnings && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
          padding: '12px 16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '.875rem', color: '#92400e' }}>
              ⚠️ Cảnh báo tương tác thuốc ({warnings.length})
            </span>
            <button
              onClick={() => setShowWarnings(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '.8rem' }}
            >
              Ẩn
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {warnings.map((w, i) => {
              const st = SEVERITY_STYLE[w.severity] ?? SEVERITY_STYLE.warning;
              return (
                <div key={i} style={{
                  background: st.bg, border: `1px solid ${st.border}`,
                  borderRadius: 8, padding: '8px 12px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '.8rem', color: st.color, marginBottom: 2 }}>
                    {st.icon} {w.drug_a_name} ↔ {w.drug_b_name}
                  </div>
                  <div style={{ fontSize: '.78rem', color: st.color }}>{w.message}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Group toggle ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, background: 'var(--clr-gray-100)', borderRadius: 10, padding: 4 }}>
        {([
          { key: 'bhyt' as const,       label: `💊 BHYT (${bhytDrugs.length})`,         total: bhytTotal    },
          { key: 'ngoai_bhyt' as const, label: `💊 Ngoài BHYT (${nonBhytDrugs.length})`, total: nonBhytTotal },
        ]).map(g => (
          <button key={g.key} onClick={() => { setActiveGroup(g.key); setAdding(false); }}
            style={{
              flex: 1, padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '.875rem', fontWeight: 600,
              background: activeGroup === g.key ? '#fff' : 'transparent',
              color: activeGroup === g.key ? 'var(--clr-primary)' : 'var(--clr-gray-500)',
              boxShadow: activeGroup === g.key ? 'var(--shadow-sm)' : 'none',
              transition: 'all .15s',
            }}>
            {g.label}
            {g.total > 0 && (
              <span style={{ marginLeft: 6, fontSize: '.78rem', color: activeGroup === g.key ? 'var(--clr-primary)' : 'var(--clr-gray-400)' }}>
                ({g.total.toLocaleString('vi-VN')} ₫)
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Drug list ──────────────────────────────────────────────────────── */}
      {(activeGroup === 'bhyt' ? bhytDrugs : nonBhytDrugs).length === 0 && !adding ? (
        <EmptyState
          icon="💊"
          title={`Chưa có thuốc ${activeGroup === 'bhyt' ? 'BHYT' : 'ngoài BHYT'}`}
          description="Nhấn '+ Thêm thuốc' để kê đơn."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(activeGroup === 'bhyt' ? bhytDrugs : nonBhytDrugs).map((item, idx) => (
            <DrugRow
              key={item.id} item={item} idx={idx}
              disabled={disabled} onDelete={onDelete} fmtMoney={fmtMoney}
              hasWarning={warnings.some(w => w.drug_a_code === item.item_code || w.drug_b_code === item.item_code)}
            />
          ))}
        </div>
      )}

      {/* ── Add form ───────────────────────────────────────────────────────── */}
      {!disabled && (
        adding ? (
          <form onSubmit={handleSubmit(onAdd)}
            style={{ padding: 16, background: 'var(--clr-gray-50)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--clr-gray-700)' }}>
              Thêm thuốc {activeGroup === 'bhyt' ? 'BHYT' : 'ngoài BHYT'}
            </div>

            <div className="form-row form-row-2">
              <Field label="Mã thuốc">
                <input {...register('item_code')} className="form-input" placeholder="VD: H01BA02" />
              </Field>
              <Field label="Loại chi trả">
                <select {...register('payment_type')} className="form-input">
                  {activeGroup === 'bhyt' ? (
                    <option value="bhyt">BHYT</option>
                  ) : (
                    <>
                      <option value="fee">Dịch vụ (thu phí)</option>
                      <option value="request">Theo yêu cầu</option>
                      <option value="free">Miễn phí</option>
                      <option value="consume">Hao phí vật tư</option>
                    </>
                  )}
                </select>
              </Field>
            </div>

            <Field label="Tên thuốc" required error={errors.item_name?.message}>
              <input {...register('item_name')}
                className={`form-input${errors.item_name ? ' error' : ''}`}
                placeholder="Tên thuốc, hoạt chất..." autoFocus />
            </Field>

            <div className="form-row form-row-3">
              <Field label="Đơn vị">
                <select {...register('unit')} className="form-input">
                  <option value="">—</option>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Số lượng" required>
                <input {...register('quantity')} type="number" min={0.01} step={1} className="form-input" />
              </Field>
              <Field label="Đơn giá (VNĐ)">
                <input {...register('unit_price')} type="number" min={0} className="form-input" placeholder="0" />
              </Field>
            </div>

            {/* Dosage builder */}
            <div style={{ background: '#fff', border: '1px solid var(--clr-gray-200)', borderRadius: 8, padding: '12px 16px' }}>
              <div className="text-xs text-muted" style={{ marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Liều dùng
              </div>
              <div className="form-row form-row-3">
                {(['morning', 'noon', 'afternoon', 'evening'] as const).map((t, i) => (
                  <Field key={t} label={['Sáng', 'Trưa', 'Chiều', 'Tối'][i]}>
                    <input {...register(t)} className="form-input" placeholder="1 viên" />
                  </Field>
                ))}
                <Field label="Cách dùng">
                  <input {...register('how_to_use')} className="form-input" placeholder="sau ăn..." />
                </Field>
              </div>
              {(morning || noon || afternoon || evening) && (
                <div style={{ marginTop: 8, padding: '7px 12px', background: 'var(--clr-primary-light)', borderRadius: 6, fontSize: '.83rem', color: 'var(--clr-primary-dark)' }}>
                  📋 {buildInstruction()}
                </div>
              )}
            </div>

            <Field label="Hướng dẫn thêm">
              <input {...register('usage_instruction')} className="form-input"
                placeholder="Nhập trực tiếp nếu không dùng ô liều ở trên" />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={addAsync.loading}>Thêm thuốc</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setAdding(false); reset(); }}>Huỷ</Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="secondary"
            onClick={() => { setAdding(true); setValue('payment_type', activeGroup === 'bhyt' ? 'bhyt' : 'fee'); }}>
            + Thêm thuốc {activeGroup === 'bhyt' ? 'BHYT' : 'ngoài BHYT'}
          </Button>
        )
      )}
    </div>
  );
}

// ── DrugRow ───────────────────────────────────────────────────────────────────

function DrugRow({ item, idx, disabled, onDelete, fmtMoney, hasWarning }: {
  item: PrescriptionItemResponse;
  idx: number;
  disabled: boolean;
  hasWarning: boolean;
  onDelete: (id: number) => void;
  fmtMoney: (v?: number | null) => string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 14px',
      background: hasWarning ? '#fffbeb' : '#fff',
      border: `1px solid ${hasWarning ? '#fde68a' : 'var(--clr-gray-100)'}`,
      borderRadius: 8,
    }}>
      <span style={{
        minWidth: 26, height: 26, borderRadius: '50%', background: 'var(--clr-primary-light)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '.78rem', fontWeight: 700, color: 'var(--clr-primary-dark)', flexShrink: 0, marginTop: 1,
      }}>{idx + 1}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '.875rem', color: 'var(--clr-gray-800)' }}>
          {item.item_name}
          {item.item_code && (
            <span style={{ marginLeft: 8, fontSize: '.75rem', color: 'var(--clr-gray-400)' }}>
              ({item.item_code})
            </span>
          )}
          {hasWarning && (
            <span style={{ marginLeft: 8, fontSize: '.72rem', background: '#fef3c7', color: '#92400e', padding: '1px 7px', borderRadius: 999, fontWeight: 700 }}>
              ⚠️ Cảnh báo
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-1" style={{ flexWrap: 'wrap' }}>
          <span className="text-xs text-muted">SL: <strong>{item.quantity}</strong> {item.unit ?? ''}</span>
          {item.usage_instruction && (
            <span style={{ fontSize: '.78rem', color: 'var(--clr-primary-dark)', background: 'var(--clr-primary-light)', padding: '1px 8px', borderRadius: 4 }}>
              {item.usage_instruction}
            </span>
          )}
          <Badge variant={item.payment_type}>{item.payment_type.toUpperCase()}</Badge>
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {item.total_amount != null && (
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--clr-primary-dark)' }}>
            {fmtMoney(item.total_amount)}
          </div>
        )}
        {item.unit_price != null && (
          <div className="text-xs text-muted">{fmtMoney(item.unit_price)}/đv</div>
        )}
      </div>

      {!disabled && (
        <button
          onClick={() => onDelete(item.id)}
          style={{ background: 'none', border: 'none', color: 'var(--clr-danger)', cursor: 'pointer', padding: '2px 4px', fontSize: '1rem', marginTop: 1 }}
          aria-label="Xoá"
        >✕</button>
      )}
    </div>
  );
}
