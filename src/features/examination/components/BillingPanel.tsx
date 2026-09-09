/**
 * BillingPanel — Viện phí và thanh toán (v3)
 *
 * Design principles:
 *   • Receipt-style layout: summary at top, detail below
 *   • Financial hierarchy: grand total most prominent, balance_due in danger red
 *   • Progressive disclosure: payment form only when needed
 *   • Action gating: actions only appear for valid statuses
 *   • Scan-friendly payment history: method icon + amount aligned right
 */
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { billingApi } from '@api/billing.api';
import type { PaymentCreate } from '@api/billing.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field } from '@components/ui';
import type { BillResponse, BillStatus, PaymentMethod } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BillStatus, {
  label: string; icon: string;
  bg: string; border: string; color: string; textColor: string;
}> = {
  draft:     { label: 'Bản nháp',              icon: '📝', bg: '#f8fafc', border: '#e2e8f0', color: '#475569', textColor: '#334155' },
  issued:    { label: 'Chờ thanh toán',         icon: '📤', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', textColor: '#1e3a5f' },
  partial:   { label: 'Thanh toán một phần',    icon: '⏳', bg: '#fefce8', border: '#fde68a', color: '#b45309', textColor: '#92400e' },
  paid:      { label: 'Đã thanh toán đầy đủ',  icon: '✅', bg: '#f0fdf4', border: '#86efac', color: '#16a34a', textColor: '#065f46' },
  cancelled: { label: 'Đã huỷ',                icon: '❌', bg: '#fff1f2', border: '#fca5a5', color: '#dc2626', textColor: '#991b1b' },
  refunded:  { label: 'Đã hoàn tiền',          icon: '↩️', bg: '#faf5ff', border: '#d8b4fe', color: '#7c3aed', textColor: '#4c1d95' },
};

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'Tiền mặt',       icon: '💵' },
  { value: 'transfer', label: 'Chuyển khoản',    icon: '🏦' },
  { value: 'card',     label: 'Thẻ ngân hàng',  icon: '💳' },
  { value: 'momo',     label: 'MoMo',           icon: '📱' },
  { value: 'vnpay',    label: 'VNPay',          icon: '📲' },
  { value: 'zalopay',  label: 'ZaloPay',        icon: '💚' },
  { value: 'bhyt',     label: 'BHYT trực tiếp', icon: '🏥' },
  { value: 'defer',    label: 'Công nợ',        icon: '📋' },
];

// ── Payment form schema ────────────────────────────────────────────────────────

