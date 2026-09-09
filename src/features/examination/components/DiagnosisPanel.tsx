/**
 * DiagnosisPanel — ICD-10 chẩn đoán (v3)
 *
 * Design principles:
 *   • Primary diagnosis always visually prominent (larger, red badge, top)
 *   • Secondary diagnoses compact, sorted below
 *   • Add form: inline expand (no modal), ICD code + name side-by-side
 *   • Quick affordance: "Thêm chẩn đoán" always visible, keyboard-accessible
 *   • Delete: subtle × icon, no confirmation needed (fast workflow)
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field } from '@components/ui';
import type { DiagnosisResponse } from '@/types';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  icd_code:   z.string().optional(),
  icd_name:   z.string().min(2, 'Tên chẩn đoán tối thiểu 2 ký tự'),
  is_primary: z.boolean().default(false),
  note:       z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examId:    number;
  diagnoses: DiagnosisResponse[];
  disabled:  boolean;
  onChanged: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DiagnosisPanel({ examId, diagnoses, disabled, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const addAsync = useAsync<DiagnosisResponse>();
  const delAsync = useAsync<void>();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { is_primary: diagnoses.length === 0 }, // first diag = primary by default
  });

  const isPrimaryWatch = watch('is_primary');

  const onAdd = async (data: FormValues) => {
    const res = await addAsync.run(
      examinationApi.addDiagnosis(examId, {
        icd_code:   data.icd_code || undefined,
        icd_name:   data.icd_name,
        is_primary: data.is_primary,
        note:       data.note || undefined,
      }),
    );
    if (res) {
      toast.success('Đã thêm chẩn đoán');
      reset({ is_primary: false });
      setAdding(false);
      onChanged();
    } else {
      toast.error(addAsync.error ?? 'Thêm thất bại');
    }
  };

  const onDelete = async (diagId: number, diagName: string) => {
    await delAsync.run(examinationApi.deleteDiagnosis(examId, diagId));
    toast.success(`Đã xoá: ${diagName}`);
    onChanged();
  };

  // Sort: primary first, then secondary
  const sorted = [...diagnoses].sort((a, b) =>
    a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Diagnosis list ─────────────────────────────────────────────── */}
      {sorted.length === 0 && !adding && (
        <div style={{
          padding: '14px',
          background: 'var(--clr-gray-50)',
          border: '1px dashed var(--clr-gray-300)',
          borderRadius: 8,
          textAlign: 'center',
          color: 'var(--clr-gray-400)',
          fontSize: '.8rem',
        }}>
          Chưa có chẩn đoán — thêm ICD-10 bên dưới
        </div>
      )}

      {sorted.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sorted.map(d => (
            <DiagnosisRow
              key={d.id}
              diagnosis={d}
              disabled={disabled}
              onDelete={() => onDelete(d.id, d.icd_name)}
              deleting={delAsync.loading}
            />
          ))}
        </div>
      )}

      {/* ── Add form ────────────────────────────────────────────────────── */}
      {!disabled && (
        adding ? (
          <form
            onSubmit={handleSubmit(onAdd)}
            style={{
              borderRadius: 10,
              border: '1px solid #bfdbfe',
              overflow: 'hidden',
              marginTop: 2,
            }}
          >
            {/* Form header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px',
              background: 'linear-gradient(90deg, #eff6ff, #dbeafe)',
              borderBottom: '1px solid #bfdbfe',
            }}>
              <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1d4ed8' }}>
                + Thêm chẩn đoán ICD-10
              </span>
              {isPrimaryWatch && (
                <span style={{
                  fontSize: '.65rem', fontWeight: 800,
                  padding: '2px 7px', borderRadius: 3,
                  background: '#dc2626', color: '#fff',
                }}>CĐ CHÍNH</span>
              )}
            </div>

            <div style={{ padding: '14px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* ICD code + name */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10 }}>
                <Field label="Mã ICD-10">
                  <input
                    {...register('icd_code')}
                    className="form-input"
                    placeholder="VD: J18.9"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.04em', textTransform: 'uppercase' as const }}
                    onBlur={e => { e.target.value = e.target.value.toUpperCase(); }}
                  />
                </Field>
                <Field label="Tên chẩn đoán" required error={errors.icd_name?.message}>
                  <input
                    {...register('icd_name')}
                    className={`form-input${errors.icd_name ? ' error' : ''}`}
                    placeholder="Tên đầy đủ của bệnh / chẩn đoán..."
                    autoFocus
                  />
                </Field>
              </div>

              {/* Note + is_primary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
                <Field label="Ghi chú (không bắt buộc)">
                  <input
                    {...register('note')}
                    className="form-input"
                    placeholder="Ghi chú thêm về chẩn đoán này..."
                  />
                </Field>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '7px 12px',
                  border: `1.5px solid ${isPrimaryWatch ? '#dc2626' : 'var(--clr-gray-200)'}`,
                  borderRadius: 8,
                  background: isPrimaryWatch ? '#fef2f2' : '#fff',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all .12s',
                  marginBottom: 0,
                }}>
                  <input
                    type="checkbox"
                    {...register('is_primary')}
                    style={{ width: 14, height: 14, accentColor: '#dc2626' }}
                  />
                  <span style={{ fontSize: '.78rem', fontWeight: isPrimaryWatch ? 700 : 400, color: isPrimaryWatch ? '#dc2626' : 'var(--clr-gray-600)' }}>
                    Chẩn đoán chính
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="submit" size="sm" loading={addAsync.loading}>
                  ✓ Thêm chẩn đoán
                </Button>
                <Button
                  type="button" size="sm" variant="ghost"
                  onClick={() => { setAdding(false); reset(); }}
                >
                  Huỷ
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 14px',
              border: '1.5px dashed var(--clr-gray-300)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--clr-gray-500)',
              fontFamily: 'var(--font-sans)',
              fontSize: '.8rem',
              cursor: 'pointer',
              transition: 'all .12s',
              width: '100%',
              justifyContent: 'center',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--clr-primary)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--clr-primary)';
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--clr-primary-subtle)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--clr-gray-300)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--clr-gray-500)';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '.9rem' }}>+</span>
            Thêm chẩn đoán ICD-10
          </button>
        )
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DiagnosisRow
// ─────────────────────────────────────────────────────────────────────────────

function DiagnosisRow({
  diagnosis, disabled, onDelete, deleting,
}: {
  diagnosis: DiagnosisResponse;
  disabled: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const d = diagnosis;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: d.is_primary ? '10px 12px' : '8px 12px',
      borderRadius: 9,
      background: d.is_primary ? '#fef2f2' : 'var(--clr-gray-50)',
      border: `1px solid ${d.is_primary ? '#fca5a5' : 'var(--clr-gray-200)'}`,
      transition: 'all .12s',
    }}>
      {/* Primary badge */}
      {d.is_primary ? (
        <span style={{
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center',
          fontSize: '.6rem', fontWeight: 800,
          padding: '2px 7px', borderRadius: 3,
          background: '#dc2626', color: '#fff',
          marginTop: 1,
          letterSpacing: '.03em',
          whiteSpace: 'nowrap',
        }}>CĐ chính</span>
      ) : (
        <span style={{
          flexShrink: 0,
          width: 10, height: 10,
          borderRadius: '50%',
          background: 'var(--clr-gray-300)',
          display: 'block',
          marginTop: 4,
        }} />
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {d.icd_code && (
            <span style={{
              fontSize: '.72rem', fontWeight: 800,
              color: d.is_primary ? '#b91c1c' : 'var(--clr-primary-dark)',
              fontFamily: 'var(--font-mono)',
              background: d.is_primary ? '#fee2e2' : 'var(--clr-primary-light)',
              padding: '1px 6px', borderRadius: 4,
              letterSpacing: '.03em',
            }}>{d.icd_code}</span>
          )}
          <span style={{
            fontSize: d.is_primary ? '.85rem' : '.8rem',
            fontWeight: d.is_primary ? 700 : 500,
            color: d.is_primary ? '#1c1917' : 'var(--clr-gray-700)',
            lineHeight: 1.4,
          }}>
            {d.icd_name}
          </span>
        </div>
        {d.note && (
          <div style={{ fontSize: '.72rem', color: 'var(--clr-gray-500)', marginTop: 3, fontStyle: 'italic' }}>
            {d.note}
          </div>
        )}
      </div>

      {/* Delete button */}
      {!disabled && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          title="Xoá chẩn đoán này"
          style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22,
            borderRadius: 5,
            border: 'none',
            background: 'transparent',
            color: 'var(--clr-gray-400)',
            cursor: 'pointer',
            fontSize: '.75rem',
            transition: 'all .1s',
            marginTop: 1,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = '#fee2e2';
            (e.currentTarget as HTMLButtonElement).style.color = '#dc2626';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--clr-gray-400)';
          }}
          aria-label="Xoá chẩn đoán"
        >
          ✕
        </button>
      )}
    </div>
  );
}