const paymentSchema = z.object({
  payment_method:  z.string().default('cash'),
  amount:          z.coerce.number().positive('Số tiền phải lớn hơn 0'),
  transaction_ref: z.string().optional(),
  note:            z.string().optional(),
  is_deposit:      z.boolean().default(false),
});
type PaymentFormValues = z.infer<typeof paymentSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examId:      number;
  patientName?: string | null;
  canEdit:     boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(v: number | string | null | undefined): string {
  if (v == null) return '0 ₫';
  const n = Number(v);
  return n.toLocaleString('vi-VN') + ' ₫';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillingPanel({ examId, patientName, canEdit }: Props) {
  const [bill,        setBill]        = useState<BillResponse | null>(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [discount,    setDiscount]    = useState('');

  const loadAsync   = useAsync<BillResponse>();
  const createAsync = useAsync<BillResponse>();
  const issueAsync  = useAsync<BillResponse>();
  const payAsync    = useAsync<BillResponse>();
  const cancelAsync = useAsync<BillResponse>();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_method: 'cash', is_deposit: false },
  });

  const load = useCallback(async () => {
    try {
      const res = await loadAsync.run(billingApi.getBillByExam(examId));
      if (res) setBill(res);
    } catch {
      setBill(null);
    }
  }, [examId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const res = await createAsync.run(
      billingApi.createBill({ examination_id: examId, discount_amount: discount ? Number(discount) : 0 })
    );
    if (res) { toast.success('Đã tạo hoá đơn'); setBill(res); setDiscount(''); }
    else toast.error(createAsync.error ?? 'Tạo thất bại');
  };

  const handleIssue = async () => {
    if (!bill) return;
    const res = await issueAsync.run(billingApi.issueBill(bill.id));
    if (res) { toast.success('Đã phát hành hoá đơn'); setBill(res); }
    else toast.error(issueAsync.error ?? 'Thất bại');
  };

  const handleCancel = async () => {
    if (!bill || !confirm('Huỷ hoá đơn này? Thao tác không thể hoàn tác.')) return;
    const res = await cancelAsync.run(billingApi.cancelBill(bill.id));
    if (res) { toast.success('Đã huỷ hoá đơn'); setBill(res); }
    else toast.error(cancelAsync.error ?? 'Thất bại');
  };

  const handlePay = async (data: PaymentFormValues) => {
    if (!bill) return;
    const payload: PaymentCreate = {
      payment_method:  data.payment_method as PaymentMethod,
      amount:          data.amount,
      transaction_ref: data.transaction_ref || undefined,
      note:            data.note || undefined,
      is_deposit:      data.is_deposit,
    };
    const res = await payAsync.run(billingApi.addPayment(bill.id, payload));
    if (res) {
      toast.success('Đã ghi nhận thanh toán');
      setBill(res); setShowPayForm(false); reset();
    } else toast.error(payAsync.error ?? 'Thất bại');
  };

  const watchedMethod = watch('payment_method') as PaymentMethod;
  const selectedMethod = PAYMENT_METHODS.find(m => m.value === watchedMethod);

  // ── No bill ──────────────────────────────────────────────────────────────────

  if (!bill) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {/* Illustration */}
        <div style={{
          width: '100%',
          padding: '24px 0 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'linear-gradient(180deg, #f8fafc, #fff)',
          borderRadius: 12,
          border: '2px dashed var(--clr-gray-200)',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: '2.8rem', marginBottom: 10, opacity: .35 }}>🧾</div>
          <div style={{ fontWeight: 700, color: 'var(--clr-gray-700)', marginBottom: 4 }}>
            Chưa có hoá đơn
          </div>
          <div style={{ fontSize: '.8rem', color: 'var(--clr-gray-400)', textAlign: 'center', maxWidth: 280 }}>
            {patientName ? `Hoá đơn cho ${patientName}` : 'Hoá đơn'} sẽ được tạo sau khi phiếu khám hoàn tất
          </div>
        </div>

        {canEdit && (
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            padding: '14px',
            background: 'var(--clr-gray-50)',
            border: '1px solid var(--clr-gray-200)',
            borderRadius: 10,
            width: '100%',
          }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: 'block', fontSize: '.65rem', fontWeight: 700,
                color: 'var(--clr-gray-500)', textTransform: 'uppercase' as const,
                letterSpacing: '.06em', marginBottom: 5,
              }}>Giảm giá (₫)</label>
              <input
                type="number" min={0} step={1000} className="form-input"
                value={discount} placeholder="0 — không giảm"
                onChange={e => setDiscount(e.target.value)}
              />
            </div>
            <Button loading={createAsync.loading} onClick={handleCreate}>
              🧾 Tạo hoá đơn
            </Button>
          </div>
        )}
      </div>
    );
  }

  const stCfg = STATUS_CONFIG[bill.status] ?? STATUS_CONFIG.draft;

  // ── Bill exists ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Receipt header ────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 12,
        border: `1px solid ${stCfg.border}`,
        overflow: 'hidden',
      }}>
        {/* Status bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: stCfg.bg,
          borderBottom: `1px solid ${stCfg.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1rem' }}>{stCfg.icon}</span>
            <div>
              <div style={{ fontSize: '.78rem', fontWeight: 800, color: stCfg.textColor, fontFamily: 'var(--font-mono)' }}>
                {bill.bill_number}
              </div>
              <div style={{ fontSize: '.68rem', color: stCfg.color }}>
                {stCfg.label}
                {bill.issued_at && ` · ${new Date(bill.issued_at).toLocaleString('vi-VN')}`}
              </div>
            </div>
          </div>

          {/* Grand total */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '.62rem', color: stCfg.color, marginBottom: 1, textTransform: 'uppercase' as const, letterSpacing: '.06em' }}>
              Tổng chi phí
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stCfg.textColor, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {fmtMoney(bill.grand_total)}
            </div>
            {bill.balance_due > 0 && (
              <div style={{ fontSize: '.75rem', color: '#dc2626', fontWeight: 700, marginTop: 3 }}>
                Còn phải nộp: {fmtMoney(bill.balance_due)}
              </div>
            )}
            {bill.balance_due === 0 && bill.status === 'paid' && (
              <div style={{ fontSize: '.72rem', color: '#16a34a', fontWeight: 700, marginTop: 3 }}>
                ✅ Đã thanh toán đầy đủ
              </div>
            )}
          </div>
        </div>

        {/* Cost breakdown — horizontal strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          background: '#fff',
          borderBottom: `1px solid ${stCfg.border}`,
        }}>
          {[
            { label: '💊 Thuốc',      value: bill.drug_total,    color: '#1d4ed8' },
            { label: '🔬 CLS',        value: bill.cls_total,     color: '#7c3aed' },
            { label: '🏥 BHYT trả',   value: bill.bhyt_pays,     color: '#059669' },
            { label: '👤 BN phải trả', value: bill.patient_pays, color: '#dc2626', bold: true },
          ].map((item, i, arr) => (
            <div key={item.label} style={{
              padding: '10px 12px',
              borderRight: i < arr.length - 1 ? `1px solid ${stCfg.border}` : 'none',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '.65rem', color: 'var(--clr-gray-400)', marginBottom: 3 }}>{item.label}</div>
              <div style={{
                fontSize: '.82rem', fontWeight: item.bold ? 800 : 600,
                color: item.color, fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtMoney(item.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Adjustments row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          background: 'var(--clr-gray-50)',
          padding: '8px 0',
        }}>
          {[
            { label: '🏷️ Giảm giá',  value: bill.discount_amount, color: '#059669' },
            { label: '💵 Tạm ứng',   value: bill.deposit_amount,  color: '#0369a1' },
            { label: '⚠️ Còn nộp',   value: bill.balance_due,     color: bill.balance_due > 0 ? '#dc2626' : '#059669', bold: true },
          ].map((item, i, arr) => (
            <div key={item.label} style={{
              padding: '4px 12px',
              borderRight: i < arr.length - 1 ? '1px solid var(--clr-gray-200)' : 'none',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '.62rem', color: 'var(--clr-gray-400)', marginBottom: 2 }}>{item.label}</div>
              <div style={{
                fontSize: '.78rem', fontWeight: item.bold ? 800 : 600,
                color: item.color, fontVariantNumeric: 'tabular-nums',
              }}>
                {fmtMoney(item.value)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bill items table ────────────────────────────────────────────── */}
      {bill.items.length > 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid var(--clr-gray-200)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'var(--clr-gray-50)',
            borderBottom: '1px solid var(--clr-gray-200)',
          }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--clr-gray-700)' }}>
              📋 Danh sách dịch vụ
            </span>
            <span style={{
              fontSize: '.62rem', padding: '1px 6px', borderRadius: 3,
              background: 'var(--clr-gray-200)', color: 'var(--clr-gray-500)', fontWeight: 600,
            }}>
              {bill.items.length} mục
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.77rem' }}>
              <thead>
                <tr style={{ background: 'var(--clr-gray-50)' }}>
                  {['#', 'Loại', 'Tên dịch vụ', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền', 'BHYT', 'BN trả'].map(h => (
                    <th key={h} style={{
                      padding: '7px 10px', textAlign: h === '#' || h === 'SL' ? 'center' : 'left',
                      fontSize: '.62rem', fontWeight: 700, textTransform: 'uppercase' as const,
                      letterSpacing: '.05em', color: 'var(--clr-gray-500)',
                      borderBottom: '1px solid var(--clr-gray-200)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, i) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--clr-gray-100)' }}>
                    <td style={{ padding: '7px 10px', textAlign: 'center', color: 'var(--clr-gray-400)', fontSize: '.68rem' }}>{i + 1}</td>
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{
                        fontSize: '.6rem', fontWeight: 700,
                        padding: '1px 5px', borderRadius: 3,
                        background: it.item_type === 'drug' ? '#dbeafe' : '#f3e8ff',
                        color: it.item_type === 'drug' ? '#1d4ed8' : '#7c3aed',
                      }}>
                        {it.item_type === 'drug' ? '💊 Thuốc' : '🔬 CLS'}
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', maxWidth: 200 }}>
                      <div style={{ fontWeight: 600, color: 'var(--clr-gray-800)', lineHeight: 1.3 }}>{it.item_name}</div>
                    </td>
                    <td style={{ padding: '7px 10px', color: 'var(--clr-gray-500)' }}>{it.unit ?? '—'}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{it.quantity}</td>
                    <td style={{ padding: '7px 10px', fontVariantNumeric: 'tabular-nums', color: 'var(--clr-gray-600)' }}>{fmtMoney(it.unit_price)}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.total_amount)}</td>
                    <td style={{ padding: '7px 10px', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.bhyt_amount)}</td>
                    <td style={{ padding: '7px 10px', color: '#dc2626', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.patient_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Payment history ─────────────────────────────────────────────── */}
      {bill.payments.length > 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid var(--clr-gray-200)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px',
            background: 'var(--clr-gray-50)',
            borderBottom: '1px solid var(--clr-gray-200)',
          }}>
            <span style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--clr-gray-700)' }}>
              💳 Lịch sử thanh toán
            </span>
            <span style={{
              fontSize: '.62rem', padding: '1px 6px', borderRadius: 3,
              background: 'var(--clr-gray-200)', color: 'var(--clr-gray-500)', fontWeight: 600,
            }}>
              {bill.payments.length} giao dịch
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {bill.payments.map((p, i) => {
              const mInfo = PAYMENT_METHODS.find(m => m.value === p.payment_method);
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderBottom: i < bill.payments.length - 1 ? '1px solid var(--clr-gray-100)' : 'none',
                  background: p.is_refund ? '#fff1f2' : '#fff',
                }}>
                  {/* Method icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: p.is_refund ? '#fee2e2' : '#f0fdf4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem',
                  }}>
                    {mInfo?.icon ?? '💰'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--clr-gray-800)' }}>
                        {mInfo?.label ?? p.payment_method}
                      </span>
                      {p.is_deposit && (
                        <span style={{
                          fontSize: '.6rem', fontWeight: 700,
                          padding: '1px 6px', borderRadius: 3,
                          background: '#dbeafe', color: '#1d4ed8',
                        }}>Tạm ứng</span>
                      )}
                      {p.is_refund && (
                        <span style={{
                          fontSize: '.6rem', fontWeight: 700,
                          padding: '1px 6px', borderRadius: 3,
                          background: '#fee2e2', color: '#dc2626',
                        }}>Hoàn tiền</span>
                      )}
                    </div>
                    <div style={{ fontSize: '.7rem', color: 'var(--clr-gray-400)', marginTop: 2 }}>
                      {new Date(p.paid_at).toLocaleString('vi-VN')}
                      {p.transaction_ref && ` · ${p.transaction_ref}`}
                      {p.note && ` · ${p.note}`}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '.9rem', fontWeight: 800,
                    color: p.is_refund ? '#dc2626' : '#16a34a',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}>
                    {p.is_refund ? '−' : '+'}{fmtMoney(p.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {bill.status === 'draft' && (
            <Button size="sm" loading={issueAsync.loading} onClick={handleIssue}>
              📤 Phát hành hoá đơn
            </Button>
          )}
          {(bill.status === 'issued' || bill.status === 'partial') && (
            <Button
              size="sm"
              onClick={() => setShowPayForm(v => !v)}
              style={showPayForm ? {
                background: 'var(--clr-gray-100)',
                color: 'var(--clr-gray-700)',
                border: '1px solid var(--clr-gray-200)',
              } : {
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px rgba(22,163,74,.3)',
              }}
            >
              {showPayForm ? '✕ Đóng form' : '💰 Thu tiền'}
            </Button>
          )}
          {(bill.status === 'draft' || bill.status === 'issued') && (
            <Button size="sm" variant="danger" loading={cancelAsync.loading} onClick={handleCancel}>
              Huỷ hoá đơn
            </Button>
          )}

          {/* Balance badge */}
          {bill.balance_due > 0 && (
            <div style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px',
              background: '#fff1f2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              fontSize: '.78rem',
              color: '#dc2626',
              fontWeight: 700,
            }}>
              ⚠️ Còn nộp: {fmtMoney(bill.balance_due)}
            </div>
          )}
        </div>
      )}

      {/* ── Payment form ─────────────────────────────────────────────────── */}
      {showPayForm && canEdit && (
        <form
          onSubmit={handleSubmit(handlePay)}
          style={{
            borderRadius: 12,
            border: '1px solid #86efac',
            overflow: 'hidden',
          }}
        >
          {/* Form header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px',
            background: 'linear-gradient(90deg, #f0fdf4, #dcfce7)',
            borderBottom: '1px solid #86efac',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.9rem' }}>💰</span>
              <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#166534' }}>Thu tiền</span>
            </div>
            <div style={{ fontSize: '.82rem', color: '#166534' }}>
              Còn phải nộp: <strong>{fmtMoney(bill.balance_due)}</strong>
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, background: '#fff' }}>
            {/* Payment method — pill selector */}
            <div>
              <label style={{
                display: 'block', fontSize: '.65rem', fontWeight: 700,
                color: 'var(--clr-gray-500)', textTransform: 'uppercase' as const,
                letterSpacing: '.06em', marginBottom: 8,
              }}>Phương thức thanh toán</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PAYMENT_METHODS.map(m => {
                  const sel = watchedMethod === m.value;
                  return (
                    <label
                      key={m.value}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 11px',
                        border: `1.5px solid ${sel ? '#16a34a' : 'var(--clr-gray-200)'}`,
                        borderRadius: 9999,
                        background: sel ? '#dcfce7' : '#fff',
                        color: sel ? '#166534' : 'var(--clr-gray-600)',
                        fontSize: '.78rem',
                        fontWeight: sel ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all .1s',
                      }}
                    >
                      <input
                        type="radio"
                        value={m.value}
                        {...register('payment_method')}
                        style={{ display: 'none' }}
                      />
                      {m.icon} {m.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Amount + ref */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Số tiền (₫)" required error={errors.amount?.message}>
                <input
                  {...register('amount')}
                  type="number" min={1} step={1000}
                  className={`form-input${errors.amount ? ' error' : ''}`}
                  placeholder={String(bill.balance_due)}
                  defaultValue={bill.balance_due > 0 ? bill.balance_due : undefined}
                  style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                />
              </Field>
              <Field label="Mã giao dịch">
                <input {...register('transaction_ref')} className="form-input"
                  placeholder={selectedMethod?.value === 'transfer' ? 'Số GD ngân hàng...' : 'Không bắt buộc'} />
              </Field>
            </div>

            <Field label="Ghi chú">
              <input {...register('note')} className="form-input" placeholder="Ghi chú thêm (không bắt buộc)..." />
            </Field>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" {...register('is_deposit')} style={{ width: 14, height: 14, accentColor: '#0284c7' }} />
              <span style={{ fontSize: '.82rem', color: 'var(--clr-gray-600)' }}>
                Đây là khoản tạm ứng (chưa phải thanh toán cuối cùng)
              </span>
            </label>

            <div style={{ display: 'flex', gap: 8, paddingTop: 2 }}>
              <Button
                type="submit"
                loading={payAsync.loading}
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff', border: 'none',
                  boxShadow: '0 2px 8px rgba(22,163,74,.35)',
                }}
              >
                ✅ Xác nhận thu tiền
              </Button>
              <Button
                type="button" variant="ghost"
                onClick={() => { setShowPayForm(false); reset(); }}
              >
                Huỷ
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
